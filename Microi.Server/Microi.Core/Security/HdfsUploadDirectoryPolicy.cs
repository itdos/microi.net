using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 管理员维护的普通系统设置，不是密钥。规则仅授予上传权限，
    /// 不授予私有文件读取、应用发布或跨租户存储权限。
    /// </summary>
    public static class HdfsUploadDirectoryPolicy
    {
        public const string ConfigField = "HdfsUploadRules";
        public const int MaxRules = 128;
        public const int MaxConfigCharacters = 65536;

        public sealed class Rule
        {
            public string Path { get; internal set; }
            internal HdfsUploadPathPattern Pattern { get; set; }
            public IReadOnlyList<string> RoleIds { get; internal set; }
            public bool AllAuthenticated { get; internal set; }
            public bool IncludeSubdirectories { get; internal set; }
            public bool AllowPublic { get; internal set; }
        }

        /// <summary>仅校验本次提交的配置，省略字段时不影响存量设置或普通业务表。</summary>
        public static void ValidateConfigurationWrite(string tableName, object form)
        {
            if (!string.Equals(tableName, "sys_config", StringComparison.OrdinalIgnoreCase)) return;
            var row = form as JObject;
            var property = row?.Properties().FirstOrDefault(item =>
                string.Equals(item.Name, ConfigField, StringComparison.OrdinalIgnoreCase));
            if (property == null) return;
            try { Parse(property.Value); }
            catch (Exception ex) when (ex is ArgumentException || ex is JsonException)
            { throw new ArgumentException("文件上传权限配置无效：" + ex.Message, ConfigField); }
        }

        public static IReadOnlyList<Rule> Parse(JToken raw)
        {
            if (raw == null || raw.Type == JTokenType.Null || string.IsNullOrWhiteSpace(raw.ToString()))
                return Array.Empty<Rule>();
            if (raw.ToString(Formatting.None).Length > MaxConfigCharacters)
                throw new ArgumentException("文件上传权限配置超过长度限制。");
            if (raw.Type == JTokenType.String)
                raw = JToken.Parse(raw.ToString(), new JsonLoadSettings { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
            var rows = raw as JArray;
            if (rows == null || rows.Count > MaxRules)
                throw new ArgumentException("文件上传权限必须为不超过128条的JSON数组。");
            var rules = new List<Rule>();
            foreach (var token in rows)
            {
                var row = token as JObject;
                if (row == null) throw new ArgumentException("上传权限规则必须为对象。");
                if (row["Enabled"] != null && !Flag(row["Enabled"])) continue;
                var pattern = HdfsUploadPathPattern.Parse(row["Path"]?.ToString());
                var all = Flag(row["AllAuthenticated"]);
                var rolesToken = row["RoleIds"];
                // JsonTable 的未填写文本单元格会提交空串；允许“所有登录用户”规则不选角色。
                if (rolesToken?.Type == JTokenType.String && string.IsNullOrWhiteSpace(rolesToken.ToString()))
                    rolesToken = null;
                if (rolesToken?.Type == JTokenType.String && rolesToken.ToString().TrimStart().StartsWith("[", StringComparison.Ordinal))
                    rolesToken = JToken.Parse(rolesToken.ToString());
                if (rolesToken != null && rolesToken.Type != JTokenType.Null && !(rolesToken is JArray))
                    throw new ArgumentException("RoleIds必须是角色Id数组。");
                var roles = (rolesToken as JArray ?? new JArray()).Select(value =>
                {
                    if (value.Type != JTokenType.String) throw new ArgumentException("角色Id必须是字符串。");
                    var id = value.ToString().Trim();
                    if (id.Length == 0 || id.Length > 80 || id.IndexOfAny(new[] { '*', '/', '\\', ',', '\r', '\n' }) >= 0)
                        throw new ArgumentException("角色Id无效；所有登录用户请显式打开AllAuthenticated。");
                    return id;
                }).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                if (roles.Length > 64 || (!all && roles.Length == 0))
                    throw new ArgumentException("每条规则必须选择角色或显式允许所有登录用户，最多64个角色。");
                rules.Add(new Rule { Path = pattern.Path, Pattern = pattern, RoleIds = roles, AllAuthenticated = all,
                    IncludeSubdirectories = Flag(row["IncludeSubdirectories"]), AllowPublic = Flag(row["AllowPublic"]) });
            }
            return rules;
        }

        // 对象存储区分大小写。兼容旧客户端首尾斜杠，但禁止 URL、通配符和平台保留目录。
        internal static string NormalizePath(string value)
        {
            var path = (value ?? string.Empty).Trim().Trim('/');
            if (path.Length == 0 || path.Length > 512 || path.Any(char.IsControl)
                || path.IndexOfAny(new[] { '\\', ':', '%', '?', '#', '*', '[', ']', '{', '}' }) >= 0)
                throw new ArgumentException("目录必须是明确的租户内相对路径，不能是根目录、URL或通配符。");
            ValidatePathParts(path.Split('/'));
            return path;
        }

        internal static void ValidatePathParts(string[] parts)
        {
            if (parts.Any(part => part.Length == 0 || part == "." || part == ".."
                    || part.StartsWith("_", StringComparison.Ordinal)))
                throw new ArgumentException("目录包含非法或保留路径段。");
            var root = parts[0];
            if (root.Equals("micro-app", StringComparison.OrdinalIgnoreCase)
                || root.StartsWith("ai-app", StringComparison.OrdinalIgnoreCase)
                || root.Equals("database-backups", StringComparison.OrdinalIgnoreCase)
                || root.Equals("app-store", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("应用运行产物、源码和数据库备份目录不允许业务上传授权。");
        }

        internal static DosResult Apply(DiyUploadParam param, IReadOnlyList<Rule> rules,
            FormEngineAuthorizationSnapshot identity)
        {
            if (identity?.IsActiveUser != true || string.IsNullOrWhiteSpace(identity.UserId)
                || param?._CurrentUser == null || UserAccessKeySecurity.IsSession(param._CurrentUser)
                || !string.Equals(identity.UserId, param._CurrentUser["Id"]?.ToString(), StringComparison.OrdinalIgnoreCase))
                return Denied("登录身份或上传角色授权已失效，请重新登录或联系管理员。");
            string path;
            try { path = NormalizePath(param.Path); }
            catch { return Denied("上传目录不合法或属于平台保留目录。"); }
            var parts = path.Split('/');
            var matches = rules.Where(rule => rule.Pattern.IsMatch(parts, rule.IncludeSubdirectories))
                .Where(rule => rule.AllAuthenticated || rule.RoleIds.Intersect(identity.EffectiveRoleIds ?? new List<string>(), StringComparer.OrdinalIgnoreCase).Any())
                .ToArray();
            if (matches.Length == 0) return null; // 未新增授权时保留原有私有安全目录兜底。
            param.Path = path;
            param.Limit = param.Limit != false || !matches.Any(rule => rule.AllowPublic)
                || param.ContentSecurityRequired == true || path.Split('/')[0].Equals("avatar", StringComparison.OrdinalIgnoreCase);
            return new DosResult(1);
        }

        private static bool Flag(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return false;
            var text = value.ToString().Trim();
            if (text == "1" || text.Equals("true", StringComparison.OrdinalIgnoreCase)) return true;
            if (text == "0" || text.Equals("false", StringComparison.OrdinalIgnoreCase) || text.Length == 0) return false;
            throw new ArgumentException("上传权限开关只能是true/false或1/0。");
        }

        public static DosResult Denied(string message) => new DosResult(0, null, message, 0,
            new { ErrorType = "HdfsUploadDirectoryNotAuthorized", ConfigTable = "sys_config", ConfigField,
                SettingsSection = "文件上传权限", DocumentationUrl = "https://microi.net/doc/more/hdfs" });
    }
}
