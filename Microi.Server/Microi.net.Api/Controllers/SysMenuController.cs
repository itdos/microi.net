using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class SysMenuController : Controller
    {
        private static SysMenuLogic _sysMenuLogic = new SysMenuLogic();
        private static async Task DefaultParam(SysMenuParam param)
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken<SysUser>();
                var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
                param._CurrentSysUser = currentToken.CurrentUser;
                param._CurrentUser = currentTokenDynamic.CurrentUser;
                param.OsClient = currentToken.OsClient;
            }
            catch (Exception ex)
            {
                        
                
                throw new Exception("DefaultParam初始化异常：" + ex.Message);
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.AddSysMenu(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.DelSysMenu(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.UptSysMenu(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenu(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenu(param);
            return Json(result);
        }
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenuModel(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenuModel(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysMenuStep(SysMenuParam param)
        {
            await DefaultParam(param);
            var result = await _sysMenuLogic.GetSysMenuStep(param);
            return Json(result);
        }

    }
}