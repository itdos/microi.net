/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-marketplace-source
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var marketplaceRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '');
var marketplaceAction = String(V8.Param.Action || '').trim();
if(!marketplaceAction && marketplaceRoute){
  var marketplaceSegments = marketplaceRoute.split('/');
  marketplaceAction = marketplaceSegments[marketplaceSegments.length - 1] || '';
}

// MARKETPLACE_LIST_ROUTE_FAILOVER_V2：所有请求仍先进入可信后端运行时，保留
// 管理员、访问密钥、源地址和租户校验。只有官方公共源的正式列表地址明确缺失
// （NoExistData / HTTP 404）时，才由 Managed 接口调用官方旧地址薄网关。
// 认证、业务校验、超时和其它网络故障均不得降级或伪装为“0 个应用”。
function marketplaceText(value) {
  return String(value === null || typeof value === 'undefined' ? '' : value).trim();
}

function isOfficialPublicSource(param) {
  return marketplaceText(param && param.SourceId).toLowerCase() === 'official'
    && marketplaceText(param && param.ApiBase).replace(/\/+$/, '').toLowerCase() === 'https://api.itdos.com'
    && marketplaceText(param && param.OsClient).toLowerCase() === 'itdos';
}

function marketplaceListRouteUnavailable(result) {
  var message = marketplaceText(result && result.Msg).toLowerCase();
  return message.indexOf('noexistdata[apiaddress]:/apiengine/get-microi-store-list') >= 0
    || message.indexOf('http 404') >= 0
    || message.indexOf('statuscode: 404') >= 0
    || message.indexOf('status code 404') >= 0;
}

function parseMarketplaceResponse(value) {
  if (!value) return value;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); }
  catch (error) { return { Code: 0, Msg: '官方商城旧地址未返回有效 JSON。' }; }
}

function requestOfficialLegacyList(param, formalResult) {
  var legacyResult;
  try {
    // MARKETPLACE_NESTED_JSON_PAYLOAD_V2：商城分页请求携带 InstalledVersions
    // 等嵌套数组。目标端可能仍运行不识别 PostParamString 的旧 V8 HTTP 原子；
    // ParamType=json 下 PostParam 会按完整对象序列化，且已由同租户批量升级链路验证。
    legacyResult = parseMarketplaceResponse(V8.Http.Post({
      Url: 'https://api.itdos.com/apiengine/get-microi-store?OsClient=iTdos',
      PostParam: (param && param.Param) || {},
      ParamType: 'json',
      // MARKETPLACE_SOURCE_HEADER_ISOLATION_V1：显式空 Header 阻止目标租户的
      // osclient/authorization 请求头被旧版 V8.Http 继承到官方公共商城源。
      Headers: {},
      Timeout: 120
    }));
  } catch (error) {
    legacyResult = { Code: 0, Msg: marketplaceText(error && error.message ? error.message : error) || '官方商城旧地址请求失败。' };
  }
  if (!legacyResult || Number(legacyResult.Code) !== 1) return legacyResult || { Code: 0, Msg: '官方商城旧地址未返回结果。' };
  var append = legacyResult.DataAppend && typeof legacyResult.DataAppend === 'object'
    ? legacyResult.DataAppend
    : {};
  append.SourceAuthenticated = false;
  append.CredentialKey = 'Marketplace.SourceToken.official';
  append.SourceId = 'official';
  append.MarketplaceListRoute = '/apiengine/get-microi-store';
  append.MarketplaceListRouteFallback = true;
  append.FormalRouteFailure = marketplaceText(formalResult && formalResult.Msg);
  legacyResult.DataAppend = append;
  return legacyResult;
}

function resolveOfficialList(param, formalResult) {
  if (formalResult && Number(formalResult.Code) === 1) return formalResult;
  if (!marketplaceListRouteUnavailable(formalResult)) return formalResult;
  return requestOfficialLegacyList(param, formalResult);
}

