/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_publish_store
 * Version: v1.4.0
 * Function:
 * - 统一使用 sys_microistore 作为应用主表；mci_ai_app_file 与 mci_ai_app_version 继续保存私有源码和构建版本。
 * - 优先从 mci_ai_app_file.PublishHdfsPath 打包真实 dist 编译资产，保证跨租户安装后可直接预览和重新编译。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || '执行失败' }; }
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  return String(value);
}
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, '') === ''; }
function nowText(format) {
  var valueFormat = text(format, 'yyyy-MM-dd HH:mm:ss');
  try { if (typeof DateNow === 'function') return DateNow(valueFormat); } catch (error) {}
  try { return System.DateTime.Now.ToString(valueFormat); } catch (systemError) {}
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
function toArray(value) {
  var list = [];
  if (!value || value.length === undefined) return list;
  for (var i = 0; i < value.length; i++) list.push(value[i]);
  return list;
}
function normalizePath(value) {
  var path = text(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  var parts = path.split('/');
  var safe = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i] === '.' || parts[i] === '..') continue;
    safe.push(parts[i].replace(/[:*?"<>|]/g, '_'));
  }
  return safe.join('/');
}
function safeFileName(value) {
  return text(value, 'microi-app').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 100) || 'microi-app';
}
function normalizeVersion(value) {
  var version = text(value, 'v1.0.0').trim();
  var match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(version);
  if (!match) return 'v1.0.0';
  return 'v' + parseInt(match[1] || '1', 10) + '.' + parseInt(match[2] || '0', 10) + '.' + parseInt(match[3] || '0', 10);
}
function getApp(appIdOrKey) {
  var result = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['Id', '=', appIdOrKey]],
    _PageSize: 1
  });
  if (result && result.Code === 1 && result.Data) return result;
  return V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['AppKey', '=', appIdOrKey]],
    _PageSize: 1
  });
}
function getFiles(appId) {
  return V8.FormEngine.GetTableData('mci_ai_app_file', {
    _Where: [['AppId', '=', appId]],
    _OrderBy: 'FilePath',
    _OrderByType: 'ASC',
    _PageSize: 5000
  });
}
function getLatestVersion(appId) {
  return V8.FormEngine.GetTableData('mci_ai_app_version', {
    _Where: [['AppId', '=', appId]],
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC',
    _PageSize: 1
  });
}
function readFileBase64(filePathName, isText, limit) {
  if (isBlank(filePathName)) return '';
  if (isText && V8.Method.GetPrivateFileText) {
    var textResult = V8.Method.GetPrivateFileText({
      OsClient: V8.OsClient,
      FilePathName: filePathName,
      Limit: limit !== false
    });
    if (textResult && textResult.Code === 1) {
      return V8.Base64.StringToBase64(text(textResult.Data));
    }
  }
  var urlResult = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient,
    FilePathName: filePathName,
    Limit: limit !== false
  });
  if (!urlResult || urlResult.Code !== 1) throw new Error('读取 HDFS 文件失败：' + filePathName + '，' + ((urlResult && urlResult.Msg) || ''));
  var urlData = urlResult.Data || {};
  var url = typeof urlData === 'string' ? urlData : text(urlData.Url || urlData.url || urlData.FileUrl || urlData.Path);
  if (isBlank(url)) throw new Error('HDFS 未返回可读取地址：' + filePathName);
  var response = V8.Http.GetResponse({ Url: url, Timeout: 120 });
  if (!response || !response.RawBytes) throw new Error('下载 HDFS 文件失败：' + filePathName);
  return System.Convert.ToBase64String(response.RawBytes);
}
function isTextFile(path) {
  var lower = text(path).toLowerCase();
  var extensions = ['.vue','.js','.jsx','.ts','.tsx','.json','.html','.htm','.css','.scss','.sass','.less','.md','.txt','.xml','.yaml','.yml','.toml','.ini','.env','.cs','.csproj','.sln','.java','.kt','.go','.py','.php','.rb','.rs','.sql','.sh','.ps1','.bat','.cmd'];
  for (var i = 0; i < extensions.length; i++) {
    if (lower.lastIndexOf(extensions[i]) === lower.length - extensions[i].length) return true;
  }
  return lower.indexOf('.') < 0;
}
function getMicroService(appKey) {
  var service = V8.FormEngine.GetFormData('sys_microiservice', {
    _Where: [['MsKey', '=', appKey]],
    _PageSize: 1
  });
  if (!service || service.Code !== 1 || !service.Data) return { Service: null, Pages: [] };
  var pages = V8.FormEngine.GetTableData('sys_microiservice_page', {
    _Where: [['MicroServiceId', '=', service.Data.Id]],
    _OrderBy: 'Sort',
    _OrderByType: 'ASC',
    _PageSize: 500
  });
  return { Service: service.Data, Pages: pages && pages.Code === 1 ? toArray(pages.Data) : [] };
}
function getApplicationInfrastructure() {
  var tableNames = ['sys_microistore', 'mci_ai_app_file', 'mci_ai_app_version', 'sys_microiservice', 'sys_microiservice_page'];
  var tablesResult = V8.FormEngine.GetTableData('diy_table', {
    _Where: [['Name', 'In', tableNames]],
    _PageSize: 100
  });
  if (!tablesResult || tablesResult.Code !== 1) throw new Error('读取在线应用基础表定义失败：' + ((tablesResult && tablesResult.Msg) || ''));
  var tables = toArray(tablesResult.Data);
  var tableIds = [];
  for (var i = 0; i < tables.length; i++) if (tables[i] && tables[i].Id) tableIds.push(tables[i].Id);
  var fieldsResult = V8.FormEngine.GetTableData('diy_field', {
    _Where: [['TableId', 'In', tableIds]],
    _PageSize: 5000
  });
  if (!fieldsResult || fieldsResult.Code !== 1) throw new Error('读取在线应用基础字段定义失败：' + ((fieldsResult && fieldsResult.Msg) || ''));
  var ddls = [
    { TableName: 'sys_microistore', DDL: "CREATE TABLE IF NOT EXISTS `sys_microistore` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`AppName` varchar(200) NULL,`Name` varchar(200) NULL,`AppId` varchar(100) NULL,`AppKey` varchar(200) NULL,`AppVersion` varchar(50) NULL,`AppPublishTime` varchar(25) NULL,`AppUpdateTime` varchar(25) NULL,`AppAuthor` varchar(100) NULL,`AppAuthorAvatar` mediumtext NULL,`AppDetail` mediumtext NULL,`Description` mediumtext NULL,`AppPrice` int NULL,`AppOriPrice` int NULL,`AppRate` decimal(18,1) NULL,`AppPakcet` mediumtext NULL,`AppPreview` mediumtext NULL,`IsApprove` int NULL,`AppType` varchar(50) NULL,`ApplicationType` varchar(50) NULL,`Category` varchar(50) NULL,`PublisherType` varchar(50) NULL,`Status` varchar(50) NULL,`OwnerUserId` varchar(50) NULL,`OwnerName` varchar(200) NULL,`CurrentVersion` int NULL,`PreviewUrl` varchar(2000) NULL,`PublicPublishPath` varchar(2000) NULL,`PrivateSourcePath` varchar(2000) NULL,`BuildStatus` varchar(50) NULL,`LastBuildTaskId` varchar(50) NULL,`LastBuildMsg` mediumtext NULL,`LastConversationId` varchar(50) NULL,`ViewCount` int NULL,`InstallCount` int NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
    { TableName: 'mci_ai_app_file', DDL: "CREATE TABLE IF NOT EXISTS `mci_ai_app_file` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`AppId` varchar(50) NULL,`AppName` varchar(200) NULL,`VersionId` varchar(50) NULL,`FilePath` varchar(1000) NULL,`FileName` varchar(255) NULL,`FileType` varchar(50) NULL,`HdfsPath` varchar(1000) NULL,`PublishHdfsPath` varchar(1000) NULL,`StorageScope` varchar(50) NULL,`ContentHash` varchar(100) NULL,`Size` bigint NULL,`Version` int NULL,`IsDirectory` int NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
    { TableName: 'mci_ai_app_version', DDL: "CREATE TABLE IF NOT EXISTS `mci_ai_app_version` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`AppId` varchar(50) NULL,`AppName` varchar(200) NULL,`VersionNo` varchar(50) NULL,`VersionName` varchar(200) NULL,`Status` varchar(50) NULL,`SourceSnapshotPath` varchar(1000) NULL,`PublishPath` varchar(1000) NULL,`PreviewUrl` varchar(1000) NULL,`BuildTaskId` varchar(50) NULL,`BuildLog` mediumtext NULL,`ChangeSummary` mediumtext NULL,`FileCount` int NULL,`TotalSize` bigint NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
    { TableName: 'sys_microiservice', DDL: "CREATE TABLE IF NOT EXISTS `sys_microiservice` (`Id` varchar(36) NOT NULL PRIMARY KEY,`ParentId` varchar(50) NULL,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`MsName` varchar(50) NULL,`MsUrl` varchar(500) NULL,`MsKey` varchar(50) NULL,`MsType` varchar(50) NULL,`MsDevUrl` varchar(500) NULL,`IsEnable` int NULL,`StorageMode` varchar(50) NULL,`Runtime` varchar(50) NULL,`BuildVersion` varchar(50) NULL,`EntryPath` varchar(200) NULL,`AssetManifestJson` longtext NULL,`AssetsJson` longtext NULL,`DistHash` varchar(200) NULL,`AssetCount` int NULL,`TotalSize` varchar(25) NULL,`PublishTime` varchar(25) NULL,`SourceDirName` varchar(200) NULL,`Description` mediumtext NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
    { TableName: 'sys_microiservice_page', DDL: "CREATE TABLE IF NOT EXISTS `sys_microiservice_page` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`MicroServiceId` varchar(50) NULL,`MicroServiceKey` varchar(50) NULL,`PageKey` varchar(100) NULL,`PageName` varchar(100) NULL,`PageTitle` varchar(100) NULL,`RoutePath` varchar(200) NULL,`EntryPath` varchar(200) NULL,`MenuUrl` varchar(500) NULL,`Sort` int NULL,`IsHome` int NULL,`IsEnable` int NULL,`BuildVersion` varchar(50) NULL,`RouteMetaJson` mediumtext NULL,`SourceDirName` varchar(200) NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" }
  ];
  for (var d = 0; d < ddls.length; d++) {
    for (var t = 0; t < tables.length; t++) {
      if (tables[t].Name === ddls[d].TableName) ddls[d].TableId = tables[t].Id;
    }
  }
  return { DDLStatements: ddls, DiyTables: tables, DiyFields: toArray(fieldsResult.Data) };
}
function getBuildAssets(app, latestVersion, runtime) {
  var assets = [];
  if (runtime && runtime.Service && runtime.Service.AssetsJson) {
    var runtimeAssets = [];
    try { runtimeAssets = JSON.parse(runtime.Service.AssetsJson); } catch (e) { runtimeAssets = []; }
    for (var i = 0; i < runtimeAssets.length; i++) {
      var runtimeAsset = runtimeAssets[i] || {};
      var path = normalizePath(runtimeAsset.Path || runtimeAsset.FileName || 'asset-' + i);
      var hdfsPath = runtimeAsset.FilePathName || runtimeAsset.HdfsPath || runtimeAsset.PathName || '';
      assets.push({
        Path: path,
        FileName: runtimeAsset.FileName || path.substring(path.lastIndexOf('/') + 1),
        ContentType: runtimeAsset.ContentType || '',
        FileByteBase64: readFileBase64(hdfsPath, isTextFile(path), false),
        Size: runtimeAsset.Size || 0,
        Sha256: runtimeAsset.Sha256 || runtimeAsset.Hash || '',
        IsEntry: runtimeAsset.IsEntry === true || path === text(runtime.Service.EntryPath || 'index.html')
      });
    }
  }
  if (!assets.length && app && app.Id) {
    var compiledFilesResult = getFiles(app.Id);
    var compiledFiles = compiledFilesResult && compiledFilesResult.Code === 1
      ? toArray(compiledFilesResult.Data)
      : [];
    for (var c = 0; c < compiledFiles.length; c++) {
      var compiledFile = compiledFiles[c] || {};
      var sourcePath = normalizePath(compiledFile.FilePath);
      var publishPath = text(compiledFile.PublishHdfsPath);
      if (isBlank(sourcePath) || isBlank(publishPath)) continue;
      var lowerSourcePath = sourcePath.toLowerCase();
      var buildPath = '';
      if (lowerSourcePath.indexOf('dist/') === 0) buildPath = sourcePath.substring(5);
      else if (lowerSourcePath.indexOf('build/') === 0) buildPath = sourcePath.substring(6);
      else if (lowerSourcePath.indexOf('unpackage/dist/build/h5/') === 0) buildPath = sourcePath.substring(24);
      if (isBlank(buildPath)) continue;
      assets.push({
        Path: buildPath,
        FileName: compiledFile.FileName || buildPath.substring(buildPath.lastIndexOf('/') + 1),
        ContentType: '',
        FileByteBase64: readFileBase64(publishPath, isTextFile(buildPath), false),
        Size: compiledFile.Size || 0,
        Sha256: compiledFile.ContentHash || '',
        IsEntry: buildPath.toLowerCase() === 'index.html',
        Source: 'CompiledAssets'
      });
    }
  }
  var html = latestVersion ? text(latestVersion.BuildLog) : '';
  if (!assets.length && !isBlank(html)) {
    assets.push({
      Path: 'index.html',
      FileName: 'index.html',
      ContentType: 'text/html; charset=utf-8',
      FileByteBase64: V8.Base64.StringToBase64(html),
      Size: html.length,
      IsEntry: true
    });
  }
  return assets;
}

function getExistingStore(appKey) {
  var result = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['AppKey', '=', appKey]],
    _PageSize: 1
  });
  if (result && result.Code === 1 && result.Data) return result.Data;
  result = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['AppId', '=', appKey]],
    _PageSize: 1
  });
  return result && result.Code === 1 && result.Data ? result.Data : null;
}
function parseArray(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try { value = JSON.parse(value || '[]'); }
    catch (error) { throw new Error('选择数据配置不是有效JSON：' + error.message); }
  }
  return toArray(value);
}
function selectionValues(value, keys) {
  var rows = parseArray(value);
  var values = [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var selected = '';
    if (typeof row === 'string') {
      selected = row;
    } else if (row) {
      for (var k = 0; k < keys.length; k++) {
        if (!isBlank(row[keys[k]])) {
          selected = text(row[keys[k]]);
          break;
        }
      }
    }
    selected = text(selected).replace(/^\s+|\s+$/g, '');
    var uniqueKey = selected.toLowerCase();
    if (selected && !seen[uniqueKey]) {
      seen[uniqueKey] = true;
      values.push(selected);
    }
  }
  return values;
}
function mergeUniqueRows(left, right, keyFields) {
  var result = [];
  var map = {};
  var append = function (items) {
    items = toArray(items);
    for (var i = 0; i < items.length; i++) {
      var row = items[i] || {};
      var key = '';
      for (var k = 0; k < keyFields.length; k++) {
        if (row[keyFields[k]]) { key = String(row[keyFields[k]]).toLowerCase(); break; }
      }
      if (!key) key = 'index-' + result.length;
      if (!map[key]) {
        map[key] = true;
        result.push(row);
      }
    }
  };
  append(left);
  append(right);
  return result;
}

