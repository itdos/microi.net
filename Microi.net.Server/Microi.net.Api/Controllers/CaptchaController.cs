using Dos.Common;
using Lazy.Captcha.Core;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 验证码组件
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public class CaptchaController : ControllerBase
    {
        private readonly ICaptcha _captcha;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="captcha"></param>
        public CaptchaController(ICaptcha captcha)
        {
            _captcha = captcha;
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

            //var clientIp = IPHelper.GetClientIP(HttpContext);
            //if (clientIp)
            //{

            //}

            var captchaId = param.OsClient.DosTrim() + ":Captcha:" + Guid.NewGuid().ToString();
            var info = _captcha.Generate(captchaId);
            if (info == null)
            {
                return new ContentResult() { Content = "获取验证码失败，请联系系统管理员！" };
            }
            DiyCommon.TryAction(() => {
                HttpContext.Response.Headers.Add("Access-Control-Expose-Headers", "set-cookie,token,did,authorization,captchaid");
            });
            HttpContext.Response.Headers.Add("captchaid", info.Id);
            // 有多处验证码且过期时间不一样，可传第二个参数覆盖默认配置。
            //var info = _captcha.Generate(id,120);
            var stream = new MemoryStream(info.Bytes);
            return File(stream, "image/gif");
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
