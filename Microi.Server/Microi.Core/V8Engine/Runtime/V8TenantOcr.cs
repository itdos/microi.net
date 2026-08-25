using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8.OCR 租户代理。脚本传入的 OsClient 永远被当前执行租户覆盖，网络目标与认证
    /// 信息不在请求模型中，因此无法从接口引擎构造跨租户或任意目标请求。
    /// </summary>
    public sealed class V8TenantOcr : IV8Ocr
    {
        private readonly string _osClient;

        public V8TenantOcr(string osClient)
        {
            _osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
        }

        public Task<DosResult<MicroiOcrRecognizeResult>> Recognize(MicroiOcrRecognizeParam param)
        {
            param = param ?? new MicroiOcrRecognizeParam();
            var contextOsClient = V8TenantContext.Current?.OsClient;
            if (!string.IsNullOrWhiteSpace(contextOsClient)
                && !string.Equals(contextOsClient, _osClient,
                    System.StringComparison.OrdinalIgnoreCase))
            {
                return Task.FromResult(new DosResult<MicroiOcrRecognizeResult>(
                    0, null, "OCR 租户与当前 V8 执行租户不一致。"));
            }
            param.OsClient = _osClient;
            return MicroiEngine.OCR.RecognizeAsync(param);
        }
    }
}
