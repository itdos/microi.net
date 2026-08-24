/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-model
 * Version: v1.2.6
 * Function:
 * - 按公开/私有权限读取当前或历史应用包；后台安装按期望应用版本解析并固定不可变数据版本快照；详情模式返回租户范围内的更新日志但不返回大型数据包。
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
function versionText(row) {
  return trim(row && (row.AppVersion || row.Version || row.PackageVersion));
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
function readChangeLogs(storeId) {
  try {
    var result = V8.FormEngine.GetTableData("sys_microistore_changelog", {
      _Where: [["OsClient", "=", V8.OsClient], ["AND", "StoreId", "=", storeId]],
      _SelectFields: ["Id", "OsClient", "StoreId", "Version", "Title", "ChangeType", "Content", "ReleaseTime", "Sort"],
      _OrderBy: "ReleaseTime",
      _OrderByType: "DESC",
      _PageIndex: 1,
      _PageSize: 100
    });
    if (!result || result.Code !== 1) {
      return { Available: false, Rows: [], Count: 0 };
    }
    return {
      Available: true,
      Rows: result.Data || [],
      Count: result.DataCount === null || result.DataCount === undefined
        ? (result.Data || []).length
        : result.DataCount
    };
  } catch (error) {
    // 兼容尚未安装应用商城更新日志资源的历史来源。
    return { Available: false, Rows: [], Count: 0 };
  }
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
var pinCurrentVersion = flag(V8.Param.PinCurrentVersion, false);
var expectedAppVersion = trim(V8.Param.ExpectedAppVersion || V8.Param.AppVersion);
if (!versionId && pinCurrentVersion) {
  // MARKETPLACE_PINNED_INSTALL_SNAPSHOT_V1
  // 后台任务只持久化商城记录 Id、期望应用版本与历史快照 Id，不复制大型包体。
  // 发布流程会为当前包写入 mic_data_version；若发布事务尚未产出对应快照，返回
  // 可重试错误，绝不能退回易变的 sys_microistore 当前行继续分片安装。
  var targetAppVersion = expectedAppVersion || versionText(current);
  if (!targetAppVersion) {
    return {
      Code: 0,
      Data: { ErrorType: "MARKETPLACE_VERSION_SNAPSHOT_MISSING", StoreId: id },
      Msg: "应用当前版本为空，无法建立后台安装快照。"
    };
  }
  var historyResult = V8.FormEngine.GetTableData("mic_data_version", {
    _Where: [["TableRowId", "=", id], ["AND", "TableName", "=", "sys_microistore"]],
    _SelectFields: ["Id", "Version", "CreateTime", "UpdateTime", "Data"],
    _OrderBy: "CreateTime",
    _OrderByType: "DESC",
    _PageIndex: 1,
    _PageSize: 8
  });
  if (!historyResult || historyResult.Code !== 1) {
    return historyResult || {
      Code: 0,
      Data: { ErrorType: "MARKETPLACE_VERSION_SNAPSHOT_READ_FAILED", StoreId: id, AppVersion: targetAppVersion },
      Msg: "读取应用版本快照失败。"
    };
  }
  var historyRows = historyResult.Data || [];
  for (var historyIndex = 0; historyIndex < historyRows.length; historyIndex++) {
    var snapshot = parseData(historyRows[historyIndex] && historyRows[historyIndex].Data);
    if (!snapshot
      || trim(snapshot.Id) !== id
      || versionText(snapshot) !== targetAppVersion
      || !snapshot.AppPakcet) continue;
    versionId = trim(historyRows[historyIndex].Id);
    selected = snapshot;
    selected.StoreVersionId = versionId;
    selected.DataVersion = historyRows[historyIndex].Version;
    selected.DataVersionTime = historyRows[historyIndex].CreateTime || historyRows[historyIndex].UpdateTime;
    selected.IsHistoricalVersion = true;
    selected.IsPinnedInstallSnapshot = true;
    break;
  }
  if (!versionId) {
    return {
      Code: 0,
      Data: {
        ErrorType: "MARKETPLACE_VERSION_SNAPSHOT_PENDING",
        StoreId: id,
        AppVersion: targetAppVersion
      },
      Msg: "应用版本【" + targetAppVersion + "】的不可变安装快照尚未就绪，请稍后重试。"
    };
  }
}
if (versionId) {
  if (!selected.IsPinnedInstallSnapshot) {
    var versionResult = V8.FormEngine.GetFormData("mic_data_version", {
      Id: versionId,
      _Where: [["TableRowId", "=", id], ["TableName", "=", "sys_microistore"]]
    });
    if (!versionResult || versionResult.Code !== 1 || !versionResult.Data) return { Code: 2, Msg: "指定的应用历史版本不存在。" };
    selected = parseData(versionResult.Data.Data);
    if (!selected || trim(selected.Id) !== id || !selected.AppPakcet) return { Code: 0, Msg: "应用历史版本数据无效或不包含完整安装包。" };
    selected.StoreVersionId = versionId;
    selected.DataVersion = versionResult.Data.Version;
    selected.DataVersionTime = versionResult.Data.CreateTime || versionResult.Data.UpdateTime;
    selected.IsHistoricalVersion = true;
  }
  if (expectedAppVersion && versionText(selected) !== expectedAppVersion) {
    return {
      Code: 0,
      Data: {
        ErrorType: "MARKETPLACE_VERSION_SNAPSHOT_MISMATCH",
        StoreId: id,
        StoreVersionId: versionId,
        ExpectedAppVersion: expectedAppVersion,
        ActualAppVersion: versionText(selected)
      },
      Msg: "应用版本快照与期望版本不一致，已停止安装。"
    };
  }
}
selected.IsPublic = isPublic ? 1 : 0;
selected.Visibility = isPublic ? "Public" : "Private";
if (!flag(V8.Param.IncludePackage, true)) selected = stripPackage(selected);
var changeLogs = readChangeLogs(id);
return {
  Code: 1,
  Data: selected,
  DataAppend: {
    ChangeLogAvailable: changeLogs.Available,
    ChangeLogCount: changeLogs.Count,
    ChangeLogs: changeLogs.Rows
  },
  Msg: "成功"
};
