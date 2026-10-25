using System;
using System.Linq;
using System.Threading;
using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>只读公开URL选择，不接受状态、摘要或目标地址；不能复制或访问私有文件。</summary>
        public DosResult GetPublicResourceBackupUrl(dynamic dynamicParam)
        {
            try
            {
                var input = ToJObject((object)dynamicParam);
                if (input.Properties().Any(p => p.Name != "FilePathName")) return new DosResult(0, null, "UnsupportedOffloadArgument");
                var url = PublicResourceOffloadRuntime.ResolvePublicObjectAsync(input.Value<string>("FilePathName")).GetAwaiter().GetResult();
                return new DosResult(1, new { UseBackup = url != null, Url = url });
            }
            catch { return new DosResult(1, new { UseBackup = false }); }
        }
        /// <summary>
        /// 固定 Managed 引擎的主租户存储控制面。动态参数只含动作与公开应用身份，
        /// 不能传凭据、Provider、目标URL、字节数、摘要、Ready或当前用户。
        /// </summary>
        public DosResult ManagePublicResourceOffload(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser("mci-file-resource-runtime", true, DiyCommon.MaxRoleLevel,
                out var tenant, out var currentUser);
            if (denied != null) return denied;
            if (!string.Equals(tenant, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase)
                || !PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(tenant, currentUser))
                return new DosResult(1002, null, "StorageOwnerAdministratorRequired");
            try
            {
                var input = ToJObject((object)dynamicParam);
                var allowed = new[] { "Action", "SourceTenant", "AppKey" };
                if (input.Properties().Any(property => !allowed.Contains(property.Name, StringComparer.Ordinal)))
                    return new DosResult(0, null, "UnsupportedOffloadArgument");
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
                return PublicResourceOffloadRuntime.ManageAsync(tenant, input, timeout.Token).GetAwaiter().GetResult();
            }
            catch { return new DosResult(0, null, "PublicOffloadOperationFailed"); }
        }
    }
}
