#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8EngineController.Patch.cs
* 文件描述：V8EngineController 路由扩展（分部类）
*           - UpdateField / UpdateTable / RefreshSchemaCache / SetEngineAnonymous
* 创 建 人：MCP
* 创建日期：2026-05-04
*******************************************************/
#endregion
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    public partial class V8EngineController
    {
        [HttpPost]
        public async Task<IActionResult> UpdateField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateField(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateTable(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> RefreshSchemaCache([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["Tables"] as JArray) ?? (param["TableNames"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var result = await V8McpLogic.RefreshSchemaCache(osClient, list);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SetEngineAnonymous([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["ApiEngineKeys"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var allow = param["AllowAnonymous"]?.Val<int>() ?? 1;
            var result = await V8McpLogic.SetEngineAnonymous(osClient, list, allow);
            return Ok(result);
        }
    }
}
