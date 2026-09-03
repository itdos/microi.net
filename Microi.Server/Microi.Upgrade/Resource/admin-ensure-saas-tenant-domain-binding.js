/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：admin_ensure_saas_tenant_domain_binding
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: admin_ensure_saas_tenant_domain_binding
 * Version: v1.0.3
 * Function:
 * - 主租户超级管理员按 TenantKey 或 Id 精确选择权威 sys_osclients 行。
 * - 只为单标签 *.microi.net 创建/更新精确 ESA CNAME，绝不读取、选择或修改通配记录。
 * - ESA 凭据只取当前主租户 V8.OsClientModel；目标域和源站分别取权威 sys_osclients 行。
 */

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function result(code, data, msg) {
  return { Code: code, Data: data || null, Msg: msg || '' };
}

function failed(status, message, tenant) {
  tenant = tenant || {};
  return result(0, {
    TenantId: toText(tenant.Id),
    TenantKey: toText(tenant.OsClient),
    DomainName: toText(tenant.DomainName).toLowerCase(),
    ControlPlaneVerified: false,
    DataPlaneStatus: 'NotProbed',
    HttpStatus: null,
    Diagnostic: message,
    DomainBindingStatus: status,
    DomainBindingRetryable: true,
    BareDomainReady: false
  }, message);
}

function normalizePureHost(value) {
  var host = toText(value).toLowerCase();
  if (!host || host.length > 253 || host.indexOf('*') >= 0
      || host.indexOf('://') >= 0 || host.indexOf('/') >= 0
      || host.indexOf('\\') >= 0 || host.indexOf('@') >= 0
      || host.indexOf(':') >= 0 || host.indexOf('..') >= 0) {
    return '';
  }
  var labels = host.split('.');
  if (labels.length < 2) return '';
  for (var index = 0; index < labels.length; index++) {
    var label = labels[index];
    if (!label || label.length > 63 || label.charAt(0) === '-'
        || label.charAt(label.length - 1) === '-'
        || !/^[a-z0-9-]+$/.test(label)) {
      return '';
    }
  }
  return host;
}

function safeHttpStatus(value) {
  if (value === null || value === undefined || value === '') return null;
  var parsed = Number(value);
  return isFinite(parsed) && Math.floor(parsed) === parsed && parsed >= 100 && parsed <= 599
    ? parsed
    : null;
}

function safeDiagnostic(value) {
  var text = toText(value);
  return text.length <= 500 ? text : text.substring(0, 500);
}

function copyCidrList(value) {
  if (!value) return [];
  var count = Number(value.Count);
  if (!isFinite(count)) count = Number(value.length);
  if (!isFinite(count) || count < 0) return [];
  count = Math.min(Math.floor(count), 256);
  var result = [];
  for (var index = 0; index < count; index++) {
    var cidr = toText(value[index]);
    if (cidr) result.push(cidr);
  }
  return result;
}

var allowedInputKeys = {
  TenantKey: true,
  Id: true,
  // 以下均为接口运行时生成的上下文字段，不参与目标选择。
  ApiEngineKey: true,
  OsClient: true,
  _InvokeType: true,
  _CurrentUser: true,
  _RequireApiRoleAuthorization: true,
  _TraceParent: true,
  // 部分 MCP/接口调试运行时会追加一个短标量占位参数。该值只为兼容
  // 运行时形状而显式放行，不参与目标选择、授权或 ESA 请求。
  TestParam1: true
};
var inputKeys = Object.keys(V8.Param || {});
for (var inputIndex = 0; inputIndex < inputKeys.length; inputIndex++) {
  if (!allowedInputKeys[inputKeys[inputIndex]]) {
    return failed('RejectedInput', '请求只允许 TenantKey 或 Id，已拒绝其它业务字段。');
  }
}

