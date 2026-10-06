/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_connection_runtime
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_connection_runtime
 * Version: v1.0.3
 * Function:
 * - 向 C# 标准协议网关提供 diy_sso 白名单运行时配置；仅可由服务端或其它接口引擎内部调用。
 */

if (!V8.Param || V8.Param._TrustedSsoProtocol !== true) {
  return { Code: 0, Msg: '仅 SSO 标准协议网关可以读取运行时连接配置。' };
}

var fields = [
  'Id', 'SsoKey', 'Name', 'Remark', 'Direction', 'Protocol', 'Description', 'Icon', 'Sort', 'IsEnable', 'IsDefault',
  'Issuer', 'DiscoveryUrl', 'AuthorizationEndpoint', 'TokenEndpoint', 'UserInfoEndpoint', 'JwksUri', 'EndSessionEndpoint',
  'IntrospectionEndpoint', 'RevocationEndpoint', 'ClientId', 'ClientAuthMethod', 'ClientSecretSettingKey', 'Scopes',
  'RedirectUris', 'PostLogoutRedirectUris', 'SubjectClaim', 'AccountClaim', 'NameClaim', 'EmailClaim', 'RoleClaim',
  'ClaimMappings', 'RoleMappings', 'ProvisioningMode', 'JitDefaultRoleIds', 'RequirePkce', 'RequireNonce', 'ValidateIssuer',
  'ValidateAudience', 'AllowPrivateEndpoint', 'AllowLoopbackRedirectUri', 'AccessTokenLifetimeMinutes', 'RefreshTokenLifetimeDays',
  'EntityId', 'MetadataUrl', 'SingleSignOnUrl', 'SingleLogoutUrl', 'AssertionConsumerServiceUrl',
  'SigningCertificateSettingKey', 'ValidateCertSettingKey', 'EncryptCertSettingKey', 'RequireSignedAssertions', 'EncryptAssertions',
  'CasServerUrl', 'CasVersion', 'ServerSsoApi', 'ClientSsoApi', 'TokenName', 'GetTokenType'
];

var result = V8.FormEngine.GetTableData('diy_sso', {
  _Where: [['IsEnable', '=', 1]],
  _SelectFields: fields,
  _OrderBy: 'Sort',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 500
});

if (!result || result.Code !== 1) {
  return { Code: 0, Msg: result && result.Msg ? result.Msg : 'SSO 连接配置读取失败。' };
}
return { Code: 1, Data: result.Data || [] };