function upsertStore(row) {
  var existing = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['AppKey', '=', row.AppKey || row.AppId]],
    _PageSize: 1
  });
  if ((!existing || existing.Code !== 1 || !existing.Data) && row.AppId) {
    existing = V8.FormEngine.GetFormData('sys_microistore', {
      _Where: [['AppId', '=', row.AppId]],
      _PageSize: 1
    });
  }
  if (existing && existing.Code === 1 && existing.Data && existing.Data.Id) {
    row.Id = existing.Data.Id;
    return V8.FormEngine.UptFormData('sys_microistore', row);
  }
  return V8.FormEngine.AddFormData('sys_microistore', row);
}

var currentUser = V8.CurrentUser || {};
// V8.ApiEngine.Run 嵌套调用时 V8.CurrentUser 可能未随子引擎上下文复制，
// 但当前 HTTP 请求的 Token 仍由服务器持有。只从服务端 Token 上下文恢复身份，
// 不接受前端传入的 Level/User 对象，避免伪造超级管理员权限。
if (!currentUser || isBlank(currentUser.Id) || isBlank(currentUser.Level)) {
  var currentToken = V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
  if (currentToken && currentToken.CurrentUser) currentUser = currentToken.CurrentUser;
}
var level = parseInt(currentUser.Level || 0, 10);
if (isNaN(level) || level < 9999) return fail('权限不足：只有超级管理员才能制作或发布应用包。');

