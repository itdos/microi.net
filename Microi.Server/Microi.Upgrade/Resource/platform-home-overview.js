/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统账号
 * ApiEngineKey：platform-home-overview
 * 从可信吾码官方应用源安装、更新或重新安装“系统账号”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// platform-home-overview v1.0.0
// 当前用户首页概览：只保存菜单 Id 与按日聚合次数，不记录参数、表单内容或页面数据。
var currentUser = V8.CurrentUser || {};
if (!currentUser.Id) {
  return { Code: 0, Msg: '请先登录。' };
}

function asArray(value) {
  var result = [];
  if (!value || typeof value.length !== 'number') return result;
  for (var index = 0; index < value.length; index++) result.push(value[index]);
  return result;
}

function parseStats(value) {
  var parsed = null;
  try { parsed = value ? JSON.parse(String(value)) : null; } catch (_) { parsed = null; }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  if (!parsed.Menus || typeof parsed.Menus !== 'object') parsed.Menus = {};
  parsed.Version = 1;
  return parsed;
}

function isSuperAdmin() {
  var adminFlag = String(currentUser._IsAdmin || '').toLowerCase();
  return currentUser._IsAdmin === true || currentUser._IsAdmin === 1
    || adminFlag === 'true' || adminFlag === '1' || Number(currentUser.Level || 0) >= 9999;
}

function permittedMenuIds() {
  var ids = {};
  var limits = asArray(currentUser._RoleLimits);
  for (var index = 0; index < limits.length; index++) {
    var limit = limits[index] || {};
    var type = String(limit.Type || 'Menu').toLowerCase();
    if (type === 'menu' && limit.FkId) ids[String(limit.FkId).toLowerCase()] = true;
  }
  return ids;
}

var superAdmin = isSuperAdmin();
var permittedIds = permittedMenuIds();

function hasMenuPermission(menuId) {
  return superAdmin || permittedIds[String(menuId || '').toLowerCase()] === true;
}

function normalizeUrl(value) {
  var url = String(value || '').trim();
  if (!url || url.charAt(0) !== '/' || url.indexOf('//') === 0) return '';
  var path = url.split('?')[0].split('#')[0];
  if (path === '/' || path === '/login' || path === '/access-login') return '';
  return url;
}

function isUsableMenu(menu) {
  if (!menu || !menu.Id || Number(menu.IsDeleted || 0) === 1 || Number(menu.Display || 0) !== 1) return false;
  return Boolean(normalizeUrl(menu.Url)) && hasMenuPermission(menu.Id);
}

function getMenus() {
  var response = V8.FormEngine.GetTableData('sys_menu', {
    _Where: [['Display', '=', 1], ['IsDeleted', '=', 0]],
    _SelectFields: ['Id', 'Name', 'Url', 'Icon', 'IconClass', 'Description', 'Sort', 'IsDeleted', 'Display'],
    _OrderBy: 'Sort',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 5000
  });
  if (!response || response.Code !== 1) return [];
  var rows = asArray(response.Data);
  var result = [];
  for (var index = 0; index < rows.length; index++) {
    if (isUsableMenu(rows[index])) result.push(rows[index]);
  }
  return result;
}

function getOwnStats() {
  var response = V8.FormEngine.GetFormData('sys_user', {
    Id: currentUser.Id,
    _SelectFields: ['Id', 'HomeUsageStats']
  });
  if (!response || response.Code !== 1 || !response.Data || String(response.Data.Id) !== String(currentUser.Id)) {
    return parseStats('');
  }
  return parseStats(response.Data.HomeUsageStats);
}

function dateKey(offset) {
  return DateAdd(new Date(), 'd', offset, 'yyyy-MM-dd');
}

function pruneStats(stats) {
  var retainedDays = {};
  for (var dayOffset = -13; dayOffset <= 0; dayOffset++) retainedDays[dateKey(dayOffset)] = true;
  var menuKeys = Object.keys(stats.Menus || {});
  menuKeys.sort(function (left, right) {
    return String(stats.Menus[right].LastOpenedAt || '').localeCompare(String(stats.Menus[left].LastOpenedAt || ''));
  });
  var compact = {};
  for (var index = 0; index < menuKeys.length && index < 60; index++) {
    var key = menuKeys[index];
    var item = stats.Menus[key] || {};
    var daily = {};
    var existingDays = item.Daily || {};
    var dayKeys = Object.keys(existingDays);
    for (var dayIndex = 0; dayIndex < dayKeys.length; dayIndex++) {
      var day = dayKeys[dayIndex];
      if (retainedDays[day] && Number(existingDays[day] || 0) > 0) daily[day] = Number(existingDays[day]);
    }
    compact[key] = {
      Count: Math.max(0, Number(item.Count || 0)),
      LastOpenedAt: String(item.LastOpenedAt || ''),
      Daily: daily
    };
  }
  stats.Menus = compact;
  return stats;
}

