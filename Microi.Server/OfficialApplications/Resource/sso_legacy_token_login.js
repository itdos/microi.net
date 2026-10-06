/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_legacy_token_login
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_legacy_token_login
 * Version: v1.0.5
 * Function:
 * - 兼容存量 Bearer Token 身份源和 SsoPengrui 地址；可信连接配置、外部身份解析与一次性登录票据复用 SSO 能力。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/sysuser/ssopengrui": "Login"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

var tokenName = text(V8.Param && (V8.Param.TokenName || V8.Param.ConnectionKey));
var credential = text(V8.Param && (V8.Param.Token || V8.Param._token || V8.Param.Credential));
if (!tokenName || tokenName.length > 100 || !credential || credential.length > 8192) {
  return { Code: 0, Msg: 'SSO TokenName 或凭据无效。' };
}

var connectionResult = V8.FormEngine.GetFormData('diy_sso', {
  _Where: [['TokenName', '=', tokenName], ['IsEnable', '=', 1]],
  _SelectFields: [
    'Id', 'SsoKey', 'Name', 'ServerSsoApi', 'TokenName', 'ProvisioningMode', 'JitDefaultRoleIds',
    'AccountClaim', 'NameClaim', 'EmailClaim', 'SubjectClaim', 'RoleClaim', 'ClaimMappings', 'RoleMappings'
  ]
});
if (!connectionResult || connectionResult.Code !== 1 || !connectionResult.Data) {
  return { Code: 0, Msg: 'SSO 兼容配置不存在或未启用。' };
}
var row = connectionResult.Data;
var endpoint = text(row.ServerSsoApi);
if (!/^https:\/\//i.test(endpoint) || /https:\/\/[^/]*@/i.test(endpoint)) {
  return { Code: 0, Msg: 'SSO 服务地址必须使用 HTTPS 且不能包含用户凭据。' };
}

var responseText;
try {
  responseText = V8.Http.Get({
    Url: endpoint,
    Headers: { Authorization: 'Bearer ' + credential },
    Timeout: 30
  });
} catch (ex) {
  return { Code: 0, Msg: 'SSO 身份源调用失败。' };
}
var external;
try { external = typeof responseText === 'string' ? JSON.parse(responseText) : responseText; }
catch (ex) { return { Code: 0, Msg: 'SSO 身份源返回格式无效。' }; }
var account = text(external && (external.username || external.account || external.preferred_username));
if (!account) return { Code: 0, Msg: 'SSO 身份验证失败。' };

var id = text(row.Id);
var connectionKey = text(row.SsoKey).toLowerCase();
if (!connectionKey) connectionKey = 'legacy-' + (id.length >= 8 ? id.substring(0, 8) : id);
var resolved = V8.ApiEngine.Run('sso_resolve_federated_identity', {
  _TrustedSsoProtocol: true,
  Connection: {
    Key: connectionKey,
    ProvisioningMode: text(row.ProvisioningMode) || 'JitCreate',
    JitDefaultRoleIds: row.JitDefaultRoleIds || '[]',
    AccountClaim: text(row.AccountClaim) || 'preferred_username',
    NameClaim: text(row.NameClaim) || 'name',
    EmailClaim: text(row.EmailClaim) || 'email',
    SubjectClaim: text(row.SubjectClaim) || 'sub',
    RoleClaim: text(row.RoleClaim) || 'roles',
    ClaimMappings: row.ClaimMappings || '{}',
    RoleMappings: row.RoleMappings || '{}'
  },
  Profile: {
    Subject: account,
    Account: account,
    Name: text(external.name || external.displayName) || account,
    Email: text(external.email),
    Claims: {
      sub: account,
      preferred_username: account,
      name: text(external.name || external.displayName) || account,
      email: text(external.email),
      roles: external.roles || []
    }
  }
});
if (!resolved || resolved.Code !== 1 || !resolved.Data || !text(resolved.Data.Id)) {
  return resolved || { Code: 0, Msg: 'SSO 用户解析失败。' };
}

var ticket = V8.Method.CreateSsoLoginTicket({
  UserId: text(resolved.Data.Id),
  ConnectionKey: connectionKey,
  Protocol: 'LEGACYTOKEN'
});
if (!ticket || ticket.Code !== 1 || !ticket.Data) return ticket || { Code: 0, Msg: 'SSO 登录票据创建失败。' };

var loginResult = V8.Method.CompleteSsoLogin({
  Ticket: ticket.Data,
  Did: V8.Param.Did || '',
  ClientType: V8.Param._ClientType || V8.Param.ClientType || 'PC'
});
if (!loginResult || loginResult.Code !== 1) return loginResult || { Code: 0, Msg: 'SSO 登录失败。' };
try {
  V8.ApiEngine.Run('sso_protocol_event', {
    _TrustedSsoProtocol: true,
    Action: 'LegacySsoLogin',
    UserId: text(resolved.Data.Id),
    ConnectionKey: connectionKey,
    Protocol: 'LEGACYTOKEN',
    Success: true,
    Reason: '',
    OccurredAt: DateNow('yyyy-MM-dd HH:mm:ss')
  });
} catch (ex) {
}
return loginResult;
