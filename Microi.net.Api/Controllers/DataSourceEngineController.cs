using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 数据源引擎接口
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class DataSourceEngineController : Controller
    {
        private static DataSourceEngine _dtaSourceEngineLogic = new DataSourceEngine();

        private static async Task DefaultParam([FromBody] JObject param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            if (currentToken != null)
            {
                param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
                param["OsClient"] = currentToken.OsClient;
            }
            if (currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
            }
            if (currentTokenDynamic == null
                && param["authorization"] != null && !(param["authorization"].ToString().DosIsNullOrWhiteSpace()))
            {
                var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param["authorization"].ToString());
                var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param["authorization"].ToString());
                param["_CurrentSysUser"] = JToken.FromObject(tokenModel.CurrentUser);
                param["OsClient"] = tokenModel.OsClient;
                param["_CurrentUser"] = JToken.FromObject(tokenModelJobj.CurrentUser);
            }
            //调用方式 Server、Client
            param["_InvokeType"] = JToken.FromObject(InvokeType.Client);// "Client";
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> Run([FromBody] JObject param)
        {
            await DefaultParam(param);
            var result = await _dtaSourceEngineLogic.RunAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [Obsolete("Please use Run.")]
        public async Task<JsonResult> GetData([FromBody] JObject param)
        {
            return await Run(param);
        }
    }
}
