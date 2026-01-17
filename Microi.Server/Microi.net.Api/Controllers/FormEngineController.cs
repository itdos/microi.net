using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class FormEngineController : Controller
    {
        /// <summary>
        /// 设置默认参数（单个对象）
        /// </summary>
        private async Task DefaultParam(JObject param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if(currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentTokenDynamic?.OsClient;
                param["_InvokeType"] = "Client";
            }
        }

        /// <summary>
        /// 设置默认参数（批量对象）
        /// </summary>
        private async Task DefaultParamList(List<JObject> paramList)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();

            if(currentTokenDynamic != null)
            {
                foreach (var param in paramList)
                {
                    param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                    param["OsClient"] = currentTokenDynamic?.OsClient;
                    param["_InvokeType"] = "Client";
                }
            }
        }

        /// <summary>
        /// 获取一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        //[Route("/api/[controller]/GetFormData.{FormEngineKey}")]//使用Microi.net DynamicRoute实现
        public async Task<JsonResult> GetFormData([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
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
            //    return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            //}
            param["_InvokeType"] = "Client";//JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
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
            param["_InvokeType"] = "Client";//JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync(param);
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
            var result = await MicroiEngine.FormEngine.UptFormDataBatchAsync(param);
            return Json(result);
        }
        [HttpPost]
        public async Task<JsonResult> UptTableData([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await MicroiEngine.FormEngine.UptFormDataBatchAsync(param);
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
            var result = await MicroiEngine.FormEngine.AddFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.AddFormDataBatchAsync(param);
            return Json(result);
        }
        [HttpPost]
        public async Task<JsonResult> AddTableData([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await MicroiEngine.FormEngine.AddFormDataBatchAsync(param);
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
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.DelFormDataBatchAsync(param);
            return Json(result);
        }
        [HttpPost]
        public async Task<JsonResult> DelTableData([FromBody] List<JObject> param)
        {
            await DefaultParamList(param);
            var result = await MicroiEngine.FormEngine.DelFormDataBatchAsync(param);
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
            var result = await MicroiEngine.FormEngine.DelFormDataByWhereAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
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
            //    return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            //}
            //param.IsDeleted = 0;
            //param._IsAnonymous = true;

            param["_InvokeType"] = "Client";//JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;

            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableDataCountAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableTreeAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetTableDataTreeAsync(param);
            return Json(result);
        }
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetTableDataTreeAnonymous([FromBody] JObject param)
        {
            //if (param["OsClient"] == null)
            //{
            //    return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            //}
            param["_InvokeType"] = "Client";//JToken.FromObject(InvokeType.Client);
            param["_IsAnonymous"] = true;
            param["IsDeleted"] = 0;

            var result = await MicroiEngine.FormEngine.GetTableDataTreeAsync(param);
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
            var result = await MicroiEngine.FormEngine.GetFieldDataAsync(param);
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
            var result = await MicroiEngine.FormEngine.LoadNotDiyTableAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 传入Id或ModuleEngineKey
        /// 获取模块引擎一条数据（菜单）（带缓存）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysMenu([FromBody] JObject param)
        {
            await DefaultParam(param);
            var idOrKey = param["ModuleEngineKey"].Val<string>();
            if(idOrKey.DosIsNullOrWhiteSpace())
            {
                idOrKey = param["Id"].Val<string>();
            }
            var result = await MicroiEngine.FormEngine.GetSysMenu(idOrKey, param["OsClient"].Val<string>());
            return Json(result);
        }
        /// <summary>
        /// 传入Id或Name，
        /// 获取一张表（表单属性）（带缓存）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetDiyTable([FromBody] JObject param)
        {
            await DefaultParam(param);
            var idOrKey = param["Name"].Val<string>();
            if(idOrKey.DosIsNullOrWhiteSpace())
            {
                idOrKey = param["Id"].Val<string>();
            }
            var result = await MicroiEngine.FormEngine.GetDiyTable(idOrKey, param["OsClient"].Val<string>());
            return Json(result);
        }
    }
}
