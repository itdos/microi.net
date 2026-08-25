using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 系统账号可信原子调用的最小宿主协议边界。Core 不识别微信 HTTP 请求或
    /// 回调协议；API 宿主只返回审核结论，不接管账号 CRUD、租户或权限判断。
    /// </summary>
    public interface ISysUserProfileContentSecurityGateway
    {
        Task<DosResult> ValidateProfileUpdateAsync(
            string osClient,
            JObject trustedCurrentUser,
            SysUserParam param,
            CancellationToken cancellationToken = default);
    }
}
