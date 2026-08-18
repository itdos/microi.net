/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-model
 * Version: v1.2.2
 * Function:
 * - 按公开/私有权限读取当前或历史应用包；详情模式不返回大型数据包。
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
function stripPackage(row) {
  if (!row) return row;
  // MARKETPLACE_PLAIN_OBJECT_STRIP_V1
  // FormEngine 返回的行在 Jint 中可能是 CLR/JObject 代理，直接 delete 会触发
  // "The method or operation is not implemented"。先序列化为纯 JS 对象，
  // 再裁剪详情页不需要的大字段。
  var plain = parseData(JSON.stringify(row));
  if (!plain) return row;
  delete plain.AppPakcet;
  delete plain.AiAppZipFiles;
  delete plain.AiAppPackageManifest;
  delete plain.SelectData;
  delete plain.SelectAiApp;
  delete plain.PrivateSourcePath;
  return plain;
}

var id = trim(V8.Param.Id || V8.Param.StoreId);
if (!id) return { Code: 0, Msg: "应用商城记录 Id 不能为空。" };
var currentResult = V8.FormEngine.GetFormData("sys_microistore", { Id: id, OsClient: V8.OsClient });
if (!currentResult || currentResult.Code !== 1 || !currentResult.Data) return currentResult || { Code: 2, Msg: "应用不存在。" };
var current = currentResult.Data;
var isPublic = flag(current.IsPublic, true);
if (!isPublic && !authenticated()) return { Code: 2, Msg: "应用不存在或当前商城源尚未登录。" };

var selected = current;
var versionId = trim(V8.Param.VersionId || V8.Param.StoreVersionId);
if (versionId) {
  var versionResult = V8.FormEngine.GetFormData("mic_data_version", {
    Id: versionId,
    _Where: [["TableRowId", "=", id], ["TableName", "=", "sys_microistore"]]
  });
  if (!versionResult || versionResult.Code !== 1 || !versionResult.Data) return { Code: 2, Msg: "指定的应用历史版本不存在。" };
  selected = parseData(versionResult.Data.Data);
  if (!selected || trim(selected.Id) !== id) return { Code: 0, Msg: "应用历史版本数据无效。" };
  selected.StoreVersionId = versionId;
  selected.DataVersion = versionResult.Data.Version;
  selected.DataVersionTime = versionResult.Data.CreateTime || versionResult.Data.UpdateTime;
  selected.IsHistoricalVersion = true;
}
selected.IsPublic = isPublic ? 1 : 0;
selected.Visibility = isPublic ? "Public" : "Private";
if (!flag(V8.Param.IncludePackage, true)) selected = stripPackage(selected);
return { Code: 1, Data: selected, Msg: "成功" };
