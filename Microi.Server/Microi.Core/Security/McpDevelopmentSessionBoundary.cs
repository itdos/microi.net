using System;
using System.Linq;

namespace Microi.net
{
    /// <summary>已验签的开发终端会话不能改走普通 HTTP 路由绕开 MCP 范围/写入开关。</summary>
    public static class McpDevelopmentSessionBoundary
    {
        public static bool IsDevelopmentSession(string clientType) =>
            string.Equals(clientType,"MCP",StringComparison.OrdinalIgnoreCase)
            || string.Equals(clientType,"VSCode",StringComparison.OrdinalIgnoreCase);

        public static bool Allows(McpRoleAuthorization auth,bool guardedMcpAction,string controller,string action)
        {
            if(auth?.Enabled!=true)return false;
            if(auth.IsAdministrator)return true;
            // 这里仅允许进入 MCP 控制器；端点、动作及真实参数仍由它的过滤器再次检查。
            if(guardedMcpAction)return true;
            if(controller=="SysUser"&&(action=="RefreshToken"||action=="RefreshLoginUser"||action=="Logout"))return true;
            // 可执行资源具有间接写删能力，必须由同一完整开发角色同时授予两个开关。
            return auth.Grants.Any(g=>g.Policy.Enabled&&g.Policy.Scope=="Full"&&g.Policy.CanWrite&&g.Policy.CanDelete);
        }
    }
}
