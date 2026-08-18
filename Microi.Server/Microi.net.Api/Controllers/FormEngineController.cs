using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
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

        private static DosResult<dynamic> CreatePublicSysConfigResult(DosResult<dynamic> source, string osClient)
        {
            if (source == null) return null;

            var publicProjection = source.Data == null
                ? null
                : TenantConfigurationSecurity.CreatePublicSysConfigProjection(source.Data, osClient);
            var configuredLoginPublicKey = ConfigHelper.GetRuntimeConfigurationValue(
                "Security:LoginRsaPublicKey");
            if (publicProjection != null && !configuredLoginPublicKey.DosIsNullOrWhiteSpace())
            {
                // 公钥不是凭据，可以由匿名登录配置接口返回，以确保客户端公钥
                // 与当前部署的私钥成对。未配置时客户端继续使用历史兼容公钥。
                publicProjection["LoginRsaPublicKey"] = configuredLoginPublicKey
                    .Replace("\\n", "\n")
                    .Trim();
            }

            var result = new DosResult<dynamic>(
                source.Code,
                publicProjection,
                source.Msg,
                source.DataAppend);
            foreach (var property in source.DynamicProperties)
            {
                result.DynamicProperties[property.Key] = property.Value;
            }
            return result;
        }

        private static bool IsSysOsClientsDetailRequest(JObject param)
        {
            var key = param?["FormEngineKey"].Val<string>()
                      .DosIsNullOrWhiteSpace(param?["_TableName"].Val<string>())
                      .DosIsNullOrWhiteSpace(param?["TableName"].Val<string>());
            return string.Equals(
                (key ?? string.Empty).Trim().Replace('-', '_'),
                "sys_osclients",
                StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 主租户 9999 级管理员编辑 SaaS 引擎时，显示子租户实际继承生效的共享基础设施值。
        /// 投影发生在 FormEngine/V8 DataFilter 完成之后，因此秘密不会进入 V8；继承字段同时
        /// 写入 NotSaveField，避免普通表单提交把主租户值复制到子租户数据库行。
        /// </summary>
        private static DosResult<dynamic> ApplyControlPlaneSharedInfrastructureProjection(
            JObject param,
            DosResult<dynamic> result)
        {
            if (result?.Code != 1
                || result.Data == null
                || !IsSysOsClientsDetailRequest(param)
                || (param?["_CurrentUser"]?["Level"].Val<int>() ?? 0) < DiyCommon.MaxRoleLevel)
            {
                return result;
            }

            var configOsClient = OsClient.GetConfigOsClient();
            if (!string.Equals(param?["OsClient"].Val<string>(), configOsClient, StringComparison.OrdinalIgnoreCase))
            {
                return result;
            }

            JObject storedModel;
            try
            {
                storedModel = result.Data as JObject ?? JObject.FromObject(result.Data);
            }
            catch
            {
                return result;
            }

            var targetOsClient = storedModel["OsClient"].Val<string>();
            if (targetOsClient.DosIsNullOrWhiteSpace()) return result;

            JObject projection;
            IReadOnlyCollection<string> inheritedFields;
            try
            {
                // 子租户继承的共享基础设施以主租户运行模型为事实源。这里绝不能调用
                // GetClient(targetOsClient)：SaaS 列表可以包含尚未在当前节点加载的租户，
                // 强行初始化目标租户数据库会让一个只读详情请求变成 500。
                var controlPlaneRuntimeModel = OsClient.GetClient(configOsClient)?.OsClientModel;
                projection = TenantConfigurationSecurity.CreateControlPlaneSharedInfrastructureProjection(
                    storedModel,
                    controlPlaneRuntimeModel,
                    out inheritedFields);
            }
            catch
            {
                // 运行投影只负责补充显示，失败时保留 FormEngine 已成功读取的原始详情，
                // 不能让可选的控制面展示逻辑破坏 SaaS 引擎详情页。
                return result;
            }
            if (inheritedFields.Count == 0) return result;

            JObject dataAppend;
            try
            {
                dataAppend = result.DataAppend as JObject
                             ?? (result.DataAppend == null ? new JObject() : JObject.FromObject(result.DataAppend));
            }
            catch
            {
                dataAppend = new JObject();
            }

            var notSaveFields = dataAppend["NotSaveField"] as JArray ?? new JArray();
            foreach (var field in inheritedFields)
            {
                if (!notSaveFields.Any(item => string.Equals(item.Val<string>(), field, StringComparison.OrdinalIgnoreCase)))
                {
                    notSaveFields.Add(field);
                }
            }
            dataAppend["NotSaveField"] = notSaveFields;
            dataAppend["InheritedSharedInfrastructureFields"] = new JArray(inheritedFields);
            dataAppend["SharedInfrastructureValueSource"] = "MainTenantRuntime";
            result.Data = projection;
            result.DataAppend = dataAppend;
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
            param["_IsAnonymous"] = false;
            EnsureLang(param);
            return param;
        }

        /// <summary>
        /// 设置默认参数（批量对象）
        /// </summary>
        private async Task DefaultParamList(List<JObject> paramList)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            foreach (var param in paramList)
            {
                if (currentTokenDynamic != null)
                {
                    SetCurrentUserParam(param, currentTokenDynamic.CurrentUser);
                    param["OsClient"] = currentTokenDynamic?.OsClient;
                }
                param["_InvokeType"] = "Client";
                param["_IsAnonymous"] = false;
                EnsureLang(param);
            }
        }
        /// <summary>
        /// 获取系统设置，必传OsClient
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysConfig(
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] DiyTableRowParam param = null)
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
            return Json(CreatePublicSysConfigResult(result, param.OsClient));
        }

        /// <summary>
        /// 获取登录页可用壁纸。该匿名接口只公开已启用壁纸的展示字段，
        /// 避免为了登录页开放通用 FormEngine 匿名表查询权限。
        /// </summary>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetLoginWallpapers(
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] JObject param = null)
        {
            param = await MergeRequestParam(param);
            var osClient = param["OsClient"].Val<string>();
            var lang = param["_Lang"].Val<string>();
            if (lang.DosIsNullOrWhiteSpace()) lang = GetRequestLang();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError", lang)));
            }

            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(osClient, lang);
            if (sysConfigResult == null)
            {
                return Json(new DosResult(0, null, "无效的租户标识。"));
            }
            if (sysConfigResult.Code != 1)
            {
                return Json(sysConfigResult);
            }

            try
            {
                var rows = OsClient.GetClient(osClient).DbRead
                    .FromSql(@"SELECT Id, Name, Category, ImgUrl
                               FROM diy_wallpaper
                               WHERE IsEnable = 1 AND (IsDeleted <> 1 OR IsDeleted IS NULL)")
                    .ToArray();
                return Json(new DosResult(1, rows.Take(200).ToArray()));
            }
            catch
            {
                // 兼容尚未创建壁纸表的旧安装：登录页继续使用 SysConfig.LoginBgImg。
                return Json(new DosResult(0, null, "读取登录壁纸失败，已使用系统默认登录背景。"));
            }
        }

        [HttpPost, HttpGet]
        [PlatformAdminOnly]
        public async Task<JsonResult> SyncLangMetadata([FromBody] JObject param = null)
        {
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
            var queuedResult = DiyLangBackgroundTaskService.QueueManualSync(
                param["_CurrentUser"] as JObject,
                osClient,
                includeClientText,
                source,
                force,
                onlyFillMissing);
            if (!wait || queuedResult.Code != 1)
            {
                return Json(queuedResult);
            }
            var queuedData = queuedResult.Data == null
                ? new JObject()
                : JObject.FromObject(queuedResult.Data);
            return Json(await DiyLangBackgroundTaskService.WaitForCompletionAsync(
                osClient,
                queuedData["TaskId"]?.ToString(),
                TimeSpan.FromSeconds(30),
                HttpContext.RequestAborted));
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
            if (TryGetInvalidRecordIdField(param, out var invalidField))
            {
                return InvalidRecordIdResult(invalidField);
            }
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
            result = ApplyControlPlaneSharedInfrastructureProjection(param, result);
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
            param ??= new JObject();
            EnsureLang(param);
            if (TryGetInvalidRecordIdField(param, out var invalidField))
            {
                return InvalidRecordIdResult(invalidField);
            }
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
            param ??= new JObject();
            if (TryGetInvalidRecordIdField(param, out var invalidField))
            {
                return InvalidRecordIdResult(invalidField);
            }
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
                row["_IsAnonymous"] = false;
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

        private JsonResult InvalidRecordIdResult(string field)
        {
            return Json(new DosResult(0, null, $"参数错误：{field} 必须是字符串或数字。[GetFormData]", 0, new
            {
                ReasonCode = "InvalidRecordId",
                Field = field
            }));
        }

        private static bool TryGetInvalidRecordIdField(JObject param, out string field)
        {
            field = null;
            if (param == null) return false;

            foreach (var candidate in new[] { "Id", "_TableRowId" })
            {
                var token = param[candidate];
                if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                {
                    continue;
                }
                if (token.Type != JTokenType.String
                    && token.Type != JTokenType.Integer
                    && token.Type != JTokenType.Float)
                {
                    field = candidate;
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// 获取表单详情的关联系统数据（数据日志、数据评论、数据版本）。
        ///
        /// 这些数据不能按 microi_datalog / diy_comment / mic_data_version
        /// 的独立表权限直接开放，否则普通用户可能枚举其它业务表的日志或版本。
        /// 本接口先校验调用者对父菜单、父表和父记录的读取权限，再由服务端
        /// 固定辅助表及筛选条件执行查询。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GetFormRelatedData([FromBody] JObject param)
        {
            param = await DefaultParam(param ?? new JObject());

            var osClient = param["OsClient"].Val<string>();
            var lang = param["_Lang"].Val<string>();
            var relatedType = param["RelatedType"].Val<string>()?.Trim();
            var parentFormEngineKey = param["ParentFormEngineKey"].Val<string>()?.Trim();
            var parentTableRowId = param["ParentTableRowId"].Val<string>()?.Trim();
            var sysMenuId = param["_SysMenuId"].Val<string>()?.Trim();
            if (parentFormEngineKey.DosIsNullOrWhiteSpace()
                || parentTableRowId.DosIsNullOrWhiteSpace()
                || sysMenuId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError", lang)));
            }

            var parentParam = new DiyTableRowParam
            {
                FormEngineKey = parentFormEngineKey,
                Id = parentTableRowId,
                _SysMenuId = sysMenuId,
                _InvokeType = InvokeType.Client.ToString(),
                _IsAnonymous = false,
                _CurrentUser = param["_CurrentUser"] as JObject,
                OsClient = osClient,
                _Lang = lang
            };
            var authResult = await MicroiEngine.FormEngine
                .AuthorizeClientTableOperationAsync(parentParam, "Read");
            if (authResult == null || authResult.Code != 1)
            {
                return Json(authResult
                    ?? new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", lang)));
            }

            var relatedParam = new JObject
            {
                ["OsClient"] = osClient,
                ["_Lang"] = lang,
                ["_InvokeType"] = InvokeType.Server.ToString(),
                ["_IsAnonymous"] = false,
                ["IsDeleted"] = 0,
                ["_PageIndex"] = 1,
                ["_PageSize"] = 200,
                ["_OrderBy"] = "CreateTime",
                ["_OrderByType"] = "DESC"
            };
            if (param["_CurrentUser"] != null)
            {
                relatedParam["_CurrentUser"] = param["_CurrentUser"].DeepClone();
            }

            if (string.Equals(relatedType, "Counts", StringComparison.OrdinalIgnoreCase))
            {
                JObject BuildCountParam(string formEngineKey, JArray conditions)
                {
                    var countParam = (JObject)relatedParam.DeepClone();
                    countParam["FormEngineKey"] = formEngineKey;
                    countParam["_Where"] = conditions;
                    countParam["_PageSize"] = 1;
                    return countParam;
                }

                var dataLogTask = MicroiEngine.FormEngine.GetTableDataCountAsync(BuildCountParam(
                    "microi_datalog",
                    new JArray
                    {
                        new JArray("DataId", "=", parentTableRowId),
                        new JArray("TableId", "=", parentParam.TableId)
                    }));
                var dataCommentTask = MicroiEngine.FormEngine.GetTableDataCountAsync(BuildCountParam(
                    "diy_comment",
                    new JArray { new JArray("TableRowId", "=", parentTableRowId) }));
                var dataVersionTask = MicroiEngine.FormEngine.GetTableDataCountAsync(BuildCountParam(
                    "mic_data_version",
                    new JArray
                    {
                        new JArray("TableRowId", "=", parentTableRowId),
                        new JArray("TableId", "=", parentParam.TableId)
                    }));

                await Task.WhenAll(dataLogTask, dataCommentTask, dataVersionTask);
                if (dataLogTask.Result.Code != 1) return Json(dataLogTask.Result);
                if (dataCommentTask.Result.Code != 1) return Json(dataCommentTask.Result);
                if (dataVersionTask.Result.Code != 1) return Json(dataVersionTask.Result);

                return Json(new DosResult(1, new
                {
                    DataLog = dataLogTask.Result.DataCount,
                    DataComment = dataCommentTask.Result.DataCount,
                    DataVersion = dataVersionTask.Result.DataCount
                }));
            }

            var where = new JArray();
            switch (relatedType?.ToLowerInvariant())
            {
                case "datalog":
                    relatedParam["FormEngineKey"] = "microi_datalog";
                    where.Add(new JArray("DataId", "=", parentTableRowId));
                    where.Add(new JArray("TableId", "=", parentParam.TableId));
                    break;
                case "datacomment":
                    relatedParam["FormEngineKey"] = "diy_comment";
                    where.Add(new JArray("TableRowId", "=", parentTableRowId));
                    break;
                case "dataversion":
                    relatedParam["FormEngineKey"] = "mic_data_version";
                    where.Add(new JArray("TableRowId", "=", parentTableRowId));
                    where.Add(new JArray("TableId", "=", parentParam.TableId));
                    break;
                default:
                    return Json(new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError", lang)));
            }

            relatedParam["_Where"] = where;
            var result = await MicroiEngine.FormEngine.GetTableDataAsync(relatedParam);
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
        [PlatformAdminOnly]
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
            var currentLevel = (param["_CurrentUser"] as JObject)?["Level"].Val<int>() ?? 0;
            if (currentLevel < DiyCommon.MaxRoleLevel)
            {
                param["_RawMetadata"] = false;
            }
            var menuAuthorization = await MicroiEngine.FormEngine
                .AuthorizeClientMenuMetadataOperationAsync(new DiyTableRowParam
                {
                    _SysMenuId = param["ModuleEngineKey"].Val<string>().DosIsNullOrWhiteSpace()
                        ? param["Id"].Val<string>()
                        : null,
                    ModuleEngineKey = param["ModuleEngineKey"].Val<string>(),
                    _InvokeType = InvokeType.Client.ToString(),
                    _CurrentUser = param["_CurrentUser"] as JObject,
                    OsClient = param["OsClient"].Val<string>(),
                    _Lang = param["_Lang"].Val<string>(),
                    _TableChildAuth = param["_TableChildAuth"]?.ToObject<TableChildAuthorizationContext>()
                });
            if (menuAuthorization.Code != 1)
            {
                return Json(menuAuthorization);
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
                MicroiEngine.QueueSystemLog(param?["OsClient"]?.ToString(), "Audit", "MenuVisitAuditFailed", "菜单访问审计失败，已放行业务响应", ex.ToString(), 2, false, idOrKey);
            }
            return Json(result);
        }
        /// <summary>
        /// 获取当前已授权菜单对应的左右结构页面配置。
        /// 普通用户不能通过通用 FormEngine 直接读取 diy_LeftJoinRightView，
        /// 因此由服务端校验精确菜单权限后，仅返回与该菜单关联的一条配置。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GetLeftRightPageConfig([FromBody] JObject param)
        {
            param = await DefaultParam(param);
            var menuId = param["SysMenuId"].Val<string>();
            if (menuId.DosIsNullOrWhiteSpace())
            {
                menuId = param["Id"].Val<string>();
            }
            if (menuId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null,
                    DiyMessage.GetLang(param["OsClient"].Val<string>(), "ParamError", param["_Lang"].Val<string>())));
            }

            var menuAuthorization = await MicroiEngine.FormEngine
                .AuthorizeClientMenuMetadataOperationAsync(new DiyTableRowParam
                {
                    _SysMenuId = menuId,
                    _InvokeType = InvokeType.Client.ToString(),
                    _CurrentUser = param["_CurrentUser"] as JObject,
                    OsClient = param["OsClient"].Val<string>(),
                    _Lang = param["_Lang"].Val<string>()
                });
            if (menuAuthorization.Code != 1)
            {
                return Json(menuAuthorization);
            }

            var query = new DiyTableRowParam
            {
                FormEngineKey = "diy_LeftJoinRightView",
                OsClient = param["OsClient"].Val<string>(),
                _Lang = param["_Lang"].Val<string>(),
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _Where = new List<DiyWhere>
                {
                    new DiyWhere
                    {
                        Name = "GuanlianCD",
                        Value = menuId,
                        Type = "Like"
                    }
                }
            };
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(query);
            if (result?.Code == 1 && result.Data != null)
            {
                var config = JObject.FromObject((object)result.Data);
                var linkedMenuIds = config["GuanlianCD"]?.Val<string>();
                var isExactMenuMatch = false;
                if (!linkedMenuIds.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        isExactMenuMatch = JArray.Parse(linkedMenuIds)
                            .Values<string>()
                            .Any(id => string.Equals(id, menuId, StringComparison.OrdinalIgnoreCase));
                    }
                    catch
                    {
                        isExactMenuMatch = false;
                    }
                }
                if (!isExactMenuMatch)
                {
                    return Json(new DosResult(0, null,
                        DiyMessage.GetLang(param["OsClient"].Val<string>(), "NoAuth", param["_Lang"].Val<string>())));
                }

                // A left-tree/right-table page is another projection of a
                // configured TableChild relation. Return only the relation for
                // this already-authorized menu so the client can reuse the same
                // add/import defaults as the embedded TableChild control.
                var parentTableName = config["GuanlianBD"].Val<string>();
                var configuredParentField = config["FubiaoGLZD"].Val<string>();
                var configuredChildField = config["ZibiaoGLZD"].Val<string>();
                if (!parentTableName.DosIsNullOrWhiteSpace())
                {
                    var db = OsClient.GetClient(param["OsClient"].Val<string>()).Db;
                    var rightMenu = db.From<SysMenu>()
                        .Where(d => d.Id == menuId && d.IsDeleted == 0)
                        .First();
                    var parentTable = db.From<DiyTable>()
                        .Where(d => d.Name == parentTableName && d.IsDeleted == 0)
                        .First();
                    if (rightMenu != null && parentTable != null)
                    {
                        DiyFieldConfig matchedConfig = null;
                        var matchedConfigScore = 0;
                        var relationFields = db.From<DiyField>()
                            .Where(d => d.TableId == parentTable.Id
                                && d.Component == "TableChild"
                                && d.IsDeleted == 0)
                            .ToList();
                        foreach (var relationField in relationFields)
                        {
                            DiyFieldConfig candidate;
                            try
                            {
                                candidate = JsonHelper.Deserialize<DiyFieldConfig>(relationField.Config ?? "");
                            }
                            catch
                            {
                                continue;
                            }
                            if (candidate == null) continue;
                            var menuMatches = string.Equals(
                                candidate.TableChildSysMenuId,
                                menuId,
                                StringComparison.OrdinalIgnoreCase);
                            var tableMatches = !rightMenu.DiyTableId.DosIsNullOrWhiteSpace()
                                && string.Equals(
                                    candidate.TableChildTableId,
                                    rightMenu.DiyTableId,
                                    StringComparison.OrdinalIgnoreCase);
                            var fkMatches = configuredChildField.DosIsNullOrWhiteSpace()
                                || string.Equals(
                                    candidate.TableChildFkFieldName,
                                    configuredChildField,
                                    StringComparison.OrdinalIgnoreCase);
                            var candidateScore = menuMatches ? 2 : tableMatches ? 1 : 0;
                            if (candidateScore > matchedConfigScore && fkMatches)
                            {
                                matchedConfig = candidate;
                                matchedConfigScore = candidateScore;
                            }
                        }

                        if (matchedConfig != null)
                        {
                            var parentFieldName = matchedConfig.TableChild?.PrimaryTableFieldName;
                            if (parentFieldName.DosIsNullOrWhiteSpace())
                            {
                                parentFieldName = configuredParentField.DosIsNullOrWhiteSpace()
                                    ? "Id"
                                    : configuredParentField;
                            }
                            var childFieldName = matchedConfig.TableChildFkFieldName
                                .DosIsNullOrWhiteSpace(configuredChildField);
                            var relations = DiyTableChildFieldRelationHelper.GetRelations(matchedConfig);
                            config["TableChildRelation"] = new JObject
                            {
                                ["ParentTableId"] = parentTable.Id,
                                ["ChildTableId"] = matchedConfig.TableChildTableId,
                                ["ParentFieldName"] = parentFieldName,
                                ["ChildFieldName"] = childFieldName,
                                ["TableChildConfig"] = new JObject
                                {
                                    ["PrimaryTableFieldName"] = parentFieldName,
                                    ["ImportAutoFillFk"] = matchedConfig.TableChild?.ImportAutoFillFk != false,
                                    ["FieldRelations"] = DiyTableChildFieldRelationHelper.ToCompactArray(relations)
                                }
                            };
                        }
                    }
                }
                result.Data = config;
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
            var currentLevel = (param["_CurrentUser"] as JObject)?["Level"].Val<int>() ?? 0;
            if (currentLevel < DiyCommon.MaxRoleLevel)
            {
                // Raw metadata is a design-time capability. A normal renderer must
                // never use a client flag to opt into unfiltered platform metadata.
                param["_RawMetadata"] = false;
            }

            var metadataParam = param.ToObject<DiyTableRowParam>();
            metadataParam.FormEngineKey = idOrKey;
            var metadataAuth = await MicroiEngine.FormEngine
                .AuthorizeClientTableMetadataOperationAsync(metadataParam);
            if (metadataAuth.Code != 1)
            {
                return Json(metadataAuth);
            }

            var lang = param["_RawMetadata"].Val<bool>() ? DiyMessage.Lang : param["_Lang"].Val<string>();
            var result = await MicroiEngine.FormEngine.GetDiyTableModel(idOrKey, param["OsClient"].Val<string>(), lang);
            if (result?.Code == 1
                && currentLevel < DiyCommon.MaxRoleLevel
                && result.Data != null)
            {
                var clientMetadata = JObject.FromObject((object)result.Data);
                clientMetadata.Remove("ServerDataV8");
                clientMetadata.Remove("SubmitBeforeServerV8");
                clientMetadata.Remove("SubmitAfterServerV8");
                result.Data = clientMetadata;
            }
            return Json(result);
        }

        #region Helper methods for DiyTable/DiyField param binding

        private static async Task DefaultDiyTableRowParam(DiyTableRowParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
            param._InvokeType = InvokeType.Client.ToString();
            // Authenticated endpoints must not trust a payload-supplied anonymous flag.
            // Dedicated anonymous endpoints set it explicitly after model binding.
            param._IsAnonymous = false;
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

        private static DiyTableRowParam CreateDiyFieldMetadataAuthorizationParam(
            DiyFieldParam param,
            string tableIdOrName)
        {
            return new DiyTableRowParam
            {
                FormEngineKey = tableIdOrName,
                _SysMenuId = !param._SysMenuId.DosIsNullOrWhiteSpace()
                    ? param._SysMenuId
                    : param.SysMenuId,
                ModuleEngineKey = param._ModuleEngineKey,
                _InvokeType = InvokeType.Client.ToString(),
                _CurrentUser = param._CurrentUser,
                OsClient = param.OsClient,
                _Lang = param._Lang,
                _TableChildAuth = param._TableChildAuth
            };
        }

        private static async Task<DosResult> AuthorizeDiyFieldMetadataTableAsync(
            DiyFieldParam param,
            string tableIdOrName,
            DiyTableRowParam authorizationParam = null)
        {
            if (tableIdOrName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            authorizationParam = authorizationParam
                ?? CreateDiyFieldMetadataAuthorizationParam(param, tableIdOrName);
            authorizationParam.FormEngineKey = tableIdOrName;
            authorizationParam.TableId = null;
            authorizationParam.TableName = null;
            authorizationParam._AuthorizationPolicy = null;
            return await MicroiEngine.FormEngine.AuthorizeClientTableMetadataOperationAsync(
                authorizationParam);
        }

        /// <summary>
        /// Authorize a single-table field metadata request. Field definitions can
        /// contain executable V8 and SQL data-source configuration, so knowing a
        /// field/table id is never sufficient authorization.
        /// </summary>
        private static async Task<DosResult> AuthorizeDiyFieldMetadataAsync(DiyFieldParam param)
        {
            var tableIdOrName = !param.TableId.DosIsNullOrWhiteSpace()
                ? param.TableId
                : param.TableName;
            return await AuthorizeDiyFieldMetadataTableAsync(param, tableIdOrName);
        }

        /// <summary>
        /// Authorize a multi-table field metadata request. When a real menu context
        /// is supplied, discard all caller-selected table ids and replace them with
        /// the exact subset of sys_menu tables whose metadata this user may read.
        /// A JoinTable can be required by trusted server-side SqlJoin/SqlWhere while
        /// its complete field definition remains protected from the browser.
        /// </summary>
        private static async Task<DosResult> AuthorizeDiyFieldTablesMetadataAsync(DiyFieldParam param)
        {
            // Reuse one authorization parameter for the entire batch. The first
            // table authorization loads the versioned tenant/user snapshot; later
            // tables reuse it instead of repeating permission-table/cache work.
            var sharedAuthorizationParam =
                CreateDiyFieldMetadataAuthorizationParam(param, string.Empty);
            var menuIdOrKey = !param._SysMenuId.DosIsNullOrWhiteSpace()
                ? param._SysMenuId
                : (!param.SysMenuId.DosIsNullOrWhiteSpace()
                    ? param.SysMenuId
                    : param._ModuleEngineKey);
            if (!menuIdOrKey.DosIsNullOrWhiteSpace())
            {
                var menuResult = await MicroiEngine.FormEngine.GetSysMenu(
                    menuIdOrKey,
                    param.OsClient,
                    param._Lang);
                if (menuResult == null || menuResult.Code != 1 || menuResult.Data == null)
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang));
                }

                var menuModel = JObject.FromObject((object)menuResult.Data);
                var menuId = menuModel["Id"].Val<string>();
                var primaryTableId = menuModel["DiyTableId"].Val<string>();
                if (menuId.DosIsNullOrWhiteSpace() || primaryTableId.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang));
                }

                param._SysMenuId = menuId;
                param.SysMenuId = menuId;
                var trustedTableIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    primaryTableId
                };
                var joinTablesToken = menuModel["JoinTables"];
                if (joinTablesToken != null && joinTablesToken.Type != JTokenType.Null)
                {
                    try
                    {
                        if (joinTablesToken.Type == JTokenType.String)
                        {
                            var rawJoinTables = joinTablesToken.Val<string>();
                            joinTablesToken = rawJoinTables.DosIsNullOrWhiteSpace()
                                ? new JArray()
                                : JToken.Parse(rawJoinTables);
                        }
                        if (!(joinTablesToken is JArray joinTables))
                        {
                            return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang));
                        }
                        foreach (var joinTable in joinTables)
                        {
                            var joinTableId = joinTable["Id"].Val<string>();
                            if (joinTableId.DosIsNullOrWhiteSpace())
                            {
                                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang));
                            }
                            trustedTableIds.Add(joinTableId);
                        }
                    }
                    catch
                    {
                        return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang));
                    }
                }

                // The primary table is mandatory: owning the menu must authorize
                // the table rendered by that menu.
                var primaryAuthorization = await AuthorizeDiyFieldMetadataTableAsync(
                    param,
                    primaryTableId,
                    sharedAuthorizationParam);
                if (primaryAuthorization.Code != 1)
                {
                    return primaryAuthorization;
                }

                // Join-table metadata is optional. In particular, menus commonly
                // join Sys_User only to apply trusted row-level SqlWhere rules. A
                // protected or role-restricted join must not expose all of its
                // fields, but it must not make the authorized primary table
                // unusable either.
                var authorizedTableIds = new HashSet<string>(
                    StringComparer.OrdinalIgnoreCase)
                {
                    primaryTableId
                };
                foreach (var trustedTableId in trustedTableIds)
                {
                    if (trustedTableId.Equals(
                        primaryTableId,
                        StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var joinAuthorization = await AuthorizeDiyFieldMetadataTableAsync(
                        param,
                        trustedTableId,
                        sharedAuthorizationParam);
                    if (joinAuthorization.Code == 1)
                    {
                        authorizedTableIds.Add(trustedTableId);
                    }
                }

                // Prevent an authorized menu id from being combined with arbitrary
                // caller-selected table ids. Clear the menu expansion context after
                // authorization so GetDiyFieldByDiyTables cannot add a denied join
                // table back into this already-sanitized list.
                param.TableIds = authorizedTableIds.ToList();
                param.TableNames = new List<string>();
                param.SysMenuId = string.Empty;
                param._SysMenuId = string.Empty;
                param._ModuleEngineKey = string.Empty;
                return new DosResult(1);
            }

            var requestedTables = new List<(string Key, bool IsTableId)>();
            var requestedTableKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (param.TableIds != null)
            {
                foreach (var tableId in param.TableIds)
                {
                    if (!tableId.DosIsNullOrWhiteSpace()
                        && requestedTableKeys.Add(tableId))
                    {
                        requestedTables.Add((tableId, true));
                    }
                }
            }
            if (param.TableNames != null)
            {
                foreach (var tableName in param.TableNames)
                {
                    if (!tableName.DosIsNullOrWhiteSpace()
                        && requestedTableKeys.Add(tableName))
                    {
                        requestedTables.Add((tableName, false));
                    }
                }
            }

            // Preserve the legacy empty-result behavior; no metadata is returned.
            if (requestedTables.Count == 0)
            {
                return new DosResult(1);
            }

            // Legacy PC/UniApp renderers sent [primary table, ...JoinTables]
            // without a menu id. The primary table is the authorization anchor and
            // remains mandatory. Secondary tables are best-effort: an unauthorized
            // or protected JoinTable is omitted instead of making the already
            // authorized business form unusable. This keeps old deployments
            // compatible without allowing arbitrary or protected-table metadata.
            var anchorAuthorization = await AuthorizeDiyFieldMetadataTableAsync(
                param,
                requestedTables[0].Key,
                sharedAuthorizationParam);
            if (anchorAuthorization.Code != 1)
            {
                return anchorAuthorization;
            }

            var legacyAuthorizedTableIds = new List<string>();
            var legacyAuthorizedTableNames = new List<string>();
            if (requestedTables[0].IsTableId)
            {
                legacyAuthorizedTableIds.Add(requestedTables[0].Key);
            }
            else
            {
                legacyAuthorizedTableNames.Add(requestedTables[0].Key);
            }

            foreach (var requestedTable in requestedTables.Skip(1))
            {
                var authorization = await AuthorizeDiyFieldMetadataTableAsync(
                    param,
                    requestedTable.Key,
                    sharedAuthorizationParam);
                if (authorization.Code == 1)
                {
                    if (requestedTable.IsTableId)
                    {
                        legacyAuthorizedTableIds.Add(requestedTable.Key);
                    }
                    else
                    {
                        legacyAuthorizedTableNames.Add(requestedTable.Key);
                    }
                }
            }

            // The core method must only receive the authorized subset. In
            // particular, a caller cannot append sys_apiengine/Sys_User/etc. to an
            // allowed primary table and obtain their field definitions.
            param.TableIds = legacyAuthorizedTableIds;
            param.TableNames = legacyAuthorizedTableNames;
            return new DosResult(1);
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
            return Json(CreatePublicSysConfigResult(result, param.OsClient));
        }

        /// <summary>
        /// [Compat] 将非diy表加载为diy表 - backward compat for /api/DiyTable/LoadNotDiyTable
        /// </summary>
        [HttpPost("~/api/DiyTable/LoadNotDiyTable")]
        [PlatformAdminOnly]
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
            var metadataParam = JObject.FromObject(param).ToObject<DiyTableRowParam>();
            metadataParam.FormEngineKey = !param.Id.DosIsNullOrWhiteSpace()
                ? param.Id
                : (!param.Name.DosIsNullOrWhiteSpace() ? param.Name : param.TableName);
            var metadataAuth = await MicroiEngine.FormEngine
                .AuthorizeClientTableMetadataOperationAsync(metadataParam);
            if (metadataAuth.Code != 1)
            {
                return Json(metadataAuth);
            }

            if ((param._CurrentUser?["Level"].Val<int>() ?? 0) < DiyCommon.MaxRoleLevel)
            {
                param._RawMetadata = false;
            }
            var result = await MicroiEngine.FormEngine.GetDiyTableModel(param);
            if (result?.Code == 1
                && (param._CurrentUser?["Level"].Val<int>() ?? 0) < DiyCommon.MaxRoleLevel
                && result.Data != null)
            {
                var clientMetadata = JObject.FromObject((object)result.Data);
                clientMetadata.Remove("ServerDataV8");
                clientMetadata.Remove("SubmitBeforeServerV8");
                clientMetadata.Remove("SubmitAfterServerV8");
                result.Data = clientMetadata;
            }
            return Json(result);
        }

        /// <summary>
        /// 获取表列表（原 DiyTableController.GetDiyTable）
        /// </summary>
        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyTable/GetDiyTable"), HttpGet("~/api/DiyTable/GetDiyTable")]
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
            param._InvokeType = InvokeType.Client.ToString();
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
            param._InvokeType = InvokeType.Client.ToString();
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
            param._InvokeType = InvokeType.Client.ToString();
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
                MicroiEngine.QueueSystemLog(param?.OsClient, "Audit", "DetailViewAuditFailed", "数据详情审计失败，已放行业务响应", ex.ToString(), 2, false, param?.Id);
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
            var authResult = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Import");
            if (authResult.Code != 1)
                return Json(authResult);
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}:{param._SysMenuId}";
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
            var authResult = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Import");
            if (authResult.Code != 1)
                return Json(authResult);
            if ((param._CurrentUser?["Level"].Val<int>() ?? 0) < DiyCommon.MaxRoleLevel)
                return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang)));
            var startSign = $"Microi:{param.OsClient}:ImportTableDataStart:{param.TableId}";
            var stepSign = $"Microi:{param.OsClient}:ImportTableDataStep:{param.TableId}:{param._SysMenuId}";
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
            var importAuth = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Import");
            if (importAuth.Code != 1)
                return Json(importAuth);
            var addAuth = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Add");
            if (addAuth.Code != 1)
                return Json(addAuth);
            var editAuth = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Edit");
            if (editAuth.Code != 1)
                return Json(editAuth);
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
                param._InvokeType = InvokeType.Client.ToString();
                param._IsAnonymous = false;
            }
            else
            {
                return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang) };
            }
            if (!UserAccessKeySecurity.IsTableOperationAllowed(
                    param._CurrentUser,
                    param.TableId,
                    true,
                    true))
            {
                return new ContentResult
                {
                    Content = "当前访问密钥未授权导出此表。",
                    ContentType = "text/plain; charset=utf-8"
                };
            }
            param.IsDeleted = 0;
            var exportAuth = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "Export");
            if (exportAuth.Code != 1)
                return new ContentResult() { Content = exportAuth.Msg };
            var readAuth = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(param, "List");
            if (readAuth.Code != 1)
                return new ContentResult() { Content = readAuth.Msg };
            if ((param.ExcelSheets != null && param.ExcelSheets.Any())
                || (param.Sheets != null && param.Sheets.Any())
                || param.ExcelData != null
                || param.ExcelHeader != null
                || param.ExcelLayout != null)
            {
                return new ContentResult()
                {
                    Content = "客户端表格导出接口不接受自定义ExcelData、ExcelSheets或ExcelLayout；请使用当前菜单的标准数据导出。"
                };
            }
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
        [PlatformAdminOnly]
        public async Task<JsonResult> GetTableIndexes(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "TableName不能为空"));
            var result = V8McpLogic.GetTableIndexes(param.OsClient, param.TableName);
            return Json(result);
        }

        /// <summary>
        /// 创建索引（仅管理员）
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/AddTableIndex")]
        [PlatformAdminOnly]
        public async Task<JsonResult> AddTableIndex(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace() || param.IndexColumns.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "参数不完整"));
            var result = V8McpLogic.CreateTableIndex(
                param.OsClient,
                param.TableName,
                param.IndexName,
                param.IndexColumns.Split(','),
                param.IndexUnique == true);
            return Json(result);
        }

        /// <summary>
        /// 删除索引（仅管理员）
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyTable/DropTableIndex")]
        [PlatformAdminOnly]
        public async Task<JsonResult> DropTableIndex(DiyTableParam param)
        {
            await DefaultDiyTableParam(param);
            var sysUser = await DiyToken.GetCurrentToken();
            if (sysUser.CurrentUser?["_IsAdmin"]?.Value<bool>() != true)
                return Json(new DosResult(0, null, "无权限"));
            if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "参数不完整"));
            var result = V8McpLogic.DropTableIndex(param.OsClient, param.TableName, param.IndexName);
            return Json(result);
        }

        /// <summary>
        /// 根据模块配置自动生成索引（可搜索字段、可排序字段、默认排序字段、统计列等）
        /// </summary>
        [HttpPost]
        [PlatformAdminOnly]
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

            // 5. 生成少量、租户优先的组合索引建议。
            // 不再把 StatisticsFields/所有排序字段机械转换成单列索引；低选择性字段单列索引通常无效，
            // 且会带来明显写放大。第一个搜索条件与默认排序合成一个最左前缀索引。
            const int maxIndexes = 6;
            var indexSpecs = new List<List<string>>();
            var primaryOrderColumn = orderByColumns.FirstOrDefault()
                ?? sortColumns.FirstOrDefault()
                ?? "CreateTime";
            if (searchColumns.Count > 0)
            {
                var first = new List<string> { "OsClient", searchColumns[0] };
                if (!primaryOrderColumn.DosIsNullOrWhiteSpace()
                    && !first.Contains(primaryOrderColumn, StringComparer.OrdinalIgnoreCase))
                {
                    first.Add(primaryOrderColumn);
                }
                indexSpecs.Add(first);

                foreach (var column in searchColumns.Skip(1))
                {
                    if (indexSpecs.Count >= maxIndexes) break;
                    indexSpecs.Add(new List<string> { "OsClient", column });
                }
            }
            else if (!primaryOrderColumn.DosIsNullOrWhiteSpace())
            {
                indexSpecs.Add(new List<string> { "OsClient", primaryOrderColumn });
            }

            var totalRequested = indexSpecs.Count;
            var truncated = searchColumns.Count + (primaryOrderColumn.DosIsNullOrWhiteSpace() ? 0 : 1) > maxIndexes;
            if (indexSpecs.Count == 0)
                return Json(new DosResult(0, null, "未找到需要建索引的字段"));

            // 6. 通过公共索引服务逐个幂等创建；公共服务负责真实字段校验、等价索引识别与回读。
            var created = new List<string>();
            var skipped = new List<string>();
            var failed = new List<string>();
            foreach (var columns in indexSpecs)
            {
                var displayColumns = string.Join(",", columns);
                try
                {
                    var addResult = V8McpLogic.CreateTableIndex(
                        param.OsClient, tableName, null, columns, false);
                    if (addResult?.Code == 1)
                    {
                        var data = addResult.Data is JObject objectData
                            ? objectData
                            : addResult.Data == null ? null : JObject.FromObject(addResult.Data);
                        if (data?["Skipped"].Val<bool?>() == true)
                            skipped.Add(displayColumns);
                        else
                            created.Add(displayColumns);
                    }
                    else
                        failed.Add($"{displayColumns}: {addResult?.Msg}");
                }
                catch (Exception ex)
                {
                    failed.Add($"{displayColumns}: {ex.Message}");
                }
            }

            var msg = $"新建 {created.Count} 个索引";
            if (skipped.Count > 0) msg += $"，跳过 {skipped.Count} 个已有索引";
            if (failed.Count > 0) msg += $"，失败 {failed.Count} 个";
            if (truncated) msg += $"（候选条件较多，已按优先级限制为 {maxIndexes} 个组合索引）";
            msg += "。自动结果只覆盖模块常见列表查询，复杂 JOIN/范围/幂等约束仍需按真实 SQL 通过 MCP 显式建模";

            return Json(new DosResult(1, new { Created = created, Skipped = skipped, Failed = failed, Truncated = truncated, TotalRequested = totalRequested }, msg));
        }

        #endregion

        #region DiyField methods (merged from DiyFieldController, backward compat: /api/DiyField/*)

        /// <summary>
        /// 新增一个字段
        /// </summary>
        [HttpPost]
        [HttpPost("~/api/DiyField/AddDiyField")]
        [PlatformAdminOnly]
        public async Task<JsonResult> AddDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.AddDiyField(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/AddDiyFieldFromBody")]
        [PlatformAdminOnly]
        public async Task<JsonResult> AddDiyFieldFromBody([FromBody] JObject body)
        {
            body = await DefaultParam(body ?? new JObject());
            var result = await MicroiEngine.FormEngine.AddDiyField(body);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetExceptionFieldList"), HttpGet("~/api/DiyField/GetExceptionFieldList")]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetExceptionFieldList(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.GetExceptionFieldList(param);
            return Json(result);
        }

        [HttpPost("~/api/DiyField/RepairFixedDiyFieldMetadata")]
        [PlatformAdminOnly]
        public async Task<JsonResult> RepairFixedDiyFieldMetadata(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            if (!(MicroiEngine.FormEngine is FormEngine formEngine))
            {
                return Json(new DosResult<object>(0, null, "当前表单引擎不支持固定审计字段修复。"));
            }
            var result = await formEngine.EnsureFixedDiyFieldMetadataAsync(
                param.OsClient,
                param.TableId,
                param.TableName);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/AddDbField")]
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
        public async Task<JsonResult> UptDiyFieldList(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            var result = await MicroiEngine.FormEngine.UptDiyFieldList(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/UptDiyFieldListFromBody")]
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
            var authorization = await AuthorizeDiyFieldMetadataAsync(param);
            if (authorization.Code != 1)
            {
                return Json(authorization);
            }
            param.IsDeleted = 0;
            var result = await MicroiEngine.FormEngine.GetDiyFieldList(param);
            return Json(result);
        }

        [HttpPost, HttpGet]
        [HttpPost("~/api/DiyField/GetDeletedDiyField"), HttpGet("~/api/DiyField/GetDeletedDiyField")]
        [PlatformAdminOnly]
        public async Task<JsonResult> GetDeletedDiyField(DiyFieldParam param)
        {
            await DefaultDiyFieldParam(param);
            param.IsDeleted = 1;
            var result = await MicroiEngine.FormEngine.GetDiyFieldList(param);
            return Json(result);
        }

        [HttpPost]
        [HttpPost("~/api/DiyField/RecoverDiyField")]
        [PlatformAdminOnly]
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
            var authorization = await AuthorizeDiyFieldTablesMetadataAsync(param);
            if (authorization.Code != 1)
            {
                return Json(authorization);
            }
            param.IsDeleted = 0;
            var result = await MicroiEngine.FormEngine.GetDiyFieldByDiyTables(param);
            return Json(result);
        }

        #endregion
    }
}
