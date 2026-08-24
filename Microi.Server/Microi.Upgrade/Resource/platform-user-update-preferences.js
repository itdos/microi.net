/*
 * V8 ApiEngine
 * ApiEngineKey: platform-user-update-preferences
 * Version: v1.0.2
 * Function:
 * - 仅允许登录用户保存自己的界面偏好；目标用户和租户始终取当前 DiyToken 上下文。
 * - 固定白名单覆盖首页、主题、菜单展开和桌面外观，不接受账号、角色、组织或认证字段。
 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}

var param = V8.Param || {};
var currentUser = V8.CurrentUser;
var userId = String(currentUser.Id || '').trim();
var osClient = String(V8.OsClient || '').trim();
var updateModel = { Id: userId };
var updateCount = 0;

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

function normalizeFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return { ok: true, value: 1 };
  if (value === false || value === 0 || value === '0' || value === 'false') return { ok: true, value: 0 };
  return { ok: false, value: 0 };
}

if (hasValue('DefaultIndexUrl')) {
  var defaultIndexUrl = text(param.DefaultIndexUrl);
  if (defaultIndexUrl.length > 500 || hasControl(defaultIndexUrl)) {
    return fail('登录后首页路由长度不能超过500个字符。');
  }
  if (defaultIndexUrl.indexOf('/#/') === 0) defaultIndexUrl = defaultIndexUrl.substring(2);
  else if (defaultIndexUrl.indexOf('#/') === 0) defaultIndexUrl = defaultIndexUrl.substring(1);
  if (defaultIndexUrl && defaultIndexUrl.charAt(0) !== '/') defaultIndexUrl = '/' + defaultIndexUrl;
  var routePath = defaultIndexUrl.split('?')[0].split('#')[0];
  var lowerRoutePath = routePath.toLowerCase();
  if (defaultIndexUrl.indexOf('//') === 0
      || defaultIndexUrl.indexOf('\\') >= 0
      || defaultIndexUrl.toLowerCase().indexOf('://') >= 0
      || routePath.indexOf(':') >= 0
      || lowerRoutePath === '/login'
      || lowerRoutePath.indexOf('/login/') === 0
      || lowerRoutePath === '/access-login'
      || lowerRoutePath.indexOf('/access-login/') === 0) {
    return fail('登录后首页只能使用当前系统内的业务路由。');
  }
  updateModel.DefaultIndexUrl = defaultIndexUrl;
  updateCount++;
}

if (hasValue('ThemeColor')) {
  var themeColor = text(param.ThemeColor);
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
    return fail('主题色必须是 #RRGGBB 格式。');
  }
  updateModel.ThemeColor = themeColor.toUpperCase();
  updateCount++;
}

if (hasValue('ThemeMode')) {
  var themeMode = text(param.ThemeMode).toLowerCase();
  if (themeMode !== 'light' && themeMode !== 'dark') {
    return fail('显示模式只能是 light 或 dark。');
  }
  updateModel.ThemeMode = themeMode;
  updateCount++;
}

if (hasValue('MenuChildExpandMode')) {
  var menuModeRaw = text(param.MenuChildExpandMode).toLowerCase();
  var menuMode = menuModeRaw === '' || menuModeRaw === 'system'
    ? 'System'
    : (menuModeRaw === 'down' ? 'Down' : (menuModeRaw === 'right' ? 'Right' : ''));
  if (!menuMode) return fail('菜单子级展开方式只能是 System、Down 或 Right。');
  updateModel.MenuChildExpandMode = menuMode;
  updateCount++;
}

if (hasValue('DesktopType')) {
  var desktopType = text(param.DesktopType).toLowerCase();
  if (desktopType && desktopType !== 'macos' && desktopType !== 'windows') {
    return fail('桌面模式只能是 macos 或 windows。');
  }
  updateModel.DesktopType = desktopType;
  updateCount++;
}

if (hasValue('DesktopBg')) {
  var desktopBg = text(param.DesktopBg);
  var currentDesktopBg = text(currentUser.DesktopBg);
  if (desktopBg && desktopBg !== currentDesktopBg) {
    var lowerDesktopBg = desktopBg.toLowerCase();
    var requiredPrefix = '/' + osClient.toLowerCase() + '/';
    if (!osClient
        || lowerDesktopBg.indexOf(requiredPrefix) !== 0
        || hasControl(desktopBg)
        || desktopBg.indexOf('\\') >= 0
        || desktopBg.indexOf(':') >= 0
        || lowerDesktopBg.indexOf('..') >= 0
        || lowerDesktopBg.indexOf('%2e') >= 0
        || lowerDesktopBg.indexOf('%5c') >= 0) {
      return fail('桌面背景必须来自当前租户文件目录。');
    }
  }
  updateModel.DesktopBg = desktopBg;
  updateCount++;
}

if (hasValue('RandomDesktopBg')) {
  var randomDesktopBg = normalizeFlag(param.RandomDesktopBg);
  if (!randomDesktopBg.ok) return fail('随机壁纸开关只能是 true 或 false。');
  updateModel.RandomDesktopBg = randomDesktopBg.value;
  updateCount++;
}

if (hasValue('OpenTreeMenu')) {
  var openTreeMenu = normalizeFlag(param.OpenTreeMenu);
  if (!openTreeMenu.ok) return fail('菜单默认展开开关只能是 true 或 false。');
  updateModel.OpenTreeMenu = openTreeMenu.value;
  updateCount++;
}

if (hasValue('DesktopDockMenu')) {
  var rawMenuIds = param.DesktopDockMenu;
  var menuIds = [];
  var seenMenuIds = {};
  if (typeof rawMenuIds === 'string') {
    try { rawMenuIds = JSON.parse(rawMenuIds); }
    catch (error) { return fail('桌面任务栏菜单格式不正确。'); }
  }
  if (!rawMenuIds || typeof rawMenuIds.length === 'undefined' || rawMenuIds.length > 100) {
    return fail('桌面任务栏最多保存 100 个合法菜单标识。');
  }
  for (var index = 0; index < rawMenuIds.length; index++) {
    var menuId = text(rawMenuIds[index]);
    var menuKey = menuId.toLowerCase();
    if (!menuId) continue;
    if (menuId.length > 100 || hasControl(menuId)) {
      return fail('桌面任务栏最多保存 100 个合法菜单标识。');
    }
    if (!seenMenuIds[menuKey]) {
      seenMenuIds[menuKey] = true;
      menuIds.push(menuId);
    }
  }
  updateModel.DesktopDockMenu = JSON.stringify(menuIds);
  updateCount++;
}

if (updateCount === 0) {
  return { Code: 1, Data: currentUser, Msg: '没有需要保存的个人偏好。' };
}

function comparablePreference(name, value) {
  if (name === 'RandomDesktopBg' || name === 'OpenTreeMenu') {
    var normalized = normalizeFlag(value);
    return normalized.ok ? String(normalized.value) : text(value);
  }
  if (name === 'DesktopDockMenu') {
    var parsed = value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (ignore) { return text(value); }
    }
    if (!parsed || typeof parsed.length === 'undefined') return '[]';
    var items = [];
    for (var itemIndex = 0; itemIndex < parsed.length; itemIndex++) items.push(text(parsed[itemIndex]));
    return JSON.stringify(items);
  }
  var result = text(value);
  if (name === 'ThemeColor') return result.toUpperCase();
  if (name === 'ThemeMode' || name === 'DesktopType') return result.toLowerCase();
  return result;
}

// Theme pickers can emit the current value repeatedly. Do not perform a DB
// UPDATE or rebuild the login projection unless at least one normalized value
// actually changed.
var changedModel = { Id: userId };
var changedCount = 0;
for (var fieldName in updateModel) {
  if (!Object.prototype.hasOwnProperty.call(updateModel, fieldName) || fieldName === 'Id') continue;
  if (comparablePreference(fieldName, updateModel[fieldName]) === comparablePreference(fieldName, currentUser[fieldName])) continue;
  changedModel[fieldName] = updateModel[fieldName];
  changedCount++;
}
if (changedCount === 0) {
  return { Code: 1, Data: currentUser, Changed: false, Msg: '个人偏好未变化，无需重复保存。' };
}
updateModel = changedModel;

var updateResult = V8.FormEngine.UptFormData('sys_user', updateModel);
if (!updateResult || updateResult.Code != 1) {
  return updateResult || fail('个人偏好保存失败。');
}

var refreshResult = V8.Method.RefreshLoginUser(userId, osClient);
if (!refreshResult || refreshResult.Code != 1) {
  return refreshResult || fail('偏好已保存，但登录信息刷新失败。');
}

return {
  Code: 1,
  Data: refreshResult.Data,
  Changed: true,
  Msg: '个人偏好已保存并同步到当前账号。'
};
