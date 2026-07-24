using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [EnableCors("any")]
    //[ApiController]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class WorkFlowController : Controller
    {
        private static WorkFlowLogic _workFlowLogic = new WorkFlowLogic();
        private static async Task DefaultParam(WFParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
            param._InvokeType = InvokeType.Client.ToString();
        }

        [HttpPost]
        [PlatformAdminOnly]
        public async Task<JsonResult> SaveWFFlowDesign(WFParam param)
        {
            await DefaultParam(param);
            var result = await _workFlowLogic.SaveWFFlowDesign(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetWFHistory(WFParam param)
        {
            await DefaultParam(param);
            var result = await _workFlowLogic.GetWFHistory(param);
            return Json(result);
        }

        /// <summary>
        /// 撤回工作
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> RecallWork(WFParam param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.WFEngine.RecallWork(param);
            return Json(result);
        }

        /// <summary>
        /// 作废工作
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> CancelFlow(WFParam param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.WFEngine.CancelFlow(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> HandOverWork(WFParam param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.WFEngine.HandOverWork(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetWFNodeModel(WFParam param)
        {
            await DefaultParam(param);
            var result = await _workFlowLogic.GetWFNodeModel(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetStartWFNode(WFParam param)
        {
            await DefaultParam(param);
            //LineValue必须由条件判断V8执行获得、或者由后端传入 --by Anderson 2023-06-25
            param.LineValue = "";
            var result = await MicroiEngine.WFEngine.GetStartWFNode(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> StartWork(WFParam param)
        {
            await DefaultParam(param);
            //LineValue必须由条件判断V8执行获得、或者由后端传入 --by Anderson 2023-06-25
            param.LineValue = "";
            var result = await MicroiEngine.WFEngine.StartWork(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> SendWork(WFParam param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.WFEngine.SendWork(param);
            return Json(result);
        }

        /// <summary>
        /// 表单保存 + 启动工作流（单事务）。
        /// 入参：JObject 含 Wf（WFParam字段）和 Form（FormEngine.AddFormData/UptFormData 同款 payload）
        /// 必传：Form.FormEngineKey、Form._FormSubmitAction（"Add"|"Edit"）
        /// 行为：单一 DbTrans 内先保存表单（触发后端V8 SubmitBefore/AfterServerV8），再调 WFEngine.StartWork；
        /// 任一步失败整体回滚。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> StartWorkWithForm([FromBody] JObject param)
        {
            return await SaveFormAndRunWf(param, isStart: true);
        }

        /// <summary>
        /// 表单保存 + 发送工作流（单事务）。同 StartWorkWithForm，对应 SendWork。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SendWorkWithForm([FromBody] JObject param)
        {
            return await SaveFormAndRunWf(param, isStart: false);
        }

        private async Task<JsonResult> SaveFormAndRunWf(JObject? param, bool isStart)
        {
            var totalSw = Stopwatch.StartNew();
            var stageTimings = new List<Dictionary<string, object>>();
            var lastElapsedMs = 0L;
            string formEngineKey = null;
            string tableRowId = null;

            void MarkStage(string stage)
            {
                var elapsedMs = totalSw.ElapsedMilliseconds;
                stageTimings.Add(new Dictionary<string, object>
                {
                    { "Stage", stage },
                    { "ElapsedMs", elapsedMs },
                    { "CostMs", elapsedMs - lastElapsedMs }
                });
                lastElapsedMs = elapsedMs;
            }

            JsonResult TimedJson(DosResult result)
            {
                AppendMergedSubmitTimings(result, stageTimings, totalSw, isStart, formEngineKey, tableRowId);
                return Json(result);
            }

            if (param == null)
            {
                MarkStage("validate-param");
                return TimedJson(new DosResult(0, null, "参数为空"));
            }

            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            var currentUser = currentTokenDynamic?.CurrentUser;
            string osClient = currentTokenDynamic?.OsClient;
            MarkStage("get-token");

            JObject formPayload = param["Form"] as JObject;
            JObject wfJson = param["Wf"] as JObject;
            if (formPayload == null)
            {
                MarkStage("parse-payload");
                return TimedJson(new DosResult(0, null, "Form 参数为空"));
            }
            if (wfJson == null)
            {
                MarkStage("parse-payload");
                return TimedJson(new DosResult(0, null, "Wf 参数为空"));
            }
            formEngineKey = formPayload["FormEngineKey"]?.Val<string>();
            tableRowId = formPayload["Id"]?.Val<string>();
            MarkStage("parse-payload");

            string formAction = formPayload["_FormSubmitAction"]?.ToString();
            if (string.IsNullOrEmpty(formAction))
            {
                // 兼容：若不传 _FormSubmitAction，按是否有 Id 判定
                formAction = string.IsNullOrEmpty(formPayload["Id"]?.ToString()) ? "Add" : "Edit";
            }
            if (isStart
                && !string.Equals(formAction, "Add", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(formAction, "Insert", StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrEmpty(formPayload["_NoLineForAdd"]?.ToString()))
            {
                formPayload["_NoLineForAdd"] = true;
            }

            // 注入身份信息到表单 payload
            formPayload["_CurrentUser"] = JTokenEx.FromObject(currentUser);
            formPayload["OsClient"] = osClient;
            formPayload["_InvokeType"] = "Client";
            formPayload["_IsAnonymous"] = false;
            var mergedSubmitAction = isStart ? "StartWorkWithForm" : "SendWorkWithForm";
            formPayload["_MergedSubmitAction"] = mergedSubmitAction;
            if (formPayload["_FormData"] is JObject formDataPayload)
            {
                formDataPayload["_MergedSubmitAction"] = mergedSubmitAction;
            }
            MarkStage("prepare-form");

            // 反序列化 WFParam
            WFParam wfParam;
            try
            {
                wfParam = wfJson.ToObject<WFParam>();
            }
            catch (Exception ex)
            {
                MarkStage("deserialize-wf");
                return TimedJson(new DosResult(0, null, "Wf 参数反序列化失败：" + ex.Message));
            }
            wfParam._CurrentUser = currentUser;
            wfParam.OsClient = osClient;
            wfParam._InvokeType = InvokeType.Client.ToString();
            wfParam.LineValue = ""; // 与 StartWork/SendWork 保持一致
            MarkStage("deserialize-wf");

            // 取主库会话开启事务
            var clientModel = OsClientExtend.GetClient(osClient);
            if (clientModel == null || clientModel.Db == null)
            {
                MarkStage("resolve-db");
                return TimedJson(new DosResult(0, null, "未找到 OsClient 对应的数据库会话"));
            }
            var dbSession = clientModel.Db;
            MarkStage("resolve-db");

            DbTrans trans = null;
            try
            {
                trans = dbSession.BeginTransaction();
                MarkStage("begin-transaction");

                // 1) 保存表单（触发 SubmitBeforeServerV8 / SubmitAfterServerV8，事件中 V8.DbTrans 即此 trans）
                DosResult formResult;
                if (string.Equals(formAction, "Add", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(formAction, "Insert", StringComparison.OrdinalIgnoreCase))
                {
                    formResult = await MicroiEngine.FormEngine.AddFormDataAsync(formPayload, trans);
                }
                else
                {
                    formResult = await MicroiEngine.FormEngine.UptFormDataAsync(formPayload, trans);
                }
                MarkStage("save-form");

                if (formResult == null || formResult.Code != 1)
                {
                    try { trans.Rollback(); } catch (Exception rollbackEx) { Console.WriteLine("Microi：【警告】工作流合并提交保存表单失败后回滚异常：" + rollbackEx.Message); }
                    MarkStage("rollback-form-failed");
                    return TimedJson(formResult ?? new DosResult(0, null, "保存表单失败"));
                }

                // 2) 同步保存后的主键到 WFParam.TableRowId
                string savedId = null;
                if (formResult.Data != null)
                {
                    try
                    {
                        // Data 可能为 string Id 或者含 Id 的 object
                        var dataToken = JToken.FromObject(formResult.Data);
                        if (dataToken.Type == JTokenType.String)
                            savedId = dataToken.Val<string>();
                        else if (dataToken is JObject dataObj && dataObj["Id"] != null)
                            savedId = dataObj["Id"].Val<string>();
                    }
                    catch (Exception savedIdEx)
                    {
                        Console.WriteLine("Microi：【警告】工作流合并提交解析表单保存主键失败：" + savedIdEx.Message);
                    }
                }
                if (string.IsNullOrEmpty(savedId))
                {
                    savedId = formPayload["Id"]?.Val<string>();
                }
                tableRowId = savedId ?? tableRowId;
                if (!string.IsNullOrEmpty(savedId) && string.IsNullOrEmpty(wfParam.TableRowId))
                {
                    wfParam.TableRowId = savedId;
                }

                // 若调用方未带 FormData，则用最终的表单数据序列化补上（工作流可能用到）
                if (string.IsNullOrEmpty(wfParam.FormData))
                {
                    wfParam.FormData = formPayload.ToString(Formatting.None);
                }
                MarkStage("prepare-workflow");

                // 3) 启动 / 发送 工作流（共享事务）
                DosResult wfResult;
                if (isStart)
                {
                    wfResult = await MicroiEngine.WFEngine.StartWork(wfParam, trans);
                }
                else
                {
                    wfResult = await MicroiEngine.WFEngine.SendWork(wfParam, trans);
                }
                MarkStage(isStart ? "start-workflow" : "send-workflow");

                if (wfResult == null || wfResult.Code != 1)
                {
                    try { trans.Rollback(); } catch (Exception rollbackEx) { Console.WriteLine("Microi：【警告】工作流合并提交流程执行失败后回滚异常：" + rollbackEx.Message); }
                    MarkStage("rollback-workflow-failed");
                    return TimedJson(wfResult ?? new DosResult(0, null, isStart ? "启动工作流失败" : "发送工作流失败"));
                }

                trans.Commit();
                MarkStage("commit");

                // 把表单结果一起返回，前端可继续后续处理
                var dataAppendDict = wfResult.DataAppend as IDictionary<string, object>;
                if (dataAppendDict == null)
                {
                    dataAppendDict = new Dictionary<string, object>();
                    wfResult.DataAppend = dataAppendDict;
                }
                dataAppendDict["FormSaveResult"] = formResult;
                dataAppendDict["FormSavedId"] = savedId;
                MarkStage("append-result");

                return TimedJson(wfResult);
            }
            catch (Exception ex)
            {
                if (trans != null)
                {
                    try { trans.Rollback(); } catch (Exception rollbackEx) { Console.WriteLine("Microi：【警告】工作流合并提交异常后回滚失败：" + rollbackEx.Message); }
                }
                MarkStage("rollback-exception");
                return TimedJson(new DosResult(0, null, "事务执行失败：" + ex.Message));
            }
            finally
            {
                if (trans != null)
                {
                    try { trans.Close(); } catch (Exception closeEx) { Console.WriteLine("Microi：【警告】工作流合并提交事务关闭失败：" + closeEx.Message); }
                }
            }
        }

        private static void AppendMergedSubmitTimings(DosResult result, List<Dictionary<string, object>> stageTimings, Stopwatch totalSw, bool isStart, string formEngineKey, string tableRowId)
        {
            if (totalSw.IsRunning)
            {
                totalSw.Stop();
            }

            var timingData = new Dictionary<string, object>
            {
                { "Action", isStart ? "StartWorkWithForm" : "SendWorkWithForm" },
                { "TotalMs", totalSw.ElapsedMilliseconds },
                { "FormEngineKey", formEngineKey },
                { "TableRowId", tableRowId },
                { "Stages", stageTimings }
            };

            var dataAppendDict = result.DataAppend as IDictionary<string, object>;
            if (dataAppendDict == null)
            {
                dataAppendDict = new Dictionary<string, object>();
                if (result.DataAppend != null)
                {
                    dataAppendDict["OriginDataAppend"] = result.DataAppend;
                }
                result.DataAppend = dataAppendDict;
            }
            dataAppendDict["MergedSubmitTimings"] = timingData;

            if (totalSw.ElapsedMilliseconds >= DiyCommon.SlowExecutionThresholdMs)
            {
                try
                {
                    _ = MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                    {
                        Type = "工作流合并提交慢日志",
                        Title = timingData["Action"] + " 执行时间：" + totalSw.ElapsedMilliseconds + "ms",
                        Content = JsonConvert.SerializeObject(timingData)
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Microi：【警告】工作流合并提交慢日志写入失败：" + ex.Message);
                }
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetWFWork(WFParam param)
        {
            await DefaultParam(param);
            var result = await _workFlowLogic.GetWFWork(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetWFFlow(WFParam param)
        {
            await DefaultParam(param);
            var result = await _workFlowLogic.GetWFFlow(param);
            return Json(result);
        }
        /// <summary>
        /// 获取工作流统计（我的待办、我发起的、我处理的、抄送我的、我相关的 数量）
        /// </summary>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetWFStats(WFParam param)
        {
            await DefaultParam(param);
            if (param._CurrentUser == null)
                return Json(new { Code = 0, Msg = "参数错误" });

            var userId = param._CurrentUser?["Id"].Val<string>();
            var osClient = param.OsClient;
            var currentUser = param._CurrentUser;

            // 5 个统计并行执行
            var todoTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Work",
                _SearchEqual = new Dictionary<string, string>
                {
                    { "ReceiverId", userId },
                    { "WorkState", "Todo" }
                },
                IsDeleted = 0,
                OsClient = osClient,
                _CurrentUser = currentUser
            });
            var senderTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Flow",
                _SearchEqual = new Dictionary<string, string>
                {
                    { "SenderId", userId }
                },
                IsDeleted = 0,
                OsClient = osClient,
                _CurrentUser = currentUser
            });
            var doneTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Work",
                _SearchEqual = new Dictionary<string, string>
                {
                    { "ReceiverId", userId },
                    { "WorkState", "Done" }
                },
                IsDeleted = 0,
                OsClient = osClient,
                _CurrentUser = currentUser
            });
            var copyTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Flow",
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "CopyUsers", Value = userId, Type = "Like" }
                },
                IsDeleted = 0,
                OsClient = osClient,
                _CurrentUser = currentUser
            });
            var connectTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Work",
                _SearchEqual = new Dictionary<string, string>
                {
                    { "ReceiverId", userId },
                    { "WorkState", "OtherDone" }
                },
                IsDeleted = 0,
                OsClient = osClient,
                _CurrentUser = currentUser
            });

            await Task.WhenAll(todoTask, senderTask, doneTask, copyTask, connectTask);

            return Json(new
            {
                Code = 1,
                Data = new
                {
                    Todo = todoTask.Result?.DataCount ?? 0,
                    Sender = senderTask.Result?.DataCount ?? 0,
                    Done = doneTask.Result?.DataCount ?? 0,
                    Copy = copyTask.Result?.DataCount ?? 0,
                    Connect = connectTask.Result?.DataCount ?? 0
                }
            });
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetNextNodeConfirmUsers(WFParam param)
        {
            await DefaultParam(param);
            var result = await MicroiEngine.WFEngine.GetNextNodeConfirmUsers(param);
            return Json(result);
        }
    }
}
