/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：admin_upgrade_saas_tenant_database
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: admin_upgrade_saas_tenant_database
 * Version: v1.0.8
 * Function:
 * - 主租户超级管理员通过持久后台任务，对权威 sys_osclients 中精确选中的子租户执行幂等数据库升级。
 */

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

var allowedInputKeys = {
  TenantId: true, Id: true, TenantKey: true, OsClient: true, Key: true,
  OsClientType: true, OsClientNetwork: true,
  _BackgroundTaskId: true, BackgroundTaskId: true,
  _BackgroundTaskFencingToken: true, FencingToken: true,
  ApiEngineKey: true, _InvokeType: true, _CurrentUser: true, TestParam1: true,
  _RequireApiRoleAuthorization: true, _TraceParent: true,
  _BackgroundTaskTitle: true, _BackgroundTaskIdempotencyKey: true,
  _BackgroundTaskAttempt: true, _TrustedServerInvocation: true,
  _BackgroundTask: true
};
var inputKeys = Object.keys(V8.Param || {});
var unknownInputKeys = [];
for (var inputIndex = 0; inputIndex < inputKeys.length; inputIndex++) {
  if (!allowedInputKeys[inputKeys[inputIndex]]) {
    unknownInputKeys.push(inputKeys[inputIndex]);
  }
}
if (unknownInputKeys.length) {
  return {
    Code: 0,
    Msg: '请求包含未允许的字段：' + unknownInputKeys.join(', ') + '，已拒绝执行。'
  };
}
if (V8.Param.TestParam1 !== null && V8.Param.TestParam1 !== undefined
    && (typeof V8.Param.TestParam1 === 'object'
      || String(V8.Param.TestParam1).length > 200)) {
  return { Code: 0, Msg: '兼容占位参数不符合安全约束，已拒绝执行。' };
}
if (V8.Param._RequireApiRoleAuthorization !== null
    && V8.Param._RequireApiRoleAuthorization !== undefined
    && V8.Param._RequireApiRoleAuthorization !== true
    && Number(V8.Param._RequireApiRoleAuthorization) !== 1) {
  return { Code: 0, Msg: '后台任务授权上下文不符合安全约束，已拒绝执行。' };
}
if (V8.Param._TrustedServerInvocation !== null
    && V8.Param._TrustedServerInvocation !== undefined
    && V8.Param._TrustedServerInvocation !== true
    && Number(V8.Param._TrustedServerInvocation) !== 1) {
  return { Code: 0, Msg: '后台任务可信调用上下文不合法，已拒绝执行。' };
}
if (V8.Param._TrustedServerInvocation !== true
    && Number(V8.Param._TrustedServerInvocation) !== 1) {
  return { Code: 0, Msg: '仅允许可信服务端持久后台任务执行。' };
}
if (V8.Param._BackgroundTaskAttempt !== null
    && V8.Param._BackgroundTaskAttempt !== undefined
    && (!Number.isInteger(Number(V8.Param._BackgroundTaskAttempt))
      || Number(V8.Param._BackgroundTaskAttempt) < 0
      || Number(V8.Param._BackgroundTaskAttempt) > 1000)) {
  return { Code: 0, Msg: '后台任务尝试次数不合法，已拒绝执行。' };
}
if (toText(V8.Param._BackgroundTaskTitle).length > 200
    || toText(V8.Param._BackgroundTaskIdempotencyKey).length > 200) {
  return { Code: 0, Msg: '后台任务标题或幂等键过长，已拒绝执行。' };
}
if (V8.Param._BackgroundTask !== null
    && V8.Param._BackgroundTask !== undefined
    && typeof V8.Param._BackgroundTask !== 'object') {
  return { Code: 0, Msg: '后台任务上下文格式不合法，已拒绝执行。' };
}
if (toText(V8.Param._TraceParent)
    && !/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(toText(V8.Param._TraceParent))) {
  return { Code: 0, Msg: '调用链路上下文不合法，已拒绝执行。' };
}
if (toText(V8.Param.ApiEngineKey)
    && toText(V8.Param.ApiEngineKey).toLowerCase() !== 'admin_upgrade_saas_tenant_database') {
  return { Code: 0, Msg: '运行接口上下文不匹配，已拒绝执行。' };
}
if (toText(V8.Param._InvokeType)
    && toText(V8.Param._InvokeType).toLowerCase() !== 'client') {
  return { Code: 0, Msg: '仅允许可信服务端后台任务执行。' };
}

var backgroundTaskId = toText(V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId);
var fencingToken = V8.Param._BackgroundTaskFencingToken || V8.Param.FencingToken || 0;

function report(progress, msg) {
  if (!backgroundTaskId || !V8.Method || typeof V8.Method.UpdateBackgroundTask !== 'function') return;
  V8.Method.UpdateBackgroundTask({
    _BackgroundTaskId: backgroundTaskId,
    Progress: progress,
    Msg: msg,
    Message: msg,
    Log: msg
  });
}

var tenantId = toText(V8.Param.TenantId || V8.Param.Id);
var tenantKey = toText(V8.Param.TenantKey || V8.Param.OsClient || V8.Param.Key);
var osClientType = toText(V8.Param.OsClientType);
var osClientNetwork = toText(V8.Param.OsClientNetwork);

if (!backgroundTaskId || !fencingToken) {
  return { Code: 0, Msg: '该能力只能由服务端持久后台任务执行。' };
}
if (!tenantId || !tenantKey || !osClientType || !osClientNetwork) {
  return { Code: 0, Msg: '租户 Id、OsClient、OsClientType、OsClientNetwork 均不能为空。' };
}
if (!V8.Method || typeof V8.Method.UpgradeAdminTenantDatabase !== 'function') {
  return { Code: 0, Msg: '当前后端尚未提供租户数据库升级原子，请先更新并重启 Microi.Server。' };
}

report(1, '正在校验租户身份与后台任务租约');
var result = V8.Method.UpgradeAdminTenantDatabase({
  TenantId: tenantId,
  TenantKey: tenantKey,
  OsClientType: osClientType,
  OsClientNetwork: osClientNetwork,
  _BackgroundTaskId: backgroundTaskId,
  _BackgroundTaskFencingToken: fencingToken
});
if (!result || result.Code !== 1) {
  return result || { Code: 0, Msg: '租户数据库升级无返回。' };
}

report(100, result.Msg || '租户数据库升级检查完成');
return result;
