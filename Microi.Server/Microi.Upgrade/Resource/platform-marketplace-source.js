/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-marketplace-source
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-marketplace-source | Version: v1.0.0 */

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
