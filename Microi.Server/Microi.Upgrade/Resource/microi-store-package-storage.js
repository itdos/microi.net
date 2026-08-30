/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：microi-store-package-storage
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: microi-store-package-storage
 * Version: v1.2.1
 * Function:
 * - 将应用商城 JSON 安装包以 UTF-8 Base64 无损传输写入公有或私有 HDFS，完成字节数与 SHA-256 回读校验，并复用已验证的内容寻址包对象。
 */

function text(value) { return value === null || value === undefined ? '' : String(value); }
function trim(value) { return text(value).replace(/^\s+|\s+$/g, ''); }
function flag(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  var normalized = trim(value).toLowerCase();
  return value === true || value === 1 || ['1', 'true', 'yes', 'on', 'enabled'].indexOf(normalized) >= 0;
}
function safeSegment(value, fallback) {
  var normalized = trim(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}
function plain(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (error) { return null; }
}
function firstPath(data) {
  if (!data) return '';
  if (data.length !== undefined && typeof data !== 'string') data = data.length > 0 ? data[0] : null;
  return trim(data && (data.Path || data.FilePathName || data.FilePath || data.FullPath || data.Url || data.url));
}
function utf8Size(value) {
  try { return Number(System.Text.Encoding.UTF8.GetByteCount(String(value || ''))); }
  catch (error) { return unescape(encodeURIComponent(String(value || ''))).length; }
}
function sha256(value) { return trim(V8.EncryptHelper.Sha256Hex(String(value || ''))).toLowerCase(); }
function currentLevel() {
  var user = V8.CurrentUser || {};
  if (user.Level !== null && user.Level !== undefined) return parseInt(user.Level || 0, 10) || 0;
  try {
    var token = V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    return parseInt(token && token.CurrentUser && token.CurrentUser.Level || 0, 10) || 0;
  } catch (error) { return 0; }
}
function verifyStoredText(path, isPrivate, expectedSha, expectedSize) {
  var read = V8.Method.GetPrivateFileText({
    OsClient: V8.OsClient,
    FilePathName: path,
    Limit: isPrivate,
    MaxBytes: Math.min(Math.max(Number(expectedSize || 0) + 1024, 1024 * 1024), 256 * 1024 * 1024)
  });
  if (!read || read.Code !== 1) {
    throw new Error('应用包 HDFS 回读失败：' + ((read && read.Msg) || path));
  }
  var actualText = text(read.Data);
  var actualSize = utf8Size(actualText);
  var actualSha = sha256(actualText);
  if (actualSize !== Number(expectedSize) || actualSha !== expectedSha) {
    throw new Error('应用包 HDFS 回读校验失败：size=' + actualSize + '/' + expectedSize
      + '，sha256=' + actualSha + '/' + expectedSha);
  }
  return true;
}
function packagePointer(row) {
  row = row || {};
  return {
    PackageId: trim(row.Id || row.PackageId),
    PackageStorageMode: trim(row.StorageMode || row.PackageStorageMode),
    PackageHdfsPath: trim(row.HdfsPath || row.PackageHdfsPath),
    PackageSha256: trim(row.Sha256 || row.PackageSha256).toLowerCase(),
    PackageSize: Number(row.Size || row.PackageSize || 0),
    PackageContentType: trim(row.ContentType || row.PackageContentType || 'application/json; charset=utf-8'),
    PackageFormatVersion: Number(row.FormatVersion || row.PackageFormatVersion || 2),
    PackageUploadedAt: trim(row.VerifiedTime || row.PackageUploadedAt || row.UpdateTime || row.CreateTime)
  };
}
function pointerCacheKey(storeId, storageMode, sha) {
  return 'Microi:' + V8.OsClient + ':MarketplacePackagePointer:' + storageMode + ':' + storeId + ':' + sha;
}
function readPointerCache(cacheKey, storageMode, expectedSha, expectedSize) {
  var cached = plain(V8.Cache.Get(cacheKey));
  if (!cached) return null;
  var pointer = packagePointer(cached);
  if (!pointer.PackageId || !pointer.PackageHdfsPath
      || pointer.PackageStorageMode !== storageMode
      || pointer.PackageSha256 !== expectedSha
      || pointer.PackageSize !== Number(expectedSize)) {
    V8.Cache.Remove(cacheKey);
    return null;
  }
  return pointer;
}
function writePointerCache(cacheKey, row) {
  var pointer = packagePointer(row);
  V8.Cache.Set(cacheKey, JSON.stringify(pointer), '1.00:00:00');
  return pointer;
}
function ensurePackagePointerColumns() {
  var dbType = trim(V8.OsClientModel && (V8.OsClientModel.DbType || V8.OsClientModel.OsClientDbType) || 'MySql').toLowerCase();
  var isSqlServer = dbType.indexOf('sqlserver') >= 0 || dbType.indexOf('mssql') >= 0;
  var isOracle = dbType.indexOf('oracle') >= 0;
  var readSql = isOracle
    ? 'SELECT COLUMN_NAME AS "ColumnName" FROM USER_TAB_COLUMNS WHERE TABLE_NAME=UPPER(@p0)'
    : (isSqlServer
      ? 'SELECT COLUMN_NAME AS ColumnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_CATALOG=DB_NAME() AND LOWER(TABLE_NAME)=LOWER(@p0)'
      : 'SELECT COLUMN_NAME AS ColumnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(@p0)');
  var rows = V8.Db.FromSql(readSql).AddInParameter('@p0', 'sys_microistore').ToArray();
  var existing = {};
  for (var i = 0; rows && i < rows.length; i++) {
    var columnName = trim(rows[i].ColumnName || rows[i].COLUMN_NAME || rows[i].column_name).toLowerCase();
    if (columnName) existing[columnName] = true;
  }
  var definitions = [
    ['IsPublic', isOracle ? 'NUMBER(10)' : 'int'],
    ['PackageId', isOracle ? 'VARCHAR2(50)' : 'varchar(50)'],
    ['PackageStorageMode', isOracle ? 'VARCHAR2(50)' : 'varchar(50)'],
    ['PackageHdfsPath', isOracle ? 'VARCHAR2(2000)' : 'varchar(2000)'],
    ['PackageSha256', isOracle ? 'VARCHAR2(100)' : 'varchar(100)'],
    ['PackageSize', isOracle ? 'NUMBER(19)' : 'bigint'],
    ['PackageContentType', isOracle ? 'VARCHAR2(100)' : 'varchar(100)'],
    ['PackageFormatVersion', isOracle ? 'NUMBER(10)' : 'int'],
    ['PackageUploadedAt', isOracle ? 'VARCHAR2(25)' : 'varchar(25)']
  ];
  var pending = [];
  for (var d = 0; d < definitions.length; d++) if (!existing[definitions[d][0].toLowerCase()]) pending.push(definitions[d]);
  if (!pending.length) return [];
  var quoteOpen = isSqlServer ? '[' : (isOracle ? '"' : '`');
  var quoteClose = isSqlServer ? ']' : (isOracle ? '"' : '`');
  if (!isSqlServer && !isOracle) {
    var parts = [];
    for (var p = 0; p < pending.length; p++) {
      parts.push('ADD ' + quoteOpen + pending[p][0] + quoteClose + ' ' + pending[p][1] + ' NULL');
    }
    V8.Db.FromSql('ALTER TABLE `sys_microistore` ' + parts.join(', ')).ExecuteNonQuery();
  } else {
    for (var a = 0; a < pending.length; a++) {
      V8.Db.FromSql('ALTER TABLE ' + quoteOpen + 'sys_microistore' + quoteClose + ' ADD '
        + quoteOpen + pending[a][0] + quoteClose + ' ' + pending[a][1] + ' NULL').ExecuteNonQuery();
    }
  }
  return pending;
}

var invokeType = trim(V8.InvokeType || V8.Param._InvokeType).toLowerCase();
if (invokeType === 'client' || flag(V8.Param.RequireAdmin, false)) {
  if (currentLevel() < 9999) return { Code: 0, Msg: '权限不足：只有超级管理员才能写入应用商城安装包。' };
}

var action = trim(V8.Param.Action || 'Store');
var addedColumns;
try { addedColumns = ensurePackagePointerColumns(); }
catch (schemaError) { return { Code: 0, Msg: '应用商城包指针物理列补齐失败：' + schemaError.message }; }
if (action === 'EnsureSchema') {
  return { Code: 1, Data: { AddedColumns: addedColumns, Count: addedColumns.length }, Msg: '应用商城包指针物理结构已就绪。' };
}
if (action !== 'Store') return { Code: 0, Msg: '不支持的 Action：' + action };

var storeId = trim(V8.Param.StoreId || V8.Param.Id);
// MARKETPLACE_PACKAGE_UTF8_BASE64_TRANSPORT_V1：长中文 JSON 不再直接跨
// V8.ApiEngine.Run 参数边界；调用方先编码为纯 ASCII Base64，本接口严格
// 解码并执行 UTF-8 往返校验，随后把同一组原始字节交给 HDFS。
var packageByteBase64 = trim(V8.Param.PackageByteBase64);
var packageText = '';
if (packageByteBase64) {
  try {
    var packageBytes = System.Convert.FromBase64String(packageByteBase64);
    packageText = String(System.Text.Encoding.UTF8.GetString(packageBytes));
    var roundTripBase64 = String(System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(packageText)));
    if (roundTripBase64 !== packageByteBase64) {
      return { Code: 0, Msg: 'PackageByteBase64 不是可无损往返的规范 UTF-8 Base64。' };
    }
  } catch (decodeError) {
    return { Code: 0, Msg: 'PackageByteBase64 解码失败：' + decodeError.message };
  }
} else {
  // 兼容旧发布器和历史容量治理调用；新调用必须优先使用 Base64 传输。
  packageText = typeof V8.Param.Package === 'string'
    ? V8.Param.Package
    : (typeof V8.Param.PackageJson === 'string' ? V8.Param.PackageJson : JSON.stringify(V8.Param.Package || {}));
}
if (!storeId) return { Code: 0, Msg: 'StoreId 不能为空。' };
if (!packageText || packageText === '{}') return { Code: 0, Msg: 'Package 不能为空。' };

