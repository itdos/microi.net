using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
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
        }

        [HttpPost]
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

        private async Task<JsonResult> SaveFormAndRunWf(JObject param, bool isStart)
        {
            if (param == null)
            {
                return Json(new DosResult(0, null, "参数为空"));
            }

            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            var currentUser = currentTokenDynamic?.CurrentUser;
            string osClient = currentTokenDynamic?.OsClient;

            JObject formPayload = param["Form"] as JObject;
            JObject wfJson = param["Wf"] as JObject;
            if (formPayload == null)
            {
                return Json(new DosResult(0, null, "Form 参数为空"));
            }
            if (wfJson == null)
            {
                return Json(new DosResult(0, null, "Wf 参数为空"));
            }

            string formAction = formPayload["_FormSubmitAction"]?.ToString();
            if (string.IsNullOrEmpty(formAction))
            {
                // 兼容：若不传 _FormSubmitAction，按是否有 Id 判定
                formAction = string.IsNullOrEmpty(formPayload["Id"]?.ToString()) ? "Add" : "Edit";
            }

            // 注入身份信息到表单 payload
            formPayload["_CurrentUser"] = JTokenEx.FromObject(currentUser);
            formPayload["OsClient"] = osClient;
            formPayload["_InvokeType"] = "Client";

            // 反序列化 WFParam
            WFParam wfParam;
            try
            {
                wfParam = wfJson.ToObject<WFParam>();
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "Wf 参数反序列化失败：" + ex.Message));
            }
            wfParam._CurrentUser = currentUser;
            wfParam.OsClient = osClient;
            wfParam.LineValue = ""; // 与 StartWork/SendWork 保持一致

            // 取主库会话开启事务
            var clientModel = OsClientExtend.GetClient(osClient);
            if (clientModel == null || clientModel.Db == null)
            {
                return Json(new DosResult(0, null, "未找到 OsClient 对应的数据库会话"));
            }
            var dbSession = clientModel.Db;

            DbTrans trans = null;
            try
            {
                trans = dbSession.BeginTransaction();

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

                if (formResult == null || formResult.Code != 1)
                {
                    try { trans.Rollback(); } catch { }
                    return Json(formResult ?? new DosResult(0, null, "保存表单失败"));
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
                    catch { }
                }
                if (string.IsNullOrEmpty(savedId))
                {
                    savedId = formPayload["Id"]?.Val<string>();
                }
                if (!string.IsNullOrEmpty(savedId) && string.IsNullOrEmpty(wfParam.TableRowId))
                {
                    wfParam.TableRowId = savedId;
                }

                // 若调用方未带 FormData，则用最终的表单数据序列化补上（工作流可能用到）
                if (string.IsNullOrEmpty(wfParam.FormData))
                {
                    wfParam.FormData = formPayload.ToString(Formatting.None);
                }

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

                if (wfResult == null || wfResult.Code != 1)
                {
                    try { trans.Rollback(); } catch { }
                    return Json(wfResult ?? new DosResult(0, null, isStart ? "启动工作流失败" : "发送工作流失败"));
                }

                trans.Commit();

                // 把表单结果一起返回，前端可继续后续处理
                var dataAppendDict = wfResult.DataAppend as System.Collections.Generic.IDictionary<string, object>;
                if (dataAppendDict == null)
                {
                    dataAppendDict = new System.Collections.Generic.Dictionary<string, object>();
                    wfResult.DataAppend = dataAppendDict;
                }
                try { dataAppendDict["FormSaveResult"] = formResult; } catch { }
                try { dataAppendDict["FormSavedId"] = savedId; } catch { }

                return Json(wfResult);
            }
            catch (Exception ex)
            {
                if (trans != null)
                {
                    try { trans.Rollback(); } catch { }
                }
                return Json(new DosResult(0, null, "事务执行失败：" + ex.Message));
            }
            finally
            {
                if (trans != null)
                {
                    try { trans.Close(); } catch { }
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