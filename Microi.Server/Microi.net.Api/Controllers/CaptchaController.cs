using Dos.Common;
using Lazy.Captcha.Core;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// 验证码组件
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public class CaptchaController : ControllerBase
    {
        private readonly ICaptcha _captcha;
        private readonly IMicroiCaptchaRecognizer _captchaRecognizer;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="captcha"></param>
        public CaptchaController(ICaptcha captcha, IMicroiCaptchaRecognizer captchaRecognizer)
        {
            _captcha = captcha;
            _captchaRecognizer = captchaRecognizer;
        }
        /// <summary>
        /// 获取验证码，header中返回 captchaid，回传验证时需传入_CaptchaId
        /// 必传OsClient
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public IActionResult GetCaptcha(MicroiCaptchaContent param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) };
            }
            var captchaId = param.OsClient.DosTrim() + ":Captcha:" + Ulid.NewUlid().ToString();
            var info = _captcha.Generate(captchaId);
            if (info == null)
            {
                return new ContentResult() { Content = "获取验证码失败，请联系系统管理员！" };
            }
            HttpContext.Response.Headers.Add("captchaid", info.Id);
            // 有多处验证码且过期时间不一样，可传第二个参数覆盖默认配置。
            //var info = _captcha.Generate(id,120);
            var stream = new MemoryStream(info.Bytes);
            return File(stream, "image/gif");
        }

        /// <summary>
        /// 识别采集引擎传入的验证码图片或算术表达式。
        /// 不返回平台验证码的服务端答案，只用于 OpenClaw/Worker 对外部站点验证码做可插拔 OCR。
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        public async Task<DosResult<MicroiCaptchaRecognizeResult>> Recognize([FromBody] MicroiCaptchaRecognizeParam param)
        {
            if (param == null)
            {
                param = new MicroiCaptchaRecognizeParam();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            return await _captchaRecognizer.RecognizeAsync(param);
        }

        // / <summary>
        // / 
        // / </summary>
        //[HttpPost]
        //public bool CheckCaptcha(string id, string code)
        //{
        //    return _captcha.Validate(id, code, false);
        //}
    }
}
