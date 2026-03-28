using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
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