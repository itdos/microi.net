/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_capabilities
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_capabilities
 * Version: v1.0.3
 * Function:
 * - 匿名返回当前租户已启用的标准 SSO 登录入口；只投影公开字段，不返回端点密钥或运行时配置。
 */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberValue(value, fallback) {
  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function enabled(value) {
  var normalized = text(value).toLowerCase();
  return value === true || value === 1 || normalized === '1' || normalized === 'true';
}

function normalizeProtocol(row) {
  if (!text(row.SsoKey) && (text(row.ServerSsoApi) || text(row.ClientSsoApi) || text(row.TokenName))) {
    return 'LEGACYTOKEN';
  }
  var protocol = text(row.Protocol).toUpperCase();
  return protocol === 'OIDC' || protocol === 'SAML2' || protocol === 'CAS' ? protocol : '';
}

var query = V8.FormEngine.GetTableData('diy_sso', {
  _Where: [['IsEnable', '=', 1]],
  _SelectFields: [
    'Id', 'SsoKey', 'Name', 'Remark', 'Direction', 'Protocol', 'Description', 'Icon', 'Sort', 'IsDefault',
    'ServerSsoApi', 'ClientSsoApi', 'TokenName'
  ],
  _OrderBys: { Sort: 'asc', Name: 'asc' },
  _PageIndex: 1,
  _PageSize: 500
});

if (!query || query.Code !== 1) {
  return { Code: 0, Msg: query && query.Msg ? query.Msg : 'SSO 应用尚未正确安装。' };
}

var rows = query.Data || [];
var providers = [];
var legacyCount = 0;
for (var index = 0; index < rows.length; index++) {
  var row = rows[index] || {};
  if (!enabled(row.IsEnable)) continue;
  var protocol = normalizeProtocol(row);
  if (protocol === 'LEGACYTOKEN') {
    legacyCount++;
    continue;
  }
  if (!protocol || text(row.Direction).toLowerCase() !== 'externaltomicroi') continue;
  var key = text(row.SsoKey).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(key)) continue;
  providers.push({
    ConnectionKey: key,
    Name: text(row.Name) || text(row.Remark) || key,
    Protocol: protocol,
    Description: text(row.Description) || text(row.Remark),
    Icon: text(row.Icon),
    Sort: Math.max(0, Math.min(100000, numberValue(row.Sort, 100))),
    IsDefault: enabled(row.IsDefault),
    BeginUrl: '/api/Sso/Begin?ConnectionKey=' + encodeURIComponent(key)
  });
}

providers.sort(function (left, right) {
  return left.Sort === right.Sort ? left.Name.localeCompare(right.Name) : left.Sort - right.Sort;
});

return {
  Code: 1,
  Data: {
    Providers: providers,
    LegacyCompatibilityCount: legacyCount,
    PlatformSession: 'DiyToken',
    Protocols: ['OIDC', 'SAML2', 'CAS']
  }
};
