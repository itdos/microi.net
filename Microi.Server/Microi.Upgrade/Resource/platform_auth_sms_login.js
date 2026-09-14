/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform_auth_sms_login
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform_auth_sms_login
 * Version: v1.0.3
 * Function:
 * - 兼容 SmsLogin 地址的短信验证码登录与首次注册编排；验证码原子消费、密码哈希和 DiyToken 由可信原子负责。
 */

/* LEGACY_ROUTE_ACTIONS_V1:BEGIN */
// 宿主提供的实际路径固定旧动作；正文 Action 不能把读接口变成写接口。
var legacyRouteActions = {
  "/api/sysuser/smslogin": "Login"
};
var legacyRequestPath = String((V8.Param || {})._RequestPath || '').split('?')[0].replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
if (Object.prototype.hasOwnProperty.call(legacyRouteActions, legacyRequestPath)) {
  V8.Param.Action = legacyRouteActions[legacyRequestPath];
}
/* LEGACY_ROUTE_ACTIONS_V1:END */

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function fail(message) {
  return { Code: 0, Msg: message || '短信登录失败。' };
}

var requestedTenant = text(V8.Param && V8.Param.OsClient);
if (requestedTenant && requestedTenant.toLowerCase() !== text(V8.OsClient).toLowerCase()) {
  return fail('禁止跨租户执行短信登录。');
}

var phone = text(V8.Param && V8.Param.Phone);
var code = text(V8.Param && (V8.Param._CaptchaValue || V8.Param.SmsCode));
var password = text(V8.Param && (V8.Param.Pwd || V8.Param.Password));
var clientType = text(V8.Param && V8.Param._ClientType) || 'PC';
var did = text(V8.Param && (V8.Param.Did || V8.Param.did));
if (!/^1\d{10}$/.test(phone)) return fail('请输入正确的11位手机号！');
if (!code || code.length > 32) return fail('请输入短信验证码！');
if (password && password.length < 6) return fail('密码长度不能少于6位！');

var proofResult = V8.Method.CreatePlatformSmsProof({ Phone: phone, Code: code });
if (!proofResult || proofResult.Code !== 1 || !proofResult.Data) {
  return proofResult || fail('短信验证码验证失败。');
}
var proof = text(proofResult.Data);

var query = V8.FormEngine.GetFormData('sys_user', {
  _Where: [['Phone', '=', phone]],
  _SelectFields: [
    'Id', 'Account', 'Name', 'Phone', 'Email', 'Avatar', 'HeadImgUrl',
    'RoleIds', 'DeptId', 'DeptIds', 'Level', 'State', 'IsDeleted'
  ]
});
var user = query && query.Code === 1 ? query.Data : null;
var isNewUser = false;
if (!user) {
  if (query && query.Code !== 1 && query.Code !== 2) {
    return fail(query.Msg || '查询用户失败。');
  }
  var createResult = V8.Method.CreatePlatformSmsUser({
    Proof: proof,
    Phone: phone,
    Password: password
  });
  if (!createResult || createResult.Code !== 1 || !createResult.Data) {
    return createResult || fail('注册失败。');
  }
  user = createResult.Data;
  isNewUser = true;
} else {
  var state = text(user.State).toLowerCase();
  var deleted = text(user.IsDeleted).toLowerCase();
  if (state === '0' || state === '-1' || state === 'false' || deleted === '1' || deleted === 'true') {
    return fail('帐号已停用，请联系管理员。');
  }
  if (!text(user.Account) || !text(user.Name)) {
    var repair = V8.FormEngine.UptFormData('sys_user', {
      Id: text(user.Id),
      Account: text(user.Account) || phone,
      Phone: phone,
      Name: text(user.Name) || phone
    });
    if (!repair || repair.Code !== 1) return fail(repair && repair.Msg ? repair.Msg : '恢复账号失败。');
  }
}

var loginResult = V8.Method.CompletePlatformSmsLogin({
  Proof: proof,
  UserId: text(user.Id),
  Phone: phone,
  ClientType: clientType,
  Did: did,
  PasswordProvided: !!password,
  IsNewUser: isNewUser
});
if (!loginResult || loginResult.Code !== 1) return loginResult || fail('短信登录失败。');

try {
  V8.ApiEngine.Run('platform_auth_login_event', {
    _TrustedPlatformAuthProtocol: true,
    Action: isNewUser ? 'SmsRegisterLogin' : 'SmsLogin',
    UserId: text(user.Id),
    LoginMethod: 'SMS',
    Success: true,
    Reason: '',
    OccurredAt: DateNow('yyyy-MM-dd HH:mm:ss')
  });
} catch (ex) {
  console.log('platform_auth_sms_login event failed: ' + ex.message);
}
return loginResult;
