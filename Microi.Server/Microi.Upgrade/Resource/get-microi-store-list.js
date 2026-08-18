/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store
 * Version: v1.4.1
 * Function:
 * - 联邦应用商城列表：公开/私有可见性、分类筛选、安装版本和来源统计。
 */

function text(value, fallback) { return value === null || value === undefined ? (fallback || "") : String(value); }
function trim(value) { return text(value).replace(/^\s+|\s+$/g, ""); }
function lower(value) { return trim(value).toLowerCase(); }
function toArray(value) {
  var result = [];
  if (!value || value.length === undefined) return result;
  for (var i = 0; i < value.length; i++) result.push(value[i]);
  return result;
}
function values(input) {
  if (!input) return [];
  if (typeof input === "string") return input.split(",").map(trim).filter(Boolean);
  return toArray(input).map(trim).filter(Boolean);
}
function appendUnique(target, items) {
  for (var i = 0; i < items.length; i++) if (items[i] && target.indexOf(items[i]) < 0) target.push(items[i]);
}
function contains(list, value) {
  if (!list.length) return true;
  for (var i = 0; i < list.length; i++) if (lower(list[i]) === lower(value)) return true;
  return false;
}
function flag(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  var normalized = lower(value);
  if (["1", "true", "yes", "on", "enabled"].indexOf(normalized) >= 0) return true;
  if (["0", "false", "no", "off", "disabled"].indexOf(normalized) >= 0) return false;
  return fallback;
}
function hasAuthenticatedUser() {
  var user = V8.CurrentUser || {};
  if (user.Id) return true;
  try {
    var token = V8.Method && V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    return !!(token && token.CurrentUser && token.CurrentUser.Id);
  } catch (error) { return false; }
}
function currentUserId() {
  var user = V8.CurrentUser || {};
  if (user.Id) return trim(user.Id);
  try {
    var token = V8.Method && V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    return trim(token && token.CurrentUser && token.CurrentUser.Id);
  } catch (error) { return ""; }
}
function splitVersion(version) {
  var source = text(version).replace(/^v/i, "").split(".");
  var result = [];
  for (var i = 0; i < source.length; i++) result.push(parseInt(source[i].replace(/[^0-9]/g, "") || "0", 10) || 0);
  return result;
}
function compareVersion(left, right) {
  var a = splitVersion(left), b = splitVersion(right), length = Math.max(a.length, b.length);
  for (var i = 0; i < length; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
}
function first(row, names) {
  for (var i = 0; row && i < names.length; i++) if (row[names[i]] !== null && row[names[i]] !== undefined && row[names[i]] !== "") return row[names[i]];
  return "";
}
function addMap(map, key, row) { key = lower(key); if (key && !map[key]) map[key] = row; }
function installedMap() {
  var external = V8.Param.InstalledVersions || V8.Param.InstalledApps;
  var rows = external ? toArray(external) : [];
  if (!external) {
    try {
      var result = V8.FormEngine.GetTableData("sys_microistoreversion", {
        _SelectFields: ["Id", "StoreId", "AppId", "AppName", "AppVersion", "AppVersionInstall", "InstallStatus", "InstallTime"],
        _PageIndex: 1,
        _PageSize: 5000
      });
      rows = result && result.Code === 1 ? toArray(result.Data) : [];
    } catch (error) { rows = []; }
  }
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    addMap(map, row.StoreId, row); addMap(map, row.AppId, row); addMap(map, row.AppName, row); addMap(map, row.Id, row);
  }
  return map;
}
function findInstalled(map, app) {
  return map[lower(app.Id)] || map[lower(app.AppId)] || map[lower(app.AppKey)] || map[lower(app.AppName || app.Name)] || null;
}
function applyInstallState(app, installed) {
  var latest = text(app.AppVersion || app.CurrentVersion);
  if (!installed) {
    app.StoreInstallStatus = "Uninstalled";
    app.StoreInstallStatusText = "未安装";
    app.StoreInstallActionName = "安装";
    app.AppVersionInstall = "";
    app.InstalledVersion = "";
    return app;
  }
  var local = text(first(installed, ["AppVersionInstall", "InstalledVersion", "PackageVersion", "AppVersion"]));
  var compare = latest && local ? compareVersion(latest, local) : 0;
  app.StoreInstallStatus = compare > 0 ? "Outdated" : (compare < 0 ? "Abnormal" : "Installed");
  app.StoreInstallStatusText = compare > 0 ? "可更新" : (compare < 0 ? "版本异常" : "已安装");
  app.StoreInstallActionName = compare > 0 ? "更新" : (compare < 0 ? "异常" : "重新安装");
  app.AppVersionInstall = local;
  app.InstalledVersion = local;
  return app;
}
function publicUrl(path, fallback) {
  var filePath = trim(path);
  if (!filePath) return trim(fallback);
  if (/^https?:\/\//i.test(filePath) || filePath.charAt(0) === "/") return filePath;
  var server = trim(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, "");
  return server ? server + "/" + filePath.replace(/^\/+/, "") : trim(fallback);
}
function collectWhereFilter(fieldNames) {
  var result = [], where = toArray(V8.Param._Where);
  for (var i = 0; i < where.length; i++) {
    var condition = toArray(where[i]);
    if (condition.length < 3) continue;
    var fieldIndex = condition.length >= 4 && /^(AND|OR)$/i.test(text(condition[0])) ? 1 : 0;
    if (fieldNames.indexOf(text(condition[fieldIndex])) < 0) continue;
    var value = condition[fieldIndex + 2];
    appendUnique(result, typeof value === "string" ? values(value) : toArray(value).map(trim));
  }
  return result;
}

var authenticated = hasAuthenticatedUser();
var ownerUserId = currentUserId();
var ownedOnly = lower(V8.Param.Scope) === "owned";
if (ownedOnly && (!authenticated || !ownerUserId)) return { Code: 0, Data: [], Msg: "登录后才能读取自己发布的应用。" };
var pageIndex = Math.max(1, parseInt(V8.Param._PageIndex || V8.Param.PageIndex || 1, 10) || 1);
var pageSize = Math.max(1, Math.min(500, parseInt(V8.Param._PageSize || V8.Param.PageSize || 15, 10) || 15));
var keyword = lower(V8.Param._Keyword || V8.Param.Keyword);
var types = values(V8.Param.ApplicationTypes || V8.Param.ApplicationType);
var categories = values(V8.Param.Categories || V8.Param.Category);
var publishers = values(V8.Param.PublisherTypes || V8.Param.PublisherType);
var visibility = lower(V8.Param.Visibility);
appendUnique(types, collectWhereFilter(["ApplicationType", "AppType"]));
appendUnique(categories, collectWhereFilter(["Category"]));
appendUnique(publishers, collectWhereFilter(["PublisherType"]));

var sourceResult = V8.FormEngine.GetTableData("sys_microistore", {
  _SelectNotFields: ["AppPakcet", "AiAppZipFiles", "AiAppPackageManifest", "SelectData", "SelectAiApp"],
  _OrderBy: "AppUpdateTime",
  _OrderByType: "DESC",
  _PageIndex: 1,
  _PageSize: 5000
});
if (!sourceResult || sourceResult.Code !== 1) return sourceResult || { Code: 0, Data: [], Msg: "应用商城读取失败" };

var map = installedMap(), all = [], categorySet = {}, typeSet = {}, publisherSet = {};
var source = sourceResult.Data || [], publicCount = 0, privateCount = 0;
for (var i = 0; i < source.length; i++) {
  var app = source[i] || {};
  var isPublic = flag(app.IsPublic, true);
  if (!isPublic && !authenticated) continue;
  var runtimeType = trim(app.ApplicationType || app.AppType || "Platform");
  var category = trim(app.Category || (runtimeType === "Platform" ? "platform" : "other"));
  var publisher = trim(app.PublisherType || "租户应用");
  var published = runtimeType === "Platform"
    ? Number(app.IsApprove || 0) === 1
    : trim(app.Status) === "Published" && trim(app.BuildStatus) === "Success";
  var isOwner = trim(app.OwnerUserId || app.UserId) === ownerUserId;
  if (ownedOnly ? !isOwner : !published) continue;
  if (visibility === "public" && !isPublic) continue;
  if (visibility === "private" && isPublic) continue;
  if (!ownedOnly) {
    if (isPublic) publicCount++; else privateCount++;
  }
  categorySet[category] = true; typeSet[runtimeType] = true; publisherSet[publisher] = true;
  if (!contains(types, runtimeType) || !contains(categories, category) || !contains(publishers, publisher)) continue;
  var haystack = lower(text(app.AppName || app.Name) + " " + text(app.AppDetail || app.Description) + " " + runtimeType + " " + category + " " + publisher);
  if (keyword && haystack.indexOf(keyword) < 0) continue;
  app.Name = text(app.AppName || app.Name);
  app.AppName = app.Name;
  app.Description = text(app.AppDetail || app.Description);
  app.AppKey = text(app.AppKey || app.AppId);
  app.ApplicationType = runtimeType;
  app.AppType = runtimeType;
  app.Category = category;
  app.PublisherType = publisher;
  app.IsPublic = isPublic ? 1 : 0;
  app.Visibility = isPublic ? "Public" : "Private";
  app.PreviewUrl = publicUrl(app.PublicPublishPath, app.PreviewUrl);
  app.ViewCount = parseInt(app.ViewCount || 0, 10) || 0;
  app.InstallCount = parseInt(app.InstallCount || 0, 10) || 0;
  applyInstallState(app, findInstalled(map, app));
  all.push(app);
}

var action = text(V8.Param.Action || V8.Param.action);
if (action === "CheckPlatformApps" || action === "CheckOfficialUpdates" || action === "CheckUpdates" || action === "OfficialNotice") {
  var notices = [], installedCount = 0, platformCount = 0;
  for (var n = 0; n < all.length; n++) {
    var item = all[n];
    if (item.ApplicationType !== "Platform") continue;
    platformCount++;
    if (item.StoreInstallStatus !== "Uninstalled") installedCount++;
    if (item.StoreInstallStatus === "Uninstalled") notices.push({
      Status: item.StoreInstallStatus, AppId: item.AppId, StoreId: item.Id, AppName: item.AppName,
      AppVersion: item.AppVersion, InstalledVersion: item.InstalledVersion, AppAuthor: item.AppAuthor,
      AppUpdateTime: item.AppUpdateTime, AppPreview: item.AppPreview, ApplicationType: item.ApplicationType,
      Category: item.Category, Visibility: item.Visibility
    });
  }
  return { Code: 1, Data: {
    Notices: notices, NoticeCount: notices.length, PlatformCount: platformCount,
    OfficialCount: platformCount, InstalledCount: installedCount,
    CheckedAt: typeof DateNow === "function" ? DateNow("yyyy-MM-dd HH:mm:ss") : System.DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
  }};
}

var start = (pageIndex - 1) * pageSize;
return {
  Code: 1,
  Data: all.slice(start, start + pageSize),
  DataCount: all.length,
  Msg: "成功",
  DataAppend: {
    FileServer: trim(V8.SysConfig && V8.SysConfig.FileServer),
    PageIndex: pageIndex,
    PageSize: pageSize,
    Authenticated: authenticated,
    Scope: ownedOnly ? "Owned" : "Published",
    PublicApplicationCount: publicCount,
    PrivateApplicationCount: authenticated ? privateCount : 0,
    Categories: Object.keys(categorySet).sort(),
    ApplicationTypes: Object.keys(typeSet).sort(),
    PublisherTypes: Object.keys(publisherSet).sort()
  }
};
