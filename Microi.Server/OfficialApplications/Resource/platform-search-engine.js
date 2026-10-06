/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-search-engine
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-search-engine
 * Version: v1.0.2
 * Function:
 * - 搜索引擎查询、索引与配置维护入口，固定历史地址动作并保持授权约束。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/searchengine/asyncindex": "AsyncIndex",
  "/api/searchengine/adddocument": "AddDocument",
  "/api/searchengine/updatedocument": "UpdateDocument",
  "/api/searchengine/deletedocument": "DeleteDocument",
  "/api/searchengine/addfield": "AddField",
  "/api/searchengine/searchbypage": "SearchByPage",
  "/api/searchengine/searchbysearchafter": "SearchBySearchAfter",
  "/api/searchengine/asynctabledatatoindex": "AsyncTableDataToIndex"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
// Microi官方接口引擎：platform-search-engine
// Version: v1.0.0
// 索引协议由搜索插件处理；动作、权限与应用版本通过接口引擎交付。
return V8.Method.ManageSearchEngine(V8.Param || {});