var appIdOrKey = text(V8.Param.AppId || V8.Param.AppKey || V8.Param.Id);
if (isBlank(appIdOrKey)) return fail('AppId 或 AppKey 不能为空');
var appResult = getApp(appIdOrKey);
if (!appResult || appResult.Code !== 1 || !appResult.Data) return { Code: 2, Data: null, Msg: 'AI应用不存在' };
var app = appResult.Data;
var appType = text(app.ApplicationType || app.AppType, 'Web');
if (['Web', 'UniApp', 'MicroService'].indexOf(appType) < 0) return fail('不支持的应用类型：' + appType);
var versionsResult = getLatestVersion(app.Id);
var latestVersion = versionsResult && versionsResult.Code === 1 && versionsResult.Data && versionsResult.Data.length ? versionsResult.Data[0] : null;
var runtime = appType === 'MicroService' ? getMicroService(app.AppKey) : { Service: null, Pages: [] };
var includeSource = V8.Param.IncludeSource === true || V8.Param.IncludeSource === 1 || text(V8.Param.IncludeSource).toLowerCase() === 'true';
var returnPackageModel = V8.Param.ReturnPackageModel === true || V8.Param.ReturnPackageModel === 1 || text(V8.Param.ReturnPackageModel).toLowerCase() === 'true';
var action = text(V8.Param.Action || 'Package');
// 应用商城“开始制作”历史上调用 PackageOnly，随后再下载 AppPakcet。
// 这个动作同样必须生成完全自包含的离线 JSON，不能只保存发布端 ZIP 地址。
var isOfflineAction = action === 'OfflinePackage' || action === 'Download' || action === 'PackageOnly';
var preparedList = parseArray(V8.Param.PreparedAssets || V8.Param.AiAppPackageManifest);
var packageAssets = null;
for (var preparedIndex = 0; preparedIndex < preparedList.length; preparedIndex++) {
  var prepared = preparedList[preparedIndex] || {};
  if (text(prepared.AppId) === text(app.Id) || text(prepared.AppKey) === text(app.AppKey)) {
    packageAssets = prepared;
    break;
  }
}
if (!packageAssets && V8.Param.PreparedAssets && !Array.isArray(V8.Param.PreparedAssets) && typeof V8.Param.PreparedAssets === 'object') {
  packageAssets = V8.Param.PreparedAssets;
}
// 自包含离线包直接读取已发布运行资产，无须先生成或下载公网 ZIP。
// 这也允许微服务源码后来有修改时，继续基于最近一次成功发布产物制作离线包。
if (!packageAssets && !isOfflineAction) {
  var prepareResult = V8.ApiEngine.Run('ai_app_prepare_store_assets', {
    Action: 'Prepare',
    Apps: [{ AppId: app.Id, IncludeSource: includeSource }]
  });
  if (!prepareResult || prepareResult.Code !== 1 || !prepareResult.Data) {
    return fail('生成AI应用ZIP失败：' + ((prepareResult && prepareResult.Msg) || '接口无返回'));
  }
  var preparedManifest = toArray(prepareResult.Data.Manifest);
  packageAssets = preparedManifest.length ? preparedManifest[0] : null;
}
if (!isOfflineAction && (!packageAssets || !packageAssets.BuildZip)) return fail('当前应用没有可安装的编译ZIP。');
var sourceFiles = [];
var buildAssets = [];
var infrastructure = getApplicationInfrastructure();
var versionNo = normalizeVersion(
  V8.Param.AppVersion ||
  (appType === 'MicroService' && runtime.Service && runtime.Service.BuildVersion) ||
  (latestVersion && latestVersion.VersionNo) ||
  'v1.0.0'
);
var entryPath = text((runtime.Service && runtime.Service.EntryPath) || 'index.html');
var dataSelections = parseArray(V8.Param.DataSelections || V8.Param.DataSets);
var menuIds = parseArray(V8.Param.MenuIds);
var tableIds = parseArray(V8.Param.TableIds);
var flowIds = parseArray(V8.Param.FlowIds);
var apiEngineKeys = parseArray(V8.Param.ApiEngineKeys);
var existingStore = getExistingStore(app.AppKey);
if (dataSelections.length === 0 && existingStore && existingStore.SelectData) {
  dataSelections = parseArray(existingStore.SelectData);
}
if (tableIds.length === 0 && existingStore && existingStore.SelectTable) {
  tableIds = selectionValues(existingStore.SelectTable, ['Id', 'TableId', 'Value']);
}
if (apiEngineKeys.length === 0 && existingStore && existingStore.SelectApiEngine) {
  apiEngineKeys = selectionValues(existingStore.SelectApiEngine, ['ApiEngineKey', 'Key', 'Value']);
}

