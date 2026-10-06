using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>按权威身份计算模块字段权限；多组命中时拒绝优先，隐藏字段始终不可编辑。</summary>
    public sealed class ModuleFieldPermission
    {
        public bool DefaultVisible { get; private set; } = true;
        public bool DefaultEditable { get; private set; } = true;
        private readonly Dictionary<string, (bool visible, bool editable)> fields = new Dictionary<string, (bool, bool)>(StringComparer.OrdinalIgnoreCase);
        public bool Visible(string name) => string.Equals(name, "Id", StringComparison.OrdinalIgnoreCase) || (fields.TryGetValue(name ?? "", out var access) ? access.visible : DefaultVisible);
        public bool Editable(string name) => Visible(name) && (fields.TryGetValue(name ?? "", out var access) ? access.editable : DefaultEditable);
        public bool Restricted => !DefaultVisible || !DefaultEditable || fields.Values.Any(x => !x.visible || !x.editable);
        public static List<string> Ids(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return new List<string>();
            try
            {
                var token = JToken.Parse(value);
                var list = token is JArray array ? array : new JArray(token);
                return list.Select(x => x is JObject row ? (string)(row["Id"] ?? row["id"] ?? row["Value"]) : (string)x).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            }
            catch { return value.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).ToList(); }
        }
        public static ModuleFieldPermission Resolve(string json, FormEngineAuthorizationSnapshot principal)
        {
            var policy = new ModuleFieldPermission();
            if (string.IsNullOrWhiteSpace(json) || json.Trim() == "{}") return policy;
            Validate(json);
            var config = JObject.Parse(json);
            if (config["Enabled"]?.Value<bool>() != true) return policy;
            if (config["Version"]?.Value<int>() != 1) throw new InvalidOperationException("字段权限协议版本不支持。");
            policy.DefaultVisible = config["DefaultVisible"]?.Value<bool>() ?? true;
            policy.DefaultEditable = config["DefaultEditable"]?.Value<bool>() ?? true;
            var rules = config["Rules"] as JArray ?? throw new InvalidOperationException("字段权限规则必须为数组。");
            if (rules.Count > 200) throw new InvalidOperationException("字段权限规则数量超出限制。");
            foreach (JObject rule in rules)
            {
                bool Matches(string key, IEnumerable<string> values) => (rule[key] as JArray ?? new JArray()).Values<string>().Intersect(values ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase).Any();
                var all = rule["Everyone"]?.Value<bool>() == true;
                if (!all && !Matches("Users", new[] { principal.UserId }) && !Matches("Roles", principal.EffectiveRoleIds)
                    && !Matches("Departments", principal.DepartmentIds) && !Matches("Jobs", principal.JobIds)) continue;
                foreach (JObject field in rule["Fields"] as JArray ?? new JArray())
                {
                    var name = (string)field["Name"];
                    if (string.IsNullOrWhiteSpace(name)) throw new InvalidOperationException("字段权限缺少字段名。");
                    var visible = field["Visible"]?.Value<bool>() ?? policy.DefaultVisible;
                    var editable = visible && (field["Editable"]?.Value<bool>() ?? policy.DefaultEditable);
                    if (policy.fields.TryGetValue(name, out var old)) { visible &= old.visible; editable &= old.editable; }
                    policy.fields[name] = (visible, editable);
                }
            }
            return policy;
        }
        public static void Validate(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Trim() == "{}") return;
            if (json.Length > 1024 * 1024) throw new InvalidOperationException("字段权限配置超出大小限制。");
            var config = JObject.Parse(json);
            foreach (var key in new[] { "Enabled", "DefaultVisible", "DefaultEditable" })
                if (config[key] != null && config[key].Type != JTokenType.Boolean) throw new InvalidOperationException("字段权限开关必须为布尔值。");
            if (config["Enabled"]?.Value<bool>() != true) return;
            if (config["Version"]?.Value<int>() != 1 || !(config["Rules"] is JArray rules) || rules.Count > 200) throw new InvalidOperationException("字段权限协议或规则数量无效。");
            foreach (var token in rules)
            {
                if (!(token is JObject rule) || !(rule["Fields"] is JArray entries) || entries.Count > 2000) throw new InvalidOperationException("字段权限规则或字段数量无效。");
                foreach (var key in new[] { "Users", "Roles", "Departments", "Jobs" })
                    if (rule[key] != null && (!(rule[key] is JArray ids) || ids.Count > 2000 || ids.Any(x => x.Type != JTokenType.String || x.Value<string>().Length > 128))) throw new InvalidOperationException("字段权限身份必须为Id数组。");
                if (rule["Everyone"] != null && rule["Everyone"].Type != JTokenType.Boolean) throw new InvalidOperationException("字段权限适用范围无效。");
                foreach (var entry in entries)
                {
                    if (!(entry is JObject field) || field["Name"]?.Type != JTokenType.String || string.IsNullOrWhiteSpace((string)field["Name"]) || ((string)field["Name"]).Length > 128) throw new InvalidOperationException("字段权限字段名无效。");
                    foreach (var key in new[] { "Visible", "Editable" }) if (field[key] != null && field[key].Type != JTokenType.Boolean) throw new InvalidOperationException("字段权限必须为布尔值。");
                }
            }
        }
        public void RestrictAlias(string alias, string original)
        {
            if (!string.IsNullOrWhiteSpace(alias) && !Visible(original)) fields[alias] = (false, false);
        }
        public void Intersect(ModuleFieldPermission other)
        {
            var keys = fields.Keys.Concat(other.fields.Keys).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var combined = keys.ToDictionary(x => x, x => (Visible(x) && other.Visible(x), Editable(x) && other.Editable(x)), StringComparer.OrdinalIgnoreCase);
            DefaultVisible &= other.DefaultVisible; DefaultEditable &= other.DefaultEditable;
            fields.Clear(); foreach (var item in combined) fields[item.Key] = item.Value;
        }
        /// <summary>仅返回当前身份的有效字段能力，不返回权限组或其他身份目录。</summary>
        public JObject ToClientAccess() => new JObject {
            ["Version"] = 1, ["DefaultVisible"] = DefaultVisible, ["DefaultEditable"] = DefaultEditable,
            ["Fields"] = new JObject(fields.Select(item => new JProperty(item.Key,
                new JObject { ["Visible"] = item.Value.visible, ["Editable"] = item.Value.visible && item.Value.editable })))
        };
        public JObject Project(JObject row)
        {
            if (row == null || !Restricted) return row;
            foreach (var property in row.Properties().ToList())
            {
                if (property.Name == "_Child" && property.Value is JArray children)
                { foreach (var child in children.OfType<JObject>()) Project(child); continue; }
                var name = property.Name.Split(new[] { "_TmpEngineResult", "_RealPath" }, StringSplitOptions.None)[0];
                if (!Visible(name)) property.Remove();
            }
            return row;
        }
    }
}
