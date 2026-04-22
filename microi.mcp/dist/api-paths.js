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
    // 接口引擎
    GET_ENGINE_LIST: '/api/V8Engine/GetApiEngineList',
    GET_ENGINE_CODE: '/api/V8Engine/GetApiEngineCode',
    UPDATE_ENGINE_CODE: '/api/V8Engine/UpdateApiEngineCode',
    CREATE_ENGINE: '/api/V8Engine/CreateApiEngine',
    EXECUTE_ENGINE: '/api/V8Engine/ExecuteApiEngine',
    // V8 事件
    GET_EVENT_LIST: '/api/V8Engine/GetV8EventList',
    GET_EVENT_CODE: '/api/V8Engine/GetV8EventCode',
    UPDATE_EVENT_CODE: '/api/V8Engine/UpdateV8EventCode',
    // 低代码系统设计
    CREATE_TABLE: '/api/V8Engine/CreateTable',
    ADD_FIELD: '/api/V8Engine/AddField',
    CREATE_MODULE: '/api/V8Engine/CreateModule',
    SET_ROLE_PERMISSION: '/api/V8Engine/SetRolePermission',
    // 界面引擎（Page Engine）
    GET_PAGE_ENGINE_LIST: '/api/V8Engine/GetPageEngineList',
    GET_PAGE_ENGINE_DETAIL: '/api/V8Engine/GetPageEngineDetail',
    SAVE_PAGE_ENGINE: '/api/V8Engine/SavePageEngine',
};
//# sourceMappingURL=api-paths.js.map