// 这些字段仅是 Microi MCP/接口运行时注入的元数据，不参与目标选择或权限提升；
// 显式放行后仍逐值失败关闭，防止借兼容字段夹带可控业务输入。
var testParam1 = V8.Param.TestParam1;
if (testParam1 !== null && testParam1 !== undefined) {
  var testParam1Type = typeof testParam1;
  if ((testParam1Type !== 'string'
      && testParam1Type !== 'number'
      && testParam1Type !== 'boolean')
      || String(testParam1).length > 200) {
    return failed('RejectedInput', '兼容占位参数不符合短标量安全约束，已拒绝执行。');
  }
}
if (V8.Param._RequireApiRoleAuthorization !== null
    && V8.Param._RequireApiRoleAuthorization !== undefined
    && V8.Param._RequireApiRoleAuthorization !== true
    && V8.Param._RequireApiRoleAuthorization !== 1) {
  return failed('RejectedInput', '接口角色授权运行时标记不合法，已拒绝执行。');
}
var traceParent = toText(V8.Param._TraceParent);
if (V8.Param._TraceParent !== null
    && V8.Param._TraceParent !== undefined
    && !/^(?!ff)[0-9a-f]{2}-(?!0{32})[0-9a-f]{32}-(?!0{16})[0-9a-f]{16}-[0-9a-f]{2}$/.test(traceParent)) {
  return failed('RejectedInput', 'W3C 调用链路上下文不合法，已拒绝执行。');
}

if (toText(V8.Param.ApiEngineKey)
    && toText(V8.Param.ApiEngineKey).toLowerCase()
      !== 'admin_ensure_saas_tenant_domain_binding') {
  return failed('RejectedContext', '运行接口上下文不匹配，已拒绝执行。');
}
if (toText(V8.Param.OsClient)
    && toText(V8.Param.OsClient).toLowerCase() !== toText(V8.OsClient).toLowerCase()) {
  return failed('RejectedContext', '运行租户上下文不匹配，已拒绝执行。');
}

var currentUser = V8.CurrentUser || {};
var currentLevel = parseInt(currentUser.Level || 0, 10);
if (isNaN(currentLevel) || currentLevel < 9999) {
  return failed('Unauthorized', '权限不足：只有主租户超级管理员才能绑定 SaaS 租户域名。');
}
if (!V8.Method || typeof V8.Method.AuthorizeAdminTenantDomainBinding !== 'function') {
  return failed(
    'PendingCapabilityUpgrade',
    '当前后端尚未包含 SaaS 租户域名绑定授权原子，请升级并重启后重试。'
  );
}
var authorization;
try {
  authorization = V8.Method.AuthorizeAdminTenantDomainBinding();
} catch (authorizationError) {
  return failed('Unauthorized', '平台管理员身份安全校验失败，未执行域名写入。');
}
if (!authorization || authorization.Code !== 1) {
  // 不透传宿主身份校验详情，避免将 Token/主库诊断带入 V8 返回。
  return failed('Unauthorized', '只有当前有效的主租户平台超级管理员才能执行域名绑定。');
}

var tenantKey = toText(V8.Param.TenantKey);
var tenantId = toText(V8.Param.Id);
if ((!tenantKey && !tenantId) || (tenantKey && !/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(tenantKey))
    || (tenantId && !/^[A-Za-z0-9_-]{1,64}$/.test(tenantId))) {
  return failed('RejectedInput', 'TenantKey 或 Id 必须提供一个有效的精确值。');
}

var targetWhere = [['IsDeleted', '=', 0]];
if (tenantKey) targetWhere.push(['OsClient', '=', tenantKey]);
if (tenantId) targetWhere.push(['Id', '=', tenantId]);
var targetResult = V8.FormEngine.GetFormData('sys_osclients', {
  _Where: targetWhere,
  _SelectFields: ['Id', 'OsClient', 'DomainName', 'IsEnable']
});
if (!targetResult || targetResult.Code !== 1 || !targetResult.Data) {
  return failed('TargetNotFound', '未找到精确匹配的启用 SaaS 租户，未执行域名写入。');
}
var target = targetResult.Data;
if (toText(target.IsEnable) !== '1') {
  return failed('TargetDisabled', '目标 SaaS 租户未启用，未执行域名写入。', target);
}
if ((tenantKey && toText(target.OsClient).toLowerCase() !== tenantKey.toLowerCase())
    || (tenantId && toText(target.Id) !== tenantId)) {
  return failed('TargetReadbackMismatch', '目标租户权威回读不一致，未执行域名写入。', target);
}

