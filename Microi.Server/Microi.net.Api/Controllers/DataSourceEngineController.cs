using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 数据源引擎接口
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class DataSourceEngineController : Controller
    {
        private static async Task DefaultParam([FromBody] JObject param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JTokenEx.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentTokenDynamic.OsClient;
            }
            //调用方式 Server、Client
            param["_InvokeType"] = "Client";//JTokenEx.FromObject(InvokeType.Client); "Client";
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> Run([FromBody] JObject param)
        {
            param ??= new JObject();
            await DefaultParam(param);
            var currentUser = param["_CurrentUser"] as JObject;
            if (!UserAccessKeySecurity.IsDataSourceAllowed(
                    currentUser,
                    param["DataSourceKey"]?.ToString()))
            {
                return Json(new DosResult(
                    0,
                    null,
                    "当前访问密钥未授权运行此数据源引擎。"));
            }
            var result = await MicroiEngine.DataSource.RunAsync(param);
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
