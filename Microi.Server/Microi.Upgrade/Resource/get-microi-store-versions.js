/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：get-microi-store-versions
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-versions
 * Version: v1.1.2
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
function installable(row) {
  return !!(row && trim(row.Id)
    && (trim(row.AppPakcet)
      || (trim(row.PackageHdfsPath)
        && /^[a-f0-9]{64}$/i.test(trim(row.PackageSha256))
        && Number(row.PackageSize || 0) > 0)));
}

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
    Installable: installable(snapshot) && trim(snapshot.Id) === id,
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
