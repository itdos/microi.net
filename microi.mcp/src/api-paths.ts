/**
 * Microi MCP Server API 端点路径（统一管理）
 * 对应后端 V8EngineController（MCP 专用控制器）
 */
export const API = {
  // 登录 & Token
  LOGIN: '/api/SysUser/Login',
  REFRESH_TOKEN: '/api/SysUser/RefreshToken',

  // 服务器状态
  GET_STATUS: '/api/V8Engine/GetStatus',

  // 数据库结构
  GET_DB_SCHEMA: '/api/V8Engine/GetDbSchema',
  GET_PLAYWRIGHT_CONTEXT: '/api/V8Engine/GetPlaywrightContext',

  // 接口引擎
  GET_ENGINE_LIST: '/api/V8Engine/GetApiEngineList',
  GET_ENGINE_CODE: '/api/V8Engine/GetApiEngineCode',
  UPDATE_ENGINE_CODE: '/api/V8Engine/UpdateApiEngineCode',
  CREATE_ENGINE: '/api/V8Engine/CreateApiEngine',
  EXECUTE_ENGINE: '/api/V8Engine/ExecuteApiEngine',
  UPLOAD_FILE_BASE64: '/api/V8Engine/UploadFileBase64',

  // V8 事件
  GET_EVENT_LIST: '/api/V8Engine/GetV8EventList',
  GET_EVENT_CODE: '/api/V8Engine/GetV8EventCode',
  UPDATE_EVENT_CODE: '/api/V8Engine/UpdateV8EventCode',
  GET_WORKFLOW_V8_EVENT_LIST: '/api/V8Engine/GetWorkflowV8EventList',
  GET_WORKFLOW_V8_EVENT_CODE: '/api/V8Engine/GetWorkflowV8EventCode',
  UPDATE_WORKFLOW_V8_EVENT_CODE: '/api/V8Engine/UpdateWorkflowV8EventCode',

  // 低代码系统设计
  CREATE_TABLE: '/api/V8Engine/CreateTable',
  ADD_FIELD: '/api/V8Engine/AddField',
  GET_FIELD_LIST: '/api/V8Engine/GetFieldList',
  UPDATE_FIELD: '/api/V8Engine/UpdateField',
  UPDATE_TABLE: '/api/V8Engine/UpdateTable',
  REFRESH_SCHEMA_CACHE: '/api/V8Engine/RefreshSchemaCache',
  SET_ENGINE_ANONYMOUS: '/api/V8Engine/SetEngineAnonymous',
  CREATE_MODULE: '/api/V8Engine/CreateModule',
  SET_ROLE_PERMISSION: '/api/V8Engine/SetRolePermission',
  LIST_ROLES: '/api/V8Engine/ListRoles',
  SAVE_ROLE: '/api/V8Engine/SaveRole',
  LIST_MODULES: '/api/V8Engine/ListModules',
  GET_MODULE: '/api/V8Engine/GetModule',
  UPDATE_MODULE: '/api/V8Engine/UpdateModule',
  LIST_DATA_SOURCES: '/api/V8Engine/ListDataSources',
  SAVE_DATA_SOURCE: '/api/V8Engine/SaveDataSource',
  LIST_PRINT_TEMPLATES: '/api/V8Engine/ListPrintTemplates',
  SAVE_PRINT_TEMPLATE: '/api/V8Engine/SavePrintTemplate',
  SAVE_WORKFLOW_PACKAGE: '/api/V8Engine/SaveWorkflowPackage',
  SAVE_JOB: '/api/V8Engine/SaveJob',
  VALIDATE_LOW_CODE_SYSTEM: '/api/V8Engine/ValidateLowCodeSystem',
  WRITE_MCP_AUDIT_LOG: '/api/V8Engine/WriteMcpAuditLog',
  QUERY_MONGODB_LOGS: '/api/V8Engine/QueryMongodbLogs',
  WRITE_MONGODB_LOG: '/api/V8Engine/WriteMongodbLog',

  // 原生引擎接口（用于验收/调试）
  RUN_DATA_SOURCE: '/api/DataSourceEngine/Run',

  // 通用 FormEngine 数据读写（用于租户业务数据维护）
  FORM_GET_TABLE_DATA: '/api/FormEngine/GetTableData',
  FORM_ADD_FORM_DATA: '/api/FormEngine/AddFormData',
  FORM_UPT_FORM_DATA: '/api/FormEngine/UptFormData',

  // 界面引擎（Page Engine）
  GET_PAGE_ENGINE_LIST: '/api/V8Engine/GetPageEngineList',
  GET_PAGE_ENGINE_DETAIL: '/api/V8Engine/GetPageEngineDetail',
  SAVE_PAGE_ENGINE: '/api/V8Engine/SavePageEngine',

  // 业务架构蓝图（System Blueprint）
  LIST_BLUEPRINTS: '/api/V8Engine/ListBlueprints',
  GET_BLUEPRINT: '/api/V8Engine/GetBlueprint',
  SAVE_BLUEPRINT: '/api/V8Engine/SaveBlueprint',
  DELETE_BLUEPRINT: '/api/V8Engine/DeleteBlueprint',
  VALIDATE_BLUEPRINT: '/api/V8Engine/ValidateBlueprint',
} as const;
