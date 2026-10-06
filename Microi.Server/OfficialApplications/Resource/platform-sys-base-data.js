/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-base-data
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-base-data
 * Version: v1.0.2
 * Function:
 * - 系统基础数据查询与维护，兼容历史地址并保持当前租户权限。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/sysbasedata/addsysbasedata": "AddSysBaseData",
  "/api/sysbasedata/delsysbasedata": "DelSysBaseData",
  "/api/sysbasedata/uptsysbasedata": "UptSysBaseData",
  "/api/sysbasedata/getsysbasedata": "GetSysBaseData",
  "/api/sysbasedata/getsysbasedata_biz": "GetSysBaseData_Biz",
  "/api/sysbasedata/getsysbasedatastep": "GetSysBaseDataStep",
  "/api/sysbasedata/getsysbasedatapa": "GetSysBaseDataPa"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */
// Microi官方接口引擎：platform-sys-base-data
// Version: v1.0.0
// 基础数据业务编排由应用商城交付；C# 只保留固定租户、权限与缓存语义的原子能力。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysBaseData: 1,
  DelSysBaseData: 1,
  UptSysBaseData: 1,
  GetSysBaseData: 1,
  GetSysBaseData_Biz: 1,
  GetSysBaseDataStep: 1,
  GetSysBaseDataPa: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的基础数据动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysBaseData',
  Action: action,
  Param: V8.Param
});
