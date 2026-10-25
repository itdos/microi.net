using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 可信后台复制器使用的备用存储控制面；不注入 V8，不接受请求携带的凭据。
    /// 实现只操作 SaaS 已配置的公有桶及独立热点命名空间，不能改变私有桶权限。
    /// </summary>
    public interface IPublicResourceReplicaStore
    {
        Task<DosResult> ProbePublicReplicaStoreAsync(OsClientSecret storageOwner, CancellationToken cancellationToken);
        Task<DosResult> AllowVerifiedPublicReplicaPrefixAsync(OsClientSecret storageOwner, string verifiedPrefix,
            CancellationToken cancellationToken);
    }
}
