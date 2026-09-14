using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>附件角色权限的可信判定与无损合并。调用方必须提供主库中的角色及旧附件，不能使用请求里的授权标记。</summary>
    public sealed class FileRolePermission
    {
        public const string EnabledKey = "EnableRolePermission";
        private readonly Dictionary<string, JObject> roles;
        private readonly HashSet<string> ownRoles;
        private readonly bool administrator;
        private readonly bool authenticated;

        public FileRolePermission(IEnumerable<JObject> authoritativeRoles, IEnumerable<string> authoritativeOwnRoleIds,
            bool isAdministrator = false, bool isAuthenticated = true)
        {
            roles = (authoritativeRoles ?? Enumerable.Empty<JObject>())
                .Where(r => !string.IsNullOrWhiteSpace((string)r["Id"]) && r["IsDeleted"].Val<int>() != 1)
                .ToDictionary(r => (string)r["Id"], StringComparer.OrdinalIgnoreCase);
            ownRoles = new HashSet<string>((authoritativeOwnRoleIds ?? Enumerable.Empty<string>()).Where(roles.ContainsKey), StringComparer.OrdinalIgnoreCase);
            administrator = isAdministrator;
            authenticated = isAuthenticated;
        }

        /// <summary>从当前租户主库重新建立身份，角色撤销/调级不能依赖旧 Token 中的 Level 或角色名称。</summary>
        public static FileRolePermission Load(string osClient, JObject currentUser)
        {
            if (currentUser == null) return new FileRolePermission(null, null, false, false);
            var db = OsClientExtend.GetClient(osClient).Db;
            var id = (string)currentUser["Id"];
            var user = db.From<SysUser>().Where(u => u.Id == id && u.State == 1 && u.IsDeleted != 1).First();
            if (user == null) return new FileRolePermission(null, null, false, false);
            var allRoles = db.From<SysRole>().Where(r => r.IsDeleted != 1).ToList().Select(JObject.FromObject).ToList();
            var ids = ReadIdentityRoleIds(JObject.FromObject(user)["RoleIds"]);
            var admin = allRoles.Any(r => ids.Contains((string)r["Id"], StringComparer.OrdinalIgnoreCase)
                && r["Level"].Val<int>() >= DiyCommon.MaxRoleLevel);
            // 与现有管理员兼容语义一致：无角色的初始 admin 仍需主库帐号和等级双重确认。
            admin |= ids.Count == 0 && string.Equals(user.Account, "admin", StringComparison.OrdinalIgnoreCase)
                && user.Level >= DiyCommon.MaxRoleLevel;
            return new FileRolePermission(allRoles, ids, admin);
        }

        public static JObject Config(JObject field)
        {
            if (!string.Equals((string)field?["Component"], "FileUpload", StringComparison.OrdinalIgnoreCase)) return null;
            var config = ParseJson(field["Config"]) as JObject;
            return config?.GetValue("FileUpload", StringComparison.OrdinalIgnoreCase) as JObject;
        }

        public static bool Enabled(JObject field) => Flag(Config(field), EnabledKey);

        /// <summary>复用角色目录动作提供附件选项，必须先通过目标表单的新增/编辑授权，仅返回 Id/Name/Level。</summary>
        public static async Task<DosResult> RoleOptionsAsync(DiyUploadParam param)
        {
            if (param._CurrentUser == null || string.IsNullOrWhiteSpace(param.FormEngineKey) || string.IsNullOrWhiteSpace(param.FieldId))
                return new DosResult(0, null, "附件角色目录需要有效的表单字段上下文。");
            var context = new DiyTableRowParam { FormEngineKey = param.FormEngineKey, Id = param.FormDataId,
                _SysMenuId = param.SysMenuId, OsClient = param.OsClient, _CurrentUser = param._CurrentUser,
                _TableChildAuth = param._TableChildAuth, _InvokeType = "Client" };
            var result = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(context,
                string.IsNullOrWhiteSpace(param.FormDataId) ? "Add" : "Edit");
            if (result.Code != 1) return result;
            var table = await MicroiEngine.FormEngine.GetDiyTable(param.FormEngineKey, param.OsClient);
            if (table.Code != 1) return new DosResult(0, null, "附件所属表单不存在。");
            var field = await MicroiEngine.FormEngine.GetDiyFieldModel(new DiyFieldParam { OsClient = param.OsClient, Id = param.FieldId, IsDeleted = 0 });
            if (field.Code != 1 || !Enabled(field.Data) || (string)field.Data["TableId"] != (string)table.Data.Id)
                return new DosResult(0, null, "字段未启用附件角色权限或不属于该表单。");
            var policy = Load(param.OsClient, param._CurrentUser);
            return new DosResult(1, policy.roles.Values.OrderByDescending(r => r["Level"].Val<int>())
                .Select(r => new { Id = (string)r["Id"], Name = (string)r["Name"], Level = r["Level"].Val<int>() }).ToList());
        }
        public static bool Flag(JObject config, string key) => config?.GetValue(key, StringComparison.OrdinalIgnoreCase)?.Type == JTokenType.Boolean
            && config.GetValue(key, StringComparison.OrdinalIgnoreCase).Value<bool>();

        public bool CanAccess(JObject file, JObject config)
        {
            var ids = ReadIds(file?["VisibleRoleIds"]);
            if (ids.Count == 0) return true;
            if (!authenticated) return false;
            if (administrator || ids.Any(ownRoles.Contains)) return true;
            if (Flag(config, "DisableRoleInheritance")) return false;
            // 只有真实持有角色的 Level 严格更高才继承；同级不同角色不互通，已删除角色不成为低等级入口。
            var ownLevel = ownRoles.Select(id => roles[id]["Level"].Val<int>()).DefaultIfEmpty(int.MinValue).Max();
            return ids.Any(id => roles.TryGetValue(id, out var role) && ownLevel > role["Level"].Val<int>());
        }

        public JToken Project(JToken value, JObject config)
        {
            var files = Files(value);
            if (files.Count == 0) return value?.DeepClone();
            // 即使 UI 隐藏无权限行，接口仍保留不含路径的占位，旧客户端保存也不会丢附件。
            return Pack(value, files.Select(file => ProjectFile(file, config)).ToList());
        }

        private JObject ProjectFile(JObject file, JObject config)
        {
            var allowed = CanAccess(file, config);
            var result = allowed ? (JObject)file.DeepClone() : new JObject { ["Id"] = file["Id"]?.DeepClone() };
            if (!allowed && Flag(config, "ShowUnauthorizedFileName")) result["Name"] = file["Name"]?.DeepClone();
            result["VisibleRoleIds"] = new JArray(ReadIds(file["VisibleRoleIds"]));
            result["VisibleRoleNames"] = new JArray(ReadIds(file["VisibleRoleIds"]).Select(id => roles.TryGetValue(id, out var role) ? (string)role["Name"] : "已删除角色"));
            result["_FileAccess"] = new JObject { ["CanRead"] = allowed, ["CanEdit"] = allowed };
            return result;
        }

        /// <summary>合并编辑字段：省略的无权限文件原样保留，伪造元数据拒绝；允许的删除只作用于有权限附件。</summary>
        public JToken Merge(JToken oldValue, JToken submittedValue, JObject config)
        {
            var oldFiles = Files(oldValue);
            var submitted = Files(submittedValue);
            EnsureUniqueIds(oldFiles);
            EnsureUniqueIds(submitted);
            var originals = oldFiles.ToDictionary(f => (string)f["Id"], StringComparer.OrdinalIgnoreCase);
            var merged = new List<JObject>();
            foreach (var file in submitted)
            {
                var id = (string)file["Id"];
                if (originals.TryGetValue(id, out var original) && !CanAccess(original, config))
                {
                    var expected = ProjectFile(original, config);
                    // 授权标记不参与授权；这里只允许完整回传后端脱敏占位，不能冒充新文件覆盖旧路径/角色。
                    if (!JToken.DeepEquals(Canonical(file), Canonical(expected)))
                        throw new InvalidOperationException("无权修改附件的名称、路径或可见角色。");
                    merged.Add((JObject)original.DeepClone());
                    continue;
                }
                if (file["_FileAccess"] is JObject access && access["CanRead"]?.Value<bool>() == false)
                    throw new InvalidOperationException("附件权限已变化，请重新打开表单后保存。");
                var copy = (JObject)file.DeepClone();
                copy.Remove("_FileAccess");
                copy.Remove("VisibleRoleNames");
                copy.Remove("_UploadProof");
                var roleIds = ReadIds(copy["VisibleRoleIds"]);
                if (roleIds.Any(role => !roles.ContainsKey(role))) throw new InvalidOperationException("所选附件角色不存在或已删除，请重新选择。");
                if (roleIds.Count > 0 && copy["Limit"]?.Type != JTokenType.Boolean)
                    throw new InvalidOperationException("设置附件角色权限前请将历史文件重新上传到私有存储。");
                if (roleIds.Count > 0 && copy["Limit"]?.Value<bool>() != true)
                    throw new InvalidOperationException("公有附件不能设置角色权限，请重新上传为私有文件。");
                if (roleIds.Count > 0 && string.IsNullOrWhiteSpace((string)copy["Path"]))
                    throw new InvalidOperationException("附件路径不能为空。");
                // 已有对象身份不能通过改 Id 绕过旧授权，也不能复用无权对象的路径或版本。
                if (oldFiles.Any(old => !CanAccess(old, config) && ReferencesSamePath(old, copy)))
                    throw new InvalidOperationException("不能引用或替换无权限附件。");
                copy["VisibleRoleIds"] = new JArray(roleIds);
                merged.Add(copy);
            }
            foreach (var file in oldFiles.Where(f => !CanAccess(f, config)))
                if (!merged.Any(f => string.Equals((string)f["Id"], (string)file["Id"], StringComparison.OrdinalIgnoreCase)))
                    merged.Insert(Math.Min(oldFiles.IndexOf(file), merged.Count), (JObject)file.DeepClone());
            if (!Flag(config, "Multiple") && merged.Count > 1)
                throw new InvalidOperationException("无权替换当前单文件附件。");
            return Pack(submittedValue, merged, Flag(config, "Multiple"));
        }

        public bool ContainsDenied(JToken value, JObject config) => Files(value).Any(f => !CanAccess(f, config));

        public bool CanReadPath(JToken value, string path, JObject config) => Files(value)
            .Any(f => CanAccess(f, config) && PrivateFileAccessAuthorization.FieldValueReferencesPath(f, path));

        /// <summary>只允许已核实的当前上传路径及该附件原有版本，覆盖所有签名器认可的路径别名和嵌套版本。</summary>
        public static void ValidateReferencedPaths(JToken value, JObject original, string verifiedPath)
        {
            if (value is JArray array)
            {
                foreach (var item in array) ValidateReferencedPaths(item, original, verifiedPath);
                return;
            }
            if (!(value is JObject obj)) return;
            foreach (var property in obj.Properties())
            {
                if (new[] { "Path", "FilePath", "FilePathName" }.Contains(property.Name, StringComparer.OrdinalIgnoreCase))
                {
                    if (property.Value.Type != JTokenType.String) throw new InvalidOperationException("附件路径格式无效。");
                    var path = (string)property.Value;
                    if (!string.Equals(path, verifiedPath, StringComparison.Ordinal)
                        && (original == null || !PrivateFileAccessAuthorization.AuthoritativeValueReferencesPath(original, path)))
                        throw new InvalidOperationException("不能引用未经授权的附件或历史版本路径。");
                }
                else if (string.Equals(property.Name, "Versions", StringComparison.OrdinalIgnoreCase))
                    ValidateReferencedPaths(property.Value, original, verifiedPath);
            }
        }

        private static bool ReferencesSamePath(JObject a, JObject b) => !string.IsNullOrWhiteSpace((string)b["Path"])
            && PrivateFileAccessAuthorization.FieldValueReferencesPath(a, (string)b["Path"]);

        private static JObject Canonical(JObject file) => new JObject(file.Properties().OrderBy(p => p.Name, StringComparer.Ordinal)
            .Select(p => new JProperty(p.Name, p.Value.DeepClone())));

        private static void EnsureUniqueIds(List<JObject> files)
        {
            if (files.Select(f => (string)f["Id"]).Distinct(StringComparer.OrdinalIgnoreCase).Count() != files.Count)
                throw new InvalidOperationException("附件 Id 重复，请重新打开表单。");
        }

        public static List<string> ReadIds(JToken value)
        {
            var parsed = ParseJson(value);
            if (parsed == null || parsed.Type == JTokenType.Null || string.IsNullOrWhiteSpace(parsed.ToString())) return new List<string>();
            if (!(parsed is JArray array)) throw new InvalidOperationException("附件角色必须为角色 Id 数组。");
            if (array.Count > 100 || array.Any(x => x.Type != JTokenType.String || string.IsNullOrWhiteSpace((string)x) || ((string)x).Length > 100))
                throw new InvalidOperationException("附件角色 Id 格式无效。");
            return array.Values<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        internal static List<string> ReadIdentityRoleIds(JToken value)
        {
            // 存量 sys_user.RoleIds 同时存在 Id 数组与角色对象数组；只信任主库中的 Id，忽略旧快照的名称和 Level。
            var parsed = ParseJson(value);
            if (parsed is JArray array)
                return array.Select(item => item is JObject role ? (string)role["Id"] : item.Type == JTokenType.String ? (string)item : null)
                    .Where(id => !string.IsNullOrWhiteSpace(id)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            return new List<string>();
        }

        private static JToken ParseJson(JToken value)
        {
            if (value?.Type != JTokenType.String) return value;
            var text = value.Value<string>()?.Trim();
            if (string.IsNullOrEmpty(text)) return null;
            if (text.StartsWith("[") || text.StartsWith("{")) return JToken.Parse(text);
            return value;
        }

        public static List<JObject> Files(JToken value)
        {
            var parsed = ParseJson(value);
            if (parsed == null || parsed.Type == JTokenType.Null || parsed.ToString() == "null" || parsed.ToString() == "") return new List<JObject>();
            var values = parsed is JArray arr ? arr.ToList() : new List<JToken> { parsed };
            if (values.Count > 1000) throw new InvalidOperationException("附件数量超出允许范围。");
            return values.Select(item =>
            {
                JObject file;
                if (item is JObject obj) file = (JObject)obj.DeepClone();
                else if (item.Type == JTokenType.String)
                    file = new JObject { ["Path"] = (string)item, ["Name"] = ((string)item).Split('/').Last() };
                else throw new InvalidOperationException("附件数据格式无效。");
                if (string.IsNullOrWhiteSpace((string)file["Id"]))
                {
                    // 旧的纯路径/无 Id 附件采用确定性标识，不能每次读取生成随机 Id。
                    using (var sha = SHA256.Create())
                        file["Id"] = "legacy_" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes((string)file["Path"] ?? ""))).Replace("-", "").ToLowerInvariant();
                }
                return file;
            }).ToList();
        }

        private static JToken Pack(JToken original, List<JObject> files, bool? multiple = null)
        {
            var parsed = ParseJson(original);
            JToken value = (multiple ?? parsed is JArray) ? new JArray(files) : (JToken)files.FirstOrDefault() ?? JValue.CreateNull();
            return original?.Type == JTokenType.String ? new JValue(value.ToString(Formatting.None)) : value;
        }
    }
}
