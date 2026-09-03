/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：admin_repair_saas_tenant_database_access
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: admin_repair_saas_tenant_database_access | Version: v1.0.3 */

var param = V8.Param || {};
var currentUser = V8.CurrentUser || {};
var allowedInputKeys = {
  TenantId: true,
  TenantKey: true,
  ExpectedDatabaseName: true,
  ExpectedStaleReadDatabaseName: true,
  Type: true,
  Network: true,
  ValidateOnly: true,
  ConfirmExecution: true,
  // MCP/服务端接口引擎运行时会注入这些可信上下文字段。允许它们进入 Param，
  // 但下面仍逐项校验固定租户、固定接口 Key 与 Server 调用语义，且绝不转发给修复原子。
  OsClient: true,
  ApiEngineKey: true,
  _InvokeType: true,
  _CurrentUser: true,
  // 部分历史 MCP/接口调试运行时会追加一个短标量占位参数。它只用于调试
  // 兼容且永远不会传给数据库修复原子；对象和超长值仍失败关闭。
  TestParam1: true
};

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isTrue(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true';
}

function bool(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true';
}

// 输入面必须固定：新增任何字段都先由官方资源审计后再显式加入，避免通用参数对象
// 把连接材料或其它高价值数据带入接口日志、Hook 或可信宿主原子。
var inputKeys = Object.keys(param);
for (var inputIndex = 0; inputIndex < inputKeys.length; inputIndex++) {
  if (!allowedInputKeys[inputKeys[inputIndex]]) {
    return { Code: 0, Msg: '请求包含未允许的字段，已拒绝执行。' };
  }
}

var runtimeOsClient = text(param.OsClient);
var runtimeEngineKey = text(param.ApiEngineKey);
var runtimeInvokeType = text(param._InvokeType);
if (runtimeOsClient && runtimeOsClient.toLowerCase() !== text(V8.OsClient).toLowerCase()) {
  return { Code: 0, Msg: '运行租户上下文不匹配，已拒绝执行。' };
}
if (runtimeEngineKey && runtimeEngineKey.toLowerCase() !== 'admin_repair_saas_tenant_database_access') {
  return { Code: 0, Msg: '运行接口上下文不匹配，已拒绝执行。' };
}
if (runtimeInvokeType && runtimeInvokeType.toLowerCase() !== 'server') {
  return { Code: 0, Msg: '仅允许可信服务端调用数据库连接修复。' };
}
if (param.TestParam1 !== null && param.TestParam1 !== undefined
    && typeof param.TestParam1 === 'object') {
  return { Code: 0, Msg: '兼容占位参数类型不正确，已拒绝执行。' };
}
if (String(param.TestParam1 === null || param.TestParam1 === undefined
  ? '' : param.TestParam1).length > 200) {
  return { Code: 0, Msg: '兼容占位参数过长，已拒绝执行。' };
}

if (!currentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}
if (Number(currentUser.Level || 0) < 9999) {
  return { Code: 0, Msg: '只有主租户超级管理员可以执行数据库连接修复。' };
}
if (!V8.Method || typeof V8.Method.RepairAdminTenantDatabaseAccess !== 'function') {
  return { Code: 0, Msg: '当前后端尚未提供安全的租户数据库连接修复能力，请先升级后端。' };
}

var tenantId = text(param.TenantId);
var tenantKey = text(param.TenantKey);
var expectedDatabaseName = text(param.ExpectedDatabaseName);
var expectedStaleReadDatabaseName = text(param.ExpectedStaleReadDatabaseName);
var type = text(param.Type);
var network = text(param.Network);
if (!/^[A-Za-z0-9_-]{1,80}$/.test(tenantId)) {
  return { Code: 0, Msg: 'TenantId格式不正确。' };
}
if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(tenantKey)) {
  return { Code: 0, Msg: 'TenantKey格式不正确。' };
}
if (!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(type)) {
  return { Code: 0, Msg: 'Type格式不正确。' };
}
if (!/^[A-Za-z][A-Za-z0-9_.-]{0,49}$/.test(network)) {
  return { Code: 0, Msg: 'Network格式不正确。' };
}

