using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// System-level AI workflow API. This is separate from the approval WorkFlow engine.
    /// </summary>
    [Route("api/AIWorkFlow/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class AIWorkFlowController : Controller
    {
        [HttpGet, HttpPost]
        public async Task<IActionResult> GetOverview(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?.Value<string>("OsClient");
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            var result = await AIWorkFlowLogic.GetOverview(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> GenerateFromPrompt([FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            param = param ?? new JObject();
            var osClient = V8McpLogic.ResolveOsClient(param.Value<string>("OsClient"), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            var result = await AIWorkFlowLogic.GenerateFromPrompt(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetNodeDetail(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            param = param ?? new JObject();
            osClient = osClient ?? param.Value<string>("OsClient");
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            var result = await AIWorkFlowLogic.GetNodeDetail(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListAIWorkFlows(string osClient, string keyword, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?.Value<string>("OsClient");
            keyword = keyword ?? param?.Value<string>("Keyword");
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            var result = await AIWorkFlowLogic.ListAIWorkFlows(osClient, keyword);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetAIWorkFlow(string osClient, string id, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?.Value<string>("OsClient");
            id = id ?? param?.Value<string>("Id") ?? param?.Value<string>("Name");
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id cannot be empty"));
            var result = await AIWorkFlowLogic.GetAIWorkFlow(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveAIWorkFlow([FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            param = param ?? new JObject();
            var osClient = V8McpLogic.ResolveOsClient(param.Value<string>("OsClient"), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            var result = await AIWorkFlowLogic.SaveAIWorkFlow(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> DeleteAIWorkFlow([FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            param = param ?? new JObject();
            var osClient = V8McpLogic.ResolveOsClient(param.Value<string>("OsClient"), (object)token);
            var id = param.Value<string>("Id");
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient cannot be empty"));
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id cannot be empty"));
            var result = await AIWorkFlowLogic.DeleteAIWorkFlow(osClient, id);
            return Ok(result);
        }
    }
}
