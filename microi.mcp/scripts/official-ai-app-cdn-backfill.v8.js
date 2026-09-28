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
  if (!hashed || hashed.Code !== 1 || !hashed.Data)
    throw new Error('对象流式哈希失败：' + path + '；' + value(hashed && hashed.Msg));
  return { Sha256: value(hashed.Data.Sha256).toLowerCase(),
    WireSha256: value(hashed.Data.WireSha256).toLowerCase(), Size: Number(hashed.Data.Size) };
}
function putExact(path, bytes, expectedHash, isPrivate, immutable, sourcePath) {
  var existingDigest = digestOf(path, isPrivate, true);
  var existingUrl = existingDigest ? '' : isPrivate ? privateUrl(path, true) : publicUrl(path, expectedHash.substring(0, 12));
  var existing = existingUrl ? responseBytes(existingUrl, true) : null;
  if ((existingDigest && !existingDigest.Missing) || existing) {
    var existingHash = existingDigest ? existingDigest.Sha256 : sha256(existing);
    if (existingHash === expectedHash) return false;
    if (immutable) throw new Error('历史版本路径已有不同内容：' + path);
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
function assetsOf(version) {
  if (Number(version.PublishProtocolVersion) === 2) {
    var log = {};
    try { log = JSON.parse(value(version.BuildLog) || '{}'); } catch (_) {}
    var legacy = Array.isArray(log.Assets) ? log.Assets.slice() : [];
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
var appId = value(V8.Param.AppId);
var action = value(V8.Param.Action || 'Plan');
if (Number(V8.CurrentUser && V8.CurrentUser.Level || 0) < 9999) return fail('仅平台管理员可迁移官方应用');
if (!appId || !/^[A-Za-z0-9_-]+$/.test(appId)) return fail('AppId 不合法');
if (['Plan', 'Copy', 'Status', 'Verify', 'Commit'].indexOf(action) < 0) return fail('Action 不合法');
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
      LegacyUnverifiedVersions: versions.length - historical.length,
      SourceFiles: migratableSources.length,
      SourceRowsWithoutFrozenProof: activeSources.length - migratableSources.length,
      ActiveSourceManifestHash: sourceManifestHash(activeSources),
      FrozenSourceManifestHash: value(current.SourceManifestHash).toLowerCase(),
      HistoricalSourceSnapshotVerified: frozenSourceVerified,
      FixedPreviewUrl: publicUrl(root + '/index.html', '') });
  }
  var sourceStart = Math.max(0, Number(V8.Param.SourceStart || 0));
  var sourceCount = Math.min(10, Math.max(1, Number(V8.Param.SourceCount || 3)));
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
  var assetCount = Math.min(5, Math.max(1, Number(V8.Param.AssetCount || 2)));
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
        var sourceDigest = needsHistory ? digestOf(sourcePath, false, false) : null;
        var bytes = needsHistory && !sourceDigest
          ? responseBytes(publicUrl(sourcePath, value(asset.Sha256).substring(0, 12)), false) : null;
        var hash = needsHistory ? sourceDigest ? sourceDigest.Sha256
          : asset.Legacy ? sha256(bytes) : validateAsset(asset, bytes) : '';
        if (sourceDigest && !asset.Legacy
            && (sourceDigest.Sha256 !== value(asset.Sha256).toLowerCase()
                || sourceDigest.Size !== Number(asset.Size)))
          throw new Error('v3 来源资产与冻结清单不符：' + version.VersionNo + '/' + asset.Path);
        if (needsHistory && asset.Legacy && asset.Sha256 && hash !== asset.Sha256)
          throw new Error('旧版资产与审计摘要不符：' + version.VersionNo + '/' + asset.Path);
        if (needsHistory)
          if (putExact(versionPath, bytes, hash, false, true, sourcePath)) copiedPublic++;
        if (value(version.Id) === value(current.Id)) {
          var currentSourcePath = asset.Legacy ? legacyStableSource(asset) : sourcePath;
          var currentDigest = currentSourcePath === sourcePath ? sourceDigest
            : digestOf(currentSourcePath, false, false);
          var currentBytes = currentDigest ? null
            : bytes && currentSourcePath === sourcePath ? bytes
              : responseBytes(publicUrl(currentSourcePath, ''), false);
          var currentHash = currentDigest ? currentDigest.Sha256
            : asset.Legacy ? sha256(currentBytes) : hash;
          if (asset.Legacy && asset.Sha256 && currentHash !== asset.Sha256)
            throw new Error('旧版当前资产与审计摘要不符：' + asset.Path);
          if (putExact(stablePath, currentBytes, currentHash, false, false, currentSourcePath)) copiedPublic++;
        }
      } else if (action === 'Verify') {
        var sourceBytes = asset.Legacy && needsHistory ? responseBytes(publicUrl(sourcePath, ''), false) : null;
        var sourceHash = asset.Legacy && needsHistory ? sha256(sourceBytes) : value(asset.Sha256).toLowerCase();
        if (asset.Legacy && needsHistory && asset.Sha256 && sourceHash !== asset.Sha256)
          throw new Error('旧版来源资产审计摘要不符：' + version.VersionNo + '/' + asset.Path);
        if (needsHistory) {
          var versionBytes = responseBytes(publicUrl(versionPath, ''), false);
          if (asset.Legacy && sha256(versionBytes) !== sourceHash)
            throw new Error('历史资产回读哈希不符：' + versionPath);
          if (!asset.Legacy) validateAsset(asset, versionBytes);
          if (action === 'Verify') V8.Cache.Set(assetCheckpoint(version, asset, 'version'), sourceHash, 86400);
          verifiedPublic++;
        }
        if (value(version.Id) === value(current.Id)) {
          var stableBytes = responseBytes(publicUrl(stablePath, ''), false);
          var stableSourceHash = asset.Legacy
            ? sha256(responseBytes(publicUrl(legacyStableSource(asset), ''), false)) : sourceHash;
          if (asset.Legacy && asset.Sha256 && stableSourceHash !== asset.Sha256)
            throw new Error('旧版当前来源资产审计摘要不符：' + asset.Path);
          if (asset.Legacy && sha256(stableBytes) !== stableSourceHash)
            throw new Error('固定资产回读哈希不符：' + stablePath);
          if (!asset.Legacy) validateAsset(asset, stableBytes);
          if (action === 'Verify') V8.Cache.Set(assetCheckpoint(version, asset, 'stable'), stableSourceHash, 86400);
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
    FixedPreviewUrl: publicUrl(root + '/index.html', '') });
} catch (error) { return fail(value(error && error.message || error)); }
