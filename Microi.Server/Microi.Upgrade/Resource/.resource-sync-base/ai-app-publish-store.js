/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：ai_app_publish_store
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_publish_store
 * Version: v1.9.25
 * Function:
 * - 统一应用商城发布器；支持不可变发布证明、精确版本更新日志、HDFS 内容寻址包与源码/编译资产边界。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || '执行失败' }; }
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  return String(value);
}
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, '') === ''; }
function trimText(value) { return text(value).replace(/^\s+|\s+$/g, ''); }
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
function boolValue(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  var normalized = text(value).replace(/^\s+|\s+$/g, '').toLowerCase();
  return value === true || value === 1 || ['1', 'true', 'yes', 'on', 'enabled'].indexOf(normalized) >= 0;
}
function readStoredPackage(row) {
  if (!row) return {};
  if (row.AppPakcet) return parseObject(row.AppPakcet, {});
  if (!row.PackageHdfsPath || !row.PackageSha256 || Number(row.PackageSize || 0) < 1) return {};
  var stored = V8.Method.GetPrivateFileText({
    OsClient: V8.OsClient,
    FilePathName: row.PackageHdfsPath,
    Limit: text(row.PackageStorageMode).toLowerCase() === 'hdfsprivate',
    MaxBytes: Math.min(Math.max(Number(row.PackageSize) + 1024, 1024 * 1024), 256 * 1024 * 1024)
  });
  if (!stored || stored.Code !== 1) throw new Error('读取上一版 HDFS 应用包失败：' + ((stored && stored.Msg) || '接口无返回'));
  var packageText = text(stored.Data);
  var actualSize = Number(System.Text.Encoding.UTF8.GetByteCount(packageText));
  var actualSha = text(V8.EncryptHelper.Sha256Hex(packageText)).toLowerCase();
  if (actualSize !== Number(row.PackageSize) || actualSha !== text(row.PackageSha256).toLowerCase()) {
    throw new Error('上一版 HDFS 应用包大小或 SHA-256 回读不一致');
  }
  return parseObject(packageText, {});
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
  var lower = path.toLowerCase();
  // mci_ai_app_file 会保留每次发布形成的 upload/v* 历史上传副本。
  // 它们既不是可编辑源码，也不是当前版本构建资产；打包时必须排除，
  // 否则应用商城包会随历史版本线性膨胀，并在安装端重复还原陈旧文件。
  if (lower.indexOf('upload/') === 0) return '';
  if (lower.indexOf('source/') === 0) return path.substring(7);
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
  // v2 历史版本会在新增字段中标记 LegacyUnverified，但其原始 Status 仍由
  // 完整的资产哈希、稳定别名与运行探针校验后写为 Published。legacy 精确
  // 补包必须读取历史事实字段；v3 则继续只认可 committed PublishState。
  var state = text(versionRow && (protocolV3
    ? versionRow.PublishState
    : (versionRow.Status || versionRow.PublishState)))
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
function resolveDeliveryVersions(options) {
  var values = options || {};
  var exactPublishedVersion = values.ExactPublishedVersion === true;
  var runtimeVersionNo = exactPublishedVersion
    ? normalizeVersion(values.RequestedPublishedVersion)
    : (text(values.AppType) === 'MicroService' && !isBlank(values.RuntimeBuildVersion)
        ? normalizeVersion(values.RuntimeBuildVersion)
        : highestVersion([values.LatestVersion, values.ApplicationVersion]));
  var packageVersionNo = exactPublishedVersion
    ? runtimeVersionNo
    : highestVersion([
        values.RequestedPackageVersion,
        values.PreparedPackageVersion,
        values.ExistingPackageVersion,
        runtimeVersionNo
      ]);
  return {
    RuntimeVersion: runtimeVersionNo,
    PackageVersion: packageVersionNo
  };
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
function currentSourceFiles(rows, activePrefix) {
  var result = [], seen = {};
  var prefix = text(activePrefix).replace(/\\/g, '/').replace(/\/$/, '');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {}, scope = text(row.StorageScope).toLowerCase();
    if (!isBlank(row.VersionId) || Number(row.IsDirectory || 0) === 1 || Number(row.IsDeleted || 0) === 1) continue;
    if (scope && scope !== 'private' && scope !== 'privatesource' && scope !== 'privatesourcestaged') continue;
    var hdfs = text(row.HdfsPath || row.FilePathName).replace(/\\/g, '/');
    if (prefix && hdfs.indexOf(prefix + '/') !== 0) continue;
    var path = sourceArchivePath(row.FilePath || row.FileName);
    if (!path) continue;
    var key = path.toLowerCase();
    if (seen[key]) throw new Error('当前源码存在重复路径，已停止打包：' + path);
    seen[key] = true; result.push(row);
  }
  result.sort(function(a, b) { var left = text(a.FilePath), right = text(b.FilePath); return left < right ? -1 : left > right ? 1 : 0; });
  return result;
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
function sha256RuntimeAssetBytes(bytes) {
  try {
    var nativeSha = System.Security.Cryptography.SHA256.Create();
    var nativeDigest = nativeSha.ComputeHash(bytes);
    var nativeResult = text(System.BitConverter.ToString(nativeDigest)).replace(/-/g, '').toLowerCase();
    try { nativeSha.Dispose(); } catch (disposeError) {}
    return nativeResult;
  } catch (nativeHashError) {}
  // Some installed servers intentionally do not expose cryptography CLR types
  // to Jint. Keep byte-level verification mandatory with an ES5 implementation
  // instead of weakening a manifest SHA-256 to a same-length check.
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
function runtimeAssetBase64MatchesManifest(runtimeAsset, base64) {
  if (isBlank(base64)) return false;
  var bytes;
  try { bytes = System.Convert.FromBase64String(base64); }
  catch (decodeError) { return false; }
  var byteLength = Number(bytes && bytes.Length !== undefined ? bytes.Length : (bytes ? bytes.length : 0));
  var expectedSize = Number(runtimeAsset && runtimeAsset.Size || 0);
  if (expectedSize > 0 && byteLength !== expectedSize) return false;
  var expectedSha = text(runtimeAsset && (runtimeAsset.Sha256 || runtimeAsset.Hash)).toLowerCase();
  if (isBlank(expectedSha)) return byteLength > 0;
  return sha256RuntimeAssetBytes(bytes) === expectedSha;
}
function stableApiOrigin(value) {
  var match = /^(https?:\/\/[^\/?#]+)/i.exec(text(value).replace(/^\s+|\s+$/g, ''));
  return match ? match[1] : '';
}
function readRuntimeAssetBase64(runtimeAsset, path) {
  var hdfsPath = text(runtimeAsset && (runtimeAsset.FilePathName || runtimeAsset.HdfsPath || runtimeAsset.PathName));
  if (!isBlank(hdfsPath)) {
    try {
      var authoritativeBase64 = readFileBase64(hdfsPath, isTextFile(path), false);
      if (runtimeAssetBase64MatchesManifest(runtimeAsset, authoritativeBase64)) return authoritativeBase64;
    } catch (authoritativeReadError) {
      // Keep the immutable stable resolver as a bounded compatibility fallback
      // for legacy runtimes whose original object path is no longer readable.
    }
  }
  var stablePath = text(runtimeAsset && runtimeAsset.StableFilePathName);
  var normalizedStablePath = stablePath.replace(/\\/g, '/');
  var safeStablePath = /^\/micro-app\/v3\/tenants\/[a-z0-9_-]+\/kinds\/runtime\/apps\/[a-z0-9_-]+\/assets\//i.test(normalizedStablePath)
    && normalizedStablePath.indexOf('..') < 0
    && normalizedStablePath.indexOf('?') < 0
    && normalizedStablePath.indexOf('#') < 0;
  // ApiBase deployments may be configured either as an origin or with an
  // /api suffix. Stable micro-app routes always live at the trusted origin.
  var apiOrigin = stableApiOrigin(V8.SysConfig && V8.SysConfig.ApiBase);
  if (safeStablePath && !isBlank(apiOrigin)) {
    try {
      var stableResponse = V8.Http.GetResponse({
        Url: apiOrigin + normalizedStablePath,
        Timeout: 120
      });
      // V8.Http may expose transport RawBytes before the HTTP bridge has applied
      // content decoding. For text assets the decoded Content is authoritative;
      // otherwise a valid HTML entry can be mistaken for compressed or
      // gateway-framed bytes and DatabaseOnlyBuild fails its document check.
      if (isTextFile(path) && stableResponse && !isBlank(stableResponse.Content)) {
        var decodedContentBase64 = V8.Base64.StringToBase64(text(stableResponse.Content));
        if (runtimeAssetBase64MatchesManifest(runtimeAsset, decodedContentBase64)) return decodedContentBase64;
      }
      if (stableResponse && stableResponse.RawBytes) {
        try {
          var stableRawBase64 = System.Convert.ToBase64String(stableResponse.RawBytes);
          if (runtimeAssetBase64MatchesManifest(runtimeAsset, stableRawBase64)) return stableRawBase64;
        } catch (stableRawError) {}
      }
    } catch (stableReadError) {
      // 稳定地址暂不可用时继续走租户 HDFS 原子能力，不能因一次网络抖动中断制包。
    }
  }
  throw new Error('运行资产读取结果与已提交清单不一致：' + normalizePath(path));
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
function hydrateCommittedRuntimeAssets(app, runtime, committedProof, expectedVersion) {
  if (!runtime || !runtime.Service) throw new Error('协议 v3 缺少已提交微服务元数据快照');
  if (!isBlank(runtime.Service.AssetsJson)) return runtime;
  var liveRuntime = getMicroService(text(app && (app.AppKey || app.AppId)));
  var liveService = liveRuntime && liveRuntime.Service;
  if (!liveService || isBlank(liveService.AssetsJson) || isBlank(liveService.AssetManifestJson)) {
    throw new Error('协议 v3 当前已提交运行指针缺少资产清单');
  }
  var manifest = parseObject(liveService.AssetManifestJson, {});
  var proof = committedProof || {};
  var requestedVersion = normalizeExactVersion(expectedVersion);
  var liveVersion = normalizeExactVersion(liveService.BuildVersion);
  if (isBlank(requestedVersion) || liveVersion !== requestedVersion) {
    throw new Error('协议 v3 当前运行版本与发布请求不一致');
  }
  if (text(manifest.CommittedPublishVersionId) !== text(proof.VersionId)
      || text(manifest.RuntimeManifestHash).toLowerCase() !== text(proof.RuntimeManifestHash).toLowerCase()
      || text(manifest.PublishFence) !== text(proof.PublishFence)
      || text(manifest.RequestFingerprint).toLowerCase() !== text(proof.RequestFingerprint).toLowerCase()) {
    throw new Error('协议 v3 当前运行资产清单与 CommittedProof 不一致');
  }
  var snapshotRouteHash = text(runtime.Service.RouteSnapshotHash || V8.Param.RouteSnapshotHash).toLowerCase();
  if (!isBlank(snapshotRouteHash)
      && text(manifest.RouteSnapshotHash).toLowerCase() !== snapshotRouteHash) {
    throw new Error('协议 v3 当前运行资产路由摘要与提交快照不一致');
  }
  var hydratedService = {};
  for (var key in runtime.Service) hydratedService[key] = runtime.Service[key];
  hydratedService.AssetsJson = liveService.AssetsJson;
  hydratedService.AssetManifestJson = liveService.AssetManifestJson;
  hydratedService.AssetCount = liveService.AssetCount;
  hydratedService.TotalSize = liveService.TotalSize;
  return { Service: hydratedService, Pages: runtime.Pages };
}
function getApplicationInfrastructure() {
  var tableNames = ['sys_microistore', 'sys_microistore_changelog', 'mci_ai_app_file', 'mci_ai_app_version', 'sys_microiservice', 'sys_microiservice_page'];
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
    { TableName: 'sys_microistore_changelog', DDL: "CREATE TABLE IF NOT EXISTS `sys_microistore_changelog` (`Id` varchar(36) NOT NULL PRIMARY KEY,`CreateTime` datetime NULL,`UpdateTime` datetime NULL,`UserId` varchar(36) NULL,`UserName` varchar(255) NULL,`IsDeleted` int NULL DEFAULT 0,`OsClient` varchar(50) NOT NULL,`StoreId` varchar(50) NOT NULL,`Version` varchar(50) NOT NULL,`Title` varchar(200) NOT NULL,`ChangeType` varchar(50) NOT NULL DEFAULT 'Feature',`Content` mediumtext NOT NULL,`ReleaseTime` varchar(25) NOT NULL,`Sort` int NULL DEFAULT 100,UNIQUE KEY `ux_microistore_changelog_store_version` (`OsClient`,`StoreId`,`Version`),KEY `ix_microistore_changelog_store_release` (`OsClient`,`StoreId`,`ReleaseTime`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" },
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
      var inlineBase64 = text(runtimeAsset.ContentBase64 || runtimeAsset.FileByteBase64 || runtimeAsset.Base64);
      assets.push({
        Path: path,
        FileName: runtimeAsset.FileName || path.substring(path.lastIndexOf('/') + 1),
        ContentType: runtimeAsset.ContentType || '',
        FileByteBase64: inlineBase64 || readRuntimeAssetBase64(runtimeAsset, path),
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
function marketplaceIdentityReadbackMatches(row, expectedAppId, expectedAppKey) {
  return !!row
    && trimText(row.AppId) === trimText(expectedAppId)
    && trimText(row.AppKey) === trimText(expectedAppKey);
}
/* MARKETPLACE_CHANGELOG_REQUIRED_V1：制包与发布都必须绑定当前商城版本的一条完整日志。 */
/* MARKETPLACE_CHANGELOG_LEGACY_TENANT_V1：唯一的历史空租户日志可预检，且只在正式发布时回填。 */
function requireMarketplaceChangeLog(storeId, versionValue, repairLegacyTenant) {
  var version = normalizeExactVersion(versionValue);
  if (isBlank(storeId) || isBlank(version)) {
    return fail('请先保存商城应用，并提供合法的精确 AppVersion（例如 v1.2.3）。');
  }
  var result = V8.FormEngine.GetFormData('sys_microistore_changelog', {
    _Where: [['OsClient', '=', V8.OsClient], ['AND', 'StoreId', '=', storeId], ['AND', 'Version', '=', version]],
    _SelectFields: ['Id', 'OsClient', 'StoreId', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort', 'IsDeleted']
  });
  var row = result && result.Code === 1 ? result.Data : null;
  if (!row) {
    var legacyRows = [];
    var legacyIds = {};
    var legacyTenantValues = [null, ''];
    for (var legacyIndex = 0; legacyIndex < legacyTenantValues.length; legacyIndex++) {
      var legacyResult = V8.FormEngine.GetTableData('sys_microistore_changelog', {
        _Where: [['StoreId', '=', storeId], ['AND', 'Version', '=', version], ['AND', 'OsClient', '=', legacyTenantValues[legacyIndex]]],
        _SelectFields: ['Id', 'OsClient', 'StoreId', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort', 'IsDeleted'],
        _PageIndex: 1,
        _PageSize: 2
      });
      var candidates = legacyResult && legacyResult.Code === 1 ? toArray(legacyResult.Data) : [];
      for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
        var candidate = candidates[candidateIndex];
        var candidateId = text(candidate && candidate.Id);
        if (!candidate || !isBlank(candidate.OsClient) || isBlank(candidateId) || legacyIds[candidateId]) continue;
        legacyIds[candidateId] = true;
        legacyRows.push(candidate);
      }
    }
    if (legacyRows.length > 1) {
      return fail('应用 ' + version + ' 存在多条历史空租户更新日志，无法安全自动修复。');
    }
    if (legacyRows.length === 1) {
      row = legacyRows[0];
      if (repairLegacyTenant === true) {
        var repairResult = V8.FormEngine.UptFormData('sys_microistore_changelog', {
          Id: row.Id,
          OsClient: V8.OsClient
        });
        if (!repairResult || repairResult.Code !== 1) {
          return fail('更新日志历史租户字段回填失败：' + ((repairResult && repairResult.Msg) || '接口无返回'));
        }
        var repairedReadback = V8.FormEngine.GetFormData('sys_microistore_changelog', {
          _Where: [['OsClient', '=', V8.OsClient], ['AND', 'Id', '=', row.Id], ['AND', 'StoreId', '=', storeId], ['AND', 'Version', '=', version]],
          _SelectFields: ['Id', 'OsClient', 'StoreId', 'Version', 'Title', 'ChangeType', 'Content', 'ReleaseTime', 'Sort', 'IsDeleted']
        });
        row = repairedReadback && repairedReadback.Code === 1 ? repairedReadback.Data : null;
        if (!row || text(row.OsClient) !== text(V8.OsClient)) {
          return fail('更新日志历史租户字段回读失败。');
        }
      }
    }
  }
  if (!row || row.IsDeleted === 1 || row.IsDeleted === true
      || isBlank(row.Title) || isBlank(row.ChangeType) || isBlank(row.Content) || isBlank(row.ReleaseTime)) {
    return fail('应用 ' + version + ' 缺少完整更新日志。请先在商城应用的【更新日志】页签补齐标题、类型、内容和发布时间。');
  }
  return ok(row, '更新日志校验通过');
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
var RESOURCE_SNAPSHOT_SCHEMA = 'Microi.ApplicationResourceSnapshot';
var RESOURCE_SNAPSHOT_SCHEMA_VERSION = 1;

/*
 * 资源快照允许业务数据中的有限小数，但仍拒绝非 JSON 数值和超出
 * JavaScript safe integer 边界的数值。对象键在所有层级按字典序输出。
 */
function canonicalResourceJson(value) {
  if (value === null) return 'null';
  if (value && typeof value.length === 'number' && typeof value !== 'string') {
    var arrayParts = [];
    for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
      arrayParts.push(canonicalResourceJson(value[arrayIndex]));
    }
    return '[' + arrayParts.join(',') + ']';
  }
  if (typeof value === 'object') {
    var objectKeys = Object.keys(value).sort();
    var objectParts = [];
    for (var objectIndex = 0; objectIndex < objectKeys.length; objectIndex++) {
      var objectKey = objectKeys[objectIndex];
      if (value[objectKey] === undefined || typeof value[objectKey] === 'function') {
        throw new Error('资源快照不能包含 undefined/function：' + objectKey);
      }
      objectParts.push(JSON.stringify(objectKey) + ':' + canonicalResourceJson(value[objectKey]));
    }
    return '{' + objectParts.join(',') + '}';
  }
  if (typeof value === 'number'
      && (!isFinite(value) || Math.abs(value) > 9007199254740991)) {
    throw new Error('资源快照 number 只允许有限 safe number');
  }
  var primitive = JSON.stringify(value);
  if (primitive === undefined) throw new Error('资源快照包含非 JSON 值');
  return primitive;
}

/* 每个资源行先做对象键规范化，再按整行 canonical JSON 稳定排序。 */
function sortCanonicalResourceArray(value) {
  var rows = toArray(value);
  var entries = [];
  for (var i = 0; i < rows.length; i++) {
    var rowJson = canonicalResourceJson(rows[i]);
    entries.push({ Json: rowJson, Value: JSON.parse(rowJson) });
  }
  entries.sort(function (left, right) {
    if (left.Json < right.Json) return -1;
    if (left.Json > right.Json) return 1;
    return 0;
  });
  var result = [];
  for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    result.push(entries[entryIndex].Value);
  }
  return result;
}

/* DataSets 是二层资源：数据集与其 Rows 都必须消除数据库返回顺序差异。 */
function normalizeSnapshotDataSets(value) {
  var rows = toArray(value);
  var normalized = [];
  for (var i = 0; i < rows.length; i++) {
    var dataSetJson = canonicalResourceJson(rows[i] || {});
    var dataSet = JSON.parse(dataSetJson);
    if (dataSet.Rows !== undefined && dataSet.Rows !== null) {
      dataSet.Rows = sortCanonicalResourceArray(dataSet.Rows);
    }
    normalized.push(dataSet);
  }
  return sortCanonicalResourceArray(normalized);
}

/* MenuContract 保留全部字段，仅对其集合型菜单数组做稳定排序。 */
function normalizeSnapshotMenuContract(value) {
  if (!value) return null;
  var normalized = JSON.parse(canonicalResourceJson(value));
  if (normalized.MenuIds !== undefined && normalized.MenuIds !== null) {
    normalized.MenuIds = sortCanonicalResourceArray(normalized.MenuIds);
  }
  if (normalized.Menus !== undefined && normalized.Menus !== null) {
    normalized.Menus = sortCanonicalResourceArray(normalized.Menus);
  }
  return normalized;
}

/*
 * RESOURCE_SNAPSHOT_SCHEMA_V1
 * 快照只包含会影响应用安装资源的稳定事实；不包含时间、用户或资产地址。
 * SysApiEngines 保留导出行全部字段，包括完整 ApiV8Code。
 */
function buildResourceSnapshot(appKey, appVersion, menuContract, resources, resourcePolicies) {
  var normalizedAppKey = text(appKey).replace(/^\s+|\s+$/g, '');
  var normalizedAppVersion = normalizeExactVersion(appVersion);
  if (isBlank(normalizedAppKey)) throw new Error('资源快照 AppKey 不能为空');
  if (isBlank(normalizedAppVersion)) throw new Error('资源快照 AppVersion 必须是精确语义版本');
  var source = resources || {};
  return {
    Schema: RESOURCE_SNAPSHOT_SCHEMA,
    SchemaVersion: RESOURCE_SNAPSHOT_SCHEMA_VERSION,
    AppKey: normalizedAppKey,
    AppVersion: normalizedAppVersion,
    MenuContract: normalizeSnapshotMenuContract(menuContract),
    Resources: {
      DDLStatements: sortCanonicalResourceArray(source.DDLStatements),
      PhysicalColumns: sortCanonicalResourceArray(source.PhysicalColumns),
      DiyTables: sortCanonicalResourceArray(source.DiyTables),
      DiyFields: sortCanonicalResourceArray(source.DiyFields),
      DataSets: normalizeSnapshotDataSets(source.DataSets),
      SysMenus: sortCanonicalResourceArray(source.SysMenus),
      WfFlowDesigns: sortCanonicalResourceArray(source.WfFlowDesigns),
      WfNodes: sortCanonicalResourceArray(source.WfNodes),
      WfLines: sortCanonicalResourceArray(source.WfLines),
      SysApiEngines: sortCanonicalResourceArray(source.SysApiEngines),
      ScheduleJobs: sortCanonicalResourceArray(source.ScheduleJobs)
    },
    ResourcePolicies: resourcePolicies
      ? JSON.parse(canonicalResourceJson(resourcePolicies))
      : null
  };
}

/*
 * RESOURCE_SNAPSHOT_PERSISTED_JSON_V1
 * V8/Jint 可能把 .NET 对象暴露成带 length 的宿主对象，Date 等值在宿主形态下
 * 也不同于最终包体。资源快照必须先经过与 HDFS 写包完全相同的 JSON 往返，
 * 再做 canonical/sort/hash，确保服务端回执以最终持久化 JSON 为唯一事实源。
 */
function persistedJsonValue(value, label) {
  var serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error((label || '资源') + '无法序列化为 JSON');
  }
  return JSON.parse(serialized);
}

function createResourceSnapshotReceipt(appKey, appVersion, menuContract, resources, resourcePolicies) {
  var persistedResources = persistedJsonValue(resources || {}, '应用安装资源');
  var packageAssets = persistedResources.ApplicationBundle
    && persistedResources.ApplicationBundle.PackageAssets
      ? persistedResources.ApplicationBundle.PackageAssets
      : null;
  var persistedMenuContract = packageAssets && packageAssets.MenuContract !== undefined
    ? packageAssets.MenuContract
    : persistedJsonValue(menuContract || null, '菜单合同');
  var persistedPolicies = persistedResources.ResourcePolicies !== undefined
    ? persistedResources.ResourcePolicies
    : persistedJsonValue(resourcePolicies || null, '资源策略');
  var snapshot = buildResourceSnapshot(
    appKey,
    appVersion,
    persistedMenuContract,
    persistedResources,
    persistedPolicies
  );
  var canonical = canonicalResourceJson(snapshot);
  return {
    ResourceSnapshotSchema: RESOURCE_SNAPSHOT_SCHEMA,
    ResourceSnapshotSchemaVersion: RESOURCE_SNAPSHOT_SCHEMA_VERSION,
    ResourceSnapshot: JSON.parse(canonical),
    ResourceSnapshotCanonicalJson: canonical,
    ResourceSnapshotHash: sha256Hex(canonical)
  };
}

function readExpectedResourceSnapshotHash(value) {
  var hash = text(value).replace(/^\s+|\s+$/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error('ProtocolVersion=3 Publish 必须提供有效 ExpectedResourceSnapshotHash');
  }
  return hash;
}

function resourceSnapshotCasCapability() {
  return {
    supported: true,
    protocolVersion: 1,
    hashAlgorithm: 'SHA256',
    inspectAction: 'InspectResourceSnapshot',
    publishExpectedHashField: 'ExpectedResourceSnapshotHash',
    receiptHashField: 'ResourceSnapshotHash'
  };
}

/*
 * RESOURCE_SNAPSHOT_CAS_V1
 * Inspect 只返回同一事务中导出的完整资源快照；Publish 必须回传完全相同的
 * SHA-256。任何资源、菜单合同或 ResourcePolicies 漂移都在 HDFS 写包前失败。
 */
function enforceResourceSnapshotCas(action, protocolV3, expectedHashValue, receipt) {
  if (!protocolV3) return ok({ ShouldPublish: action === 'Publish' });
  if (!receipt || !/^[a-f0-9]{64}$/.test(text(receipt.ResourceSnapshotHash).toLowerCase())) {
    return fail('ProtocolVersion=3 资源快照回执不合法');
  }
  if (action === 'InspectResourceSnapshot') {
    return ok({
      ShouldPublish: false,
      ResourceSnapshotCasCapability: resourceSnapshotCasCapability(),
      ResourceSnapshotSchema: receipt.ResourceSnapshotSchema,
      ResourceSnapshotSchemaVersion: receipt.ResourceSnapshotSchemaVersion,
      ResourceSnapshot: receipt.ResourceSnapshot,
      ResourceSnapshotCanonicalJson: receipt.ResourceSnapshotCanonicalJson,
      ResourceSnapshotHash: receipt.ResourceSnapshotHash
    });
  }
  if (action !== 'Publish') return fail('ProtocolVersion=3 资源快照 CAS 不支持 Action=' + action);
  var expectedHash = '';
  try { expectedHash = readExpectedResourceSnapshotHash(expectedHashValue); }
  catch (expectedError) { return fail(expectedError.message); }
  if (expectedHash !== text(receipt.ResourceSnapshotHash).toLowerCase()) {
    return fail('资源快照已漂移，禁止写入安装包', {
      ExpectedResourceSnapshotHash: expectedHash,
      ActualResourceSnapshotHash: text(receipt.ResourceSnapshotHash).toLowerCase()
    });
  }
  return ok({
    ShouldPublish: true,
    ResourceSnapshotCasCapability: resourceSnapshotCasCapability(),
    ResourceSnapshotHash: receipt.ResourceSnapshotHash
  });
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
function normalizeApiEngineKeys(values) {
  var source = parseArray(values);
  var result = [];
  var seen = {};
  for (var i = 0; i < source.length; i++) {
    var item = source[i] || {};
    var key = text(typeof item === 'string'
      ? item
      : (item.ApiEngineKey || item.Key || item.Value)).trim();
    var normalized = key.toLowerCase();
    if (!normalized || seen[normalized]) continue;
    seen[normalized] = true;
    result.push(key);
  }
  return result;
}
function validateOfficialPlatformApiEngineSelection(
  resolvedKeys,
  explicitSelection,
  existingStore,
  publicationContext,
  confirmedRemovalKeys
) {
  var publication = publicationContext || {};
  var publisherType = text(publication.PublisherType);
  var isOfficialPlatform = text(publication.ApplicationType).toLowerCase() === 'platform'
    && (publisherType === '官方应用' || publisherType === '平台应用');
  if (!isOfficialPlatform || !existingStore) return ok({ RemovedApiEngineKeys: [] });

  var previousPackage = readStoredPackage(existingStore);
  var previousKeys = normalizeApiEngineKeys(previousPackage.SysApiEngines);
  if (previousKeys.length === 0) return ok({ RemovedApiEngineKeys: [] });

  var selectedKeys = normalizeApiEngineKeys(resolvedKeys);
  var selected = {};
  for (var selectedIndex = 0; selectedIndex < selectedKeys.length; selectedIndex++) {
    selected[selectedKeys[selectedIndex].toLowerCase()] = true;
  }
  var removed = [];
  for (var previousIndex = 0; previousIndex < previousKeys.length; previousIndex++) {
    var previousKey = previousKeys[previousIndex];
    if (!selected[previousKey.toLowerCase()]) removed.push(previousKey);
  }
  if (removed.length === 0) return ok({ RemovedApiEngineKeys: [] });

  if (!explicitSelection) {
    return fail(
      '官方 Platform 应用的 SelectApiEngine 不完整，缺少上一版不可变包接口：'
      + removed.join(', ')
      + '。请先修复商城资源选择，禁止从退化持久选择重发。'
    );
  }

  var confirmed = normalizeApiEngineKeys(confirmedRemovalKeys)
    .map(function (key) { return key.toLowerCase(); })
    .sort();
  var expected = removed
    .map(function (key) { return key.toLowerCase(); })
    .sort();
  if (JSON.stringify(confirmed) !== JSON.stringify(expected)) {
    return fail(
      '官方 Platform 应用移除接口必须显式传 ApiEngineRemovalKeys，且与上一版移除集合完全一致：'
      + removed.join(', ')
    );
  }
  return ok({ RemovedApiEngineKeys: removed });
}
function normalizeSha256Hashes(value) {
  var source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source || '[]'); }
    catch (error) { source = text(source).split(','); }
  }
  source = toArray(source);
  var result = [];
  var seen = {};
  for (var i = 0; i < source.length; i++) {
    var hash = text(source[i]).trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash) || seen[hash]) continue;
    seen[hash] = true;
    result.push(hash);
  }
  return result;
}
function buildApiEngineResourcePolicies(engines, requestedPolicies, existingStore, publicationContext) {
  var rows = toArray(engines);
  if (rows.length === 0) return null;
  var requestedRoot = parseObject(requestedPolicies, {});
  var requested = parseObject(requestedRoot.ApiEngines || requestedRoot, {});
  var previousPackage = readStoredPackage(existingStore);
  var previousEngines = apiEngineMap(previousPackage.SysApiEngines);
  var previousRoot = parseObject(previousPackage.ResourcePolicies, {});
  var previousPolicies = parseObject(previousRoot.ApiEngines, {});
  // OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1: official Platform packages publish
  // shared managed engines as platform-owned resources. Explicit caller ownership
  // remains authoritative, and tenant hooks stay CreateIfMissing/Tenant.
  var publication = publicationContext || {};
  var platformPublisherType = text(publication.PublisherType);
  var officialPlatformPublication = text(publication.ApplicationType).toLowerCase() === 'platform'
    && (platformPublisherType === '官方应用' || platformPublisherType === '平台应用');
  var result = { SchemaVersion: 1, ApiEngines: {} };

  for (var i = 0; i < rows.length; i++) {
    var engine = rows[i] || {};
    var originalKey = text(engine.ApiEngineKey);
    var key = originalKey.toLowerCase();
    if (!key) continue;
    var requestedSource = requested[key] || requested[originalKey] || null;
    var previousPolicy = previousPolicies[key] || previousPolicies[originalKey] || {};
    var source = requestedSource
      || previousPolicy;
    if (typeof source === 'string') source = { UpgradePolicy: source };
    var policy = text(source.UpgradePolicy || source.Policy || 'Managed');
    if (policy !== 'Managed' && policy !== 'CreateIfMissing') {
      throw new Error('接口引擎资源策略不受支持：' + originalKey + ' -> ' + policy);
    }
    var requestedOwnership = requestedSource && typeof requestedSource === 'object'
      ? text(requestedSource.Ownership)
      : '';
    var ownership = text(source.Ownership || (policy === 'CreateIfMissing' ? 'Tenant' : 'Application'));
    if (policy === 'Managed' && officialPlatformPublication && !requestedOwnership) ownership = 'Platform';
    var entry = {
      Ownership: ownership,
      UpgradePolicy: policy
    };
    if (policy === 'Managed') {
      var previousEngine = previousEngines[key];
      var baseHash = previousEngine
        ? sha256Hex(text(previousEngine.ApiV8Code))
        : text(source.BaseHash).toLowerCase();
      if (baseHash) entry.BaseHash = baseHash;
      var compatibleBaseHashes = normalizeSha256Hashes(
        source.CompatibleBaseHashes || source.LegacyBaseHashes || []
      );
      var previousCompatibleHashes = normalizeSha256Hashes(
        previousPolicy.CompatibleBaseHashes || previousPolicy.LegacyBaseHashes || []
      );
      var compatibilityCandidates = compatibleBaseHashes.concat(previousCompatibleHashes, [
        text(source.BaseHash).toLowerCase(),
        text(previousPolicy.BaseHash).toLowerCase()
      ]);
      compatibleBaseHashes = normalizeSha256Hashes(compatibilityCandidates);
      var filteredCompatibleHashes = [];
      for (var compatibleIndex = 0; compatibleIndex < compatibleBaseHashes.length; compatibleIndex++) {
        if (compatibleBaseHashes[compatibleIndex] !== baseHash) filteredCompatibleHashes.push(compatibleBaseHashes[compatibleIndex]);
      }
      if (filteredCompatibleHashes.length) entry.CompatibleBaseHashes = filteredCompatibleHashes;
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

/*
 * EXACT_MENU_PORTABLE_CLOSURE_V1
 * 精确菜单包必须能独立安装到其他租户。源租户中的业务根菜单通常挂在一个未随包
 * 导出的总目录下；合同将该业务根声明为根节点时，只清空这个包外 ParentId。
 * 包内父子关系及菜单名称/表绑定仍必须逐项匹配，禁止用“归一化”掩盖漂移。
 */
function normalizeExactExportedMenuClosure(value, menuContract, exactMenuIds) {
  var menus = toArray(persistedJsonValue(value || [], '精确菜单导出'));
  if (!exactMenuIds || !menuContract) return menus;

  var contractMenus = toArray(persistedJsonValue(menuContract.Menus || [], '精确菜单合同'));
  if (menus.length !== contractMenus.length) {
    throw new Error('精确菜单导出数量与 MenuContract 不一致');
  }

  var selectedIdMap = {};
  var expectedById = {};
  var seen = {};
  for (var contractIndex = 0; contractIndex < contractMenus.length; contractIndex++) {
    var expected = contractMenus[contractIndex] || {};
    var expectedId = text(expected.Id || expected.MenuId || expected.Value).replace(/^\s+|\s+$/g, '');
    var expectedKey = expectedId.toLowerCase();
    if (isBlank(expectedId)) throw new Error('MenuContract.Menus[' + contractIndex + '].Id 不能为空');
    if (expectedById[expectedKey]) throw new Error('MenuContract 包含重复菜单 Id：' + expectedId);
    expectedById[expectedKey] = expected;
    selectedIdMap[expectedKey] = true;
  }

  var rootKeys = [];
  for (var candidateKey in expectedById) {
    if (!Object.prototype.hasOwnProperty.call(expectedById, candidateKey)) continue;
    var candidateParentId = text(expectedById[candidateKey].ParentId).replace(/^\s+|\s+$/g, '');
    if (isBlank(candidateParentId) || !selectedIdMap[candidateParentId.toLowerCase()]) {
      rootKeys.push(candidateKey);
    }
  }
  if (rootKeys.length !== 1) {
    throw new Error('MenuContract 必须形成唯一可移植根，实际根数量：' + rootKeys.length);
  }
  var rootKey = rootKeys[0];
  for (var closureKey in expectedById) {
    if (!Object.prototype.hasOwnProperty.call(expectedById, closureKey) || closureKey === rootKey) continue;
    var cursor = closureKey;
    var trail = {};
    while (cursor !== rootKey) {
      if (trail[cursor]) throw new Error('MenuContract 包含菜单父级环：' + text(expectedById[closureKey].Id));
      trail[cursor] = true;
      var cursorParentId = text(expectedById[cursor].ParentId).replace(/^\s+|\s+$/g, '');
      var cursorParentKey = cursorParentId.toLowerCase();
      if (isBlank(cursorParentId) || !selectedIdMap[cursorParentKey]) {
        throw new Error('MenuContract 菜单未闭合到唯一根：' + text(expectedById[closureKey].Id));
      }
      cursor = cursorParentKey;
    }
  }

  var contractFields = ['Name', 'DiyTableId', 'DiyTableName'];
  for (var menuIndex = 0; menuIndex < menus.length; menuIndex++) {
    var menu = menus[menuIndex] || {};
    var menuId = text(menu.Id || menu.MenuId || menu.Value).replace(/^\s+|\s+$/g, '');
    var menuKey = menuId.toLowerCase();
    var contractMenu = expectedById[menuKey];
    if (!contractMenu) throw new Error('精确菜单导出包含 MenuContract 之外的菜单：' + menuId);
    if (seen[menuKey]) throw new Error('精确菜单导出包含重复菜单 Id：' + menuId);
    seen[menuKey] = true;

    for (var fieldIndex = 0; fieldIndex < contractFields.length; fieldIndex++) {
      var fieldName = contractFields[fieldIndex];
      if (text(menu[fieldName]) !== text(contractMenu[fieldName])) {
        throw new Error('精确菜单 ' + menuId + '.' + fieldName + ' 与 MenuContract 不一致');
      }
    }

    var expectedParentId = text(contractMenu.ParentId).replace(/^\s+|\s+$/g, '');
    var actualParentId = text(menu.ParentId).replace(/^\s+|\s+$/g, '');
    if (menuKey === rootKey) {
      if (!isBlank(expectedParentId) && actualParentId.toLowerCase() !== expectedParentId.toLowerCase()) {
        throw new Error('精确菜单根 ' + menuId + '.ParentId 与 MenuContract 不一致');
      }
      if (isBlank(expectedParentId) && !isBlank(actualParentId) && selectedIdMap[actualParentId.toLowerCase()]) {
        throw new Error('精确菜单根 ' + menuId + ' 意外引用了包内 ParentId：' + actualParentId);
      }
      menu.ParentId = null;
    } else {
      if (isBlank(expectedParentId) || !selectedIdMap[expectedParentId.toLowerCase()]) {
        throw new Error('MenuContract 非根菜单 ' + menuId + ' 引用了包外 ParentId：' + expectedParentId);
      }
      if (actualParentId.toLowerCase() !== expectedParentId.toLowerCase()) {
        throw new Error('精确菜单 ' + menuId + '.ParentId 与 MenuContract 不一致');
      }
      menu.ParentId = expectedParentId;
    }
  }

  for (var expectedMenuKey in expectedById) {
    if (Object.prototype.hasOwnProperty.call(expectedById, expectedMenuKey) && !seen[expectedMenuKey]) {
      throw new Error('精确菜单导出缺少 MenuContract 菜单：' + text(expectedById[expectedMenuKey].Id));
    }
  }
  return menus;
}

// MICROSERVICE_MENU_KEY_ENRICHMENT_V1：sys_menu 的历史母表可能尚未包含
// MicroServiceKey 物理字段，但应用商城包必须是跨租户自包含的。发布时以当前
// committed ApplicationBundle 的 AppKey/MsKey 补齐菜单，并拒绝跨应用或缺路由绑定。
function enrichMicroServiceMenuBindings(packageModel) {
  var model = packageModel || {};
  var bundle = model.ApplicationBundle || {};
  var application = bundle.Application || {};
  var microService = bundle.MicroService || {};
  var applicationType = text(
    bundle.ApplicationType || application.ApplicationType || application.AppType,
  ).toLowerCase();
  if (applicationType !== 'microservice') return ok({ Updated: 0 });

  var appKey = text(application.AppKey || bundle.AppKey || microService.MsKey).trim();
  if (isBlank(appKey)) return fail('MicroService 应用包缺少稳定 AppKey/MsKey，无法绑定菜单');

  var routeMap = {};
  var routes = toArray(bundle.Routes);
  for (var routeIndex = 0; routeIndex < routes.length; routeIndex++) {
    var routePath = text((routes[routeIndex] || {}).RoutePath).trim().toLowerCase();
    if (routePath) routeMap[routePath] = true;
  }

  var menus = toArray(model.SysMenus);
  var updated = 0;
  for (var menuIndex = 0; menuIndex < menus.length; menuIndex++) {
    var menu = menus[menuIndex] || {};
    var isMicroServiceMenu = text(menu.OpenType).toLowerCase() === 'microservice'
      || menu.IsMicroiService === true
      || Number(menu.IsMicroiService || 0) === 1;
    if (!isMicroServiceMenu) continue;

    var existingKey = text(menu.MicroServiceKey || menu.MsKey || menu.MicroServiceAppKey).trim();
    if (existingKey && existingKey.toLowerCase() !== appKey.toLowerCase()) {
      return fail('微服务菜单【' + text(menu.Name || menu.Id, '未命名') + '】绑定 ' + existingKey
        + '，与当前应用包 ' + appKey + ' 不一致');
    }
    var menuRoutePath = text(menu.MicroServiceRoutePath || menu.RoutePath).trim();
    if (menuRoutePath && !routeMap[menuRoutePath.toLowerCase()]) {
      return fail('微服务菜单【' + text(menu.Name || menu.Id, '未命名') + '】引用路由 '
        + menuRoutePath + '，但当前 committed ApplicationBundle 未包含该路由');
    }
    menu.MicroServiceKey = appKey;
    updated += 1;
  }
  model.SysMenus = menus;
  return ok({ Updated: updated, MicroServiceKey: appKey });
}
function selectionJson(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
/* REUSE_FRESH_PREPARED_ASSETS_V1
 * 大型应用重新逐文件下载、压缩、上传 ZIP 可能耗时数分钟。仅当既有 ZIP
 * 晚于最近一次成功构建时复用，避免同步发布超过反向代理超时。
 */
function packageAssetIsPrivate(asset) {
  asset = asset || {};
  var scope = text(asset.StorageScope || asset.StorageMode || asset.Scope).toLowerCase();
  return boolValue(asset.Limit, false) || scope.indexOf('private') >= 0;
}
function reusablePreparedAssets(store, app, latestVersion, includeSource, isPublic) {
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
      if (!packageAssetIsPrivate(item.SourceZip)) continue;
    }
    if (packageAssetIsPrivate(item.BuildZip) === !!isPublic) continue;
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

function exportScheduleJobs(jobNames, apiEngines) {
  var names = selectionValues(jobNames, ['JobName', 'Name', 'Value']);
  if (names.length === 0) return [];
  if (names.length > 50) throw new Error('单个应用最多发布 50 个定时任务');

  var engineMap = apiEngineMap(apiEngines);
  var query = V8.FormEngine.GetTableData('diy_schedule_job', {
    _Where: [['JobName', 'In', names]],
    _PageIndex: 1,
    _PageSize: 51
  });
  if (!query || query.Code !== 1) {
    throw new Error('读取定时任务失败：' + ((query && query.Msg) || '接口无返回'));
  }
  var rows = toArray(query.Data);
  var rowMap = {};
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var row = rows[rowIndex] || {};
    var rowName = text(row.JobName).replace(/^\s+|\s+$/g, '');
    if (rowName) rowMap[rowName.toLowerCase()] = row;
  }

  var result = [];
  for (var nameIndex = 0; nameIndex < names.length; nameIndex++) {
    var jobName = text(names[nameIndex]).replace(/^\s+|\s+$/g, '');
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(jobName)) {
      throw new Error('定时任务名称不合法：' + jobName);
    }
    var source = rowMap[jobName.toLowerCase()];
    if (!source) throw new Error('所选定时任务不存在：' + jobName);
    var jobType = text(source.JobType || '1');
    var apiEngineKey = text(source.ApiEngineKey).replace(/^\s+|\s+$/g, '');
    if (jobType !== '1') throw new Error('应用包只允许发布接口引擎任务：' + jobName);
    if (!apiEngineKey || !engineMap[apiEngineKey.toLowerCase()]) {
      throw new Error('定时任务引用的接口引擎未包含在当前应用包：' + jobName + ' -> ' + apiEngineKey);
    }
    var cronExpression = text(source.CronExpression).replace(/^\s+|\s+$/g, '');
    if (!cronExpression || cronExpression.length > 200) {
      throw new Error('定时任务 CronExpression 不合法：' + jobName);
    }
    result.push({
      JobName: jobName,
      JobDesc: text(source.JobDesc || source.Description).substring(0, 500),
      JobParam: text(source.JobParam).substring(0, 16384),
      CronDesc: text(source.CronDesc).substring(0, 500),
      CronExpression: cronExpression,
      TimeZoneId: text(source.TimeZoneId).substring(0, 100),
      JobType: '1',
      ApiEngineKey: apiEngineKey
    });
  }
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

/* MARKETPLACE_CURRENT_PACKAGE_REPAIR_CAS_V1
 * 商城发行版本允许领先于不可变运行时版本。源码迁移、包说明修正或安装快照
 * 补齐时，只能原位修复“当前商城版本”，不得借用 committed runtime proof，
 * 也不得触发 sys_microistore 的普通表单事件自动升版。
 */
function validateCurrentPackageRepair(existingStore, packageAssets, requestedVersionValue, action, protocolV3, exactPublishedVersion) {
  if (!existingStore || isBlank(existingStore.Id)) return fail('RepairCurrentPackageVersion 要求商城当前记录已存在');
  if (action !== 'Publish') return fail('RepairCurrentPackageVersion 只允许 Action=Publish');
  if (protocolV3) return fail('RepairCurrentPackageVersion 不得与 ProtocolVersion=3 同时使用');
  if (exactPublishedVersion) return fail('RepairCurrentPackageVersion 不得与 ExactPublishedVersion=true 同时使用');
  var currentVersion = normalizeExactVersion(existingStore.AppVersion);
  var requestedVersion = normalizeExactVersion(requestedVersionValue);
  var preparedVersion = normalizeExactVersion(packageAssets && packageAssets.PackageVersion);
  if (isBlank(currentVersion)
      || currentVersion !== requestedVersion
      || currentVersion !== preparedVersion) {
    return fail('RepairCurrentPackageVersion 版本合同不一致：current=' + currentVersion
      + ' requested=' + requestedVersion + ' prepared=' + preparedVersion);
  }
  return ok({ AppVersion: currentVersion }, '当前商城版本原位修复合同验证通过');
}
function appendCurrentPackageRepairStringCas(where, field, value) {
  if (!isBlank(value)) {
    where.push(['AND', field, '=', text(value)]);
  } else {
    where.push(['AND', '(', field, '=', null]);
    where.push(['OR', field, '=', '', ')']);
  }
}
function buildCurrentPackageRepairFields(storeRow, existingStore) {
  var fields = {
    AppName: storeRow.AppName,
    Name: storeRow.Name,
    AppVersion: storeRow.AppVersion,
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
    Status: storeRow.Status,
    BuildStatus: storeRow.BuildStatus,
    AppUpdateTime: storeRow.AppUpdateTime,
    AppPakcet: storeRow.AppPakcet,
    PackageId: storeRow.PackageId,
    PackageStorageMode: storeRow.PackageStorageMode,
    PackageHdfsPath: storeRow.PackageHdfsPath,
    PackageSha256: storeRow.PackageSha256,
    PackageSize: storeRow.PackageSize,
    PackageContentType: storeRow.PackageContentType,
    PackageFormatVersion: storeRow.PackageFormatVersion,
    PackageUploadedAt: storeRow.PackageUploadedAt,
    SelectMenu: storeRow.SelectMenu,
    SelectTable: storeRow.SelectTable,
    SelectApiEngine: storeRow.SelectApiEngine,
    SelectAiApp: storeRow.SelectAiApp,
    AiAppZipFiles: storeRow.AiAppZipFiles,
    AiAppPackageManifest: storeRow.AiAppPackageManifest
  };
  var where = [
    ['Id', '=', existingStore.Id],
    ['AND', 'AppVersion', '=', normalizeExactVersion(existingStore.AppVersion)]
  ];
  appendCurrentPackageRepairStringCas(where, 'PackageHdfsPath', existingStore.PackageHdfsPath);
  appendCurrentPackageRepairStringCas(where, 'PackageSha256', text(existingStore.PackageSha256).toLowerCase());
  if (Number(existingStore.PackageSize || 0) > 0) {
    where.push(['AND', 'PackageSize', '=', Number(existingStore.PackageSize)]);
  }
  if (!isBlank(existingStore.AppUpdateTime)) {
    where.push(['AND', 'AppUpdateTime', '=', existingStore.AppUpdateTime]);
  }
  fields._Where = where;
  return fields;
}
function currentPackageRepairReadbackMatches(row, storeRow, expectedVersion) {
  return !!row
    && marketplaceIdentityReadbackMatches(row, storeRow.AppId, storeRow.AppKey)
    && normalizeExactVersion(row.AppVersion) === normalizeExactVersion(expectedVersion)
    && text(row.AppPakcet) === ''
    && text(row.PackageHdfsPath) === text(storeRow.PackageHdfsPath)
    && text(row.PackageSha256).toLowerCase() === text(storeRow.PackageSha256).toLowerCase()
    && Number(row.PackageSize || 0) === Number(storeRow.PackageSize || 0)
    && text(row.AiAppPackageManifest) === text(storeRow.AiAppPackageManifest)
    && text(row.AiAppZipFiles) === text(storeRow.AiAppZipFiles);
}

/* MARKETPLACE_IMMUTABLE_INSTALL_SNAPSHOT_V1
 * V3 写包使用 UptFormDataByWhere 保持 committed pointer 的条件更新，但该
 * 原子路径不会触发 diy_table.EnableDataVersion 的通用版本记录。安装器又必须
 * 钉住 mic_data_version，不能退回易变的 sys_microistore 当前行。因此发布器
 * 在包指针完成回读后显式写一条内容寻址、可幂等复用的安装快照。
 */
function marketplaceStoreTableId() {
  var table = V8.FormEngine.GetFormData('diy_table', {
    _Where: [['Name', '=', 'sys_microistore']],
    _SelectFields: ['Id', 'Name'],
    _PageSize: 1
  });
  if (!table || table.Code !== 1 || !table.Data || isBlank(table.Data.Id)) {
    throw new Error('sys_microistore 表定义不存在，无法生成不可变安装快照');
  }
  return text(table.Data.Id);
}
function marketplacePackageSnapshotId(storeRow) {
  var storeId = text(storeRow && storeRow.Id).replace(/^\s+|\s+$/g, '');
  var appVersion = normalizeExactVersion(storeRow && storeRow.AppVersion);
  var packageSha = text(storeRow && storeRow.PackageSha256).replace(/^\s+|\s+$/g, '').toLowerCase();
  if (isBlank(storeId) || isBlank(appVersion) || !/^[a-f0-9]{64}$/.test(packageSha)) {
    throw new Error('商城包缺少 StoreId、精确 AppVersion 或 PackageSha256，无法生成安装快照');
  }
  var identity = sha256Hex([text(V8.OsClient), storeId, appVersion, packageSha].join('|'));
  return 'mcipkg-' + identity.substring(0, 29);
}
function marketplacePackageSnapshotMatches(versionRow, storeRow, resourceSnapshotHash) {
  if (!versionRow || text(versionRow.TableName) !== 'sys_microistore'
      || text(versionRow.TableRowId) !== text(storeRow && storeRow.Id)) return false;
  var snapshot = parseObject(versionRow.Data, {});
  return text(snapshot.Id) === text(storeRow.Id)
    && normalizeExactVersion(snapshot.AppVersion) === normalizeExactVersion(storeRow.AppVersion)
    && text(snapshot.PackageHdfsPath) === text(storeRow.PackageHdfsPath)
    && text(snapshot.PackageSha256).toLowerCase() === text(storeRow.PackageSha256).toLowerCase()
    && Number(snapshot.PackageSize || 0) === Number(storeRow.PackageSize || 0)
    && text(snapshot.AiAppPackageManifest) === text(storeRow.AiAppPackageManifest)
    && text(snapshot.AiAppZipFiles) === text(storeRow.AiAppZipFiles)
    && text(snapshot.PackageResourceSnapshotHash).toLowerCase() === text(resourceSnapshotHash).toLowerCase();
}
function ensureMarketplacePackageSnapshot(storeRow, resourceSnapshotHash) {
  if (!storeRow || isBlank(storeRow.Id)
      || isBlank(storeRow.PackageHdfsPath)
      || Number(storeRow.PackageSize || 0) < 1
      || !/^[a-f0-9]{64}$/.test(text(storeRow.PackageSha256).toLowerCase())
      || !/^[a-f0-9]{64}$/.test(text(resourceSnapshotHash).toLowerCase())) {
    throw new Error('商城包指针或资源快照哈希不完整，拒绝生成不可变安装快照');
  }
  var snapshotId = marketplacePackageSnapshotId(storeRow);
  var existing = V8.FormEngine.GetFormData('mic_data_version', { Id: snapshotId });
  if (existing && existing.Code === 1 && existing.Data) {
    if (!marketplacePackageSnapshotMatches(existing.Data, storeRow, resourceSnapshotHash)) {
      throw new Error('内容寻址安装快照已存在但正文不一致：' + snapshotId);
    }
    return { StoreVersionId: snapshotId, Created: false };
  }

  var snapshot = parseObject(JSON.stringify(storeRow), {});
  snapshot.PackageSnapshotSchemaVersion = 1;
  snapshot.PackageResourceSnapshotHash = text(resourceSnapshotHash).toLowerCase();
  var addResult = V8.FormEngine.AddFormData('mic_data_version', {
    Id: snapshotId,
    TableId: marketplaceStoreTableId(),
    TableName: 'sys_microistore',
    TableRowId: text(storeRow.Id),
    Version: ('pkg-' + normalizeExactVersion(storeRow.AppVersion)
      + '-' + text(storeRow.PackageSha256).substring(0, 8)).substring(0, 50),
    Action: 'MarketplacePackagePublish',
    Data: JSON.stringify(snapshot),
    Remark: ('应用商城不可变安装快照：' + normalizeExactVersion(storeRow.AppVersion)).substring(0, 500)
  });
  if (!addResult || addResult.Code !== 1) {
    // 并发发布可能由另一事务先写入同一内容寻址 Id；只允许精确正文收敛。
    existing = V8.FormEngine.GetFormData('mic_data_version', { Id: snapshotId });
    if (!existing || existing.Code !== 1 || !existing.Data
        || !marketplacePackageSnapshotMatches(existing.Data, storeRow, resourceSnapshotHash)) {
      throw new Error('写入不可变安装快照失败：' + ((addResult && addResult.Msg) || snapshotId));
    }
    return { StoreVersionId: snapshotId, Created: false };
  }
  var verified = V8.FormEngine.GetFormData('mic_data_version', { Id: snapshotId });
  if (!verified || verified.Code !== 1 || !verified.Data
      || !marketplacePackageSnapshotMatches(verified.Data, storeRow, resourceSnapshotHash)) {
    throw new Error('不可变安装快照写入后回读不一致：' + snapshotId);
  }
  return { StoreVersionId: snapshotId, Created: true };
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
// MARKETPLACE_STABLE_APPLICATION_IDENTITY_V1：发布前必须从权威商城行得到
// 可持久化的稳定标识；只存在一侧时对称补齐，禁止再发布 AppId=NULL 的记录。
var marketplaceAppId = trimText(app.AppId || app.AppKey);
var marketplaceAppKey = trimText(app.AppKey || app.AppId);
if (isBlank(marketplaceAppId) || isBlank(marketplaceAppKey)) {
  return fail('商城应用缺少稳定 AppId/AppKey，请先修复应用标识后再发布。');
}
var appType = text(app.ApplicationType || app.AppType, 'Web');
if (['Web', 'UniApp', 'MicroService'].indexOf(appType) < 0) return fail('不支持的应用类型：' + appType);
var action = text(V8.Param.Action || 'Package');
var protocolVersionText = text(V8.Param.ProtocolVersion);
if (!isBlank(protocolVersionText) && protocolVersionText !== '3') return fail('ProtocolVersion 只支持显式 v3 或省略');
var protocolV3 = protocolVersionText === '3';
var repairCurrentPackageVersion = boolValue(V8.Param.RepairCurrentPackageVersion, false);
if (protocolV3 && action !== 'Publish' && action !== 'InspectResourceSnapshot') {
  return fail('ProtocolVersion=3 只允许 Action=Publish 或 InspectResourceSnapshot');
}
if (!protocolV3 && action === 'InspectResourceSnapshot') {
  return fail('InspectResourceSnapshot 必须显式使用 ProtocolVersion=3');
}
if (repairCurrentPackageVersion && protocolV3) {
  return fail('RepairCurrentPackageVersion 不得与 ProtocolVersion=3 同时使用');
}
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
var requestedDatabaseOnlyBuild = V8.Param.DatabaseOnlyBuild === true
  || V8.Param.DatabaseOnlyBuild === 1
  || text(V8.Param.DatabaseOnlyBuild).toLowerCase() === 'true';
if (protocolV3 && appType === 'MicroService' && requestedDatabaseOnlyBuild) {
  try {
    runtime = hydrateCommittedRuntimeAssets(app, runtime, V8.Param.CommittedProof, V8.Param.AppVersion);
  } catch (runtimeAssetHydrationError) {
    return fail(runtimeAssetHydrationError.message);
  }
}
var returnPackageModel = V8.Param.ReturnPackageModel === true || V8.Param.ReturnPackageModel === 1 || text(V8.Param.ReturnPackageModel).toLowerCase() === 'true';
// 组合型应用商城导出器只需要 Package 对象继续合并资源。此模式禁止再生成
// 内容完全重复的 FileByteBase64，避免大型源码包在 Jint/JSON 中占用双份内存。
var packageModelOnly = V8.Param.PackageModelOnly === true
  || V8.Param.PackageModelOnly === 1
  || text(V8.Param.PackageModelOnly).toLowerCase() === 'true';
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
var existingStore = getExistingStore(marketplaceAppKey);
// MARKETPLACE_SOURCE_DEFAULT_PRIVATE_V1：普通 AI 应用缺省必须交付源码，
// 特殊游戏/Unity 包由发布调用方显式传 IncludeSource=false。
var includeSourceParamSupplied = V8.Param.IncludeSource !== undefined && V8.Param.IncludeSource !== null;
var includeSource = includeSourceParamSupplied ? boolValue(V8.Param.IncludeSource, false) : true;
// 历史 IsPublic=NULL 在商城一直按公开应用兼容。编译 ZIP 与商城包
// 使用同一可见性；源码 ZIP 不受此开关影响，始终为私有。
var visibilitySource = existingStore || app || {};
var storeVisibility = boolValue(V8.Param.IsPublic, boolValue(visibilitySource.IsPublic, true));
// 应用商城“开始制作”历史上调用 PackageOnly，随后再下载 AppPakcet。
// 这个动作同样必须生成完全自包含的离线 JSON，不能只保存发布端 ZIP 地址。
var isOfflineAction = action === 'OfflinePackage' || action === 'Download' || action === 'PackageOnly';
var requestedSharedPublicRuntime = V8.Param.SharedPublicRuntime || null;
if (typeof requestedSharedPublicRuntime === 'string') {
  requestedSharedPublicRuntime = parseObject(requestedSharedPublicRuntime, null);
}
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
// v3 SharedPublicRuntime 已由 Core 的 committed pointer、manifest hash 与
// stable resolver 完整证明。它不能为了满足历史 BuildZip 字段，再把数百 MB
// 乃至数 GB 的运行时读回 Base64/Jint 重复压包；这里保存不可变运行时描述符。
if (!packageAssets && protocolV3 && requestedSharedPublicRuntime) {
  packageAssets = {
    SchemaVersion: 3,
    AppId: app.Id,
    AppKey: app.AppKey,
    AppName: app.Name || app.AppName,
    ApplicationType: appType,
    PackageVersion: text(committedVersion && committedVersion.VersionNo),
    IncludeSource: false,
    BuildZip: null,
    SourceZip: null,
    PreparedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    SharedPublicRuntimeOnly: true,
    RuntimeManifestHash: committedProof.RuntimeManifestHash
  };
}
if (protocolV3 && !packageAssets) return fail('ProtocolVersion=3 必须显式提供 finalize 前准备的不可变 PreparedAssets');
var forcePrepareAssets = V8.Param.ForcePrepareAssets === true
  || V8.Param.ForcePrepareAssets === 1
  || text(V8.Param.ForcePrepareAssets).toLowerCase() === 'true';
var reusedPreparedAssets = false;
if (!packageAssets && !isOfflineAction && !forcePrepareAssets) {
  packageAssets = reusablePreparedAssets(existingStore, app, latestVersion, includeSource, storeVisibility);
  reusedPreparedAssets = !!packageAssets;
}
// 自包含离线包直接读取已发布运行资产，无须先生成或下载公网 ZIP。
// 这也允许微服务源码后来有修改时，继续基于最近一次成功发布产物制作离线包。
if (!packageAssets && !isOfflineAction) {
  var prepareResult = V8.ApiEngine.Run('ai_app_prepare_store_assets', {
    Action: 'Prepare',
    PackageVersion: text(V8.Param.AppVersion),
    Apps: [{ AppId: app.Id, IncludeSource: includeSource, PackageVersion: text(V8.Param.AppVersion) }]
  });
  if (!prepareResult || prepareResult.Code !== 1 || !prepareResult.Data) {
    return fail('生成AI应用ZIP失败：' + ((prepareResult && prepareResult.Msg) || '接口无返回'));
  }
  var preparedManifest = toArray(prepareResult.Data.Manifest);
  packageAssets = preparedManifest.length ? preparedManifest[0] : null;
}
if (!isOfflineAction && (!packageAssets || (!packageAssets.BuildZip && !packageAssets.SharedPublicRuntimeOnly))) {
  return fail('当前应用没有可安装的编译ZIP或已提交 SharedPublicRuntime。');
}
if (packageAssets && packageAssets.SourceZip && !packageAssetIsPrivate(packageAssets.SourceZip)) {
  return fail('源码 ZIP 必须保存到官方 HDFS 私有桶，已拒绝持久公开地址。');
}
if (packageAssets && packageAssets.BuildZip
    && packageAssetIsPrivate(packageAssets.BuildZip) === storeVisibility) {
  return fail('编译 ZIP 存储范围与应用可见性不一致：公开应用必须公有，私有应用必须私有。');
}
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
var currentPackageRepairValidation = null;
if (repairCurrentPackageVersion) {
  currentPackageRepairValidation = validateCurrentPackageRepair(
    existingStore,
    packageAssets,
    V8.Param.AppVersion,
    action,
    protocolV3,
    exactPublishedVersion
  );
  if (!currentPackageRepairValidation || currentPackageRepairValidation.Code !== 1) {
    return currentPackageRepairValidation || fail('当前商城版本原位修复合同验证失败');
  }
}
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
// 商城发行版本与不可变运行时版本是两个合同。目录整理、安装包或说明更新
// 可以只提升商城版本；只有构建产物变化才提升 MicroService BuildVersion。
// ExactPublishedVersion/v3 仍要求二者严格相同，保持 committed pointer 门禁。
var deliveryVersions = resolveDeliveryVersions({
  AppType: appType,
  ExactPublishedVersion: exactPublishedVersion,
  RequestedPublishedVersion: requestedPublishedVersion,
  RuntimeBuildVersion: runtime.Service ? runtime.Service.BuildVersion : '',
  LatestVersion: latestVersion ? latestVersion.VersionNo : '',
  ApplicationVersion: app.AppVersion,
  RequestedPackageVersion: V8.Param.AppVersion,
  PreparedPackageVersion: packageAssets ? packageAssets.PackageVersion : '',
  ExistingPackageVersion: existingStore ? existingStore.AppVersion : ''
});
var runtimeVersionNo = deliveryVersions.RuntimeVersion;
var versionNo = repairCurrentPackageVersion
  ? currentPackageRepairValidation.Data.AppVersion
  : deliveryVersions.PackageVersion;
var changeLogValidation = requireMarketplaceChangeLog(
  text((existingStore && existingStore.Id) || app.Id),
  versionNo,
  action === 'Publish'
);
if (!changeLogValidation || changeLogValidation.Code !== 1) return changeLogValidation;
var releaseChangeLog = changeLogValidation.Data;
var sharedPublicRuntime = requestedSharedPublicRuntime;
if (requestedDatabaseOnlyBuild && appType !== 'MicroService') {
  return fail('DatabaseOnlyBuild 仅支持文件数和体积受限的 MicroService。');
}
if (requestedDatabaseOnlyBuild && sharedPublicRuntime) {
  return fail('DatabaseOnlyBuild 与 SharedPublicRuntime 不能同时启用。');
}
if (sharedPublicRuntime) {
  if (!protocolV3) return fail('SharedPublicRuntime 只允许 ProtocolVersion=3 的已提交不可变运行时。');
  if (includeSource) return fail('SharedPublicRuntime 必须使用 IncludeSource=false；源码交付请使用普通 HDFS 或离线包。');
  if (appType !== 'Web' && appType !== 'UniApp') return fail('SharedPublicRuntime 只支持 Web 或 UniApp。');
  var sharedEntryUrl = text(sharedPublicRuntime.EntryUrl);
  var sharedBaseUrl = text(sharedPublicRuntime.BaseUrl);
  var sharedManifestHash = text(sharedPublicRuntime.ManifestHash).toLowerCase();
  var committedRuntimeHash = text(committedProof && committedProof.RuntimeManifestHash).toLowerCase();
  if (!/^https:\/\/[^?#]{1,2040}$/i.test(sharedEntryUrl)) {
    return fail('SharedPublicRuntime.EntryUrl 必须是无查询参数和片段的 HTTPS 地址。');
  }
  if (!/^[a-f0-9]{64}$/i.test(sharedManifestHash) || sharedManifestHash !== committedRuntimeHash) {
    return fail('SharedPublicRuntime.ManifestHash 必须与已提交 v3 运行清单摘要一致。');
  }
  if (sharedEntryUrl.toLowerCase().indexOf('/' + runtimeVersionNo.toLowerCase() + '/') < 0) {
    return fail('SharedPublicRuntime.EntryUrl 必须固定到当前不可变运行时版本目录。');
  }
  if (sharedBaseUrl && (!/^https:\/\/[^?#]{1,2040}$/i.test(sharedBaseUrl)
      || sharedEntryUrl.toLowerCase().indexOf(sharedBaseUrl.replace(/\/+$/g, '').toLowerCase() + '/') !== 0)) {
    return fail('SharedPublicRuntime.BaseUrl 必须是 EntryUrl 的 HTTPS 父路径。');
  }
  sharedPublicRuntime = {
    SchemaVersion: 1,
    EntryUrl: sharedEntryUrl,
    BaseUrl: sharedBaseUrl || sharedEntryUrl.substring(0, sharedEntryUrl.lastIndexOf('/')),
    VersionNo: runtimeVersionNo,
    ManifestHash: sharedManifestHash,
    ProviderOsClient: text(sharedPublicRuntime.ProviderOsClient || V8.OsClient),
    TotalSize: Number(sharedPublicRuntime.TotalSize || 0),
    HostContext: true
  };
}
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
var explicitApiEngineSelection = V8.Param.ApiEngineKeys !== undefined
  && V8.Param.ApiEngineKeys !== null;
var scheduleJobNames = parseArray(V8.Param.ScheduleJobNames || V8.Param.JobNames);
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
var apiEngineSelectionValidation = validateOfficialPlatformApiEngineSelection(
  apiEngineKeys,
  explicitApiEngineSelection,
  existingStore,
  {
    ApplicationType: appType,
    PublisherType: text(V8.Param.PublisherType || app.PublisherType || '官方应用')
  },
  V8.Param.ApiEngineRemovalKeys
);
if (!apiEngineSelectionValidation || apiEngineSelectionValidation.Code !== 1) {
  return apiEngineSelectionValidation || fail('官方 Platform 应用接口资源选择校验失败。');
}
if (scheduleJobNames.length === 0 && existingStore) {
  var previousPackageWithJobs = readStoredPackage(existingStore);
  var previousJobs = toArray(previousPackageWithJobs.ScheduleJobs);
  for (var previousJobIndex = 0; previousJobIndex < previousJobs.length; previousJobIndex++) {
    if (previousJobs[previousJobIndex] && previousJobs[previousJobIndex].JobName) {
      scheduleJobNames.push(previousJobs[previousJobIndex].JobName);
    }
  }
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
selectedExport.SysMenus = normalizeExactExportedMenuClosure(
  selectedExport.SysMenus,
  menuContract,
  exactMenuIds
);
infrastructure.DDLStatements = mergeUniqueRows(infrastructure.DDLStatements, selectedExport.DDLStatements, ['TableName']);
infrastructure.DiyTables = mergeUniqueRows(infrastructure.DiyTables, selectedExport.DiyTables, ['Id', 'Name']);
infrastructure.DiyFields = mergeUniqueRows(infrastructure.DiyFields, selectedExport.DiyFields, ['Id']);
var selectedDataSets = toArray(selectedExport.DataSets);
var selectedDataRowCount = 0;
for (var selectedDataSetIndex = 0; selectedDataSetIndex < selectedDataSets.length; selectedDataSetIndex++) {
  selectedDataRowCount += toArray(selectedDataSets[selectedDataSetIndex] && selectedDataSets[selectedDataSetIndex].Rows).length;
}
var selectedScheduleJobs = exportScheduleJobs(scheduleJobNames, selectedExport.SysApiEngines);

var packageModel = {
  PackageInfo: {
    Name: text(V8.Param.AppName || app.Name || app.AppKey),
    Version: versionNo,
    AppVersion: runtimeVersionNo,
    AppId: app.AppKey,
    ApplicationType: appType,
    Description: text(V8.Param.AppDetail || app.Description),
    CreateTime: nowText('yyyy-MM-dd HH:mm:ss'),
    CreateUser: text(currentUser.Name || currentUser.Account),
    OsClient: V8.OsClient,
    DataSetCount: selectedDataSets.length,
    DataRowCount: selectedDataRowCount,
    JobCount: selectedScheduleJobs.length,
    IncludeSource: includeSource,
    ChangeLog: {
      Version: text(releaseChangeLog.Version),
      Title: text(releaseChangeLog.Title),
      ChangeType: text(releaseChangeLog.ChangeType),
      Content: text(releaseChangeLog.Content),
      ReleaseTime: text(releaseChangeLog.ReleaseTime)
    }
  },
  ApplicationBundle: {
    SchemaVersion: 2,
    ApplicationType: appType,
    IncludeSource: includeSource,
    VersionNo: runtimeVersionNo,
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
      BuildVersion: runtimeVersionNo
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
  SysApiEngines: toArray(selectedExport.SysApiEngines),
  ScheduleJobs: selectedScheduleJobs
};
var microServiceMenuBindingResult = enrichMicroServiceMenuBindings(packageModel);
if (!microServiceMenuBindingResult || microServiceMenuBindingResult.Code !== 1) {
  return microServiceMenuBindingResult || fail('微服务菜单绑定补全失败');
}
packageModel.ApplicationBundle.AssetStoragePolicy = {
  Source: includeSource ? 'PrivateHdfs' : 'NotIncluded',
  Build: storeVisibility ? 'PublicHdfs' : 'PrivateHdfs'
};
if (sharedPublicRuntime) {
  packageModel.PackageInfo.SharedPublicRuntime = true;
  packageModel.ApplicationBundle.AssetStoragePolicy = {
    Source: 'NotIncluded',
    Build: 'SharedPublicRuntime'
  };
  packageModel.ApplicationBundle.SharedPublicRuntime = sharedPublicRuntime;
}
if (requestedDatabaseOnlyBuild) {
  buildAssets = getBuildAssets(app, latestVersion, runtime);
  if (!buildAssets.length) return fail('当前微服务没有可内联的编译文件，无法发布 DatabaseOnlyBuild。');
  if (buildAssets.length > 256) return fail('DatabaseOnlyBuild 最多允许 256 个编译文件。');
  var databaseOnlyTotalBytes = 0;
  var databaseOnlyEntryVerified = false;
  for (var databaseOnlyIndex = 0; databaseOnlyIndex < buildAssets.length; databaseOnlyIndex++) {
    var databaseOnlyAsset = buildAssets[databaseOnlyIndex] || {};
    var databaseOnlyPath = normalizePath(databaseOnlyAsset.Path || databaseOnlyAsset.FileName);
    var databaseOnlyBase64 = text(databaseOnlyAsset.FileByteBase64 || databaseOnlyAsset.ContentBase64 || databaseOnlyAsset.Base64);
    if (!databaseOnlyPath || !databaseOnlyBase64) {
      return fail('DatabaseOnlyBuild 缺少完整编译文件内容：' + (databaseOnlyPath || ('asset-' + databaseOnlyIndex)));
    }
    var databaseOnlyBytes = 0;
    try { databaseOnlyBytes = System.Convert.FromBase64String(databaseOnlyBase64).Length; }
    catch (databaseOnlyDecodeError) { return fail('DatabaseOnlyBuild 包含无效 Base64：' + databaseOnlyPath); }
    if (databaseOnlyBytes <= 0) return fail('DatabaseOnlyBuild 包含空文件：' + databaseOnlyPath);
    databaseOnlyTotalBytes += databaseOnlyBytes;
    databaseOnlyAsset.Size = databaseOnlyBytes;
    if (databaseOnlyPath.toLowerCase() === normalizePath(entryPath).toLowerCase()) {
      var databaseOnlyHtml = '';
      try {
        // Jint may expose Encoding.GetString(byte[]) as a CLR System.String
        // host object. Normalize it to a native JavaScript string before using
        // RegExp.test; otherwise a byte-identical complete HTML document can
        // fail every structural check on production hosts.
        databaseOnlyHtml = text(System.Text.Encoding.UTF8.GetString(
          System.Convert.FromBase64String(databaseOnlyBase64)
        ));
      } catch (databaseOnlyHtmlError) { return fail('DatabaseOnlyBuild 入口不是有效 UTF-8 HTML。'); }
      var databaseOnlyHtmlLower = text(databaseOnlyHtml).toLowerCase();
      var databaseOnlyEntryChecks = {
        Path: databaseOnlyPath,
        ByteLength: databaseOnlyBytes,
        Sha256: sha256RuntimeAssetBytes(System.Convert.FromBase64String(databaseOnlyBase64)),
        HasDoctype: databaseOnlyHtmlLower.indexOf('<!doctype html') >= 0,
        HasHtml: databaseOnlyHtmlLower.indexOf('<html') >= 0,
        HasHead: databaseOnlyHtmlLower.indexOf('<head') >= 0,
        HasBody: databaseOnlyHtmlLower.indexOf('<body') >= 0,
        HasCloseHtml: databaseOnlyHtmlLower.indexOf('</html>') >= 0
      };
      if (!databaseOnlyEntryChecks.HasDoctype
          || !databaseOnlyEntryChecks.HasHtml
          || !databaseOnlyEntryChecks.HasHead
          || !databaseOnlyEntryChecks.HasBody
          || !databaseOnlyEntryChecks.HasCloseHtml) {
        return fail('DatabaseOnlyBuild 入口未返回完整 HTML 文档。', databaseOnlyEntryChecks);
      }
      databaseOnlyAsset.IsEntry = true;
      databaseOnlyEntryVerified = true;
    }
  }
  if (databaseOnlyTotalBytes > 5 * 1024 * 1024) {
    return fail('DatabaseOnlyBuild 总大小不能超过 5MB，当前为 ' + databaseOnlyTotalBytes + ' bytes。');
  }
  if (!databaseOnlyEntryVerified) return fail('DatabaseOnlyBuild 缺少入口文件：' + entryPath);
  var databaseOnlyService = {};
  var sourceMicroService = runtime.Service || {};
  for (var databaseOnlyServiceKey in sourceMicroService) {
    databaseOnlyService[databaseOnlyServiceKey] = sourceMicroService[databaseOnlyServiceKey];
  }
  databaseOnlyService.StorageMode = 'db';
  databaseOnlyService.MsUrl = 'db';
  databaseOnlyService.EntryPath = entryPath;
  databaseOnlyService.AssetCount = buildAssets.length;
  packageModel.PackageInfo.DatabaseOnlyBuild = true;
  packageModel.ApplicationBundle.BuildAssets = buildAssets;
  packageModel.ApplicationBundle.MicroService = databaseOnlyService;
  packageModel.ApplicationBundle.AssetStoragePolicy = {
    Source: includeSource ? 'PrivateHdfs' : 'NotIncluded',
    Build: 'DatabaseOnly',
    Reason: '小型平台微服务使用可验证数据库内联运行时，避免目标租户对象存储差异导致 404。'
  };
}
var generatedResourcePolicies = buildApiEngineResourcePolicies(
  packageModel.SysApiEngines,
  requestedResourcePolicies,
  existingStore,
  {
    ApplicationType: appType,
    PublisherType: text(V8.Param.PublisherType || app.PublisherType || '官方应用')
  }
);
if (generatedResourcePolicies) packageModel.ResourcePolicies = generatedResourcePolicies;

var resourceSnapshotReceipt = null;
try {
  resourceSnapshotReceipt = createResourceSnapshotReceipt(
    text(app.AppKey || app.AppId),
    versionNo,
    menuContract,
    packageModel,
    packageModel.ResourcePolicies || null
  );
} catch (resourceSnapshotError) {
  return fail('生成应用安装资源快照失败：' + resourceSnapshotError.message);
}
packageModel.ResourceSnapshot = {
  Schema: resourceSnapshotReceipt.ResourceSnapshotSchema,
  SchemaVersion: resourceSnapshotReceipt.ResourceSnapshotSchemaVersion,
  HashAlgorithm: 'SHA256',
  Hash: resourceSnapshotReceipt.ResourceSnapshotHash
};
packageModel.PackageInfo.ResourceSnapshotHash = resourceSnapshotReceipt.ResourceSnapshotHash;
var resourceSnapshotGate = enforceResourceSnapshotCas(
  action,
  protocolV3,
  V8.Param.ExpectedResourceSnapshotHash,
  resourceSnapshotReceipt
);
if (!resourceSnapshotGate || resourceSnapshotGate.Code !== 1) {
  return resourceSnapshotGate || fail('应用安装资源快照 CAS 校验失败');
}
if (protocolV3 && action === 'InspectResourceSnapshot') {
  return ok({
    Action: action,
    ProtocolVersion: 3,
    AppId: app.Id,
    AppKey: text(app.AppKey || app.AppId),
    AppVersion: versionNo,
    ResourceSnapshotCasCapability: resourceSnapshotCasCapability(),
    ResourceSnapshotSchema: resourceSnapshotReceipt.ResourceSnapshotSchema,
    ResourceSnapshotSchemaVersion: resourceSnapshotReceipt.ResourceSnapshotSchemaVersion,
    ResourceSnapshot: resourceSnapshotReceipt.ResourceSnapshot,
    ResourceSnapshotCanonicalJson: resourceSnapshotReceipt.ResourceSnapshotCanonicalJson,
    ResourceSnapshotHash: resourceSnapshotReceipt.ResourceSnapshotHash
  }, '应用安装资源快照只读检查完成');
}

if (isOfflineAction) {
  // 离线包必须能在完全不通发布端/HDFS 的客户环境安装。
  // PackageAssets 仍作为来源追踪信息保留，但安装器会优先使用这里内嵌的文件。
  buildAssets = getBuildAssets(app, latestVersion, runtime);
  if (!buildAssets.length) return fail('当前应用没有可内嵌的编译文件，无法制作真正的离线包。');
  packageModel.ApplicationBundle.BuildAssets = buildAssets;
  if (includeSource) {
    var storedSourceFiles = getFiles(app.Id);
    if (!storedSourceFiles || storedSourceFiles.Code !== 1) return fail('读取当前私有源码失败，已停止制作不完整安装包。');
    if (Number(storedSourceFiles.DataCount || 0) > 5000) return fail('当前文件清单超过单次打包上限，不能截断源码。');
    var storedSourceRows = currentSourceFiles(toArray(storedSourceFiles.Data), app.PrivateSourcePath);
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
  if (packageModelOnly) {
    return ok({
      Package: packageModel,
      PackageSummary: {
        Name: packageModel.PackageInfo.Name,
        Version: packageModel.PackageInfo.Version,
        OfflineSelfContained: true,
        BuildAssetCount: buildAssets.length,
        SourceFileCount: sourceFiles.length,
        RouteCount: packageModel.ApplicationBundle.Routes.length,
        JobCount: selectedScheduleJobs.length
      }
    }, '应用离线包模型已生成');
  }
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
      RouteCount: packageModel.ApplicationBundle.Routes.length,
      JobCount: selectedScheduleJobs.length
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
  var packageZipFiles = [];
  if (packageAssets.BuildZip) packageZipFiles.push(packageAssets.BuildZip);
  if (packageAssets.SourceZip) packageZipFiles.push(packageAssets.SourceZip);
  var packageJson = JSON.stringify(packageModel);
  // MARKETPLACE_PACKAGE_UTF8_BASE64_TRANSPORT_V1：先在当前引擎内按 UTF-8
  // 编码为纯 ASCII，再跨嵌套接口边界，防止长中文 JSON 被参数转换损坏。
  var packageByteBase64 = String(System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(packageJson)));
  var storageResult = V8.ApiEngine.Run('microi-store-package-storage', {
    Action: 'Store',
    StoreId: app.Id,
    AppVersion: versionNo,
    IsPublic: storeVisibility,
    PackageByteBase64: packageByteBase64
  });
  if (!storageResult || storageResult.Code !== 1 || !storageResult.Data) {
    return fail('应用包写入 HDFS 失败：' + ((storageResult && storageResult.Msg) || '接口无返回'));
  }
  var packagePointer = storageResult.Data;
  var storeRow = {
    AppName: packageModel.PackageInfo.Name,
    Name: packageModel.PackageInfo.Name,
    AppId: marketplaceAppId,
    AppKey: marketplaceAppKey,
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
    AppPakcet: '',
    PackageId: packagePointer.PackageId,
    PackageStorageMode: packagePointer.PackageStorageMode,
    PackageHdfsPath: packagePointer.PackageHdfsPath,
    PackageSha256: packagePointer.PackageSha256,
    PackageSize: packagePointer.PackageSize,
    PackageContentType: packagePointer.PackageContentType,
    PackageFormatVersion: packagePointer.PackageFormatVersion,
    PackageUploadedAt: packagePointer.PackageUploadedAt,
    SelectMenu: V8.Param.SelectMenu !== undefined && V8.Param.SelectMenu !== null
      ? selectionJson(V8.Param.SelectMenu)
      : (V8.Param.MenuIds !== undefined && V8.Param.MenuIds !== null
          ? selectionJson(menuIds)
          : selectionJson(existingStore && existingStore.SelectMenu)),
    SelectTable: V8.Param.SelectTable !== undefined && V8.Param.SelectTable !== null
      ? selectionJson(V8.Param.SelectTable)
      : (V8.Param.TableIds !== undefined && V8.Param.TableIds !== null
          ? selectionJson(tableIds)
          : selectionJson(existingStore && existingStore.SelectTable)),
    SelectApiEngine: V8.Param.SelectApiEngine !== undefined && V8.Param.SelectApiEngine !== null
      ? selectionJson(V8.Param.SelectApiEngine)
      : (V8.Param.ApiEngineKeys !== undefined && V8.Param.ApiEngineKeys !== null
          ? selectionJson(apiEngineKeys)
          : selectionJson(existingStore && existingStore.SelectApiEngine)),
    SelectAiApp: JSON.stringify([{ AppId: app.Id, AppKey: app.AppKey, AppName: app.Name, ApplicationType: appType, IncludeSource: !!packageAssets.SourceZip }]),
    AiAppZipFiles: JSON.stringify(packageZipFiles),
    AiAppPackageManifest: JSON.stringify([packageAssets])
  };
  if (protocolV3) {
    // Core 已经提交并投影运行态字段；这里禁止普通 Upt/Add，只在同一
    // committed pointer 上以单条条件更新写商城包与展示元数据。
    var packageFields = {
      AppName: storeRow.AppName,
      Name: storeRow.Name,
      // 普通表单修改 SelectMenu 等字段会触发版本自动递增事件；v3 写包必须
      // 把展示版本重新钉回 committed runtime，避免商城版本与不可变目录错位。
      AppVersion: storeRow.AppVersion,
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
      PackageId: storeRow.PackageId,
      PackageStorageMode: storeRow.PackageStorageMode,
      PackageHdfsPath: storeRow.PackageHdfsPath,
      PackageSha256: storeRow.PackageSha256,
      PackageSize: storeRow.PackageSize,
      PackageContentType: storeRow.PackageContentType,
      PackageFormatVersion: storeRow.PackageFormatVersion,
      PackageUploadedAt: storeRow.PackageUploadedAt,
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
        || !marketplaceIdentityReadbackMatches(postPublishStore, storeRow.AppId, storeRow.AppKey)
        || text(postPublishStore.AppPakcet) !== ''
        || text(postPublishStore.PackageHdfsPath) !== text(packageFields.PackageHdfsPath)
        || text(postPublishStore.PackageSha256).toLowerCase() !== text(packageFields.PackageSha256).toLowerCase()
        || Number(postPublishStore.PackageSize || 0) !== Number(packageFields.PackageSize || 0)
        || text(postPublishStore.AiAppPackageManifest) !== text(packageFields.AiAppPackageManifest)
        || text(postPublishStore.AiAppZipFiles) !== text(packageFields.AiAppZipFiles)) {
      return fail('v3 committed-proof CAS 写包回读不一致');
    }
    var v3InstallSnapshot;
    try {
      v3InstallSnapshot = ensureMarketplacePackageSnapshot(
        postPublishStore,
        resourceSnapshotReceipt.ResourceSnapshotHash
      );
    } catch (v3SnapshotError) {
      return fail('生成 V3 不可变安装快照失败：' + v3SnapshotError.message);
    }
    return ok({
      Store: postPublishStore,
      Package: packageModel,
      PreparedAssetsReused: false,
      PreparedTime: packageAssets.PreparedTime || '',
      AppVersion: text(postPublishStore.AppVersion),
      CurrentVersion: postPublishStore.CurrentVersion,
      CommittedProof: committedProof,
      FencedCas: true,
      ResourceSnapshotCasCapability: resourceSnapshotCasCapability(),
      ResourceSnapshotSchema: resourceSnapshotReceipt.ResourceSnapshotSchema,
      ResourceSnapshotSchemaVersion: resourceSnapshotReceipt.ResourceSnapshotSchemaVersion,
      ResourceSnapshot: resourceSnapshotReceipt.ResourceSnapshot,
      ResourceSnapshotCanonicalJson: resourceSnapshotReceipt.ResourceSnapshotCanonicalJson,
      ResourceSnapshotHash: resourceSnapshotReceipt.ResourceSnapshotHash,
      StoreVersionId: v3InstallSnapshot.StoreVersionId,
      ImmutableInstallSnapshotCreated: v3InstallSnapshot.Created
    }, '应用安装包已绑定到当前 committed pointer');
  }
  if (repairCurrentPackageVersion) {
    var repairFields = buildCurrentPackageRepairFields(storeRow, existingStore);
    var repairResult = V8.FormEngine.UptFormDataByWhere('sys_microistore', repairFields);
    if (!repairResult || repairResult.Code !== 1) {
      return repairResult || fail('当前商城版本原位修复 CAS 写包失败');
    }
    var repairedStore = getExistingStore(text(storeRow.AppKey || storeRow.AppId));
    if (!currentPackageRepairReadbackMatches(repairedStore, storeRow, versionNo)) {
      return fail('当前商城版本原位修复发生 CAS 冲突或写包回读不一致');
    }
    var repairedInstallSnapshot;
    try {
      repairedInstallSnapshot = ensureMarketplacePackageSnapshot(
        repairedStore,
        resourceSnapshotReceipt.ResourceSnapshotHash
      );
    } catch (repairSnapshotError) {
      return fail('生成原位修复不可变安装快照失败：' + repairSnapshotError.message);
    }
    return ok({
      Store: repairedStore,
      Package: packageModel,
      PreparedAssetsReused: reusedPreparedAssets,
      PreparedTime: packageAssets.PreparedTime || '',
      AppVersion: versionNo,
      CurrentVersion: repairedStore.CurrentVersion,
      CurrentPackageRepairCas: true,
      ResourceSnapshotSchema: resourceSnapshotReceipt.ResourceSnapshotSchema,
      ResourceSnapshotSchemaVersion: resourceSnapshotReceipt.ResourceSnapshotSchemaVersion,
      ResourceSnapshotHash: resourceSnapshotReceipt.ResourceSnapshotHash,
      StoreVersionId: repairedInstallSnapshot.StoreVersionId,
      ImmutableInstallSnapshotCreated: repairedInstallSnapshot.Created
    }, '当前商城版本安装包已原位修复，版本号保持不变');
  }
  var publishResult = upsertStore(storeRow);
  if (!publishResult || publishResult.Code !== 1) return publishResult || fail('发布到应用商城失败');
  var legacyPublishedStore = getExistingStore(text(storeRow.AppKey || storeRow.AppId));
  if (!marketplaceIdentityReadbackMatches(legacyPublishedStore, storeRow.AppId, storeRow.AppKey)) {
    return fail('发布到应用商城后的 AppId/AppKey 强回读不一致');
  }
  var legacyInstallSnapshot;
  try {
    legacyInstallSnapshot = ensureMarketplacePackageSnapshot(
      legacyPublishedStore,
      resourceSnapshotReceipt.ResourceSnapshotHash
    );
  } catch (legacySnapshotError) {
    return fail('生成不可变安装快照失败：' + legacySnapshotError.message);
  }
  return ok({
    Store: legacyPublishedStore || publishResult.Data || storeRow,
    Package: packageModel,
    PreparedAssetsReused: reusedPreparedAssets,
    PreparedTime: packageAssets.PreparedTime || '',
    AppVersion: versionNo,
    CurrentVersion: app.CurrentVersion || 1,
    ResourceSnapshotSchema: resourceSnapshotReceipt.ResourceSnapshotSchema,
    ResourceSnapshotSchemaVersion: resourceSnapshotReceipt.ResourceSnapshotSchemaVersion,
    ResourceSnapshotHash: resourceSnapshotReceipt.ResourceSnapshotHash,
    StoreVersionId: legacyInstallSnapshot.StoreVersionId,
    ImmutableInstallSnapshotCreated: legacyInstallSnapshot.Created
  }, '应用已发布到应用商城');
}

return ok({ Package: packageModel, SourceZipIncluded: !!packageAssets.SourceZip, BuildZipIncluded: true }, '统一应用包已生成');
