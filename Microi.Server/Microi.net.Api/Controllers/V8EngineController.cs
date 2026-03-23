#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8EngineController.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-01-13
* 文件描述：V8引擎本地调试同步API（路由层）
*           路由同时兼容 api/V8Engine/* 和 api/V8Debug/*
*******************************************************/
#endregion
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common;

namespace Microi.net.Api
{
    /// <summary>
    /// V8引擎本地调试同步API（路由层，核心逻辑在 V8DebugLogic）
    /// 同时兼容 api/V8Engine/* 和 api/V8Debug/* 两种路由
    /// </summary>
    [Route("api/V8Engine/[action]")]
    [Route("api/V8Debug/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class V8EngineController : Controller
    {
        [HttpGet]
        public async Task<IActionResult> GetStatus()
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            return Ok(new DosResult(1, V8DebugLogic.BuildStatusData(token)));
        }

        [HttpGet]
        public async Task<IActionResult> GetApiEngineList(string osClient)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8DebugLogic.GetApiEngineList(osClient);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8DebugLogic.GetApiEngine(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetApiEngineCode(string osClient, string apiEngineKey)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8DebugLogic.GetApiEngineCode(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            var result = await V8DebugLogic.GetUpdatedApiEngines(osClient, lastSyncTime);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8DebugLogic.UpdateApiEngineCode(osClient, apiEngineKey, param["ApiV8Code"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var apiName = param["ApiName"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (apiName.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiName 不能为空"));
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8DebugLogic.CreateApiEngine(
                osClient, apiName, apiEngineKey,
                param["ApiAddress"].Val<string>(), param["ApiRemark"].Val<string>(),
                param["Lock"].Val<int>(), param["AllowAnonymous"].Val<int>(),
                param["IsEnable"]?.Val<int>() ?? 1, param["Category"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var items = param["Items"]?.ToObject<List<V8DebugLogic.VersionCheckItem>>();
            if (items == null || items.Count == 0) return Ok(new DosResult(0, null, "Items 不能为空"));
            var result = await V8DebugLogic.CheckVersions(osClient, items);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ExecuteApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8DebugLogic.ExecuteApiEngine(
                osClient, param["ApiEngineKey"].Val<string>(), param["V8Code"].Val<string>(),
                param["Param"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetV8EventList(string osClient)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8DebugLogic.GetV8EventList(osClient);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var formEngineKey = param["FormEngineKey"].Val<string>();
            if (formEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            var result = await V8DebugLogic.UpdateV8EventCode(
                osClient, formEngineKey, param["EventType"].Val<string>(), param["V8Code"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var v8Code = param["V8Code"].Val<string>();
            if (v8Code.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "V8Code 不能为空"));
            var result = await V8DebugLogic.ExecuteV8Event(
                osClient, param["EventType"].Val<string>(), v8Code,
                param["Form"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetDbSchema(string osClient)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8DebugLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8DebugLogic.GetDbSchema(osClient);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var name = param["Name"].Val<string>();
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8DebugLogic.CreateTable(osClient, name, param["Description"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var tableId = param["TableId"].Val<string>();
            var name = param["Name"].Val<string>();
            var label = param["Label"].Val<string>();
            if (tableId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "TableId 不能为空"));
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
            if (label.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Label 不能为空"));
            var result = await V8DebugLogic.AddField(
                osClient, tableId, name, label,
                param["Type"].Val<string>(), param["Component"].Val<string>(),
                param["Visible"]?.Val<int>() ?? 1, param["AppVisible"]?.Val<int>() ?? 1,
                param["Tab"].Val<string>(), param["TableWidth"]?.Val<int>() ?? 120,
                param["Sort"]?.Val<int>() ?? 100, param["NameConfirm"]?.Val<int>() ?? 0,
                param["Readonly"]?.Val<int>() ?? 0);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8DebugLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var name = param["Name"].Val<string>();
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8DebugLogic.CreateModule(
                osClient, name,
                param["DiyTableId"].Val<string>(),
                param["ComponentName"].Val<string>(), param["ComponentPath"].Val<string>(),
                param["Display"]?.Val<int>() ?? 1, param["AppDisplay"]?.Val<int>() ?? 1,
                param["OpenType"].Val<string>(), param["Url"].Val<string>());
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> DebugSession(string action, string sessionId)
        {
            var (ok, msg, _) = await V8DebugLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            switch (action?.ToLower())
            {
                case "create":
                    return Ok(new DosResult(1, new
                    {
                        SessionId = Guid.NewGuid().ToString("N"),
                        WebSocketUrl = "/diy-websocket",
                        Message = "调试会话已创建，请通过 SignalR 连接 /diy-websocket 进行调试"
                    }));
                case "status":
                    if (sessionId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "SessionId 不能为空"));
                    return Ok(new DosResult(1, new
                    {
                        SessionId = sessionId,
                        Status = "active",
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));
                default:
                    return Ok(new DosResult(0, null, "无效的 action 参数，支持: create, status"));
            }
        }
    }
}
