using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class SysBaseDataController : Controller
    {
        private static SysBaseDataLogic _sysBaseDataLogic = new SysBaseDataLogic();
        private static async Task DefaultParam(SysBaseDataParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = currentToken.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentToken.OsClient;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> AddSysBaseData(SysBaseDataParam param)
        {
            await DefaultParam(param);
            var result = await _sysBaseDataLogic.AddSysBaseData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> DelSysBaseData(SysBaseDataParam param)
        {
            await DefaultParam(param);
            var result = await _sysBaseDataLogic.DelSysBaseData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> UptSysBaseData(SysBaseDataParam param)
        {
            await DefaultParam(param);
            var result = await _sysBaseDataLogic.UptSysBaseData(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysBaseData(SysBaseDataParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _sysBaseDataLogic.GetSysBaseData(param);
            return Json(listSysUser);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysBaseData_Biz(SysBaseDataParam param)
        {
            param.IsDeleted = 0;
            var listSysUser = await _sysBaseDataLogic.GetSysBaseData(param);
            return Json(listSysUser);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysBaseDataStep(SysBaseDataParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _sysBaseDataLogic.GetSysBaseDataStep(param);
            return Json(listSysUser);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysBaseDataPa(SysBaseDataParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _sysBaseDataLogic.GetPa(param);
            return Json(listSysUser);
        }
    }
}