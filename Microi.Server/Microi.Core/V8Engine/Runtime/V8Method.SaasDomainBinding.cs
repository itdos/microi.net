using System;
using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>
        /// 仅供主租户本地 Managed 精确域名绑定接口使用的授权原子。
        /// 身份来自可信执行上下文或真实 DiyToken，不信任 V8.Param/_CurrentUser；
        /// 同时固定主租户、接口 Key，拒绝访问密钥会话并向主库重验平台管理员。
        /// </summary>
        public DosResult AuthorizeAdminTenantDomainBinding()
        {
            const string engineKey = "admin_ensure_saas_tenant_domain_binding";
            var denied = ResolveTrustedManagedCurrentUser(
                engineKey,
                true,
                DiyCommon.MaxRoleLevel,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            if (!string.Equals(
                    osClient,
                    OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(1002, null, "仅主租户允许绑定 SaaS 租户域名。");
            }

            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    osClient,
                    currentUser))
            {
                return new DosResult(0, null, "当前账号已不再是有效的平台超级管理员。");
            }

            return new DosResult(1);
        }

        /// <summary>
        /// 仅供 iTdos 官方运营 Managed 接口使用的独立授权原子。
        /// 精确固定 iTdos 和外部 SaaS 域名绑定接口 Key，拒绝访问密钥会话，
        /// 并从主库重验当前账号仍是有效平台超级管理员。
        /// </summary>
        public DosResult AuthorizeExternalSaasTenantDomainBinding()
        {
            const string engineKey = "admin_ensure_external_saas_tenant_domain_binding";
            const string officialOsClient = "iTdos";
            var denied = ResolveTrustedManagedCurrentUser(
                engineKey,
                true,
                DiyCommon.MaxRoleLevel,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            if (!string.Equals(
                    osClient,
                    officialOsClient,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(1002, null,
                    "仅 iTdos 官方运营租户允许绑定外部 SaaS 租户域名。");
            }

            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                    osClient,
                    currentUser))
            {
                return new DosResult(0, null,
                    "当前账号已不再是有效的 iTdos 平台超级管理员。");
            }

            return new DosResult(1);
        }
    }
}
