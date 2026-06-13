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
using System;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// V8引擎MCP API（路由层，核心逻辑在 V8McpLogic）
    /// 同时兼容 api/V8Engine/* 和 api/V8Debug/* 两种路由
    /// </summary>
    [Route("api/V8Engine/[action]")]
    [Route("api/V8Debug/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class V8EngineController : Controller
    {
        private static string DecodeCodeBase64(string codeBase64)
        {
            if (string.IsNullOrWhiteSpace(codeBase64)) return "";
            return Encoding.UTF8.GetString(Convert.FromBase64String(codeBase64));
        }

        private static int IntOrDefault(JObject param, string name, int defaultValue)
        {
            var token = param?[name];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return defaultValue;
            var raw = token.ToString();
            if (string.IsNullOrWhiteSpace(raw)) return defaultValue;
            if (int.TryParse(raw, out var value)) return value;
            if (token.Type == JTokenType.Boolean) return token.Val<bool>() ? 1 : 0;
            return defaultValue;
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetStatus()
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            return Ok(new DosResult(1, V8McpLogic.BuildStatusData(token)));
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetApiEngineList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetApiEngineList(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            apiEngineKey = apiEngineKey ?? param?["ApiEngineKey"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8McpLogic.GetApiEngine(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetApiEngineCode(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            apiEngineKey = apiEngineKey ?? param?["ApiEngineKey"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            var result = await V8McpLogic.GetApiEngineCode(osClient, apiEngineKey);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            lastSyncTime = lastSyncTime ?? param?["LastSyncTime"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.GetUpdatedApiEngines(osClient, lastSyncTime);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            if (param == null) return Ok(new DosResult(0, null, "请求参数不能为空"));
            var osClient = V8McpLogic.ResolveOsClient(param.Value<string>("OsClient"), (object)token);
            var apiEngineKey = param.Value<string>("ApiEngineKey");
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            var codeBase64 = param.Value<string>("ApiV8CodeBase64") ?? param.Value<string>("CodeBase64");
            string code;
            try
            {
                code = DecodeCodeBase64(codeBase64);
                if (string.IsNullOrWhiteSpace(code)) code = param.Value<string>("ApiV8Code");
                if (string.IsNullOrWhiteSpace(code)) code = param.Value<string>("Code");
            }
            catch
            {
                return Ok(new DosResult(0, null, "ApiV8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.UpdateApiEngineCode(
                osClient, apiEngineKey, code,
                param.Value<string>("Version"),
                param.Value<string>("ChangeHistory") ?? param.Value<string>("ChangeSummary"));
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var apiName = param["ApiName"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(apiName)) return Ok(new DosResult(0, null, "ApiName 不能为空"));
            if (string.IsNullOrWhiteSpace(apiEngineKey)) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            string code;
            try
            {
                code = DecodeCodeBase64(param.Value<string>("ApiV8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(code)) code = param["ApiV8Code"].Val<string>();
                if (string.IsNullOrWhiteSpace(code)) code = param["Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "ApiV8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.CreateApiEngine(
                osClient, apiName, apiEngineKey,
                param["ApiAddress"].Val<string>(), param["ApiRemark"].Val<string>(),
                param["Lock"].Val<int>(), param["AllowAnonymous"].Val<int>(),
                param["IsEnable"]?.Val<int>() ?? 1, param["Category"].Val<string>(), code,
                param.Value<string>("Version"),
                param.Value<string>("ChangeHistory") ?? param.Value<string>("ChangeSummary"));
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UploadFileBase64([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.UploadFileBase64(
                osClient,
                param["FileName"].Val<string>(),
                param["FileByteBase64"].Val<string>(),
                param["Path"].Val<string>(),
                param["Limit"]?.Val<bool>(),
                param["Preview"]?.Val<bool>(),
                param["TargetTable"].Val<string>(),
                param["TargetId"].Val<string>(),
                param["TargetField"].Val<string>(),
                token);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var items = param["Items"]?.ToObject<List<V8McpLogic.VersionCheckItem>>();
            if (items == null || items.Count == 0) return Ok(new DosResult(0, null, "Items 不能为空"));
            var result = await V8McpLogic.CheckVersions(osClient, items);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ExecuteApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            string v8Code;
            try
            {
                v8Code = DecodeCodeBase64(param.Value<string>("V8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(v8Code)) v8Code = param["V8Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "V8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.ExecuteApiEngine(
                osClient, param["ApiEngineKey"].Val<string>(), v8Code,
                param["Param"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetV8EventList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetV8EventList(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetV8EventCode(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var formEngineKey = param?["FormEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(formEngineKey)) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            var eventType = param?["EventType"].Val<string>();
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            var result = await V8McpLogic.GetV8EventCode(osClient, formEngineKey, eventType);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var formEngineKey = param["FormEngineKey"].Val<string>();
            if (string.IsNullOrWhiteSpace(formEngineKey)) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 V8Code
            var code = param["V8Code"].Val<string>() ?? param["Code"].Val<string>();
            var result = await V8McpLogic.UpdateV8EventCode(
                osClient, formEngineKey, param["EventType"].Val<string>(), code);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetWorkflowV8EventList(string? osClient, string? flowDesignId, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetWorkflowV8EventList(osClient, flowDesignId);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetWorkflowV8EventCode(string? osClient, string? flowDesignId, string? nodeId, string? eventType, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>() ?? param?["Id"].Val<string>();
            nodeId = nodeId ?? param?["NodeId"].Val<string>();
            eventType = eventType ?? param?["EventType"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            if (string.IsNullOrWhiteSpace(nodeId)) return Ok(new DosResult(0, null, "NodeId 不能为空"));
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            var result = await V8McpLogic.GetWorkflowV8EventCode(osClient, nodeId, eventType, flowDesignId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateWorkflowV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var flowDesignId = param["FlowDesignId"].Val<string>() ?? param["Id"].Val<string>();
            var nodeId = param["NodeId"].Val<string>();
            var eventType = param["EventType"].Val<string>();
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            if (string.IsNullOrWhiteSpace(nodeId)) return Ok(new DosResult(0, null, "NodeId 不能为空"));
            if (string.IsNullOrWhiteSpace(eventType)) return Ok(new DosResult(0, null, "EventType 不能为空"));
            string code;
            try
            {
                code = DecodeCodeBase64(param.Value<string>("V8CodeBase64") ?? param.Value<string>("CodeBase64"));
                if (string.IsNullOrWhiteSpace(code)) code = param["V8Code"].Val<string>();
                if (string.IsNullOrWhiteSpace(code)) code = param["Code"].Val<string>();
            }
            catch
            {
                return Ok(new DosResult(0, null, "V8CodeBase64 不是有效的 UTF-8 Base64 字符串"));
            }
            var result = await V8McpLogic.UpdateWorkflowV8EventCode(osClient, nodeId, eventType, code ?? "", flowDesignId);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> QueryMongodbLogs(string? osClient, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.QueryMongodbLogs(osClient, param ?? new JObject());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> WriteMongodbLog([FromBody] JObject? param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param?["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.WriteMongodbLog(osClient, param ?? new JObject(), token);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var v8Code = param["V8Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(v8Code)) return Ok(new DosResult(0, null, "V8Code 不能为空"));
            var result = await V8McpLogic.ExecuteV8Event(
                osClient, param["EventType"].Val<string>(), v8Code,
                param["Form"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetDbSchema(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetDbSchema(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetPlaywrightContext(string osClient, string keyword, int? pageSize, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            keyword = keyword ?? param?["Keyword"].Val<string>();
            var resolvedPageSize = pageSize ?? 5000;
            var pageSizeToken = param?["PageSize"];
            if (pageSizeToken != null && int.TryParse(pageSizeToken.ToString(), out var bodyPageSize)) resolvedPageSize = bodyPageSize;
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var apiBaseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}".TrimEnd('/');
            var result = await V8McpLogic.GetPlaywrightContext(osClient, keyword, apiBaseUrl, resolvedPageSize);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var name = param["Name"].Val<string>();
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8McpLogic.CreateTable(osClient, name, param["Description"].Val<string>(),
                param["Tabs"].Val<string>(), param["IsTree"]?.Val<int>() ?? 0,
                param["Column"]?.Val<int>() ?? 1, param["FormOpenType"].Val<string>(),
                param["FormOpenWidth"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var tableId = param["TableId"].Val<string>();
            var name = param["Name"].Val<string>();
            var label = param["Label"].Val<string>();
            if (string.IsNullOrWhiteSpace(tableId)) return Ok(new DosResult(0, null, "TableId 不能为空"));
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            if (string.IsNullOrWhiteSpace(label)) return Ok(new DosResult(0, null, "Label 不能为空"));
            var result = await V8McpLogic.AddField(
                osClient, tableId, name, label,
                param["Type"].Val<string>(), param["Component"].Val<string>(),
                IntOrDefault(param, "Visible", 1), IntOrDefault(param, "AppVisible", 1),
                param["Tab"].Val<string>(), param["TableWidth"]?.Val<int>() ?? 120,
                param["Sort"]?.Val<int>() ?? 100, param["NameConfirm"]?.Val<int>() ?? 0,
                param["Readonly"]?.Val<int>() ?? 0,
                param["NotEmpty"]?.Val<int>() ?? 0, param["Unique"]?.Val<int>() ?? 0,
                param["DefaultValue"].Val<string>(), param["Placeholder"].Val<string>(),
                param["FormWidth"]?.Val<int?>(), param["Data"].Val<string>(),
                param["Config"].Val<string>(), param["Description"].Val<string>(),
                param["Encrypt"]?.Val<int>() ?? 0, param["InTableEdit"]?.Val<int>() ?? 0);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var name = param["Name"].Val<string>();
            if (string.IsNullOrWhiteSpace(name)) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8McpLogic.CreateModule(
                osClient, name,
                param["DiyTableId"].Val<string>(),
                param["ComponentName"].Val<string>(), param["ComponentPath"].Val<string>(),
                IntOrDefault(param, "Display", 1), IntOrDefault(param, "AppDisplay", 1),
                param["OpenType"].Val<string>(), param["Url"].Val<string>(),
                param["ParentId"].Val<string>(), param["Sort"]?.Val<int>() ?? 100,
                param["Icon"].Val<string>(), param["SearchFieldIds"].Val<string>(),
                param["TableDiyFieldIds"].Val<string>(), param["DefaultOrderBy"].Val<string>(),
                param["SqlWhere"].Val<string>(), param["DiyConfig"].Val<string>(),
                param["MoreBtns"].Val<string>(), param["FormBtns"].Val<string>(),
                param["BatchSelectMoreBtns"].Val<string>(), param["PageTabs"].Val<string>(),
                param["ExportMoreBtns"].Val<string>(), param["PageBtns"].Val<string>(),
                param["SortFieldIds"].Val<string>(), param["NotShowFields"].Val<string>(),
                param["SqlJoin"].Val<string>(), param["JoinTables"].Val<string>(),
                param["SelectFields"].Val<string>(), param["StatisticsFields"].Val<string>(),
                param["InTableEdit"]?.Val<int>() ?? 0, param["InTableEditFields"].Val<string>(),
                param["MobileListFields"].Val<string>(),
                param["CardTitleTagFields"].Val<string>(), param["CardBottomTagFields"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> DebugSession(string action, string sessionId, [FromBody] JObject param = null)
        {
            var (ok, msg, _) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            action = action ?? param?["Action"].Val<string>();
            sessionId = sessionId ?? param?["SessionId"].Val<string>();

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
                    if (string.IsNullOrWhiteSpace(sessionId)) return Ok(new DosResult(0, null, "SessionId 不能为空"));
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

        [HttpPost]
        public async Task<IActionResult> SetRolePermission([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var roleId = param["RoleId"].Val<string>();
            var menuIds = param["MenuIds"]?.ToObject<List<string>>();
            if (string.IsNullOrWhiteSpace(roleId)) return Ok(new DosResult(0, null, "RoleId 不能为空"));
            if (menuIds == null || menuIds.Count == 0) return Ok(new DosResult(0, null, "MenuIds 不能为空"));
            var result = await V8McpLogic.SetRolePermission(osClient, roleId, menuIds);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListRoles(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListRoles(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveRole([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveRole(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListModules(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListModules(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetModule(string osClient, string moduleId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            moduleId = moduleId ?? param?["ModuleId"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(moduleId)) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.GetModule(osClient, moduleId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var moduleId = param["ModuleId"].Val<string>() ?? param["Id"].Val<string>();
            if (string.IsNullOrWhiteSpace(moduleId)) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.UpdateModule(osClient, moduleId, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListDataSources(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListDataSources(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveDataSource([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveDataSource(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListPrintTemplates(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            var result = await V8McpLogic.ListPrintTemplates(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SavePrintTemplate([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SavePrintTemplate(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveWorkflowPackage([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveWorkflowPackage(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveJob([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.SaveJob(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ValidateLowCodeSystem([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.ValidateLowCodeSystem(osClient, param["Manifest"] as JObject ?? param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> WriteMcpAuditLog([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var result = await V8McpLogic.WriteMcpAuditLog(osClient,
                param["Action"].Val<string>(), param["Target"].Val<string>(), param["Content"].Val<string>(), token);
            return Ok(result);
        }

        #region 界面引擎（Page Engine）

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetPageEngineList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.GetPageEngineList(osClient, keyword);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetPageEngineDetail(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var pageId = param?["PageId"].Val<string>();
            if (string.IsNullOrWhiteSpace(pageId)) return Ok(new DosResult(0, null, "PageId 不能为空"));
            var result = await V8McpLogic.GetPageEngineDetail(osClient, pageId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SavePageEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var title = param["Title"].Val<string>();
            if (string.IsNullOrWhiteSpace(title)) return Ok(new DosResult(0, null, "Title 不能为空"));
            var jsonStr = param["JsonStr"].Val<string>();
            if (string.IsNullOrWhiteSpace(jsonStr)) return Ok(new DosResult(0, null, "JsonStr 不能为空"));
            var result = await V8McpLogic.SavePageEngine(
                osClient, param["PageId"].Val<string>(), title,
                param["Number"].Val<string>(), param["Desc"].Val<string>(), jsonStr,
                param["RoutePath"].Val<string>(), param["ComponentPath"].Val<string>());
            return Ok(result);
        }

        #endregion

        #region MCP 扩展（字段/表/缓存/匿名）

        [HttpPost]
        public async Task<IActionResult> UpdateField([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateField(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetFieldList(string? osClient, string? tableId, string? tableName = null, [FromBody] JObject? param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            tableId = tableId ?? param?["TableId"].Val<string>();
            tableName = tableName ?? param?["TableName"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetFieldList(osClient, tableId, tableName);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateTable([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.UpdateTable(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> RefreshSchemaCache([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
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
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["ApiEngineKeys"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var allow = param["AllowAnonymous"]?.Val<int>() ?? 1;
            var result = await V8McpLogic.SetEngineAnonymous(osClient, list, allow);
            return Ok(result);
        }

        #endregion

        #region 业务架构蓝图（System Blueprint）

        /// <summary>
        /// 列出当前 OsClient 的所有业务蓝图（不含 BlueprintData）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<IActionResult> ListBlueprints(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.ListBlueprints(osClient, keyword);
            return Ok(result);
        }

        /// <summary>
        /// 获取单个蓝图详情（含 BlueprintData JSON 全文）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<IActionResult> GetBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.GetBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        /// <summary>
        /// 创建或更新蓝图。规则：
        ///   - 传 Id 命中 → Update；否则按 Name 命中 → Update；否则 Create
        ///   - 自动写入历史快照（sys_blueprint_history）
        ///   - 自动重建反向引用索引（sys_blueprint_relation）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SaveBlueprint([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveBlueprint(osClient, param, token);
            return Ok(result);
        }

        /// <summary>
        /// 删除蓝图（软删除主表 + 同步删反向索引；保留历史快照用于回溯）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> DeleteBlueprint([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var blueprintId = param["BlueprintId"].Val<string>() ?? param["Id"].Val<string>();
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.DeleteBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        /// <summary>
        /// 验证蓝图引用的所有平台资源是否存在（漂移检测）。
        /// 返回 errors/warnings/CheckedRefs 统计，AI 据此决定是否需先修复蓝图再生成代码。
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<IActionResult> ValidateBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            blueprintId = blueprintId ?? param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, (object)token);
            if (string.IsNullOrWhiteSpace(blueprintId)) return Ok(new DosResult(0, null, "BlueprintId 不能为空"));
            var result = await V8McpLogic.ValidateBlueprint(osClient, blueprintId);
            return Ok(result);
        }

        #endregion

        #region 状态机（State Machine）

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListStateMachines(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var keyword = param?["Keyword"].Val<string>();
            var result = await V8McpLogic.ListStateMachines(osClient, keyword);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetStateMachine(string osClient, string id, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            id = id ?? param?["Id"].Val<string>() ?? param?["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.GetStateMachine(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveStateMachine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveStateMachine(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> DeleteStateMachine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.DeleteStateMachine(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> TransitionState([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.TransitionState(osClient, param, token);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetStateHistory(string osClient, string tableName, string rowId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            tableName = tableName ?? param?["TableName"].Val<string>();
            rowId = rowId ?? param?["RowId"].Val<string>();
            var result = await V8McpLogic.GetStateHistory(osClient, tableName, rowId);
            return Ok(result);
        }

        #endregion

        #region 自动化流（Flow Engine）

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListFlows(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.ListFlows(osClient, param?["Keyword"].Val<string>(), param?["TriggerType"].Val<string>());
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetFlow(string osClient, string id, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            id = id ?? param?["Id"].Val<string>() ?? param?["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.GetFlow(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.SaveFlow(osClient, param, token);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> DeleteFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var result = await V8McpLogic.DeleteFlow(osClient, id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> RunFlow([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), (object)token);
            var id = param["Id"].Val<string>() ?? param["Code"].Val<string>();
            if (string.IsNullOrWhiteSpace(id)) return Ok(new DosResult(0, null, "Id 不能为空"));
            var input = param["Input"] as JObject ?? new JObject();
            var result = await V8McpLogic.RunFlow(osClient, id, input, token);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetFlowRuns(string osClient, string flowId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowId = flowId ?? param?["FlowId"].Val<string>() ?? param?["Code"].Val<string>();
            var pageSize = param?["PageSize"].Val<int>() ?? 50;
            var result = await V8McpLogic.GetFlowRuns(osClient, flowId, pageSize);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetFlowRunDetail(string osClient, string runId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            runId = runId ?? param?["RunId"].Val<string>();
            if (string.IsNullOrWhiteSpace(runId)) return Ok(new DosResult(0, null, "RunId 不能为空"));
            var result = await V8McpLogic.GetFlowRunDetail(osClient, runId);
            return Ok(result);
        }

        #endregion

        #region 流程挖掘（Process Mining）

        [HttpGet, HttpPost]
        public async Task<IActionResult> AnalyzeWorkflow(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var fromDate = param?["FromDate"].Val<string>();
            var toDate = param?["ToDate"].Val<string>();
            var result = await V8McpLogic.AnalyzeWorkflow(osClient, flowDesignId, fromDate, toDate);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetHotPaths(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var topN = param?["TopN"].Val<int>() ?? 20;
            var result = await V8McpLogic.GetHotPaths(osClient, flowDesignId, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetSlaViolations(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var slaMinutes = param?["SlaMinutes"].Val<int>() ?? 60;
            var topN = param?["TopN"].Val<int>() ?? 100;
            var result = await V8McpLogic.GetSlaViolations(osClient, flowDesignId, slaMinutes, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetBottlenecks(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var topN = param?["TopN"].Val<int>() ?? 5;
            var result = await V8McpLogic.GetBottlenecks(osClient, flowDesignId, topN);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetWorkflowOverview(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = V8McpLogic.ResolveOsClient(osClient ?? param?["OsClient"].Val<string>(), (object)token);
            flowDesignId = flowDesignId ?? param?["FlowDesignId"].Val<string>();
            var result = await V8McpLogic.GetWorkflowOverview(osClient, flowDesignId);
            return Ok(result);
        }

        #endregion
    }
}
