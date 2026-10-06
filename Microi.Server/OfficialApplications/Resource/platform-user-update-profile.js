/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统账号
 * ApiEngineKey：platform-user-update-profile
 * 从可信吾码官方应用源安装、更新或重新安装“系统账号”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-user-update-profile | Version: v1.0.1 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}

var param = V8.Param || {};
function hasValue(name) {
  return typeof param[name] !== 'undefined' && param[name] !== null;
}
function text(value) {
  return String(value === null || typeof value === 'undefined' ? '' : value).trim();
}
function hasControl(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}
function fail(message) {
  return { Code: 0, Msg: message };
}

// 小程序个人资料头像先通过现有 HDFS avatar 私有目录上传并完成微信图片检测。
// 此处只接受当前租户的头像目录，随后固定更新 V8.CurrentUser.Id，客户端不能指定用户。
function normalizeAvatarPath(value, osClient) {
  var path = text(value);
  if (!path) return { Code: 1, Path: '' };
  if (path.length > 255 || hasControl(path)
      || /^(?:https?:|data:|blob:|file:)/i.test(path)
      || path.indexOf('\\') >= 0 || path.indexOf('..') >= 0
      || path.indexOf('?') >= 0 || path.indexOf('#') >= 0
      || path.indexOf('//') >= 0 || path.indexOf(':') >= 0) {
    return fail('私有头像路径不合法。');
  }
  if (path.charAt(0) !== '/') path = '/' + path;
  var lower = path.toLowerCase();
  var tenant = text(osClient).toLowerCase();
  var avatarPrefix = '/' + tenant + '/avatar/';
  var legacyPrefix = '/' + tenant + '/member/avatar/';
  if (lower.indexOf(avatarPrefix) !== 0 && lower.indexOf(legacyPrefix) !== 0) {
    return fail('私有头像必须来自当前租户的头像上传目录。');
  }
  if (!/\.(?:jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(path)) {
    return fail('头像文件格式不正确。');
  }
  return { Code: 1, Path: path };
}

// 继续复用平台可信原子校验身份、租户及公开头像；私有 Avatar 使用上面的
// V8 路径白名单校验，避免个人资料页借用系统账号管理菜单权限。
var securityParam = {};
var trustedFields = ['Name', 'Email', 'Sex', 'Lang', 'PublicAvatar'];
for (var trustedIndex = 0; trustedIndex < trustedFields.length; trustedIndex++) {
  var trustedName = trustedFields[trustedIndex];
  if (hasValue(trustedName)) securityParam[trustedName] = param[trustedName];
}
var security = V8.Method.PrepareCurrentUserProfileUpdate(securityParam);
if (!security || security.Code !== 1 || !security.Data) {
  return security || { Code: 0, Msg: '账户资料安全校验失败。' };
}

var userId = text(security.Data.UserId);
var osClient = text(security.Data.OsClient);
var current = security.Data.CurrentProfile || {};
var name = text(param.Name);
if (name.length < 1 || name.length > 50 || hasControl(name)) {
  return fail('昵称需为 1 到 50 个字符。');
}

var updateModel = { Id: userId, Name: name };
if (hasValue('Email')) {
  var email = text(param.Email);
  if (email.length > 100 || hasControl(email)
      || (email && !/^[^\s@]+@[^\s@]+$/.test(email))) {
    return fail('邮箱格式不正确。');
  }
  updateModel.Email = email;
}
if (hasValue('Sex')) {
  var sex = text(param.Sex);
  if (sex && sex !== '男' && sex !== '女' && sex !== '保密') {
    return fail('性别只能选择男、女或保密。');
  }
  updateModel.Sex = sex;
}
if (hasValue('Lang')) {
  var lang = text(param.Lang);
  if (lang !== 'zh-CN' && lang !== 'zh-TW' && lang !== 'en') {
    return fail('语言只能选择简体中文、繁体中文或 English。');
  }
  updateModel.Lang = lang;
}
if (hasValue('Avatar')) {
  var avatarResult = normalizeAvatarPath(param.Avatar, osClient);
  if (!avatarResult || avatarResult.Code !== 1) return avatarResult || fail('私有头像路径校验失败。');
  updateModel.Avatar = avatarResult.Path;
}
if (security.Data.HasPublicAvatar) updateModel.PublicAvatar = text(security.Data.PublicAvatar);

var changedModel = { Id: userId };
var changedCount = 0;
for (var fieldName in updateModel) {
  if (!Object.prototype.hasOwnProperty.call(updateModel, fieldName) || fieldName === 'Id') continue;
  if (text(updateModel[fieldName]) === text(current[fieldName])) continue;
  changedModel[fieldName] = updateModel[fieldName];
  changedCount++;
}
if (changedCount === 0) {
  return { Code: 1, Data: V8.CurrentUser, Changed: false, Msg: '账户资料未变化，无需重复保存。' };
}

var beforeHook = V8.ApiEngine.Run('platform-user-custom-hook', {
  Stage: 'BeforeUpdateCurrentProfile',
  SourceApiEngineKey: 'platform-user-update-profile',
  UserId: userId
});
if (!beforeHook || beforeHook.Code !== 1) {
  return beforeHook || fail('系统账号个性化 Hook 未返回结果。');
}

var updateResult = V8.FormEngine.UptFormData('sys_user', changedModel);
if (!updateResult || updateResult.Code !== 1) {
  return updateResult || fail('账户资料保存失败。');
}
var refreshResult;
var refreshWarning = '';
try {
  refreshResult = V8.Method.RefreshLoginUser(userId, osClient);
} catch (refreshError) {
  refreshResult = { Code: 0, Msg: '登录信息刷新发生异常，请重新登录后查看最新资料。' };
}
if (!refreshResult || refreshResult.Code !== 1) {
  refreshWarning = refreshResult && refreshResult.Msg
    ? String(refreshResult.Msg)
    : '登录信息刷新失败，请重新登录后查看最新资料。';
  if (refreshWarning.length > 500) refreshWarning = refreshWarning.substring(0, 500);
  try {
    V8.Method.AddSysLog({
      OsClient: osClient,
      UserId: userId,
      Category: 'Security',
      Action: 'RefreshCurrentProfileProjectionWarning',
      Source: 'platform-user-update-profile',
      Success: false,
      Type: '安全审计',
      Title: '账户资料已保存但登录投影刷新失败',
      Content: JSON.stringify({ UserId: userId, RefreshMessage: refreshWarning }),
      Level: 2
    });
  } catch (refreshAuditError) {
    // 主数据已经保存；审计存储故障不能反转主结果。
  }
}
var afterHook;
try {
  afterHook = V8.ApiEngine.Run('platform-user-custom-hook', {
    Stage: 'AfterUpdateCurrentProfile',
    SourceApiEngineKey: 'platform-user-update-profile',
    UserId: userId
  });
} catch (afterHookError) {
  afterHook = { Code: 0, Msg: '系统账号个性化 Hook 执行异常。' };
}
var hookWarning = '';
if (!afterHook || afterHook.Code !== 1) {
  hookWarning = afterHook && afterHook.Msg
    ? String(afterHook.Msg)
    : '平台运行时个性化 Hook 未返回结果。';
  if (hookWarning.length > 500) hookWarning = hookWarning.substring(0, 500);
  try {
    V8.Method.AddSysLog({
      OsClient: osClient,
      UserId: userId,
      Category: 'Security',
      Action: 'AfterUpdateCurrentProfileHookWarning',
      Source: 'platform-user-update-profile',
      Success: false,
      Type: '安全审计',
      Title: '账户资料已保存但后置个性化 Hook 执行失败',
      Content: JSON.stringify({ UserId: userId, HookMessage: hookWarning }),
      Level: 2
    });
  } catch (hookAuditError) {
    // 主数据已经保存；审计存储故障不能反转主结果。
  }
}
return {
  Code: 1,
  Data: refreshResult && refreshResult.Code === 1 ? refreshResult.Data : null,
  Changed: true,
  DataAppend: (hookWarning || refreshWarning)
    ? { HookWarning: hookWarning || '', RefreshWarning: refreshWarning || '' }
    : null,
  Msg: (hookWarning || refreshWarning)
    ? '账户资料已保存；部分后置刷新未完成，请按告警处理。'
    : '账户资料已保存。'
};
