/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_outbound_claims
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_outbound_claims
 * Version: v1.0.3
 * Function:
 * - 按 OIDC scope 生成最小对外 Claim；禁止返回手机号、DiyToken、密码、部门权限明细或租户私有字段。
 */

if (!V8.Param || V8.Param._TrustedSsoProtocol !== true) {
  return { Code: 0, Msg: '仅 SSO 标准协议网关可以生成对外 Claim。' };
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function hasScope(scope, name) {
  var values = text(scope).split(/\s+/);
  for (var i = 0; i < values.length; i++) if (values[i] === name) return true;
  return false;
}

function roleNames(user) {
  var source = user && user.RoleName !== undefined ? user.RoleName : '';
  if (source && typeof source === 'object' && source.length !== undefined) {
    var output = [];
    for (var i = 0; i < source.length; i++) if (text(source[i])) output.push(text(source[i]));
    return output;
  }
  return text(source) ? text(source).split(/[,;]+/).map(text).filter(Boolean) : [];
}

var user = V8.Param.User || {};
var claims = { sub: text(V8.Param.Subject) };
if (!claims.sub) return { Code: 0, Msg: 'OIDC subject 不能为空。' };
if (hasScope(V8.Param.Scope, 'profile')) {
  claims.name = text(user.Name);
  claims.preferred_username = text(user.Account);
}
if (hasScope(V8.Param.Scope, 'email') && text(user.Email)) {
  claims.email = text(user.Email);
}
if (hasScope(V8.Param.Scope, 'roles')) {
  claims.roles = roleNames(user);
}
return { Code: 1, Data: claims };
