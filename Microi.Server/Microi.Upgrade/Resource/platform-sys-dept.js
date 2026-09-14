/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-dept
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-dept
 * Version: v1.0.4
 * Function:
 * - 系统部门树与部门维护，兼容历史地址并保持当前租户权限。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/sysdept/addsysdept": "AddSysDept",
  "/api/sysdept/delsysdept": "DelSysDept",
  "/api/sysdept/uptsysdept": "UptSysDept",
  "/api/sysdept/getsysdept": "GetSysDept",
  "/api/sysdept/getsysdeptmodel": "GetSysDeptModel",
  "/api/sysdept/getsysdeptstep": "GetSysDeptStep"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */

// Microi官方接口引擎：platform-sys-dept
// Version: v1.0.1
// 组织机构业务编排由应用商城交付；C# 原子层固定当前租户与管理员写权限。
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
var param = V8.Param || {};
var path = String(param._RequestPath || param.ApiAddress || '').split('?')[0]
  .replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
// 旧客户端只传 Sys_Dept，无 Action。可信请求路径固定为读树，不能用请求中的 Action 改成写操作。
var requested = path === '/api/sysdept/getsysdeptstep'
  ? 'getsysdeptstep' : String(param.Action || '').trim().toLowerCase();
var allowed = ['AddSysDept', 'DelSysDept', 'UptSysDept', 'GetSysDept', 'GetSysDeptModel', 'GetSysDeptStep'];
var action = '';
for (var i = 0; i < allowed.length; i++) {
  if (allowed[i].toLowerCase() === requested) { action = allowed[i]; break; }
}
if (!action) return { Code: 0, Msg: '不支持的组织机构动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysDept',
  Action: action,
  Param: V8.Param
});
