using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>执行当前 HTTP 上传的可信文件流原子；同一请求重复调用不会重复上传。</summary>
        public Task<DosResult> UploadCurrentRequestAsync() => HdfsUploadRequestContext.UploadAsync();

        /// <summary>读取宿主从当前租户系统设置得到的兼容开关，请求参数不可覆盖。</summary>
        public bool IsLegacyUploadCompatibilityEnabled() => HdfsUploadRequestContext.IsLegacyEnabled();
    }
}
