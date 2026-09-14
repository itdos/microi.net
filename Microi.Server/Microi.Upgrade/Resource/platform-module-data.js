/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-module-data
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-module-data
 * Version: v1.0.2
 * Function:
 * - 模块数据查询与业务操作入口，复用模块引擎权限、筛选和事务能力。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/moduleengine/gettabledata": "GetTableData",
  "/api/moduleengine/gettabledatacount": "GetTableDataCount",
  "/api/moduleengine/gettabletree": "GetTableTree",
  "/api/moduleengine/gettabledatatree": "GetTableDataTree"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
/* V8 ApiEngine | ApiEngineKey: platform-module-data | Version: v1.0.0 */
var p = V8.Param || {};
var action = String(p.Action || "GetTableData").substring(0, 50);
var moduleKey = String(p.ModuleEngineKey || "").substring(0, 200);
var beforeHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "BeforeModuleData",
    SourceApiEngineKey: "platform-module-data",
    Action: action,
    ModuleEngineKey: moduleKey
});
if (!beforeHook || beforeHook.Code != 1) return beforeHook || { Code: 0, Msg: "模块查询个性化 Hook 未返回结果。" };

var result = V8.Method.RunModuleEngine(p);
var afterHook = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "AfterModuleData",
    SourceApiEngineKey: "platform-module-data",
    Action: action,
    ModuleEngineKey: moduleKey,
    ResultCode: result ? result.Code : 0
});
if (!afterHook || afterHook.Code != 1) return afterHook || { Code: 0, Msg: "模块查询个性化 Hook 未返回结果。" };
return result;
