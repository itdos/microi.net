using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class SysDeptController : Controller
    {
        private static async Task DefaultParam(SysDeptParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysDept(SysDeptParam param)
        {
            await DefaultParam(param);

            var result = await new SysDeptLogic().AddSysDept(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysDept(SysDeptParam param)
        {
            await DefaultParam(param);

            var result = await new SysDeptLogic().DelSysDept(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysDept(SysDeptParam param)
        {
            await DefaultParam(param);

            var result = await new SysDeptLogic().UptSysDept(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysDept(SysDeptParam param)
        {
            await DefaultParam(param);
            var listSysUser = await new SysDeptLogic().GetSysDept(param);

            return Json(listSysUser);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysDeptModel(SysDeptParam param)
        {
            await DefaultParam(param);
            var listSysUser = await new SysDeptLogic().GetSysDeptModel(param);

            return Json(listSysUser);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysDeptStep(SysDeptParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await new SysDeptLogic().GetSysDeptStep(param);
            return Json(listSysUser);
        }

    }
}