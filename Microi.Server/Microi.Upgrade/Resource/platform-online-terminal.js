/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-online-terminal
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-online-terminal
 * Version: v1.0.2
 * Function:
 * - 当前租户在线终端、会话列表与终端管理入口。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/onlineterminal/mine": "Mine",
  "/api/onlineterminal/list": "List",
  "/api/onlineterminal/kick": "Kick"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
// Microi官方接口引擎：platform-online-terminal
// Version: v1.0.0
// SignalR/令牌终端运行时由 V8 最小原子能力提供；接口引擎保留可商城升级的动作编排。

var action = String((V8.Param && V8.Param.Action) || '').trim();
if (action !== 'Mine' && action !== 'List' && action !== 'Kick') {
  return { Code: 0, Msg: '不支持的在线终端动作。' };
}

var customization = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeOnlineTerminalAction',
  SourceApiEngineKey: 'platform-online-terminal',
  Action: action
});
if (!customization || customization.Code !== 1) {
  return customization || { Code: 0, Msg: '在线终端个性化 Hook 未返回结果。' };
}
return V8.Method.ManageOnlineTerminal(V8.Param);
