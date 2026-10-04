/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：ai_app_download_build_zip
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_download_build_zip
 * Version: v1.3.9
 * Function:
 * - 下载当前已提交完整运行清单的构建ZIP。ApplicationType优先确定运行类型；资产实际raw字节身份、完整运行摘要与版本元数据必须一致，V3权威已提交版本前后守卫，HTTP严格成功且不跟随重定向。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || '执行失败' }; }
function text(value, fallback) { return value === null || value === undefined ? (fallback || '') : String(value); }
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, '') === ''; }
function normalizePath(value) {
  var path = text(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  var parts = path.split('/'); var safe = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i] === '.' || parts[i] === '..') continue;
    safe.push(parts[i].replace(/[:*?"<>|]/g, '_'));
  }
  return safe.join('/');
}
/* REAL_BUILD_ZIP_ASSETS_V1 */
function buildArchivePath(value) {
  var path = normalizePath(value);
  var lower = path.toLowerCase();
  var roots = ['unpackage/dist/build/h5/', 'dist/', 'build/'];
  for (var i = 0; i < roots.length; i++) {
    if (lower.indexOf(roots[i]) === 0) return path.substring(roots[i].length);
  }
  return '';
}
function safeFileName(value) {
  return text(value, 'ai-app').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80) || 'ai-app';
}
function toArray(value) {
  var list = []; if (!value || value.length === undefined) return list;
  for (var i = 0; i < value.length; i++) list.push(value[i]);
  return list;
}
function getApp(appId) {
  return V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['Id', '=', appId]]
  });
}
/* COMPLETED_BUILD_ZIP_MANIFEST_V1: AppType is the store category. Runtime type
 * comes from ApplicationType; current v3 exports bind the authoritative pointer
 * and exact completed version before and after reading immutable asset bytes. */
function runtimeApplicationType(app) {
  var type = text(app.ApplicationType || app.AppType).toLowerCase();
  if (type === 'microservice') return 'MicroService';
  if (type === 'uniapp') return 'UniApp';
  if (type === 'web') return 'Web';
  throw new Error('应用缺少可信运行类型');
}
function completedBuildProof(app) {
  if (isBlank(app.CommittedPublishVersionId) && isBlank(app.CommittedRuntimeManifestHash)
      && isBlank(app.PublishState)) return null;
  if (text(app.PublishState) !== 'Completed' || isBlank(app.CommittedPublishVersionId)
      || !/^[a-f0-9]{64}$/.test(text(app.CommittedRuntimeManifestHash).toLowerCase())) {
    throw new Error('编译ZIP需要当前应用完整的Completed提交指针');
  }
  var r = V8.FormEngine.GetTableData('mci_ai_app_version', {
    _Where: [['Id', '=', app.CommittedPublishVersionId], ['AND', 'AppId', '=', app.Id]],
    _PageIndex: 1, _PageSize: 2
  });
  var rows = r && r.Code === 1 ? toArray(r.Data) : [];
  var version = rows.length === 1 ? rows[0] : null;
  if (!version || text(version.Id) !== text(app.CommittedPublishVersionId)
      || text(version.AppId) !== text(app.Id)
      || text(version.PublishState || version.Status) !== 'Completed'
      || !/^v\d+\.\d+\.\d+$/.test(text(version.VersionNo))
      || text(app.AppVersion) !== text(version.VersionNo)
      || text(version.RuntimeManifestHash).toLowerCase() !== text(app.CommittedRuntimeManifestHash).toLowerCase()
      || !/^[a-f0-9]{64}$/.test(text(version.RequestFingerprint).toLowerCase())) {
    throw new Error('编译ZIP当前应用与精确Completed版本不一致');
  }
  return { VersionId: text(version.Id), VersionNo: text(version.VersionNo),
    RuntimeManifestHash: text(version.RuntimeManifestHash).toLowerCase(),
    RequestFingerprint: text(version.RequestFingerprint), RowVersion: text(version.RowVersion) };
}
function verifiedRuntimeManifest(entries) {
  var lines = [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    // Size/SHA belong to the exact bytes already verified by readAssetBase64.
    if (!/^[a-f0-9]{64}$/.test(text(entry.Sha256).toLowerCase())
        || !Number.isSafeInteger(Number(entry.Size)) || Number(entry.Size) < 0) {
      throw new Error('编译ZIP缺少完整已验资产清单');
    }
    lines.push({ Path: entry.Path, Line: entry.Path + '\t' + text(entry.Sha256).toLowerCase() + '\t' + Number(entry.Size) });
  }
  lines.sort(function(a,b) { return a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0; });
  var textLines = [];
  for (var j = 0; j < lines.length; j++) textLines.push(lines[j].Line);
  var hash = text(V8.EncryptHelper.Sha256Hex(textLines.join('\n'))).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('编译ZIP运行清单摘要不可用');
  return hash;
}
function getFiles(appId) {
  return V8.FormEngine.GetTableData('mci_ai_app_file', {
    _Where: [['AppId', '=', appId]],
    _SelectFields: ['Id','AppId','FilePath','FileName','FileType','HdfsPath','PublishHdfsPath','StorageScope','ContentHash','Size','IsDirectory'],
    _OrderBy: 'FilePath', _OrderByType: 'ASC', _PageSize: 5000
  });
}
function latestVersion(appId, versionNo) {
  var where = [['AppId', '=', appId]];
  if (!isBlank(versionNo)) {
    var vn = text(versionNo); if (vn.charAt(0).toLowerCase() !== 'v') vn = 'v' + vn;
    where.push(['VersionNo', '=', vn]);
  }
  return V8.FormEngine.GetTableData('mci_ai_app_version', {
    _Where: where,
    _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageSize: 1
  });
}
function getMicroService(appKey) {
  return V8.FormEngine.GetFormData('sys_microiservice', {
    _Where: [['MsKey', '=', appKey]], _PageSize: 1
  });
}
function getPublicUrl(filePathName) {
  if (/^https?:\/\//i.test(text(filePathName))) return text(filePathName);
  var result = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient, FilePathName: filePathName, Limit: false
  });
  if (!result || result.Code !== 1) throw new Error('读取公有编译文件失败：' + filePathName);
  var data = result.Data || {};
  return typeof data === 'string' ? data : text(data.Url || data.url || data.FileUrl || data.FullPath || data.Path);
}

