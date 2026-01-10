using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

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
    public class SysRoleController : Controller
    {
        private static SysRoleLogic _sysRoleLogic = new SysRoleLogic();

        private static async Task DefaultParam(SysRoleParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.AddSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysRoleFromBody([FromBody] SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.AddSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.DelSysRole(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.UptSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysRoleFromBody([FromBody] SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.UptSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysRoleModel(SysRoleParam param)
        {
            await DefaultParam(param);
            var result = await _sysRoleLogic.GetSysRoleModel(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysRole(SysRoleParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var result = await _sysRoleLogic.GetSysRole(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysRoleStep(SysRoleParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var result = await _sysRoleLogic.GetSysRoleStep(param);
            return Json(result);
        }
    }
}