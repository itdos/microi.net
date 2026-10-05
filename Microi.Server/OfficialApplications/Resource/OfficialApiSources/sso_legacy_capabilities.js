/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_legacy_capabilities
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_legacy_capabilities
 * Version: v1.0.4
 * Function:
 * - 为存量 URL Token 客户端返回最小兼容投影；不暴露服务端校验地址、Token 或其它 SSO 配置。
 */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function enabled(value) {
  var normalized = text(value).toLowerCase();
  return value === true || value === 1 || normalized === '1' || normalized === 'true';
}

function safeClientApi(value) {
  var route = text(value);
  return /^\/api\/SysUser\/SsoPengrui$/i.test(route)
    || /^\/api\/SysUser\/TokenLogin$/i.test(route)
    || /^\/api\/Sso\/Legacy$/i.test(route)
    || /^\/apiengine\/sso_legacy_token_login$/i.test(route);
}

var query = V8.FormEngine.GetTableData('diy_sso', {
  _Where: [['IsEnable', '=', 1]],
  _SelectFields: ['Id', 'SsoKey', 'Protocol', 'Direction', 'ClientSsoApi', 'ServerSsoApi', 'TokenName', 'GetTokenType', 'Sort', 'IsEnable'],
  _OrderBy: 'Sort',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 500
});

if (!query || query.Code !== 1) {
  return { Code: 0, Msg: query && query.Msg ? query.Msg : 'SSO 应用尚未正确安装。' };
}

var output = [];
var rows = query.Data || [];
for (var index = 0; index < rows.length; index++) {
  var row = rows[index] || {};
  var isLegacy = !text(row.SsoKey)
    && (text(row.ServerSsoApi) || text(row.ClientSsoApi) || text(row.TokenName));
  if (!enabled(row.IsEnable) || !isLegacy) continue;
  var tokenName = text(row.TokenName) || 'token';
  var clientApi = text(row.ClientSsoApi);
  if (!/^[A-Za-z0-9._~-]{1,64}$/.test(tokenName) || !safeClientApi(clientApi)) continue;
  output.push({
    Id: text(row.Id),
    IsEnable: true,
    // Platform DiyToken must use its own signature/session/tenant validation;
    // never forward it to a configured external identity provider.
    ClientSsoApi: /^\/api\/SysUser\/TokenLogin$/i.test(clientApi)
      ? '/api/SysUser/TokenLogin'
      : '/apiengine/sso_legacy_token_login',
    TokenName: tokenName,
    GetTokenType: text(row.GetTokenType) || 'Url'
  });
}

return { Code: 1, Data: output };
