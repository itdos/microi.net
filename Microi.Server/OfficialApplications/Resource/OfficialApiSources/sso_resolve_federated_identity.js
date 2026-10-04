/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_resolve_federated_identity
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_resolve_federated_identity
 * Version: v1.0.3
 * Function:
 * - 根据已验签的外部身份完成 Claim 映射、BoundOnly/JitMatch/JitCreate、账号绑定与角色映射。
 * - 密码哈希和禁止 JIT 创建平台管理员由 V8.Method.CreateFederatedUser 可信原子能力负责。
 */

if (!V8.Param || V8.Param._TrustedSsoProtocol !== true) {
  return { Code: 0, Msg: '仅已完成标准协议验签的 SSO 网关可以解析外部身份。' };
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (ex) { return {}; }
}

function parseList(value) {
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'object' && value.length !== undefined) {
    var copied = [];
    for (var i = 0; i < value.length; i++) if (text(value[i])) copied.push(text(value[i]));
    return copied;
  }
  var source = text(value);
  try {
    var parsed = JSON.parse(source);
    if (parsed && parsed.length !== undefined) return parseList(parsed);
  } catch (ex) {
  }
  return source.split(/[\r\n,; ]+/).map(text).filter(Boolean);
}

function claimValue(claims, name) {
  var key = text(name);
  if (!key || !claims) return '';
  var value = claims[key];
  if (value && typeof value === 'object' && value.length !== undefined) return text(value[0]);
  return text(value);
}

function normalizeAccount(value) {
  var source = text(value);
  var output = '';
  for (var i = 0; i < source.length; i++) {
    var ch = source.charAt(i);
    if (/[A-Za-z0-9_.@-]/.test(ch)) output += ch;
  }
  return output.length >= 2 && output.length <= 50 ? output : '';
}

function enabledUser(query) {
  if (!query || query.Code !== 1 || !query.Data) return null;
  var state = text(query.Data.State).toLowerCase();
  var deleted = text(query.Data.IsDeleted).toLowerCase();
  if (state === '0' || state === '-1' || state === 'false' || deleted === '1' || deleted === 'true') return null;
  var user = V8.Method.SetSysUserRoleInfo(query.Data, V8.OsClient);
  user.Pwd = '';
  return user;
}

function findUserById(id) {
  if (!text(id)) return null;
  return enabledUser(V8.FormEngine.GetFormData('sys_user', {
    Id: text(id),
    _SelectFields: ['Id', 'Account', 'Name', 'Email', 'Phone', 'Avatar', 'HeadImgUrl', 'RoleIds', 'DeptId', 'DeptIds', 'Level', 'State', 'IsDeleted']
  }));
}

function findUserByAccount(account) {
  if (!text(account)) return null;
  return enabledUser(V8.FormEngine.GetFormData('sys_user', {
    _Where: [['Account', '=', account]],
    _SelectFields: ['Id', 'Account', 'Name', 'Email', 'Phone', 'Avatar', 'HeadImgUrl', 'RoleIds', 'DeptId', 'DeptIds', 'Level', 'State', 'IsDeleted']
  }));
}

function unique(values) {
  var output = [];
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var value = text(values[i]);
    var key = value.toLowerCase();
    if (!value || seen[key]) continue;
    seen[key] = true;
    output.push(value);
  }
  return output;
}

var connection = parseObject(V8.Param.Connection);
var profile = parseObject(V8.Param.Profile);
var claims = parseObject(profile.Claims);
var connectionKey = text(connection.Key || connection.SsoKey).toLowerCase();
if (!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(connectionKey)) {
  return { Code: 0, Msg: 'SSO 连接标识无效。' };
}

var subject = text(profile.Subject) || claimValue(claims, connection.SubjectClaim || 'sub');
if (!subject || subject.length > 500) return { Code: 0, Msg: '外部身份 subject 无效。' };

var account = text(profile.Account) || claimValue(claims, connection.AccountClaim || 'preferred_username');
var displayName = text(profile.Name) || claimValue(claims, connection.NameClaim || 'name');
var email = text(profile.Email) || claimValue(claims, connection.EmailClaim || 'email');
var claimMappings = parseObject(connection.ClaimMappings);
for (var sourceClaim in claimMappings) {
  if (!Object.prototype.hasOwnProperty.call(claimMappings, sourceClaim)) continue;
  var mappedValue = claimValue(claims, sourceClaim);
  var target = text(claimMappings[sourceClaim]).toLowerCase();
  if (!mappedValue) continue;
  if (target === 'account') account = mappedValue;
  else if (target === 'name') displayName = mappedValue;
  else if (target === 'email') email = mappedValue;
  else if (target === 'subject') subject = mappedValue;
}
if (!subject || subject.length > 500) return { Code: 0, Msg: '映射后的外部身份 subject 无效。' };