function recordMenuOpen() {
  var menuId = String(V8.Param.MenuId || '').trim();
  if (!menuId || menuId.length > 50) return { Code: 0, Msg: 'MenuId 不正确。' };
  if (!hasMenuPermission(menuId)) return { Code: 0, Msg: '无权访问该菜单。' };

  var menuResponse = V8.FormEngine.GetFormData('sys_menu', {
    Id: menuId,
    _SelectFields: ['Id', 'Url', 'Display', 'IsDeleted']
  });
  if (!menuResponse || menuResponse.Code !== 1 || !isUsableMenu(menuResponse.Data)) {
    return { Code: 0, Msg: '菜单不存在、已隐藏或不适合作为首页应用。' };
  }

  var stats = getOwnStats();
  var item = stats.Menus[menuId] || { Count: 0, LastOpenedAt: '', Daily: {} };
  var today = dateKey(0);
  item.Count = Math.max(0, Number(item.Count || 0)) + 1;
  item.LastOpenedAt = DateNow('yyyy-MM-dd HH:mm:ss');
  if (!item.Daily || typeof item.Daily !== 'object') item.Daily = {};
  item.Daily[today] = Math.max(0, Number(item.Daily[today] || 0)) + 1;
  stats.Menus[menuId] = item;
  stats = pruneStats(stats);

  var update = V8.FormEngine.UptFormData('sys_user', {
    Id: currentUser.Id,
    HomeUsageStats: JSON.stringify(stats)
  });
  if (!update || update.Code !== 1) return update || { Code: 0, Msg: '保存访问统计失败。' };
  return { Code: 1, Data: { MenuId: menuId, Recorded: true } };
}

function buildDashboard() {
  var menus = getMenus();
  var menuById = {};
  for (var menuIndex = 0; menuIndex < menus.length; menuIndex++) {
    menuById[String(menus[menuIndex].Id)] = menus[menuIndex];
  }
  var stats = getOwnStats();
  var dates = [];
  var counts = [];
  var weekOpenCount = 0;
  var todayOpenCount = 0;
  for (var offset = -6; offset <= 0; offset++) {
    var key = dateKey(offset);
    var count = 0;
    var statKeys = Object.keys(stats.Menus || {});
    for (var statIndex = 0; statIndex < statKeys.length; statIndex++) {
      var statKey = statKeys[statIndex];
      if (!menuById[statKey]) continue;
      var statItem = stats.Menus[statKey] || {};
      count += Math.max(0, Number((statItem.Daily || {})[key] || 0));
    }
    dates.push(key.substring(5));
    counts.push(count);
    weekOpenCount += count;
    if (offset === 0) todayOpenCount = count;
  }

  var ranked = [];
  var usedAppCount = 0;
  var usedIds = {};
  var keys = Object.keys(stats.Menus || {});
  for (var index = 0; index < keys.length; index++) {
    var menuId = keys[index];
    var menu = menuById[menuId];
    if (!menu) continue;
    var item = stats.Menus[menuId] || {};
    var openCount = Math.max(0, Number(item.Count || 0));
    if (openCount <= 0) continue;
    usedAppCount++;
    usedIds[menuId] = true;
    ranked.push({ Menu: menu, OpenCount: openCount, LastOpenedAt: String(item.LastOpenedAt || '') });
  }
  ranked.sort(function (left, right) {
    return right.OpenCount - left.OpenCount
      || right.LastOpenedAt.localeCompare(left.LastOpenedAt)
      || Number(left.Menu.Sort || 0) - Number(right.Menu.Sort || 0);
  });

  var frequentApps = [];
  function pushApp(menu, openCount) {
    frequentApps.push({
      Id: String(menu.Id),
      Name: String(menu.Name || '未命名应用'),
      Url: normalizeUrl(menu.Url),
      Icon: String(menu.Icon || ''),
      IconClass: String(menu.IconClass || ''),
      Description: String(menu.Description || ''),
      OpenCount: Math.max(0, Number(openCount || 0))
    });
  }
  for (var rankIndex = 0; rankIndex < ranked.length && frequentApps.length < 6; rankIndex++) {
    pushApp(ranked[rankIndex].Menu, ranked[rankIndex].OpenCount);
  }
  for (var fillIndex = 0; fillIndex < menus.length && frequentApps.length < 6; fillIndex++) {
    if (!usedIds[String(menus[fillIndex].Id)]) pushApp(menus[fillIndex], 0);
  }

  return {
    Code: 1,
    Data: {
      TodayOpenCount: todayOpenCount,
      WeekOpenCount: weekOpenCount,
      UsedAppCount: usedAppCount,
      AccessibleAppCount: menus.length,
      AiToolCount: 29,
      Dates: dates,
      Counts: counts,
      FrequentApps: frequentApps,
      HasHistory: ranked.length > 0,
      DataAsOf: DateNow('yyyy-MM-dd HH:mm')
    }
  };
}

var action = String(V8.Param.Action || 'Dashboard').toLowerCase();
if (action === 'recordmenuopen') return recordMenuOpen();
if (action === 'dashboard') return buildDashboard();
return { Code: 0, Msg: '不支持的 Action。' };