var currentTenantKey = toText(V8.OsClient);
if (!currentTenantKey) {
  return failed('RejectedContext', '当前主租户上下文为空，未执行域名写入。', target);
}
var mainResult = V8.FormEngine.GetFormData('sys_osclients', {
  _Where: [['IsDeleted', '=', 0], ['OsClient', '=', currentTenantKey]],
  _SelectFields: ['Id', 'OsClient', 'DomainName', 'IsEnable']
});
if (!mainResult || mainResult.Code !== 1 || !mainResult.Data
    || toText(mainResult.Data.IsEnable) !== '1'
    || toText(mainResult.Data.OsClient).toLowerCase() !== currentTenantKey.toLowerCase()) {
  return failed('MainTenantNotFound', '当前主租户权威配置读取失败，未执行域名写入。', target);
}
if (toText(mainResult.Data.Id) === toText(target.Id)) {
  return failed('RejectedTarget', '主租户不能作为 SaaS 子租户域名绑定目标。', target);
}

var siteName = 'microi.net';
var recordName = normalizePureHost(target.DomainName);
var expectedRecordPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.microi\.net$/;
if (!recordName || !expectedRecordPattern.test(recordName)) {
  return failed(
    'UnsupportedDomain',
    '只允许绑定 microi.net 下的单标签精确域名，通配符、根域和其它域名均已拒绝。',
    target
  );
}

var originDomain = normalizePureHost(mainResult.Data.DomainName);
if (!originDomain || originDomain === siteName
    || originDomain.substring(originDomain.length - siteName.length - 1) === '.' + siteName
    || originDomain === recordName) {
  return failed(
    'UnsafeOrigin',
    '当前主租户 DomainName 不是安全的独立纯主机名，未执行域名写入。',
    target
  );
}

var mainModel = V8.OsClientModel || {};
if (toText(mainModel.OsClient)
    && toText(mainModel.OsClient).toLowerCase() !== currentTenantKey.toLowerCase()) {
  return failed('RejectedContext', '主租户运行配置与权威租户不一致，未执行域名写入。', target);
}
var accessKeyId = toText(mainModel.AlidnsKeyId);
var accessKeySecret = toText(mainModel.AlidnsKeySecret);
if (!accessKeyId || !accessKeySecret) {
  return failed('MissingCredential', '当前主租户尚未配置 ESA 访问凭据，稍后可幂等补偿。', target);
}
if (!V8.Alidns || typeof V8.Alidns.EnsureExactESACnameRecord !== 'function') {
  return failed('PendingCapabilityUpgrade', '当前后端尚未包含 ESA 精确域名绑定原子，请升级并重启后重试。', target);
}

var bindingResult;
try {
  bindingResult = V8.Alidns.EnsureExactESACnameRecord({
    SiteName: siteName,
    RecordName: recordName,
    OriginDomain: originDomain,
    AccessKeyId: accessKeyId,
    AccessKeySecret: accessKeySecret
  });
} catch (error) {
  return failed('Failed', 'ESA 精确域名绑定执行异常，稍后可幂等补偿。', target);
}
if (!bindingResult || bindingResult.Code !== 1 || !bindingResult.Data) {
  // 不透传 SDK/宿主错误正文；即使底层未来回归，也不能把凭据或请求细节带回 V8 调用方。
  return failed('Failed', 'ESA 精确域名绑定失败，稍后可幂等补偿。', target);
}

