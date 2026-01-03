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
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = currentToken.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentToken.OsClient;
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