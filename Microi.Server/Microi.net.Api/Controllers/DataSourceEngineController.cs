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
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            if (currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentTokenDynamic.OsClient;
            }
            //调用方式 Server、Client
            param["_InvokeType"] = "Client";//JToken.FromObject(InvokeType.Client); "Client";
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