var packageModel = plain(packageText);
if (!packageModel || !packageModel.PackageInfo) return { Code: 0, Msg: 'Package 不是有效的 Microi 应用包。' };
var sourcePackageVersion = trim(V8.Param.AppVersion || V8.Param.PackageVersion || packageModel.PackageInfo.Version);
var isLegacyVersion = !/^v?\d+\.\d+\.\d+$/.test(sourcePackageVersion);
if (isLegacyVersion && !flag(V8.Param.AllowLegacyVersion, false)) {
  return { Code: 0, Msg: '应用包版本必须为 vX.Y.Z。' };
}
// 正常制作/发布继续执行严格 SemVer 门禁。只有管理员容量治理显式传入
// AllowLegacyVersion 才能搬运历史脏版本；原始版本仍保留在包正文和旧快照中，
// HDFS 文件名使用稳定哈希，避免超长/特殊字符污染路径。
var packageVersion = isLegacyVersion
  ? ('legacy-' + sha256(sourcePackageVersion || 'empty').substring(0, 16))
  : sourcePackageVersion;
if (!isLegacyVersion && packageVersion.charAt(0).toLowerCase() !== 'v') packageVersion = 'v' + packageVersion;

var storeResult = V8.FormEngine.GetFormData('sys_microistore', {
  Id: storeId,
  _SelectFields: ['Id', 'AppKey', 'AppId', 'AppVersion', 'IsPublic']
});
if (!storeResult || storeResult.Code !== 1 || !storeResult.Data) return { Code: 0, Msg: '应用商城记录不存在：' + storeId };
var isPublic = flag(V8.Param.IsPublic, flag(storeResult.Data.IsPublic, true));
var isPrivate = !isPublic;
var storageMode = isPublic ? 'HdfsPublic' : 'HdfsPrivate';
var expectedSha = sha256(packageText);
var expectedSize = utf8Size(packageText);
var maxPackageBytes = 256 * 1024 * 1024;
if (expectedSize <= 0 || expectedSize > maxPackageBytes) {
  return { Code: 0, Msg: '应用包大小不合法：' + expectedSize + ' bytes。' };
}
var cacheKey = pointerCacheKey(storeId, storageMode, expectedSha);
if (flag(V8.Param.TrustContentAddressedCache, false)) {
  var cachedPointer = readPointerCache(cacheKey, storageMode, expectedSha, expectedSize);
  if (cachedPointer) {
    return { Code: 1, Data: cachedPointer, DataAppend: { Reused: true, CacheHit: true }, Msg: '已复用内容寻址应用包缓存；安装端仍会独立校验下载字节。' };
  }
}

