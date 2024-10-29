﻿using Microi.net;
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
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class DiyFieldController : Controller
    {
        /// <summary>
        /// 
        /// </summary>
        private static DiyFieldLogic _diyFieldLogic = new DiyFieldLogic();
        /// <summary>
        /// 默认参数
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        private static async Task DefaultParam(DiyFieldParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = currentToken.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentToken.OsClient;
        }

        ///// <summary>
        ///// 默认参数
        ///// </summary>
        ///// <param name="param"></param>
        ///// <returns></returns>
        //private static async Task<DiyFieldParam> DefaultParamDynamic(dynamic param)
        //{
        //    var currentToken = await DiyToken.GetCurrentToken<SysUser>();
        //    var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
        //    param._CurrentSysUser = currentToken.CurrentUser;
        //    param._CurrentUser = currentTokenDynamic.CurrentUser;
        //    param.OsClient = currentToken.OsClient;
        //}

        /// <summary>
        /// 新增一个字段
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> AddDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.AddDiyField(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetExceptionFieldList(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.GetExceptionFieldList(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddDbField(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.AddDbField(param);
            return Json(result);
        }
        /// <summary>
        /// 删除一个字段
        /// 必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> DelDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.DelDiyField(param);
            return Json(result);
        }
        /// <summary>
        /// 修改一个字段
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        
        [HttpPost]  
        public async Task<JsonResult> UptDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.UptDiyField(param);
            return Json(result);
        }

        //[HttpPost]
        //public async Task<JsonResult> UptDiyFieldFromBody([FromBody] JObject param)
        //{
        //    var realParam = await DefaultParam(param);
        //    var result = await _diyFieldLogic.UptDiyField(realParam);
        //    return Json(result);
        //}

        /// <summary>
        /// 批量修改字段
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> UptDiyFieldList(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.UptDiyFieldList(param);
            return Json(result);
        }
        /// <summary>
        /// 获取一个字段信息
        /// 必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyFieldModel(DiyFieldParam param)
        {
            await DefaultParam(param);
            var result = await _diyFieldLogic.GetDiyFieldModel(param);
            return Json(result);
        }
        /// <summary>
        /// 获取一张表字段列表。
        /// 必传TableId或TableName
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _diyFieldLogic.GetDiyField(param);

            return Json(listSysUser);
        }
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetDeletedDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 1;
            var listSysUser = await _diyFieldLogic.GetDiyField(param);

            return Json(listSysUser);
        }
        [HttpPost]
        public async Task<JsonResult> RecoverDiyField(DiyFieldParam param)
        {
            await DefaultParam(param);
            var listSysUser = await _diyFieldLogic.RecoverDiyField(param);

            return Json(listSysUser);
        }
        /// <summary>
        /// 获取多张表的字段列表。
        /// 必传：TableIds或TableNames
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetDiyFieldByDiyTables(DiyFieldParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            var listSysUser = await _diyFieldLogic.GetDiyFieldByDiyTables(param);
            return Json(listSysUser);
        }
    }
}