/* VERIFIED_RUNTIME_ASSET_BYTES_V1
 * 兼容未向 Jint 暴露 System.Security.Cryptography.SHA256 的服务器，直接对 byte[]
 * 实现 ES5 SHA-256。摘要口径与 v3 运行时清单一致，均为原始文件字节。
 */
function sha256Bytes(bytes) {
  // 官方发布端优先使用宿主原生实现，避免大文件在 Jint 中逐轮计算导致网关超时；
  // 旧服务器未暴露该类型时才回退到下方兼容实现。
  try {
    var nativeSha = System.Security.Cryptography.SHA256.Create();
    var nativeDigest = nativeSha.ComputeHash(bytes);
    return text(System.BitConverter.ToString(nativeDigest)).replace(/-/g, '').toLowerCase();
  } catch (nativeHashError) {}
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
function validateResponseBytes(response, asset, sourceName) {
  var path = text(asset && (asset.Path || asset.RelativePath || asset.FileName));
  if (!response || !response.RawBytes) throw new Error(sourceName + '未返回文件字节：' + path);
  var statusCode = Number(response.StatusCode);
  if (statusCode !== 200) {
    throw new Error(sourceName + '返回 HTTP ' + statusCode + '：' + path);
  }
  /* MANIFEST_BOUND_JSON_ASSET_BYTES_V1
   * 合法编译JSON（包括.vite/manifest.json）不是接口返回信封。只有清单绑定的
   * 完整raw bytes大小与SHA能够证明文件身份；HTTP200错误信封若替换真实文件，
   * 必须在下面的字节校验失败，不能凭缺省Code或应用文件自身的Code字段误判。
   */
  var actualSize = Number(response.RawBytes.Length !== undefined ? response.RawBytes.Length : response.RawBytes.length);
  var expectedSize = Number(asset && asset.Size);
  if (!asset || asset.Size === null || asset.Size === undefined || !Number.isSafeInteger(expectedSize) || expectedSize < 0) {
    throw new Error(sourceName + '文件声明大小无效：' + path);
  }
  if (!Number.isSafeInteger(actualSize) || actualSize < 0 || actualSize !== expectedSize) {
    throw new Error(sourceName + '文件长度不一致：' + path + '，expected=' + expectedSize + '，actual=' + actualSize);
  }
  var expectedSha = text(asset && asset.Sha256).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha)) throw new Error(sourceName + '文件 SHA-256 摘要缺失或无效：' + path);
  var actualSha = sha256Bytes(response.RawBytes);
  if (actualSha !== expectedSha) throw new Error(sourceName + '文件 SHA-256 不一致：' + path);
  return System.Convert.ToBase64String(response.RawBytes);
}
function readAssetBase64(asset) {
  var base64 = text(asset.FileByteBase64 || asset.ContentBase64 || asset.Base64);
  if (!isBlank(base64)) {
    var inlineBytes = System.Convert.FromBase64String(base64);
    return validateResponseBytes({ RawBytes: inlineBytes, StatusCode: 200 }, asset, '内联资产');
  }
  /* STABLE_RUNTIME_ASSET_ROUTE_V1 */
  var stablePath = text(asset.StableFilePathName).replace(/\\/g, '/');
  var safeStablePath = /^\/micro-app\/v3\/tenants\/[a-z0-9_-]+\/kinds\/runtime\/apps\/[a-z0-9_-]+\/assets\//i.test(stablePath)
    && stablePath.indexOf('..') < 0 && stablePath.indexOf('?') < 0 && stablePath.indexOf('#') < 0;
  var apiBase = text(V8.SysConfig && V8.SysConfig.ApiBase).replace(/\/+$/g, '');
  var stableError = '';
  // v3 投影后的公有桶固定路径由 FileServer 直连；旧 v3 resolver 继续兼容。
  var cdnPrefix = '/' + normalizePath(V8.OsClient).toLowerCase() + '/micro-app/'
    + normalizePath(app.AppKey).toLowerCase() + '/';
  var safeCdnPath = stablePath.toLowerCase().indexOf(cdnPrefix) === 0
    && stablePath.indexOf('..') < 0 && stablePath.indexOf('//') < 0
    && stablePath.indexOf('?') < 0 && stablePath.indexOf('#') < 0;
  var fileServer = text(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/g, '');
  if (safeCdnPath && /^https?:\/\//i.test(fileServer)) {
    try {
      return validateResponseBytes(V8.Http.GetResponse({ Url: fileServer + stablePath, Timeout: 180, RequireSsrfProtection: true }), asset, 'CDN 固定地址');
    } catch (cdnError) { stableError = text(cdnError.message); }
  }
  if (safeStablePath && /^https?:\/\//i.test(apiBase)) {
    try {
      return validateResponseBytes(V8.Http.GetResponse({ Url: apiBase + stablePath, Timeout: 180, RequireSsrfProtection: true }), asset, '稳定运行时地址');
    } catch (error) { stableError = text(error.message); }
  }
  var filePathName = text(asset.HdfsPath || asset.PublishHdfsPath || asset.FilePathName || asset.FilePath || asset.FullPath || asset.Url || asset.url);
  if (isBlank(filePathName)) throw new Error('编译文件缺少存储地址：' + text(asset.Path || asset.FileName));
  try {
    var url = getPublicUrl(filePathName);
    if (isBlank(url)) throw new Error('编译文件未返回公开地址：' + filePathName);
    return validateResponseBytes(V8.Http.GetResponse({ Url: url, Timeout: 180, RequireSsrfProtection: true }), asset, 'HDFS地址');
  } catch (hdfsError) {
    throw new Error((stableError ? stableError + '；' : '') + text(hdfsError.message));
  }
}
function buildZip(fileName, entries, manifest) {
  entries.push({ Path: 'microi-app-version.json', Content: JSON.stringify(manifest, null, 2) });
  var result = V8.Method.CreateZip({ Entries: entries, MaxFileCount: 20000, MaxEntryBytes: 268435456, MaxTotalBytes: 2147483648 });
  if (!result || result.Code !== 1 || !result.Data) return result || fail('创建编译ZIP失败');
  return ok({ FileName: fileName, ContentType: 'application/zip', FileByteBase64: result.Data.FileByteBase64, Size: result.Data.Size, Sha256: result.Data.Sha256 });
}