var existingResult = V8.FormEngine.GetTableData('sys_microistore_package', {
  _Where: [
    ['OsClient', '=', V8.OsClient],
    ['AND', 'StoreId', '=', storeId],
    ['AND', 'Sha256', '=', expectedSha],
    ['AND', 'StorageMode', '=', storageMode],
    ['AND', 'Status', '=', 'Verified'],
    ['AND', 'IsDeleted', '<>', 1]
  ],
  _SelectFields: ['Id', 'StoreId', 'AppVersion', 'StorageMode', 'HdfsPath', 'Sha256', 'Size', 'ContentType', 'FormatVersion', 'Status', 'VerifiedTime', 'CreateTime', 'UpdateTime'],
  _PageIndex: 1,
  _PageSize: 2
});
var existingRows = existingResult && existingResult.Code === 1 ? (existingResult.Data || []) : [];
if (existingRows.length > 1) return { Code: 0, Msg: '同一应用包存在重复内容指针，已停止发布。' };
if (existingRows.length === 1) {
  try {
    verifyStoredText(existingRows[0].HdfsPath, isPrivate, expectedSha, expectedSize);
    return { Code: 1, Data: writePointerCache(cacheKey, existingRows[0]), DataAppend: { Reused: true }, Msg: '已复用并回读校验现有应用包。' };
  } catch (reuseError) {
    V8.Cache.Remove(cacheKey);
    V8.FormEngine.UptFormData('sys_microistore_package', {
      Id: existingRows[0].Id,
      Status: 'Corrupted',
      Remark: '回读校验失败：' + reuseError.message
    });
  }
}