var providerKey = 'SSO:' + connectionKey;
var bindingResult = V8.FormEngine.GetFormData('mci_user_external_identity', {
  _Where: [['ProviderKey', '=', providerKey], ['ProviderSubject', '=', subject]],
  _SelectFields: ['Id', 'BoundUserId', 'ProviderKey', 'ProviderSubject', 'State', 'IsDeleted', 'BindTime']
});
var binding = bindingResult && bindingResult.Code === 1 ? bindingResult.Data : null;
if (binding && text(binding.IsDeleted) !== '1' && text(binding.State) !== '0') {
  var boundUser = findUserById(binding.BoundUserId);
  if (!boundUser) return { Code: 0, Msg: '绑定的吾码账号不存在或已停用。' };
  V8.FormEngine.UptFormData('mci_user_external_identity', {
    Id: text(binding.Id),
    AccountName: text(account).substring(0, 200),
    DisplayName: text(displayName).substring(0, 200),
    Email: text(email).substring(0, 500),
    LastVerifiedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    State: 1,
    IsDeleted: 0
  });
  return { Code: 1, Data: boundUser };
}

var mode = text(connection.ProvisioningMode || 'BoundOnly').toLowerCase();
var normalizedAccount = normalizeAccount(account);
var user = null;
if (mode === 'jitmatch') {
  user = findUserByAccount(normalizedAccount);
  if (!user) return { Code: 0, Msg: '未找到可匹配的吾码账号；系统不会按邮箱自动合并身份。' };
} else if (mode === 'jitcreate') {
  if (!normalizedAccount) return { Code: 0, Msg: 'JIT 创建需要外部身份返回可用帐号 Claim。' };
  user = findUserByAccount(normalizedAccount);
  if (!user) {
    var roleIds = parseList(connection.JitDefaultRoleIds);
    var roleMappings = parseObject(connection.RoleMappings);
    var externalRoles = parseList(claims[text(connection.RoleClaim || 'roles')]);
    for (var roleIndex = 0; roleIndex < externalRoles.length; roleIndex++) {
      var mapped = parseList(roleMappings[externalRoles[roleIndex]]);
      roleIds = roleIds.concat(mapped);
    }
    var createResult = V8.Method.CreateFederatedUser({
      Account: normalizedAccount,
      Name: text(displayName).substring(0, 100) || normalizedAccount,
      Email: text(email).substring(0, 300),
      RoleIds: unique(roleIds)
    });
    if (!createResult || createResult.Code !== 1 || !createResult.Data) {
      return { Code: 0, Msg: createResult && createResult.Msg ? createResult.Msg : 'JIT 用户创建失败。' };
    }
    user = createResult.Data;
  }
} else {
  return { Code: 0, Msg: '该外部身份尚未绑定吾码账号；请先登录后由管理员或个人中心完成绑定。' };
}

if (!user || !text(user.Id)) return { Code: 0, Msg: 'SSO 用户解析失败。' };
var now = DateNow('yyyy-MM-dd HH:mm:ss');
var bindingForm = {
  BoundUserId: text(user.Id),
  ProviderKey: providerKey,
  ProviderSubject: subject,
  AccountName: text(account).substring(0, 200),
  DisplayName: text(displayName).substring(0, 200),
  Email: text(email).substring(0, 500),
  State: 1,
  IsDeleted: 0,
  BindTime: binding && text(binding.BindTime) ? text(binding.BindTime) : now,
  LastVerifiedTime: now
};
var saveResult;
if (binding && text(binding.Id)) {
  bindingForm.Id = text(binding.Id);
  saveResult = V8.FormEngine.UptFormData('mci_user_external_identity', bindingForm);
} else {
  saveResult = V8.FormEngine.AddFormData('mci_user_external_identity', bindingForm);
}
if (!saveResult || saveResult.Code !== 1) {
  return { Code: 0, Msg: saveResult && saveResult.Msg ? saveResult.Msg : '外部身份绑定失败。' };
}
return { Code: 1, Data: user };
