/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：get-microi-store-model
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: get-microi-store-model
 * Version: v1.3.0
 * Function:
 * - 按公开/私有权限读取不可变应用包，并为私有源码/编译 ZIP 生成不落库的临时下载地址。
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
function hasInstallPackage(row) {
  return !!(row && (trim(row.AppPakcet)
    || (trim(row.PackageHdfsPath)
      && /^[a-f0-9]{64}$/i.test(trim(row.PackageSha256))
      && Number(row.PackageSize || 0) > 0)));
}
function packageDownloadUrl(row, isPublic) {
  var path = trim(row && row.PackageHdfsPath);
  if (!path) return '';
  if (isPublic) {
    var fileServer = trim(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, '');
    if (!fileServer) throw new Error('商城源未配置 FileServer，无法下载公有应用包。');
    return fileServer + '/' + path.replace(/^\/+/, '');
  }
  var urlResult = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient,
    FilePathName: path,
    Limit: true
  });
  if (!urlResult || urlResult.Code !== 1) {
    throw new Error('生成私有应用包临时下载地址失败：' + ((urlResult && urlResult.Msg) || path));
  }
  var data = urlResult.Data || {};
  return typeof data === 'string'
    ? trim(data)
    : trim(data.Url || data.url || data.FileUrl || data.FullPath || data.Path);
}
function acceptsHdfsPointer() {
  return trim(V8.Param.PackagePointerMode).toLowerCase() === 'hdfsv1'
    || flag(V8.Param.AcceptHdfsPackagePointer, false);
}
function loadPackageBodyFromPointer(row, downloadUrl) {
  // MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1：v2.2.x 及更早导入器只识别
  // AppPakcet。为避免“更新器无法更新自己”的引导死锁，商城源仅在该次旧协议
  // 响应中下载并回填正文；sys_microistore 与 mic_data_version 仍只保存 HDFS 指针。
  var expectedSha = trim(row && row.PackageSha256).toLowerCase();
  var expectedSize = Number(row && row.PackageSize || 0);
  if (!/^https?:\/\//i.test(downloadUrl)
    || !/^[a-f0-9]{64}$/.test(expectedSha)
    || expectedSize < 1
    || expectedSize > 256 * 1024 * 1024) {
    throw new Error('旧版安装兼容桥缺少安全下载地址、SHA-256 或合法字节数。');
  }
  var response = V8.Http.GetResponse({
    Url: downloadUrl,
    GetParam: {},
    Timeout: 600,
    Headers: { Accept: 'application/json' }
  });
  var statusCode = Number(response && response.StatusCode || 0);
  if (!response || statusCode < 200 || statusCode >= 300) {
    throw new Error('旧版安装兼容桥下载应用包失败（HTTP ' + statusCode + '）。');
  }
  var content = response.Content;
  if ((!content || !String(content).length) && response.RawBytes && response.RawBytes.Length > 0) {
    content = System.Text.Encoding.UTF8.GetString(response.RawBytes);
  }
  content = String(content || '');
  var actualSize = Number(System.Text.Encoding.UTF8.GetByteCount(content));
  var actualSha = trim(V8.EncryptHelper.Sha256Hex(content)).toLowerCase();
  if (actualSize !== expectedSize || actualSha !== expectedSha) {
    throw new Error('旧版安装兼容桥下载校验失败：size=' + actualSize + '/' + expectedSize
      + '，sha256=' + actualSha + '/' + expectedSha);
  }
  return content;
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
  if (trim(plain.PackageStorageMode).toLowerCase() === 'hdfsprivate') delete plain.PackageHdfsPath;
  return plain;
}
function packageAssetList(row) {
  var manifest = parseData(row && row.AiAppPackageManifest);
  if (!manifest) return [];
  if (manifest.length !== undefined && typeof manifest !== 'string') {
    var list = [];
    for (var index = 0; index < manifest.length; index++) list.push(manifest[index]);
    return list;
  }
  return [manifest];
}
function privatePackageAsset(asset) {
  asset = asset || {};
  var scope = trim(asset.StorageScope || asset.StorageMode || asset.Scope).toLowerCase();
  return flag(asset.Limit, false) || scope.indexOf('private') >= 0;
}
function normalizedAssetPath(value) {
  var raw = trim(value);
  if (!raw || /^https?:\/\//i.test(raw) || /[?#]/.test(raw) || /[\x00-\x1f\x7f]/.test(raw)) return '';
  var path = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  var segments = path.split('/');
  for (var index = 0; index < segments.length; index++) {
    if (!segments[index] || segments[index] === '.' || segments[index] === '..') return '';
  }
  return path;
}
function packageAssetBelongsToApplication(path, row, manifest) {
  var normalized = normalizedAssetPath(path);
  if (!normalized) return false;
  var rowAppKey = trim(row && (row.AppKey || row.AppId)).toLowerCase();
  var manifestAppKey = trim(manifest && (manifest.AppKey || manifest.AppId)).toLowerCase();
  if (rowAppKey && manifestAppKey && rowAppKey !== manifestAppKey) return false;
  var identities = {};
  var addIdentity = function (value) {
    var key = trim(value).toLowerCase();
    if (key) identities[key] = true;
  };
  addIdentity(row && row.Id);
  addIdentity(row && row.AppId);
  addIdentity(row && row.AppKey);
  var segments = normalized.toLowerCase().split('/');
  var marker = -1;
  for (var index = 0; index < segments.length; index++) {
    if (segments[index] === 'ai-app-packages') marker = index;
  }
  if (marker < 0) return false;
  var identityIndex = marker + 1;
  if (segments[identityIndex] === 'v3') identityIndex++;
  return !!identities[segments[identityIndex] || ''];
}
function privateApplicationAssetDownloadUrls(row) {
  var urls = {};
  var manifests = packageAssetList(row);
  for (var manifestIndex = 0; manifestIndex < manifests.length; manifestIndex++) {
    var manifest = manifests[manifestIndex] || {};
    var assets = [manifest.SourceZip, manifest.BuildZip];
    for (var assetIndex = 0; assetIndex < assets.length; assetIndex++) {
      var asset = assets[assetIndex] || null;
      if (!asset || !privatePackageAsset(asset)) continue;
      var rawPath = trim(asset.FilePathName || asset.HdfsPath || asset.FilePath || asset.Path);
      var normalized = normalizedAssetPath(rawPath);
      if (!normalized || !packageAssetBelongsToApplication(rawPath, row, manifest)) {
        throw new Error('私有 ZIP 路径不属于当前应用，已拒绝签名。');
      }
      var result = V8.Method.GetPrivateFileUrl({
        OsClient: V8.OsClient,
        FilePathName: rawPath,
        Limit: true
      });
      if (!result || result.Code !== 1) {
        throw new Error('生成私有 ZIP 临时下载地址失败：' + ((result && result.Msg) || rawPath));
      }
      var data = result.Data || {};
      var url = typeof data === 'string'
        ? trim(data)
        : trim(data.Url || data.url || data.FileUrl || data.FullPath || data.Path);
      if (!/^https?:\/\//i.test(url)) throw new Error('私有 ZIP 临时下载地址无效。');
      urls[rawPath] = url;
      urls[normalized] = url;
      urls['/' + normalized] = url;
    }
  }
  return urls;
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
      || !hasInstallPackage(snapshot)) continue;
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
    if (!selected || trim(selected.Id) !== id || !hasInstallPackage(selected)) return { Code: 0, Msg: "应用历史版本数据无效或不包含可校验安装包。" };
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
var applicationAssetDownloadUrls;
try {
  // 签名仅存在于本次响应，不改写 sys_microistore 或 mic_data_version。
  applicationAssetDownloadUrls = privateApplicationAssetDownloadUrls(selected);
} catch (assetUrlError) {
  return { Code: 0, Msg: assetUrlError.message };
}
selected.IsPublic = isPublic ? 1 : 0;
selected.Visibility = isPublic ? "Public" : "Private";
if (!flag(V8.Param.IncludePackage, true)) {
  selected = stripPackage(selected);
} else if (!trim(selected.AppPakcet)) {
  if (!hasInstallPackage(selected)) return { Code: 0, Msg: '应用包指针缺少 HDFS 路径、SHA-256 或字节数。' };
  try {
    selected.PackageDownloadUrl = packageDownloadUrl(selected, isPublic);
    if (!acceptsHdfsPointer()) {
      selected.AppPakcet = loadPackageBodyFromPointer(selected, selected.PackageDownloadUrl);
      selected.LegacyPackageHydrated = 1;
    }
  } catch (downloadError) {
    return { Code: 0, Msg: downloadError.message };
  }
  if (!selected.PackageDownloadUrl) return { Code: 0, Msg: '应用包下载地址为空。' };
}
var changeLogs = readChangeLogs(id);
return {
  Code: 1,
  Data: selected,
  DataAppend: {
    ChangeLogAvailable: changeLogs.Available,
    ChangeLogCount: changeLogs.Count,
    ChangeLogs: changeLogs.Rows,
    ApplicationAssetDownloadUrls: applicationAssetDownloadUrls
  },
  Msg: "成功"
};
