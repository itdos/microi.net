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
    /// V8引擎MCP API（路由层，核心逻辑在 V8McpLogic）
    /// 同时兼容 api/V8Engine/* 和 api/V8Debug/* 两种路由
    /// </summary>
    [Route("api/V8Engine/[action]")]
    [Route("api/V8Debug/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class V8EngineController : Controller
    {
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            var result = await V8McpLogic.GetUpdatedApiEngines(osClient, lastSyncTime);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            var code = param["ApiV8Code"].Val<string>() ?? param["Code"].Val<string>();
            var result = await V8McpLogic.UpdateApiEngineCode(osClient, apiEngineKey, code);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateApiEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var apiName = param["ApiName"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            if (apiName.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiName 不能为空"));
            if (apiEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 ApiV8Code
            var code = param["ApiV8Code"].Val<string>() ?? param["Code"].Val<string>();
            var result = await V8McpLogic.CreateApiEngine(
                osClient, apiName, apiEngineKey,
                param["ApiAddress"].Val<string>(), param["ApiRemark"].Val<string>(),
                param["Lock"].Val<int>(), param["AllowAnonymous"].Val<int>(),
                param["IsEnable"]?.Val<int>() ?? 1, param["Category"].Val<string>(), code);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
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
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.ExecuteApiEngine(
                osClient, param["ApiEngineKey"].Val<string>(), param["V8Code"].Val<string>(),
                param["Param"] as JObject ?? new JObject(), token, HttpContext);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetV8EventList(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var result = await V8McpLogic.GetV8EventList(osClient);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> GetV8EventCode(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var formEngineKey = param?["FormEngineKey"].Val<string>();
            if (formEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            var eventType = param?["EventType"].Val<string>();
            if (eventType.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "EventType 不能为空"));
            var result = await V8McpLogic.GetV8EventCode(osClient, formEngineKey, eventType);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var formEngineKey = param["FormEngineKey"].Val<string>();
            if (formEngineKey.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            // 兼容 MCP 客户端发送 Code 和 VSCode 扩展发送 V8Code
            var code = param["V8Code"].Val<string>() ?? param["Code"].Val<string>();
            var result = await V8McpLogic.UpdateV8EventCode(
                osClient, formEngineKey, param["EventType"].Val<string>(), code);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var v8Code = param["V8Code"].Val<string>();
            if (v8Code.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "V8Code 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
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
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var name = param["Name"].Val<string>();
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
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
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var tableId = param["TableId"].Val<string>();
            var name = param["Name"].Val<string>();
            var label = param["Label"].Val<string>();
            if (tableId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "TableId 不能为空"));
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
            if (label.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Label 不能为空"));
            var result = await V8McpLogic.AddField(
                osClient, tableId, name, label,
                param["Type"].Val<string>(), param["Component"].Val<string>(),
                param["Visible"]?.Val<int>() ?? 1, param["AppVisible"]?.Val<int>() ?? 1,
                param["Tab"].Val<string>(), param["TableWidth"]?.Val<int>() ?? 120,
                param["Sort"]?.Val<int>() ?? 100, param["NameConfirm"]?.Val<int>() ?? 0,
                param["Readonly"]?.Val<int>() ?? 0,
                param["NotEmpty"]?.Val<int>() ?? 0, param["Unique"]?.Val<int>() ?? 0,
                param["DefaultValue"].Val<string>(), param["Placeholder"].Val<string>(),
                param["FormWidth"]?.Val<int>() ?? 24, param["Data"].Val<string>(),
                param["Config"].Val<string>(), param["Description"].Val<string>(),
                param["Encrypt"]?.Val<int>() ?? 0, param["InTableEdit"]?.Val<int>() ?? 0);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var name = param["Name"].Val<string>();
            if (name.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Name 不能为空"));
            var result = await V8McpLogic.CreateModule(
                osClient, name,
                param["DiyTableId"].Val<string>(),
                param["ComponentName"].Val<string>(), param["ComponentPath"].Val<string>(),
                param["Display"]?.Val<int>() ?? 1, param["AppDisplay"]?.Val<int>() ?? 1,
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

        [HttpPost]
        public async Task<IActionResult> SetRolePermission([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var roleId = param["RoleId"].Val<string>();
            var menuIds = param["MenuIds"]?.ToObject<List<string>>();
            if (roleId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "RoleId 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            var result = await V8McpLogic.ListRoles(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveRole([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.SaveRole(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListModules(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (moduleId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.GetModule(osClient, moduleId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateModule([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var moduleId = param["ModuleId"].Val<string>() ?? param["Id"].Val<string>();
            if (moduleId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "ModuleId 不能为空"));
            var result = await V8McpLogic.UpdateModule(osClient, moduleId, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListDataSources(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            var result = await V8McpLogic.ListDataSources(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveDataSource([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.SaveDataSource(osClient, param);
            return Ok(result);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> ListPrintTemplates(string osClient, [FromBody] JObject param = null)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            osClient = osClient ?? param?["OsClient"].Val<string>();
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            var result = await V8McpLogic.ListPrintTemplates(osClient, param?["Keyword"].Val<string>());
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SavePrintTemplate([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.SavePrintTemplate(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveWorkflowPackage([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.SaveWorkflowPackage(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveJob([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.SaveJob(osClient, param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ValidateLowCodeSystem([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var result = await V8McpLogic.ValidateLowCodeSystem(osClient, param["Manifest"] as JObject ?? param);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> WriteMcpAuditLog([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
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
            osClient = V8McpLogic.ResolveOsClient(osClient, token);
            if (osClient.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var pageId = param?["PageId"].Val<string>();
            if (pageId.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "PageId 不能为空"));
            var result = await V8McpLogic.GetPageEngineDetail(osClient, pageId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SavePageEngine([FromBody] JObject param)
        {
            var (ok, msg, token) = await V8McpLogic.CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));
            var osClient = V8McpLogic.ResolveOsClient(param["OsClient"].Val<string>(), token);
            var title = param["Title"].Val<string>();
            if (title.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "Title 不能为空"));
            var jsonStr = param["JsonStr"].Val<string>();
            if (jsonStr.DosIsNullOrWhiteSpace()) return Ok(new DosResult(0, null, "JsonStr 不能为空"));
            var result = await V8McpLogic.SavePageEngine(
                osClient, param["PageId"].Val<string>(), title,
                param["Number"].Val<string>(), param["Desc"].Val<string>(), jsonStr);
            return Ok(result);
        }

        #endregion

        #region MCP 扩展（字段/表/缓存/匿名）

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
            if (string.IsNullOrWhiteSpace(osClient)) return Ok(new DosResult(0, null, "OsClient 不能为空"));
            var arr = (param["ApiEngineKeys"] as JArray);
            var list = arr?.ToObject<List<string>>() ?? new List<string>();
            var allow = param["AllowAnonymous"]?.Val<int>() ?? 1;
            var result = await V8McpLogic.SetEngineAnonymous(osClient, list, allow);
            return Ok(result);
        }

        #endregion
    }
}