var selectedExport = {
  DDLStatements: [],
  PhysicalColumns: [],
  DiyTables: [],
  DiyFields: [],
  DataSets: []
};
if (dataSelections.length > 0 || menuIds.length > 0 || tableIds.length > 0 || flowIds.length > 0 || apiEngineKeys.length > 0) {
  var selectedExportResult = V8.ApiEngine.Run('export-microi-store-package', {
    MenuIds: menuIds,
    FlowIds: flowIds,
    ApiEngineKeys: apiEngineKeys,
    TableIds: tableIds,
    DataSelections: dataSelections,
    PackageName: text(V8.Param.AppName || app.Name || app.AppKey),
    PackageVersion: versionNo
  });
  if (!selectedExportResult || selectedExportResult.Code !== 1 || !selectedExportResult.Data) {
    return fail('选择数据打包失败：' + ((selectedExportResult && selectedExportResult.Msg) || '接口无返回'));
  }
  selectedExport = selectedExportResult.Data;
}
infrastructure.DDLStatements = mergeUniqueRows(infrastructure.DDLStatements, selectedExport.DDLStatements, ['TableName']);
infrastructure.DiyTables = mergeUniqueRows(infrastructure.DiyTables, selectedExport.DiyTables, ['Id', 'Name']);
infrastructure.DiyFields = mergeUniqueRows(infrastructure.DiyFields, selectedExport.DiyFields, ['Id']);
var selectedDataSets = toArray(selectedExport.DataSets);
var selectedDataRowCount = 0;
for (var selectedDataSetIndex = 0; selectedDataSetIndex < selectedDataSets.length; selectedDataSetIndex++) {
  selectedDataRowCount += toArray(selectedDataSets[selectedDataSetIndex] && selectedDataSets[selectedDataSetIndex].Rows).length;
}