var verified = bindingResult.Data;
if (toText(verified.SiteName).toLowerCase() !== siteName
    || toText(verified.RecordName).toLowerCase() !== recordName
    || toText(verified.RecordType).toUpperCase() !== 'CNAME'
    || toText(verified.OriginDomain).toLowerCase() !== originDomain
    || toText(verified.OriginHost).toLowerCase() !== originDomain
    || toText(verified.OriginSni).toLowerCase() !== originDomain
    || toText(verified.HostPolicy).toLowerCase() !== 'follow_origin_domain'
    || verified.Proxied !== true
    || verified.ControlPlaneVerified !== true) {
  return failed('ReadbackMismatch', 'ESA 原子回读与权威租户配置不一致，结果未确认成功。', target);
}

var dataPlaneStatus = toText(verified.DataPlaneStatus) || 'Unknown';
var httpStatus = safeHttpStatus(verified.HttpStatus);
var bareDomainReady = verified.BareDomainReady === true
  && dataPlaneStatus === 'Ready'
  && httpStatus !== null
  && httpStatus < 500;
if (verified.BareDomainReady === true && !bareDomainReady) {
  return failed('ReadbackMismatch', 'ESA 数据面就绪字段相互矛盾，结果未确认成功。', target);
}
var domainBindingStatus = bareDomainReady ? 'Verified' : 'DataPlaneUnavailable';

return result(1, {
  TenantId: toText(target.Id),
  TenantKey: toText(target.OsClient),
  DomainName: recordName,
  BareDomainUrl: 'https://' + recordName,
  BareDomainReady: bareDomainReady,
  ControlPlaneVerified: true,
  DataPlaneStatus: dataPlaneStatus,
  HttpStatus: httpStatus,
  Diagnostic: safeDiagnostic(verified.Diagnostic),
  DomainBindingStatus: domainBindingStatus,
  DomainBindingRetryable: !bareDomainReady,
  SiteName: siteName,
  OriginDomain: originDomain,
  OriginHost: originDomain,
  OriginSni: originDomain,
  HostPolicy: 'follow_origin_domain',
  RecordType: 'CNAME',
  RecordId: verified.RecordId,
  Action: toText(verified.Action),
  OriginProtectionDiagnosticStatus: toText(verified.OriginProtectionDiagnosticStatus),
  OriginProtection: toText(verified.OriginProtection),
  OriginConverge: toText(verified.OriginConverge),
  AutoConfirmIPList: toText(verified.AutoConfirmIPList),
  NeedUpdate: verified.NeedUpdate === null || verified.NeedUpdate === undefined
    ? null
    : verified.NeedUpdate === true,
  CurrentIPv4Cidrs: copyCidrList(verified.CurrentIPv4Cidrs),
  CurrentIPv6Cidrs: copyCidrList(verified.CurrentIPv6Cidrs),
  LatestIPv4Cidrs: copyCidrList(verified.LatestIPv4Cidrs),
  LatestIPv6Cidrs: copyCidrList(verified.LatestIPv6Cidrs),
  AddedIPv4Cidrs: copyCidrList(verified.AddedIPv4Cidrs),
  AddedIPv6Cidrs: copyCidrList(verified.AddedIPv6Cidrs),
  RemovedIPv4Cidrs: copyCidrList(verified.RemovedIPv4Cidrs),
  RemovedIPv6Cidrs: copyCidrList(verified.RemovedIPv6Cidrs),
  UnchangedIPv4Cidrs: copyCidrList(verified.UnchangedIPv4Cidrs),
  UnchangedIPv6Cidrs: copyCidrList(verified.UnchangedIPv6Cidrs),
  CidrListTruncated: verified.CidrListTruncated === true
}, bareDomainReady
  ? 'SaaS 租户精确域名已完成控制面与 HTTPS 数据面验证。'
  : 'SaaS 租户 ESA 控制面已验证，但 HTTPS 数据面尚未就绪，可幂等重试。');
