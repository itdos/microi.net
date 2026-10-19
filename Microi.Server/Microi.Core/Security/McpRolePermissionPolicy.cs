using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>角色 MCP 授权的唯一存储契约；不改变账号 Level 或普通业务权限。</summary>
    public sealed class McpRolePermissionPolicy
    {
        public const string LimitType = "McpDevelopment";
        public const string LimitKey = "McpDevelopment";
        public bool Enabled { get; set; }
        public string Scope { get; set; } = "Role";
        public bool CanWrite { get; set; }
        public bool CanDelete { get; set; }

        /// <summary>拒绝未知字段和宽松布尔转换，避免误拼字段静默扩大权限。</summary>
        public static McpRolePermissionPolicy Parse(JToken value)
        {
            if (!(value is JObject obj)) throw new ArgumentException("MCP 授权必须是对象。");
            var names = new HashSet<string>(new[] { "Enabled", "Scope", "CanWrite", "CanDelete" }, StringComparer.Ordinal);
            if (obj.Properties().Any(p => !names.Contains(p.Name)) || obj.Count != 4)
                throw new ArgumentException("MCP 授权字段不完整或包含未知字段。");
            foreach (var name in new[] { "Enabled", "CanWrite", "CanDelete" })
                if (obj[name]?.Type != JTokenType.Boolean) throw new ArgumentException("MCP 权限开关必须是布尔值。");
            var scope = obj["Scope"]?.Value<string>();
            if (scope != "Role" && scope != "Full") throw new ArgumentException("MCP 访问范围无效。");
            var enabled = obj["Enabled"].Value<bool>();
            return new McpRolePermissionPolicy { Enabled = enabled, Scope = enabled ? scope : "Role",
                CanWrite = enabled && obj["CanWrite"].Value<bool>(), CanDelete = enabled && obj["CanDelete"].Value<bool>() };
        }

        public string Serialize() => JsonConvert.SerializeObject(this);

        /// <summary>旧库没有此类型时默认关闭；损坏或重复配置不能变成授权。</summary>
        public static McpRolePermissionPolicy Read(IEnumerable<SysRoleLimit> limits, string roleId)
        {
            var rows = (limits ?? Array.Empty<SysRoleLimit>()).Where(row =>
                string.Equals(row.RoleId, roleId, StringComparison.OrdinalIgnoreCase)
                && string.Equals(row.Type, LimitType, StringComparison.OrdinalIgnoreCase)).ToList();
            if (rows.Count != 1 || rows[0].FkId != LimitKey) return new McpRolePermissionPolicy();
            try { return Parse(JObject.Parse(rows[0].Permission)); }
            catch { return new McpRolePermissionPolicy(); }
        }
    }

    /// <summary>每个请求从当前租户主库复核身份和授权；撤销不依赖 Token 刷新或节点缓存。</summary>
    public sealed class McpRoleAuthorization
    {
        public const string AuthorizedActionItem = "Microi.Mcp.AuthorizedAction";
        public CurrentToken Token { get; private set; }
        public bool IsAdministrator { get; private set; }
        public List<McpRoleGrant> Grants { get; } = new List<McpRoleGrant>();
        public bool Enabled => IsAdministrator || Grants.Count > 0;

        /// <summary>仅 MCP 过滤器已放行的执行动作可使用角色开发权；JSON 标志本身不授予执行权。</summary>
        public static bool CanExecuteDebugCode(CurrentToken token)
        {
            var auth = Resolve(token);
            if (auth.IsAdministrator) return true;
            return DiyHttpContext.Current?.Items.TryGetValue(AuthorizedActionItem, out var action) == true
                && string.Equals(action as string, "ExecuteApiEngine", StringComparison.Ordinal)
                && auth.Grants.Any(g => g.Policy.Enabled && g.Policy.Scope == "Full" && g.Policy.CanWrite && g.Policy.CanDelete);
        }

        public static McpRoleAuthorization Resolve(CurrentToken token)
        {
            var result = new McpRoleAuthorization { Token = token };
            if (token?.CurrentUser == null || string.IsNullOrWhiteSpace(token.OsClient)) return result;
            if (PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(token.OsClient, token.CurrentUser))
            { result.IsAdministrator = true; return result; }
            // 受限角色须使用本人交互登录或 CLI 会话；访问密钥不可继承角色开发授权。
            if (UserAccessKeySecurity.IsSession(token.CurrentUser)) return result;
            var db = OsClientExtend.GetClient(token.OsClient)?.Db;
            var id = token.CurrentUser["Id"]?.ToString();
            if (db == null || string.IsNullOrWhiteSpace(id)) return result;
            var user = db.From<SysUser>().Select(SysUser._.Id, SysUser._.State, SysUser._.IsDeleted, SysUser._.RoleIds)
                .Where(u => u.Id == id && u.State == 1 && u.IsDeleted != 1).First();
            if (user == null) return result;
            var ids = PlatformAdministratorSecurity.ParseRoleIds(user.RoleIds);
            if (ids.Count == 0) return result;
            var roles = db.From<SysRole>().Select(SysRole._.Id).Where(r => r.Id.In(ids) && r.IsDeleted != 1).ToList();
            var active = roles.Select(r => r.Id).ToList();
            if (active.Count == 0) return result;
            var limits = db.From<SysRoleLimit>().Where(r => r.RoleId.In(active)).ToList();
            foreach (var role in roles)
            {
                var policy = McpRolePermissionPolicy.Read(limits, role.Id);
                if (policy.Enabled) result.Grants.Add(new McpRoleGrant { RoleId = role.Id, Policy = policy,
                    Limits = limits.Where(r => string.Equals(r.RoleId, role.Id, StringComparison.OrdinalIgnoreCase)).ToList() });
            }
            return result;
        }
    }

    /// <summary>操作开关与同一角色范围成对计算，禁止跨角色拼接出更大的写权限。</summary>
    public sealed class McpRoleGrant
    {
        public string RoleId { get; set; }
        public McpRolePermissionPolicy Policy { get; set; }
        public List<SysRoleLimit> Limits { get; set; } = new List<SysRoleLimit>();
    }
}
