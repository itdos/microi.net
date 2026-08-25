using System;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 官方升级资源发布控制面的最小可信授权原子。资源校验、CAS、行锁、写入
    /// 和回读仍由 Managed V8 编排；C# 只保留不可交给可编辑脚本的身份边界。
    /// </summary>
    public partial class V8Method
    {
        private const string OfficialResourcePublisherEngineKey = "get-microi-upgrade-resource";
        private const string OfficialResourcePublisherTenant = "iTdos";

        public DosResult AuthorizeOfficialResourcePublish()
        {
            var denied = ResolveTrustedManagedCurrentUser(
                OfficialResourcePublisherEngineKey,
                true,
                0,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            if (!string.Equals(
                    osClient,
                    OfficialResourcePublisherTenant,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(1002, null, "仅吾码官方租户可以发布升级资源。");
            }

            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
            {
                return new DosResult(0, null, "仅当前仍有效的平台超级管理员可以发布吾码升级资源。");
            }

            return new DosResult(1, new
            {
                OsClient = osClient,
                UserId = currentUser["Id"].Val<string>()
            });
        }
    }
}
