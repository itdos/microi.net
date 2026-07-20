using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>把对象存储私有签名地址替换为可审计、可匿名转发的短期代理地址。</summary>
    public interface IPrivateFileAuditLinkService
    {
        Task<DosResult> WrapAsync(DosResult result, DiyUploadParam param);
    }
}
