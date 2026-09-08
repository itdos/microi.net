/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：admin_ensure_external_saas_tenant_domain_binding
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: admin_ensure_external_saas_tenant_domain_binding
 * Version: v1.0.2
 * Function:
 * - 官方运营控制面为一个单标签 TenantKey 幂等绑定精确 TenantKey.microi.net。
 * - 只接收安全纯主机名 OriginDomain；禁止通配、microi.net 回源、协议、端口、路径和凭据。
 * - ESA 凭据只取当前官方主租户 V8.OsClientModel，不返回、不下发、不持久化到目标租户。
 */

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function result(code, data, msg) {
  return { Code: code, Data: data || null, Msg: msg || '' };
}

function failed(status, message, tenantKey, recordName) {
  return result(0, {
    TenantKey: tenantKey || '',
    DomainName: recordName || '',
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
      || host.indexOf(':') >= 0 || host.indexOf('..') >= 0
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
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
  OriginDomain: true,
  // 以下均为接口运行时生成的上下文字段，不参与目标或源站选择。
  ApiEngineKey: true,
  OsClient: true,
  _InvokeType: true,
  _CurrentUser: true,
  _RequireApiRoleAuthorization: true,
  _TraceParent: true,
  TestParam1: true
};
var inputKeys = Object.keys(V8.Param || {});
for (var inputIndex = 0; inputIndex < inputKeys.length; inputIndex++) {
  if (!allowedInputKeys[inputKeys[inputIndex]]) {
    return failed('RejectedInput', '请求只允许 TenantKey 和 OriginDomain，已拒绝其它业务字段。');
  }
}

// 运行时元数据仅用于上下文一致性校验；授权仍以宿主可信用户和当前接口 Key 为准。
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
var invokeType = toText(V8.Param._InvokeType);
if (invokeType && invokeType !== 'Client' && invokeType !== 'Server') {
  return failed('RejectedInput', '接口调用类型运行时标记不合法，已拒绝执行。');
}

if (toText(V8.Param.ApiEngineKey)
    && toText(V8.Param.ApiEngineKey).toLowerCase()
      !== 'admin_ensure_external_saas_tenant_domain_binding') {
  return failed('RejectedContext', '运行接口上下文不匹配，已拒绝执行。');
}
if (toText(V8.Param.OsClient)
    && toText(V8.Param.OsClient).toLowerCase() !== toText(V8.OsClient).toLowerCase()) {
  return failed('RejectedContext', '运行租户上下文不匹配，已拒绝执行。');
}

var tenantKey = toText(V8.Param.TenantKey);
var tenantKeyPattern = /^[A-Za-z](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?$/;
if (!tenantKey || !tenantKeyPattern.test(tenantKey)) {
  return failed('RejectedInput', 'TenantKey 必须是 1 至 50 位的 DNS 单标签精确值。');
}
tenantKey = tenantKey.toLowerCase();
var siteName = 'microi.net';
var recordName = tenantKey + '.' + siteName;
var originDomain = normalizePureHost(V8.Param.OriginDomain);
if (!originDomain || originDomain === siteName
    || originDomain.substring(originDomain.length - siteName.length - 1) === '.' + siteName
    || originDomain === recordName) {
  return failed(
    'UnsafeOrigin',
    'OriginDomain 必须是独立的安全纯主机名，不能是 microi.net 或其子域。',
    tenantKey,
    recordName
  );
}

var currentUser = V8.CurrentUser || {};
var currentLevel = parseInt(currentUser.Level || 0, 10);
if (isNaN(currentLevel) || currentLevel < 9999) {
  return failed(
    'Unauthorized',
    '权限不足：只有当前官方主租户超级管理员才能执行外部 SaaS 域名绑定。',
    tenantKey,
    recordName
  );
}
if (!V8.Method || typeof V8.Method.AuthorizeExternalSaasTenantDomainBinding !== 'function') {
  return failed(
    'PendingCapabilityUpgrade',
    '当前后端尚未包含 iTdos 外部 SaaS 域名绑定独立授权原子，请升级并重启后重试。',
    tenantKey,
    recordName
  );
}
var authorization;
try {
  authorization = V8.Method.AuthorizeExternalSaasTenantDomainBinding();
} catch (authorizationError) {
  return failed('Unauthorized', '平台管理员身份安全校验失败，未执行域名写入。', tenantKey, recordName);
}
if (!authorization || authorization.Code !== 1) {
  return failed(
    'Unauthorized',
    '只有当前有效的官方主租户平台超级管理员才能执行域名绑定。',
    tenantKey,
    recordName
  );
}

var currentTenantKey = toText(V8.OsClient);
if (!currentTenantKey) {
  return failed('RejectedContext', '当前官方主租户上下文为空，未执行域名写入。', tenantKey, recordName);
}
var mainModel = V8.OsClientModel || {};
if (toText(mainModel.OsClient)
    && toText(mainModel.OsClient).toLowerCase() !== currentTenantKey.toLowerCase()) {
  return failed('RejectedContext', '主租户运行配置与可信租户上下文不一致，未执行域名写入。', tenantKey, recordName);
}
var accessKeyId = toText(mainModel.AlidnsKeyId);
var accessKeySecret = toText(mainModel.AlidnsKeySecret);
if (!accessKeyId || !accessKeySecret) {
  return failed('MissingCredential', '当前官方主租户尚未配置 ESA 访问凭据，稍后可幂等补偿。', tenantKey, recordName);
}
if (!V8.Alidns || typeof V8.Alidns.EnsureExactESACnameRecord !== 'function') {
  return failed('PendingCapabilityUpgrade', '当前后端尚未包含 ESA 精确域名绑定原子，请升级并重启后重试。', tenantKey, recordName);
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
  return failed('Failed', 'ESA 精确域名绑定执行异常，稍后可幂等补偿。', tenantKey, recordName);
}
if (!bindingResult || bindingResult.Code !== 1 || !bindingResult.Data) {
  // 不透传 SDK/宿主错误正文，防止凭据、站点或控制面细节泄露。
  return failed('Failed', 'ESA 精确域名绑定失败，稍后可幂等补偿。', tenantKey, recordName);
}

var verified = bindingResult.Data;
if (toText(verified.SiteName).toLowerCase() !== siteName
    || toText(verified.RecordName).toLowerCase() !== recordName
    || toText(verified.RecordType).toUpperCase() !== 'CNAME'
    || toText(verified.OriginDomain).toLowerCase() !== originDomain
    || toText(verified.OriginHost).toLowerCase() !== originDomain
    || toText(verified.OriginSni).toLowerCase() !== originDomain
    || toText(verified.SourceType).toLowerCase() !== 'domain'
    || toText(verified.BizName).toLowerCase() !== 'web'
    || toText(verified.HostPolicy).toLowerCase() !== 'follow_origin_domain'
    || toText(verified.HttpPorts) !== '80'
    || toText(verified.HttpsPorts) !== '443'
    || Number(verified.Ttl) !== 1
    || verified.Proxied !== true
    || verified.ControlPlaneVerified !== true) {
  return failed('ReadbackMismatch', 'ESA 原子强回读与固定安全策略不一致，结果未确认成功。', tenantKey, recordName);
}

var dataPlaneStatus = toText(verified.DataPlaneStatus) || 'Unknown';
var httpStatus = safeHttpStatus(verified.HttpStatus);
var bareDomainReady = verified.BareDomainReady === true
  && dataPlaneStatus === 'Ready'
  && httpStatus !== null
  && httpStatus < 500;
if (verified.BareDomainReady === true && !bareDomainReady) {
  return failed('ReadbackMismatch', 'ESA 数据面就绪字段相互矛盾，结果未确认成功。', tenantKey, recordName);
}
var domainBindingStatus = bareDomainReady ? 'Verified' : 'DataPlaneUnavailable';

return result(1, {
  TenantKey: tenantKey,
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
  SourceType: 'Domain',
  BizName: 'web',
  HostPolicy: 'follow_origin_domain',
  HttpPorts: '80',
  HttpsPorts: '443',
  Ttl: 1,
  RecordType: 'CNAME',
  Proxied: true,
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
  ? '外部 SaaS 租户精确域名已完成控制面与 HTTPS 数据面验证。'
  : '外部 SaaS 租户 ESA 控制面已验证，但 HTTPS 数据面尚未就绪，可幂等重试。');
