using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 一次父记录 Client 读取的请求内投影观察器。只比较原管线的前后值，不重新执行
    /// 任意 V8、访问数据库或授予权限；历史端点仍须单独复核当前管理员及精确父记录。
    /// </summary>
    public sealed class FormHistoryReadProjection
    {
        private const int MaxLength = 2 * 1024 * 1024;
        // SaaS 表混存基础设施与展示元数据；只开放显式安全字段，未来新增配置默认不开放历史。
        private static readonly HashSet<string> SafeTenantMetadata = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "ClientName", "OsClient", "OsClientType", "OsClientNetwork", "IsEnable", "ParentId", "Sort", "CreateTime", "UpdateTime", "LicenseProductType", "LicenseExpirationDate" };
        private readonly string tenant, table, row, menu, user;
        private JObject original;
        private List<JObject> fields;
        private HashSet<string> readable = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private int state;
        public bool IsComplete => state == 2;

        public FormHistoryReadProjection(DiyTableRowParam parent)
        {
            tenant = parent.OsClient; table = parent.TableId; row = parent.Id;
            menu = parent._SysMenuId; user = parent._CurrentUser?["Id"].Val<string>();
        }

        private bool Matches(DiyTableRowParam parent) => parent != null
            && parent._InvokeType == InvokeType.Client.ToString() && !parent._TrustedServerInvocation
            && string.Equals(tenant, parent.OsClient, StringComparison.Ordinal)
            && string.Equals(table, parent.TableId, StringComparison.OrdinalIgnoreCase)
            && string.Equals(row, parent._TableRowId.DosIsNullOrWhiteSpace() ? parent.Id : parent._TableRowId, StringComparison.OrdinalIgnoreCase)
            && string.Equals(menu, parent._SysMenuId, StringComparison.OrdinalIgnoreCase)
            && string.Equals(user, parent._CurrentUser?["Id"].Val<string>(), StringComparison.OrdinalIgnoreCase);

        public void Begin(DiyTableRowParam parent, object raw, IEnumerable<JObject> metadata)
        {
            // 同一观察器不能跨读取复用，HTTP/JSON 也不能构造此对象或改变状态。
            if (state != 0 || !Matches(parent)) { state = 3; original = null; readable.Clear(); return; }
            state = 1;
            original = ParseObject(raw);
            if (original == null || !string.Equals((string)original.GetValue("Id", StringComparison.OrdinalIgnoreCase), row, StringComparison.OrdinalIgnoreCase))
            { state = 3; original = null; return; }
            fields = (metadata ?? Enumerable.Empty<JObject>()).Select(x => new JObject
            {
                ["Name"] = x["Name"], ["Label"] = x["Label"], ["Component"] = x["Component"],
                ["Encrypt"] = x["Encrypt"], ["PasswordNameEncrypt"] = x["PasswordNameEncrypt"], ["Config"] = x["Config"]?.DeepClone()
            }).ToList();
        }

        public void Complete(DiyTableRowParam parent, object returned, IEnumerable<string> omittedFields)
        {
            if (state != 1 || !Matches(parent)) { state = 3; original = null; readable.Clear(); return; }
            var projection = ParseObject(returned);
            var omitted = new HashSet<string>(omittedFields ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            if (projection != null)
                foreach (var property in original.Properties())
                {
                    var current = projection.GetValue(property.Name, StringComparison.OrdinalIgnoreCase);
                    // 任意掩码、删除、类型变化或嵌套改写均排除整个字段，不能由旧原文恢复。
                    if (!omitted.Contains(property.Name) && current != null && JToken.DeepEquals(property.Value, current)) readable.Add(property.Name);
                }
            original = null;
            state = 2;
        }

        public JObject ProjectSnapshot(string tableName, JToken stored)
        {
            if (!IsComplete) return null;
            var snapshot = ParseObject(stored);
            if (snapshot == null) return null;
            var storedId = snapshot.GetValue("Id", StringComparison.OrdinalIgnoreCase);
            if (storedId != null && (storedId.Type != JTokenType.String || !string.Equals((string)storedId, row, StringComparison.OrdinalIgnoreCase))) return null;
            var result = new JObject { ["Id"] = row };
            foreach (var field in fields)
            {
                var name = (string)field["Name"];
                if (!CanReadField(tableName, field)) continue;
                var value = snapshot.GetValue(name, StringComparison.OrdinalIgnoreCase);
                if (value != null) result[name] = Redact(value);
            }
            return result.Count > 1 ? result : null;
        }

        public JArray ProjectLog(string tableName, JToken stored)
        {
            if (!IsComplete) return null;
            JArray changes;
            try
            {
                var text = stored?.Type == JTokenType.String ? stored.Value<string>() : stored?.ToString(Formatting.None);
                if (text == null || text.Length > MaxLength) return null;
                changes = JArray.Parse(text);
            }
            catch (JsonException) { return null; }
            var result = new JArray();
            foreach (var change in changes.OfType<JObject>())
            {
                var name = (string)change["Name"];
                var field = fields.FirstOrDefault(x => string.Equals((string)x["Name"], name, StringComparison.OrdinalIgnoreCase));
                if (field == null || !CanReadField(tableName, field)) continue;
                // 标题来自当前可信字段元数据，不返回历史自由文本标题/备注/人员信息。
                result.Add(new JObject { ["Name"] = (string)field["Name"], ["Label"] = (string)field["Label"] ?? name,
                    ["OVal"] = Redact(change["OVal"]), ["NVal"] = Redact(change["NVal"]) });
            }
            return result;
        }

        public JObject ProjectCode(string tableName, JToken stored)
        {
            var snapshot = V8CodeVersionService.ProjectReadableCodeSnapshot(tableName, stored, row);
            if (snapshot == null || !IsComplete) return null;
            foreach (var property in snapshot.Properties().ToList())
                if (property.Name != "Id" && !property.Name.StartsWith("__", StringComparison.Ordinal) && !readable.Contains(property.Name)) property.Remove();
            var codeField = (string)snapshot["__CodeEditorFieldName"];
            if (codeField != null && !readable.Contains(codeField))
                foreach (var property in snapshot.Properties().Where(x => x.Name.StartsWith("__", StringComparison.Ordinal)).ToList()) property.Remove();
            return snapshot.Properties().Any(x => x.Name != "Id" && !x.Name.StartsWith("__", StringComparison.Ordinal)) ? snapshot : null;
        }

        private bool CanReadField(string tableName, JObject field)
        {
            var name = (string)field["Name"];
            if (string.IsNullOrWhiteSpace(name) || name.StartsWith("_", StringComparison.Ordinal) || !readable.Contains(name) || Sensitive(name)) return false;
            if (string.Equals(tableName, "sys_config", StringComparison.OrdinalIgnoreCase) && TenantConfigurationSecurity.IsSensitiveSysConfigField(name)) return false;
            if (string.Equals(tableName, "sys_osclients", StringComparison.OrdinalIgnoreCase) && !SafeTenantMetadata.Contains(name)) return false;
            var component = (string)field["Component"] ?? "";
            if (component.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0) return false;
            if (Enabled(field["Encrypt"]) || Enabled(field["PasswordNameEncrypt"])) return false;
            var config = ParseObject(field["Config"]);
            if (Enabled(config?["TextShowPassword"]) || Enabled(config?["PasswordNameEncrypt"])) return false;
            return true;
        }

        private static bool Sensitive(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            // 仅规范化待判定的字段名/富配置语义 Key；不修改返回的普通名称或业务值。
            var normalized = name.Replace("-", "").Replace("_", "").Replace(" ", "");
            return SensitiveIdentifier(name) || SensitiveIdentifier(normalized);
        }

        private static bool SensitiveIdentifier(string name) => UserBehaviorAudit.IsSensitiveField(name)
            || TenantConfigurationSecurity.IsSensitiveConfigurationField(name)
            || TenantConfigurationSecurity.IsSharedInfrastructureField(name)
            || TenantConfigurationSecurity.IsTenantServiceCredentialField(name)
            || TenantConfigurationSecurity.IsNonShareableTenantCredentialField(name)
            || new[] { "salt", "cipher", "signingkey", "recoverycode", "totp", "mfaseed", "pwdencode", "connection" }
                .Any(part => name.IndexOf(part, StringComparison.OrdinalIgnoreCase) >= 0);

        private static bool Enabled(JToken value) => value != null
            && (string.Equals(value.ToString(), "true", StringComparison.OrdinalIgnoreCase) || value.ToString() == "1");

        private static JToken Redact(JToken value, int depth = 0)
        {
            if (value == null) return JValue.CreateNull();
            if (depth >= 32) return JValue.CreateNull();
            if (value is JObject obj)
            {
                // 富配置常将密钥名放在 Key/Name 中、原文放在 Value/Text 中；不能只过滤属性名。
                var secretEntry = new[] { "Key", "Name", "Field", "FieldName", "Column", "ColumnName" }
                    .Select(key => obj.GetValue(key, StringComparison.OrdinalIgnoreCase))
                    .Any(key => key?.Type == JTokenType.String && Sensitive(key.Value<string>()));
                var component = obj.GetValue("Component", StringComparison.OrdinalIgnoreCase)?.ToString() ?? "";
                if (secretEntry || component.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0
                    || new[] { "Encrypt", "PasswordNameEncrypt", "TextShowPassword" }.Any(key => Enabled(obj.GetValue(key, StringComparison.OrdinalIgnoreCase))))
                    return new JObject { ["Redacted"] = true };
                return new JObject(obj.Properties().Where(p => !Sensitive(p.Name)).Select(p => new JProperty(p.Name, Redact(p.Value, depth + 1))));
            }
            if (value is JArray array) return new JArray(array.Select(item => Redact(item, depth + 1)));
            if (value.Type == JTokenType.String)
            {
                var text = value.Value<string>();
                if (text != null && text.Length <= MaxLength && (text.TrimStart().StartsWith("{") || text.TrimStart().StartsWith("[") || text.TrimStart().StartsWith("\"")))
                {
                    try { return Redact(JToken.Parse(text), depth + 1).ToString(Formatting.None); }
                    catch (JsonException) { /* 普通业务文本保持原类型；格式错误不能当作 JSON 执行。 */ }
                }
            }
            return value.DeepClone();
        }

        private static JObject ParseObject(object value)
        {
            if (value == null) return null;
            try
            {
                var token = value as JToken ?? JToken.FromObject(value);
                var text = token.Type == JTokenType.String ? token.Value<string>() : token.ToString(Formatting.None);
                return text == null || text.Length > MaxLength ? null : JObject.Parse(text);
            }
            catch (JsonException) { return null; }
        }
    }
}
