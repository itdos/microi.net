/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_publish_store
 * Version: v1.0.0
 * Function:
 * - 将 AI 应用（Web、UniApp、MicroService）的私有源码与公有编译产物制作成统一应用包。
 * - Action=Publish 时发布/更新到 sys_microistore；Action=OfflinePackage 时返回可下载 JSON 离线包。
 * - 应用包内嵌源码和编译文件，安装者无需访问发布者的私有 HDFS 桶。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || '执行失败' }; }
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  return String(value);
}
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, '') === ''; }
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
  var result = V8.FormEngine.GetFormData('mci_ai_app', {
    _Where: [['Id', '=', appIdOrKey]],
    _PageSize: 1
  });
  if (result && result.Code === 1 && result.Data) return result;
  return V8.FormEngine.GetFormData('mci_ai_app', {
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
  var tableNames = ['mci_ai_app', 'mci_ai_app_file', 'mci_ai_app_version', 'sys_microiservice', 'sys_microiservice_page'];
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
    { TableName: 'mci_ai_app', DDL: "CREATE TABLE IF NOT EXISTS `mci_ai_app` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL,`Name` varchar(200) NULL,`AppKey` varchar(120) NULL,`AppType` varchar(50) NULL,`Description` mediumtext NULL,`Status` varchar(50) NULL,`OwnerUserId` varchar(50) NULL,`OwnerName` varchar(100) NULL,`CurrentVersion` int NULL,`PreviewUrl` varchar(1000) NULL,`PublicPublishPath` varchar(1000) NULL,`PrivateSourcePath` varchar(1000) NULL,`BuildStatus` varchar(50) NULL,`LastBuildTaskId` varchar(50) NULL,`LastBuildMsg` mediumtext NULL,`LastConversationId` varchar(50) NULL,`Remark` mediumtext NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
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
function upsertStore(row) {
  var existing = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['AppId', '=', row.AppId]],
    _PageSize: 1
  });
  if (existing && existing.Code === 1 && existing.Data && existing.Data.Id) {
    row.Id = existing.Data.Id;
    return V8.FormEngine.UptFormData('sys_microistore', row);
  }
  return V8.FormEngine.AddFormData('sys_microistore', row);
}

var currentUser = V8.CurrentUser || {};
var level = parseInt(currentUser.Level || 0, 10);
if (isNaN(level) || level < 9999) return fail('权限不足：只有超级管理员才能制作或发布应用包。');

