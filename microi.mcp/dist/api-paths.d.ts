/**
 * Microi MCP Server API 端点路径（统一管理）
 * 对应后端 V8EngineController（MCP 专用控制器）
 */
export declare const API: {
    readonly LOGIN: "/api/SysUser/Login";
    readonly REFRESH_TOKEN: "/api/SysUser/RefreshToken";
    readonly GET_STATUS: "/api/V8Engine/GetStatus";
    readonly GET_DB_SCHEMA: "/api/V8Engine/GetDbSchema";
    readonly GET_ENGINE_LIST: "/api/V8Engine/GetApiEngineList";
    readonly GET_ENGINE_CODE: "/api/V8Engine/GetApiEngineCode";
    readonly UPDATE_ENGINE_CODE: "/api/V8Engine/UpdateApiEngineCode";
    readonly CREATE_ENGINE: "/api/V8Engine/CreateApiEngine";
    readonly EXECUTE_ENGINE: "/api/V8Engine/ExecuteApiEngine";
    readonly GET_EVENT_LIST: "/api/V8Engine/GetV8EventList";
    readonly GET_EVENT_CODE: "/api/V8Engine/GetV8EventCode";
    readonly UPDATE_EVENT_CODE: "/api/V8Engine/UpdateV8EventCode";
    readonly CREATE_TABLE: "/api/V8Engine/CreateTable";
    readonly ADD_FIELD: "/api/V8Engine/AddField";
    readonly CREATE_MODULE: "/api/V8Engine/CreateModule";
    readonly SET_ROLE_PERMISSION: "/api/V8Engine/SetRolePermission";
};
//# sourceMappingURL=api-paths.d.ts.map