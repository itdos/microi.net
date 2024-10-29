using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class FormEngineController : Controller
    {
        private static FormEngine _formEngineLogic = new FormEngine();

        private static async Task DefaultParam([FromBody] JObject param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
            param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
            param["OsClient"] = currentToken.OsClient;
            //调用方式 Server、Client
            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);// "Client";
        }
        private static async Task DefaultParamList([FromBody] List<JObject> paramList)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            foreach (var param in paramList)
            {
                param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentToken.OsClient;
                //调用方式 Server、Client
                param["_InvokeType"] = JToken.FromObject(InvokeType.Client);// "Client";
            }
        }

        /// <summary>
        /// 获取一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        //[Route("/api/[controller]/GetFormData.{FormEngineKey}")]//使用Microi.net DynamicRoute实现
        public async Task<JsonResult> GetFormData([FromBody]JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.GetFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 匿名获取一条数据，必传OsClient。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> GetFormDataAnonymous([FromBody] JObject param)
        {
            //if (param["OsClient"] == null)
            //{
            //    return Json(new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]));
            //}
            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;
            var result = await _formEngineLogic.GetFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 匿名获取一条数据，无需传入OsClient。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> GetFormDataAnonymousDefault([FromBody] JObject param)
        {
            param["OsClient"] = OsClient.GetConfigOsClient();
            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;
            var result = await _formEngineLogic.GetFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 修改一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptFormData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.UptFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptFormDataByWhere([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.UptFormDataByWhereAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptFormDataBatch([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await _formEngineLogic.UptFormDataBatchAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 新增一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddFormData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.AddFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddFormDataBatch([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await _formEngineLogic.AddFormDataBatchAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 删除一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelFormData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.DelFormDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelFormDataBatch([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await _formEngineLogic.DelFormDataBatchAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelFormDataByWhere([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.DelFormDataByWhereAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 获取数据列表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetTableData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.GetTableDataAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 匿名获取数据，必传：OsClient、TableId或Name
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetTableDataAnonymous([FromBody] JObject param)
        {
            //if (param["OsClient"] == null)
            //{
            //    return Json(new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]));
            //}
            //param.IsDeleted = 0;
            //param._IsAnonymous = true;

            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;

            var result = await _formEngineLogic.GetTableDataAsync(param);
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
            var result = await _formEngineLogic.GetTableDataCountAsync(param);
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
            var result = await _formEngineLogic.GetTableTreeAsync(param);
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
            var result = await _formEngineLogic.GetTableDataTreeAsync(param);
            return Json(result);
        }
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetTableDataTreeAnonymous([FromBody] JObject param)
        {
            //if (param["OsClient"] == null)
            //{
            //    return Json(new DosResult(0, null, DiyMessage.Msg["ParamError"][param._Lang]));
            //}
            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;

            var result = await _formEngineLogic.GetTableDataTreeAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetFieldData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.GetFieldDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 将非diy表加载为diy表。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> LoadNotDiyTable([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _formEngineLogic.LoadNotDiyTableAsync(param);
            return Json(result);
        }
    }
}
