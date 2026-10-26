/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：official_sms_login
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: official_sms_login
 * Version: v1.1.8
 * Function:
 * - 官网密码及短信登录、基于平台密码哈希的短信注册、新账号邀请绑定和独立官网登录时间；兼容唯一手机号别名并透传请求语言，认证后及角色补齐后按已验证用户Id回读，保持DiyToken会话体系。
 */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function fail(msg, data) {
  return { Code: 0, Msg: msg || '登录失败。', Data: data || null };
}

function ok(msg, data, append) {
  return { Code: 1, Msg: msg || '成功', Data: data || null, DataAppend: append || {} };
}

function getValue(obj, key) {
  try {
    if (!obj || obj[key] === undefined || obj[key] === null) return '';
    return obj[key];
  } catch (ex) {
    return '';
  }
}

function normalizeUrl(url) {
  var value = text(url);
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : 'https://' + value;
}

function param(name) {
  try {
    return V8.Param && V8.Param[name] !== undefined ? V8.Param[name] : '';
  } catch (ex) {
    return '';
  }
}

// 语言来自当前请求并继续传给认证内核；匿名入口不能依赖某个已登录用户的偏好缓存。
function requestLanguage() {
  return text(param('_Lang') || (V8.Header && (V8.Header.lang || V8.Header.Lang))) || 'cn';
}

// 手机号只作登录别名。精确账号优先，多个手机号匹配时拒绝而不是任取第一条。
function resolvePasswordAccount(osClient, input) {
  if (!/^1\d{10}$/.test(input)) return { Code: 1, Account: input, UserId: '' };
  var exact = V8.FormEngine.GetFormData('Sys_User', {
    OsClient: osClient,
    _Where: [['Account', '=', input]],
    _SelectFields: ['Id', 'Account']
  });
  if (exact && exact.Code === 1 && exact.Data && text(exact.Data.Id) && text(exact.Data.Account)) {
    return { Code: 1, Account: text(exact.Data.Account), UserId: text(exact.Data.Id) };
  }
  if (!exact || exact.Code !== 2) return { Code: 0 };
  var phoneMatches = V8.FormEngine.GetTableData('Sys_User', {
    OsClient: osClient,
    _Where: [['Phone', '=', input]],
    _SelectFields: ['Id', 'Account'],
    _PageIndex: 1,
    _PageSize: 2
  });
  if (!phoneMatches || phoneMatches.Code !== 1 || !phoneMatches.Data
      || phoneMatches.Data.length !== 1 || Number(phoneMatches.DataCount || 1) !== 1
      || !text(phoneMatches.Data[0].Id) || !text(phoneMatches.Data[0].Account)) return { Code: 0 };
  return { Code: 1, Account: text(phoneMatches.Data[0].Account), UserId: text(phoneMatches.Data[0].Id) };
}

function queryUser(osClient, accountOrPhone) {
  return V8.FormEngine.GetFormData('Sys_User', {
    OsClient: osClient,
    _Where: [['Phone', '=', accountOrPhone], ['OR', 'Account', '=', accountOrPhone]],
    _SelectFields: ['Id', 'Account', 'Name', 'Phone', 'PublicAvatar', 'Avatar', 'RoleIds', 'Level', 'DeptId', 'DeptName', 'State', 'IsDeleted']
  });
}


function queryUserById(osClient, userId) {
  return V8.FormEngine.GetFormData('Sys_User', {
    OsClient: osClient,
    Id: userId,
    _SelectFields: ['Id', 'Account', 'Name', 'Phone', 'PublicAvatar', 'Avatar', 'RoleIds', 'Level', 'DeptId', 'DeptName', 'State', 'IsDeleted']
  });
}

function failIdentityReadback(stage, result) {
  var traceId = V8.Method.NewGuid().replace(/-/g, '');
  try {
    V8.Method.AddSysLog({
      Type: '官网登录身份回读失败',
      Title: '官网登录身份回读失败[' + stage + '][' + traceId + ']',
      Content: JSON.stringify({ TraceId: traceId, Stage: stage, ResultCode: result ? result.Code : null }),
      Remark: traceId,
      Level: 3
    });
  } catch (ex) {
  }
  return { Code: 0, Msg: '登录身份回读失败。', DataAppend: { TraceId: traceId } };
}

function ensureEnabledState(userData) {
  var state = text(getValue(userData, 'State'));
  return state === '1' && text(getValue(userData, 'IsDeleted')) !== '1';
}

function getWebsiteRoleIds(osClient) {
  var roleResult = V8.FormEngine.GetFormData('sys_role', {
    OsClient: osClient,
    _Where: [['Name', '=', '个人版角色']],
    _SelectFields: ['Id', 'Name', 'Level']
  });
  if (!roleResult || roleResult.Code !== 1 || !roleResult.Data || !text(getValue(roleResult.Data, 'Id'))) {
    return fail('系统未配置个人版角色，请联系管理员。');
  }
  return ok('已读取官网注册角色', JSON.stringify([{
    Id: text(getValue(roleResult.Data, 'Id')),
    Name: text(getValue(roleResult.Data, 'Name')) || '个人版角色',
    Level: getValue(roleResult.Data, 'Level') || 0
  }]));
}

