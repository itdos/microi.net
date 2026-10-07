/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：ai_app_download_source_zip
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_download_source_zip
 * Version: v1.2.7
 * Function:
 * - 按当前租户和有效拥有者导出活动私有源码，固定源码根、排除历史与运行对象，分页与逐文件字节摘要前后校验。
 */

var runtimeStage = 'Request';

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(reason) { return { Code: 0, Data: null, Reason: reason, Msg: '源码ZIP未生成：活动源码、权限或存储校验未通过，请保留当前源码后重试。' }; }
function text(value, fallback) { return value === null || value === undefined ? (fallback || '') : String(value); }
function isBlank(value) { return text(value).trim() === ''; }
function reject(reason) { throw new Error('SOURCE_ZIP_' + reason); }
function normalizePath(value) {
  var path = text(value);
  if (!path || path !== path.trim() || /[\\:%?#\x00-\x1f]/.test(path)) reject('PATH');
  path = path.replace(/^\/+|\/+$/g, '');
  var parts = path.split('/');
  if (!path || parts.some(function(part) { return !part || part === '.' || part === '..' || /[*"<>|]/.test(part); })) reject('PATH');
  return path;
}
/* SOURCE_ONLY_ZIP_ROOT_V1 */
function buildArchivePath(value) {
  var path = normalizePath(value), lower = path.toLowerCase(), roots = ['unpackage/dist/build/h5/', 'dist/', 'build/'];
  for (var i = 0; i < roots.length; i++) if (lower.indexOf(roots[i]) === 0) return path.substring(roots[i].length);
  return '';
}
function sourceArchivePath(value) {
  var path = normalizePath(value), lower = path.toLowerCase();
  if (!isBlank(buildArchivePath(path)) || /^(upload|node_modules|\.git|unpackage)\//.test(lower)) return '';
  if (lower.indexOf('source/') === 0) path = path.substring(7);
  if (isBlank(path) || !isBlank(buildArchivePath(path)) || /^(upload|node_modules|\.git|unpackage)\//i.test(path)) return '';
  return normalizePath(path);
}
function safeFileName(value) { return text(value, 'ai-app').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80) || 'ai-app'; }
function getApp(appId) {
  runtimeStage = 'AppRead';
  var result = V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['Id', '=', appId]],
    _SelectFields: ['Id', 'Name', 'AppKey', 'OwnerUserId', 'UserId', 'PrivateSourcePath', 'IsDeleted']
  });
  if (!result || Number(result.Code) !== 1 || !result.Data) reject('APPLICATION');
  var app = JSON.parse(JSON.stringify(result.Data));
  if (text(app.Id) !== appId || Number(app.IsDeleted || 0) !== 0) reject('APPLICATION');
  return app;
}
function authorize(app) {
  var session = V8.CurrentUser || {}, uid = text(session.Id);
  if (!uid || session._AccessKeySession === true || session._AccessKeySession === 1 || session._AccessKeySession === 'true') reject('FORBIDDEN');
  runtimeStage = 'AuthRead';
  var result = V8.FormEngine.GetFormData('sys_user', {
    _Where: [['Id', '=', uid]], _SelectFields: ['Id', 'State', 'Level', 'IsDeleted']
  });
  if (!result || Number(result.Code) !== 1 || !result.Data) reject('FORBIDDEN');
  var user = JSON.parse(JSON.stringify(result.Data));
  if (text(user.Id) !== uid || Number(user.State) !== 1 || Number(user.IsDeleted || 0) !== 0) reject('FORBIDDEN');
  if (!(Number(user.Level) >= 9999) && text(app.OwnerUserId || app.UserId) !== uid) reject('FORBIDDEN');
}
function sourceBase(app) {
  var tenant = text(V8.OsClient).toLowerCase();
  if (!/^[a-z0-9_-]{1,100}$/.test(tenant) || isBlank(app.PrivateSourcePath)) reject('BASELINE');
  var base = normalizePath(app.PrivateSourcePath);
  if (/^ai-app-source(?:-staged)?\//.test(base)) base = tenant + '/' + base;
  var parts = base.split('/');
  if (parts[0] !== tenant || !/^ai-app-source(?:-staged)?$/.test(parts[1]) || (parts[2] !== text(app.Id) && parts[2] !== text(app.AppKey))) reject('BASELINE');
  return '/' + base;
}
/* ACTIVE_PRIVATE_SOURCE_BASELINE_V1 */
function getFiles(app) {
  runtimeStage = 'MetadataRead';
  var base = sourceBase(app), configured = text(app.PrivateSourcePath).replace(/\/+$/g, ''), all = [], pageSize = 1000;
  for (var page = 1; page <= 21; page++) {
    var where = [['AppId', '=', app.Id], ['AND', '(', 'VersionId', '=', null], ['OR', 'VersionId', '=', '', ')'], ['StorageScope', '=', 'Private'], ['IsDirectory', '=', 0], ['AND', '(', 'IsDeleted', '=', 0], ['OR', 'IsDeleted', '=', null, ')']];
    if (configured === base) where.push(['HdfsPath', 'StartLike', base + '/']);
    else { where.push(['AND', '(', 'HdfsPath', 'StartLike', base + '/']); where.push(['OR', 'HdfsPath', 'StartLike', configured + '/', ')']); }
    var result = V8.FormEngine.GetTableData('mci_ai_app_file', {
      _Where: where, _SelectFields: ['Id', 'AppId', 'VersionId', 'FilePath', 'HdfsPath', 'StorageScope', 'ContentHash', 'Size', 'IsDirectory', 'IsDeleted'],
      _OrderBy: 'Id', _OrderByType: 'ASC', _PageIndex: page, _PageSize: pageSize
    });
    if (!result || Number(result.Code) !== 1) reject('METADATA');
    var rows = JSON.parse(JSON.stringify(result.Data || []));
    if (!Array.isArray(rows) || rows.length > pageSize) reject('METADATA');
    for (var i = 0; i < rows.length; i++) {
      var file = rows[i];
      if (text(file.AppId) !== text(app.Id) || !isBlank(file.VersionId) || text(file.StorageScope).toLowerCase() !== 'private' || Number(file.IsDirectory) !== 0 || Number(file.IsDeleted || 0) !== 0) reject('METADATA');
      var filePath = normalizePath(file.FilePath), storedPath = normalizePath(file.HdfsPath), path = sourceArchivePath(filePath), size = Number(file.Size), hash = text(file.ContentHash).toLowerCase();
      if (/^ai-app-source(?:-staged)?\//.test(storedPath)) storedPath = text(V8.OsClient).toLowerCase() + '/' + storedPath;
      var stored = '/' + storedPath;
      // 活动目录之外的版本不可替代当前文件；归档名与真实对象后缀也必须一致，避免别名覆盖。
      if (filePath !== text(file.FilePath) || stored !== base + '/' + filePath || !path || !Number.isSafeInteger(size) || size < 0 || size > 268435456 || !/^[a-f0-9]{64}$/.test(hash)) reject('METADATA');
      all.push({ Id: text(file.Id), AppId: text(file.AppId), VersionId: text(file.VersionId), FilePath: text(file.FilePath), Path: path, HdfsPath: stored, StorageScope: text(file.StorageScope), Size: size, ContentHash: hash });
    }
    if (all.length > 20000) reject('LIMIT');
    if (rows.length < pageSize) {
      if (Number(result.DataCount) > all.length) reject('METADATA');
      break;
    }
    if (page === 21) reject('LIMIT');
  }
  all.sort(function(a, b) { return a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0; });
  var seen = Object.create(null), total = 0;
  for (var j = 0; j < all.length; j++) {
    var key = all[j].Path.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(seen, key)) reject('DUPLICATE');
    seen[key] = true; total += all[j].Size;
    if (total > 2147483648) reject('LIMIT');
  }
  // 安装任务逐批切换当前文件行时，旧活动根可能只剩部分清单；根内摘要是完整性承诺。
  // 用原始 FilePath 验证，不能用去掉 source/ 包装目录后的归档路径替代。
  var rootParts = base.substring(1).split('/');
  if (rootParts[1] === 'ai-app-source-staged' && text(rootParts[3]).indexOf('store-') === 0) {
    if (rootParts.length !== 4 || !/^store-[a-f0-9]{64}$/.test(rootParts[3])) reject('METADATA');
    var nativeFiles = all.slice().sort(function(a, b) { return a.FilePath < b.FilePath ? -1 : a.FilePath > b.FilePath ? 1 : 0; });
    var nativeHash = text(V8.EncryptHelper.Sha256Hex(nativeFiles.map(function(file) {
      return file.FilePath + '\t' + file.ContentHash + '\t' + file.Size;
    }).join('\n'))).toLowerCase();
    if (nativeHash !== rootParts[3].substring(6)) reject('METADATA');
  }
  if (!all.length) reject('EMPTY');
  return all;
}
function sourceFingerprint(app, files) { return JSON.stringify({ Id: app.Id, Owner: app.OwnerUserId || app.UserId || '', Base: sourceBase(app), Files: files }); }
function manifestHash(files) {
  return text(V8.EncryptHelper.Sha256Hex(files.map(function(file) { return file.Path + '\t' + file.ContentHash + '\t' + file.Size; }).join('\n'))).toLowerCase();
}
/* RAW_SOURCE_BYTES_SHA256_COMPAT_V1：复用既有编译ZIP的ES5字节算法，不读取对象摘要替代实际返回字节。 */
function sha256Bytes(bytes) {
  // 官方发布端优先使用宿主原生实现，避免大文件在 Jint 中逐轮计算导致网关超时；
  // 旧服务器未暴露该类型时才回退到下方兼容实现。
  var nativeSha;
  try {
    runtimeStage = 'HashFactory';
    nativeSha = System.Security.Cryptography.SHA256.Create();
    runtimeStage = 'HashCompute';
    var nativeDigest = nativeSha.ComputeHash(bytes);
    runtimeStage = 'HashFormat';
    return text(System.BitConverter.ToString(nativeDigest)).replace(/-/g, '').toLowerCase();
  } catch (nativeHashError) {
    // 与既有编译 ZIP 保持相同原始字节口径；CLR 类型未暴露时也不能跳过验证。
    runtimeStage = 'HashFallback';
  } finally {
    try { if (nativeSha && nativeSha.Dispose) nativeSha.Dispose(); } catch (disposeError) {}
  }
  var byteLength = Number(bytes && bytes.Length !== undefined ? bytes.Length : (bytes ? bytes.length : 0));
  var totalLength = Math.floor((byteLength + 72) / 64) * 64;
  var bitLengthHigh = Math.floor(byteLength / 0x20000000) >>> 0;
  var bitLengthLow = (byteLength * 8) >>> 0;
  var constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  var hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var words = new Array(64);
  function rotateRight(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  function paddedByte(index) {
    if (index < byteLength) return Number(bytes[index]) & 255;
    if (index === byteLength) return 0x80;
    if (index < totalLength - 8) return 0;
    var trailerIndex = index - (totalLength - 8);
    if (trailerIndex < 4) return (bitLengthHigh >>> ((3 - trailerIndex) * 8)) & 255;
    return (bitLengthLow >>> ((7 - trailerIndex) * 8)) & 255;
  }
  for (var blockOffset = 0; blockOffset < totalLength; blockOffset += 64) {
    for (var wordIndex = 0; wordIndex < 16; wordIndex++) {
      var byteOffset = blockOffset + wordIndex * 4;
      words[wordIndex] = ((paddedByte(byteOffset) << 24) | (paddedByte(byteOffset + 1) << 16)
        | (paddedByte(byteOffset + 2) << 8) | paddedByte(byteOffset + 3)) | 0;
    }
    for (var expandIndex = 16; expandIndex < 64; expandIndex++) {
      var word15 = words[expandIndex - 15]; var word2 = words[expandIndex - 2];
      var sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      var sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[expandIndex] = (words[expandIndex - 16] + sigma0 + words[expandIndex - 7] + sigma1) | 0;
    }
    var a=hash[0]|0,b=hash[1]|0,c=hash[2]|0,d=hash[3]|0,e=hash[4]|0,f=hash[5]|0,g=hash[6]|0,h=hash[7]|0;
    for (var roundIndex = 0; roundIndex < 64; roundIndex++) {
      var bigSigma1 = rotateRight(e,6) ^ rotateRight(e,11) ^ rotateRight(e,25);
      var choose = (e & f) ^ ((~e) & g);
      var temp1 = (h + bigSigma1 + choose + constants[roundIndex] + words[roundIndex]) | 0;
      var bigSigma0 = rotateRight(a,2) ^ rotateRight(a,13) ^ rotateRight(a,22);
      var majority = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (bigSigma0 + majority) | 0;
      h=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
    }
    hash[0]=(hash[0]+a)|0; hash[1]=(hash[1]+b)|0; hash[2]=(hash[2]+c)|0; hash[3]=(hash[3]+d)|0;
    hash[4]=(hash[4]+e)|0; hash[5]=(hash[5]+f)|0; hash[6]=(hash[6]+g)|0; hash[7]=(hash[7]+h)|0;
  }
  var result = '';
  for (var hashIndex = 0; hashIndex < hash.length; hashIndex++) {
    var hex = (hash[hashIndex] >>> 0).toString(16);
    result += ('00000000' + hex).substring(hex.length);
  }
  return result;
}
function hasZipReader() { return typeof V8.Method.ExtractZip === 'function' || typeof V8.Method.ReadZip === 'function'; }
async function readFileBase64(file, verifySha) {
  // Jint 的 CLR 数组 Copy 会逐字节创建 JS 值；大文本改用既有原子的字符串边界。
  // 只有 UTF8 文本摘要与权威原字节相同时才采用，BOM/换行保持；二进制仍读原字节。
  // 原子存在却读取失败必须关闭，不能以另一条存储路径掩盖失败；最终 ZIP 校验保持不变。
  if (typeof V8.Method.GetPrivateFileText === 'function' && V8.Base64 && typeof V8.Base64.StringToBase64 === 'function') {
    runtimeStage = 'PrivateText';
    var textResult = await V8.Method.GetPrivateFileText({ OsClient: V8.OsClient, FilePathName: file.HdfsPath, Limit: true, MaxBytes: file.Size });
    if (!textResult || Number(textResult.Code) !== 1 || typeof textResult.Data !== 'string') reject('STORAGE');
    runtimeStage = 'TextHash';
    if (text(V8.EncryptHelper.Sha256Hex(textResult.Data)).toLowerCase() === file.ContentHash) {
      runtimeStage = 'Base64';
      var encoded = V8.Base64.StringToBase64(textResult.Data);
      if (typeof encoded !== 'string' || encoded.length !== 4 * Math.ceil(file.Size / 3)) reject('SIZE');
      return encoded;
    }
  }
  runtimeStage = 'PrivateBytes';
  var result = await V8.HDFS.GetPrivateFileByte({ OsClient: V8.OsClient, FilePathName: file.HdfsPath, Limit: true });
  if (!result || Number(result.Code) !== 1 || !result.Data) reject('STORAGE');
  runtimeStage = 'ByteSize';
  var bytes = result.Data, size = Number(bytes.Length !== undefined ? bytes.Length : bytes.length);
  if (size !== file.Size) reject('SIZE');
  if (verifySha && sha256Bytes(bytes) !== file.ContentHash) reject('HASH');
  runtimeStage = 'Base64';
  return System.Convert.ToBase64String(bytes);
}
function verifySnapshot(appId, before) { var app = getApp(appId); authorize(app); if (sourceFingerprint(app, getFiles(app)) !== before) reject('CHANGED'); }
function buildZip(fileName, entries) {
  runtimeStage = 'Zip';
  var result = V8.Method.CreateZip({ Entries: entries, MaxFileCount: 20000, MaxEntryBytes: 268435456, MaxTotalBytes: 2147483648 });
  if (!result || Number(result.Code) !== 1 || !result.Data || isBlank(result.Data.FileByteBase64)) reject('ZIP');
  return ok({ FileName: fileName, ContentType: 'application/zip', FileByteBase64: result.Data.FileByteBase64, Size: result.Data.Size, Sha256: result.Data.Sha256 });
}
function verifyZipBytes(zipped, files, total) {
  runtimeStage = 'ZipVerify';
  var param = { FileByteBase64: zipped.Data.FileByteBase64, MaxFileCount: 20000, MaxEntryBytes: 268435456, MaxTotalBytes: 2147483648, MaxCompressionRatio: 1000 };
  // 原生摘要计算的是将要返回的 ZIP 内实际字节，避免对象另读的竞态及 Jint 大源逐轮哈希成本。
  // 原子已存在却失败时绝不退回另一条路径；缺少原子的旧宿主才在读取阶段逐文件强制验 SHA。
  var result = typeof V8.Method.ExtractZip === 'function' ? V8.Method.ExtractZip(param) : V8.Method.ReadZip(param);
  if (!result || Number(result.Code) !== 1 || !result.Data) reject('ZIPVERIFY');
  var rows = JSON.parse(JSON.stringify(result.Data.Entries || []));
  if (!Array.isArray(rows) || rows.length !== files.length || Number(result.Data.FileCount) !== files.length || Number(result.Data.TotalSize) !== total) reject('ZIPVERIFY');
  var expected = Object.create(null), seen = Object.create(null), actualTotal = 0;
  for (var index = 0; index < files.length; index++) expected[files[index].Path] = files[index];
  for (var item = 0; item < rows.length; item++) {
    var row = rows[item], path = text(row.Path), file = expected[path], key = path.toLowerCase(), size = Number(row.Size);
    if (!file || normalizePath(path) !== path || Object.prototype.hasOwnProperty.call(seen, key) || size !== file.Size || text(row.Sha256).toLowerCase() !== file.ContentHash) reject('ZIPVERIFY');
    seen[key] = true; actualTotal += size;
  }
  if (actualTotal !== total) reject('ZIPVERIFY');
}

try {
  if (V8.Param.OsClient != null && text(V8.Param.OsClient).toLowerCase() !== text(V8.OsClient).toLowerCase()) reject('TENANT');
  if (V8.Param.AppId && V8.Param.ProjectId && text(V8.Param.AppId) !== text(V8.Param.ProjectId)) reject('APPLICATION');
  if (!isBlank(V8.Param.VersionId) || !isBlank(V8.Param.VersionNo)) reject('VERSION');
  var appId = text(V8.Param.AppId || V8.Param.ProjectId);
  if (isBlank(appId)) reject('APPLICATION');
  var app = getApp(appId); authorize(app);
  // 先固定权威活动基线，再验证每份字节；生成 ZIP 前后复读以拒绝撤权与并发替换后的旧快照。
  var files = getFiles(app), before = sourceFingerprint(app, files), entries = [], total = 0, useZipReader = hasZipReader();
  for (var index = 0; index < files.length; index++) { var file = files[index]; entries.push({ Path: file.Path, FileByteBase64: await readFileBase64(file, !useZipReader) }); total += file.Size; }
  verifySnapshot(appId, before);
  var zipped = buildZip(safeFileName(app.Name || appId) + '-source.zip', entries);
  if (useZipReader) verifyZipBytes(zipped, files, total);
  verifySnapshot(appId, before);
  zipped.Data.FileCount = files.length; zipped.Data.TotalSourceSize = total; zipped.Data.SourceManifestHash = manifestHash(files);
  return zipped;
} catch (error) {
  // 不回传异常文本、对象路径或身份；静态阶段只定位现有原子/CLR兼容失败。
  return fail(/^SOURCE_ZIP_[A-Z]+$/.test(text(error && error.message)) ? error.message : 'SOURCE_ZIP_RUNTIME_' + runtimeStage);
}