var packageModel = {
  PackageInfo: {
    Name: text(V8.Param.AppName || app.Name || app.AppKey),
    Version: versionNo,
    AppVersion: versionNo,
    AppId: app.AppKey,
    ApplicationType: appType,
    Description: text(V8.Param.AppDetail || app.Description),
    CreateTime: nowText('yyyy-MM-dd HH:mm:ss'),
    CreateUser: text(currentUser.Name || currentUser.Account),
    OsClient: V8.OsClient,
    DataSetCount: selectedDataSets.length,
    DataRowCount: selectedDataRowCount,
    IncludeSource: includeSource
  },
  ApplicationBundle: {
    SchemaVersion: 2,
    ApplicationType: appType,
    IncludeSource: includeSource,
    VersionNo: versionNo,
    EntryPath: entryPath,
    Application: {
      Id: app.Id,
      Name: text(V8.Param.AppName || app.AppName || app.Name),
      AppName: text(V8.Param.AppName || app.AppName || app.Name),
      AppId: text(app.AppId || app.AppKey),
      AppKey: text(app.AppKey || app.AppId),
      AppType: appType,
      ApplicationType: appType,
      Category: text(V8.Param.Category || app.Category || 'other'),
      PublisherType: text(V8.Param.PublisherType || app.PublisherType || '官方应用'),
      Description: text(V8.Param.AppDetail || app.AppDetail || app.Description),
      CurrentVersion: app.CurrentVersion || 1,
      EntryPath: entryPath,
      BuildVersion: versionNo
    },
    PackageAssets: packageAssets,
    MicroService: runtime.Service,
    Routes: runtime.Pages
  },
  DDLStatements: infrastructure.DDLStatements,
  PhysicalColumns: toArray(selectedExport.PhysicalColumns),
  DiyTables: infrastructure.DiyTables,
  DiyFields: infrastructure.DiyFields,
  DataSets: selectedDataSets,
  SysMenus: toArray(selectedExport.SysMenus),
  WfFlowDesigns: toArray(selectedExport.WfFlowDesigns),
  WfNodes: toArray(selectedExport.WfNodes),
  WfLines: toArray(selectedExport.WfLines),
  SysApiEngines: toArray(selectedExport.SysApiEngines)
};