function ensureWebsiteUserRole(osClient, userData) {
  var currentRoleIds = text(getValue(userData, 'RoleIds'));
  if (currentRoleIds && currentRoleIds !== '[]' && currentRoleIds !== 'null') {
    return ok('用户已有角色', userData);
  }

  var websiteRole = getWebsiteRoleIds(osClient);
  if (websiteRole.Code !== 1) return websiteRole;

  var userId = text(getValue(userData, 'Id'));
  var updateResult = V8.FormEngine.UptFormData('Sys_User', {
    OsClient: osClient,
    Id: userId,
    RoleIds: websiteRole.Data
  });
  if (!updateResult || updateResult.Code !== 1) {
    return fail('分配官网用户角色失败：' + (updateResult && updateResult.Msg ? updateResult.Msg : ''));
  }

  var refreshedUser = queryUserById(osClient, userId);
  if (!refreshedUser || refreshedUser.Code !== 1 || !refreshedUser.Data || text(getValue(refreshedUser.Data, 'Id')) !== userId) {
    return failIdentityReadback('RoleReadback', refreshedUser);
  }
  return ok('官网用户角色已分配', refreshedUser.Data);
}

function buildLoginResponse(osClient, userId, loginUser, accessToken, isNewUser, msg) {
  // 内层认证已经签发会话。这里只复用并校验该Token；重置撤销后不得重新签发使旧认证复活。
  var authenticatedSession = V8.Method.GetCurrentToken(accessToken, osClient);
  if (!authenticatedSession || lower(authenticatedSession.OsClient) !== lower(osClient)
      || text(getValue(authenticatedSession.CurrentUser, 'Id')) !== userId) {
    return fail(V8.TranslateEngine.GetLang('AccountOrPwdError', requestLang));
  }
  var currentUser = V8.Method.SetSysUserRoleInfo(loginUser, osClient);
  currentUser.Authorization = accessToken;
  currentUser.Pwd = '';

  var tenantOsClient = '';
  var tenantName = '';
  var tenantUrl = '';
  try {
    var tenantResult = V8.Method.GetUserTenant(userId);
    if (tenantResult && tenantResult.Code === 1 && tenantResult.Data) {
      tenantOsClient = text(getValue(tenantResult.Data, 'OsClient'));
      tenantName = text(getValue(tenantResult.Data, 'ClientName') || getValue(tenantResult.Data, 'Name'));
      tenantUrl = normalizeUrl(getValue(tenantResult.Data, 'Url') || getValue(tenantResult.Data, 'DomainName'));
      if (!tenantUrl && tenantOsClient) tenantUrl = 'https://' + tenantOsClient + '.microi.net';
    }
  } catch (ex) {
  }

  var sysConfig = null;
  try {
    var sysConfigResult = V8.FormEngine.GetFormData('sys_config', {
      OsClient: osClient,
      _Where: [['IsEnable', '=', 1]],
      _SelectFields: ['Id', 'SysTitle', 'SysShortTitle', 'ApiBase', 'FileServer', 'HomePageRoute', 'SysLang', 'SysLangs']
    });
    if (sysConfigResult && sysConfigResult.Code === 1) sysConfig = sysConfigResult.Data;
  } catch (ex) {
  }

  try {
    V8.FormEngine.UptFormData('Sys_User', {
      OsClient: osClient,
      Id: userId,
      LastLoginIP: V8.Method.GetClientIP().Data || '',
      LastLoginTime: DateNow('yyyy-MM-dd HH:mm:ss'),
      LastWebsiteLoginTime: DateNow('yyyy-MM-dd HH:mm:ss')
    });
  } catch (ex) {
  }

  try {
    V8.Method.AddSysLog({
      Type: '官网登录日志',
      Title: text(getValue(loginUser, 'Account')) + (isNewUser ? '注册并登录' : '登录') + '了系统',
      Level: 1
    });
  } catch (ex) {
  }

  return ok(msg || (isNewUser ? '注册并登录成功' : '登录成功'), currentUser, {
    SysConfig: sysConfig,
    IsNewUser: isNewUser,
    Token: accessToken,
    TenantOsClient: tenantOsClient || null,
    TenantName: tenantName || null,
    TenantUrl: tenantUrl || null,
    Url: tenantUrl || null
  });
}


