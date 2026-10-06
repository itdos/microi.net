/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform_auth_login_event
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform_auth_login_event
 * Version: v1.0.1
 * Function:
 * - 接收后端启动登录或应用登录的脱敏结果，统一审计并调用租户 CreateIfMissing Hook。
 */

if (!V8.Param || V8.Param._TrustedPlatformAuthProtocol !== true) {
  return { Code: 0, Msg: '仅可信登录内核或身份应用可以提交登录事件。' };
}

function text(value, maxLength) {
  var output = value === null || value === undefined ? '' : String(value).trim();
  return maxLength && output.length > maxLength ? output.substring(0, maxLength) : output;
}

var success = V8.Param.Success === true || V8.Param.Success === 1 || text(V8.Param.Success).toLowerCase() === 'true';
var event = {
  EventId: text(V8.Param.EventId, 128) || V8.EncryptHelper.Sha256Hex([
    V8.OsClient,
    text(V8.Param.Action, 80),
    text(V8.Param.UserId, 80),
    text(V8.Param.OccurredAt, 50)
  ].join('|')),
  Action: text(V8.Param.Action, 80) || (success ? 'LoginSucceeded' : 'LoginFailed'),
  UserId: text(V8.Param.UserId, 80),
  SubjectHash: text(V8.Param.SubjectHash, 128),
  LoginMethod: text(V8.Param.LoginMethod, 30).toUpperCase(),
  Success: success,
  Reason: text(V8.Param.Reason, 200),
  OccurredAt: text(V8.Param.OccurredAt, 50) || DateNow('yyyy-MM-dd HH:mm:ss')
};

V8.Method.AddSysLog({
  OsClient: V8.OsClient,
  UserId: event.UserId,
  Category: 'Security',
  Action: event.Action,
  Source: 'PlatformAuthApiEngine',
  TargetType: 'Session',
  TargetId: event.UserId || event.SubjectHash,
  Success: event.Success,
  Type: '登录审计',
  Title: event.Action,
  Content: JSON.stringify({
    EventId: event.EventId,
    LoginMethod: event.LoginMethod,
    Success: event.Success,
    Reason: event.Reason
  }),
  Level: event.Success ? 1 : 2
});

var hook = V8.ApiEngine.Run('platform_auth_login_hook', event);
return hook && hook.Code === 1
  ? { Code: 1, Data: { EventId: event.EventId, Hook: hook.Data || null } }
  : { Code: 0, Msg: hook && hook.Msg ? hook.Msg : '登录租户 Hook 执行失败。' };
