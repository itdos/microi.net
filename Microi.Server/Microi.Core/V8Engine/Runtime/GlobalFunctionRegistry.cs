using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Acornima;
using Acornima.Ast;
using Dos.ORM;
using Jint;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 租户全局函数缓存与代码合并。表/种子由系统设置应用交付，运行时不建表、不覆盖租户代码。
    /// 使用现有 L1/Redis；提交后版本键使加载中的旧快照无法污染新版本。
    /// </summary>
    public static class GlobalFunctionRegistry
    {
        public const string TableName = "mci_global_function";
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
        private static readonly Regex NamePattern = new Regex(@"^[A-Za-z_$][A-Za-z0-9_$]{0,99}$", RegexOptions.Compiled);
        private static readonly Lazy<string> BuiltinSource = new Lazy<string>(() =>
        {
            using var stream = typeof(GlobalFunctionRegistry).Assembly.GetManifestResourceStream("Microi.GlobalDateFunctions.js")
                ?? throw new InvalidOperationException("日期基础函数资源缺失。");
            using var reader = new StreamReader(stream, Encoding.UTF8);
            return reader.ReadToEnd();
        });
        private static readonly Lazy<Dictionary<string, string>> BuiltinDefinitions = new Lazy<Dictionary<string, string>>(() =>
            new Parser().ParseScript(DateFunctionSource).Body.OfType<FunctionDeclaration>()
                .ToDictionary(fn => fn.Id.Name, fn => DateFunctionSource.Substring(fn.Range.Start, fn.Range.End - fn.Range.Start)));
        private static readonly Lazy<Dictionary<string, Prepared<Script>>> BuiltinScripts = new Lazy<Dictionary<string, Prepared<Script>>>(() =>
            BuiltinDefinitions.Value.ToDictionary(item => item.Key, item => Engine.PrepareScript("(" + item.Value + ")", "<microi-date-functions>")));
        public static string DateFunctionSource => BuiltinSource.Value;

        /// <summary>复用 Prepared AST，不共享函数对象、租户变量或 Engine。</summary>
        public static void InstallBootstrap(Engine engine)
        {
            // 仅不可变内置声明属于宿主初始化，不消耗租户语句额度。
            // 使用函数表达式安装属性，不占用全局声明名，允许客户历史 const/let 同名函数。
            var statements = engine.Constraints.Find<Jint.Constraints.MaxStatementsConstraint>();
            var maximum = statements?.MaxStatements;
            try
            {
                if (statements != null) statements.MaxStatements = int.MaxValue;
                foreach (var item in BuiltinScripts.Value) engine.SetValue(item.Key, engine.Evaluate(item.Value));
            }
            finally
            {
                if (statements != null) statements.MaxStatements = maximum.Value;
                engine.Constraints.Reset();
            }
        }
        public static string RevisionKey(string osClient) =>
            $"Microi:{TenantConfigurationSecurity.NormalizeTenantId(osClient)}:GlobalFunctions:Revision:v1";

        private static GlobalFunctionSnapshot LoadRows(string osClient, IMicroiCache cache, string revision)
        {
            var key = $"Microi:{osClient}:GlobalFunctions:Rows:v1:{revision}";
            var cached = cache.Get<GlobalFunctionSnapshot>(key);
            if (cached != null) return cached;
            var db = OsClientExtend.GetClient(osClient)?.Db;
            if (db == null) throw new InvalidOperationException("全局函数库的租户数据库不可用。");
            if (!db.TableExists(TableName) || !db.ColumnExists(TableName, "Code") || !db.ColumnExists(TableName, "Sort"))
            {
                // 旧库安装前允许短暂空快照；后续安装完成不需要重启才能发现新表。
                var empty = new GlobalFunctionSnapshot { Rows = new JArray(), Fingerprint = "empty" };
                cache.Set(key, empty, TimeSpan.FromSeconds(10));
                return empty;
            }
            // 不经过 FormEngine，避免 GetSysConfig -> 表单事件 -> GetSysConfig 递归。
            var rows = db.FromSql($"SELECT Id,SysConfigId,FunctionName,Runtime,Code,IsEnabled,Sort FROM {TableName} " +
                "WHERE (IsDeleted<>1 OR IsDeleted IS NULL) AND IsEnabled=1 ORDER BY Sort,FunctionName,Id")
                .ToList<GlobalFunctionRow>();
            if (rows.Count > 1000) throw new InvalidOperationException("启用的全局函数超过1000条，请先整理函数库。");
            var array = JArray.FromObject(rows);
            var json = array.ToString(Formatting.None);
            if (json.Length > 2 * 1024 * 1024) throw new InvalidOperationException("全局函数源码超过2MB限制。");
            var snapshot = new GlobalFunctionSnapshot { Rows = array, Fingerprint = Hash(json) };
            cache.Set(key, snapshot, CacheTtl);
            return snapshot;
        }

        /// <summary>
        /// 只修改执行/下发副本，原始 SysConfig 缓存和数据库保持不变。
        /// 合并顺序：基础函数、当前设置函数库、原有代码，保留历史同名自定义函数的优先级。
        /// </summary>
        public static JObject Attach(object rawConfig, string osClient)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var config = rawConfig is JObject obj ? (JObject)obj.DeepClone() : JObject.FromObject(rawConfig);
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var revision = cache.Get<string>(RevisionKey(osClient)) ?? "initial";
            var snapshot = LoadRows(osClient, cache, revision);
            var rows = snapshot.Rows;
            var clientCode = Decode(config["GlobalV8Code"]?.ToString());
            var serverCode = Decode(config["GlobalServerV8Code"]?.ToString());
            // 快照内容参与签名：安装前空快照失效后，新函数不被旧合并结果遮住。
            var signature = Hash(config["Id"] + "\n" + snapshot.Fingerprint + "\n" + clientCode + "\n" + serverCode);
            var key = $"Microi:{osClient}:GlobalFunctions:Merged:v1:{revision}:{signature}";
            var merged = cache.Get<string>(key);
            JObject codes;
            if (merged != null) codes = JObject.Parse(merged);
            else
            {
                codes = new JObject
                {
                    ["GlobalV8Code"] = Encode(Compose(clientCode, rows, config["Id"]?.ToString(), "Client")),
                    ["GlobalServerV8Code"] = Encode(Compose(serverCode, rows, config["Id"]?.ToString(), "Server"))
                };
                cache.Set(key, codes.ToString(Formatting.None), CacheTtl);
            }
            config["GlobalV8Code"] = codes["GlobalV8Code"];
            config["GlobalServerV8Code"] = codes["GlobalServerV8Code"];
            return config;
        }

        public static string Compose(string legacyCode, JArray rows, string configId, string runtime)
        {
            var legacyNames = new HashSet<string>(StringComparer.Ordinal);
            try
            {
                foreach (var node in new Parser().ParseScript(legacyCode ?? string.Empty).Body)
                {
                    if (node is FunctionDeclaration fn && fn.Id != null) legacyNames.Add(fn.Id.Name);
                    if (node is VariableDeclaration declaration)
                        foreach (var variable in declaration.Declarations)
                            if (variable.Id is Identifier id) legacyNames.Add(id.Name);
                }
            }
            catch { /* 不改写既有脚本；原有语法错误仍由原执行入口完整报告。 */ }
            var output = new StringBuilder();
            foreach (var item in BuiltinDefinitions.Value)
                if (!legacyNames.Contains(item.Key)) output.AppendLine(item.Value);
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var row in rows.OfType<JObject>())
            {
                if (!string.Equals(row["Runtime"]?.ToString(), runtime, StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(row["SysConfigId"]?.ToString(), configId, StringComparison.Ordinal)) continue;
                var name = row["FunctionName"]?.ToString();
                if (name != null && legacyNames.Contains(name)) continue;
                var code = Decode(row["Code"]?.ToString());
                // 维护错误不能让登录、系统设置和安装器同时不可用。隔离无效声明并在缓存构建时记录，
                // 不执行坏代码；正常 UI 保存由同一解析器提前拒绝。日志不包含函数源码。
                try { ValidateDefinition(name, code); }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：全局函数已隔离[设置:{configId}][记录:{row["Id"]}]：{ex.Message}");
                    continue;
                }
                if (!names.Add(name))
                {
                    Console.WriteLine($"Microi：重复全局函数已跳过[设置:{configId}][运行端:{runtime}][函数:{name}]");
                    continue;
                }
                output.AppendLine(code).AppendLine(";");
            }
            // 不引入额外函数作用域，保留旧脚本的变量和函数提升语义。
            return output.AppendLine(legacyCode ?? string.Empty).ToString();
        }

        /// <summary>只解析不执行：一条记录只能是同名 function 声明，不得包含顶层副作用。</summary>
        public static void ValidateDefinition(string name, string code)
        {
            if (!NamePattern.IsMatch(name ?? "") || new[] { "V8", "System", "globalThis", "window", "__proto__" }.Contains(name))
                throw new ArgumentException("函数名必须是有效且非保留的 JavaScript 标识符。");
            if (string.IsNullOrWhiteSpace(code) || code.Length > 128 * 1024)
                throw new ArgumentException("函数源码不能为空且不能超过128KB。");
            var ast = new Parser().ParseScript(code);
            var statements = ast.Body.Where(node => !(node is EmptyStatement)).ToArray();
            if (statements.Length != 1 || !(statements[0] is FunctionDeclaration fn) || fn.Id?.Name != name)
                throw new ArgumentException("每条记录只允许一个与函数名一致的 function 声明，不能包含顶层执行代码。");
        }

        /// <summary>真实事务提交后换代；回滚不变更版本，旧快照在有限 TTL 内淘汰。</summary>
        public static void InvalidateAfterCommit(string osClient, DbTrans trans = null, bool systemConfigChanged = false)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            Action invalidate = () =>
            {
                var cache = MicroiEngine.CacheTenant.Cache(tenant);
                // 原始设置也必须在提交后清除，避免未提交事务期间回填了旧 SysConfig。
                if (systemConfigChanged)
                {
                    cache.Remove($"Microi:{tenant}:SysConfig");
                    MicroiEngine.CacheTenant.Default().Remove($"Microi:{tenant}:SysConfig");
                }
                cache.Set(RevisionKey(tenant), Guid.NewGuid().ToString("N"));
            };
            trans ??= V8TenantContext.CurrentDbTrans;
            if (trans != null && !trans.IsCommitOrRollback) trans.RegisterAfterCommit(invalidate);
            else invalidate();
        }
        public static string Decode(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            return DiyCommon.IsBase64String(text) ? Encoding.UTF8.GetString(Convert.FromBase64String(text)) : text;
        }
        private static string Encode(string code) => Convert.ToBase64String(Encoding.UTF8.GetBytes(code));
        private static string Hash(string value)
        {
            using var sha = SHA256.Create();
            return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "");
        }
    }
    public sealed class GlobalFunctionRow
    {
        public string Id { get; set; }
        public string SysConfigId { get; set; }
        public string FunctionName { get; set; }
        public string Runtime { get; set; }
        public string Code { get; set; }
        public int IsEnabled { get; set; }
        public int Sort { get; set; }
    }
    public sealed class GlobalFunctionSnapshot
    {
        public JArray Rows { get; set; }
        public string Fingerprint { get; set; }
    }
}
