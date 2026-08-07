/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_publish_store
 * Version: v1.6.5
 * Function:
 * - 统一生成应用商城安装包；v3 发布以已提交指针证明做原子绑定，并生成接口引擎资源所有权策略。
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
function parseObject(value, fallback) {
  if (!value) return fallback || {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(text(value)); }
  catch (error) { return fallback || {}; }
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
/* SOURCE_BUILD_ARCHIVE_ROOTS_V1 */
function buildArchivePath(value) {
  var path = normalizePath(value);
  var lower = path.toLowerCase();
  var roots = ['unpackage/dist/build/h5/', 'dist/', 'build/'];
  for (var i = 0; i < roots.length; i++) {
    if (lower.indexOf(roots[i]) === 0) return path.substring(roots[i].length);
  }
  return '';
}
function sourceArchivePath(value) {
  var path = normalizePath(value);
  if (isBlank(path) || !isBlank(buildArchivePath(path))) return '';
  if (path.toLowerCase().indexOf('source/') === 0) return path.substring(7);
  return path;
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
function normalizeExactVersion(value) {
  var version = text(value).replace(/^\s+|\s+$/g, '');
  var match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return '';
  return 'v' + parseInt(match[1], 10) + '.' + parseInt(match[2], 10) + '.' + parseInt(match[3], 10);
}
/*
 * 旧发布器曾把不可变版本终态写为 Published；v3 finalize 写为 Completed。
 * legacy ExactPublishedVersion 只兼容这两个成功终态，且调用方仍须同时命中
 * 最新版本行和 PreparedAssets.PackageVersion，不能复用失败、处理中或旧版本资产。
 */
function validateExactPublishedVersion(versionRow, packageAssets, requestedVersionValue, protocolV3) {
  var state = text(versionRow && (versionRow.PublishState || versionRow.Status))
    .replace(/^\s+|\s+$/g, '')
    .toLowerCase();
  var acceptedState = protocolV3
    ? state === 'completed'
    : (state === 'published' || state === 'completed');
  if (!versionRow || !acceptedState) {
    return fail('ExactPublishedVersion=true 时最新不可变版本必须为 '
      + (protocolV3 ? 'Completed' : 'Published 或 Completed')
      + '，actual=' + (state || '(empty)'));
  }

  var requestedVersion = normalizeExactVersion(requestedVersionValue);
  var latestVersion = normalizeExactVersion(versionRow.VersionNo || versionRow.VersionName || '');
  var preparedVersion = normalizeExactVersion(packageAssets && packageAssets.PackageVersion);
  if (isBlank(requestedVersion)
      || requestedVersion !== latestVersion
      || requestedVersion !== preparedVersion) {
    return fail('ExactPublishedVersion 版本合同不一致：requested=' + requestedVersion
      + ' latest=' + latestVersion + ' prepared=' + preparedVersion);
  }
  return ok({ AppVersion: requestedVersion }, 'ExactPublishedVersion 版本合同验证通过');
}
function highestVersion(values) {
  var selected = 'v1.0.0';
  var selectedWeight = -1;
  for (var i = 0; i < values.length; i++) {
    if (isBlank(values[i])) continue;
    var normalized = normalizeVersion(values[i]);
    var parts = normalized.substring(1).split('.');
    var weight = parseInt(parts[0] || '0', 10) * 1000000
      + parseInt(parts[1] || '0', 10) * 1000
      + parseInt(parts[2] || '0', 10);
    if (weight > selectedWeight) {
      selected = normalized;
      selectedWeight = weight;
    }
  }
  return selected;
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
function getCommittedVersion(appId, versionId) {
  var result = V8.FormEngine.GetTableData('mci_ai_app_version', {
    _Where: [['Id', '=', versionId], ['AND', 'AppId', '=', appId]],
    _PageIndex: 1,
    _PageSize: 2
  });
  var rows = result && result.Code === 1 ? toArray(result.Data) : [];
  if (rows.length !== 1) throw new Error('CommittedProof.VersionId 必须精确命中 1 条所属应用版本，actual=' + rows.length);
  return rows[0];
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
    _Where: [
      ['MicroServiceId', '=', service.Data.Id],
      ['AND', 'IsDeleted', '<>', 1],
      ['AND', 'IsEnable', '<>', 0]
    ],
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
      var buildPath = buildArchivePath(compiledFile.FilePath);
      var publishPath = text(compiledFile.PublishHdfsPath || compiledFile.HdfsPath);
      if (isBlank(buildPath)) continue;
      if (isBlank(publishPath)) continue;
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
function canonicalJson(value) {
  if (value === null) return 'null';
  if (value && typeof value.length === 'number' && typeof value !== 'string') {
    var arrayParts = [];
    for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
      arrayParts.push(canonicalJson(value[arrayIndex]));
    }
    return '[' + arrayParts.join(',') + ']';
  }
  if (typeof value === 'object') {
    var objectKeys = Object.keys(value).sort();
    var objectParts = [];
    for (var objectIndex = 0; objectIndex < objectKeys.length; objectIndex++) {
      var objectKey = objectKeys[objectIndex];
      if (value[objectKey] === undefined || typeof value[objectKey] === 'function') {
        throw new Error('RouteSnapshot 不能包含 undefined/function：' + objectKey);
      }
      objectParts.push(JSON.stringify(objectKey) + ':' + canonicalJson(value[objectKey]));
    }
    return '{' + objectParts.join(',') + '}';
  }
  if (typeof value === 'number'
      && (!isFinite(value) || Math.floor(value) !== value || Math.abs(value) > 9007199254740991)) {
    throw new Error('RouteSnapshot number 只允许 JavaScript safe integer');
  }
  var primitive = JSON.stringify(value);
  if (primitive === undefined) throw new Error('RouteSnapshot 包含非 JSON 值');
  return primitive;
}
function sha256Hex(value) {
  if (!V8.EncryptHelper || !V8.EncryptHelper.Sha256Hex) throw new Error('V8.EncryptHelper.Sha256Hex 不可用');
  return text(V8.EncryptHelper.Sha256Hex(text(value))).toLowerCase();
}
function apiEngineMap(engines) {
  var result = {};
  var rows = toArray(engines);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var key = text(row.ApiEngineKey).toLowerCase();
    if (key) result[key] = row;
  }
  return result;
}
function buildApiEngineResourcePolicies(engines, requestedPolicies, existingStore) {
  var rows = toArray(engines);
  if (rows.length === 0) return null;
  var requestedRoot = parseObject(requestedPolicies, {});
  var requested = parseObject(requestedRoot.ApiEngines || requestedRoot, {});
  var previousPackage = parseObject(existingStore && existingStore.AppPakcet, {});
  var previousEngines = apiEngineMap(previousPackage.SysApiEngines);
  var previousRoot = parseObject(previousPackage.ResourcePolicies, {});
  var previousPolicies = parseObject(previousRoot.ApiEngines, {});
  var result = { SchemaVersion: 1, ApiEngines: {} };

  for (var i = 0; i < rows.length; i++) {
    var engine = rows[i] || {};
    var originalKey = text(engine.ApiEngineKey);
    var key = originalKey.toLowerCase();
    if (!key) continue;
    var source = requested[key] || requested[originalKey]
      || previousPolicies[key] || previousPolicies[originalKey] || {};
    if (typeof source === 'string') source = { UpgradePolicy: source };
    var policy = text(source.UpgradePolicy || source.Policy || 'Managed');
    if (policy !== 'Managed' && policy !== 'CreateIfMissing') {
      throw new Error('接口引擎资源策略不受支持：' + originalKey + ' -> ' + policy);
    }
    var entry = {
      Ownership: text(source.Ownership || (policy === 'CreateIfMissing' ? 'Tenant' : 'Application')),
      UpgradePolicy: policy
    };
    if (policy === 'Managed') {
      var previousEngine = previousEngines[key];
      var baseHash = previousEngine
        ? sha256Hex(text(previousEngine.ApiV8Code))
        : text(source.BaseHash).toLowerCase();
      if (baseHash) entry.BaseHash = baseHash;
    }
    result.ApiEngines[key] = entry;
  }
  return result;
}
function readV3RouteSnapshot(routesValue, jsonValue, hashValue) {
  if (routesValue === undefined || routesValue === null) throw new Error('ProtocolVersion=3 必须显式提供 Routes，无路由时传 []');
  var routes = parseArray(routesValue);
  var canonical = canonicalJson(JSON.parse(JSON.stringify(routes)));
  var suppliedJson = text(jsonValue);
  var suppliedHash = text(hashValue).toLowerCase();
  if (suppliedJson !== canonical) throw new Error('RouteSnapshotJson 与 Routes canonical JSON 不一致');
  var actualHash = sha256Hex(canonical);
  if (!/^[a-f0-9]{64}$/.test(suppliedHash) || suppliedHash !== actualHash) {
    throw new Error('RouteSnapshotHash 与 RouteSnapshotJson SHA-256 不一致');
  }
  return { Routes: routes, Json: canonical, Hash: actualHash };
}
function assertV3MicroServiceSnapshot(runtime, app, committedVersion, proof, routeSnapshot) {
  if (!runtime || !runtime.Service) throw new Error('v3 MicroService 必须显式提供 MicroService snapshot，禁止回退 live runtime');
  var service = runtime.Service;
  var expected = [
    ['MsKey', text(service.MsKey), text(app.AppKey)],
    ['ApplicationType', text(service.ApplicationType).toLowerCase(), 'microservice'],
    ['BuildVersion', text(service.BuildVersion), text(committedVersion.VersionNo)],
    ['EntryPath', text(service.EntryPath), text(committedVersion.EntryPath)],
    ['VersionId', text(service.VersionId), proof.VersionId],
    ['SourceManifestHash', text(service.SourceManifestHash).toLowerCase(), text(committedVersion.SourceManifestHash).toLowerCase()],
    ['RuntimeManifestHash', text(service.RuntimeManifestHash).toLowerCase(), proof.RuntimeManifestHash],
    ['DeliveryBatchId', text(service.DeliveryBatchId), text(committedVersion.DeliveryBatchId)],
    ['RequestId', text(service.RequestId), proof.RequestId],
    ['RequestFingerprint', text(service.RequestFingerprint).toLowerCase(), proof.RequestFingerprint],
    ['RouteSnapshotJson', text(service.RouteSnapshotJson), routeSnapshot.Json],
    ['RouteSnapshotHash', text(service.RouteSnapshotHash).toLowerCase(), routeSnapshot.Hash],
    ['RouteCount', text(service.RouteCount), text(routeSnapshot.Routes.length)]
  ];
  for (var expectedIndex = 0; expectedIndex < expected.length; expectedIndex++) {
    if (expected[expectedIndex][1] !== expected[expectedIndex][2]) {
      throw new Error('v3 MicroService snapshot.' + expected[expectedIndex][0] + ' 与 committed version 不一致');
    }
  }
}
function normalizeMenuContract(value, menuIds, exactMenuIds) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); }
    catch (error) { throw new Error('MenuContract 不是有效JSON：' + error.message); }
  }
  if (!value || typeof value !== 'object') throw new Error('MenuContract 必须是对象');
  if (!exactMenuIds) throw new Error('MenuContract 只能与 ExactMenuIds=true 一起使用');
  var expectedIds = selectionValues(menuIds, ['Id', 'MenuId', 'Value']);
  var contractIds = selectionValues(value.MenuIds, ['Id', 'MenuId', 'Value']);
  var contractMenus = toArray(value.Menus);
  var menuRowIds = selectionValues(contractMenus, ['Id', 'MenuId', 'Value']);
  var expectedMap = {};
  var contractMap = {};
  var menuRowMap = {};
  for (var i = 0; i < expectedIds.length; i++) expectedMap[text(expectedIds[i]).toLowerCase()] = true;
  for (var c = 0; c < contractIds.length; c++) contractMap[text(contractIds[c]).toLowerCase()] = true;
  for (var m = 0; m < menuRowIds.length; m++) menuRowMap[text(menuRowIds[m]).toLowerCase()] = true;
  if (expectedIds.length === 0
      || contractIds.length !== expectedIds.length
      || menuRowIds.length !== expectedIds.length
      || parseInt(value.Count || 0, 10) !== expectedIds.length) {
    throw new Error('MenuContract 数量与精确 MenuIds 不一致');
  }
  for (var e = 0; e < expectedIds.length; e++) {
    var expectedKey = text(expectedIds[e]).toLowerCase();
    if (!contractMap[expectedKey] || !menuRowMap[expectedKey]) {
      throw new Error('MenuContract 菜单集合与精确 MenuIds 不一致：' + expectedIds[e]);
    }
  }
  return value;
}
function selectionJson(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
/* REUSE_FRESH_PREPARED_ASSETS_V1
 * 大型应用重新逐文件下载、压缩、上传 ZIP 可能耗时数分钟。仅当既有 ZIP
 * 晚于最近一次成功构建时复用，避免同步发布超过反向代理超时。
 */
function reusablePreparedAssets(store, app, latestVersion, includeSource) {
  if (!store || isBlank(store.AiAppPackageManifest)) return null;
  var manifest;
  try { manifest = parseArray(store.AiAppPackageManifest); }
  catch (error) { return null; }
  var latestBuildTime = text(latestVersion && latestVersion.CreateTime);
  for (var i = 0; i < manifest.length; i++) {
    var item = manifest[i] || {};
    var sameApp = text(item.AppId) === text(app.Id)
      || text(item.AppKey).toLowerCase() === text(app.AppKey).toLowerCase();
    if (!sameApp || !item.BuildZip) continue;
    var buildPath = text(item.BuildZip.Path || item.BuildZip.FullPath || item.BuildZip.FilePathName);
    if (isBlank(buildPath)) continue;
    if (includeSource) {
      var sourcePath = item.SourceZip
        ? text(item.SourceZip.Path || item.SourceZip.FullPath || item.SourceZip.FilePathName)
        : '';
      if (isBlank(sourcePath)) continue;
    }
    var preparedTime = text(item.PreparedTime);
    if (isBlank(preparedTime)) continue;
    if (!isBlank(latestBuildTime) && preparedTime < latestBuildTime) continue;
    return item;
  }
  return null;
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

/* 解析 v3 finalize 回执中的提交证明；bigint 必须保持十进制字符串。 */
function readV3CommittedProof(value) {
  if (!value || typeof value !== 'object') throw new Error('ProtocolVersion=3 必须提供 CommittedProof');
  var proof = {
    VersionId: text(value.VersionId),
    RuntimeManifestHash: text(value.RuntimeManifestHash || value.CommittedRuntimeManifestHash).toLowerCase(),
    PublishFence: text(value.PublishFence),
    PublishRowVersion: text(value.PublishRowVersion),
    VersionRowVersion: text(value.VersionRowVersion),
    PublishState: text(value.PublishState),
    StableResolverPath: text(value.StableResolverPath),
    RequestId: text(value.RequestId),
    RequestFingerprint: text(value.RequestFingerprint).toLowerCase()
  };
  if (isBlank(proof.VersionId)) throw new Error('CommittedProof.VersionId 不能为空');
  if (!/^[a-f0-9]{64}$/.test(proof.RuntimeManifestHash)) throw new Error('CommittedProof.RuntimeManifestHash 不合法');
  if (!/^(0|[1-9]\d*)$/.test(proof.PublishFence)) throw new Error('CommittedProof.PublishFence 必须是规范十进制字符串');
  if (!/^(0|[1-9]\d*)$/.test(proof.PublishRowVersion)) throw new Error('CommittedProof.PublishRowVersion 必须是规范十进制字符串');
  if (!/^[1-9]\d*$/.test(proof.VersionRowVersion)) throw new Error('CommittedProof.VersionRowVersion 必须是正十进制字符串');
  if (proof.PublishState !== 'Completed') throw new Error('CommittedProof.PublishState 必须是 Completed');
  if (isBlank(proof.StableResolverPath) || proof.StableResolverPath.indexOf('/micro-app/v3/tenants/') < 0) {
    throw new Error('CommittedProof.StableResolverPath 不是 v3 stable resolver');
  }
  if (isBlank(proof.RequestId) || !/^[a-f0-9]{64}$/.test(proof.RequestFingerprint)) {
    throw new Error('CommittedProof 缺少 RequestId/RequestFingerprint');
  }
  return proof;
}

/* 在写包前后精确验证当前 store pointer；任何后续 release 前滚都会使 CAS 失败。 */
function assertV3CommittedStore(row, proof, label) {
  if (!row) throw new Error(label + ' sys_microistore 不存在');
  if (text(row.CommittedPublishVersionId) !== proof.VersionId
      || text(row.CommittedRuntimeManifestHash).toLowerCase() !== proof.RuntimeManifestHash
      || text(row.PublishFence) !== proof.PublishFence
      || text(row.PublishRowVersion) !== proof.PublishRowVersion
      || text(row.PublishState) !== 'Completed') {
    throw new Error(label + ' committed pointer 已漂移，禁止写入旧版本安装包');
  }
  if (text(row.PublicPublishPath) !== proof.StableResolverPath) {
    throw new Error(label + ' PublicPublishPath 与 stable resolver 不一致');
  }
}

/* 版本行证明同时绑定版本 Id、manifest、rowversion、请求指纹与完成态。 */
function assertV3CommittedVersion(row, proof, label) {
  if (!row
      || text(row.Id) !== proof.VersionId
      || text(row.RuntimeManifestHash).toLowerCase() !== proof.RuntimeManifestHash
      || text(row.RowVersion) !== proof.VersionRowVersion
      || text(row.PublishState || row.Status) !== 'Completed'
      || text(row.RequestId) !== proof.RequestId
      || text(row.RequestFingerprint).toLowerCase() !== proof.RequestFingerprint) {
    throw new Error(label + ' mci_ai_app_version 提交证明不一致');
  }
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
var action = text(V8.Param.Action || 'Package');
var protocolVersionText = text(V8.Param.ProtocolVersion);
if (!isBlank(protocolVersionText) && protocolVersionText !== '3') return fail('ProtocolVersion 只支持显式 v3 或省略');
var protocolV3 = protocolVersionText === '3';
if (protocolV3 && action !== 'Publish') return fail('ProtocolVersion=3 只允许 Action=Publish');
var versionsResult = getLatestVersion(app.Id);
var latestVersion = versionsResult && versionsResult.Code === 1 && versionsResult.Data && versionsResult.Data.length ? versionsResult.Data[0] : null;
var explicitRoutesSupplied = V8.Param.Routes !== undefined && V8.Param.Routes !== null;
var runtime = appType === 'MicroService'
  ? (protocolV3
      ? { Service: V8.Param.MicroService || null, Pages: explicitRoutesSupplied ? parseArray(V8.Param.Routes) : null }
      : getMicroService(app.AppKey))
  : { Service: null, Pages: [] };
// 商城发布与官方库运行态安装必须解耦。本地开发者可以直接提交构建 ZIP、
// 微服务元数据和路由，而不必先向发布库写入 sys_microiservice。
if (!protocolV3 && appType === 'MicroService' && (!runtime || !runtime.Service) && V8.Param.MicroService) {
  runtime = {
    Service: V8.Param.MicroService,
    Pages: parseArray(V8.Param.Routes || V8.Param.Pages)
  };
}
var includeSource = V8.Param.IncludeSource === true || V8.Param.IncludeSource === 1 || text(V8.Param.IncludeSource).toLowerCase() === 'true';
var returnPackageModel = V8.Param.ReturnPackageModel === true || V8.Param.ReturnPackageModel === 1 || text(V8.Param.ReturnPackageModel).toLowerCase() === 'true';
var committedProof = null;
var committedVersion = null;
var v3RouteSnapshot = null;
if (protocolV3) {
  try { committedProof = readV3CommittedProof(V8.Param.CommittedProof); }
  catch (proofError) { return fail(proofError.message); }
  try {
    assertV3CommittedStore(app, committedProof, '写包前');
    committedVersion = getCommittedVersion(app.Id, committedProof.VersionId);
    assertV3CommittedVersion(committedVersion, committedProof, '写包前');
    v3RouteSnapshot = readV3RouteSnapshot(V8.Param.Routes, V8.Param.RouteSnapshotJson, V8.Param.RouteSnapshotHash);
    if (text(committedVersion.RouteSnapshotJson) !== v3RouteSnapshot.Json
        || text(committedVersion.RouteSnapshotHash).toLowerCase() !== v3RouteSnapshot.Hash) {
      throw new Error('写包前 mci_ai_app_version route snapshot 与显式冻结请求不一致');
    }
    if (isBlank(committedVersion.EntryPath)) throw new Error('写包前 committedVersion.EntryPath 不能为空');
    if (appType === 'MicroService') {
      assertV3MicroServiceSnapshot(runtime, app, committedVersion, committedProof, v3RouteSnapshot);
    }
  } catch (proofReadError) { return fail(proofReadError.message); }
}
var existingStore = getExistingStore(app.AppKey);
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
if (protocolV3 && !packageAssets) return fail('ProtocolVersion=3 必须显式提供 finalize 前准备的不可变 PreparedAssets');
var forcePrepareAssets = V8.Param.ForcePrepareAssets === true
  || V8.Param.ForcePrepareAssets === 1
  || text(V8.Param.ForcePrepareAssets).toLowerCase() === 'true';
var reusedPreparedAssets = false;
if (!packageAssets && !isOfflineAction && !forcePrepareAssets) {
  packageAssets = reusablePreparedAssets(existingStore, app, latestVersion, includeSource);
  reusedPreparedAssets = !!packageAssets;
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
// 微服务以真实运行态 BuildVersion 为准；其它应用比较最近构建版本与商城
// 语义版本，既不接受旧调用参数降级，也不把 v3.0.0 降成构建流水号 v1.0.4。
// 发布编排器在“最新不可变版本已成功完成、仅安装包阶段中断”时可显式复用。
// legacy 同时兼容历史 Published 与 v3 Completed 终态；门禁仍要求
// PreparedAssets.PackageVersion、调用 AppVersion 和最新版本完全一致。
var exactPublishedVersion = protocolV3
  || V8.Param.ExactPublishedVersion === true
  || V8.Param.ExactPublishedVersion === 1
  || text(V8.Param.ExactPublishedVersion).toLowerCase() === 'true';
var requestedPublishedVersion = '';
if (exactPublishedVersion) {
  var exactVersionRow = protocolV3 ? committedVersion : latestVersion;
  var exactVersionValidation = validateExactPublishedVersion(
    exactVersionRow,
    packageAssets,
    V8.Param.AppVersion,
    protocolV3
  );
  if (!exactVersionValidation || exactVersionValidation.Code !== 1) return exactVersionValidation;
  requestedPublishedVersion = exactVersionValidation.Data.AppVersion;
}
var versionNo = exactPublishedVersion
  ? requestedPublishedVersion
  : (appType === 'MicroService' && runtime.Service && !isBlank(runtime.Service.BuildVersion)
      ? normalizeVersion(runtime.Service.BuildVersion)
      : highestVersion([
          latestVersion ? latestVersion.VersionNo : '',
          V8.Param.AppVersion,
          existingStore ? existingStore.AppVersion : '',
          app.AppVersion
        ]));
var entryPath = protocolV3
  ? text(committedVersion.EntryPath)
  : text((runtime.Service && runtime.Service.EntryPath) || 'index.html');
var dataSelections = parseArray(V8.Param.DataSelections || V8.Param.DataSets);
var menuIds = parseArray(V8.Param.MenuIds);
var exactMenuIds = V8.Param.ExactMenuIds === true
  || V8.Param.ExactMenuIds === 1
  || text(V8.Param.ExactMenuIds).toLowerCase() === 'true';
var tableIds = parseArray(V8.Param.TableIds);
var flowIds = parseArray(V8.Param.FlowIds);
var apiEngineKeys = parseArray(V8.Param.ApiEngineKeys);
var requestedResourcePolicies = V8.Param.ResourcePolicies || V8.Param.ApiEnginePolicies || {};
if (dataSelections.length === 0 && existingStore && existingStore.SelectData) {
  dataSelections = parseArray(existingStore.SelectData);
}
if (menuIds.length === 0 && existingStore && existingStore.SelectMenu) {
  menuIds = selectionValues(existingStore.SelectMenu, ['Id', 'MenuId', 'Value']);
}
if (tableIds.length === 0 && existingStore && existingStore.SelectTable) {
  tableIds = selectionValues(existingStore.SelectTable, ['Id', 'TableId', 'Value']);
}
if (apiEngineKeys.length === 0 && existingStore && existingStore.SelectApiEngine) {
  apiEngineKeys = selectionValues(existingStore.SelectApiEngine, ['ApiEngineKey', 'Key', 'Value']);
}
var menuContract = normalizeMenuContract(
  V8.Param.MenuContract || (packageAssets && packageAssets.MenuContract),
  menuIds,
  exactMenuIds
);
if (exactMenuIds && menuIds.length > 0 && !menuContract) {
  return fail('ExactMenuIds=true 时必须提供与菜单集合一致的 MenuContract');
}
if (menuContract && packageAssets) packageAssets.MenuContract = menuContract;

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
    ExactMenuIds: exactMenuIds,
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
var generatedResourcePolicies = buildApiEngineResourcePolicies(
  packageModel.SysApiEngines,
  requestedResourcePolicies,
  existingStore
);
if (generatedResourcePolicies) packageModel.ResourcePolicies = generatedResourcePolicies;

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
      var sourcePath = sourceArchivePath(storedSource.FilePath || storedSource.FileName || ('source-' + sourceIndex));
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
  /* PRESERVE_STORE_METADATA_V1
   * 批量补包只更新安装包和发布状态；调用方未显式传值时，保留商城原有
   * 预览图、分类、作者和价格等元数据，避免无参发布把字段降级为空或默认值。
   */
  var preservedStore = existingStore || app || {};
  var hasParam = function (name) {
    return V8.Param[name] !== undefined && V8.Param[name] !== null && !isBlank(V8.Param[name]);
  };
  var storeRow = {
    AppName: packageModel.PackageInfo.Name,
    Name: packageModel.PackageInfo.Name,
    AppId: text(app.AppId || app.AppKey),
    AppKey: text(app.AppKey || app.AppId),
    AppVersion: versionNo,
    AppType: appType,
    ApplicationType: appType,
    Category: text(V8.Param.Category || preservedStore.Category || app.Category || 'other'),
    PublisherType: text(V8.Param.PublisherType || V8.Param.StoreCategory || preservedStore.PublisherType || app.PublisherType || '官方应用'),
    AppAuthor: text(V8.Param.AppAuthor || preservedStore.AppAuthor || app.AppAuthor || currentUser.Name || currentUser.Account),
    OwnerUserId: text(preservedStore.OwnerUserId || app.OwnerUserId || currentUser.Id),
    OwnerName: text(preservedStore.OwnerName || app.OwnerName || currentUser.Name || currentUser.Account),
    AppDetail: text(V8.Param.AppDetail || preservedStore.AppDetail || app.AppDetail || app.Description),
    Description: text(V8.Param.AppDetail || preservedStore.Description || app.AppDetail || app.Description),
    AppPrice: hasParam('AppPrice') ? V8.Param.AppPrice : (preservedStore.AppPrice || 0),
    AppOriPrice: hasParam('AppOriPrice') ? V8.Param.AppOriPrice : (preservedStore.AppOriPrice || 0),
    AppRate: hasParam('AppRate') ? V8.Param.AppRate : (preservedStore.AppRate || 5),
    AppPreview: hasParam('AppPreview') ? V8.Param.AppPreview : (preservedStore.AppPreview || app.AppPreview || ''),
    IsApprove: hasParam('IsApprove') ? V8.Param.IsApprove : (preservedStore.IsApprove || '是'),
    Status: 'Published',
    BuildStatus: 'Success',
    CurrentVersion: preservedStore.CurrentVersion || app.CurrentVersion || 1,
    PreviewUrl: preservedStore.PreviewUrl || app.PreviewUrl || '',
    PublicPublishPath: preservedStore.PublicPublishPath || app.PublicPublishPath || '',
    PrivateSourcePath: preservedStore.PrivateSourcePath || app.PrivateSourcePath || '',
    AppPublishTime: nowText('yyyy-MM-dd HH:mm:ss'),
    AppUpdateTime: nowText('yyyy-MM-dd HH:mm:ss'),
    AppPakcet: JSON.stringify(packageModel),
    SelectMenu: V8.Param.SelectMenu !== undefined && V8.Param.SelectMenu !== null
      ? selectionJson(V8.Param.SelectMenu)
      : selectionJson(existingStore && existingStore.SelectMenu),
    SelectTable: existingStore && existingStore.SelectTable ? existingStore.SelectTable : '',
    SelectApiEngine: existingStore && existingStore.SelectApiEngine ? existingStore.SelectApiEngine : '',
    SelectAiApp: JSON.stringify([{ AppId: app.Id, AppKey: app.AppKey, AppName: app.Name, ApplicationType: appType, IncludeSource: !!packageAssets.SourceZip }]),
    AiAppZipFiles: JSON.stringify([packageAssets.BuildZip].concat(packageAssets.SourceZip ? [packageAssets.SourceZip] : [])),
    AiAppPackageManifest: JSON.stringify([packageAssets])
  };
  if (protocolV3) {
    // Core 已经提交并投影运行态字段；这里禁止普通 Upt/Add，只在同一
    // committed pointer 上以单条条件更新写商城包与展示元数据。
    var packageFields = {
      AppName: storeRow.AppName,
      Name: storeRow.Name,
      AppId: storeRow.AppId,
      AppKey: storeRow.AppKey,
      AppType: storeRow.AppType,
      ApplicationType: storeRow.ApplicationType,
      Category: storeRow.Category,
      PublisherType: storeRow.PublisherType,
      AppAuthor: storeRow.AppAuthor,
      OwnerUserId: storeRow.OwnerUserId,
      OwnerName: storeRow.OwnerName,
      AppDetail: storeRow.AppDetail,
      Description: storeRow.Description,
      AppPrice: storeRow.AppPrice,
      AppOriPrice: storeRow.AppOriPrice,
      AppRate: storeRow.AppRate,
      AppPreview: storeRow.AppPreview,
      IsApprove: storeRow.IsApprove,
      AppUpdateTime: storeRow.AppUpdateTime,
      AppPakcet: storeRow.AppPakcet,
      SelectMenu: storeRow.SelectMenu,
      SelectTable: storeRow.SelectTable,
      SelectApiEngine: storeRow.SelectApiEngine,
      SelectAiApp: storeRow.SelectAiApp,
      AiAppZipFiles: storeRow.AiAppZipFiles,
      AiAppPackageManifest: storeRow.AiAppPackageManifest,
      _Where: [
        ['Id', '=', app.Id],
        ['AND', 'CommittedPublishVersionId', '=', committedProof.VersionId],
        ['AND', 'CommittedRuntimeManifestHash', '=', committedProof.RuntimeManifestHash],
        ['AND', 'PublishFence', '=', committedProof.PublishFence],
        ['AND', 'PublishRowVersion', '=', committedProof.PublishRowVersion],
        ['AND', 'PublishState', '=', 'Completed']
      ]
    };
    var fencedPublishResult = V8.FormEngine.UptFormDataByWhere('sys_microistore', packageFields);
    if (!fencedPublishResult || fencedPublishResult.Code !== 1) {
      return fencedPublishResult || fail('v3 committed-proof CAS 写包失败');
    }
    var postPublishResult = getApp(app.Id);
    var postPublishStore = postPublishResult && postPublishResult.Code === 1 ? postPublishResult.Data : null;
    try { assertV3CommittedStore(postPublishStore, committedProof, '写包后'); }
    catch (postProofError) { return fail(postProofError.message); }
    try {
      var postCommittedVersion = getCommittedVersion(app.Id, committedProof.VersionId);
      assertV3CommittedVersion(postCommittedVersion, committedProof, '写包后');
      if (text(postCommittedVersion.RouteSnapshotJson) !== v3RouteSnapshot.Json
          || text(postCommittedVersion.RouteSnapshotHash).toLowerCase() !== v3RouteSnapshot.Hash) {
        throw new Error('写包后 mci_ai_app_version route snapshot 已漂移');
      }
    } catch (postVersionProofError) { return fail(postVersionProofError.message); }
    if (!postPublishStore
        || text(postPublishStore.AppPakcet) !== text(packageFields.AppPakcet)
        || text(postPublishStore.AiAppPackageManifest) !== text(packageFields.AiAppPackageManifest)
        || text(postPublishStore.AiAppZipFiles) !== text(packageFields.AiAppZipFiles)) {
      return fail('v3 committed-proof CAS 写包回读不一致');
    }
    return ok({
      Store: postPublishStore,
      Package: packageModel,
      PreparedAssetsReused: false,
      PreparedTime: packageAssets.PreparedTime || '',
      AppVersion: text(postPublishStore.AppVersion),
      CurrentVersion: postPublishStore.CurrentVersion,
      CommittedProof: committedProof,
      FencedCas: true
    }, '应用安装包已绑定到当前 committed pointer');
  }
  var publishResult = upsertStore(storeRow);
  if (!publishResult || publishResult.Code !== 1) return publishResult || fail('发布到应用商城失败');
  return ok({
    Store: publishResult.Data || storeRow,
    Package: packageModel,
    PreparedAssetsReused: reusedPreparedAssets,
    PreparedTime: packageAssets.PreparedTime || '',
    AppVersion: versionNo,
    CurrentVersion: app.CurrentVersion || 1
  }, '应用已发布到应用商城');
}

return ok({ Package: packageModel, SourceZipIncluded: !!packageAssets.SourceZip, BuildZipIncluded: true }, '统一应用包已生成');