var osClient = text(V8.OsClient);
if (text(param('OsClient')) && lower(param('OsClient')) !== lower(osClient)) return fail('禁止跨租户登录。');
var action = lower(param('Action') || 'login');
var loginType = lower(param('LoginType') || 'password');
var account = text(param('Account') || param('Phone'));
var phone = text(param('Phone') || account);
// 密码是原始凭据，不能像手机号/账号一样 trim，必须与注册和重置的哈希输入一致。
var password = param('Pwd') === null || param('Pwd') === undefined ? '' : String(param('Pwd'));
var requestLang = requestLanguage();
var passwordUserId = '';
var clientType = 'PC';
if (action !== 'login' && action !== 'register') return fail('Action只能是login或register。');
if (loginType !== 'sms' && loginType !== 'password') return fail('登录方式无效。');
var inviteCode = text(param('InviteCode'));
var inviter = null;
if (action === 'register') {
  if (!/^1\d{10}$/.test(phone) || password.length < 6) return fail('请输入有效手机号和至少6位密码。');
  var existing = queryUser(osClient, phone);
  if (existing.Code === 1) return fail('手机号已注册，请直接登录。');
  if (existing.Code !== 2) return fail('注册前账号查询失败。');
  if (inviteCode) {
    if (!/^[A-Za-z0-9-]{1,36}$/.test(inviteCode)) return fail('邀请链接无效。');
    var invitation = V8.FormEngine.GetFormData('sys_user', {
      Id: inviteCode, _SelectFields: ['Id','InvitationPath','State','IsDeleted']
    });
    if (invitation.Code !== 1 || !ensureEnabledState(invitation.Data)) return fail('邀请链接已失效。');
    inviter = invitation.Data;
    if (text(inviter.InvitationPath).length > 1900) return fail('邀请关系已达到层级上限。');
  }
  var role = getWebsiteRoleIds(osClient);
  if (role.Code !== 1) return role;
}
var verified;
if (action === 'register' || loginType === 'sms') {
  if (action !== 'register') {
    var smsExisting = queryUser(osClient, phone);
    if (smsExisting.Code !== 1) return fail('手机号未注册，请先注册。');
  }
  verified = V8.ApiEngine.Run('platform_auth_sms_login', {
    OsClient: osClient, Phone: phone, Pwd: action === 'register' ? password : '',
    _CaptchaValue: text(param('_SmsCaptchaValue') || param('_CaptchaValue')),
    _ClientType: clientType, Did: text(V8.Header.did || V8.Header.Did), _Lang: requestLang
  });
} else {
  var passwordAccount = resolvePasswordAccount(osClient, account);
  if (passwordAccount.Code !== 1) return fail(V8.TranslateEngine.GetLang('AccountOrPwdError', requestLang));
  passwordUserId = passwordAccount.UserId;
  // 固定平台密码登录入口同时支持新密码哈希与存量 DES，不接收客户端旁路开关。
  verified = V8.ApiEngine.Run('platform-sys-user-session', {
    Action: 'Login', _HttpMethod: 'POST', OsClient: osClient,
    Account: passwordAccount.Account, Pwd: password, _ClientType: clientType, _Lang: requestLang,
    _CaptchaId: text(param('_CaptchaId')), _CaptchaValue: text(param('_CaptchaValue'))
  });
}
if (!verified || verified.Code !== 1 || !verified.Data) return verified || fail('登录失败。');
var verifiedUserId = text(verified.Data.Id);
if (!verifiedUserId) return failIdentityReadback('VerifiedIdentityMissing', verified);
// 解析和认证之间账号可能被并发修改；别名映射不能把密码验证成功的其它身份当成原账号。
if (passwordUserId && passwordUserId !== verifiedUserId) return fail(V8.TranslateEngine.GetLang('AccountOrPwdError', requestLang));
var verifiedToken = text(getValue(verified.DataAppend, 'Token') || getValue(verified.Data, 'Authorization'));
if (!verifiedToken) {
  // 平台密码登录将已签发 Token 写入当前 HTTP 响应头，正文仅返回用户和系统配置。
  // 此处仅在内层认证成功后读取响应头，禁止使用客户端请求头或重新签发会话。
  try {
    var responseToken = V8.HttpContext.Response.Headers['authorization'];
    verifiedToken = text(responseToken && typeof responseToken.ToString === 'function' ? responseToken.ToString() : responseToken);
  } catch (ex) {
  }
}
if (!verifiedToken) return failIdentityReadback('VerifiedTokenMissing', verified);
var isNewUser = action === 'register' && !!(verified.DataAppend && verified.DataAppend.IsNewUser);
if (action === 'register' && !isNewUser) return fail('手机号已注册，请直接登录。');
if (isNewUser && inviter) {
  if (verifiedUserId === text(inviter.Id)) return fail('不能邀请自己。');
  var bind = V8.FormEngine.UptFormData('sys_user', {
    Id: verifiedUserId, InviterUserId: text(inviter.Id),
    InvitationPath: text(inviter.InvitationPath) + '/' + text(inviter.Id)
  });
  if (bind.Code !== 1) return fail('邀请关系绑定失败，请联系管理员。');
}
// 登录成功后身份只能由验证结果的不可变 Id 定位，手机号/账号仅作登录输入，不能重新选择身份。
var userResult = queryUserById(osClient, verifiedUserId);
if (!userResult || userResult.Code !== 1 || !userResult.Data || text(getValue(userResult.Data, 'Id')) !== verifiedUserId) return failIdentityReadback('IdentityReadback', userResult);
if (!ensureEnabledState(userResult.Data)) return fail('当前账号已停用，不允许登录。');
var roleResult = ensureWebsiteUserRole(osClient, userResult.Data);
if (roleResult.Code !== 1) return roleResult;
return buildLoginResponse(osClient, verifiedUserId, roleResult.Data, verifiedToken, isNewUser, isNewUser ? '注册并登录成功' : '登录成功');
