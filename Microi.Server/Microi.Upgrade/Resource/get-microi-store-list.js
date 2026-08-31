/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：get-microi-store
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store
 * Version: v1.4.7
 * Function:
 * - 读取统一应用商城列表并计算租户安装状态；批量平台安装时优先返回应用商城自举包。
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
function normalizedRecordTime(value) {
  var source = trim(value), dotNet = source.match(/^\/Date\((\d+)/), calendar, milliseconds, timestamp;
  if (!source) return "";
  if (dotNet) return ("00000000000000000" + dotNet[1]).slice(-17);
  calendar = source.match(/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})(?:[T\s](\d{1,2}):?(\d{1,2})?:?(\d{1,2})?(?:\.(\d{1,3}))?)?/);
  if (!calendar) return source.replace(/[^0-9]/g, "").substring(0, 17);
  milliseconds = ((calendar[7] || "") + "000").substring(0, 3);
  timestamp = Date.UTC(
    Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3]),
    Number(calendar[4] || 0), Number(calendar[5] || 0), Number(calendar[6] || 0),
    Number(milliseconds || 0)
  );
  return ("00000000000000000" + timestamp).slice(-17);
}
function installedRecordTime(row) {
  var fields = ["UpdateTime", "InstallTime", "LastCheckTime", "CreateTime"];
  for (var i = 0; row && i < fields.length; i++) {
    var candidate = normalizedRecordTime(row[fields[i]]);
    if (candidate) return candidate;
  }
  return "";
}
function isDeletedInstallRecord(row) {
  var value = lower(first(row, ["IsDeleted"]));
  return value === "1" || value === "true" || value === "yes";
}
function addMap(map, prefix, key, row) {
  key = lower(key);
  if (!key || isDeletedInstallRecord(row)) return;
  var mapKey = prefix + ":" + key, existing = map[mapKey];
  if (!existing || installedRecordTime(row) > installedRecordTime(existing)) map[mapKey] = row;
}
function installedMap(apps) {
  var external = V8.Param.InstalledVersions || V8.Param.InstalledApps;
  var rows = external ? toArray(external) : [];
  if (!external) {
    var storeIds = [], appIds = [];
    for (var appIndex = 0; appIndex < apps.length; appIndex++) {
      var app = apps[appIndex] || {};
      if (trim(app.Id)) storeIds.push(trim(app.Id));
      if (trim(app.AppId || app.AppKey)) appIds.push(trim(app.AppId || app.AppKey));
    }
    if (!storeIds.length && !appIds.length) return {};
    try {
      var installedWhere = [];
      if (storeIds.length && appIds.length) {
        installedWhere.push(["AND", "(", "StoreId", "In", storeIds]);
        installedWhere.push(["OR", "AppId", "In", appIds, ")"]);
      } else if (storeIds.length) installedWhere.push(["StoreId", "In", storeIds]);
      else installedWhere.push(["AppId", "In", appIds]);
      var result = V8.FormEngine.GetTableData("sys_microistoreversion", {
        _Where: installedWhere,
        _SelectFields: ["Id", "StoreId", "AppId", "AppName", "AppVersion", "AppVersionInstall", "PackageVersion", "InstallStatus", "IsDeleted", "InstallTime", "UpdateTime", "LastCheckTime", "CreateTime"],
        _PageIndex: 1,
        _PageSize: Math.max(15, Math.min(1000, (storeIds.length + appIds.length) * 3)),
        _OrderBy: "UpdateTime",
        _OrderByType: "DESC"
      });
      rows = result && result.Code === 1 ? toArray(result.Data) : [];
    } catch (error) { rows = []; }
  }
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    addMap(map, "storeid", row.StoreId, row);
    addMap(map, "appid", row.AppId, row);
    addMap(map, "appname", row.AppName, row);
    addMap(map, "legacyid", row.Id, row);
  }
  return map;
}
function findInstalled(map, app) {
  return map["storeid:" + lower(app.Id)]
    || map["appid:" + lower(app.AppId)]
    || map["appid:" + lower(app.AppKey)]
    || map["appname:" + lower(app.AppName || app.Name)]
    || map["legacyid:" + lower(app.Id)]
    || null;
}
function applyInstallState(app, installed) {
  var latest = text(app.AppVersion || app.CurrentVersion);
  var local = installed ? text(first(installed, ["AppVersionInstall", "InstalledVersion", "PackageVersion", "AppVersion"])) : "";
  var compare = latest && local ? compareVersion(latest, local) : 0;
  var rawStatus = installed ? lower(first(installed, ["InstallStatus", "Status"])) : "";
  var failedOrMissing = ["uninstalled", "未安装", "failed", "failure", "失败", "error"].indexOf(rawStatus) >= 0;
  var successfulOrCompatible = !rawStatus
    || ["installed", "success", "succeeded", "已安装", "outdated", "可更新", "更新"].indexOf(rawStatus) >= 0;
  if (installed && !isDeletedInstallRecord(installed) && local && compare < 0) {
    app.StoreInstallStatus = "Abnormal";
    app.StoreInstallStatusText = "版本异常";
    app.StoreInstallActionName = "异常";
    app.AppVersionInstall = local;
    app.InstalledVersion = local;
    return app;
  }
  if (!installed || isDeletedInstallRecord(installed) || !local || failedOrMissing
      || (!successfulOrCompatible && compare >= 0)) {
    app.StoreInstallStatus = "Uninstalled";
    app.StoreInstallStatusText = "未安装";
    app.StoreInstallActionName = "安装";
    app.AppVersionInstall = local;
    app.InstalledVersion = local;
    return app;
  }
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

function appendPublishedWhere(where) {
  // SQL AND has higher precedence than OR, so this single bounded group means:
  // (Platform AND approved) OR (non-Platform AND published AND built).
  where.push(["AND", "(", "ApplicationType", "=", "Platform"]);
  where.push(["AND", "IsApprove", "=", 1]);
  where.push(["OR", "ApplicationType", "<>", "Platform"]);
  where.push(["AND", "Status", "=", "Published"]);
  where.push(["AND", "BuildStatus", "=", "Success", ")"]);
}
function appendPublicWhere(where, expectedPublic) {
  if (expectedPublic === false) {
    where.push(["AND", "IsPublic", "=", 0]);
    return;
  }
  where.push(["AND", "(", "IsPublic", "=", 1]);
  where.push(["OR", "IsPublic", "=", null, ")"]);
}
function appendKeywordWhere(where, keyword) {
  if (!keyword) return;
  where.push(["AND", "(", "AppName", "Like", keyword]);
  where.push(["OR", "AppKey", "Like", keyword]);
  where.push(["OR", "AppId", "Like", keyword]);
  where.push(["OR", "AppDetail", "Like", keyword, ")"]);
}
function readCatalogFacets(authenticated, ownedOnly, ownerUserId) {
  var cacheKey = "Microi:" + V8.OsClient + ":StoreCatalogFacets:" + (authenticated ? "auth" : "anon");
  if (!ownedOnly) {
    var cached = V8.Cache.Get(cacheKey);
    if (cached) {
      try { return JSON.parse(String(cached)); } catch (ignoreCache) { }
    }
  }
  var facetWhere = [];
  if (ownedOnly) {
    facetWhere.push(["AND", "(", "OwnerUserId", "=", ownerUserId]);
    facetWhere.push(["OR", "UserId", "=", ownerUserId, ")"]);
  } else {
    appendPublishedWhere(facetWhere);
    if (!authenticated) appendPublicWhere(facetWhere, true);
  }
  var categorySet = {}, typeSet = {}, publisherSet = {};
  var publicCount = 0, privateCount = 0, pageIndex = 1, dataCount = 0;
  while (pageIndex <= 10) {
    var facetResult = V8.FormEngine.GetTableData("sys_microistore", {
      _Where: facetWhere,
      _SelectFields: ["ApplicationType", "AppType", "Category", "PublisherType", "IsPublic"],
      _OrderBy: "Id",
      _OrderByType: "ASC",
      _PageIndex: pageIndex,
      _PageSize: 1000
    });
    if (!facetResult || facetResult.Code !== 1) break;
    var facetRows = facetResult.Data || [];
    dataCount = Number(facetResult.DataCount || facetRows.length);
    for (var facetIndex = 0; facetIndex < facetRows.length; facetIndex++) {
      var row = facetRows[facetIndex] || {};
      var runtimeType = trim(row.ApplicationType || row.AppType || "Platform");
      var category = trim(row.Category || (runtimeType === "Platform" ? "platform" : "other"));
      var publisher = trim(row.PublisherType || "租户应用");
      var isPublic = flag(row.IsPublic, true);
      categorySet[category] = true;
      typeSet[runtimeType] = true;
      publisherSet[publisher] = true;
      if (isPublic) publicCount++; else privateCount++;
    }
    if (facetRows.length < 1000 || pageIndex * 1000 >= dataCount) break;
    pageIndex++;
  }
  var facets = {
    PublicApplicationCount: publicCount,
    PrivateApplicationCount: authenticated ? privateCount : 0,
    Categories: Object.keys(categorySet).sort(),
    ApplicationTypes: Object.keys(typeSet).sort(),
    PublisherTypes: Object.keys(publisherSet).sort(),
    IsTruncated: dataCount > 10000
  };
  if (!ownedOnly) V8.Cache.Set(cacheKey, JSON.stringify(facets), 300);
  return facets;
}

var authenticated = hasAuthenticatedUser();
var ownerUserId = currentUserId();
var scope = lower(V8.Param.Scope);
var ownedOnly = scope === "owned";
var installedOnly = scope === "installed";
if (ownedOnly && (!authenticated || !ownerUserId)) return { Code: 0, Data: [], Msg: "登录后才能读取自己发布的应用。" };
var pageIndex = Math.max(1, parseInt(V8.Param._PageIndex || V8.Param.PageIndex || 1, 10) || 1);
var pageSize = Math.max(1, Math.min(500, parseInt(V8.Param._PageSize || V8.Param.PageSize || 15, 10) || 15));
var keyword = lower(V8.Param._Keyword || V8.Param.Keyword);
var types = values(V8.Param.ApplicationTypes || V8.Param.ApplicationType);
var categories = values(V8.Param.Categories || V8.Param.Category);
var publishers = values(V8.Param.PublisherTypes || V8.Param.PublisherType);
var visibility = lower(V8.Param.Visibility);
var action = text(V8.Param.Action || V8.Param.action);
appendUnique(types, collectWhereFilter(["ApplicationType", "AppType"]));
appendUnique(categories, collectWhereFilter(["Category"]));
appendUnique(publishers, collectWhereFilter(["PublisherType"]));
var checkPlatformApps = action === "CheckPlatformApps" || action === "CheckOfficialUpdates" || action === "CheckUpdates" || action === "OfficialNotice";
var platformOnly = types.length === 1 && lower(types[0]) === "platform";
var externalInstalledVersions = V8.Param.InstalledVersions || V8.Param.InstalledApps;
var bulkInstallPlan = flag(V8.Param.BulkInstallPlan, false) || (!!externalInstalledVersions && platformOnly);
var queryWhere = [];
if (ownedOnly) {
  queryWhere.push(["AND", "(", "OwnerUserId", "=", ownerUserId]);
  queryWhere.push(["OR", "UserId", "=", ownerUserId, ")"]);
} else {
  appendPublishedWhere(queryWhere);
  if (!authenticated) appendPublicWhere(queryWhere, true);
}
if (visibility === "public") appendPublicWhere(queryWhere, true);
if (visibility === "private") appendPublicWhere(queryWhere, false);
if (checkPlatformApps) queryWhere.push(["AND", "ApplicationType", "=", "Platform"]);
else if (types.length) queryWhere.push(["AND", "ApplicationType", "In", types]);
if (categories.length) queryWhere.push(["AND", "Category", "In", categories]);
if (publishers.length) queryWhere.push(["AND", "PublisherType", "In", publishers]);
appendKeywordWhere(queryWhere, keyword);

// “已安装”视图必须仍由商城源做服务端分页。旧前端为了筛选安装状态会
// 拉取最多 10000 个完整应用再在浏览器切片，既放大接口耗时，也产生无谓流量。
// 这里只接收当前租户已安装记录的最小投影，并把商城 Id/AppId 条件下推到数据库。
if (installedOnly) {
  var installedRows = toArray(externalInstalledVersions);
  var installedStoreIds = [], installedAppIds = [];
  for (var installedIndex = 0; installedIndex < installedRows.length; installedIndex++) {
    var installedRow = installedRows[installedIndex] || {};
    var installedStoreId = trim(installedRow.StoreId);
    var installedAppId = trim(installedRow.AppId || installedRow.AppKey);
    if (installedStoreId && installedStoreIds.indexOf(installedStoreId) < 0) installedStoreIds.push(installedStoreId);
    if (installedAppId && installedAppIds.indexOf(installedAppId) < 0) installedAppIds.push(installedAppId);
  }
  if (!installedStoreIds.length && !installedAppIds.length) {
    return {
      Code: 1,
      Data: [],
      DataCount: 0,
      Msg: "成功",
      DataAppend: { PageIndex: pageIndex, PageSize: pageSize, Scope: "Installed" }
    };
  }
  if (installedStoreIds.length && installedAppIds.length) {
    queryWhere.push(["AND", "(", "Id", "In", installedStoreIds]);
    queryWhere.push(["OR", "AppId", "In", installedAppIds]);
    queryWhere.push(["OR", "AppKey", "In", installedAppIds, ")"]);
  } else if (installedStoreIds.length) {
    queryWhere.push(["AND", "Id", "In", installedStoreIds]);
  } else {
    queryWhere.push(["AND", "(", "AppId", "In", installedAppIds]);
    queryWhere.push(["OR", "AppKey", "In", installedAppIds, ")"]);
  }
}

var queryPageIndex = checkPlatformApps || bulkInstallPlan ? 1 : pageIndex;
var queryPageSize = checkPlatformApps || bulkInstallPlan ? 500 : pageSize;
var sourceResult = V8.FormEngine.GetTableData("sys_microistore", {
  _Where: queryWhere,
  _SelectFields: [
    "Id", "AppId", "AppKey", "AppName", "AppVersion", "CurrentVersion", "AppAuthor",
    "AppUpdateTime", "AppPreview", "AppDetail", "ApplicationType", "AppType", "Category",
    "PublisherType", "IsPublic", "IsApprove", "Status", "BuildStatus", "OwnerUserId", "UserId",
    "PublicPublishPath", "PreviewUrl", "ViewCount", "InstallCount"
  ],
  _OrderBy: "AppUpdateTime",
  _OrderByType: "DESC",
  _PageIndex: queryPageIndex,
  _PageSize: queryPageSize
});
if (!sourceResult || sourceResult.Code !== 1) return sourceResult || { Code: 0, Data: [], Msg: "应用商城读取失败" };

var source = sourceResult.Data || [];
var map = installedMap(source), all = [];
for (var i = 0; i < source.length; i++) {
  var app = source[i] || {};
  var isPublic = flag(app.IsPublic, true);
  var runtimeType = trim(app.ApplicationType || app.AppType || "Platform");
  var category = trim(app.Category || (runtimeType === "Platform" ? "platform" : "other"));
  var publisher = trim(app.PublisherType || "租户应用");
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

if (checkPlatformApps) {
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

// BULK_PLATFORM_BOOTSTRAP_ORDER_V1：旧租户先安装/更新应用商城自身，才能让
// 后续 SaaS、表单等长包使用最新版导入器。批量协调器会显式传 BulkInstallPlan；
// 兼容旧协调器时，以外部 InstalledVersions + 仅筛选 Platform 识别批量盘点。
if (bulkInstallPlan) {
  all.sort(function (left, right) {
    var leftBootstrap = lower(left && (left.AppId || left.AppKey)) === "app.microi.store" ? 0 : 1;
    var rightBootstrap = lower(right && (right.AppId || right.AppKey)) === "app.microi.store" ? 0 : 1;
    return leftBootstrap - rightBootstrap;
  });
}

var facets = readCatalogFacets(authenticated, ownedOnly, ownerUserId);
var start = checkPlatformApps || bulkInstallPlan ? (pageIndex - 1) * pageSize : 0;
return {
  Code: 1,
  Data: all.slice(start, start + pageSize),
  DataCount: Number(sourceResult.DataCount || all.length),
  Msg: "成功",
  DataAppend: {
    FileServer: trim(V8.SysConfig && V8.SysConfig.FileServer),
    PageIndex: pageIndex,
    PageSize: pageSize,
    Authenticated: authenticated,
    Scope: ownedOnly ? "Owned" : (installedOnly ? "Installed" : "Published"),
    PublicApplicationCount: facets.PublicApplicationCount,
    PrivateApplicationCount: facets.PrivateApplicationCount,
    Categories: facets.Categories,
    ApplicationTypes: facets.ApplicationTypes,
    PublisherTypes: facets.PublisherTypes,
    FacetsTruncated: facets.IsTruncated
  }
};
