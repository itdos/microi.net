/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-os-legacy-compatibility
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-os-legacy-compatibility
 * Version: v1.0.4
 * Function:
 * - 旧 OS 地址兼容、当前租户健康诊断与初始化；版本、二维码、授权硬件信息由可信后端原子提供。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/os/diyupdate": "DiyUpdate",
  "/api/os/checkserver": "CheckServer",
  "/api/os/osclientinit": "OsClientInit",
  "/api/os/dynamicapiengineinit": "DynamicApiEngineInit"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */

// 旧地址固定对应动作，兼容 getDateTimeNow 等大小写及 --OsClient--租户-- 后缀。
var route = String(V8.Param._RequestPath || V8.Param.ApiAddress || '').replace(/\?.*$/, '').replace(/--OsClient--.*?--$/i, '');
var segments = route.split('/');
var action = String(V8.Param.Action || '').trim();
if (!action || /^\/api\/os\//i.test(route)) action = segments[segments.length - 1] || '';
var names = {
  diyupdate:'DiyUpdate', checkserver:'CheckServer', osclientinit:'OsClientInit', dynamicapiengineinit:'DynamicApiEngineInit', getosversion:'GetOsVersion', createqrcode:'CreateQRCode', createqrcodeimage:'CreateQRCodeImage',
  getmicroinetversion:'GetMicroiNetVersion', getosclient:'GetOsClient', gethid:'GetHID',
  getdatetimenow:'GetDateTimeNow', microinetinitcheck:'MicroiNetInitCheck'
};
action = names[String(action).toLowerCase()] || '';
if (!action) return { Code:0, Msg:'不支持的旧 OS 兼容动作。' };
return V8.Method.RunPlatformApiRuntime({
  RuntimeKey:'LegacyOs', Action:action, Param:V8.Param || {}
});
