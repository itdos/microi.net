using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Builds explicit server-provenance parameters for upgrade-time FormEngine
    /// writes. Upgrade code has no HTTP principal and must not depend on runtime
    /// type heuristics to retain its trusted origin.
    /// </summary>
    internal static class UpgradeTrustedFormEngine
    {
        // 物理回退只服务于平台自带迁移中已经确认的历史元数据兼容缺口。字段按表显式
        // 收口，避免新的迁移误把任意 FormEngine 失败降级成绕过表单语义的原生写入。
        private static readonly IReadOnlyDictionary<string, HashSet<string>>
            PhysicalFallbackFieldAllowlist =
            new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["diy_table"] = NewPhysicalFallbackFieldSet(
                    "OsClient", "Tabs", "InFormV8"),
                ["diy_field"] = NewPhysicalFallbackFieldSet(
                    "OsClient", "TableId", "TableName", "Name", "Label", "Description",
                    "Type", "Component", "Sort", "DefaultValue", "Placeholder", "Data",
                    "Config", "FormWidth", "Tab", "Visible", "AppVisible", "Readonly",
                    "NotEmpty", "TableWidth", "NameConfirm", "IsDeleted", "V8Code"),
                ["sys_apiengine"] = NewPhysicalFallbackFieldSet(
                    "OsClient", "ApiName", "ApiEngineKey", "ApiAddress", "IsEnable",
                    "ApiRoutes", "StopHttp", "AllowAnonymous", "EnableLog", "ResponseFile",
                    "Timeout", "MaxStatements", "LimitMemory", "LimitRecursion", "Lock",
                    "Version", "ApiV8Code"),
                ["sys_menu"] = NewPhysicalFallbackFieldSet(
                    "OsClient", "Name", "ModuleEngineKey", "DiyTableId", "DiyTableName",
                    "Url", "ParentId", "Display", "AppDisplay", "MoreBtns"),
                ["mic_ai"] = NewPhysicalFallbackFieldSet(
                    "OsClient", "Name", "AiModel", "Endpoint", "IsEnable", "Remark")
            };

        private static readonly string[] PhysicalFallbackNaturalKeyFields =
        {
            "Name", "TableName", "ApiEngineKey", "ApiAddress", "ModuleEngineKey"
        };

        internal static DiyTableRowParam BuildWriteParam(
            string tableName,
            string osClient,
            object payload)
        {
            var rowModel = JsonHelper.ToJObject(payload) ?? new JObject();
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                rowModel["OsClient"] = osClient;
            }

            return new DiyTableRowParam
            {
                FormEngineKey = tableName,
                Id = rowModel["Id"].Val<string>(),
                OsClient = osClient,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _RowModel = (JObject)rowModel.DeepClone()
            };
        }

        internal static Task<DosResult> AddAsync(
            string tableName,
            string osClient,
            object payload,
            Dos.ORM.DbTrans trans = null)
        {
            return MicroiEngine.FormEngine.AddFormDataAsync(
                tableName,
                BuildWriteParam(tableName, osClient, payload),
                trans);
        }

        internal static async Task<DosResult> UpdateAsync(
            string tableName,
            string osClient,
            object payload)
        {
            var writeParam = BuildWriteParam(tableName, osClient, payload);
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(
                tableName,
                writeParam).ConfigureAwait(false);
            if (result?.Code == 1 || !ShouldUsePhysicalFallback(tableName, result))
            {
                return result;
            }

            return await TryPhysicalMetadataUpdateAsync(
                    tableName,
                    osClient,
                    writeParam?._RowModel,
                    result)
                .ConfigureAwait(false);
        }

        internal static bool ShouldUsePhysicalFallback(string tableName, DosResult result)
        {
            if (!PhysicalFallbackFieldAllowlist.ContainsKey(tableName ?? string.Empty)
                || result == null
                || result.Code == 1)
                return false;
            var message = result.Msg ?? string.Empty;
            if (message.IndexOf("[UptFormData]", StringComparison.OrdinalIgnoreCase) < 0)
                return false;

            var knownNullReference = message.IndexOf(
                "Object reference not set to an instance of an object",
                StringComparison.OrdinalIgnoreCase) >= 0;
            var knownNullSource =
                (message.IndexOf("Value cannot be null", StringComparison.OrdinalIgnoreCase) >= 0
                 && message.IndexOf("Parameter 'source'", StringComparison.OrdinalIgnoreCase) >= 0)
                || message.IndexOf("source cannot be null", StringComparison.OrdinalIgnoreCase) >= 0
                || (message.IndexOf("Enumerable.Where", StringComparison.OrdinalIgnoreCase) >= 0
                    && message.IndexOf("source", StringComparison.OrdinalIgnoreCase) >= 0);
            var knownLegacyTenantColumn = message.IndexOf(
                "Unknown column 'OsClient' in 'field list'",
                StringComparison.OrdinalIgnoreCase) >= 0;
            return knownNullReference || knownNullSource || knownLegacyTenantColumn;
        }

        private static async Task<DosResult> TryPhysicalMetadataUpdateAsync(
            string tableName,
            string osClient,
            JObject rowModel,
            DosResult formEngineFailure)
        {
            var stage = "初始化";
            try
            {
                stage = "校验表与租户上下文";
                if (!PhysicalFallbackFieldAllowlist.ContainsKey(tableName ?? string.Empty))
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        "目标表不在平台物理兼容白名单内。");
                var client = OsClientExtend.GetClient(osClient);
                var id = rowModel?["Id"]?.ToString();
                if (client?.Db == null)
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        "目标租户数据库会话不存在。");
                if (id.DosIsNullOrWhiteSpace())
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        "可信升级负载缺少 Id。");
                if (!client.Db.TableExists(tableName))
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        $"物理表 {tableName} 不存在。");
                if (!client.Db.ColumnExists(tableName, "Id"))
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        $"物理表 {tableName} 缺少 Id 列。");

                var databaseType = client.Db.Db.DbProvider.DatabaseType;
                var orm = MicroiEngine.ORM(databaseType);
                var oracleTableSpace = client.OsClientModel?["DbOracleTableSpace"]?.Val<string>();
                var physicalTableName = ResolvePhysicalFallbackIdentifier(
                    orm,
                    tableName,
                    true,
                    oracleTableSpace);
                var idFieldName = ResolvePhysicalFallbackIdentifier(orm, "Id", false, null);
                var hasOsClient = client.Db.ColumnExists(tableName, "OsClient");
                var osClientFieldName = hasOsClient
                    ? ResolvePhysicalFallbackIdentifier(orm, "OsClient", false, null)
                    : null;

                stage = "筛选物理字段";
                var physicalColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Id" };
                foreach (var property in rowModel.Properties())
                {
                    if (PhysicalFallbackFieldAllowlist[tableName].Contains(property.Name)
                        && IsSafeIdentifier(property.Name)
                        && client.Db.ColumnExists(tableName, property.Name))
                    {
                        physicalColumns.Add(property.Name);
                    }
                }

                var patch = IntersectPhysicalFallbackFields(tableName, rowModel, physicalColumns);
                var fields = patch.Properties().ToArray();
                if (!fields.Any(field => !IsPhysicalFallbackControlField(field.Name)))
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        "可信负载没有可更新的业务字段。Id、OsClient 与下划线控制字段不能单独构成成功写入。");

                stage = "回读并校验旧行归属";
                var oldRow = ReadPhysicalFallbackRow(
                    client.Db,
                    physicalTableName,
                    idFieldName,
                    osClientFieldName,
                    hasOsClient,
                    id,
                    osClient,
                    out var oldRowError);
                if (oldRow == null)
                    return BuildPhysicalFallbackFailure(formEngineFailure, stage, oldRowError);

                stage = "确认升级租约并执行参数化更新";
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                var whereIdParameterIndex = fields.Length;
                var whereOsClientParameterIndex = fields.Length + 1;
                var section = client.Db.FromSql(
                    $"UPDATE {physicalTableName} SET "
                    + string.Join(",", fields.Select((field, index) =>
                        ResolvePhysicalFallbackIdentifier(orm, field.Name, false, null)
                        + "=@p" + index))
                    + $" WHERE {idFieldName}=@p{whereIdParameterIndex}"
                    + BuildPhysicalFallbackTenantPredicate(
                        osClientFieldName,
                        hasOsClient,
                        whereOsClientParameterIndex));
                for (var index = 0; index < fields.Length; index++)
                {
                    section.AddInParameter(
                        "p" + index,
                        ToDatabaseValue(databaseType, fields[index].Value));
                }
                section.AddInParameter("p" + whereIdParameterIndex, id);
                if (hasOsClient)
                    section.AddInParameter("p" + whereOsClientParameterIndex, osClient);
                var affected = section.ExecuteNonQuery();
                if (affected != 1)
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        $"参数化 UPDATE 影响行数为 {affected}，要求严格等于 1。");
                UpgradeExecutionLeaseContext.ConfirmOwnership();

                stage = "逐字段回读验证";
                var updatedRow = ReadPhysicalFallbackRow(
                    client.Db,
                    physicalTableName,
                    idFieldName,
                    osClientFieldName,
                    hasOsClient,
                    id,
                    osClient,
                    out var updatedRowError);
                if (updatedRow == null)
                    return BuildPhysicalFallbackFailure(formEngineFailure, stage, updatedRowError);
                var mismatchedFields = FindPhysicalFallbackReadbackMismatches(fields, updatedRow);
                if (mismatchedFields.Length > 0)
                    return BuildPhysicalFallbackFailure(
                        formEngineFailure,
                        stage,
                        "以下字段写入后回读不一致：" + string.Join(",", mismatchedFields));

                stage = "清除旧键与新键缓存";
                await InvalidatePhysicalFallbackCachesAsync(
                        tableName,
                        osClient,
                        id,
                        oldRow,
                        patch)
                    .ConfigureAwait(false);
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                Console.WriteLine(
                    $"Microi：【兼容修复】平台升级[{osClient}]在 FormEngine 元数据写入异常后，"
                    + $"已通过受限参数化物理路径更新 {tableName}.{id}；"
                    + $"原始错误={SanitizePhysicalFallbackDiagnosticText(formEngineFailure.Msg)}");
                return new DosResult(1, new
                {
                    PhysicalCompatibilityFallback = true,
                    TableName = tableName,
                    Id = id,
                    UpdatedFields = fields.Select(field => field.Name).ToArray()
                }, "升级元数据已通过受限物理兼容路径更新并清除缓存。");
            }
            catch (Exception fallbackException)
            {
                var rootException = fallbackException.GetBaseException();
                return BuildPhysicalFallbackFailure(
                    formEngineFailure,
                    stage,
                    "异常类型=" + rootException.GetType().Name
                    + "；" + rootException.Message);
            }
        }

        internal static JObject IntersectPhysicalFallbackFields(
            string tableName,
            JObject rowModel,
            ISet<string> physicalColumns)
        {
            var patch = new JObject();
            if (rowModel == null
                || physicalColumns == null
                || !PhysicalFallbackFieldAllowlist.TryGetValue(tableName ?? string.Empty, out var allowedFields))
                return patch;
            foreach (var property in rowModel.Properties())
            {
                if (string.Equals(property.Name, "Id", StringComparison.OrdinalIgnoreCase)
                    || property.Name.StartsWith("_", StringComparison.Ordinal))
                {
                    continue;
                }

                // OsClient comes from BuildWriteParam rather than the migration payload. Very old
                // metadata tables can legitimately have no tenant column; in that one compatibility
                // case the Id-bound row is still safe to update. If the column exists, write the
                // server-proven tenant so a historical null/empty row is adopted atomically.
                if (string.Equals(property.Name, "OsClient", StringComparison.OrdinalIgnoreCase)
                    && !physicalColumns.Contains(property.Name))
                {
                    continue;
                }

                if (!IsSafeIdentifier(property.Name))
                    throw new InvalidOperationException(
                        $"平台升级物理兼容负载包含不安全字段名：{property.Name}。");
                if (!allowedFields.Contains(property.Name))
                    throw new InvalidOperationException(
                        $"平台升级物理兼容负载包含 {tableName} 白名单外字段：{property.Name}。");
                if (!physicalColumns.Contains(property.Name))
                    throw new InvalidOperationException(
                        $"平台升级物理兼容负载期望字段 {tableName}.{property.Name}，但目标物理列不存在。");
                patch[property.Name] = property.Value?.DeepClone() ?? JValue.CreateNull();
            }
            return patch;
        }

        private static bool IsPhysicalFallbackControlField(string fieldName)
        {
            return string.Equals(fieldName, "Id", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(fieldName, "OsClient", StringComparison.OrdinalIgnoreCase)
                   || (fieldName?.StartsWith("_", StringComparison.Ordinal) ?? false);
        }

        private static async Task InvalidatePhysicalFallbackCachesAsync(
            string tableName,
            string osClient,
            string id,
            JObject oldRow,
            JObject patch)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient)
                        ?? throw new InvalidOperationException("目标租户缓存实例不存在。");
            foreach (var key in BuildPhysicalFallbackCacheKeys(
                         tableName,
                         osClient,
                         id,
                         oldRow,
                         patch))
                await cache.RemoveAsync(key).ConfigureAwait(false);
        }

        internal static IReadOnlyCollection<string> BuildPhysicalFallbackCacheKeys(
            string tableName,
            string osClient,
            string id,
            JObject oldRow,
            JObject patch)
        {
            var keys = new HashSet<string>(StringComparer.Ordinal);
            var normalizedTableName = NormalizePhysicalFallbackCachePart(tableName);
            AddPhysicalFallbackCacheKey(keys, osClient, normalizedTableName, id);
            foreach (var naturalKey in PhysicalFallbackNaturalKeyFields)
            {
                AddPhysicalFallbackCacheKey(
                    keys,
                    osClient,
                    normalizedTableName,
                    ReadCaseInsensitiveToken(oldRow, naturalKey)?.ToString());
                AddPhysicalFallbackCacheKey(
                    keys,
                    osClient,
                    normalizedTableName,
                    ReadCaseInsensitiveToken(patch, naturalKey)?.ToString());
            }

            if (string.Equals(tableName, "diy_field", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var source in new[] { oldRow, patch })
                {
                    AddPhysicalFallbackCacheKey(
                        keys,
                        osClient,
                        "diy_table_field_list",
                        ReadCaseInsensitiveToken(source, "TableId")?.ToString());
                    AddPhysicalFallbackCacheKey(
                        keys,
                        osClient,
                        "diy_table_field_list",
                        ReadCaseInsensitiveToken(source, "TableName")?.ToString());
                }
            }
            else if (string.Equals(tableName, "sys_apiengine", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var source in new[] { oldRow, patch })
                foreach (var route in ApiEngineRouteAliases.Parse(
                             ReadCaseInsensitiveToken(source, "ApiRoutes")?.ToString()))
                {
                    AddPhysicalFallbackCacheKey(
                        keys,
                        osClient,
                        normalizedTableName,
                        route);
                }
            }
            return keys.ToArray();
        }

        internal static string ResolvePhysicalFallbackIdentifier(
            IMicroiORM orm,
            string identifier,
            bool isTable,
            string tableSpace)
        {
            if (orm == null) throw new ArgumentNullException(nameof(orm));
            if (!IsSafeIdentifier(identifier))
                throw new InvalidOperationException("平台升级物理兼容路径收到不安全的标识符。");
            if (isTable
                && !tableSpace.DosIsNullOrWhiteSpace()
                && !IsSafeIdentifier(tableSpace))
                throw new InvalidOperationException("平台升级物理兼容路径收到不安全的 Oracle 表空间标识符。");
            return isTable
                ? orm.GetTableName(identifier, tableSpace)
                : orm.GetFieldName(identifier);
        }

        private static bool IsSafeIdentifier(string value)
        {
            if (value.DosIsNullOrWhiteSpace() || value.Length > 128) return false;
            if (!char.IsLetter(value[0]) && value[0] != '_') return false;
            return value.All(character => char.IsLetterOrDigit(character) || character == '_');
        }

        internal static object ToDatabaseValue(DatabaseType databaseType, JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return DBNull.Value;
            return token.Type switch
            {
                JTokenType.Integer => ReadPhysicalFallbackInteger(token.Value<long>()),
                JTokenType.Float => token.Value<decimal>(),
                JTokenType.Boolean => token.Value<bool>() ? 1 : 0,
                JTokenType.Date => ReadPhysicalFallbackDateTime(databaseType, token.Value<DateTime>()),
                JTokenType.Bytes => token.Value<byte[]>(),
                JTokenType.Array or JTokenType.Object => token.ToString(Formatting.None),
                _ => token.ToString()
            };
        }

        internal static string SanitizePhysicalFallbackDiagnosticText(string value)
        {
            var text = (value ?? string.Empty).Replace("\r", " ").Replace("\n", " ").Trim();
            text = System.Text.RegularExpressions.Regex.Replace(
                text,
                @"(?i)([""']?)(password|pwd|secret|token|api[_-]?key|access[_-]?key|connectionstring)\1\s*[:=]\s*([""']?)[^;,\s""']+\3",
                "$1$2$1=***");
            text = System.Text.RegularExpressions.Regex.Replace(
                text,
                @"(?i)(authorization\s*[:=]\s*(?:(?:bearer|basic)\s+)?)[A-Za-z0-9._~+/-]{8,}",
                "$1***");
            text = System.Text.RegularExpressions.Regex.Replace(
                text,
                @"(?i)(://[^:/\s]+:)[^@/\s]+(@)",
                "$1***$2");
            if (text.Length > 1000) text = text.Substring(0, 1000) + "...";
            return text.DosIsNullOrWhiteSpace() ? "未知错误" : text;
        }

        private static HashSet<string> NewPhysicalFallbackFieldSet(params string[] fields)
        {
            return new HashSet<string>(fields ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
        }

        private static string BuildPhysicalFallbackTenantPredicate(
            string osClientFieldName,
            bool hasOsClient,
            int parameterIndex)
        {
            if (!hasOsClient) return string.Empty;
            return $" AND ({osClientFieldName}=@p{parameterIndex}"
                   + $" OR {osClientFieldName} IS NULL OR {osClientFieldName}='')";
        }

        private static JObject ReadPhysicalFallbackRow(
            DbSession database,
            string physicalTableName,
            string idFieldName,
            string osClientFieldName,
            bool hasOsClient,
            string id,
            string osClient,
            out string error)
        {
            error = null;
            var section = database.FromSql(
                    $"SELECT * FROM {physicalTableName} WHERE {idFieldName}=@p0"
                    + BuildPhysicalFallbackTenantPredicate(osClientFieldName, hasOsClient, 1))
                .AddInParameter("p0", id);
            if (hasOsClient) section.AddInParameter("p1", osClient);
            var rows = section.ToArray() ?? Array.Empty<dynamic>();
            if (rows.Length != 1)
            {
                error = $"按 Id 与租户边界回读到 {rows.Length} 行，要求严格等于 1。";
                return null;
            }
            var row = JsonHelper.ToJObject((object)rows[0]);
            if (row != null) return row;
            error = "目标物理行无法转换为 JObject。";
            return null;
        }

        private static string[] FindPhysicalFallbackReadbackMismatches(
            IEnumerable<JProperty> fields,
            JObject updatedRow)
        {
            return fields
                .Where(field => !PhysicalFallbackValuesEqual(
                    field.Value,
                    ReadCaseInsensitiveToken(updatedRow, field.Name)))
                .Select(field => field.Name)
                .ToArray();
        }

        private static bool PhysicalFallbackValuesEqual(JToken expected, JToken actual)
        {
            return string.Equals(
                NormalizePhysicalFallbackReadbackValue(expected),
                NormalizePhysicalFallbackReadbackValue(actual),
                StringComparison.Ordinal);
        }

        private static string NormalizePhysicalFallbackReadbackValue(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return "<null>";
            switch (token.Type)
            {
                case JTokenType.Integer:
                case JTokenType.Float:
                    return decimal.TryParse(
                        token.ToString(),
                        NumberStyles.Any,
                        CultureInfo.InvariantCulture,
                        out var number)
                        ? "n:" + number.ToString("G29", CultureInfo.InvariantCulture)
                        : "s:" + token;
                case JTokenType.Boolean:
                    return token.Value<bool>() ? "n:1" : "n:0";
                case JTokenType.Date:
                    return "d:" + token.Value<DateTime>().ToUniversalTime().Ticks;
                case JTokenType.Bytes:
                    return "b:" + Convert.ToBase64String(token.Value<byte[]>() ?? Array.Empty<byte>());
                case JTokenType.Array:
                case JTokenType.Object:
                    return "j:" + token.ToString(Formatting.None);
                default:
                    return "s:" + token;
            }
        }

        private static JToken ReadCaseInsensitiveToken(JObject source, string name)
        {
            return source?.GetValue(name, StringComparison.OrdinalIgnoreCase);
        }

        private static void AddPhysicalFallbackCacheKey(
            ISet<string> keys,
            string osClient,
            string prefix,
            string value)
        {
            var normalizedPrefix = NormalizePhysicalFallbackCachePart(prefix);
            var normalizedValue = NormalizePhysicalFallbackCachePart(value);
            if (normalizedPrefix.DosIsNullOrWhiteSpace() || normalizedValue.DosIsNullOrWhiteSpace())
                return;
            keys.Add($"Microi:{osClient}:FormData:{normalizedPrefix}:{normalizedValue}");
        }

        private static string NormalizePhysicalFallbackCachePart(string value)
        {
            return (value ?? string.Empty).Trim().ToLowerInvariant();
        }

        private static object ReadPhysicalFallbackInteger(long value)
        {
            return value >= int.MinValue && value <= int.MaxValue
                ? (object)(int)value
                : value;
        }

        private static DateTime ReadPhysicalFallbackDateTime(
            DatabaseType databaseType,
            DateTime value)
        {
            if (databaseType != DatabaseType.PostgreSql) return value;
            if (value.Kind == DateTimeKind.Utc) return value;
            return value.Kind == DateTimeKind.Local
                ? value.ToUniversalTime()
                : DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
        }

        private static DosResult BuildPhysicalFallbackFailure(
            DosResult formEngineFailure,
            string stage,
            string reason)
        {
            return new DosResult(
                0,
                null,
                "FormEngine元数据更新失败；受限物理兼容阶段="
                + SanitizePhysicalFallbackDiagnosticText(stage)
                + "；原因="
                + SanitizePhysicalFallbackDiagnosticText(reason)
                + "；原始错误="
                + SanitizePhysicalFallbackDiagnosticText(
                    formEngineFailure?.Msg ?? "FormEngine未返回错误详情"));
        }

        internal static Task<DosResult> AddTableAsync(
            string osClient,
            string tableName,
            string description,
            bool onlyCreatePhysicalTable = false)
        {
            return MicroiEngine.FormEngine.AddTableAsync(new DiyTableParam
            {
                OsClient = osClient,
                Name = tableName,
                Description = description ?? "",
                DataBaseId = "",
                DataBaseName = "",
                _OnlyCreateTable = onlyCreatePhysicalTable,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true
            });
        }

        internal static Task<DosResult> AddFieldAsync(
            string osClient,
            DiyFieldParam param)
        {
            param.OsClient = osClient;
            param._InvokeType = InvokeType.Server.ToString();
            param._TrustedServerInvocation = true;
            return MicroiEngine.FormEngine.AddFieldAsync(param);
        }

        internal static Task<DosResult> AddDbFieldAsync(
            string osClient,
            DiyFieldParam param)
        {
            param.OsClient = osClient;
            param._InvokeType = InvokeType.Server.ToString();
            param._TrustedServerInvocation = true;
            return MicroiEngine.FormEngine.AddDbField(param);
        }
    }

    /// <summary>
    /// 平台升级专用的 Redis 分布式租约。
    /// 获取、续租和释放均由 Lua 原子校验 owner；owner 携带单调递增 fencing token。
    /// </summary>
    internal sealed class UpgradeDistributedLease : IDisposable
    {
        internal const int LeaseMilliseconds = 120000;
        internal const int RenewIntervalMilliseconds = 30000;
        internal const int RenewRetryIntervalMilliseconds = 5000;
        internal const int ExpirySafetyMarginMilliseconds = 15000;
        private readonly IDatabase _database;
        private readonly string _lockKey;
        private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
        private readonly Task _renewTask;
        private long _lastSuccessfulExtensionTimestamp;
        private int _consecutiveTransientRenewalFailures;
        private int _lost;

        private const string RenewScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";

        private UpgradeDistributedLease(
            IDatabase database,
            string lockKey,
            string owner,
            long fencingToken)
        {
            _database = database;
            _lockKey = lockKey;
            Owner = owner;
            FencingToken = fencingToken;
            _lastSuccessfulExtensionTimestamp = Stopwatch.GetTimestamp();
            // 应用包导入会触发大量数据库与缓存工作，生产节点的普通 ThreadPool
            // 可能短时饱和。续租若也排在同一队列中，就会出现业务仍在执行但租约
            // 因调度饥饿过期的假丢失。使用专用后台线程承载单租户续租循环。
            _renewTask = Task.Factory.StartNew(
                    RenewLoopAsync,
                    CancellationToken.None,
                    TaskCreationOptions.LongRunning,
                    TaskScheduler.Default)
                .Unwrap();
        }

        public string Owner { get; }

        public long FencingToken { get; }

        public static UpgradeDistributedLease TryAcquire(string osClient, out string reason)
        {
            reason = null;
            if (osClient.DosIsNullOrWhiteSpace())
            {
                reason = "租户标识为空。";
                return null;
            }

            IDatabase database;
            try
            {
                database = MicroiEngine.CacheTenant.Default().GetIDatabase();
            }
            catch (Exception ex)
            {
                reason = "Redis 不可用：" + ex.Message;
                return null;
            }

            if (database == null)
            {
                reason = "Redis 不可用。";
                return null;
            }

            var keyPrefix = "Microi:{" + NormalizeKeySegment(osClient) + "}:ServerUpgrade";
            var lockKey = keyPrefix + ":Lease";
            var fenceKey = keyPrefix + ":FencingToken";
            var nodeId = Environment.MachineName + "-" + Process.GetCurrentProcess().Id;
            var instanceToken = NormalizeKeySegment(nodeId) + ":" + Guid.NewGuid().ToString("N");

            const string acquireScript = @"
if redis.call('exists', KEYS[1]) == 0 then
  local fence = redis.call('incr', KEYS[2])
  local owner = tostring(fence) .. ':' .. ARGV[1]
  redis.call('psetex', KEYS[1], ARGV[2], owner)
  return owner
end
return ''";

            try
            {
                var result = database.ScriptEvaluate(
                    acquireScript,
                    new RedisKey[] { lockKey, fenceKey },
                    new RedisValue[] { instanceToken, LeaseMilliseconds });
                var owner = result.ToString();
                if (owner.DosIsNullOrWhiteSpace())
                {
                    reason = "另一节点正在执行该租户升级。";
                    return null;
                }

                var separatorIndex = owner.IndexOf(':');
                if (separatorIndex <= 0
                    || !long.TryParse(owner.Substring(0, separatorIndex), out var fencingToken))
                {
                    reason = "升级租约返回了无效的 fencing token。";
                    return null;
                }

                return new UpgradeDistributedLease(database, lockKey, owner, fencingToken);
            }
            catch (Exception ex)
            {
                reason = "获取升级租约失败：" + ex.Message;
                return null;
            }
        }

        public void ThrowIfLost()
        {
            if (Volatile.Read(ref _lost) == 0 && HasOwnershipSafetyWindow())
            {
                return;
            }

            Interlocked.Exchange(ref _lost, 1);
            throw new InvalidOperationException("平台升级分布式租约已丢失，已停止继续迁移和推进版本号。");
        }

        /// <summary>
        /// 在推进持久版本号或跨越迁移边界前强制向 Redis 确认 owner，
        /// 并在确认成功时原子续租。普通迁移热路径只读取本地租约状态，
        /// 避免每条数据都向 Redis 发起 StringGet 导致连接风暴。
        /// </summary>
        public void ConfirmOwnership()
        {
            ThrowIfLost();
            Exception lastException = null;
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    var renewed = (long)_database.ScriptEvaluate(
                        RenewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { Owner, LeaseMilliseconds });
                    if (renewed == 1)
                    {
                        MarkExtensionSucceeded();
                        return;
                    }

                    MarkLost();
                    ThrowIfLost();
                }
                catch (InvalidOperationException) when (Volatile.Read(ref _lost) != 0)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    if (attempt < 3 && HasOwnershipSafetyWindow())
                    {
                        Thread.Sleep(250 * attempt);
                        continue;
                    }
                    break;
                }
            }

            MarkLost();
            throw new InvalidOperationException(
                "平台升级无法向 Redis 确认分布式租约所有权，已停止推进版本号。",
                lastException);
        }

        private async Task RenewLoopAsync()
        {
            var delayMilliseconds = RenewIntervalMilliseconds;
            while (!_renewCancellation.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(
                        delayMilliseconds,
                        _renewCancellation.Token).ConfigureAwait(false);
                    var renewed = (long)await _database.ScriptEvaluateAsync(
                        RenewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { Owner, LeaseMilliseconds }).ConfigureAwait(false);
                    if (renewed != 1)
                    {
                        MarkLost();
                        return;
                    }

                    MarkExtensionSucceeded();
                    delayMilliseconds = RenewIntervalMilliseconds;
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (Exception ex)
                {
                    var failures = Interlocked.Increment(ref _consecutiveTransientRenewalFailures);
                    if (!HasOwnershipSafetyWindow())
                    {
                        MarkLost();
                        return;
                    }

                    if (failures == 1 || failures % 6 == 0)
                    {
                        Console.WriteLine(
                            $"Microi：【警告】平台升级分布式租约续租暂时失败，第{failures}次，将在"
                            + $"{RenewRetryIntervalMilliseconds / 1000}秒后重试：{ex.Message}");
                    }
                    delayMilliseconds = RenewRetryIntervalMilliseconds;
                }
            }
        }

        private void MarkExtensionSucceeded()
        {
            Interlocked.Exchange(ref _lastSuccessfulExtensionTimestamp, Stopwatch.GetTimestamp());
            Interlocked.Exchange(ref _consecutiveTransientRenewalFailures, 0);
        }

        private void MarkLost()
        {
            Interlocked.Exchange(ref _lost, 1);
        }

        private bool HasOwnershipSafetyWindow()
        {
            var start = Interlocked.Read(ref _lastSuccessfulExtensionTimestamp);
            var elapsedTicks = Math.Max(0L, Stopwatch.GetTimestamp() - start);
            var elapsedMilliseconds = elapsedTicks * 1000d / Stopwatch.Frequency;
            return IsWithinOwnershipSafetyWindow(elapsedMilliseconds);
        }

        internal static bool IsWithinOwnershipSafetyWindow(double elapsedMilliseconds)
        {
            return elapsedMilliseconds
                   < LeaseMilliseconds - ExpirySafetyMarginMilliseconds;
        }

        public void Dispose()
        {
            _renewCancellation.Cancel();
            try
            {
                _renewTask.Wait(TimeSpan.FromSeconds(3));
            }
            catch
            {
            }

            const string releaseScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";

            try
            {
                _database.ScriptEvaluate(
                    releaseScript,
                    new RedisKey[] { _lockKey },
                    new RedisValue[] { Owner });
            }
            catch
            {
            }
            _renewCancellation.Dispose();
        }

        private static string NormalizeKeySegment(string value)
        {
            if (value.DosIsNullOrWhiteSpace())
            {
                return "unknown";
            }

            var chars = value.Trim().ToCharArray();
            for (var index = 0; index < chars.Length; index++)
            {
                var current = chars[index];
                if (!char.IsLetterOrDigit(current)
                    && current != '-'
                    && current != '_'
                    && current != '.')
                {
                    chars[index] = '_';
                }
            }
            return new string(chars);
        }
    }

    /// <summary>
    /// 让既有 IMicroiUpgrade 接口无需扩参即可在异步迁移链中检查当前租约。
    /// </summary>
    internal static class UpgradeExecutionLeaseContext
    {
        private static readonly AsyncLocal<UpgradeDistributedLease> CurrentLease =
            new AsyncLocal<UpgradeDistributedLease>();

        public static IDisposable Enter(UpgradeDistributedLease lease)
        {
            var previous = CurrentLease.Value;
            CurrentLease.Value = lease;
            return new Scope(() => CurrentLease.Value = previous);
        }

        public static void ThrowIfLost()
        {
            CurrentLease.Value?.ThrowIfLost();
        }

        public static void ConfirmOwnership()
        {
            CurrentLease.Value?.ConfirmOwnership();
        }

        private sealed class Scope : IDisposable
        {
            private readonly Action _dispose;
            private int _disposed;

            public Scope(Action dispose)
            {
                _dispose = dispose;
            }

            public void Dispose()
            {
                if (Interlocked.Exchange(ref _disposed, 1) == 0)
                {
                    _dispose();
                }
            }
        }
    }
}
