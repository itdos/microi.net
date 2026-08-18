/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-versions
 * Version: v1.0.0
 * Function:
 * - 返回应用当前版本及平台数据版本快照，供安装时选择稳定历史版本。
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

var result = [{
  VersionId: "",
  AppVersion: versionText(current),
  DataVersion: "CURRENT",
  VersionTime: current.AppUpdateTime || current.UpdateTime || current.CreateTime,
  UserName: current.UserName || current.OwnerName || current.AppAuthor,
  IsCurrent: true,
  Visibility: isPublic ? "Public" : "Private"
}];
var history = V8.FormEngine.GetTableData("mic_data_version", {
  _Where: [["TableRowId", "=", id], ["TableName", "=", "sys_microistore"]],
  _OrderBy: "CreateTime",
  _OrderByType: "DESC",
  _PageIndex: 1,
  _PageSize: 500
});
var rows = history && history.Code === 1 ? (history.Data || []) : [];
for (var i = 0; i < rows.length; i++) {
  var snapshot = parseData(rows[i].Data);
  if (!snapshot || trim(snapshot.Id) !== id || !snapshot.AppPakcet) continue;
  result.push({
    VersionId: rows[i].Id,
    AppVersion: versionText(snapshot) || trim(rows[i].Version),
    DataVersion: rows[i].Version,
    VersionTime: rows[i].CreateTime || rows[i].UpdateTime,
    UserName: rows[i].UserName,
    Remark: rows[i].Remark,
    Action: rows[i].Action,
    IsCurrent: false,
    Visibility: isPublic ? "Public" : "Private"
  });
}
return { Code: 1, Data: result, DataCount: result.length, Msg: "成功" };