var fileName = safeSegment(storeResult.Data.AppKey || storeResult.Data.AppId || storeId, 'microi-app')
  + '-' + safeSegment(packageVersion, 'v1.0.0') + '-' + expectedSha.substring(0, 16) + '.json';
var uploadParam = {
  OsClient: V8.OsClient,
  Path: 'microi-store/packages/' + safeSegment(storeId, 'store'),
  FileName: fileName,
  Limit: isPrivate,
  Preview: false,
  Multiple: false
};
// MARKETPLACE_PACKAGE_UPLOAD_BASE64_SINGLE_ATTEMPT_V1：UploadText 在真实
// ApiEngine -> HDFS 链路完成非空返回契约和端到端门禁前，不做运行时自动探测，
// 更不能在结果为空/异常后回退重传；因为第一次写入结果未知时，第二次上传可能
// 生成孤儿对象。这里始终只执行一次已经过生产发布验证的 Base64 上传。
var uploadFiles = {};
uploadFiles[fileName] = packageByteBase64 || V8.Base64.StringToBase64(packageText);
var uploadResult = V8.Method.Upload({
  OsClient: uploadParam.OsClient,
  Path: uploadParam.Path,
  Limit: uploadParam.Limit,
  Preview: false,
  Multiple: false,
  FilesByteBase64: uploadFiles
});
if (!uploadResult || uploadResult.Code !== 1) {
  return {
    Code: 0,
    Msg: '应用包上传 HDFS 失败：' + ((uploadResult && uploadResult.Msg) || '上传原子未返回标准结果'),
    DataAppend: {
      UploadMode: packageByteBase64 ? 'Utf8Base64TransportSingleAttempt' : 'LegacyStringBase64SingleAttempt',
      HasResult: !!uploadResult,
      ResultCode: uploadResult && uploadResult.Code !== undefined ? uploadResult.Code : null
    }
  };
}
var hdfsPath = firstPath(uploadResult.Data);
if (!hdfsPath) return { Code: 0, Msg: '应用包上传成功但未返回 HDFS 路径。' };
try { verifyStoredText(hdfsPath, isPrivate, expectedSha, expectedSize); }
catch (verifyError) { return { Code: 0, Msg: verifyError.message }; }

var packageId = V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
var verifiedTime = DateNow('yyyy-MM-dd HH:mm:ss');
var packageRow = {
  Id: packageId,
  OsClient: V8.OsClient,
  StoreId: storeId,
  AppVersion: packageVersion,
  StorageMode: storageMode,
  HdfsPath: hdfsPath,
  Sha256: expectedSha,
  Size: expectedSize,
  ContentType: 'application/json; charset=utf-8',
  FormatVersion: 2,
  Status: 'Verified',
  VerifiedTime: verifiedTime,
  Remark: isLegacyVersion
    ? ('历史非标准版本已按内容安全外置；原版本保留在包正文/历史快照中：' + sourcePackageVersion.substring(0, 100))
    : '内容寻址应用包；数据库只保存指针、哈希与字节数。'
};
var addResult = V8.FormEngine.AddFormData('sys_microistore_package', packageRow);
if (!addResult || addResult.Code !== 1) {
  var concurrent = V8.FormEngine.GetTableData('sys_microistore_package', {
    _Where: [['OsClient', '=', V8.OsClient], ['AND', 'StoreId', '=', storeId], ['AND', 'Sha256', '=', expectedSha], ['AND', 'StorageMode', '=', storageMode], ['AND', 'Status', '=', 'Verified'], ['AND', 'IsDeleted', '<>', 1]],
    _PageIndex: 1,
    _PageSize: 1
  });
  if (!concurrent || concurrent.Code !== 1 || !concurrent.Data || concurrent.Data.length !== 1) {
    return { Code: 0, Msg: '应用包元数据写入失败：' + ((addResult && addResult.Msg) || '接口无返回') };
  }
  verifyStoredText(concurrent.Data[0].HdfsPath, isPrivate, expectedSha, expectedSize);
  return { Code: 1, Data: writePointerCache(cacheKey, concurrent.Data[0]), DataAppend: { Reused: true, Concurrent: true }, Msg: '并发发布已复用相同应用包。' };
}

return {
  Code: 1,
  Data: writePointerCache(cacheKey, packageRow),
  DataAppend: {
    Reused: false,
    InputMode: packageByteBase64 ? 'PackageByteBase64' : 'LegacyPackageString'
  },
  Msg: '应用包已上传 HDFS 并完成字节数与 SHA-256 回读校验。'
};
