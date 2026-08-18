/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-versions
 * Version: v1.1.0
 * Function:
 * - 当前版本固定返回在 DataAppend，历史版本由服务端分页与搜索。
 * - 单次只解析当前页快照，避免应用详情一次加载全部历史包。
 */

function text(value) { return value === null || value === undefined ? "" : String(value); }
function trim(value) { return text(value).replace(/^\s+|\s+$/g, ""); }
function flag(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var normalized = trim(value).toLowerCase();
  return value === true || value === 1 || ["1", "true", "yes", "on", "enabled"].indexOf(normalized) >= 0;
}
function authenticated() {
  if (V8.CurrentUser && V8.CurrentUser.Id) return true;
  try {
    var token = V8.Method && V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    return !!(token && token.CurrentUser && token.CurrentUser.Id);
  } catch (error) { return false; }
}
function parseData(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch (error) { return null; }
}
function versionText(row) { return trim(row && (row.AppVersion || row.Version || row.PackageVersion)); }

var id = trim(V8.Param.Id || V8.Param.StoreId);
if (!id) return { Code: 0, Msg: "应用商城记录 Id 不能为空。" };
var currentResult = V8.FormEngine.GetFormData("sys_microistore", {
  Id: id,
  _SelectNotFields: ["AppPakcet", "AiAppZipFiles", "AiAppPackageManifest", "SelectData", "SelectAiApp"]
});
if (!currentResult || currentResult.Code !== 1 || !currentResult.Data) return { Code: 2, Msg: "应用不存在。" };
var current = currentResult.Data;
var isPublic = flag(current.IsPublic, true);
if (!isPublic && !authenticated()) return { Code: 2, Msg: "应用不存在或当前商城源尚未登录。" };

var pageIndex = Math.max(1, Math.min(100000, parseInt(V8.Param._PageIndex || 1, 10) || 1));
var pageSize = Math.max(5, Math.min(20, parseInt(V8.Param._PageSize || 8, 10) || 8));
var keyword = trim(V8.Param._Keyword || V8.Param.Keyword);
var normalizedKeyword = keyword.toLowerCase();
var currentVersion = {
  VersionId: "",
  AppVersion: versionText(current),
  DataVersion: "CURRENT",
  VersionTime: current.AppUpdateTime || current.UpdateTime || current.CreateTime,
  UserName: current.UserName || current.OwnerName || current.AppAuthor,
  IsCurrent: true,
  Visibility: isPublic ? "Public" : "Private"
};
var currentSearchText = [currentVersion.AppVersion, currentVersion.DataVersion, currentVersion.VersionTime, currentVersion.UserName].join(" ").toLowerCase();
var currentMatches = !normalizedKeyword || currentSearchText.indexOf(normalizedKeyword) >= 0;
var where = [["TableRowId", "=", id], ["AND", "TableName", "=", "sys_microistore"]];
if (keyword) {
  where.push(["AND", "(", "Version", "Like", keyword]);
  where.push(["OR", "Remark", "Like", keyword]);
  where.push(["OR", "UserName", "Like", keyword]);
  where.push(["OR", "Action", "Like", keyword, ")"]);
}
var history = V8.FormEngine.GetTableData("mic_data_version", {
  _Where: where,
  _SelectFields: ["Id", "Version", "CreateTime", "UpdateTime", "UserName", "Remark", "Action", "Data"],
  _OrderBy: "CreateTime",
  _OrderByType: "DESC",
  _PageIndex: pageIndex,
  _PageSize: pageSize
});
if (!history || history.Code !== 1) return history || { Code: 0, Msg: "应用历史版本读取失败。" };
var result = [];
var rows = history && history.Code === 1 ? (history.Data || []) : [];
for (var i = 0; i < rows.length; i++) {
  var snapshot = parseData(rows[i].Data);
  result.push({
    VersionId: rows[i].Id,
    AppVersion: versionText(snapshot) || trim(rows[i].Version) || "未标注版本",
    DataVersion: rows[i].Version,
    VersionTime: rows[i].CreateTime || rows[i].UpdateTime,
    UserName: rows[i].UserName,
    Remark: rows[i].Remark,
    Action: rows[i].Action,
    IsCurrent: false,
    Installable: !!(snapshot && trim(snapshot.Id) === id && snapshot.AppPakcet),
    Visibility: isPublic ? "Public" : "Private"
  });
}
return {
  Code: 1,
  Data: result,
  DataCount: Number(history.DataCount || 0),
  DataAppend: {
    PaginationVersion: 1,
    PageIndex: pageIndex,
    PageSize: pageSize,
    Keyword: keyword,
    CurrentVersion: currentVersion,
    CurrentMatches: currentMatches
  },
  Msg: "成功"
};