var appIdOrKey = text(V8.Param.AppId || V8.Param.AppKey || V8.Param.Id);
if (isBlank(appIdOrKey)) return fail('AppId 或 AppKey 不能为空');
var appResult = getApp(appIdOrKey);
if (!appResult || appResult.Code !== 1 || !appResult.Data) return { Code: 2, Data: null, Msg: 'AI应用不存在' };
var app = appResult.Data;
var appType = text(app.AppType, 'Web');
if (['Web', 'UniApp', 'MicroService'].indexOf(appType) < 0) return fail('不支持的应用类型：' + appType);
var filesResult = getFiles(app.Id);
if (!filesResult || filesResult.Code !== 1) return filesResult || fail('读取应用源码文件失败');
var sourceRows = toArray(filesResult.Data);
var sourceFiles = [];
for (var i = 0; i < sourceRows.length; i++) {
  var file = sourceRows[i] || {};
  if (parseInt(file.IsDirectory || 0, 10) === 1) continue;
  var path = normalizePath(file.FilePath || file.FileName);
  if (isBlank(path)) continue;
  sourceFiles.push({
    Path: path,
    FileName: file.FileName || path.substring(path.lastIndexOf('/') + 1),
    FileType: file.FileType || '',
    FileByteBase64: readFileBase64(file.HdfsPath, isTextFile(path), true),
    Size: file.Size || 0,
    Sha256: file.ContentHash || '',
    Version: file.Version || 1
  });
}
var versionsResult = getLatestVersion(app.Id);
var latestVersion = versionsResult && versionsResult.Code === 1 && versionsResult.Data && versionsResult.Data.length ? versionsResult.Data[0] : null;
var runtime = appType === 'MicroService' ? getMicroService(app.AppKey) : { Service: null, Pages: [] };
var buildAssets = getBuildAssets(app, latestVersion, runtime);
if (!buildAssets.length) return fail('当前应用没有编译产物，请先在 AI 应用工作台点击运行/发布。');
var infrastructure = getApplicationInfrastructure();
var versionNo = normalizeVersion(
  V8.Param.AppVersion ||
  (appType === 'MicroService' && runtime.Service && runtime.Service.BuildVersion) ||
  (latestVersion && latestVersion.VersionNo) ||
  'v1.0.0'
);
var entryPath = text((runtime.Service && runtime.Service.EntryPath) || 'index.html');
var packageModel = {
  PackageInfo: {
    Name: text(V8.Param.AppName || app.Name || app.AppKey),
    Version: versionNo,
    AppVersion: versionNo,
    AppId: app.AppKey,
    ApplicationType: appType,
    Description: text(V8.Param.AppDetail || app.Description),
    CreateTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    CreateUser: text(currentUser.Name || currentUser.Account),
    OsClient: V8.OsClient
  },
  ApplicationBundle: {
    SchemaVersion: 1,
    ApplicationType: appType,
    VersionNo: versionNo,
    EntryPath: entryPath,
    Application: {
      Id: app.Id,
      Name: text(V8.Param.AppName || app.Name),
      AppKey: app.AppKey,
      AppType: appType,
      Description: text(V8.Param.AppDetail || app.Description),
      CurrentVersion: app.CurrentVersion || 1,
      EntryPath: entryPath,
      BuildVersion: versionNo
    },
    SourceFiles: sourceFiles,
    BuildAssets: buildAssets,
    MicroService: runtime.Service,
    Routes: runtime.Pages
  },
  DDLStatements: infrastructure.DDLStatements,
  PhysicalColumns: [],
  DiyTables: infrastructure.DiyTables,
  DiyFields: infrastructure.DiyFields,
  SysMenus: [],
  WfFlowDesigns: [],
  WfNodes: [],
  WfLines: [],
  SysApiEngines: []
};

var action = text(V8.Param.Action || 'Package');
if (action === 'OfflinePackage' || action === 'Download') {
  var jsonText = JSON.stringify(packageModel, null, 2);
  return ok({
    Package: packageModel,
    FileName: safeFileName(packageModel.PackageInfo.Name) + '-' + versionNo + '.microi-app.json',
    ContentType: 'application/json; charset=utf-8',
    FileByteBase64: V8.Base64.StringToBase64(jsonText)
  }, '应用离线包已生成');
}

if (action === 'Publish') {
  var storeRow = {
    AppName: packageModel.PackageInfo.Name,
    AppId: app.AppKey,
    AppVersion: versionNo,
    AppType: text(V8.Param.StoreCategory || '官方应用'),
    ApplicationType: appType,
    AppAuthor: text(V8.Param.AppAuthor || currentUser.Name || currentUser.Account),
    AppDetail: text(V8.Param.AppDetail || app.Description),
    AppPrice: V8.Param.AppPrice || 0,
    AppOriPrice: V8.Param.AppOriPrice || 0,
    AppRate: V8.Param.AppRate || 5,
    AppPreview: V8.Param.AppPreview || '',
    IsApprove: V8.Param.IsApprove || '是',
    AppPublishTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    AppUpdateTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    AppPakcet: JSON.stringify(packageModel)
  };
  var publishResult = upsertStore(storeRow);
  if (!publishResult || publishResult.Code !== 1) return publishResult || fail('发布到应用商城失败');
  return ok({ Store: publishResult.Data || storeRow, Package: packageModel }, '应用已发布到应用商城');
}

return ok({ Package: packageModel, SourceFileCount: sourceFiles.length, BuildAssetCount: buildAssets.length }, '统一应用包已生成');