if(['Discover','Captcha','Login','Query','Disconnect'].indexOf(marketplaceAction) >= 0){
  var runtimeResult = V8.Method.RunPlatformApiRuntime({
    RuntimeKey:'MarketplaceSource', Action:marketplaceAction, Param:V8.Param || {}
  });
  if (!isOfficialPublicSource(V8.Param || {})) return runtimeResult;
  if (marketplaceAction === 'Query'
      && marketplaceText(V8.Param.Operation).toLowerCase() === 'list') {
    return resolveOfficialList(V8.Param || {}, runtimeResult);
  }
  if (marketplaceAction === 'Discover' && runtimeResult && Number(runtimeResult.Code) === 1) {
    var countParam = {
      SourceId: 'official',
      ApiBase: 'https://api.itdos.com',
      OsClient: 'iTdos',
      Operation: 'List',
      Param: { _PageIndex: 1, _PageSize: 1 }
    };
    var formalCountResult = V8.Method.RunPlatformApiRuntime({
      RuntimeKey: 'MarketplaceSource', Action: 'Query', Param: countParam
    });
    var countResult = resolveOfficialList(countParam, formalCountResult);
    if (!countResult || Number(countResult.Code) !== 1) {
      return countResult || { Code: 0, Msg: '官方商城应用数量读取失败。' };
    }
    var discovered = runtimeResult.Data || {};
    var count = Math.max(0, Number(countResult.DataCount || 0));
    return {
      Code: 1,
      Msg: runtimeResult.Msg || '商城源识别成功。',
      Data: {
        SourceId: discovered.SourceId || 'official',
        ApiBase: discovered.ApiBase || 'https://api.itdos.com',
        OsClient: discovered.OsClient || 'iTdos',
        SystemTitle: discovered.SystemTitle || 'Microi吾码',
        SystemShortTitle: discovered.SystemShortTitle || '吾码',
        RequiresCaptcha: discovered.RequiresCaptcha === true,
        HasCredential: discovered.HasCredential === true,
        CredentialExpired: discovered.CredentialExpired === true,
        CredentialExpiresAt: discovered.CredentialExpiresAt || '',
        PublicApplicationCount: count,
        AccessibleApplicationCount: count,
        PrivateApplicationCount: 0,
        CredentialKey: discovered.CredentialKey || 'Marketplace.SourceToken.official',
        MarketplaceListRouteFallback: !!(countResult.DataAppend && countResult.DataAppend.MarketplaceListRouteFallback)
      }
    };
  }
  return runtimeResult;
}

/* V8 ApiEngine | ApiEngineKey: platform-marketplace-source | Version: v1.0.4 */

var param = V8.Param || {};

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function fail(message, code) {
  return { Code: code || 0, Msg: message };
}

if (!V8.CurrentUser || !V8.CurrentUser.Id) return fail('登录身份已过期，请重新登录。', 1001);
var isAdmin = V8.CurrentUser._IsAdmin === true || Number(V8.CurrentUser.Level || 0) >= 999;
if (!isAdmin) return fail('只有超级管理员可以管理商城源。');
var engineAction = String(param.Action || '').trim();
if (engineAction !== 'AuthorizeOperation' && engineAction !== 'RecordAudit') {
  return fail('不支持的商城源动作。');
}

var auditAction = text(param.AuditAction, 80);
if (auditAction !== 'MarketplaceSourceLogin' && auditAction !== 'MarketplaceSourceDisconnect') {
  return fail('商城源审计动作无效。');
}
var sourceId = text(param.SourceId, 80);
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(sourceId)) return fail('商城源 Id 无效。');

if (engineAction === 'AuthorizeOperation') {
  var authorizeHook = V8.ApiEngine.Run('platform-marketplace-source-hook', {
    Stage: auditAction === 'MarketplaceSourceLogin'
      ? 'BeforeMarketplaceSourceLogin'
      : 'BeforeMarketplaceSourceDisconnect',
    SourceApiEngineKey: 'platform-marketplace-source',
    Action: auditAction,
    SourceId: sourceId
  }, V8.DbTrans);
  return authorizeHook || fail('商城源个性化 Hook 未返回结果。');
}

var content = JSON.stringify({
  Success: param.Success === true,
  SourceId: sourceId,
  ApiBase: text(param.ApiBase, 2048),
  RemoteOsClient: text(param.RemoteOsClient, 80)
});
var logResult = V8.Method.AddSysLog({
  OsClient: V8.OsClient,
  UserId: text(V8.CurrentUser.Id, 100),
  UserName: text(V8.CurrentUser.Name || V8.CurrentUser.Account, 200),
  Category: 'Security',
  Action: auditAction,
  Source: 'MarketplaceSourceGateway',
  TargetType: 'MarketplaceSource',
  TargetId: sourceId,
  Success: param.Success === true,
  Type: '安全审计',
  Title: auditAction,
  Content: content,
  Level: param.Success === true ? 1 : 2
});
if (!logResult || logResult.Code !== 1) return logResult || fail('商城源审计日志保存失败。');
var afterHook = V8.ApiEngine.Run('platform-marketplace-source-hook', {
  Stage: auditAction === 'MarketplaceSourceLogin'
    ? 'AfterMarketplaceSourceLogin'
    : 'AfterMarketplaceSourceDisconnect',
  SourceApiEngineKey: 'platform-marketplace-source',
  Action: auditAction,
  SourceId: sourceId,
  Success: param.Success === true
}, V8.DbTrans);
if (!afterHook || afterHook.Code !== 1) {
  return afterHook || fail('商城源个性化 Hook 未返回结果。');
}
return logResult;
