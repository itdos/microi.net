using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>MCP HTTP 路由入口；请求处理、鉴权实现、资产流与业务编排统一归 Microi.MCP。</summary>
    [Route("api/V8Engine/[action]")]
    [Route("api/V8Debug/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [V8McpAuthorization]
    [V8McpRequiredBody]
    public class V8EngineController : Controller
    {
        private V8McpEndpointService Mcp => new V8McpEndpointService(HttpContext);

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStatus()
        {
            return await Mcp.GetStatus();
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngineList(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetApiEngineList(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            return await Mcp.GetApiEngine(osClient, apiEngineKey, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApiEngineCode(string osClient, string apiEngineKey, [FromBody] JObject param = null)
        {
            return await Mcp.GetApiEngineCode(osClient, apiEngineKey, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime, [FromBody] JObject param = null)
        {
            return await Mcp.GetUpdatedApiEngines(osClient, lastSyncTime, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject? param = null)
        {
            return await Mcp.UpdateApiEngineCode(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateApiEngine([FromBody] JObject param)
        {
            return await Mcp.CreateApiEngine(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadFileBase64([FromBody] JObject param)
        {
            return await Mcp.UploadFileBase64(param);
        }

        /// <summary>
        /// 将一个已编译应用资产以 multipart 二进制流直接写入 HDFS 历史版本目录。
        /// 文件体不会进入 JSON、Base64 或 Jint；RequestId 用于跨节点稳定重试，
        /// 稳定入口由完整清单确认接口统一切换。
        /// </summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        // The publisher performs strict byte[] readback, so one asset is bounded
        // to 128MiB. The 130MiB HTTP envelope leaves room for multipart metadata.
        [RequestSizeLimit(136314880L)]
        [RequestFormLimits(MultipartBodyLengthLimit = 136314880L)]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadApplicationAssetStream()
        {
            return await Mcp.UploadApplicationAssetStream();
        }

        /// <summary>
        /// 为单个不可变应用资产创建跨节点可恢复的 HDFS 分片上传会话。
        /// 会话、操作者、进度、心跳和错误检查点持久化到 mci_ai_app_file，
        /// 管理员可在 AI 应用文件/大文件上传记录中审计。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> InitiateApplicationAssetMultipart([FromBody] JObject param)
        {
            return await Mcp.InitiateApplicationAssetMultipart(param);
        }

        /// <summary>
        /// 回读已持久化的分片、字节进度、心跳、阶段和恢复提示。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationAssetMultipartStatus([FromBody] JObject param)
        {
            return await Mcp.GetApplicationAssetMultipartStatus(param);
        }

        /// <summary>
        /// 上传一个原始二进制分片。请求体不会进入 multipart/form-data、JSON、
        /// Base64 或 Jint；服务端按会话协商长度和 SHA-256 流式写入并回读复核。
        /// HTTP 层不设置总文件上限，单块大小由会话协商并受对象存储能力约束。
        /// </summary>
        [HttpPost]
        [Consumes("application/octet-stream")]
        [DisableRequestSizeLimit]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UploadApplicationAssetMultipartPart(
            [FromQuery] string osClient,
            [FromQuery] string sessionId,
            [FromQuery] int partNumber,
            [FromQuery] string expectedPartSha256)
        {
            return await Mcp.UploadApplicationAssetMultipartPart(osClient, sessionId, partNumber, expectedPartSha256);
        }

        /// <summary>
        /// 以有界内存将临时 HDFS 分片顺序合并到可删除临时文件，再流式写入
        /// 不可变最终对象，并再次
        /// 对最终对象执行全量 SHA-256 回读；可在节点重启后幂等重试。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CompleteApplicationAssetMultipart([FromBody] JObject param)
        {
            return await Mcp.CompleteApplicationAssetMultipart(param);
        }

        /// <summary>
        /// 取消未完成会话并清理临时块；审计记录保留，已完成的不可变最终对象
        /// 不允许通过此接口删除。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> AbortApplicationAssetMultipart([FromBody] JObject param)
        {
            return await Mcp.AbortApplicationAssetMultipart(param);
        }

        /// <summary>
        /// 校验完整版本清单，并通过 HDFS 服务端复制切换 root/latest 稳定入口。
        /// 请求只包含路径、大小、SHA-256、RequestId 与路由元数据，不包含文件体。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> FinalizeApplicationStreamPublish([FromBody] JObject param)
        {
            return await Mcp.FinalizeApplicationStreamPublish(param);
        }

        /// <summary>
        /// 以 ExpectedMode/MinProtocol/GateEpoch CAS 原子转换应用流式发布门禁。
        /// 服务端会重算 MCP 规范载荷 SHA-256；只有 literal true 的
        /// ConfirmExecution 与完全一致的 ConfirmationSha256 才允许写入。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> TransitionApplicationStreamGate([FromBody] JObject param)
        {
            return await Mcp.TransitionApplicationStreamGate(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetMicroService(string osClient, string msKey, [FromBody] JObject param = null)
        {
            return await Mcp.GetMicroService(osClient, msKey, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListApplications([FromBody] JObject param)
        {
            return await Mcp.ListApplications(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationContext([FromBody] JObject param)
        {
            return await Mcp.GetApplicationContext(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetApplicationFile([FromBody] JObject param)
        {
            return await Mcp.GetApplicationFile(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateMicroService([FromBody] JObject param)
        {
            return await Mcp.CreateMicroService(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SyncMicroServiceSource([FromBody] JObject param)
        {
            return await Mcp.SyncMicroServiceSource(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> ClearApplicationSource([FromBody] JObject param)
        {
            return await Mcp.ClearApplicationSource(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> PublishMicroService([FromBody] JObject param)
        {
            return await Mcp.PublishMicroService(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            return await Mcp.CheckVersions(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ExecuteApiEngine([FromBody] JObject param)
        {
            return await Mcp.ExecuteApiEngine(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetV8EventList(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetV8EventList(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetV8EventCode(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetV8EventCode(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            return await Mcp.UpdateV8EventCode(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowV8EventList(string? osClient, string? flowDesignId, [FromBody] JObject? param = null)
        {
            return await Mcp.GetWorkflowV8EventList(osClient, flowDesignId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowV8EventCode(string? osClient, string? flowDesignId, string? nodeId, string? eventType, [FromBody] JObject? param = null)
        {
            return await Mcp.GetWorkflowV8EventCode(osClient, flowDesignId, nodeId, eventType, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateWorkflowV8EventCode([FromBody] JObject param)
        {
            return await Mcp.UpdateWorkflowV8EventCode(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> QueryMongodbLogs(string? osClient, [FromBody] JObject? param = null)
        {
            return await Mcp.QueryMongodbLogs(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> WriteMongodbLog([FromBody] JObject? param)
        {
            return await Mcp.WriteMongodbLog(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            return await Mcp.ExecuteV8Event(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetDbSchema(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetDbSchema(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetTableIndexes(
            string osClient,
            string tableName,
            [FromBody] JObject param = null)
        {
            return await Mcp.GetTableIndexes(osClient, tableName, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> CreateTableIndex([FromBody] JObject param)
        {
            return await Mcp.CreateTableIndex(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> DropTableIndex([FromBody] JObject param)
        {
            return await Mcp.DropTableIndex(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetSupportedDatabaseTypes()
        {
            return await Mcp.GetSupportedDatabaseTypes();
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> InspectExternalDatabase([FromBody] JObject param)
        {
            return await Mcp.InspectExternalDatabase(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> QueryExternalDatabase([FromBody] JObject param)
        {
            return await Mcp.QueryExternalDatabase(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> ExecuteExternalDatabaseSql([FromBody] JObject param)
        {
            return await Mcp.ExecuteExternalDatabaseSql(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDatabaseConnection([FromBody] JObject param)
        {
            return await Mcp.SaveDatabaseConnection(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> ImportExternalAttachment([FromBody] JObject param)
        {
            return await Mcp.ImportExternalAttachment(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> GetPlaywrightContext(string osClient, string keyword, int? pageSize, [FromBody] JObject param = null)
        {
            return await Mcp.GetPlaywrightContext(osClient, keyword, pageSize, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateTable([FromBody] JObject param)
        {
            return await Mcp.CreateTable(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> AddField([FromBody] JObject param)
        {
            return await Mcp.AddField(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> CreateModule([FromBody] JObject param)
        {
            return await Mcp.CreateModule(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> DebugSession(string action, string sessionId, [FromBody] JObject param = null)
        {
            return await Mcp.DebugSession(action, sessionId, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SetRolePermission([FromBody] JObject param)
        {
            return await Mcp.SetRolePermission(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListRoles(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListRoles(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveRole([FromBody] JObject param)
        {
            return await Mcp.SaveRole(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListModules(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListModules(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetModule(string osClient, string moduleId, [FromBody] JObject param = null)
        {
            return await Mcp.GetModule(osClient, moduleId, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateModule([FromBody] JObject param)
        {
            return await Mcp.UpdateModule(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListDataSources(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListDataSources(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDataSource([FromBody] JObject param)
        {
            return await Mcp.SaveDataSource(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListPrintTemplates(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListPrintTemplates(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SavePrintTemplate([FromBody] JObject param)
        {
            return await Mcp.SavePrintTemplate(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveWorkflowPackage([FromBody] JObject param)
        {
            return await Mcp.SaveWorkflowPackage(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveJob([FromBody] JObject param)
        {
            return await Mcp.SaveJob(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> ListDatabaseBackupTenants(
            string osClient,
            [FromBody] JObject param = null)
        {
            return await Mcp.ListDatabaseBackupTenants(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> RunDatabaseBackup([FromBody] JObject param)
        {
            return await Mcp.RunDatabaseBackup(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> GetDatabaseBackupSettings(
            string osClient,
            [FromBody] JObject param = null)
        {
            return await Mcp.GetDatabaseBackupSettings(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SaveDatabaseBackupSettings([FromBody] JObject param)
        {
            return await Mcp.SaveDatabaseBackupSettings(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ValidateLowCodeSystem([FromBody] JObject param)
        {
            return await Mcp.ValidateLowCodeSystem(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> WriteMcpAuditLog([FromBody] JObject param)
        {
            return await Mcp.WriteMcpAuditLog(param);
        }


        #region AdminData

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> GetAdministrativeCapabilities()
        {
            return await Mcp.GetAdministrativeCapabilities();
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> AdministerTableData([FromBody] JObject param)
        {
            return await Mcp.AdministerTableData(param);
        }
        #endregion


        #region Automation

        #region 状态机（State Machine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListStateMachines(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListStateMachines(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStateMachine(string osClient, string id, [FromBody] JObject param = null)
        {
            return await Mcp.GetStateMachine(osClient, id, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveStateMachine([FromBody] JObject param)
        {
            return await Mcp.SaveStateMachine(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteStateMachine([FromBody] JObject param)
        {
            return await Mcp.DeleteStateMachine(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> TransitionState([FromBody] JObject param)
        {
            return await Mcp.TransitionState(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetStateHistory(string osClient, string tableName, string rowId, [FromBody] JObject param = null)
        {
            return await Mcp.GetStateHistory(osClient, tableName, rowId, param);
        }

        #endregion

        #region 自动化流（Flow Engine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListFlows(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListFlows(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlow(string osClient, string id, [FromBody] JObject param = null)
        {
            return await Mcp.GetFlow(osClient, id, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveFlow([FromBody] JObject param)
        {
            return await Mcp.SaveFlow(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteFlow([FromBody] JObject param)
        {
            return await Mcp.DeleteFlow(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> RunFlow([FromBody] JObject param)
        {
            return await Mcp.RunFlow(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlowRuns(string osClient, string flowId, [FromBody] JObject param = null)
        {
            return await Mcp.GetFlowRuns(osClient, flowId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFlowRunDetail(string osClient, string runId, [FromBody] JObject param = null)
        {
            return await Mcp.GetFlowRunDetail(osClient, runId, param);
        }

        #endregion

        #region 流程挖掘（Process Mining）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> AnalyzeWorkflow(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            return await Mcp.AnalyzeWorkflow(osClient, flowDesignId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetHotPaths(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            return await Mcp.GetHotPaths(osClient, flowDesignId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetSlaViolations(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            return await Mcp.GetSlaViolations(osClient, flowDesignId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBottlenecks(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            return await Mcp.GetBottlenecks(osClient, flowDesignId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetWorkflowOverview(string osClient, string flowDesignId, [FromBody] JObject param = null)
        {
            return await Mcp.GetWorkflowOverview(osClient, flowDesignId, param);
        }

        #endregion
        #endregion


        #region Blueprint

        #region 业务架构蓝图（System Blueprint）

        /// <summary>
        /// 列出当前 OsClient 的所有业务蓝图（不含 BlueprintData）
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListBlueprints(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.ListBlueprints(osClient, param);
        }

        /// <summary>
        /// 将单个 Web/UniApp/MicroService 源码文件流式写入租户私有暂存区。
        /// 暂存不会修改当前活动源码；完整清单必须再调用
        /// FinalizeMicroServiceSourceManifest 才会原子切换。
        /// </summary>
        [HttpPost]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(136314880L)]
        [RequestFormLimits(MultipartBodyLengthLimit = 136314880L)]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> StageMicroServiceSourceFile()
        {
            return await Mcp.StageMicroServiceSourceFile();
        }

        /// <summary>
        /// 校验租户私有暂存区的完整源码清单，并在应用分布式锁内通过
        /// CurrentVersion/AppVersion/SourceManifestHash CAS 原子替换活动源码元数据。
        /// 公开运行产物不参与此次切换。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> FinalizeMicroServiceSourceManifest([FromBody] JObject param)
        {
            return await Mcp.FinalizeMicroServiceSourceManifest(param);
        }

        /// <summary>
        /// 获取单个蓝图详情（含 BlueprintData JSON 全文）
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            return await Mcp.GetBlueprint(osClient, blueprintId, param);
        }

        /// <summary>
        /// 分页读取蓝图历史元数据。列表不返回 BlueprintData 全文，只返回内容长度和稳定 Hash。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListBlueprintHistory(
            string osClient,
            string blueprintId,
            int pageIndex = 1,
            int pageSize = 50,
            [FromBody] JObject param = null)
        {
            return await Mcp.ListBlueprintHistory(osClient, blueprintId, pageIndex, pageSize, param);
        }

        /// <summary>
        /// 读取一条蓝图历史快照全文。HistoryId 必须属于指定蓝图和当前租户。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetBlueprintHistory(
            string osClient,
            string blueprintId,
            string historyId,
            [FromBody] JObject param = null)
        {
            return await Mcp.GetBlueprintHistory(osClient, blueprintId, historyId, param);
        }

        /// <summary>
        /// 对蓝图历史做语义 JSON 差异比较。RightHistoryId 为空时与当前草稿比较；
        /// LeftHistoryId 为空时自动使用最近一条历史。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> CompareBlueprintVersions(
            string osClient,
            string blueprintId,
            string leftHistoryId,
            string rightHistoryId,
            [FromBody] JObject param = null)
        {
            return await Mcp.CompareBlueprintVersions(osClient, blueprintId, leftHistoryId, rightHistoryId, param);
        }

        /// <summary>
        /// 导出当前蓝图为带 Schema 与稳定内容哈希的可移植 JSON 设计包。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ExportBlueprint(
            string osClient,
            string blueprintId,
            [FromBody] JObject param = null)
        {
            return await Mcp.ExportBlueprint(osClient, blueprintId, param);
        }

        /// <summary>
        /// 创建或更新蓝图。规则：
        ///   - 传 Id 命中 → Update；否则按 Name 命中 → Update；否则 Create
        ///   - 自动写入历史快照（sys_blueprint_history）
        ///   - 自动重建反向引用索引（sys_blueprint_relation）
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SaveBlueprint([FromBody] JObject param)
        {
            return await Mcp.SaveBlueprint(param);
        }

        /// <summary>
        /// 删除蓝图（软删除主表 + 同步删反向索引；保留历史快照用于回溯）
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> DeleteBlueprint([FromBody] JObject param)
        {
            return await Mcp.DeleteBlueprint(param);
        }

        /// <summary>
        /// 按历史快照回滚蓝图。历史本身不可修改；回滚前自动保存当前快照。
        /// ExpectedCurrentHash 用于阻止多节点或多人并发覆盖。
        /// </summary>
        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> RollbackBlueprint([FromBody] JObject param)
        {
            return await Mcp.RollbackBlueprint(param);
        }

        /// <summary>
        /// 验证蓝图引用的所有平台资源是否存在（漂移检测）。
        /// 返回 errors/warnings/CheckedRefs 统计，AI 据此决定是否需先修复蓝图再生成代码。
        /// </summary>
        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> ValidateBlueprint(string osClient, string blueprintId, [FromBody] JObject param = null)
        {
            return await Mcp.ValidateBlueprint(osClient, blueprintId, param);
        }

        #endregion
        #endregion


        #region PageAndSchema

        #region 界面引擎（Page Engine）

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineList(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetPageEngineList(osClient, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineDetail(string osClient, [FromBody] JObject param = null)
        {
            return await Mcp.GetPageEngineDetail(osClient, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> SavePageEngine([FromBody] JObject param)
        {
            return await Mcp.SavePageEngine(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ListPageEngineHistory(
            string osClient, string pageId, int pageIndex = 1, int pageSize = 50,
            [FromBody] JObject param = null)
        {
            return await Mcp.ListPageEngineHistory(osClient, pageId, pageIndex, pageSize, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetPageEngineHistory(
            string osClient, string pageId, string historyId,
            [FromBody] JObject param = null)
        {
            return await Mcp.GetPageEngineHistory(osClient, pageId, historyId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ComparePageEngineVersions(
            string osClient, string pageId, string leftHistoryId, string rightHistoryId,
            [FromBody] JObject param = null)
        {
            return await Mcp.ComparePageEngineVersions(osClient, pageId, leftHistoryId, rightHistoryId, param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> ExportPageEngine(
            string osClient, string pageId, [FromBody] JObject param = null)
        {
            return await Mcp.ExportPageEngine(osClient, pageId, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> RollbackPageEngine([FromBody] JObject param)
        {
            return await Mcp.RollbackPageEngine(param);
        }

        #endregion

        #region MCP 扩展（字段/表/缓存/匿名）

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateField([FromBody] JObject param)
        {
            return await Mcp.UpdateField(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateFieldList([FromBody] JObject param)
        {
            return await Mcp.UpdateFieldList(param);
        }

        [HttpGet, HttpPost]
        [V8McpCapability(V8McpScope.Read)]
        public async Task<IActionResult> GetFieldList(string? osClient, string? tableId, string? tableName = null, [FromBody] JObject? param = null)
        {
            return await Mcp.GetFieldList(osClient, tableId, tableName, param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Write)]
        public async Task<IActionResult> UpdateTable([FromBody] JObject param)
        {
            return await Mcp.UpdateTable(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Execute)]
        public async Task<IActionResult> RefreshSchemaCache([FromBody] JObject param)
        {
            return await Mcp.RefreshSchemaCache(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SetEngineAnonymous([FromBody] JObject param)
        {
            return await Mcp.SetEngineAnonymous(param);
        }

        [HttpPost]
        [V8McpCapability(V8McpScope.Admin)]
        public async Task<IActionResult> SetEngineRoles([FromBody] JObject param)
        {
            return await Mcp.SetEngineRoles(param);
        }

        #endregion
        #endregion
    }
}
