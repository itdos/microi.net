/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 应用商城归属：app.microi.store；ResourcePolicies.ApiEngines = Managed。
 * 官方可信应用更新会恢复本接口引擎代码，请勿直接修改官方安全控制面。
 * 本接口属于管理员 CDN 维护安全控制面，不提供租户 Hook；定制业务请另建接口引擎，
 * 不得覆盖身份、租户、发布绑定或对象字节校验。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_cdn_backfill
 * Version: v1.5.2
 * Function:
 * - 官方 AI 应用 CDN 固定路径迁移、流式哈希回读、阿里云 CDN 精确刷新与旧版编译错误对象修复；数据库保留相对对象路径，官网输出静态域名完整 URL。
 */

/* Official AI application CDN backfill. Run only as the platform administrator.
 * Copy creates physical public/private objects. Commit verifies the public CDN
 * bytes before changing marketplace URLs. Existing version objects are immutable.
 */
function fail(message) { return { Code: 0, Msg: message }; }
function ok(data) { return { Code: 1, Data: data }; }
function value(input) { return String(input == null ? '' : input).trim(); }
function trimSlash(input) { return value(input).replace(/^\/+|\/+$/g, ''); }
function publicSourcePath(input) {
  var raw = value(input).split('?')[0];
  if (/^https:\/\/static\.itdos\.com\//i.test(raw))
    raw = raw.replace(/^https:\/\/static\.itdos\.com\//i, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) throw new Error('旧版资产来源域名不属于公有桶');
  return trimSlash(raw);
}
function byteLength(bytes) {
  var base64 = System.Convert.ToBase64String(bytes);
  var padding = /==$/.test(base64) ? 2 : /=$/.test(base64) ? 1 : 0;
  return base64.length * 3 / 4 - padding;
}
function sha256(bytes) {
  // The V8 System facade does not expose a raw-byte SHA256 constructor. The
  // platform ZIP helpers hash each extracted entry in trusted .NET code.
  var encoded = System.Convert.ToBase64String(bytes);
  var archive = V8.Method.CreateZip({ Entries: [{ Path: 'data.bin', FileByteBase64: encoded }] });
  if (!archive || archive.Code !== 1) throw new Error('字节哈希暂存失败');
  var extracted = V8.Method.ExtractZip({ FileByteBase64: archive.Data.FileByteBase64 });
  if (!extracted || extracted.Code !== 1 || !extracted.Data.Entries || extracted.Data.Entries.length !== 1)
    throw new Error('字节哈希回读失败');
  return value(extracted.Data.Entries[0].Sha256).toLowerCase();
}
function rows(table, where, pageSize, pageIndex, orderBy) {
  var result = V8.FormEngine.GetTableData(table, { _Where: where, _PageIndex: pageIndex || 1,
    _PageSize: pageSize || 200, _OrderBy: orderBy || 'CreateTime', _OrderByType: 'ASC' });
  if (!result || result.Code !== 1) throw new Error('读取 ' + table + ' 失败：' + value(result && result.Msg));
  return result.Data || [];
}
function responseBytes(url, optional) {
  var response = V8.Http.GetResponse({ Url: url, Timeout: 120 });
  var status = Number(response && response.StatusCode || 0);
  if (status === 404 && optional) return null;
  if (status < 200 || status >= 300 || !response.RawBytes)
    throw new Error('对象读取失败，HTTP ' + status + '：' + url.split('?')[0]);
  // 某些旧 HDFS 错误正文被作为 HTTP 200 对象缓存；绝不能把它当成编译资产再复制。
  if (/\{\s*"Code"\s*:\s*0\s*,/.test(value(response.Content).substring(0, 100)))
    throw new Error('对象内容是存储错误而非应用资产：' + url.split('?')[0]);
  return response.RawBytes;
}
function publicUrl(path, nonce) {
  var url = fileServer + '/' + trimSlash(path);
  return nonce ? url + '?_microi_cas=' + nonce : url;
}
function privateUrl(path, optional) {
  var result = V8.Method.GetPrivateFileUrl({ OsClient: V8.OsClient, FilePathName: path, Limit: true });
  if (!result || result.Code !== 1) {
    if (optional) return '';
    throw new Error('获取私有对象地址失败：' + path);
  }
  var data = result.Data || {};
  var url = typeof data === 'string' ? data : value(data.Url || data.FileUrl || data.Path);
  if (!url) throw new Error('私有对象地址为空：' + path);
  return url;
}
function digestOf(path, isPrivate, optional) {
  if (!V8.Method.ObjectExist || !V8.Method.GetObjectSha256) return null;
  var request = { OsClient: V8.OsClient, FilePathName: path, Limit: isPrivate };
  var exists = V8.Method.ObjectExist(request);
  if (!exists || exists.Code !== 1) throw new Error('对象存在性查询失败：' + path);
  if (!exists.Data) {
    if (optional) return { Missing: true };
    throw new Error('对象不存在：' + path);
  }
  var hashed = V8.Method.GetObjectSha256(request);
  if (!hashed || hashed.Code !== 1 || !hashed.Data) {
    if (optional && /specified key does not exist|NoSuchKey|对象不存在/i.test(value(hashed && hashed.Msg)))
      return { Missing: true };
    throw new Error('对象流式哈希失败：' + path + '；' + value(hashed && hashed.Msg));
  }
  return { Sha256: value(hashed.Data.Sha256).toLowerCase(),
    WireSha256: value(hashed.Data.WireSha256).toLowerCase(), Size: Number(hashed.Data.Size) };
}
function projectedIndex(asset, sourcePath, originalHash) {
  if (trimSlash(asset.Path).toLowerCase() !== 'index.html') return null;
  var original = responseBytes(publicUrl(sourcePath, ''), false);
  if (originalHash && sha256(original) !== originalHash)
    throw new Error('入口原始字节与冻结清单不符：' + sourcePath);
  var html = V8.Base64.Base64ToString(System.Convert.ToBase64String(original));
  var previousProjection = html
    .replace(/<base\s+href=(['"])\.\.\/\1/ig, '<base href="./"')
    .replace(/const immutablePrefix = `versions\/\$\{versionNo\}\/`;/g,
      'const immutablePrefix = `${versionNo}/`;');
  var projected = previousProjection
    .replace(/(base\.href\s*=\s*`\$\{root\})versions\/(v\d+\.\d+\.\d+\/`)/g, '$1$2');
  if (projected === html) return null;
  var bytes = System.Convert.FromBase64String(V8.Base64.StringToBase64(projected));
  var previousHash = previousProjection === projected ? ''
    : sha256(System.Convert.FromBase64String(V8.Base64.StringToBase64(previousProjection)));
  return { Bytes: bytes, Sha256: sha256(bytes), Size: byteLength(bytes),
    PreviousProjectionSha256: previousHash };
}
function cdnCredentials() {
  var settings = V8.SysConfig && V8.SysConfig.ServerPrivateSettings || {};
  var saas = V8.OsClientModel || {};
  var prefixes = ['Integration.Cdn.Aliyun.', 'Integration.Dns.Aliyun.'];
  for (var i = 0; i < prefixes.length; i++) {
    var id = value(settings[prefixes[i] + 'AccessKeyId']);
    var secret = value(settings[prefixes[i] + 'AccessKeySecret']);
    if (id || secret) {
      if (!id || !secret) throw new Error('CDN 凭据配置不成对');
      return { Id: id, Secret: secret };
    }
  }
  var fallbackId = value(saas.AlidnsKeyId);
  var fallbackSecret = value(saas.AlidnsKeySecret);
  if (!fallbackId || !fallbackSecret) throw new Error('当前租户未配置阿里云 CDN 凭据');
  return { Id: fallbackId, Secret: fallbackSecret };
}
function cdnEncode(input) {
  return encodeURIComponent(value(input)).replace(/[!'()*]/g, function (character) {
    return '%' + character.charCodeAt(0).toString(16).toUpperCase();
  });
}
function cdnRpc(actionName, options) {
  if (actionName !== 'RefreshObjectCaches' && actionName !== 'DescribeRefreshTaskById')
    throw new Error('CDN 动作不合法');
  var credentials = cdnCredentials();
  var request = { Action: actionName, Version: '2018-05-10', Format: 'JSON',
    AccessKeyId: credentials.Id, SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0', SignatureNonce: V8.Method.NewGuid(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
  Object.keys(options).forEach(function (key) { request[key] = value(options[key]); });
  var query = Object.keys(request).sort().map(function (key) {
    return cdnEncode(key) + '=' + cdnEncode(request[key]);
  }).join('&');
  var signature = V8.Method.HmacSha1Sign('GET&%2F&' + cdnEncode(query), credentials.Secret + '&');
  var response = V8.Http.GetResponse({ Url: 'https://cdn.aliyuncs.com/?' + query
    + '&Signature=' + cdnEncode(signature), Timeout: 30,
    Headers: { Accept: 'application/json' } });
  var body = {};
  try { body = JSON.parse(value(response && response.Content) || '{}'); } catch (_) {}
  if (!response || Number(response.StatusCode) < 200 || Number(response.StatusCode) >= 300
      || (body.Code != null && value(body.Code) !== '0'))
    throw new Error('CDN 接口失败：' + value(body.Code || response && response.StatusCode));
  return body;
}
function putExact(path, bytes, expectedHash, isPrivate, immutable, sourcePath, replaceOriginalHash) {
  var existingDigest = digestOf(path, isPrivate, true);
  var existingUrl = existingDigest ? '' : isPrivate ? privateUrl(path, true) : publicUrl(path, expectedHash.substring(0, 12));
  var existing = existingUrl ? responseBytes(existingUrl, true) : null;
  if ((existingDigest && !existingDigest.Missing) || existing) {
    var existingHash = existingDigest ? existingDigest.Sha256 : sha256(existing);
    if (existingHash === expectedHash) return false;
    var replaceHashes = Array.isArray(replaceOriginalHash)
      ? replaceOriginalHash : [replaceOriginalHash];
    if (immutable && replaceHashes.indexOf(existingHash) < 0)
      throw new Error('历史版本路径已有不同内容：' + path);
  }
  if (V8.Method.CopyObject && sourcePath) {
    var copied = V8.Method.CopyObject({ OsClient: V8.OsClient,
      FilePathName: sourcePath, Path: path, Limit: isPrivate });
    if (!copied || copied.Code !== 1) throw new Error('服务端复制对象失败：' + path + '；' + value(copied && copied.Msg));
  } else {
    if (!bytes) throw new Error('旧后端缺少服务端复制能力：' + path);
    var name = trimSlash(path).split('/').pop();
    var files = {};
    files[name] = System.Convert.ToBase64String(bytes);
    var uploaded = V8.Method.Upload({
      OsClient: V8.OsClient,
      Path: 'mcp/official-ai-app-cdn-stage/' + appKey,
      FilesByteBase64: files,
      Limit: isPrivate,
      Preview: false
    });
    if (!uploaded || uploaded.Code !== 1) throw new Error('暂存对象失败：' + path);
    var data = uploaded.Data || {};
    var source = value(data.Path || data.FilePathName || data.FilePath || data.Url);
    if (!source && data.length && data[0]) source = value(data[0].Path || data[0].FilePathName);
    if (!source) throw new Error('暂存对象未返回路径：' + path);
    var moved = V8.Method.MoveObject({ OsClient: V8.OsClient, FilePathName: source, Path: path, Limit: isPrivate });
    if (!moved || moved.Code !== 1) throw new Error('投影对象失败：' + path + '；' + value(moved && moved.Msg));
  }
  var projectedDigest = digestOf(path, isPrivate, true);
  if (projectedDigest) {
    if (projectedDigest.Missing || projectedDigest.Sha256 !== expectedHash)
      throw new Error('投影对象流式哈希回读失败：' + path);
    return true;
  }
  var readbackUrl = isPrivate ? privateUrl(path, false) : publicUrl(path, expectedHash.substring(0, 12));
  var verified = false;
  for (var attempt = 0; attempt < 6; attempt++) {
    var readback = responseBytes(readbackUrl, true);
    if (readback && sha256(readback) === expectedHash) { verified = true; break; }
    System.Threading.Thread.Sleep(700);
  }
  if (!verified) throw new Error('投影对象哈希回读失败：' + path);
  return true;
}
function addLegacyHtmlDependencies(assets) {
  var known = {};
  assets.forEach(function (item) { known[trimSlash(item.Path).toLowerCase()] = true; });
  for (var i = 0; i < assets.length && i < 40; i++) {
    var htmlAsset = assets[i];
    if (!/\.html$/i.test(htmlAsset.Path)) continue;
    var sourcePath = trimSlash(htmlAsset.SourcePath);
    var bytes = responseBytes(publicUrl(sourcePath, ''), true);
    if (!bytes) continue;
    var html = System.Text.Encoding.UTF8.GetString(bytes);
    var matcher = /(?:(?:src|href)\s*=\s*|new\s+URL\s*\()\s*["']([^"']+\.(?:html?|js|mjs|css|wasm|svg|png|jpe?g|webp|gif|woff2?|ttf|ico)(?:\?[^"']*)?)["']/gi;
    var match;
    while ((match = matcher.exec(html)) !== null) {
      var relative = match[1].split('?')[0].replace(/\\/g, '/').replace(/^\.\//, '');
      if (!relative || relative.charAt(0) === '/' || relative.indexOf(':') >= 0
          || relative.split('/').some(function (part) { return !part || part === '.' || part === '..'; })) continue;
      var parent = trimSlash(htmlAsset.Path).split('/').slice(0, -1).join('/');
      var assetPath = parent ? parent + '/' + relative : relative;
      if (known[assetPath.toLowerCase()]) continue;
      var sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/') + 1);
      var dependencySource = sourceDir + relative;
      var dependencyBytes = responseBytes(publicUrl(dependencySource, ''), true);
      if (!dependencyBytes) continue;
      var stableSource = trimSlash(htmlAsset.StableSourcePath);
      var stableDir = stableSource ? stableSource.substring(0, stableSource.lastIndexOf('/') + 1) : '';
      assets.push({ Path: assetPath, SourcePath: dependencySource,
        StableSourcePath: stableDir ? stableDir + relative : '',
        Sha256: sha256(dependencyBytes), Size: byteLength(dependencyBytes), Legacy: true });
      known[assetPath.toLowerCase()] = true;
    }
  }
  return assets;
}
var compiledFileCache = null;
function compiledFilesForApp() {
  if (compiledFileCache) return compiledFileCache;
  compiledFileCache = [];
  for (var page = 1; page <= 100; page++) {
    var batch = rows('mci_ai_app_file', [['AppId', '=', appId]], 200, page, 'FilePath');
    compiledFileCache = compiledFileCache.concat(batch);
    if (batch.length < 200) return compiledFileCache;
  }
  throw new Error('分片编译文件记录超过 20000 条，需单独迁移');
}
function assetsOf(version) {
  if (Number(version.PublishProtocolVersion) === 2) {
    var log = {};
    try { log = JSON.parse(value(version.BuildLog) || '{}'); } catch (_) {}
    var legacy = Array.isArray(log.Assets) ? log.Assets.slice() : [];
    // 旧版分片发布只冻结了数量；优先从逐文件数据库记录恢复完整编译清单。
    if (!legacy.length && value(log.Mode) === 'BatchedCompiledAssets') {
      var versionPrefix = 'itdos/ai-app-publish/' + appKey + '/versions/' + value(version.VersionNo) + '/';
      var files = compiledFilesForApp();
      for (var fi = 0; fi < files.length; fi++) {
        var record = files[fi];
        var stored = trimSlash(record.HdfsPath);
        var relative = stored.indexOf(versionPrefix) === 0 ? stored.substring(versionPrefix.length) : '';
        if (!relative || !/^dist\//i.test(value(record.FilePath))
            || value(record.StorageScope).indexOf('PublicBuild') < 0) continue;
        if (relative.indexOf('..') >= 0 || !/^[a-f0-9]{64}$/i.test(value(record.ContentHash))
            || Number(record.Size) < 1) throw new Error('旧版编译文件记录无效：' + record.Id);
        legacy.push({ Path: relative, FilePathName: stored,
          // 分片旧版未冻结根目录副本；版本文件是唯一有哈希证明的来源。
          StableFilePathName: stored,
          Sha256: value(record.ContentHash).toLowerCase(), Size: Number(record.Size) });
      }
      if (!legacy.some(function (item) { return trimSlash(item.Path) === 'index.html'; })) {
        legacy.push({ Path: 'index.html', FilePathName: trimSlash(version.PublishPath), IsEntry: true });
      }
      if (Number(log.AssetCount) > 0 && legacy.length !== Number(log.AssetCount))
        throw new Error('旧版分片资产数量与数据库记录不符：' + version.VersionNo
          + ' (' + legacy.length + '/' + log.AssetCount + ')');
    }
    var aliases = Array.isArray(log.AliasManifest) ? log.AliasManifest : [];
    for (var li = 0; li < aliases.length; li++) {
      var alias = aliases[li];
      var aliasPath = trimSlash(alias.RelativePath);
      if (!aliasPath || legacy.some(function (item) { return trimSlash(item.Path) === aliasPath; })) continue;
      legacy.push({ Path: aliasPath, FilePathName: alias.VersionPath,
        StableFilePathName: alias.LatestPath || alias.RootPath,
        Sha256: alias.Sha256, Size: alias.Size });
    }
    if (legacy.length) return addLegacyHtmlDependencies(legacy.map(function (item) {
      var path = trimSlash(item.Path);
      var source = publicSourcePath(item.FilePathName || item.VersionUrl);
      var stableSource = publicSourcePath(item.StableFilePathName || item.LatestUrl);
      if (!path || path.indexOf('..') >= 0 || (!source && !stableSource))
        throw new Error('旧版资产清单路径不完整：' + version.VersionNo);
      return { Path: path, SourcePath: source,
        StableSourcePath: stableSource, Sha256: value(item.Sha256).toLowerCase(), Legacy: true };
    }));
    var entry = trimSlash(version.PublishPath);
    if (!entry || !/\/index\.html$/i.test(entry)) throw new Error('旧版缺少可读取的入口：' + version.VersionNo);
    return addLegacyHtmlDependencies([
      { Path: 'index.html', SourcePath: entry, Legacy: true, IndexOnly: true }
    ]);
  }
  var assets = JSON.parse(value(version.AssetManifestJson) || '[]');
  if (!assets.length || !value(version.ReleasePrefix)) throw new Error('版本缺少可验证的发布清单：' + version.VersionNo);
  return assets;
}
function validateAsset(asset, bytes) {
  var path = trimSlash(asset.Path);
  if (!path || path.indexOf('..') >= 0) throw new Error('发布资产路径不合法');
  var hash = value(asset.Sha256).toLowerCase();
  var actualHash = sha256(bytes);
  var actualSize = byteLength(bytes);
  if (!/^[a-f0-9]{64}$/.test(hash) || Number(asset.Size) !== actualSize || actualHash !== hash)
    throw new Error('发布资产长度或哈希不符：' + path + '；expected=' + asset.Size + '/' + hash +
      '；actual=' + actualSize + '/' + actualHash);
  return hash;
}
function legacyStableSource(asset) {
  if (asset.StableSourcePath) return asset.StableSourcePath;
  if (trimSlash(asset.Path).toLowerCase() === 'index.html') {
    var preview = value(app.PreviewUrl).replace(/^https:\/\/static\.itdos\.com\//i, '').split('?')[0];
    if (preview && preview !== value(app.PreviewUrl)) return trimSlash(preview);
  }
  return trimSlash(asset.SourcePath);
}
function sourceRows(appId) {
  var result = [];
  for (var page = 1; page <= 500; page++) {
    var files = rows('mci_ai_app_file', [['AppId', '=', appId]], 200, page, 'FilePath');
    for (var i = 0; i < files.length; i++) {
      var scope = value(files[i].StorageScope).toLowerCase();
      var path = trimSlash(files[i].FilePath).toLowerCase();
      var isPrivateSource = scope === 'private'
        || (!scope && !/^(build|dist|unpackage\/dist\/build\/h5)\//.test(path));
      if (isPrivateSource && Number(files[i].IsDeleted || 0) !== 1
          && value(files[i].HdfsPath) && path) result.push(files[i]);
    }
    if (files.length < 200) return result;
  }
  throw new Error('应用文件记录超过 100000 条，需单独迁移');
}
function sourceManifestHash(files) {
  if (!files.length) return '';
  var lines = files.map(function (file) {
    var path = trimSlash(file.FilePath).replace(/\\/g, '/').split('/').filter(Boolean).join('/');
    if (!path || path.split('/').some(function (part) { return part === '.' || part === '..'; }))
      throw new Error('源码文件路径不合法：' + file.FilePath);
    return path + '\t' + value(file.ContentHash).toLowerCase() + '\t' + Number(file.Size || 0);
  }).sort();
  return value(V8.EncryptHelper.SHA256(lines.join('\n'))).toLowerCase();
}
function validateSource(file, bytes) {
  if (Number(file.Size) > 0 && Number(file.Size) !== byteLength(bytes))
    throw new Error('源码长度不符：' + file.FilePath);
  var expected = value(file.ContentHash).toLowerCase();
  var actual = sha256(bytes);
  var wire = value(V8.EncryptHelper.SHA256(System.Convert.ToBase64String(bytes))).toLowerCase();
  if (expected && expected !== actual && expected !== wire)
    throw new Error('源码哈希不符：' + file.FilePath);
  return actual;
}
function validateSourceDigest(file, digest) {
  if (Number(file.Size) > 0 && Number(file.Size) !== digest.Size)
    throw new Error('源码长度不符：' + file.FilePath);
  var expected = value(file.ContentHash).toLowerCase();
  if (expected && expected !== digest.Sha256 && expected !== digest.WireSha256)
    throw new Error('源码哈希不符：' + file.FilePath);
  return digest.Sha256;
}
function verifiedCurrent() {
  var current = null;
  for (var i = 0; i < versions.length; i++)
    if (value(versions[i].Id) === value(app.CommittedPublishVersionId)) current = versions[i];
  if (!current || value(current.PublishState) !== 'Completed' || Number(current.PublishProtocolVersion) !== 3)
  {
    if (Number(app.PublishProtocolVersion) !== 2 || value(app.PublishState) !== 'LegacyUnverified')
      throw new Error('应用当前指针不是已完成的 v3 runtime 发布或旧版运行时');
    var legacy = versions.filter(function (item) {
      return Number(item.PublishProtocolVersion) === 2 && value(item.PublishState) === 'LegacyUnverified';
    });
    if (!legacy.length) throw new Error('旧版应用缺少运行时版本记录');
    current = legacy[legacy.length - 1];
  }
  return current;
}
function assertCurrentUnchanged() {
  var fresh = V8.FormEngine.GetFormData('sys_microistore', { Id: appId });
  if (!fresh || fresh.Code !== 1 || !fresh.Data
      || value(fresh.Data.CommittedPublishVersionId) !== value(app.CommittedPublishVersionId)
      || value(fresh.Data.PublishProtocolVersion) !== value(app.PublishProtocolVersion)
      || value(fresh.Data.CurrentVersion) !== value(app.CurrentVersion)
      || value(fresh.Data.PreviewUrl) !== value(app.PreviewUrl)
      || value(fresh.Data.AppKey || fresh.Data.AppId) !== appKey)
    throw new Error('迁移期间应用已发布新版本或 AppKey 已改变，请重新规划');
}
function sourceCheckpoint(file) {
  return 'Microi:' + tenant + ':CdnBackfill:source:' + appId + ':' + current.Id + ':'
    + file.Id + ':' + value(file.Version) + ':' + value(file.ContentHash) + ':' + value(file.HdfsPath);
}
function assetCheckpoint(version, asset, target) {
  return 'Microi:' + tenant + ':CdnBackfill:asset:' + appId + ':' + current.Id + ':'
    + version.Id + ':' + target + ':' + trimSlash(asset.Path);
}
/* 修复已提交运行版本缺失的 CDN 字面 @ 别名；复用既有引擎安全元数据。
 * 只复制冻结清单中哈希和大小一致的公有运行对象，不修改数据库、状态、指针或清单。
 * CopyObject 没有存储层原子 create-if-absent，前后校验不能消除并发写窗口；
 * 因而返回 AtomicCreateOnly:false，禁止与另一发布者并行修改同一固定路径。
 */
function readCommittedCdnAliasPrimaryRow(table, id) {
  // FormEngine 的读库由表配置决定；这里必须直接读当前租户主库，避免从库落后误认栅栏。
  // 两个完整 SELECT 均为固定白名单，调用方不能提供表名/字段/SQL；Id 始终参数化。
  var sql;
  if (table === 'sys_microistore')
    sql = 'SELECT Id,AppKey,CurrentVersion,PublishFence,PublishRowVersion,ActivePublishVersionId,CommittedPublishVersionId,CommittedRuntimeManifestHash,PublishState,IsDeleted FROM sys_microistore WHERE Id=@Id';
  else if (table === 'mci_ai_app_version')
    sql = 'SELECT Id,AppId,VersionNo,PublishProtocolVersion,PublishState,RequestId,RequestFingerprint,RuntimeManifestHash,FencingToken,ReleasePrefix,AssetManifestJson,EntryPath,IsDeleted FROM mci_ai_app_version WHERE Id=@Id';
  else throw new Error('主库发布绑定查询表不在固定白名单');
  if (!V8.Db || !V8.Db.FromSql) throw new Error('缺少可信主库读取能力');
  var row = V8.Db.FromSql(sql).AddInParameter('@Id', id).First();
  if (!row) throw new Error('重新读取主库发布绑定失败：' + table);
  if (Number(row.IsDeleted || 0) !== 0) throw new Error('发布对象已删除');
  return row;
}
function repairCommittedCdnAliases() {
  var p = V8.Param;
  var expected = {};
  var copied = [];
  var attempted = [];
  var inspected = [];
  var initialManifest = null;
  function requireText(name, pattern) {
    var text = value(p[name]);
    if (!text || !pattern.test(text)) throw new Error(name + ' 缺失或不合法');
    return text;
  }
  function same(actual, wanted, name) {
    if (value(actual) !== wanted) throw new Error('发布绑定变化或不匹配：' + name);
  }
  function integer(input, name, max) {
    var text = value(input);
    if (!/^(0|[1-9][0-9]*)$/.test(text) || Number(text) > max)
      throw new Error(name + ' 必须是范围内非负整数');
    return Number(text);
  }
  function freshBinding() {
    var store = readCommittedCdnAliasPrimaryRow('sys_microistore', appId);
    var version = readCommittedCdnAliasPrimaryRow('mci_ai_app_version', expected.VersionId);
    same(store.Id, appId, 'Store.Id');
    same(store.AppKey, expected.AppKey, 'Store.AppKey');
    same(version.Id, expected.VersionId, 'Version.Id');
    same(version.AppId, appId, 'Version.AppId');
    same(version.VersionNo, expected.VersionNo, 'Version.VersionNo');
    same(version.PublishProtocolVersion, '3', 'Version.Protocol');
    same(version.RequestId, expected.RequestId, 'Version.RequestId');
    same(version.RequestFingerprint, expected.RequestFingerprint, 'Version.RequestFingerprint');
    same(version.RuntimeManifestHash, expected.RuntimeManifestHash, 'Version.RuntimeManifestHash');
    same(store.CommittedPublishVersionId, expected.CommittedPublishVersionId, 'Store.CommittedVersionId');
    same(store.ActivePublishVersionId, expected.VersionId, 'Store.ActiveVersionId');
    same(store.CommittedRuntimeManifestHash, expected.CommittedRuntimeManifestHash, 'Store.CommittedHash');
    same(store.CurrentVersion, expected.CurrentVersion, 'Store.CurrentVersion');
    same(store.PublishFence, expected.PublishFence, 'Store.PublishFence');
    same(store.PublishRowVersion, expected.PublishRowVersion, 'Store.PublishRowVersion');
    same(version.FencingToken, expected.PublishFence, 'Version.FencingToken');
    var allowed = ['ProjectionPending', 'RepairRequired', 'Completed'];
    if (allowed.indexOf(value(store.PublishState)) < 0 || allowed.indexOf(value(version.PublishState)) < 0)
      throw new Error('仅允许当前 committed v3 的 ProjectionPending/RepairRequired/Completed');
    var prefix = 'microi/application-assets/v3/tenants/' + tenant + '/kinds/runtime/apps/'
      + expected.AppKey + '/releases/' + expected.VersionNo + '/requests/' + expected.RequestFingerprint;
    same(version.ReleasePrefix, prefix, 'Version.ReleasePrefix');
    if (initialManifest !== null && value(version.AssetManifestJson) !== initialManifest)
      throw new Error('冻结 AssetManifestJson 已变化');
    return { Store: store, Version: version };
  }
  function safePath(path) {
    // 本修复故意只接受 ASCII 运行路径，不解码；禁止外部 URL、根路径、百分号、反斜杠和点路径段。
    if (typeof path !== 'string' || !/^[A-Za-z0-9_.@/-]+$/.test(path)
        || path.charAt(0) === '/' || path.length > 512)
      throw new Error('冻结清单路径不安全');
    var parts = path.split('/');
    for (var pi = 0; pi < parts.length; pi++)
      if (!parts[pi] || parts[pi] === '.' || parts[pi] === '..') throw new Error('冻结清单路径段不安全');
    return path;
  }
  function readManifest(version) {
    var manifest = JSON.parse(value(version.AssetManifestJson) || 'null');
    if (!Array.isArray(manifest) || !manifest.length || manifest.length > 20000)
      throw new Error('冻结运行清单不是有效数组');
    var seen = {};
    var canonical = [];
    var aliases = [];
    var entryCount = 0;
    var total = 0;
    for (var mi = 0; mi < manifest.length; mi++) {
      var asset = manifest[mi];
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error('冻结清单项不合法');
      var path = safePath(asset.Path);
      var seenKey = '$' + path.toLowerCase();
      if (seen[seenKey]) throw new Error('冻结清单路径重复');
      seen[seenKey] = true;
      if (!/^[a-f0-9]{64}$/.test(value(asset.Sha256))) throw new Error('冻结资产 Sha256 不合法');
      var size = integer(asset.Size, '冻结资产 Size', 2147483648);
      total += size;
      if (total > 4294967296) throw new Error('冻结清单总大小超限');
      if (typeof asset.IsEntry !== 'boolean') throw new Error('冻结资产 IsEntry 不是 boolean');
      if (asset.IsEntry) {
        entryCount++;
        same(path, value(version.EntryPath), 'EntryPath');
      }
      canonical.push({ Path: path, Line: path + '\t' + asset.Sha256 + '\t' + size });
      if (path.indexOf('@') >= 0) {
        // 即使清单来自已提交版本，也只修复 Cocos 编译 import JSON，防止误公开脚本或私有源码。
        if (!/^assets\/[A-Za-z0-9_-]+\/import\/[a-f0-9]{2}\/[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+\.json$/.test(path)
            || asset.IsEntry || size > 1048576
            || /private|source/i.test(value(asset.StorageScope) + value(asset.Scope) + value(asset.Kind)))
          throw new Error('含 @ 的项不是允许修复的 Cocos public runtime import JSON');
        aliases.push({ Path: path, Sha256: asset.Sha256, Size: size, ManifestIndex: mi });
      }
    }
    if (entryCount !== 1) throw new Error('冻结清单必须有一个入口');
    canonical.sort(function (a, b) { return a.Path < b.Path ? -1 : a.Path > b.Path ? 1 : 0; });
    var lines = [];
    for (var ci = 0; ci < canonical.length; ci++) lines.push(canonical[ci].Line);
    // 与平台清单算法一致：Path 按 ordinal 排序，Path TAB Sha256 TAB Size，行间 LF，
    // UTF-8 SHA256；末尾无 LF，IsEntry 不参与摘要。
    var hash = value(V8.EncryptHelper.Sha256Hex(lines.join('\n'))).toLowerCase();
    same(hash, expected.RuntimeManifestHash, 'CanonicalManifestHash');
    return aliases;
  }
  function digest(path, optional, asset) {
    var actual = digestOf(path, false, optional);
    if (!actual) throw new Error('缺少可信存储摘要能力');
    if (actual.Missing) return actual;
    if (actual.Sha256 !== asset.Sha256 || actual.Size !== asset.Size)
      throw new Error('对象存在异字节，拒绝覆盖或作为来源：' + path);
    // Sha256 可能是解码后摘要，因此还要求 WireSha256 相同，拒绝压缩或转换过的物理对象。
    if (actual.WireSha256 !== asset.Sha256) throw new Error('对象 wire hash 与冻结字节不一致：' + path);
    return actual;
  }
  try {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(tenant)) throw new Error('当前租户标识不合法');
    if (Number(V8.CurrentUser && V8.CurrentUser.Level || 0) < 9999) throw new Error('仅平台管理员');
    var idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
    expected.AppKey = requireText('ExpectedAppKey', idPattern);
    expected.VersionId = requireText('ExpectedVersionId', idPattern);
    expected.VersionNo = requireText('ExpectedVersionNo', /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/);
    expected.RequestId = requireText('ExpectedRequestId', /^[A-Za-z0-9_.:@/-]{1,200}$/);
    expected.RequestFingerprint = requireText('ExpectedRequestFingerprint', /^[a-f0-9]{64}$/);
    expected.RuntimeManifestHash = requireText('ExpectedRuntimeManifestHash', /^[a-f0-9]{64}$/);
    expected.CommittedPublishVersionId = requireText('ExpectedCommittedPublishVersionId', idPattern);
    expected.CommittedRuntimeManifestHash = requireText('ExpectedCommittedRuntimeManifestHash', /^[a-f0-9]{64}$/);
    // 栅栏和行版本保持十进制字符串比较，避免 Int64 经 JS Number 损失精度。
    expected.CurrentVersion = requireText('ExpectedCurrentVersion', /^(0|[1-9][0-9]{0,18})$/);
    expected.PublishFence = requireText('ExpectedPublishFence', /^[1-9][0-9]{0,18}$/);
    expected.PublishRowVersion = requireText('ExpectedPublishRowVersion', /^[1-9][0-9]{0,18}$/);
    same(expected.AppKey, appKey, 'Requested.AppKey');
    same(expected.CommittedPublishVersionId, expected.VersionId, 'Requested.CommittedVersion');
    same(expected.CommittedRuntimeManifestHash, expected.RuntimeManifestHash, 'Requested.CommittedHash');
    var forbidden = ['SourcePath', 'StagePath', 'AssetPath', 'FilePathName', 'Path', 'DestPath', 'DestinationPath',
      'Bucket', 'BucketName', 'HDFS', 'Limit', 'FileByteBase64', 'ContentBase64', 'FilesByteBase64', 'AssetsJson',
      'AssetManifestJson', 'ReleasePrefix', 'PathsJson', 'SourceSnapshotPath', 'FileId'];
    for (var fi = 0; fi < forbidden.length; fi++)
      if (p[forbidden[fi]] !== undefined && p[forbidden[fi]] !== null)
        throw new Error('修复动作不接受调用方路径/来源参数：' + forbidden[fi]);
    if (!V8.Method.ObjectExist || !V8.Method.GetObjectSha256 || !V8.Method.CopyObject
        || !V8.EncryptHelper || !V8.EncryptHelper.Sha256Hex)
      throw new Error('缺少可信对象摘要、复制或清单哈希能力');
    var dryRun = p.DryRun === undefined || p.DryRun === null || value(p.DryRun) === 'true';
    if (!dryRun && value(p.DryRun) !== 'false') throw new Error('DryRun 只能是 true 或 false');
    var aliasStart = integer(p.AliasStart == null ? 0 : p.AliasStart, 'AliasStart', 19999);
    var aliasCount = integer(p.AliasCount == null ? 1 : p.AliasCount, 'AliasCount', 5);
    if (aliasCount < 1) throw new Error('AliasCount 必须在 1..5');
    var initial = freshBinding();
    initialManifest = value(initial.Version.AssetManifestJson);
    var aliases = readManifest(initial.Version);
    if (aliasStart >= aliases.length) throw new Error('AliasStart 超出含 @ 的运行资产列表');
    var selected = aliases.slice(aliasStart, aliasStart + aliasCount);
    var base = tenant + '/micro-app/' + expected.AppKey;
    var versionBase = base + '/' + expected.VersionNo;
    // 首次写入前预检本批所有来源和目标，不能先改前一项再发现后一项冲突。
    // 来源只从冻结清单派生版本目录编码对象；相对 key 保留字面 %40，禁止传会解码的 HTTPS URL。
    for (var ai = 0; ai < selected.length; ai++) {
      var asset = selected[ai];
      var source = versionBase + '/' + asset.Path.replace(/@/g, '%40');
      var targets = [versionBase + '/' + asset.Path, base + '/' + asset.Path];
      digest(source, false, asset);
      var targetStates = [];
      for (var ti = 0; ti < targets.length; ti++) {
        var targetState = digest(targets[ti], true, asset);
        targetStates.push({ Path: targets[ti], Missing: targetState.Missing === true });
      }
      inspected.push({ Asset: asset, Source: source, Targets: targetStates });
    }
    freshBinding();
    if (!dryRun) {
      for (var wi = 0; wi < inspected.length; wi++) {
        var work = inspected[wi];
        for (var di = 0; di < work.Targets.length; di++) {
          var destination = work.Targets[di].Path;
          // 批量上限很小仍逐写重新读取发布绑定，不能使用引擎开始时的旧 current 快照授权写入。
          freshBinding();
          digest(work.Source, false, work.Asset);
          var exists = digest(destination, true, work.Asset);
          if (!exists.Missing) continue;
          freshBinding();
          attempted.push(destination);
          var result = V8.Method.CopyObject({ OsClient: V8.OsClient, Limit: false,
            FilePathName: work.Source, Path: destination });
          if (!result || result.Code !== 1) throw new Error('别名复制失败：' + destination);
          // 对象存储写入不会随 V8 Code:0 回滚；后续校验失败也必须保留已尝试、已复制证据供回读。
          copied.push({ Path: destination, Sha256: work.Asset.Sha256, Size: work.Asset.Size });
          digest(destination, false, work.Asset);
          freshBinding();
        }
      }
    }
    var finalBinding = freshBinding();
    return ok({ Action: 'RepairCommittedCdnAliases', AppId: appId, AppKey: expected.AppKey,
      VersionId: expected.VersionId, VersionNo: expected.VersionNo, RequestId: expected.RequestId,
      RequestFingerprint: expected.RequestFingerprint, RuntimeManifestHash: expected.RuntimeManifestHash,
      DryRun: dryRun, AliasStart: aliasStart, AliasCount: selected.length, TotalAliases: aliases.length,
      NextAliasStart: aliasStart + selected.length < aliases.length ? aliasStart + selected.length : null,
      Inspected: inspected, Copied: copied, Attempted: attempted, StorePublishState: finalBinding.Store.PublishState,
      VersionPublishState: finalBinding.Version.PublishState, DatabaseChanged: false,
      PublicationCompletedByThisAction: false, AtomicCreateOnly: false });
  } catch (error) {
    return { Code: 0, Msg: value(error && error.message || error), Data: {
      Action: 'RepairCommittedCdnAliases', AppId: appId, Copied: copied, Attempted: attempted, DatabaseChanged: false,
      PublicationCompletedByThisAction: false, RequiresReadback: attempted.length > 0, AtomicCreateOnly: false } };
  }
}

var appId = value(V8.Param.AppId);
var action = value(V8.Param.Action || 'Plan');
if (Number(V8.CurrentUser && V8.CurrentUser.Level || 0) < 9999) return fail('仅平台管理员可迁移官方应用');
if (!appId || !/^[A-Za-z0-9_-]+$/.test(appId)) return fail('AppId 不合法');
if (['Plan', 'Copy', 'Status', 'Verify', 'Commit', 'Refresh', 'RefreshStatus', 'RepairAsset', 'RepairV3Upload', 'RepairV3Package', 'RepairV3Resolver', 'RepairV3Stage', 'ProbeCurrentV3', 'RepairCommittedCdnAliases'].indexOf(action) < 0) return fail('Action 不合法');
if (action !== 'Plan' && value(V8.Param.ConfirmAppId) !== appId) return fail('ConfirmAppId 必须等于 AppId');
var appResult = V8.FormEngine.GetFormData('sys_microistore', { Id: appId });
if (!appResult || appResult.Code !== 1 || !appResult.Data) return fail('应用不存在');
var app = appResult.Data;
var appKey = value(app.AppKey || app.AppId);
if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(appKey)) return fail('AppKey 不合法');
var tenant = value(V8.OsClient).toLowerCase();
var root = tenant + '/micro-app/' + appKey;
var fileServer = value(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, '');
if (!/^https:\/\//.test(fileServer)) return fail('公有文件域名必须是 HTTPS');
var versions = rows('mci_ai_app_version', [['AppId', '=', appId]], 200);
if (versions.length === 200) return fail('版本数超过单次可验证上限');
try {
  if (action === 'RepairCommittedCdnAliases') return repairCommittedCdnAliases();
  if (action === 'ProbeCurrentV3') {
    var probeCurrent = verifiedCurrent();
    if (Number(probeCurrent.PublishProtocolVersion) !== 3)
      throw new Error('当前版本不是已完成的 v3 发布');
    var probeAssets = assetsOf(probeCurrent);
    var probeStart = Math.max(0, Number(V8.Param.AssetStart || 0));
    var probeCount = Math.min(20, Math.max(1, Number(V8.Param.AssetCount || 10)));
    var probeSelected = probeAssets.slice(probeStart, probeStart + probeCount);
    var probeMissing = [];
    for (var pi = 0; pi < probeSelected.length; pi++) {
      var probeAsset = probeSelected[pi];
      var probePath = trimSlash(probeCurrent.ReleasePrefix) + '/assets/' + trimSlash(probeAsset.Path);
      var probeDigest = digestOf(probePath, false, true);
      if (!probeDigest || probeDigest.Missing) {
        probeMissing.push({ Path: probeAsset.Path, Sha256: value(probeAsset.Sha256).toLowerCase(),
          Size: Number(probeAsset.Size) });
      } else if (probeDigest.Sha256 !== value(probeAsset.Sha256).toLowerCase()
          || probeDigest.Size !== Number(probeAsset.Size)) {
        throw new Error('当前冻结资产已有不同字节：' + probeAsset.Path);
      }
    }
    return ok({ AppId: appId, AppKey: appKey, VersionNo: probeCurrent.VersionNo,
      AssetStart: probeStart, AssetCount: probeSelected.length, TotalAssets: probeAssets.length,
      Missing: probeMissing });
  }
  if (action === 'RepairV3Stage') {
    var stageVersionNo = value(V8.Param.VersionNo);
    var stageAssetPath = trimSlash(V8.Param.AssetPath);
    var stagePath = trimSlash(V8.Param.StagePath);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(stageVersionNo)
        || !stageAssetPath || stageAssetPath.indexOf('..') >= 0
        || stageAssetPath.split('/').some(function (part) { return !part || part === '.'; })
        || stagePath.indexOf(tenant + '/mcp/official-ai-app-cdn-recovery/' + appKey + '/') !== 0
        || stagePath.indexOf('..') >= 0)
      throw new Error('冻结资产或暂存路径不合法');
    var stageVersions = versions.filter(function (item) {
      return value(item.VersionNo) === stageVersionNo
        && Number(item.PublishProtocolVersion) === 3
        && value(item.PublishState) === 'Completed';
    });
    if (stageVersions.length !== 1) throw new Error('版本不是唯一已完成的 v3 发布');
    var stageAssets = assetsOf(stageVersions[0]).filter(function (item) {
      return trimSlash(item.Path) === stageAssetPath;
    });
    if (stageAssets.length !== 1) throw new Error('资产不在冻结的 v3 发布清单内');
    var stageHash = value(stageAssets[0].Sha256).toLowerCase();
    var stageSize = Number(stageAssets[0].Size);
    if (!/^[a-f0-9]{64}$/.test(stageHash) || stageSize < 1)
      throw new Error('冻结资产缺少可信哈希或长度');
    var incomingDigest = digestOf(stagePath, false, false);
    if (!incomingDigest || incomingDigest.Sha256 !== stageHash || incomingDigest.Size !== stageSize)
      throw new Error('暂存对象与冻结清单哈希或长度不符');
    var stageDestination = trimSlash(stageVersions[0].ReleasePrefix)
      + '/assets/' + stageAssetPath;
    var stageExisting = digestOf(stageDestination, false, true);
    if (stageExisting && !stageExisting.Missing) {
      if (stageExisting.Sha256 !== stageHash || stageExisting.Size !== stageSize)
        throw new Error('冻结 v3 目标已有不同字节，拒绝覆盖');
      return ok({ AppId: appId, VersionNo: stageVersionNo,
        AssetPath: stageAssetPath, State: 'AlreadyPresent', Sha256: stageHash, Size: stageSize });
    }
    var stageCopied = V8.Method.CopyObject({ OsClient: V8.OsClient,
      FilePathName: stagePath, Path: stageDestination, Limit: false });
    if (!stageCopied || stageCopied.Code !== 1)
      throw new Error('冻结 v3 资产复制失败：' + value(stageCopied && stageCopied.Msg));
    var stageReadback = digestOf(stageDestination, false, false);
    if (!stageReadback || stageReadback.Sha256 !== stageHash || stageReadback.Size !== stageSize)
      throw new Error('冻结 v3 资产回读哈希或长度不符');
    return ok({ AppId: appId, VersionNo: stageVersionNo,
      AssetPath: stageAssetPath, State: 'Recovered', Sha256: stageHash, Size: stageSize });
  }
  if (action === 'RepairV3Resolver') {
    var resolverCurrent = verifiedCurrent();
    if (Number(resolverCurrent.PublishProtocolVersion) !== 3)
      throw new Error('API 体验路由修复仅支持当前 v3 发布');
    var resolverAssets = assetsOf(resolverCurrent);
    var resolverStart = Math.max(0, Number(V8.Param.AssetStart || 0));
    var resolverCount = Math.min(10, Math.max(1, Number(V8.Param.AssetCount || 10)));
    var resolverSelected = resolverAssets.slice(resolverStart, resolverStart + resolverCount);
    var resolverMissing = [], resolverRepaired = [];
    for (var ra = 0; ra < resolverSelected.length; ra++) {
      var frozenResolverAsset = resolverSelected[ra];
      var resolverAssetPath = trimSlash(frozenResolverAsset.Path);
      if (!resolverAssetPath || resolverAssetPath.indexOf('..') >= 0
          || resolverAssetPath.split('/').some(function (part) { return !part || part === '.'; }))
        throw new Error('冻结资产路径不合法');
      var resolverHash = value(frozenResolverAsset.Sha256).toLowerCase();
      var resolverSize = Number(frozenResolverAsset.Size);
      if (!/^[a-f0-9]{64}$/.test(resolverHash) || resolverSize < 1 || resolverSize > 8 * 1024 * 1024)
        throw new Error('冻结资产无可信哈希或超过本恢复动作的 8MB 上限');
      var resolverDestination = trimSlash(resolverCurrent.ReleasePrefix)
        + '/assets/' + resolverAssetPath;
      var resolverExisting = digestOf(resolverDestination, false, true);
      if (resolverExisting && !resolverExisting.Missing) {
        if (resolverExisting.Sha256 !== resolverHash || resolverExisting.Size !== resolverSize)
          throw new Error('冻结 v3 对象已有不同字节：' + resolverAssetPath);
        continue;
      }
      resolverMissing.push(resolverAssetPath);
      var resolverUrl = 'https://api.itdos.com/micro-app/v3/tenants/' + tenant
        + '/kinds/runtime/apps/' + appKey + '/assets/' + resolverAssetPath;
      var resolverBytes = responseBytes(resolverUrl, false);
      if (byteLength(resolverBytes) !== resolverSize || sha256(resolverBytes) !== resolverHash)
        throw new Error('API 体验路由字节与当前冻结清单不符：' + resolverAssetPath);
      if (value(V8.Param.DryRun) === 'true') continue;
      assertCurrentUnchanged();
      if (putExact(resolverDestination, resolverBytes, resolverHash, false, true))
        resolverRepaired.push(resolverAssetPath);
    }
    return ok({ AppId: appId, AppKey: appKey, VersionNo: resolverCurrent.VersionNo,
      AssetStart: resolverStart, AssetCount: resolverSelected.length,
      TotalAssets: resolverAssets.length, MissingAssets: resolverMissing,
      RepairedAssets: resolverRepaired, DryRun: value(V8.Param.DryRun) === 'true' });
  }
  if (action === 'RepairV3Package') {
    var packageCurrent = verifiedCurrent();
    if (Number(packageCurrent.PublishProtocolVersion) !== 3)
      throw new Error('商城编译 ZIP 修复仅支持当前 v3 发布');
    var packageVersion = value(packageCurrent.VersionNo);
    var packageAssets = assetsOf(packageCurrent);
    var packageFiles = JSON.parse(value(app.AiAppZipFiles) || '[]');
    var buildPackages = packageFiles.filter(function (item) {
      var path = trimSlash(item.FilePathName);
      var currentPrefix = tenant + '/ai-app-packages/v3/' + appKey + '/'
        + packageVersion + '/build/';
      var legacyPrefix = tenant + '/microi/app-store/ai-app-packages/' + appKey + '/';
      var legacyName = appKey + '-' + packageVersion.replace(/\./g, '_') + '-build.zip';
      return value(item.FileRole) === 'Build'
        && (path.indexOf(currentPrefix) === 0
          || (path.indexOf(legacyPrefix) === 0 && path.split('/').pop() === legacyName));
    });
    if (buildPackages.length !== 1) throw new Error('当前版本没有唯一的官方编译 ZIP');
    var buildPackage = buildPackages[0];
    var packageHash = value(buildPackage.ContentSha256 || buildPackage.Sha256).toLowerCase();
    var wireHash = !buildPackage.ContentSha256
      && value(buildPackage.HashAlgorithm) === 'SHA256-Base64Text';
    var packageSize = Number(buildPackage.Size);
    if (!/^[a-f0-9]{64}$/.test(packageHash) || packageSize < 1 || packageSize > 8 * 1024 * 1024)
      throw new Error('编译 ZIP 无可信哈希或超过本恢复动作的 8MB 上限');
    var packageBytes = responseBytes(publicUrl(trimSlash(buildPackage.FilePathName), packageHash.substring(0, 12)), false);
    var actualPackageHash = wireHash
      ? value(V8.EncryptHelper.SHA256(System.Convert.ToBase64String(packageBytes))).toLowerCase()
      : sha256(packageBytes);
    if (byteLength(packageBytes) !== packageSize || actualPackageHash !== packageHash)
      throw new Error('官方编译 ZIP 字节与商城归档摘要不符');
    var extractedPackage = V8.Method.ExtractZip({ FileByteBase64: System.Convert.ToBase64String(packageBytes),
      MaxFileCount: 500, MaxEntryBytes: 16 * 1024 * 1024, MaxTotalBytes: 64 * 1024 * 1024 });
    if (!extractedPackage || extractedPackage.Code !== 1 || !extractedPackage.Data
        || !extractedPackage.Data.Entries) throw new Error('官方编译 ZIP 解包失败');
    var packageEntries = extractedPackage.Data.Entries;
    if (packageEntries.length !== packageAssets.length)
      throw new Error('商城 ZIP 文件数与冻结 v3 清单不符');
    var packageByPath = {};
    for (var pe = 0; pe < packageEntries.length; pe++) {
      var entryPath = trimSlash(packageEntries[pe].Path);
      if (packageByPath[entryPath]) throw new Error('商城 ZIP 存在重复资产路径');
      packageByPath[entryPath] = packageEntries[pe];
    }
    for (var pa = 0; pa < packageAssets.length; pa++) {
      var frozen = packageAssets[pa];
      var entry = packageByPath[trimSlash(frozen.Path)];
      if (!entry || value(entry.Sha256).toLowerCase() !== value(frozen.Sha256).toLowerCase()
          || Number(entry.Size) !== Number(frozen.Size))
        throw new Error('商城 ZIP 资产与冻结 v3 清单不符：' + frozen.Path);
    }
    var repairStart = Math.max(0, Number(V8.Param.AssetStart || 0));
    var repairCount = Math.min(10, Math.max(1, Number(V8.Param.AssetCount || 10)));
    var repairSelected = packageAssets.slice(repairStart, repairStart + repairCount);
    var missingAssets = [], repairedAssets = [];
    for (var rs = 0; rs < repairSelected.length; rs++) {
      var item = repairSelected[rs];
      var assetPath = trimSlash(item.Path);
      var destination = trimSlash(packageCurrent.ReleasePrefix) + '/assets/' + assetPath;
      var existing = digestOf(destination, false, true);
      if (existing && !existing.Missing) {
        if (existing.Sha256 !== value(item.Sha256).toLowerCase()
            || existing.Size !== Number(item.Size))
          throw new Error('冻结 v3 发布对象已有不同字节：' + assetPath);
        continue;
      }
      missingAssets.push(assetPath);
      if (value(V8.Param.DryRun) === 'true') continue;
      // 只有完整 ZIP 与逐文件冻结哈希都通过后才写入；目标已存在不同字节时失败关闭。
      var fileName = 'repair-' + value(V8.Method.NewGuid()).replace(/-/g, '') + '-' + assetPath.split('/').pop();
      var filesToUpload = {};
      filesToUpload[fileName] = value(packageByPath[assetPath].FileByteBase64);
      var staged = V8.Method.Upload({ OsClient: V8.OsClient,
        Path: 'mcp/official-ai-app-cdn-recovery/' + appKey,
        FilesByteBase64: filesToUpload, Limit: false, Preview: false });
      if (!staged || staged.Code !== 1) throw new Error('恢复资产暂存失败：' + assetPath);
      var stagedData = staged.Data || {};
      var stagedPath = value(stagedData.Path || stagedData.FilePathName || stagedData.FilePath || stagedData.Url);
      if (!stagedPath && stagedData.length && stagedData[0])
        stagedPath = value(stagedData[0].Path || stagedData[0].FilePathName);
      if (!stagedPath) throw new Error('恢复资产暂存未返回对象路径：' + assetPath);
      var stagedDigest = digestOf(stagedPath, false, false);
      if (!stagedDigest || stagedDigest.Sha256 !== value(item.Sha256).toLowerCase()
          || stagedDigest.Size !== Number(item.Size))
        throw new Error('恢复资产暂存哈希或长度不符：' + assetPath);
      var moved = V8.Method.MoveObject({ OsClient: V8.OsClient,
        FilePathName: stagedPath, Path: destination, Limit: false });
      if (!moved || moved.Code !== 1) throw new Error('冻结 v3 对象恢复失败：' + assetPath);
      var restored = digestOf(destination, false, false);
      if (!restored || restored.Sha256 !== value(item.Sha256).toLowerCase()
          || restored.Size !== Number(item.Size))
        throw new Error('冻结 v3 对象恢复回读失败：' + assetPath);
      repairedAssets.push(assetPath);
    }
    return ok({ AppId: appId, AppKey: appKey, VersionNo: packageVersion,
      AssetStart: repairStart, AssetCount: repairSelected.length,
      TotalAssets: packageAssets.length, MissingAssets: missingAssets,
      RepairedAssets: repairedAssets, DryRun: value(V8.Param.DryRun) === 'true' });
  }
  if (action === 'RepairV3Upload') {
    var repairVersionNo = value(V8.Param.VersionNo);
    var repairAssetPath = trimSlash(V8.Param.AssetPath);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repairVersionNo)
        || !repairAssetPath || repairAssetPath.indexOf('..') >= 0
        || repairAssetPath.split('/').some(function (part) { return !part || part === '.'; }))
      throw new Error('版本号或资产相对路径不合法');
    var repairVersion = versions.filter(function (item) {
      return value(item.VersionNo) === repairVersionNo && Number(item.PublishProtocolVersion) === 3
        && value(item.PublishState) === 'Completed';
    });
    if (repairVersion.length !== 1) throw new Error('版本不是唯一已完成的 v3 发布');
    var frozenAsset = assetsOf(repairVersion[0]).filter(function (item) {
      return trimSlash(item.Path) === repairAssetPath;
    });
    if (frozenAsset.length !== 1) throw new Error('资产不在冻结的 v3 发布清单内');
    var expectedHash = value(frozenAsset[0].Sha256).toLowerCase();
    var expectedSize = Number(frozenAsset[0].Size);
    if (!/^[a-f0-9]{64}$/.test(expectedHash) || expectedSize < 1)
      throw new Error('冻结资产缺少可信哈希或长度');
    var releasePrefix = trimSlash(repairVersion[0].ReleasePrefix);
    var repairDestination = releasePrefix + '/assets/' + repairAssetPath;
    var priorDigest = digestOf(repairDestination, false, true);
    if (priorDigest && !priorDigest.Missing) {
      if (priorDigest.Sha256 !== expectedHash || priorDigest.Size !== expectedSize)
        throw new Error('冻结发布对象已有不同字节，拒绝覆盖');
      return ok({ AppId: appId, VersionNo: repairVersionNo, AssetPath: repairAssetPath,
        State: 'AlreadyPresent', Sha256: expectedHash, Size: expectedSize });
    }
    // 发布会话暂存对象只按同应用、同版本、同相对路径和冻结哈希寻找；不接受外部任意路径。
    var uploadPath = 'upload/' + repairVersionNo + '/' + repairAssetPath;
    var uploadCandidates = rows('mci_ai_app_file',
      [['AppId', '=', appId], ['FilePath', '=', uploadPath]], 20);
    var uploadRows = uploadCandidates.filter(function (item) {
      return value(item.StorageScope) === 'ApplicationAssetMultipartSession'
        && value(item.ContentHash).toLowerCase() === expectedHash
        && Number(item.Size) === expectedSize
        && trimSlash(item.HdfsPath) === releasePrefix + '/.microi-upload/' + value(item.Id);
    });
    if (uploadRows.length !== 1) throw new Error('缺少唯一且匹配冻结清单的上传会话记录；路径候选数='
      + uploadCandidates.length + '，完整匹配数=' + uploadRows.length);
    var uploadSource = trimSlash(uploadRows[0].HdfsPath);
    var uploadDigest = digestOf(uploadSource, false, true);
    if (!uploadDigest || uploadDigest.Missing) throw new Error('上传会话暂存对象也已丢失');
    if (uploadDigest.Sha256 !== expectedHash || uploadDigest.Size !== expectedSize)
      throw new Error('上传会话暂存对象与冻结清单不符');
    if (value(V8.Param.DryRun) === 'true') return ok({ AppId: appId,
      VersionNo: repairVersionNo, AssetPath: repairAssetPath, State: 'Recoverable',
      Sha256: expectedHash, Size: expectedSize });
    var recovered = V8.Method.CopyObject({ OsClient: V8.OsClient,
      FilePathName: uploadSource, Path: repairDestination, Limit: false });
    if (!recovered || recovered.Code !== 1)
      throw new Error('恢复冻结发布对象失败：' + value(recovered && recovered.Msg));
    var recoveredDigest = digestOf(repairDestination, false, false);
    if (!recoveredDigest || recoveredDigest.Sha256 !== expectedHash
        || recoveredDigest.Size !== expectedSize)
      throw new Error('恢复后的发布对象哈希或长度回读不符');
    return ok({ AppId: appId, VersionNo: repairVersionNo, AssetPath: repairAssetPath,
      State: 'Recovered', Sha256: expectedHash, Size: expectedSize });
  }
  if (action === 'RepairAsset') {
    var repairCurrent = verifiedCurrent();
    if (Number(repairCurrent.PublishProtocolVersion) !== 2)
      throw new Error('仅可修复已审计的旧版编译资产');
    var fileId = value(V8.Param.FileId);
    if (!/^[A-Za-z0-9_-]+$/.test(fileId)) throw new Error('FileId 不合法');
    var fileResult = V8.FormEngine.GetFormData('mci_ai_app_file', { Id: fileId });
    var file = fileResult && fileResult.Code === 1 && fileResult.Data;
    if (!file || value(file.AppId) !== appId || Number(file.IsDeleted || 0) === 1)
      throw new Error('编译文件记录不属于该应用');
    var relativeAsset = value(file.FilePath).replace(/^dist\//i, '');
    var originalPath = trimSlash(file.HdfsPath);
    if (!/^dist\//i.test(value(file.FilePath)) || !relativeAsset || relativeAsset.indexOf('..') >= 0
        || value(file.StorageScope).indexOf('PublicBuild') < 0
        || originalPath !== 'itdos/ai-app-publish/' + appKey + '/versions/'
          + value(repairCurrent.VersionNo) + '/' + relativeAsset)
      throw new Error('文件记录未指向当前旧版编译目录');
    var frozenHash = value(file.ContentHash).toLowerCase();
    var frozenSize = Number(file.Size);
    if (!/^[a-f0-9]{64}$/.test(frozenHash) || frozenSize < 1)
      throw new Error('旧版编译记录缺少可信哈希或长度');
    var stage = trimSlash(V8.Param.StagePath);
    if (stage.indexOf(tenant + '/mcp/official-ai-app-cdn-recovery/' + appKey + '/') !== 0
        || stage.indexOf('..') >= 0) throw new Error('暂存文件路径不在本应用恢复目录');
    var stageDigest = digestOf(stage, false, false);
    if (!stageDigest || stageDigest.Sha256 !== frozenHash || stageDigest.Size !== frozenSize)
      throw new Error('暂存文件与冻结编译记录不一致');
    var repairTargets = [originalPath, root + '/' + value(repairCurrent.VersionNo)
      + '/' + relativeAsset, root + '/' + relativeAsset];
    var repaired = [];
    for (var targetIndex = 0; targetIndex < repairTargets.length; targetIndex++) {
      var target = repairTargets[targetIndex];
      var targetDigest = digestOf(target, false, true);
      if (targetDigest && !targetDigest.Missing && targetDigest.Sha256 === frozenHash
          && targetDigest.Size === frozenSize) continue;
      if (targetDigest && !targetDigest.Missing) {
        var oldResponse = V8.Http.GetResponse({ Url: publicUrl(target, ''), Timeout: 120 });
        if (!oldResponse || !/^\s*\{\s*"Code"\s*:\s*0\s*,/.test(value(oldResponse.Content).substring(0, 200)))
          throw new Error('目标已有非存储错误内容，拒绝覆盖：' + target);
      }
      var copied = V8.Method.CopyObject({ OsClient: V8.OsClient,
        FilePathName: stage, Path: target, Limit: false });
      if (!copied || copied.Code !== 1) throw new Error('修复对象复制失败：' + target);
      var check = digestOf(target, false, false);
      if (!check || check.Sha256 !== frozenHash || check.Size !== frozenSize)
        throw new Error('修复对象哈希回读失败：' + target);
      repaired.push(target);
    }
    return ok({ AppId: appId, FileId: fileId, RelativePath: relativeAsset,
      Sha256: frozenHash, Size: frozenSize, RepairedPaths: repaired });
  }
  if (action === 'Refresh') {
    if (fileServer !== 'https://static.itdos.com') throw new Error('CDN 域名不是官方静态域名');
    var refreshPaths = JSON.parse(value(V8.Param.PathsJson) || '[]');
    if (!Array.isArray(refreshPaths) || !refreshPaths.length || refreshPaths.length > 100)
      throw new Error('CDN 刷新路径必须为1至100个');
    var refreshUrls = [], seenRefresh = {};
    for (var ri = 0; ri < refreshPaths.length; ri++) {
      var relativeRefresh = trimSlash(refreshPaths[ri]);
      if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(relativeRefresh)
          || relativeRefresh.indexOf('..') >= 0 || relativeRefresh.indexOf('//') >= 0)
        throw new Error('CDN 刷新路径不合法');
      var exactUrl = publicUrl(root + '/' + relativeRefresh, '');
      if (!seenRefresh[exactUrl]) { seenRefresh[exactUrl] = true; refreshUrls.push(exactUrl); }
    }
    var refreshKey = 'Microi:' + tenant + ':CdnBackfill:refresh:' + appId + ':'
      + value(V8.EncryptHelper.SHA256(refreshUrls.join('\n'))).toLowerCase();
    var priorTask = value(V8.Cache.Get(refreshKey));
    if (priorTask) return ok({ AppId: appId, AppKey: appKey,
      RefreshTaskId: priorTask, UrlCount: refreshUrls.length, Reused: true });
    var submitted = cdnRpc('RefreshObjectCaches', {
      ObjectPath: refreshUrls.join('\n'), ObjectType: 'File'
    });
    if (!value(submitted.RefreshTaskId)) throw new Error('CDN 未返回刷新任务编号');
    V8.Cache.Set(refreshKey, value(submitted.RefreshTaskId), 86400);
    return ok({ AppId: appId, AppKey: appKey,
      RefreshTaskId: value(submitted.RefreshTaskId), UrlCount: refreshUrls.length });
  }
  if (action === 'RefreshStatus') {
    var refreshTaskId = value(V8.Param.TaskId);
    if (!/^[0-9]{1,30}$/.test(refreshTaskId)) throw new Error('CDN 刷新任务编号不合法');
    var statusResult = cdnRpc('DescribeRefreshTaskById', { TaskId: refreshTaskId });
    var tasks = statusResult.Tasks || [];
    if (!Array.isArray(tasks) || !tasks.length)
      return ok({ AppId: appId, TaskId: refreshTaskId, State: 'Pending' });
    var expectedTaskCount = Number(V8.Param.ExpectedCount || 0);
    // 阿里云会将同一时刻的多个 URL 合并为同一任务号；返回数量可大于本次提交。
    if (expectedTaskCount > 0 && tasks.length < expectedTaskCount)
      return ok({ AppId: appId, TaskId: refreshTaskId, State: 'Pending',
        CompleteCount: 0, TaskCount: tasks.length });
    var complete = 0;
    for (var ti = 0; ti < tasks.length; ti++) {
      if (value(tasks[ti].TaskId) !== refreshTaskId) throw new Error('CDN 刷新任务回读编号不符');
      var state = value(tasks[ti].Status);
      if (state === 'Complete') complete++;
      else if (state !== 'Refreshing') throw new Error('CDN 刷新任务失败：' + state);
    }
    return ok({ AppId: appId, TaskId: refreshTaskId,
      State: complete === tasks.length ? 'Complete' : 'Refreshing',
      CompleteCount: complete, TaskCount: tasks.length });
  }
  var current = verifiedCurrent();
  var historical = [], unavailableHistory = [];
  for (var v = 0; v < versions.length; v++) {
    if (Number(versions[v].PublishProtocolVersion) === 3 && value(versions[v].PublishState) === 'Completed')
      historical.push(versions[v]);
    else if (Number(versions[v].PublishProtocolVersion) === 2
      && value(versions[v].PublishState) === 'LegacyUnverified') {
      var versionDir = '/versions/' + value(versions[v].VersionNo).toLowerCase() + '/';
      var immutableAssets = [];
      try { immutableAssets = assetsOf(versions[v]); } catch (_) {}
      if (immutableAssets.length && immutableAssets.every(function (item) {
        var assetSource = '/' + trimSlash(item.SourcePath).toLowerCase();
        return assetSource.indexOf('/' + appKey.toLowerCase() + '/') >= 0
          && assetSource.indexOf(versionDir) >= 0;
      })) historical.push(versions[v]);
      else unavailableHistory.push(value(versions[v].VersionNo));
    }
  }
  // 旧版冻结对象确已丢失时，允许只迁移当前已发布版本以恢复固定体验入口。
  // 被排除的历史版本保持原记录和原路径，不能伪称已经归档成功。
  var historicalCount = historical.length;
  var currentOnly = value(V8.Param.CurrentOnly) === 'true';
  var deferredHistory = currentOnly ? historical.filter(function (item) {
    return value(item.Id) !== value(current.Id);
  }).map(function (item) { return value(item.VersionNo); }) : [];
  if (currentOnly) historical = historical.filter(function (item) {
    return value(item.Id) === value(current.Id);
  });
  var currentHasHistory = historical.some(function (item) {
    return value(item.Id) === value(current.Id);
  });
  var activeSources = sourceRows(appId);
  var frozenSourceVerified = Number(current.PublishProtocolVersion) === 3
    && activeSources.length > 0
    && sourceManifestHash(activeSources) === value(current.SourceManifestHash).toLowerCase();
  // A published binary can outlive its source rows. Never label current or
  // subsequently edited source bytes as that historical release's snapshot.
  var migratableSources = Number(current.PublishProtocolVersion) === 3 && !frozenSourceVerified
    ? [] : activeSources;
  var workVersions = historical.slice();
  if (!currentHasHistory) workVersions.push(current);
  if (action === 'Plan') {
    var plannedAssets = 0, indexOnlyVersions = [];
    for (var pv = 0; pv < workVersions.length; pv++) {
      var planned = assetsOf(workVersions[pv]);
      plannedAssets += planned.length;
      if (planned.some(function (item) { return item.IndexOnly; }))
        indexOnlyVersions.push(value(workVersions[pv].VersionNo));
    }
    return ok({ AppId: appId, AppKey: appKey, CurrentVersion: current.VersionNo,
      MigratableVersions: historical.map(function (v) { return v.VersionNo; }),
      MigratableAssetCount: plannedAssets, CurrentHistoricalSnapshotAvailable: currentHasHistory,
      IndexOnlyVersions: indexOnlyVersions,
      UnavailableHistory: unavailableHistory,
      DeferredHistory: deferredHistory,
      CurrentOnly: currentOnly,
      LegacyUnverifiedVersions: versions.length - historicalCount,
      SourceFiles: migratableSources.length,
      SourceRowsWithoutFrozenProof: activeSources.length - migratableSources.length,
      ActiveSourceManifestHash: sourceManifestHash(activeSources),
      FrozenSourceManifestHash: value(current.SourceManifestHash).toLowerCase(),
      HistoricalSourceSnapshotVerified: frozenSourceVerified,
      FixedPreviewUrl: publicUrl(root + '/index.html', '') });
  }
  var sourceStart = Math.max(0, Number(V8.Param.SourceStart || 0));
  var sourceCount = Math.min(20, Math.max(1, Number(V8.Param.SourceCount || 10)));
  var selectedSources = migratableSources.slice(sourceStart, sourceStart + sourceCount);
  if (action === 'Status') {
    var verifiedSources = 0;
    for (var ss = 0; ss < selectedSources.length; ss++) {
      var item = selectedSources[ss];
      var relativeSource = trimSlash(item.FilePath);
      var originalDigest = digestOf(item.HdfsPath, true, false);
      var original = originalDigest ? null : responseBytes(privateUrl(item.HdfsPath, false), false);
      var originalHash = originalDigest
        ? validateSourceDigest(item, originalDigest) : validateSource(item, original);
      var stableDigest = digestOf(root + '/' + relativeSource, true, true);
      var stableSource = stableDigest ? null
        : responseBytes(privateUrl(root + '/' + relativeSource, true), true);
      var hasFrozenSource = frozenSourceVerified;
      var historyPath = root + '/' + value(current.VersionNo) + '/' + relativeSource;
      var historyDigest = hasFrozenSource ? digestOf(historyPath, true, true) : null;
      var historySource = hasFrozenSource && !historyDigest
        ? responseBytes(privateUrl(historyPath, true), true) : null;
      var stableMatches = stableDigest ? !stableDigest.Missing && stableDigest.Sha256 === originalHash
        : stableSource && sha256(stableSource) === originalHash;
      var historyMatches = !hasFrozenSource || (historyDigest
        ? !historyDigest.Missing && historyDigest.Sha256 === originalHash
        : historySource && sha256(historySource) === originalHash);
      if (stableMatches && historyMatches)
      {
        verifiedSources++;
        V8.Cache.Set(sourceCheckpoint(item), originalHash, 86400);
      }
    }
    return ok({ AppId: appId, SourceStart: sourceStart, SourceCount: selectedSources.length,
      VerifiedSources: verifiedSources, TotalSources: migratableSources.length });
  }
  var copiedPublic = 0, copiedPrivate = 0, verifiedPublic = 0;
  var selectedAssets = [];
  for (var vi = 0; vi < workVersions.length && value(V8.Param.OnlySource) !== 'true'; vi++) {
    var version = workVersions[vi];
    var assets = assetsOf(version);
    for (var ai = 0; ai < assets.length; ai++) {
      selectedAssets.push({ Version: version, Asset: assets[ai] });
    }
  }
  var assetStart = Math.max(0, Number(V8.Param.AssetStart || 0));
  var assetCount = Math.min(10, Math.max(1, Number(V8.Param.AssetCount || 5)));
  var assetWork = action === 'Copy' || action === 'Verify'
    ? selectedAssets.slice(assetStart, assetStart + assetCount) : selectedAssets;
  for (var wi = 0; wi < assetWork.length; wi++) {
      var version = assetWork[wi].Version;
      var asset = assetWork[wi].Asset;
      var sourcePath = asset.Legacy ? trimSlash(asset.SourcePath)
        : trimSlash(version.ReleasePrefix) + '/assets/' + trimSlash(asset.Path);
      var versionPath = root + '/' + value(version.VersionNo) + '/' + trimSlash(asset.Path);
      var stablePath = root + '/' + trimSlash(asset.Path);
      var needsHistory = value(version.Id) !== value(current.Id) || currentHasHistory;
      if (action === 'Copy') {
        if (value(version.Id) === value(current.Id)) assertCurrentUnchanged();
        var sourceDigest = needsHistory ? digestOf(sourcePath, false, true) : null;
        var sourcePresent = sourceDigest && !sourceDigest.Missing;
        // 部分旧版对象的存储存在性索引已丢失，但 CDN 仍保留原字节。
        // 只接受与冻结清单一致的字节，并直接写入新的不可变版本目录。
        if (needsHistory && !sourcePresent && Number(asset.Size) > 8 * 1024 * 1024)
          throw new Error('旧版大文件需流式恢复：' + version.VersionNo + '/' + asset.Path);
        var bytes = needsHistory && !sourcePresent
          ? responseBytes(publicUrl(sourcePath, ''), false) : null;
        var hash = needsHistory ? sourcePresent ? sourceDigest.Sha256
          : asset.Legacy ? sha256(bytes) : validateAsset(asset, bytes) : '';
        if (sourcePresent && !asset.Legacy
            && (sourceDigest.Sha256 !== value(asset.Sha256).toLowerCase()
                || sourceDigest.Size !== Number(asset.Size)))
          throw new Error('v3 来源资产与冻结清单不符：' + version.VersionNo + '/' + asset.Path);
        if (needsHistory && asset.Legacy && asset.Sha256 && hash !== asset.Sha256)
          throw new Error('旧版资产与审计摘要不符：' + version.VersionNo + '/' + asset.Path);
        if (needsHistory) {
          var versionIndex = projectedIndex(asset, sourcePath, hash);
          if (putExact(versionPath, versionIndex ? versionIndex.Bytes : bytes,
            versionIndex ? versionIndex.Sha256 : hash, false, true,
            versionIndex || !sourcePresent ? null : sourcePath,
            versionIndex ? [hash, versionIndex.PreviousProjectionSha256] : '')) copiedPublic++;
        }
        if (value(version.Id) === value(current.Id)) {
          var currentSourcePath = asset.Legacy ? legacyStableSource(asset) : sourcePath;
          var currentDigest = currentSourcePath === sourcePath ? sourceDigest
            : digestOf(currentSourcePath, false, true);
          var currentPresent = currentDigest && !currentDigest.Missing;
          var currentBytes = currentPresent ? null
            : bytes && currentSourcePath === sourcePath ? bytes
              : responseBytes(publicUrl(currentSourcePath, ''), false);
          var currentHash = currentPresent ? currentDigest.Sha256
            : asset.Legacy ? sha256(currentBytes) : hash;
          if (asset.Legacy && asset.Sha256 && currentHash !== asset.Sha256)
            throw new Error('旧版当前资产与审计摘要不符：' + asset.Path);
          var stableIndex = projectedIndex(asset, currentSourcePath, currentHash);
          if (putExact(stablePath, stableIndex ? stableIndex.Bytes : currentBytes,
            stableIndex ? stableIndex.Sha256 : currentHash, false, false,
            stableIndex || !currentPresent ? null : currentSourcePath)) copiedPublic++;
        }
      } else if (action === 'Verify') {
        var verifySourceDigest = asset.Legacy && needsHistory ? digestOf(sourcePath, false, true) : null;
        var verifySourcePresent = verifySourceDigest && !verifySourceDigest.Missing;
        // Large legacy objects may have lost their old HDFS existence index while
        // their frozen SHA-256 and the repaired immutable target remain available.
        // Validate that target with its streamed digest below, without buffering
        // the legacy CDN response through Jint and timing out at the gateway.
        var frozenLargeSource = asset.Legacy && needsHistory && !verifySourcePresent
          && Number(asset.Size) > 8 * 1024 * 1024
          && /^[0-9a-f]{64}$/.test(value(asset.Sha256).toLowerCase());
        var sourceBytes = asset.Legacy && needsHistory && !verifySourcePresent && !frozenLargeSource
          ? responseBytes(publicUrl(sourcePath, ''), false) : null;
        var sourceHash = asset.Legacy && needsHistory
          ? verifySourcePresent ? verifySourceDigest.Sha256
            : frozenLargeSource ? value(asset.Sha256).toLowerCase() : sha256(sourceBytes)
          : value(asset.Sha256).toLowerCase();
        if (asset.Legacy && needsHistory && asset.Sha256 && sourceHash !== asset.Sha256)
          throw new Error('旧版来源资产审计摘要不符：' + version.VersionNo + '/' + asset.Path);
        var versionProjection = needsHistory ? projectedIndex(asset, sourcePath, sourceHash) : null;
        var versionExpectedHash = versionProjection ? versionProjection.Sha256 : sourceHash;
        var versionExpectedSize = versionProjection ? versionProjection.Size : Number(asset.Size);
        if (needsHistory) {
          var versionDigest = digestOf(versionPath, false, false);
          if (versionDigest) {
            if (versionDigest.Sha256 !== versionExpectedHash
                || (!asset.Legacy && versionDigest.Size !== versionExpectedSize))
              throw new Error('历史资产流式回读哈希或长度不符：' + versionPath);
          } else {
            var versionBytes = responseBytes(publicUrl(versionPath, ''), false);
            if (asset.Legacy && sha256(versionBytes) !== versionExpectedHash)
              throw new Error('历史资产回读哈希不符：' + versionPath);
            if (!asset.Legacy && sha256(versionBytes) !== versionExpectedHash)
              throw new Error('历史资产回读哈希不符：' + versionPath);
          }
          V8.Cache.Set(assetCheckpoint(version, asset, 'version'), versionExpectedHash, 86400);
          verifiedPublic++;
        }
        if (value(version.Id) === value(current.Id)) {
          var stableSourcePath = asset.Legacy ? legacyStableSource(asset) : sourcePath;
          var stableSourceDigest = asset.Legacy ? digestOf(stableSourcePath, false, false) : null;
          var stableSourceHash = asset.Legacy
            ? stableSourceDigest ? stableSourceDigest.Sha256
              : sha256(responseBytes(publicUrl(stableSourcePath, ''), false))
            : sourceHash;
          if (asset.Legacy && asset.Sha256 && stableSourceHash !== asset.Sha256)
            throw new Error('旧版当前来源资产审计摘要不符：' + asset.Path);
          var stableProjection = projectedIndex(asset, stableSourcePath, stableSourceHash);
          var stableExpectedHash = stableProjection ? stableProjection.Sha256 : stableSourceHash;
          var stableExpectedSize = stableProjection ? stableProjection.Size : Number(asset.Size);
          var stableDigest = digestOf(stablePath, false, false);
          if (stableDigest) {
            if (stableDigest.Sha256 !== stableExpectedHash
                || (!asset.Legacy && stableDigest.Size !== stableExpectedSize))
              throw new Error('固定资产流式回读哈希或长度不符：' + stablePath);
          } else {
            var stableBytes = responseBytes(publicUrl(stablePath, ''), false);
            if (asset.Legacy && sha256(stableBytes) !== stableExpectedHash)
              throw new Error('固定资产回读哈希不符：' + stablePath);
            if (!asset.Legacy && sha256(stableBytes) !== stableExpectedHash)
              throw new Error('固定资产回读哈希不符：' + stablePath);
          }
          V8.Cache.Set(assetCheckpoint(version, asset, 'stable'), stableExpectedHash, 86400);
          verifiedPublic++;
        }
      }
  }
  if (action === 'Copy') {
    var sourceFiles = value(V8.Param.OnlyAssets) === 'true' ? [] : selectedSources;
    for (var si = 0; si < sourceFiles.length; si++) {
      var sourceFile = sourceFiles[si];
      var relative = trimSlash(sourceFile.FilePath);
      if (!relative || relative.indexOf('..') >= 0) throw new Error('源码相对路径不合法');
      var sourceDigest = digestOf(sourceFile.HdfsPath, true, false);
      var sourceBytes = sourceDigest ? null
        : responseBytes(privateUrl(sourceFile.HdfsPath, false), false);
      var sourceHash = sourceDigest
        ? validateSourceDigest(sourceFile, sourceDigest)
        : validateSource(sourceFile, sourceBytes);
      if (frozenSourceVerified
          && putExact(root + '/' + value(current.VersionNo) + '/' + relative,
            sourceBytes, sourceHash, true, true, sourceFile.HdfsPath)) copiedPrivate++;
      if (putExact(root + '/' + relative, sourceBytes, sourceHash, true, false, sourceFile.HdfsPath)) copiedPrivate++;
    }
    return ok({ AppId: appId, AppKey: appKey, CurrentVersion: current.VersionNo,
      CopiedPublicObjects: copiedPublic, CopiedPrivateObjects: copiedPrivate,
      DeferredHistory: deferredHistory,
      VersionCount: historical.length, AssetStart: assetStart, AssetCount: assetWork.length,
      TotalAssets: selectedAssets.length, SourceStart: sourceStart,
      SourceFileCount: sourceFiles.length, TotalSourceFiles: migratableSources.length,
      FixedPreviewUrl: publicUrl(root + '/index.html', '') });
  }
  if (action === 'Verify') return ok({ AppId: appId, AppKey: appKey,
    VerifiedPublicObjects: verifiedPublic, AssetStart: assetStart,
    AssetCount: assetWork.length, TotalAssets: selectedAssets.length,
    VersionCount: historical.length,
    FixedPreviewUrl: publicUrl(root + '/index.html', '') });
  assertCurrentUnchanged();
  var allSources = migratableSources;
  for (var ci = 0; ci < allSources.length; ci++) {
    var sourceRow = allSources[ci];
    if (!/^[a-f0-9]{64}$/.test(value(V8.Cache.Get(sourceCheckpoint(sourceRow))).toLowerCase()))
      throw new Error('私有源码未逐文件完成哈希回读：' + sourceRow.FilePath);
  }
  for (var ac = 0; ac < selectedAssets.length; ac++) {
    var checkedVersion = selectedAssets[ac].Version;
    var checkedAsset = selectedAssets[ac].Asset;
    var withHistory = value(checkedVersion.Id) !== value(current.Id) || currentHasHistory;
    var versionProof = withHistory ? value(V8.Cache.Get(assetCheckpoint(checkedVersion, checkedAsset, 'version'))) : '';
    var fixedProof = value(checkedVersion.Id) === value(current.Id)
      ? value(V8.Cache.Get(assetCheckpoint(checkedVersion, checkedAsset, 'stable'))) : '';
    if ((withHistory && !/^[a-f0-9]{64}$/.test(versionProof))
      || (value(checkedVersion.Id) === value(current.Id) && !/^[a-f0-9]{64}$/.test(fixedProof)))
      throw new Error('CDN 资产尚未逐文件完成哈希回读：' + checkedVersion.VersionNo + '/' + checkedAsset.Path);
    if (Number(checkedVersion.PublishProtocolVersion) === 3
        && trimSlash(checkedAsset.Path).toLowerCase() !== 'index.html'
        && ((withHistory && versionProof !== value(checkedAsset.Sha256).toLowerCase())
          || (value(checkedVersion.Id) === value(current.Id)
            && fixedProof !== value(checkedAsset.Sha256).toLowerCase())))
      throw new Error('CDN 资产回读摘要与 v3 发布清单不符：' + checkedVersion.VersionNo + '/' + checkedAsset.Path);
  }
  var currentEntryProof = '';
  for (var ep = 0; ep < selectedAssets.length; ep++) {
    if (value(selectedAssets[ep].Version.Id) === value(current.Id)
        && trimSlash(selectedAssets[ep].Asset.Path).toLowerCase() === 'index.html')
      currentEntryProof = value(V8.Cache.Get(assetCheckpoint(current, selectedAssets[ep].Asset, 'stable')));
  }
  if (!currentEntryProof || sha256(responseBytes(publicUrl(root + '/index.html', ''), false)) !== currentEntryProof)
    throw new Error('固定入口在最终提交前发生变化');
  for (var hi = 0; hi < historical.length; hi++) {
    var history = historical[hi];
    var versionPreview = '/' + root + '/' + value(history.VersionNo) + '/index.html';
    var versionPatch = { Id: history.Id, PreviewUrl: versionPreview };
    if (value(history.Id) === value(current.Id) && allSources.length
        && frozenSourceVerified)
      versionPatch.SourceSnapshotPath = '/' + root + '/' + value(current.VersionNo);
    var versionUpdated = V8.FormEngine.UptFormData('mci_ai_app_version', versionPatch);
    if (!versionUpdated || versionUpdated.Code !== 1) throw new Error('版本入口更新失败：' + history.VersionNo);
  }
  var previewPath = '/' + root + '/index.html';
  assertCurrentUnchanged();
  var appUpdated = V8.FormEngine.UptFormData('sys_microistore', {
    Id: appId, PreviewUrl: previewPath, PublicPublishPath: previewPath
  });
  if (!appUpdated || appUpdated.Code !== 1) throw new Error('应用固定入口更新失败');
  return ok({ AppId: appId, AppKey: appKey, CurrentVersion: current.VersionNo,
    VerifiedPublicObjects: selectedAssets.length, VersionCount: historical.length,
    DeferredHistory: deferredHistory,
    FixedPreviewUrl: publicUrl(root + '/index.html', '') });
} catch (error) { return fail(value(error && error.message || error)); }
