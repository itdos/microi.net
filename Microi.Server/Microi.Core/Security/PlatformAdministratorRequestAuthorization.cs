using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>供可信管理入口共用的 DiyToken 与主库管理员复核；缓存仅限当前 HTTP 请求。</summary>
    public static class PlatformAdministratorRequestAuthorization
    {
        private const string PermissionTokenItemKey = "__Microi_V8Mcp_PermissionToken__";
        private const string PermissionErrorItemKey = "__Microi_V8Mcp_PermissionError__";

        public static async Task<(bool ok, string msg, dynamic token)> CheckCurrentRequestAsync()
        {
            try
            {
                var httpContext = DiyHttpContext.Current;
                if (httpContext?.Items.TryGetValue(PermissionTokenItemKey, out var cachedToken) == true
                    && cachedToken is CurrentToken trustedToken)
                {
                    return (true, "", trustedToken);
                }
                if (httpContext?.Items.TryGetValue(PermissionErrorItemKey, out var cachedError) == true)
                {
                    return (false, cachedError?.ToString() ?? "权限验证失败", null);
                }

                var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (currentToken == null || currentToken.CurrentUser == null)
                {
                    if (httpContext != null) httpContext.Items[PermissionErrorItemKey] = "未登录或登录已过期";
                    return (false, "未登录或登录已过期", null);
                }

                var currentUser = currentToken.CurrentUser;
                var tokenClaimsAdministrator = currentUser["_IsAdmin"].Val<bool>()
                    || currentUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
                var isCurrentAdministrator = tokenClaimsAdministrator
                    && PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                        currentToken.OsClient,
                        currentUser);
                if (!isCurrentAdministrator)
                {
                    const string noAuth = "权限不足，需要当前有效的平台管理员身份";
                    if (httpContext != null) httpContext.Items[PermissionErrorItemKey] = noAuth;
                    return (false, noAuth, null);
                }

                if (httpContext != null) httpContext.Items[PermissionTokenItemKey] = currentToken;
                return (true, "", currentToken);
            }
            catch
            {
                try
                {
                    var httpContext = DiyHttpContext.Current;
                    if (httpContext != null) httpContext.Items[PermissionErrorItemKey] = "权限验证失败";
                }
                catch
                {
                    // Unit tests and non-HTTP callers may not have an accessor.
                }
                return (false, "权限验证失败", null);
            }
        }
    }
}