if (isOfflineAction) {
  // 离线包必须能在完全不通发布端/HDFS 的客户环境安装。
  // PackageAssets 仍作为来源追踪信息保留，但安装器会优先使用这里内嵌的文件。
  buildAssets = getBuildAssets(app, latestVersion, runtime);
  if (!buildAssets.length) return fail('当前应用没有可内嵌的编译文件，无法制作真正的离线包。');
  packageModel.ApplicationBundle.BuildAssets = buildAssets;
  if (includeSource) {
    var storedSourceFiles = getFiles(app.Id);
    var storedSourceRows = storedSourceFiles && storedSourceFiles.Code === 1 ? toArray(storedSourceFiles.Data) : [];
    for (var sourceIndex = 0; sourceIndex < storedSourceRows.length; sourceIndex++) {
      var storedSource = storedSourceRows[sourceIndex] || {};
      var sourcePath = normalizePath(storedSource.FilePath || storedSource.FileName || ('source-' + sourceIndex));
      var sourceHdfsPath = storedSource.HdfsPath || storedSource.FilePathName || storedSource.PublishHdfsPath || '';
      if (!sourcePath || !sourceHdfsPath) continue;
      sourceFiles.push({
        Path: sourcePath,
        FileName: storedSource.FileName || sourcePath.substring(sourcePath.lastIndexOf('/') + 1),
        FileByteBase64: readFileBase64(sourceHdfsPath, isTextFile(sourcePath), true),
        Size: storedSource.Size || 0,
        Sha256: storedSource.ContentHash || '',
        Version: storedSource.Version || 1
      });
    }
    if (!sourceFiles.length) return fail('已选择“同时发布源码”，但当前应用没有可打包的私有源码，已停止生成离线包。');
    packageModel.ApplicationBundle.SourceFiles = sourceFiles;
  }
  packageModel.PackageInfo.OfflineSelfContained = true;
  var jsonText = JSON.stringify(packageModel, null, 2);
  var offlineResult = {
    FileName: safeFileName(packageModel.PackageInfo.Name) + '-' + versionNo + '.microi-app.json',
    ContentType: 'application/json; charset=utf-8',
    FileByteBase64: V8.Base64.StringToBase64(jsonText),
    PackageSummary: {
      Name: packageModel.PackageInfo.Name,
      Version: packageModel.PackageInfo.Version,
      OfflineSelfContained: true,
      BuildAssetCount: buildAssets.length,
      SourceFileCount: sourceFiles.length,
      RouteCount: packageModel.ApplicationBundle.Routes.length
    }
  };
  // 大型源码包的 Package 对象和 FileByteBase64 内容完全重复。默认只返回下载内容，
  // 避免响应序列化额外占用数百 MB；兼容确实需要内存对象的旧调用方。
  if (returnPackageModel) offlineResult.Package = packageModel;
  return ok(offlineResult, '应用离线包已生成');
}

