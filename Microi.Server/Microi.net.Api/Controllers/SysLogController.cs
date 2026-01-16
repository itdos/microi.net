using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net.Api
{
    /// <summary>
    ///
    /// </summary>
    [EnableCors("any")]
    //[ApiController]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class SysLogController : Controller
    {
        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysLog(SysLogParam paramLog)
        {
            var param = paramLog;

            #region 取当前登录会员信息

            var sysUser = await DiyToken.GetCurrentToken();

            #endregion 取当前登录会员信息

            param.OsClient = sysUser?.OsClient;
            
            var result = await MicroiEngine.MongoDB.GetSysLog(param);
            return Json(result);
        }

        /// <summary>
        /// 传入Type、Title、Content、
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> AddSysLog(SysLogParam paramLog)
        {
            var param = paramLog;
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser != null)
            {
                param.OsClient = sysUser.OsClient;
                param.UserName = sysUser.CurrentUser["Name"].Val<string>();
                param.UserId = sysUser.CurrentUser["Id"].Val<string>();
            }
            else
            {
                var token = "";
                if (!param.authorization.DosIsNullOrWhiteSpace())
                {
                    token = param.authorization;
                }
                else
                {
                    token = HttpContext.Request.Headers["authorization"];
                }
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var tokenModelJobj = await DiyToken.GetCurrentToken(param.authorization, param.OsClient);
                    if (tokenModelJobj != null)
                    {
                        param.OsClient = tokenModelJobj.OsClient;
                        param._CurrentUser = tokenModelJobj.CurrentUser;
                        param.UserName = tokenModelJobj.CurrentUser["Name"].Val<string>();
                        param.UserId = tokenModelJobj.CurrentUser["Id"].Val<string>();
                    }
                }
            }

            var result = await MicroiEngine.MongoDB.AddSysLog(param);
            return Json(result);
        }
    }
}