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
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken != null)
            {
                param.OsClient = currentToken.OsClient;
                param.UserName = currentToken.CurrentUser["Name"].Val<string>();
                param.UserId = currentToken.CurrentUser["Id"].Val<string>();
            }

            var result = await MicroiEngine.MongoDB.AddSysLog(param);
            return Json(result);
        }
    }
}