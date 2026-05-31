/**
 * Microi MCP Server API 端点路径（统一管理）
 * 对应后端 V8EngineController（MCP 专用控制器）
 */
export declare const API: {
    readonly LOGIN: "/api/SysUser/Login";
    readonly REFRESH_TOKEN: "/api/SysUser/RefreshToken";
    readonly GET_STATUS: "/api/V8Engine/GetStatus";
    readonly GET_DB_SCHEMA: "/api/V8Engine/GetDbSchema";
    readonly GET_PLAYWRIGHT_CONTEXT: "/api/V8Engine/GetPlaywrightContext";
    readonly GET_ENGINE_LIST: "/api/V8Engine/GetApiEngineList";
    readonly GET_ENGINE_CODE: "/api/V8Engine/GetApiEngineCode";
    readonly UPDATE_ENGINE_CODE: "/api/V8Engine/UpdateApiEngineCode";
    readonly CREATE_ENGINE: "/api/V8Engine/CreateApiEngine";
    readonly EXECUTE_ENGINE: "/api/V8Engine/ExecuteApiEngine";
    readonly UPLOAD_FILE_BASE64: "/api/V8Engine/UploadFileBase64";
    readonly GET_EVENT_LIST: "/api/V8Engine/GetV8EventList";
    readonly GET_EVENT_CODE: "/api/V8Engine/GetV8EventCode";
    readonly UPDATE_EVENT_CODE: "/api/V8Engine/UpdateV8EventCode";
    readonly GET_WORKFLOW_V8_EVENT_LIST: "/api/V8Engine/GetWorkflowV8EventList";
    readonly GET_WORKFLOW_V8_EVENT_CODE: "/api/V8Engine/GetWorkflowV8EventCode";
    readonly UPDATE_WORKFLOW_V8_EVENT_CODE: "/api/V8Engine/UpdateWorkflowV8EventCode";
    readonly CREATE_TABLE: "/api/V8Engine/CreateTable";
    readonly ADD_FIELD: "/api/V8Engine/AddField";
    readonly GET_FIELD_LIST: "/api/V8Engine/GetFieldList";
    readonly UPDATE_FIELD: "/api/V8Engine/UpdateField";
    readonly UPDATE_TABLE: "/api/V8Engine/UpdateTable";
    readonly REFRESH_SCHEMA_CACHE: "/api/V8Engine/RefreshSchemaCache";
    readonly SET_ENGINE_ANONYMOUS: "/api/V8Engine/SetEngineAnonymous";
    readonly CREATE_MODULE: "/api/V8Engine/CreateModule";
    readonly SET_ROLE_PERMISSION: "/api/V8Engine/SetRolePermission";
    readonly LIST_ROLES: "/api/V8Engine/ListRoles";
    readonly SAVE_ROLE: "/api/V8Engine/SaveRole";
    readonly LIST_MODULES: "/api/V8Engine/ListModules";
    readonly GET_MODULE: "/api/V8Engine/GetModule";
    readonly UPDATE_MODULE: "/api/V8Engine/UpdateModule";
    readonly LIST_DATA_SOURCES: "/api/V8Engine/ListDataSources";
    readonly SAVE_DATA_SOURCE: "/api/V8Engine/SaveDataSource";
    readonly LIST_PRINT_TEMPLATES: "/api/V8Engine/ListPrintTemplates";
    readonly SAVE_PRINT_TEMPLATE: "/api/V8Engine/SavePrintTemplate";
    readonly SAVE_WORKFLOW_PACKAGE: "/api/V8Engine/SaveWorkflowPackage";
    readonly SAVE_JOB: "/api/V8Engine/SaveJob";
    readonly VALIDATE_LOW_CODE_SYSTEM: "/api/V8Engine/ValidateLowCodeSystem";
    readonly WRITE_MCP_AUDIT_LOG: "/api/V8Engine/WriteMcpAuditLog";
    readonly QUERY_MONGODB_LOGS: "/api/V8Engine/QueryMongodbLogs";
    readonly WRITE_MONGODB_LOG: "/api/V8Engine/WriteMongodbLog";
    readonly RUN_DATA_SOURCE: "/api/DataSourceEngine/Run";
    readonly FORM_GET_TABLE_DATA: "/api/FormEngine/GetTableData";
    readonly FORM_ADD_FORM_DATA: "/api/FormEngine/AddFormData";
    readonly FORM_UPT_FORM_DATA: "/api/FormEngine/UptFormData";
    readonly GET_PAGE_ENGINE_LIST: "/api/V8Engine/GetPageEngineList";
    readonly GET_PAGE_ENGINE_DETAIL: "/api/V8Engine/GetPageEngineDetail";
    readonly SAVE_PAGE_ENGINE: "/api/V8Engine/SavePageEngine";
    readonly LIST_BLUEPRINTS: "/api/V8Engine/ListBlueprints";
    readonly GET_BLUEPRINT: "/api/V8Engine/GetBlueprint";
    readonly SAVE_BLUEPRINT: "/api/V8Engine/SaveBlueprint";
    readonly DELETE_BLUEPRINT: "/api/V8Engine/DeleteBlueprint";
    readonly VALIDATE_BLUEPRINT: "/api/V8Engine/ValidateBlueprint";
};
//# sourceMappingURL=api-paths.d.ts.map