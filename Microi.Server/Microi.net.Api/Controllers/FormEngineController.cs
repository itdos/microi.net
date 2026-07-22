using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

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
        private string GetRequestLang()
        {
            try
            {
                var lang = Request?.Headers?["lang"].ToString();
                return lang.DosIsNullOrWhiteSpace() ? DiyMessage.Lang : lang;
            }
            catch
            {
                return DiyMessage.Lang;
            }
        }

        private void EnsureLang(JObject param)
        {
            if (param != null && (param["_Lang"] == null || param["_Lang"].Val<string>().DosIsNullOrWhiteSpace()))
            {
                param["_Lang"] = GetRequestLang();
            }
        }

        private void SetCurrentUserParam(JObject param, object currentUser)
        {
            if (param == null || currentUser == null)
            {
                return;
            }
            try
            {
                param["_CurrentUser"] = currentUser is JToken token ? token.DeepClone() : JToken.FromObject(currentUser);
            }
            catch
            {
                // Current user context is optional metadata for auth/V8 helpers.
            }
        }

        private static DosResult<dynamic> CreatePublicSysConfigResult(DosResult<dynamic> source)
        {
            if (source == null) return null;

            var result = new DosResult<dynamic>(
                source.Code,
                source.Data == null
                    ? null
                    : TenantConfigurationSecurity.CreatePublicSysConfigProjection(source.Data),
                source.Msg,
                source.DataAppend);
            foreach (var property in source.DynamicProperties)
            {
                result.DynamicProperties[property.Key] = property.Value;
            }
            return result;
        }

        private async Task<JObject> BuildRequestParam()
        {
            var result = new JObject();
            try
            {
                if (Request?.Body != null && (Request.ContentLength ?? 0) > 0)
                {
                    Request.EnableBuffering();
                    Request.Body.Position = 0;
                    using (var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 1024, true))
                    {
                        var body = await reader.ReadToEndAsync();
                        if (!body.DosIsNullOrWhiteSpace())
                        {
                            var bodyObj = JObject.Parse(body);
                            foreach (var prop in bodyObj.Properties())
                            {
                                result[prop.Name] = prop.Value;
                            }
                        }
                    }
                    Request.Body.Position = 0;
                }
                if (Request?.HasFormContentType == true)
                {
                    foreach (var item in Request.Form)
                    {
                        result[item.Key] = item.Value.ToString();
                    }
                }
                if (Request?.Query != null)
                {
                    foreach (var item in Request.Query)
                    {
                        if (result[item.Key] == null)
                        {
                            result[item.Key] = item.Value.ToString();
                        }
                    }
                }
            }
            catch
            {
            }
            return result;
        }

        /// <summary>
        /// 设置默认参数（单个对象）
        /// </summary>
        private async Task<JObject> MergeRequestParam(JObject param)
        {
            var requestParam = await BuildRequestParam();
            if (param == null || !param.HasValues)
            {
                return requestParam;
            }
            foreach (var prop in requestParam.Properties())
            {
                if (param[prop.Name] == null)
                {
                    param[prop.Name] = prop.Value;
                }
            }
            return param;
        }

        private async Task<JObject> DefaultParam(JObject param)
        {
            param = await MergeRequestParam(param);
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (currentTokenDynamic != null)
            {
                SetCurrentUserParam(param, currentTokenDynamic.CurrentUser);
                var tokenOsClient = currentTokenDynamic.OsClient?.ToString();
                if (!tokenOsClient.DosIsNullOrWhiteSpace())
                {
                    param["OsClient"] = tokenOsClient;
                }
            }
            if (param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
            {
                var currentOsClient = DiyToken.GetCurrentOsClient();
                param["OsClient"] = currentOsClient.DosIsNullOrWhiteSpace() ? OsClient.GetConfigOsClient() : currentOsClient;
            }
            param["_InvokeType"] = "Client";
            EnsureLang(param);
            return param;
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
                    SetCurrentUserParam(param, currentTokenDynamic.CurrentUser);
                    param["OsClient"] = currentTokenDynamic?.OsClient;
                    param["_InvokeType"] = "Client";
                    EnsureLang(param);
                }
            }
        }
        /// <summary>
        /// 获取系统设置，必传OsClient
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysConfig([FromBody]DiyTableRowParam param)
        {
            if (param == null)
            {
                var requestParam = await BuildRequestParam();
                param = new DiyTableRowParam
                {
                    OsClient = requestParam["OsClient"].Val<string>(),
                    _Lang = requestParam["_Lang"].Val<string>()
                };
            }
            if (param.OsClient.DosIsNullOrWhiteSpace() && Request?.Query != null)
            {
                param.OsClient = Request.Query["OsClient"].ToString();
            }
            if (param._Lang.DosIsNullOrWhiteSpace())
            {
                param._Lang = GetRequestLang();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            var result = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient, param._Lang);
            return Json(CreatePublicSysConfigResult(result));
        }

        [HttpPost, HttpGet]
        public async Task<JsonResult> SyncLangMetadata([FromBody] JObject param = null)
        {
            var requestedOsClient = param?["OsClient"].Val<string>();
            var requestedSource = param?["Source"].Val<string>();
            var requestedForce = param?["Force"].Val<string>();
            var requestedOnlyFillMissing = param?["OnlyFillMissing"].Val<string>();
            if (requestedSource.DosIsNullOrWhiteSpace() && Request?.HasFormContentType == true)
            {
                requestedSource = Request.Form["Source"].ToString();
            }
            if (requestedSource.DosIsNullOrWhiteSpace() && Request?.Query != null)
            {
                requestedSource = Request.Query["Source"].ToString();
            }
            if (requestedForce.DosIsNullOrWhiteSpace() && Request?.HasFormContentType == true)
            {
                requestedForce = Request.Form["Force"].ToString();
            }
            if (requestedForce.DosIsNullOrWhiteSpace() && Request?.Query != null)
            {
                requestedForce = Request.Query["Force"].ToString();
            }
            if (requestedOnlyFillMissing.DosIsNullOrWhiteSpace() && Request?.HasFormContentType == true)
            {
                requestedOnlyFillMissing = Request.Form["OnlyFillMissing"].ToString();
            }
            if (requestedOnlyFillMissing.DosIsNullOrWhiteSpace() && Request?.Query != null)
            {
                requestedOnlyFillMissing = Request.Query["OnlyFillMissing"].ToString();
            }
            param = await DefaultParam(param);
            if (!requestedOsClient.DosIsNullOrWhiteSpace())
            {
                param["OsClient"] = requestedOsClient;
            }
            if (!requestedSource.DosIsNullOrWhiteSpace())
            {
                param["Source"] = requestedSource;
            }
            if (!requestedForce.DosIsNullOrWhiteSpace())
            {
                param["Force"] = requestedForce;
            }
            if (!requestedOnlyFillMissing.DosIsNullOrWhiteSpace())
            {
                param["OnlyFillMissing"] = requestedOnlyFillMissing;
            }
            var includeRaw = param["IncludeClientText"].Val<string>();
            var includeClientText = includeRaw.DosIsNullOrWhiteSpace()
                || (!string.Equals(includeRaw, "0", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(includeRaw, "false", StringComparison.OrdinalIgnoreCase));
            var waitRaw = param["Wait"].Val<string>();
            var wait = string.Equals(waitRaw, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(waitRaw, "true", StringComparison.OrdinalIgnoreCase);
            var forceRaw = param["Force"].Val<string>();
            var force = string.Equals(forceRaw, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(forceRaw, "true", StringComparison.OrdinalIgnoreCase);
            var onlyFillMissingRaw = param["OnlyFillMissing"].Val<string>();
            var onlyFillMissing = string.Equals(onlyFillMissingRaw, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(onlyFillMissingRaw, "true", StringComparison.OrdinalIgnoreCase);
            var source = param["Source"].Val<string>();
            if (source.DosIsNullOrWhiteSpace())
            {
                source = "api";
            }
            var osClient = param["OsClient"].Val<string>();
            if (force)
            {
                MicroiEngine.FormEngine.ResetDiyLangFullSync(osClient, source);
            }
            var reloadResult = MicroiEngine.FormEngine.ReloadDiyLangRuntimeConfig(osClient);
            if (reloadResult.Code != 1)
            {
                return Json(reloadResult);
            }
            var result = onlyFillMissing
                ? await MicroiEngine.FormEngine.RepairMissingDiyLangTranslationsAsync(osClient, source)
                : wait
                ? await MicroiEngine.FormEngine.SyncDiyLangFullAsync(osClient, includeClientText, source)
                : MicroiEngine.FormEngine.QueueDiyLangFullSync(osClient, includeClientText, source);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetLangBundle([FromBody] JObject param = null)
        {
            param = await MergeRequestParam(param);
            if (param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
            {
                param["OsClient"] = OsClient.GetConfigOsClient();
            }
            EnsureLang(param);
            var prefix = param["Prefix"].Val<string>();
            if (prefix == null)
            {
                prefix = "Msg.";
            }
            var data = DiyMessage.GetLangBundle(param["OsClient"].Val<string>(), param["_Lang"].Val<string>(), prefix);
            return Json(new DosResult(1, data));
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
            param = await DefaultParam(param);
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
            await TrackDetailOpened(param.ToObject<DiyTableRowParam>(), result).ConfigureAwait(false);
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
            EnsureLang(param);
            param["_InvokeType"] = "Client";//JTokenEx.FromObject(InvokeType.Client);
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
            EnsureLang(param);
            param["_InvokeType"] = "Client";//JTokenEx.FromObject(InvokeType.Client);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
        /// 表单数据"批量混合保存"（同一事务内：先按顺序新增 AddList，再按顺序更新 UptList）。
        /// 用于 diy-table 表内编辑【提交一起保存（Submit）】模式：
        /// 入参：
        ///   {
        ///     FormEngineKey: "表名",
        ///     AddList: [ {字段...}, ... ],   // 可选
        ///     UptList: [ {Id, 字段...}, ... ] // 可选
        ///   }
        /// 任一行失败整体回滚，全部成功统一提交。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SaveBatch([FromBody] JObject param)
        {
            if (param == null)
            {
                return Json(new DosResult(0, null, "参数为空"));
            }

            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            var currentUser = currentTokenDynamic?.CurrentUser;
            string osClient = currentTokenDynamic?.OsClient;

            string formEngineKey = param["FormEngineKey"]?.ToString();
            JArray addList = param["AddList"] as JArray;
            JArray uptList = param["UptList"] as JArray;

            if ((addList == null || addList.Count == 0) && (uptList == null || uptList.Count == 0))
            {
                return Json(new DosResult(0, null, "AddList / UptList 均为空，无可保存数据"));
            }

            // 注入身份信息到每行 payload
            void Inject(JObject row)
            {
                if (!string.IsNullOrEmpty(formEngineKey) && row["FormEngineKey"] == null)
                {
                    row["FormEngineKey"] = formEngineKey;
                }
                SetCurrentUserParam(row, currentUser);
                row["OsClient"] = osClient;
                row["_InvokeType"] = "Client";
                EnsureLang(row);
            }

            // 取主库会话开启事务
            var clientModel = OsClientExtend.GetClient(osClient);
            if (clientModel == null || clientModel.Db == null)
            {
                return Json(new DosResult(0, null, "未找到 OsClient 对应的数据库会话"));
            }
            var dbSession = clientModel.Db;

            DbTrans trans = null;
            var addResults = new List<object>();
            var uptResults = new List<object>();
            try
            {
                trans = dbSession.BeginTransaction();

                // 1) 新增（按顺序）
                if (addList != null)
                {
                    for (int i = 0; i < addList.Count; i++)
                    {
                        var row = addList[i] as JObject;
                        if (row == null) continue;
                        Inject(row);
                        var r = await MicroiEngine.FormEngine.AddFormDataAsync(row, trans);
                        if (r == null || r.Code != 1)
                        {
                            try { trans.Rollback(); } catch { }
                            string msg = r?.Msg ?? "新增数据失败";
                            return Json(new DosResult(0, new { FailIndex = i, Stage = "Add", Detail = r }, "第" + (i + 1) + "条新增失败：" + msg));
                        }
                        addResults.Add(r.Data);
                    }
                }

                // 2) 修改（按顺序）
                if (uptList != null)
                {
                    for (int i = 0; i < uptList.Count; i++)
                    {
                        var row = uptList[i] as JObject;
                        if (row == null) continue;
                        Inject(row);
                        var r = await MicroiEngine.FormEngine.UptFormDataAsync(row, trans);
                        if (r == null || r.Code != 1)
                        {
                            try { trans.Rollback(); } catch { }
                            string msg = r?.Msg ?? "修改数据失败";
                            return Json(new DosResult(0, new { FailIndex = i, Stage = "Upt", Detail = r }, "第" + (i + 1) + "条修改失败：" + msg));
                        }
                        uptResults.Add(r.Data);
                    }
                }

                trans.Commit();
                return Json(new DosResult(1, new { AddResults = addResults, UptResults = uptResults }, "保存成功"));
            }
            catch (Exception ex)
            {
                if (trans != null) { try { trans.Rollback(); } catch { } }
                return Json(new DosResult(0, null, "保存失败：" + ex.Message));
            }
            finally
            {
                if (trans != null) { try { trans.Close(); } catch { } }
            }
        }

        /// <summary>
        /// 删除一条数据
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelFormData([FromBody] JObject param)
        {
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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

            param["_InvokeType"] = "Client";//JTokenEx.FromObject(InvokeType.Client);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
            param["_InvokeType"] = "Client";//JTokenEx.FromObject(InvokeType.Client);
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
            param = await DefaultParam(param);
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
            param = await DefaultParam(param);
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
            return await GetSysMenuModel(param);
        }
        /// <summary>
        /// 传入Id或ModuleEngineKey
        /// 获取模块引擎一条数据（菜单）（带缓存）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysMenuModel([FromBody] JObject param)
        {
            param = await DefaultParam(param);
            var idOrKey = param["ModuleEngineKey"].Val<string>();
            if(idOrKey.DosIsNullOrWhiteSpace())
            {
                idOrKey = param["Id"].Val<string>();
            }
            var lang = param["_RawMetadata"].Val<bool>() ? DiyMessage.Lang : param["_Lang"].Val<string>();
            var result = await MicroiEngine.FormEngine.GetSysMenuModel(idOrKey, param["OsClient"].Val<string>(), lang);
            try
            {
                if (result?.Code == 1 && param["_RawMetadata"].Val<bool>() != true && param["_CurrentUser"] is JObject currentUser)
                {
                    // result.Data 是 dynamic；必须先强类型落地，否则 JValue.Val<T>() 会进入运行时动态绑定并抛异常。
                    JObject menu = result.Data == null ? null : JObject.FromObject((object)result.Data);
                    string menuId = menu?.Value<string>("Id") ?? idOrKey;
                    string menuName = menu?.Value<string>("Name") ?? menu?.Value<string>("Title") ?? idOrKey;
                    var tracker = MicroiEngine.TryGetService<UserBehaviorSessionTracker>();
                    var dedupKey = $"menu|{param["OsClient"]}|{currentUser["Id"]}|{menuId}";
                    if (tracker?.ShouldLogOnce(dedupKey, TimeSpan.FromSeconds(3)) != false)
                    {
                        var context = param.ToObject<DiyTableRowParam>();
                        UserBehaviorAudit.Track(context, "Navigation", "MenuVisit", "访问菜单", "Menu", menuId,
                            $"访问菜单[{menuName}]", new { MenuId = menuId, MenuName = menuName }, eventId:
                            UserBehaviorAudit.DeterministicEventId(dedupKey, TimeSpan.FromSeconds(3)));
                    }
                }
            }
            catch (Exception ex)
            {
                // 审计属于旁路能力，任何数据兼容或日志故障都不能破坏菜单主请求。
                Console.WriteLine($"Microi: 菜单访问审计失败，已放行业务响应。{ex.Message}");
            }
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
            return await GetDiyTableModel(param);
        }
        /// <summary>
        /// 传入Id或Name，
        /// 获取一张表（表单属性）（带缓存）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetDiyTableModel([FromBody] JObject param)
        {
            param = await DefaultParam(param);
            var idOrKey = param["Name"].Val<string>();
            if(idOrKey.DosIsNullOrWhiteSpace())
            {
                idOrKey = param["Id"].Val<string>();
            }
            var lang = param["_RawMetadata"].Val<bool>() ? DiyMessage.Lang : param["_Lang"].Val<string>();
            var result = await MicroiEngine.FormEngine.GetDiyTableModel(idOrKey, param["OsClient"].Val<string>(), lang);
            return Json(result);
        }

        #region Helper methods for DiyTable/DiyField param binding

        private static async Task DefaultDiyTableRowParam(DiyTableRowParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
            param._InvokeType = InvokeType.Client.ToString();
        }

        private static async Task DefaultDiyTableParam(DiyTableParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
            param._InvokeType = InvokeType.Client.ToString();
        }

        private static async Task DefaultDiyFieldParam(DiyFieldParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (currentTokenDynamic != null)
            {
                param._CurrentUser = currentTokenDynamic.CurrentUser;
                param.OsClient = currentTokenDynamic.OsClient;
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient(false);
            }
            param._InvokeType = InvokeType.Client.ToString();
        }

        #endregion

        #region DiyTable methods (merged from DiyTableController, backward compat: /api/DiyTable/*)

        /// <summary>
        /// [Compat] 获取系统设置 - backward compat for /api/DiyTable/GetSysConfig
        /// </summary>
        [HttpPost("~/api/DiyTable/GetSysConfig"), HttpGet("~/api/DiyTable/GetSysConfig")]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysConfig_Compat(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            var result = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient);
            return Json(CreatePublicSysConfigResult(result));
        }

        /// <summary>
        /// [Compat] 将非diy表加载为diy表 - backward compat for /api/DiyTable/LoadNotDiyTable
        /// </summary>
        [HttpPost("~/api/DiyTable/LoadNotDiyTable")]
        public async Task<JsonResult> LoadNotDiyTable_Compat(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.LoadNotDiyTableAsync(param);
            return Json(result);
        }

        /// <summary>
        /// [Compat] 获取一张表信息 - backward compat for /api/DiyTable/GetDiyTableModel
        /// </summary>
        [HttpPost("~/api/DiyTable/GetDiyTableModel"), HttpGet("~/api/DiyTable/GetDiyTableModel")]
        public async Task<JsonResult> GetDiyTableModel_Compat(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.GetDiyTableModel(param);
            return Json(result);
        }

        /// <summary>
        /// 获取表列表（原 DiyTableController.GetDiyTable）
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyTable"), HttpGet("~/api/DiyTable/GetDiyTable")]
        public async Task<JsonResult> GetDiyTableList(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            param.IsDeleted = 0;
            var result = await MicroiEngine.FormEngine.GetDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 获取文档树
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/GetDiyDocumentTree"), HttpGet("~/api/DiyTable/GetDiyDocumentTree")]
        public async Task<JsonResult> GetDiyDocumentTree(DiyDocumentParam param)
        {
            param.OsClient = "iTdos";
            param.IsDeleted = 0;
            param.Display = 1;
            var result = await MicroiEngine.FormEngine.GetDiyDocumentTree(param);
            return Json(result);
        }

        /// <summary>
        /// 获取所有非diy表
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetNotDiyTable"), HttpGet("~/api/DiyTable/GetNotDiyTable")]
        public async Task<JsonResult> GetNotDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.GetNotDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 新增一张表
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/AddDiyTable")]
        public async Task<JsonResult> AddDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.AddDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 删除一张表
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DelDiyTable")]
        public async Task<JsonResult> DelDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.DelDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 修改一张表
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/UptDiyTable")]
        public async Task<JsonResult> UptDiyTable(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var result = await MicroiEngine.FormEngine.UptDiyTable(param);
            return Json(result);
        }

        /// <summary>
        /// 生成一个Guid
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/NewGuid"), HttpGet("~/api/DiyTable/NewGuid")]
        public async Task<JsonResult> NewGuid()
        {
            var newGuid = Ulid.NewUlid().ToString();
            return Json(new DosResult(1, newGuid));
        }

        /// <summary>
        /// 批量新增diy数据，带事务。
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/AddDiyTableRowBatch")]
        public async Task<JsonResult> AddDiyTableRowBatch(DiyTableRowParam paramList)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = currentTokenDynamic?.OsClient;
                    await DefaultDiyTableRowParam(param);
                }
                var result = await MicroiEngine.FormEngine.AddFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(currentTokenDynamic?.OsClient, "ParamError", paramList?._Lang)));
        }

        /// <summary>
        /// 新增一条diy数据。
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/AddDiyTableRow")]
        public async Task<JsonResult> AddDiyTableRow(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.AddFormDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 删除diy数据
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DelDiyTableRow")]
        public async Task<JsonResult> DelDiyTableRow(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 批量删除diy数据，带事务
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DelDiyTableRowBatch")]
        public async Task<JsonResult> DelDiyTableRowBatch(DiyTableRowParam paramList)
        {
            var sysUser = await DiyToken.GetCurrentToken();
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = sysUser?.OsClient;
                    await DefaultDiyTableRowParam(param);
                }
                var result = await MicroiEngine.FormEngine.DelFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList.OsClient, "ParamError", paramList._Lang)));
        }

        /// <summary>
        /// 修改diy数据
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/UptDiyTableRow")]
        public async Task<JsonResult> UptDiyTableRow(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 根据条件进行批量修改
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/UptDiyDataListByWhere")]
        public async Task<JsonResult> UptDiyDataListByWhere(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 根据条件进行批量删除
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DelDiyDataListByWhere")]
        public async Task<JsonResult> DelDiyDataListByWhere(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.DelFormDataByWhereAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 批量修改diy数据，带事务。
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/UptDiyTableRowBatch")]
        public async Task<JsonResult> UptDiyTableRowBatch(DiyTableRowParam paramList)
        {
            var sysUser = await DiyToken.GetCurrentToken();
            if (paramList != null && paramList._List != null && paramList._List.Any())
            {
                foreach (var param in paramList._List)
                {
                    param.OsClient = sysUser?.OsClient;
                    await DefaultDiyTableRowParam(param);
                }
                var result = await MicroiEngine.FormEngine.UptFormDataBatchAsync(paramList._List);
                return Json(result);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(paramList?.OsClient, "ParamError", paramList?._Lang)));
        }

        /// <summary>
        /// 匿名获取数据列表
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/GetDiyTableRowAnonymous"), HttpGet("~/api/DiyTable/GetDiyTableRowAnonymous")]
        public async Task<JsonResult> GetDiyTableRowAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 匿名新增数据
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/AddDiyTableRowAnonymous")]
        public async Task<JsonResult> AddDiyTableRowAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await MicroiEngine.FormEngine.AddFormDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 获取diy数据列表
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyTableRow"), HttpGet("~/api/DiyTable/GetDiyTableRow")]
        public async Task<JsonResult> GetDiyTableRow(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 获取diy数据树
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyTableRowTree"), HttpGet("~/api/DiyTable/GetDiyTableRowTree")]
        public async Task<JsonResult> GetDiyTableRowTree(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetTableDataTreeAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 匿名获取一条数据
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/GetDiyTableRowModelAnonymous"), HttpGet("~/api/DiyTable/GetDiyTableRowModelAnonymous")]
        public async Task<JsonResult> GetDiyTableRowModelAnonymous(DiyTableRowParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            param.IsDeleted = 0;
            param._IsAnonymous = true;
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
            return Json(result);
        }

        /// <summary>
        /// 获取一条diy数据
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyTableRowModel"), HttpGet("~/api/DiyTable/GetDiyTableRowModel")]
        public async Task<JsonResult> GetDiyTableRowModel(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(param);
            await TrackDetailOpened(param, result).ConfigureAwait(false);
            return Json(result);
        }

        private async Task TrackDetailOpened(DiyTableRowParam param, DosResult<dynamic> result)
        {
            try
            {
                if (param == null || param._CurrentUser == null || result?.Code != 1 || result.Data == null) return;
                JObject row = JObject.FromObject((object)result.Data);
                string rowId = row.Value<string>("Id")
                    .DosIsNullOrWhiteSpace(param.Id.DosIsNullOrWhiteSpace(param._TableRowId));
                if (rowId.DosIsNullOrWhiteSpace()) return;
                string table = param.FormEngineKey.DosIsNullOrWhiteSpace(param._TableName).DosIsNullOrWhiteSpace("未知表");
                var tracker = MicroiEngine.TryGetService<UserBehaviorSessionTracker>();
                var dedupKey = $"detail|{param.OsClient}|{param._CurrentUser["Id"]}|{table}|{rowId}";
                if (tracker?.ShouldLogOnce(dedupKey, TimeSpan.FromSeconds(2)) == false) return;

                var preview = UserBehaviorAudit.BuildRowPreview(row);
                UserBehaviorAudit.Track(param, "Data", "DetailView", "查看数据", "DataRow", rowId,
                    $"查看表[{table}]的数据[{rowId}]", new { Table = table, RowId = rowId, Preview = preview }, eventId:
                    UserBehaviorAudit.DeterministicEventId(dedupKey, TimeSpan.FromSeconds(2)));
                if (tracker != null)
                {
                    var did = Request?.Headers?["did"].ToString();
                    await tracker.OpenDetailAsync(param.OsClient, param._CurrentUser, table, rowId, row,
                        param._ClientType, did).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                // 详情审计失败只能降级，不能把已经成功查询出的业务数据改成500。
                Console.WriteLine($"Microi: 数据详情审计失败，已放行业务响应。{ex.Message}");
            }
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyFieldSqlData"), HttpGet("~/api/DiyTable/GetDiyFieldSqlData")]
        public async Task<JsonResult> GetDiyFieldSqlData(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetDiyFieldSqlData(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyFieldSqlDataFromBody"), HttpGet("~/api/DiyTable/GetDiyFieldSqlDataFromBody")]
        public async Task<JsonResult> GetDiyFieldSqlDataFromBody([FromBody] DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetDiyFieldSqlData(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetFieldsData"), HttpGet("~/api/DiyTable/GetFieldsData")]
        public async Task<JsonResult> GetFieldsData(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetFieldsData(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetFieldsDataFromBody"), HttpGet("~/api/DiyTable/GetFieldsDataFromBody")]
        public async Task<JsonResult> GetFieldsDataFromBody([FromBody] DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.FormEngine.GetFieldsData(param);
            return Json(result);
        }

        /// <summary>
        /// 获取导入diy数据的进度
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetImportDiyTableRowStep"), HttpGet("~/api/DiyTable/GetImportDiyTableRowStep")]
        public async Task<JsonResult> GetImportDiyTableRowStep(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            if (param.OsClient.DosIsNullOrWhiteSpace() || param.TableId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}";
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
            var importStep = await DiyCacheBase.GetAsync<List<string>>(stepSign);
            if (importStep == null) importStep = new List<string>();
            return Json(new DosResult(1, importStep));
        }

        /// <summary>
        /// 清除导入进度缓存
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DelImportDiyTableRowStep")]
        public async Task<JsonResult> DelImportDiyTableRowStep(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            if (param.OsClient.DosIsNullOrWhiteSpace() || param.TableId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            var startSign = $"Microi:{param.OsClient}:ImportTableDataStart:{param.TableId}";
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}";
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
            await DiyCacheBase.SetAsync(startSign, "0");
            await DiyCacheBase.DeleteAsync(stepSign);
            return Json(new DosResult(1));
        }

        /// <summary>
        /// 导入diy数据
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/ImportDiyTableRow")]
        public async Task<JsonResult> ImportDiyTableRow(DiyTableRowParam param)
        {
            await DefaultDiyTableRowParam(param);
            var result = await MicroiEngine.Office.ImportExcel(param, HttpContext);
            return Json(result);
        }

        /// <summary>
        /// 导出diy数据（FromBody）
        /// </summary>
        [AllowAnonymous]
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/ExportDiyTableRowFromBody"), HttpGet("~/api/DiyTable/ExportDiyTableRowFromBody")]
        public async Task<ActionResult> ExportDiyTableRowFromBody([FromBody] DiyTableRowParam param)
        {
            return await ExportDiyTableRow(param);
        }

        /// <summary>
        /// 导出diy数据列表
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        [HttpPost("~/api/DiyTable/ExportDiyTableRow"), HttpGet("~/api/DiyTable/ExportDiyTableRow")]
        public async Task<ActionResult> ExportDiyTableRow(DiyTableRowParam param)
        {
            if (param.TableId.DosIsNullOrWhiteSpace())
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang) };
            var tokenModelJobj = await DiyToken.GetCurrentToken(param.authorization, param.OsClient);
            if (tokenModelJobj != null)
            {
                param.OsClient = tokenModelJobj.OsClient;
                param._CurrentUser = tokenModelJobj.CurrentUser;
            }
            else
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang) };
            }
            param.IsDeleted = 0;
            DbSession dbSessionStart = OsClient.GetClient(param.OsClient).Db;
            var diyTableModelStart = dbSessionStart.From<DiyTable>()
                                        .Select(new DiyTable().GetFields())
                                        .Where(d => d.Id == param.TableId)
                                        .First();
            if (diyTableModelStart == null)
                return new ContentResult() { Content = "不存在的diy_table数据，TableId：" + (param.TableId ?? "") };
            var result = await MicroiEngine.Office.ExportExcelAsync(param);
            if (result.Code != 1) return new ContentResult() { Content = result.Msg };
            return File(result.Data, "application/vnd.ms-excel", "导出"
                    + (diyTableModelStart.Description.DosIsNullOrWhiteSpace()
                        ? diyTableModelStart.Name.Replace("diy_", "")
                        : diyTableModelStart.Description)
                    + " - "
                    + DateTime.Now.ToString("yyyyMMddHHmmss") + ".xls");
        }

        /// <summary>
        /// 获取表的索引列表（仅管理员）
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetTableIndexes"), HttpGet("~/api/DiyTable/GetTableIndexes")]
        public async Task<JsonResult> GetTableIndexes(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "TableName不能为空"));
            var osClient = OsClient.GetClient(param.OsClient);
            var dbService = MicroiEngine.ORM(DiyCommon.GetDbInfo(osClient.OsClientModel["DbType"].Val<string>()).DbType);
            var result = dbService.GetTableIndexes(new DbServiceParam
            {
                TableName = param.TableName,
                DbSession = osClient.Db,
                OsClient = param.OsClient
            });
            return Json(result);
        }

        /// <summary>
        /// 创建索引（仅管理员）
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/AddTableIndex")]
        public async Task<JsonResult> AddTableIndex(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace() || param.IndexColumns.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "参数不完整"));
            var osClient = OsClient.GetClient(param.OsClient);
            var dbService = MicroiEngine.ORM(DiyCommon.GetDbInfo(osClient.OsClientModel["DbType"].Val<string>()).DbType);
            var result = dbService.AddIndex(new DbServiceParam
            {
                TableName = param.TableName,
                IndexName = param.IndexName,
                IndexColumns = param.IndexColumns,
                IndexUnique = param.IndexUnique == true,
                DbSession = osClient.Db,
                OsClient = param.OsClient
            });
            return Json(result);
        }

        /// <summary>
        /// 删除索引（仅管理员）
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DropTableIndex")]
        public async Task<JsonResult> DropTableIndex(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "参数不完整"));
            var osClient = OsClient.GetClient(param.OsClient);
            var dbService = MicroiEngine.ORM(DiyCommon.GetDbInfo(osClient.OsClientModel["DbType"].Val<string>()).DbType);
            var result = dbService.DropIndex(new DbServiceParam
            {
                TableName = param.TableName,
                IndexName = param.IndexName,
                DbSession = osClient.Db,
                OsClient = param.OsClient
            });
            return Json(result);
        }

        /// <summary>
        /// 根据模块配置自动生成索引（可搜索字段、可排序字段、默认排序字段、统计列等）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> AutoGenerateIndexes(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param._SysMenuId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "_SysMenuId不能为空"));

            var osClient = OsClient.GetClient(param.OsClient);
            var db = osClient.Db;
            var dbService = MicroiEngine.ORM(DiyCommon.GetDbInfo(osClient.OsClientModel["DbType"].Val<string>()).DbType);

            // 1. 查询sys_menu模块配置
            var sysMenu = db.From<SysMenu>()
                .Where(SysMenu._.Id == param._SysMenuId)
                .First();
            if (sysMenu == null)
                return Json(new DosResult(0, null, "未找到对应模块"));
            if (sysMenu.DiyTableId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "该模块未绑定自定义表"));

            // 2. 查询diy_table获取表名
            var diyTable = db.From<DiyTable>()
                .Where(DiyTable._.Id == sysMenu.DiyTableId)
                .Select(DiyTable._.Id, DiyTable._.Name)
                .First();
            if (diyTable == null || diyTable.Name.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "未找到对应的自定义表"));

            var tableName = diyTable.Name;

            // 3. 查询该表所有字段，建立Id→Name的映射
            var fieldList = db.From<DiyField>()
                .Where(DiyField._.TableId == sysMenu.DiyTableId && DiyField._.IsDeleted == 0)
                .Select(DiyField._.Id, DiyField._.Name)
                .ToList();
            var fieldIdToName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (fieldList != null)
            {
                foreach (var f in fieldList)
                {
                    if (!f.Name.DosIsNullOrWhiteSpace() && !fieldIdToName.ContainsKey(f.Id))
                        fieldIdToName[f.Id] = f.Name;
                }
            }

            // 4. 收集需要建索引的字段名（按优先级分组）
            // 优先级：默认排序 > 搜索字段 > 排序字段 > 统计字段 > CreateTime
            var orderByColumns = new List<string>();   // 最高优先级：常用于ORDER BY
            var searchColumns = new List<string>();    // 高优先级：WHERE条件
            var sortColumns = new List<string>();      // 中优先级：可排序列
            var statColumns = new List<string>();      // 低优先级：统计列
            var allColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 4.1 SearchFieldIds：可搜索字段 [{Id, Name, Label, TableName, ...}]
            if (!sysMenu.SearchFieldIds.DosIsNullOrWhiteSpace() && sysMenu.SearchFieldIds != "[]")
            {
                try
                {
                    var searchFields = JsonHelper.Deserialize<List<SearchFieldIdsModel>>(sysMenu.SearchFieldIds);
                    if (searchFields != null)
                    {
                        foreach (var sf in searchFields)
                        {
                            // 只处理本表字段（TableId匹配或TableName匹配）
                            if (!sf.Name.DosIsNullOrWhiteSpace() &&
                                (sf.TableId.DosIsNullOrWhiteSpace() || sf.TableId == sysMenu.DiyTableId ||
                                 (!sf.TableName.DosIsNullOrWhiteSpace() && sf.TableName.Equals(tableName, StringComparison.OrdinalIgnoreCase))))
                            {
                                if (allColumns.Add(sf.Name))
                                    searchColumns.Add(sf.Name);
                            }
                        }
                    }
                }
                catch { }
            }

            // 4.2 SortFieldIds：可排序字段 [fieldId1, fieldId2, ...] 或系统字段名
            if (!sysMenu.SortFieldIds.DosIsNullOrWhiteSpace() && sysMenu.SortFieldIds != "[]")
            {
                try
                {
                    var sortFieldIds = JsonHelper.Deserialize<List<string>>(sysMenu.SortFieldIds);
                    if (sortFieldIds != null)
                    {
                        foreach (var sfId in sortFieldIds)
                        {
                            if (sfId.DosIsNullOrWhiteSpace()) continue;
                            // 优先从字段映射中查找，找不到则当作字段名（如CreateTime, UpdateTime）
                            string colName;
                            if (fieldIdToName.TryGetValue(sfId, out var fieldName))
                                colName = fieldName;
                            else
                                colName = sfId;
                            if (allColumns.Add(colName))
                                sortColumns.Add(colName);
                        }
                    }
                }
                catch { }
            }

            // 4.3 DefaultOrderBy：默认排序 [{Id, Name, Type, Sort}]
            if (!sysMenu.DefaultOrderBy.DosIsNullOrWhiteSpace() && sysMenu.DefaultOrderBy != "[]")
            {
                try
                {
                    var defaultOrderBy = JsonHelper.Deserialize<List<SysMenuDefaultOrderBy>>(sysMenu.DefaultOrderBy);
                    if (defaultOrderBy != null)
                    {
                        foreach (var ob in defaultOrderBy)
                        {
                            string colName = null;
                            if (!ob.Name.DosIsNullOrWhiteSpace())
                                colName = ob.Name;
                            else if (!ob.Id.DosIsNullOrWhiteSpace())
                            {
                                if (fieldIdToName.TryGetValue(ob.Id, out var fieldName))
                                    colName = fieldName;
                                else
                                    colName = ob.Id;
                            }
                            if (colName != null && allColumns.Add(colName))
                                orderByColumns.Add(colName);
                        }
                    }
                }
                catch { }
            }

            // 4.4 StatisticsFields：统计列 [{Id, Type}]
            if (!sysMenu.StatisticsFields.DosIsNullOrWhiteSpace() && sysMenu.StatisticsFields != "[]")
            {
                try
                {
                    var statFields = JsonHelper.Deserialize<List<IdType>>(sysMenu.StatisticsFields);
                    if (statFields != null)
                    {
                        foreach (var sf in statFields)
                        {
                            if (!sf.Id.DosIsNullOrWhiteSpace() && fieldIdToName.TryGetValue(sf.Id, out var fieldName))
                            {
                                if (allColumns.Add(fieldName))
                                    statColumns.Add(fieldName);
                            }
                        }
                    }
                }
                catch { }
            }

            // 4.5 始终加上 CreateTime 基础字段（低优先级）
            if (allColumns.Add("CreateTime"))
                statColumns.Add("CreateTime");

            // 排除 Id（已有主键索引）
            allColumns.Remove("Id");
            orderByColumns.Remove("Id");
            searchColumns.Remove("Id");
            sortColumns.Remove("Id");
            statColumns.Remove("Id");

            // 5. 按优先级合并并限制总数（最多8个索引，避免写入性能下降）
            const int maxIndexes = 8;
            var indexColumns = new List<string>();
            // 优先级：默认排序 > 搜索字段 > 排序字段 > 统计字段
            foreach (var col in orderByColumns)
            {
                if (indexColumns.Count >= maxIndexes) break;
                indexColumns.Add(col);
            }
            foreach (var col in searchColumns)
            {
                if (indexColumns.Count >= maxIndexes) break;
                if (!indexColumns.Contains(col, StringComparer.OrdinalIgnoreCase))
                    indexColumns.Add(col);
            }
            foreach (var col in sortColumns)
            {
                if (indexColumns.Count >= maxIndexes) break;
                if (!indexColumns.Contains(col, StringComparer.OrdinalIgnoreCase))
                    indexColumns.Add(col);
            }
            foreach (var col in statColumns)
            {
                if (indexColumns.Count >= maxIndexes) break;
                if (!indexColumns.Contains(col, StringComparer.OrdinalIgnoreCase))
                    indexColumns.Add(col);
            }

            var totalRequested = allColumns.Count;
            var truncated = totalRequested > maxIndexes;

            if (indexColumns.Count == 0)
                return Json(new DosResult(0, null, "未找到需要建索引的字段"));

            // 6. 获取已有索引，提取已有索引覆盖的列名
            var existingResult = dbService.GetTableIndexes(new DbServiceParam
            {
                TableName = tableName,
                DbSession = osClient.Db,
                OsClient = param.OsClient
            });
            var existingIndexColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (existingResult?.Code == 1 && existingResult.Data != null)
            {
                try
                {
                    var existingList = JArray.FromObject(existingResult.Data);
                    foreach (var idx in existingList)
                    {
                        var colName = idx["Column_name"]?.ToString();
                        if (!colName.DosIsNullOrWhiteSpace())
                            existingIndexColumns.Add(colName);
                    }
                }
                catch { }
            }

            // 7. 逐个创建缺失的索引（跳过已有的，捕获异常优雅处理）
            var created = new List<string>();
            var skipped = new List<string>();
            var failed = new List<string>();
            foreach (var col in indexColumns)
            {
                if (existingIndexColumns.Contains(col))
                {
                    skipped.Add(col);
                    continue;
                }
                var idxName = $"idx_{tableName}_{col}".ToLower();
                try
                {
                    var addResult = dbService.AddIndex(new DbServiceParam
                    {
                        TableName = tableName,
                        IndexName = idxName,
                        IndexColumns = col,
                        IndexUnique = false,
                        DbSession = osClient.Db,
                        OsClient = param.OsClient
                    });
                    if (addResult?.Code == 1)
                        created.Add(col);
                    else
                        failed.Add($"{col}: {addResult?.Msg}");
                }
                catch (Exception ex)
                {
                    // 可能是索引已存在（名称不同但列相同）等情况，优雅跳过
                    failed.Add($"{col}: {ex.Message}");
                }
            }

            var msg = $"新建 {created.Count} 个索引";
            if (skipped.Count > 0) msg += $"，跳过 {skipped.Count} 个已有索引";
            if (failed.Count > 0) msg += $"，失败 {failed.Count} 个";
            if (truncated) msg += $"（共 {totalRequested} 个字段需要索引，已按优先级选取前 {maxIndexes} 个，建议减少可搜索字段数量）";

            return Json(new DosResult(1, new { Created = created, Skipped = skipped, Failed = failed, Truncated = truncated, TotalRequested = totalRequested }, msg));
        }

        #endregion

        #region DiyField methods (merged from DiyFieldController, backward compat: /api/DiyField/*)

        /// <summary>
        /// 新增一个字段
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyField/AddDiyField")]
        public async Task<JsonResult> AddDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.AddDiyField(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/AddDiyFieldFromBody")]
        public async Task<JsonResult> AddDiyFieldFromBody([FromBody] JObject body)
        {
            body = await DefaultParam(body ?? new JObject());
            var result = await MicroiEngine.FormEngine.AddDiyField(body);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetExceptionFieldList"), HttpGet("~/api/DiyField/GetExceptionFieldList")]
        public async Task<JsonResult> GetExceptionFieldList(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.GetExceptionFieldList(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/AddDbField")]
        public async Task<JsonResult> AddDbField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.AddDbField(param);
            return Json(result);
        }

        /// <summary>
        /// 删除一个字段
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyField/DelDiyField")]
        public async Task<JsonResult> DelDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.DelDiyField(param);
            return Json(result);
        }

        /// <summary>
        /// 修改一个字段
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyField/UptDiyField")]
        public async Task<JsonResult> UptDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.UptDiyField(param);
            return Json(result);
        }

        /// <summary>
        /// 批量修改字段
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyField/UptDiyFieldList")]
        public async Task<JsonResult> UptDiyFieldList(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.UptDiyFieldList(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/UptDiyFieldListFromBody")]
        public async Task<JsonResult> UptDiyFieldListFromBody([FromBody] DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.UptDiyFieldList(param);
            return Json(result);
        }

        /// <summary>
        /// 获取一个字段信息
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDiyFieldModel"), HttpGet("~/api/DiyField/GetDiyFieldModel")]
        public async Task<JsonResult> GetDiyFieldModel(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.GetDiyFieldModel(param);
            return Json(result);
        }

        /// <summary>
        /// 获取一张表字段列表
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDiyField"), HttpGet("~/api/DiyField/GetDiyField")]
        public async Task<JsonResult> GetDiyField(DiyFieldParam param)
        {
            return await GetDiyFieldList(param);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDiyFieldList"), HttpGet("~/api/DiyField/GetDiyFieldList")]
        public async Task<JsonResult> GetDiyFieldList(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            param.IsDeleted = 0;
            var result = await MicroiEngine.FormEngine.GetDiyFieldList(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDeletedDiyField"), HttpGet("~/api/DiyField/GetDeletedDiyField")]
        public async Task<JsonResult> GetDeletedDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            param.IsDeleted = 1;
            var result = await MicroiEngine.FormEngine.GetDiyFieldList(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/RecoverDiyField")]
        public async Task<JsonResult> RecoverDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.RecoverDiyField(param);
            return Json(result);
        }

        /// <summary>
        /// 获取多张表的字段列表
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDiyFieldByDiyTables"), HttpGet("~/api/DiyField/GetDiyFieldByDiyTables")]
        public async Task<JsonResult> GetDiyFieldByDiyTables(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            param.IsDeleted = 0;
            var result = await MicroiEngine.FormEngine.GetDiyFieldByDiyTables(param);
            return Json(result);
        }

        #endregion
    }
}
