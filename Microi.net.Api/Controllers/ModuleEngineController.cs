﻿using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class ModuleEngineController : Controller
    {
        private static ModuleEngine _moduleEngineLogic = new ModuleEngine();

        private static async Task DefaultParam([FromBody] JObject param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
            param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
            param["OsClient"] = currentToken.OsClient;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetTableData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _moduleEngineLogic.GetTableDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetTableDataCount([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _moduleEngineLogic.GetTableDataCountAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [Obsolete("同GetTableDataTree")]
        public async Task<JsonResult> GetTableTree([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _moduleEngineLogic.GetTableTreeAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetTableDataTree([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _moduleEngineLogic.GetTableDataTreeAsync(param);
            return Json(result);
        }
    }
}
