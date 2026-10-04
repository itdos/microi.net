/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_protocol_event
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_protocol_event
 * Version: v1.0.3
 * Function:
 * - 统一写入脱敏 SSO 安全审计，并把不含 Token、Secret、原始断言的事件投递给租户 Hook。
 */

if (!V8.Param || V8.Param._TrustedSsoProtocol !== true) {
  return { Code: 0, Msg: '仅 SSO 协议网关可以写入协议事件。' };
}

function text(value, maxLength) {
  var output = value === null || value === undefined ? '' : String(value).trim();
  return maxLength && output.length > maxLength ? output.substring(0, maxLength) : output;
}

var eventId = text(V8.Param.EventId, 128) || V8.EncryptHelper.Sha256Hex([
  V8.OsClient,
  text(V8.Param.Action, 80),
  text(V8.Param.UserId, 80),
  text(V8.Param.ConnectionKey, 120),
  text(V8.Param.OccurredAt, 50)
].join('|'));
var success = V8.Param.Success === true || V8.Param.Success === 1 || text(V8.Param.Success).toLowerCase() === 'true';
// SSO_TENANT_HOOK_SAFE_PAYLOAD_V1：只把以下八个脱敏白名单字段交给租户 Hook；
// Token、Secret、Credential、原始 Assertion/Claim 和协议网关内部对象一律不得进入 Hook。
var event = {
  EventId: eventId,
  Action: text(V8.Param.Action, 80),
  UserId: text(V8.Param.UserId, 80),
  ConnectionKey: text(V8.Param.ConnectionKey, 120),
  Protocol: text(V8.Param.Protocol, 20).toUpperCase(),
  Success: success,
  Reason: text(V8.Param.Reason, 200),
  OccurredAt: text(V8.Param.OccurredAt, 50) || DateNow('yyyy-MM-dd HH:mm:ss')
};

V8.Method.AddSysLog({
  OsClient: V8.OsClient,
  UserId: event.UserId,
  Category: 'Security',
  Action: event.Action,
  Source: 'SsoApiEngine',
  TargetType: 'SsoConnection',
  TargetId: event.ConnectionKey,
  Success: success,
  Type: '安全审计',
  Title: event.Action,
  Content: JSON.stringify({
    EventId: event.EventId,
    Success: event.Success,
    ConnectionKey: event.ConnectionKey,
    Protocol: event.Protocol,
    Reason: event.Reason
  }),
  Level: success ? 1 : 2
});

var hookResult = V8.ApiEngine.Run('sso_event_hook', event);
if (!hookResult) return { Code: 0, Msg: 'SSO 租户事件 Hook 未返回结果。' };
return hookResult.Code === 1
  ? { Code: 1, Data: { EventId: event.EventId, Hook: hookResult.Data || null } }
  : { Code: 0, Msg: hookResult.Msg || 'SSO 租户事件 Hook 执行失败。' };
