using System;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 空目录标记恢复是管理员存储操作，身份只能来自可信 V8 作用域或 DiyToken。
    /// 调用者提交的 _CurrentUser、Level、角色与租户参数不能获得该能力。
    /// </summary>
    internal static class HdfsObjectDeleteAuthorization
    {
        internal static async Task<DosResult> AuthorizeEmptyDirectoryAsync(string expectedTenant)
        {
            try
            {
                var actor = V8TrustedExecutionContext.CurrentUser;
                var tenant = V8TrustedExecutionContext.CurrentOsClient;
                if (actor == null)
                {
                    var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                    actor = token?.CurrentUser;
                    tenant = token?.OsClient;
                }
                return ValidateTrustedIdentity(expectedTenant, tenant, actor,
                    PlatformAdministratorSecurity.IsCurrentPlatformAdministrator);
            }
            catch
            {
                return new DosResult(0, null, "空目录标记删除的管理员身份暂不可核验。");
            }
        }

        internal static DosResult ValidateTrustedIdentity(string expectedTenant, string actorTenant,
            JObject actor, Func<string, JObject, bool> verifyCurrentAdministrator)
        {
            if (string.IsNullOrWhiteSpace(actorTenant)
                || !string.Equals(TenantConfigurationSecurity.NormalizeTenantId(expectedTenant),
                    TenantConfigurationSecurity.NormalizeTenantId(actorTenant), StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(actor?["Id"]?.ToString())
                || UserAccessKeySecurity.IsSession(actor)
                || actor["Level"].Val<int>() < DiyCommon.MaxRoleLevel
                || verifyCurrentAdministrator == null
                || !verifyCurrentAdministrator(expectedTenant, actor))
                return new DosResult(0, null, "仅当前租户有效平台管理员可删除空目录标记。");
            return null;
        }
    }
}