var legacyDatabaseName = tenantKey.replace(/-/g, '_');
var canonicalDatabaseName = 'microi_' + legacyDatabaseName;
if (expectedDatabaseName.toLowerCase() !== legacyDatabaseName.toLowerCase()
    && expectedDatabaseName.toLowerCase() !== canonicalDatabaseName.toLowerCase()) {
  return { Code: 0, Msg: 'ExpectedDatabaseName必须与TenantKey对应。' };
}
if (expectedStaleReadDatabaseName
    && !/^[A-Za-z0-9_]{1,64}$/.test(expectedStaleReadDatabaseName)) {
  return { Code: 0, Msg: 'ExpectedStaleReadDatabaseName格式不正确。' };
}
if (expectedStaleReadDatabaseName
    && expectedStaleReadDatabaseName.toLowerCase() === expectedDatabaseName.toLowerCase()) {
  return { Code: 0, Msg: '旧读库不能与目标数据库相同。' };
}

var requiredConfirmation = tenantId + ':' + tenantKey + ':' + expectedDatabaseName;
if (expectedStaleReadDatabaseName) {
  requiredConfirmation += ':replace-stale-read:' + expectedStaleReadDatabaseName;
}
var safeTarget = {
  TenantId: tenantId,
  TenantKey: tenantKey,
  ExpectedDatabaseName: expectedDatabaseName,
  Type: type,
  Network: network
};
if (expectedStaleReadDatabaseName) {
  safeTarget.ExpectedStaleReadDatabaseName = expectedStaleReadDatabaseName;
}
if (isTrue(param.ValidateOnly)) {
  return {
    Code: 1,
    Data: {
      TenantId: tenantId,
      TenantKey: tenantKey,
      ExpectedDatabaseName: expectedDatabaseName,
      ExpectedStaleReadDatabaseName: expectedStaleReadDatabaseName,
      Type: type,
      Network: network,
      ValidationScope: 'RequestContractOnly',
      HostCapabilityAvailable: true,
      RequiredConfirmExecution: requiredConfirmation
    },
    Msg: '参数契约校验通过；本次未执行任何修复。'
  };
}
if (text(param.ConfirmExecution) !== requiredConfirmation) {
  return { Code: 0, Data: safeTarget, Msg: 'ConfirmExecution不匹配，已拒绝执行。' };
}

// 只把固定目标定位字段交给可信宿主；Type/Network 显式映射到服务端字段，
// V8.Param 的其余内容永远不能穿透安全边界。
var hostRequest = {
  TenantId: tenantId,
  TenantKey: tenantKey,
  ExpectedDatabaseName: expectedDatabaseName,
  OsClientType: type,
  OsClientNetwork: network
};
if (expectedStaleReadDatabaseName) {
  hostRequest.ExpectedStaleReadDatabaseName = expectedStaleReadDatabaseName;
}
var hostResult = V8.Method.RepairAdminTenantDatabaseAccess(hostRequest);
if (!hostResult) {
  return { Code: 0, Data: safeTarget, Msg: '租户数据库连接修复未返回结果。' };
}

// 即使可信宿主未来扩展返回模型，也只公开经过复核的非秘密状态字段；
// 不透传 Data、DataAppend 或宿主错误消息，避免回归时意外暴露连接材料。
var hostData = hostResult.Data || {};
var credentialScope = text(hostData.CredentialScope) === 'DatabaseOnly'
  ? 'DatabaseOnly'
  : '';
var safeResult = {
  TenantId: tenantId,
  TenantKey: tenantKey,
  ExpectedDatabaseName: expectedDatabaseName,
  Type: type,
  Network: network,
  CredentialScope: credentialScope,
  PreviousPrincipalPreserved: bool(hostData.PreviousPrincipalPreserved),
  DurableConfigurationUpdated: bool(hostData.DurableConfigurationUpdated),
  RuntimeReloaded: bool(hostData.RuntimeReloaded),
  StaleReadConnectionReplaced: bool(hostData.StaleReadConnectionReplaced)
};
var resultCode = Number(hostResult.Code || 0);
if (resultCode === 1) {
  return { Code: 1, Data: safeResult, Msg: '租户数据库连接已修复并完成安全回读。' };
}
return {
  Code: resultCode,
  Data: safeResult,
  Msg: safeResult.DurableConfigurationUpdated
    ? '租户连接已写入，但运行配置刷新未完成。'
    : '租户数据库连接修复未完成，原连接配置保持不变。'
};