if (action === 'Publish') {
  var storeRow = {
    AppName: packageModel.PackageInfo.Name,
    Name: packageModel.PackageInfo.Name,
    AppId: text(app.AppId || app.AppKey),
    AppKey: text(app.AppKey || app.AppId),
    AppVersion: versionNo,
    AppType: appType,
    ApplicationType: appType,
    Category: text(V8.Param.Category || app.Category || 'other'),
    PublisherType: text(V8.Param.PublisherType || V8.Param.StoreCategory || app.PublisherType || '官方应用'),
    AppAuthor: text(V8.Param.AppAuthor || currentUser.Name || currentUser.Account),
    OwnerUserId: text(app.OwnerUserId || currentUser.Id),
    OwnerName: text(app.OwnerName || currentUser.Name || currentUser.Account),
    AppDetail: text(V8.Param.AppDetail || app.AppDetail || app.Description),
    Description: text(V8.Param.AppDetail || app.AppDetail || app.Description),
    AppPrice: V8.Param.AppPrice || 0,
    AppOriPrice: V8.Param.AppOriPrice || 0,
    AppRate: V8.Param.AppRate || 5,
    AppPreview: V8.Param.AppPreview || '',
    IsApprove: V8.Param.IsApprove || '是',
    Status: 'Published',
    BuildStatus: 'Success',
    CurrentVersion: app.CurrentVersion || 1,
    PreviewUrl: app.PreviewUrl || '',
    PublicPublishPath: app.PublicPublishPath || '',
    PrivateSourcePath: app.PrivateSourcePath || '',
    AppPublishTime: nowText('yyyy-MM-dd HH:mm:ss'),
    AppUpdateTime: nowText('yyyy-MM-dd HH:mm:ss'),
    AppPakcet: JSON.stringify(packageModel),
    SelectTable: existingStore && existingStore.SelectTable ? existingStore.SelectTable : '',
    SelectApiEngine: existingStore && existingStore.SelectApiEngine ? existingStore.SelectApiEngine : '',
    SelectAiApp: JSON.stringify([{ AppId: app.Id, AppKey: app.AppKey, AppName: app.Name, ApplicationType: appType, IncludeSource: !!packageAssets.SourceZip }]),
    AiAppZipFiles: JSON.stringify([packageAssets.BuildZip].concat(packageAssets.SourceZip ? [packageAssets.SourceZip] : [])),
    AiAppPackageManifest: JSON.stringify([packageAssets])
  };
  var publishResult = upsertStore(storeRow);
  if (!publishResult || publishResult.Code !== 1) return publishResult || fail('发布到应用商城失败');
  return ok({ Store: publishResult.Data || storeRow, Package: packageModel }, '应用已发布到应用商城');
}

return ok({ Package: packageModel, SourceZipIncluded: !!packageAssets.SourceZip, BuildZipIncluded: true }, '统一应用包已生成');