var appId = text(V8.Param.AppId || V8.Param.ProjectId);
if (isBlank(appId)) return fail('AppId不能为空');
var appResult = getApp(appId);
if (!appResult || appResult.Code !== 1 || !appResult.Data) return { Code: 2, Data: null, Msg: 'AI应用不存在' };
var app = appResult.Data;
var applicationType = runtimeApplicationType(app);
var committed = completedBuildProof(app);
var versions = latestVersion(appId, V8.Param.VersionNo || V8.Param.v || '');
var version = versions && versions.Code === 1 && versions.Data && versions.Data.length ? versions.Data[0] : null;
var versionNo = text((version && version.VersionNo) || 'v1.0.0');
if (committed && (!version || text(version.VersionNo) !== committed.VersionNo)) {
  return fail('当前Completed版本与请求版本不一致');
}
var entries = []; var runtime = null; var seenPaths = {};
var verifiedAssets = [];
if (applicationType === 'MicroService') {
  var serviceResult = getMicroService(app.AppKey);
  if (!serviceResult || serviceResult.Code !== 1 || !serviceResult.Data) return fail('未找到微服务编译产物，请先发布微服务');
  runtime = serviceResult.Data; versionNo = text(runtime.BuildVersion || versionNo);
  var assets = [];
  try { assets = JSON.parse(runtime.AssetsJson || '[]'); } catch (e) { return fail('微服务 AssetsJson 不是有效JSON'); }
  assets = toArray(assets);
  for (var i = 0; i < assets.length; i++) {
    var asset = assets[i] || {}; var path = normalizePath(asset.Path || asset.RelativePath || asset.FileName);
    if (!path) continue;
    var pathKey = path.toLowerCase(); if (seenPaths[pathKey]) return fail('微服务编译资产路径重复：' + path);
    seenPaths[pathKey] = true; entries.push({ Path: path, FileByteBase64: readAssetBase64(asset) });
    verifiedAssets.push({ Path: path, Size: Number(asset.Size), Sha256: text(asset.Sha256).toLowerCase() });
  }
} else {
  var compiledFilesResult = getFiles(appId);
  if (!compiledFilesResult || compiledFilesResult.Code !== 1) return compiledFilesResult || fail('读取真实编译文件失败');
  var allCompiledFiles = toArray(compiledFilesResult.Data);
  var currentStreamFiles = [];
  var legacyFiles = [];
  for (var candidateIndex = 0; candidateIndex < allCompiledFiles.length; candidateIndex++) {
    var candidate = allCompiledFiles[candidateIndex] || {};
    var scope = text(candidate.StorageScope);
    if (scope === 'PublicBuildStream' || scope === 'PrivateBuildStream') currentStreamFiles.push(candidate);
    else if (scope === 'PublicBuild' || scope === 'PrivateBuild') legacyFiles.push(candidate);
  }
  // Archived releases and multipart upload sessions are not installable build assets.
  var compiledFiles = currentStreamFiles.length ? currentStreamFiles : legacyFiles;
  for (var compiledIndex = 0; compiledIndex < compiledFiles.length; compiledIndex++) {
    var compiledFile = compiledFiles[compiledIndex] || {};
    if (parseInt(compiledFile.IsDirectory || 0, 10) === 1) continue;
    var buildPath = buildArchivePath(compiledFile.FilePath || compiledFile.FileName);
    if (isBlank(buildPath)) continue;
    if (currentStreamFiles.length) {
      compiledFile.StableFilePathName = text(compiledFile.PublishHdfsPath);
      compiledFile.Sha256 = text(compiledFile.ContentHash).toLowerCase();
    }
    var buildKey = buildPath.toLowerCase(); if (seenPaths[buildKey]) return fail('编译资产路径重复：' + buildPath);
    seenPaths[buildKey] = true; entries.push({ Path: buildPath, FileByteBase64: readAssetBase64(compiledFile) });
    verifiedAssets.push({ Path: buildPath, Size: Number(compiledFile.Size), Sha256: text(compiledFile.Sha256).toLowerCase() });
  }
}
if (!entries.length) return fail('当前应用没有完整真实编译产物，请先运行或发布应用');
if (!seenPaths['index.html']) return fail('真实编译产物缺少根目录 index.html，已停止生成不完整 BuildZip');
var runtimeManifestHash = verifiedRuntimeManifest(verifiedAssets);
if (runtime && (!/^[a-f0-9]{64}$/.test(text(runtime.DistHash).toLowerCase())
    || text(runtime.DistHash).toLowerCase() !== runtimeManifestHash)) {
  return fail('微服务运行清单摘要与实际完整编译文件不一致');
}
if (committed && (versionNo !== committed.VersionNo || runtimeManifestHash !== committed.RuntimeManifestHash)) {
  return fail('编译文件与权威Completed版本清单不一致');
}
var afterApp = getApp(appId);
var afterProof = afterApp && afterApp.Code === 1 && afterApp.Data ? completedBuildProof(afterApp.Data) : null;
if (!afterApp || afterApp.Code !== 1 || !afterApp.Data
    || text(afterApp.Data.Id) !== text(app.Id) || text(afterApp.Data.AppKey) !== text(app.AppKey)
    || runtimeApplicationType(afterApp.Data) !== applicationType
    || JSON.stringify(afterProof) !== JSON.stringify(committed)) {
  return fail('编译ZIP读取期间当前Completed版本发生变化');
}
var manifest = {
  SchemaVersion: 2, AppId: app.Id, AppKey: app.AppKey || '', AppName: app.Name || '', AppType: app.AppType || '',
  VersionNo: versionNo, EntryPath: text((runtime && runtime.EntryPath) || 'index.html'), FileCount: entries.length,
  ApplicationType: applicationType, RuntimeManifestHash: runtimeManifestHash, ExportTime: DateNow('yyyy-MM-dd HH:mm:ss')
};
return buildZip(safeFileName(app.Name || appId) + '-' + versionNo + '-build.zip', entries, manifest);
