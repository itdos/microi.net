using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api
{
    /// <summary>
    /// 通用 OCR 接口。识别服务地址、认证信息和超时来自当前租户 SaaS 引擎配置，
    /// 公网请求不能覆盖这些服务器端字段。
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public sealed class OcrController : ControllerBase
    {
        private readonly IMicroiOcr _ocr;

        public OcrController(IMicroiOcr ocr)
        {
            _ocr = ocr;
        }

        /// <summary>
        /// 识别一张图片或一个 PDF，返回统一的全文、分页文本、置信度和文本区域。
        /// </summary>
        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        [RequestSizeLimit(140 * 1024 * 1024)]
        public async Task<DosResult<MicroiOcrRecognizeResult>> Recognize(
            [FromBody] MicroiOcrRecognizeParam param)
        {
            param = param ?? new MicroiOcrRecognizeParam();
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null || currentToken.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<MicroiOcrRecognizeResult>(
                    1001,
                    null,
                    DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang));
            }

            // 以已验证 Token 的租户为唯一事实源，忽略请求体中的 OsClient。
            param.OsClient = currentToken.OsClient;
            return await _ocr.RecognizeAsync(param, HttpContext.RequestAborted);
        }
    }
}
