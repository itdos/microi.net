/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_build
 * Version: v1.4.4
 * Function:
 * - AI 应用编译发布引擎：校验真实编译产物，将每个版本发布到不可变历史目录，同时原子提升无版本固定入口为最新版本；支持 VS Code 仅发布应用商城和固定最新版修复。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || "成功" }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || "执行失败" }; }
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || "";
  return String(value);
}
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, "") === ""; }
function now() { return DateNow("yyyy-MM-dd HH:mm:ss"); }
function toArray(value) {
  var list = [];
  if (!value || value.length === undefined) return list;
  for (var i = 0; i < value.length; i++) list.push(value[i]);
  return list;
}

/* TENANT_RUNTIME_CONTEXT_V1 */
function runtimeContextJson() {
  var apiBase = "";
  try { apiBase = text(V8.SysConfig && V8.SysConfig.ApiBase); } catch (error) { apiBase = ""; }
  apiBase = apiBase.replace(/\/+$/, "");
  if (isBlank(apiBase)) return "";
  return JSON.stringify({ ApiBase: apiBase, OsClient: text(V8.OsClient) })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
function injectRuntimeContext(html) {
  var source = text(html);
  var contextJson = runtimeContextJson();
  if (isBlank(contextJson) || source.indexOf('data-microi-runtime-context="true"') >= 0) return source;
  var script = '<script data-microi-runtime-context="true">(function(){var c=' + contextJson + ';window.__MICROI_APP_CONTEXT__=Object.assign({},window.__MICROI_APP_CONTEXT__||{},c);window.MICROI_API_BASE=c.ApiBase;window.MICROI_OS_CLIENT=c.OsClient;})();<\/script>';
  var head = /<head\b[^>]*>/i.exec(source);
  if (!head) return script + source;
  var insertAt = head.index + head[0].length;
  return source.substring(0, insertAt) + script + source.substring(insertAt);
}

function normalizeVersion(value) {
  var raw = text(value, "v1.0.0").replace(/^v/i, "");
  var parts = raw.split(".");
  if (parts.length >= 3) return "v" + (parseInt(parts[0]) || 1) + "." + (parseInt(parts[1]) || 0) + "." + (parseInt(parts[2]) || 0);
  var legacy = parseInt(raw);
  return "v1.0." + Math.max(0, (isNaN(legacy) ? 1 : legacy) - 1);
}
function nextSemanticVersion(value) {
  var parts = normalizeVersion(value).substring(1).split(".");
  var major = parseInt(parts[0]) || 1;
  var minor = parseInt(parts[1]) || 0;
  var patch = (parseInt(parts[2]) || 0) + 1;
  if (patch > 9) { patch = 0; minor++; }
  if (minor > 9) { minor = 0; major++; }
  return "v" + major + "." + minor + "." + patch;
}

function newId() { return V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid(); }
function normalizePath(path) {
  path = text(path).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  var parts = path.split("/");
  var safe = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p || p === "." || p === "..") continue;
    safe.push(p.replace(/[:*?"<>|]/g, "_"));
  }
  return safe.join("/");
}
function fileNameOf(path) {
  var p = normalizePath(path);
  var arr = p.split("/");
  return arr[arr.length - 1] || p;
}
function dirOf(path) {
  var p = normalizePath(path);
  var idx = p.lastIndexOf("/");
  return idx > -1 ? p.substring(0, idx) : "";
}
function uploadText(path, filePath, content, limit) {
  var dir = dirOf(filePath);
  var name = fileNameOf(filePath);
  var uploadPath = path + (dir ? "/" + dir : "");
  var files = {};
  files[name] = V8.Base64.StringToBase64(text(content));
  var result = V8.Method.Upload({
    OsClient: V8.OsClient,
    Path: uploadPath,
    Limit: limit === true,
    Preview: false,
    FilesByteBase64: files
  });
  if (!result || result.Code !== 1) return result || fail("上传失败");
  var data = result.Data || {};
  var hdfsPath = data.Path || data.path || data.FilePath || data.FilePathName || data.Url || "";
  if (!hdfsPath && data.length && data[0]) {
    hdfsPath = data[0].Path || data[0].FilePath || data[0].FilePathName || data[0].Url || "";
  }
  return ok({ HdfsPath: hdfsPath, Raw: data });
}
function uploadBase64(path, filePath, fileByteBase64, limit) {
  var dir = dirOf(filePath);
  var name = fileNameOf(filePath);
  var uploadPath = path + (dir ? "/" + dir : "");
  var files = {};
  files[name] = text(fileByteBase64);
  var result = V8.Method.Upload({
    OsClient: V8.OsClient,
    Path: uploadPath,
    Limit: limit === true,
    Preview: false,
    FilesByteBase64: files
  });
  if (!result || result.Code !== 1) return result || fail("上传失败");
  var data = result.Data || {};
  var hdfsPath = data.Path || data.path || data.FilePath || data.FilePathName || data.Url || "";
  if (!hdfsPath && data.length && data[0]) {
    hdfsPath = data[0].Path || data[0].FilePath || data[0].FilePathName || data[0].Url || "";
  }
  return ok({ HdfsPath: hdfsPath, Raw: data });
}
function readText(hdfsPath, limit) {
  if (isBlank(hdfsPath)) return ok("");
  if (V8.Method.GetPrivateFileText) {
    var result = V8.Method.GetPrivateFileText({
      OsClient: V8.OsClient,
      FilePathName: hdfsPath,
      Limit: limit !== false
    });
    if (!result || result.Code !== 1) return result || fail("读取文件失败");
    return ok(text(result.Data));
  }
  var urlResult = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient,
    FilePathName: hdfsPath,
    Limit: limit !== false
  });
  if (!urlResult || urlResult.Code !== 1) return urlResult || fail("读取文件地址失败");
  var data = urlResult.Data;
  var url = typeof data === "string" ? data : text(data.Url || data.url || data.FileUrl || data.Path || "");
  if (isBlank(url)) return fail("读取文件地址为空");
  var content = V8.Http.Get({ Url: url });
  return ok(text(content));
}
function getFileUrl(hdfsPath, limit) {
  if (isBlank(hdfsPath)) return "";
  var result = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient,
    FilePathName: hdfsPath,
    Limit: limit === true
  });
  if (!result || result.Code !== 1) return hdfsPath;
  var data = result.Data;
  if (typeof data === "string") return data;
  return data && (data.Url || data.url || data.FileUrl || data.Path) ? text(data.Url || data.url || data.FileUrl || data.Path) : hdfsPath;
}
function publicDomainUrl(hdfsPath) {
  if (isBlank(hdfsPath)) return "";
  var domain = "";
  try {
    domain = text(V8.SysConfig && V8.SysConfig.FileServer);
  } catch (e) {}
  if (isBlank(domain)) return "";
  return domain.replace(/\/+$/, "") + "/" + text(hdfsPath).replace(/^\/+/, "");
}
function stablePublishPath(appKey) {
  return text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + text(appKey) + "/index.html";
}
function movePublicObject(sourcePath, targetPath) {
  if (isBlank(sourcePath) || isBlank(targetPath)) return { Code: 0, Msg: "源路径或目标路径为空" };
  try {
    return V8.Method.MoveObject({
      OsClient: V8.OsClient,
      FilePathName: sourcePath,
      Path: targetPath,
      Limit: false
    });
  } catch (e) {
    return { Code: 0, Msg: "MoveObject不可用：" + e.message };
  }
}
function normalizeAppKey(value, fallback) {
  var raw = text(value);
  if (isBlank(raw)) raw = text(fallback);
  raw = raw.toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (isBlank(raw)) raw = "app-" + text(newId()).toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 12);
  if (!/^[a-z]/.test(raw)) raw = "app-" + raw;
  if (raw.length > 80) raw = raw.substring(0, 80).replace(/[-_]+$/g, "");
  return raw;
}
function ensureAppKey(app) {
  var key = normalizeAppKey(app.AppKey, app.Name || app.Id);
  if (isBlank(app.AppKey) && !isBlank(app.Id)) {
    V8.FormEngine.UptFormData("sys_microistore", { Id: app.Id, AppKey: key });
  }
  return key;
}
function getApp(appId) {
  return V8.FormEngine.GetFormData("sys_microistore", {
    _Where: [["Id", "=", appId]],
    _SelectFields: ["Id", "Name", "AppKey", "AppType", "ApplicationType", "Description", "AppPreview", "Status", "OwnerUserId", "OwnerName", "CurrentVersion", "PreviewUrl", "PublicPublishPath", "PrivateSourcePath", "BuildStatus", "LastBuildTaskId", "LastBuildMsg", "CreateTime", "UpdateTime"]
  });
}
function getFiles(appId) {
  return V8.FormEngine.GetTableData("mci_ai_app_file", {
    _Where: [["AppId", "=", appId]],
    _SelectFields: ["Id", "AppId", "AppName", "VersionId", "FilePath", "FileName", "FileType", "HdfsPath", "PublishHdfsPath", "StorageScope", "ContentHash", "Size", "Version", "IsDirectory", "CreateTime", "UpdateTime"],
    _OrderBy: "FilePath",
    _OrderByType: "ASC",
    _PageSize: 1000
  });
}
/* REAL_COMPILED_DIST_V1 */
function readFileBase64(file) {
  if (!file || isBlank(file.HdfsPath)) return fail("源码文件地址为空");
  var urlResult = V8.Method.GetPrivateFileUrl({
    OsClient: V8.OsClient,
    FilePathName: file.HdfsPath,
    Limit: true
  });
  if (!urlResult || urlResult.Code !== 1) return urlResult || fail("读取源码文件地址失败");
  var data = urlResult.Data || {};
  var url = typeof data === "string" ? data : text(data.Url || data.url || data.FileUrl || data.Path);
  if (isBlank(url)) return fail("源码文件地址为空");
  var response = V8.Http.GetResponse({ Url: url, Timeout: 120 });
  if (!response || !response.RawBytes) return fail("下载源码文件失败：" + file.FilePath);
  return ok(System.Convert.ToBase64String(response.RawBytes));
}
function readPublishedBase64(path) {
  if (isBlank(path)) return fail("公有编译文件地址为空");
  var url = /^https?:\/\//i.test(text(path)) ? text(path) : publicDomainUrl(path);
  if (isBlank(url)) url = getFileUrl(path, false);
  if (isBlank(url)) return fail("读取公有编译文件地址失败");
  var response = V8.Http.GetResponse({ Url: url, Timeout: 120 });
  if (!response || !response.RawBytes) return fail("下载公有编译文件失败：" + path);
  var statusCode = parseInt(response.StatusCode || 0);
  if (statusCode && (statusCode < 200 || statusCode >= 300)) return fail("下载公有编译文件失败，HTTP " + statusCode + "：" + path);
  var responseContent = text(response.Content).replace(/^\s+|\s+$/g, "");
  if (responseContent.charAt(0) === "{") {
    try {
      var storagePayload = JSON.parse(responseContent);
      if (storagePayload && parseInt(storagePayload.Code) === 0) {
        return fail("对象存储文件不可用：" + text(storagePayload.Msg, path));
      }
    } catch (storagePayloadError) {}
  }
  return ok(System.Convert.ToBase64String(response.RawBytes));
}
function findBuildRoot(files) {
  var roots = ["dist/", "build/", "unpackage/dist/build/h5/"];
  for (var r = 0; r < roots.length; r++) {
    for (var i = 0; i < files.length; i++) {
      var path = normalizePath(files[i].FilePath).toLowerCase();
      if (path === roots[r] + "index.html") return roots[r];
    }
  }
  return "";
}
function stablePublishFilePath(appKey, relativePath, versionNo) {
  var versionRoot = isBlank(versionNo) ? "" : "/versions/" + normalizePath(versionNo);
  return text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + text(appKey) + versionRoot + "/" + normalizePath(relativePath);
}
function publishTextAsset(uploadRoot, appKey, relativePath, versionNo, content) {
  var upload = uploadText(uploadRoot, relativePath, content, false);
  if (!upload || upload.Code !== 1) return upload || fail("发布 HTML 失败");
  var uploadedPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var targetPath = stablePublishFilePath(appKey, relativePath, versionNo);
  var moveResult = movePublicObject(uploadedPath, targetPath);
  if (!moveResult || moveResult.Code !== 1) return moveResult || fail("提升 HTML 到固定路径失败：" + relativePath);
  return ok({ Path: targetPath, Move: moveResult });
}
function publishBase64Asset(uploadRoot, appKey, relativePath, versionNo, base64) {
  var upload = uploadBase64(uploadRoot, relativePath, base64, false);
  if (!upload || upload.Code !== 1) return upload || fail("发布编译产物失败");
  var uploadedPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var targetPath = stablePublishFilePath(appKey, relativePath, versionNo);
  var moveResult = movePublicObject(uploadedPath, targetPath);
  if (!moveResult || moveResult.Code !== 1) return moveResult || fail("提升编译资产到固定路径失败：" + relativePath);
  return ok({ Path: targetPath, Move: moveResult });
}
function publishCompiledFiles(files, buildRoot, appKey, versionNo) {
  // 历史版本与固定最新版各保留一份。非入口资产先发布，index.html 最后切换，
  // 防止用户在发布瞬间读到引用尚未就绪的新入口。
  var versionSegment = isBlank(versionNo) ? "" : "/versions/" + normalizePath(versionNo);
  var versionPublishRoot = "ai-app-publish/" + appKey + versionSegment;
  var latestPublishRoot = "ai-app-publish/" + appKey;
  var assets = [];
  var entryPath = "";
  var versionEntryPath = "";
  var totalSize = 0;
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < files.length; i++) {
      var sourcePath = normalizePath(files[i].FilePath);
      if (parseInt(files[i].IsDirectory || 0) === 1 || sourcePath.toLowerCase().indexOf(buildRoot) !== 0) continue;
      var relativePath = sourcePath.substring(buildRoot.length);
      if (isBlank(relativePath)) continue;
      var isEntry = relativePath.toLowerCase() === "index.html";
      if ((pass === 0 && isEntry) || (pass === 1 && !isEntry)) continue;
      var isHtml = /\.html$/i.test(relativePath);
      var versionResult;
      var latestResult;
      if (isHtml) {
        var htmlContent = readText(files[i].HdfsPath, true);
        if (!htmlContent || htmlContent.Code !== 1) return htmlContent || fail("读取编译 HTML 失败");
        var publishedHtml = injectRuntimeContext(htmlContent.Data);
        versionResult = publishTextAsset(versionPublishRoot, appKey, relativePath, versionNo, publishedHtml);
        if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布历史版本 HTML 失败");
        latestResult = publishTextAsset(latestPublishRoot, appKey, relativePath, "", publishedHtml);
      } else {
        var base64Result = readFileBase64(files[i]);
        if (!base64Result || base64Result.Code !== 1) return base64Result || fail("读取编译产物失败");
        versionResult = publishBase64Asset(versionPublishRoot, appKey, relativePath, versionNo, base64Result.Data);
        if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布历史版本资产失败");
        latestResult = publishBase64Asset(latestPublishRoot, appKey, relativePath, "", base64Result.Data);
      }
      if (!latestResult || latestResult.Code !== 1) return latestResult || fail("发布固定最新版资产失败");
      var versionPath = versionResult.Data ? versionResult.Data.Path || "" : "";
      var latestPath = latestResult.Data ? latestResult.Data.Path || "" : "";
      V8.FormEngine.UptFormData("mci_ai_app_file", {
        Id: files[i].Id,
        PublishHdfsPath: latestPath,
        StorageScope: "PrivateSource+PublicBuild"
      });
      if (isEntry) {
        entryPath = latestPath;
        versionEntryPath = versionPath;
      }
      totalSize += parseInt(files[i].Size || 0);
      assets.push({
        Path: relativePath,
        FilePathName: versionPath,
        StableFilePathName: latestPath,
        Size: parseInt(files[i].Size || 0),
        IsEntry: isEntry
      });
    }
  }
  if (isBlank(entryPath)) return fail("真实编译产物缺少 index.html");
  return ok({ EntryPath: entryPath, VersionEntryPath: versionEntryPath, Assets: assets, AssetCount: assets.length, TotalSize: totalSize });
}
function upsertPublishedBuildFile(app, relativePath, source, versionPath, latestPath) {
  var filePath = "dist/" + normalizePath(relativePath);
  var existing = V8.FormEngine.GetFormData("mci_ai_app_file", {
    _Where: [["AppId", "=", app.Id], ["AND", "FilePath", "=", filePath]],
    _PageSize: 1
  });
  var row = {
    AppId: app.Id,
    AppName: app.Name || "",
    FilePath: filePath,
    FileName: fileNameOf(relativePath),
    FileType: fileNameOf(relativePath).indexOf(".") >= 0 ? fileNameOf(relativePath).split(".").pop().toLowerCase() : "bin",
    HdfsPath: versionPath,
    PublishHdfsPath: latestPath,
    StorageScope: "PrivateSource+PublicBuild",
    ContentHash: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
    Size: parseInt(source.size || source.Size || 0),
    IsDirectory: 0,
    Version: 1
  };
  if (existing && existing.Code === 1 && existing.Data && existing.Data.Id) {
    row.Id = existing.Data.Id;
    return V8.FormEngine.UptFormData("mci_ai_app_file", row);
  }
  return V8.FormEngine.AddFormData("mci_ai_app_file", row);
}
function promoteStoreAssets(app, appKey, versionNo, rawAssets) {
  var sourceAssets = toArray(rawAssets);
  if (!sourceAssets.length) return fail("Assets不能为空");
  var versionRoot = "ai-app-publish/" + appKey + "/versions/" + normalizePath(versionNo);
  var latestRoot = "ai-app-publish/" + appKey;
  var promoted = [];
  var latestEntry = "";
  var versionEntry = "";
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < sourceAssets.length; i++) {
      var source = sourceAssets[i] || {};
      var relativePath = normalizePath(source.path || source.Path || source.fileName || source.FileName);
      if (isBlank(relativePath)) continue;
      var isEntry = source.isEntry === 1 || source.IsEntry === 1 || source.isEntry === true || source.IsEntry === true || relativePath.toLowerCase() === "index.html";
      if ((pass === 0 && isEntry) || (pass === 1 && !isEntry)) continue;
      var sourcePath = text(source.filePathName || source.FilePathName || source.hdfsPath || source.HdfsPath || source.url || source.Url);
      var inlineBase64 = text(source.fileByteBase64 || source.FileByteBase64 || source.contentBase64 || source.ContentBase64 || source.base64 || source.Base64);
      if (isBlank(sourcePath) && isBlank(inlineBase64)) return fail("编译资产缺少公有文件地址或内联内容：" + relativePath);
      var sourceBase64Result = !isBlank(inlineBase64) ? ok(inlineBase64) : readPublishedBase64(sourcePath);
      if (!sourceBase64Result || sourceBase64Result.Code !== 1) return sourceBase64Result || fail("读取商城编译资产失败");
      var versionResult;
      var latestResult;
      if (/\.html?$/i.test(relativePath)) {
        var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(sourceBase64Result.Data));
        html = injectRuntimeContext(html);
        versionResult = publishTextAsset(versionRoot, appKey, relativePath, versionNo, html);
        if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布商城历史 HTML 失败");
        latestResult = publishTextAsset(latestRoot, appKey, relativePath, "", html);
      } else {
        versionResult = publishBase64Asset(versionRoot, appKey, relativePath, versionNo, sourceBase64Result.Data);
        if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布商城历史资产失败");
        latestResult = publishBase64Asset(latestRoot, appKey, relativePath, "", sourceBase64Result.Data);
      }
      if (!latestResult || latestResult.Code !== 1) return latestResult || fail("发布商城固定最新版失败");
      var versionPath = versionResult.Data ? versionResult.Data.Path || "" : "";
      var latestPath = latestResult.Data ? latestResult.Data.Path || "" : "";
      var fileUpdate = upsertPublishedBuildFile(app, relativePath, source, versionPath, latestPath);
      if (!fileUpdate || fileUpdate.Code !== 1) return fileUpdate || fail("写入商城编译资产元数据失败");
      promoted.push({
        Path: relativePath,
        FilePathName: versionPath,
        StableFilePathName: latestPath,
        Size: parseInt(source.size || source.Size || 0),
        Sha256: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
        IsEntry: isEntry
      });
      if (isEntry) {
        versionEntry = versionPath;
        latestEntry = latestPath;
      }
    }
  }
  if (isBlank(latestEntry)) return fail("编译资产缺少 index.html");
  var latestUrl = publicDomainUrl(latestEntry);
  if (isBlank(latestUrl)) latestUrl = getFileUrl(latestEntry, false);
  var versionUrl = publicDomainUrl(versionEntry);
  if (isBlank(versionUrl)) versionUrl = getFileUrl(versionEntry, false);
  return ok({
    PreviewUrl: latestUrl,
    VersionPreviewUrl: versionUrl,
    PublishPath: latestEntry,
    VersionPublishPath: versionEntry,
    Assets: promoted,
    AssetCount: promoted.length
  });
}
/* PARALLEL_SINGLE_ASSET_PROMOTION_V1
 * 大型 UniApp 的静态资源可由受信任发布端并发调用本动作；每个请求只处理一个
 * 文件，index.html 必须由调用端最后提交，从而在其余资源完整后原子切换入口。
 */
function promoteStoreAsset(app, appKey, versionNo, source) {
  source = source || {};
  var relativePath = normalizePath(source.path || source.Path || source.fileName || source.FileName);
  if (isBlank(relativePath)) return fail("编译资产路径不能为空");
  var sourcePath = text(source.filePathName || source.FilePathName || source.hdfsPath || source.HdfsPath || source.url || source.Url);
  var inlineBase64 = text(source.fileByteBase64 || source.FileByteBase64 || source.contentBase64 || source.ContentBase64 || source.base64 || source.Base64);
  if (isBlank(sourcePath) && isBlank(inlineBase64)) return fail("编译资产缺少公有文件地址或内联内容：" + relativePath);
  var sourceBase64Result = !isBlank(inlineBase64) ? ok(inlineBase64) : readPublishedBase64(sourcePath);
  if (!sourceBase64Result || sourceBase64Result.Code !== 1) return sourceBase64Result || fail("读取商城编译资产失败");

  var normalizedVersion = normalizeVersion(versionNo);
  var versionRoot = "ai-app-publish/" + appKey + "/versions/" + normalizePath(normalizedVersion);
  var latestRoot = "ai-app-publish/" + appKey;
  var isEntry = source.isEntry === 1 || source.IsEntry === 1 || source.isEntry === true || source.IsEntry === true || relativePath.toLowerCase() === "index.html";
  var versionResult;
  var latestResult;
  if (/\.html?$/i.test(relativePath)) {
    var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(sourceBase64Result.Data));
    html = injectRuntimeContext(html);
    versionResult = publishTextAsset(versionRoot, appKey, relativePath, normalizedVersion, html);
    if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布商城历史 HTML 失败");
    latestResult = publishTextAsset(latestRoot, appKey, relativePath, "", html);
  } else {
    versionResult = publishBase64Asset(versionRoot, appKey, relativePath, normalizedVersion, sourceBase64Result.Data);
    if (!versionResult || versionResult.Code !== 1) return versionResult || fail("发布商城历史资产失败");
    latestResult = publishBase64Asset(latestRoot, appKey, relativePath, "", sourceBase64Result.Data);
  }
  if (!latestResult || latestResult.Code !== 1) return latestResult || fail("发布商城固定最新版失败");

  var versionPath = versionResult.Data ? versionResult.Data.Path || "" : "";
  var latestPath = latestResult.Data ? latestResult.Data.Path || "" : "";
  var fileUpdate = upsertPublishedBuildFile(app, relativePath, source, versionPath, latestPath);
  if (!fileUpdate || fileUpdate.Code !== 1) return fileUpdate || fail("写入商城编译资产元数据失败");
  var result = {
    Path: relativePath,
    FilePathName: versionPath,
    StableFilePathName: latestPath,
    Size: parseInt(source.size || source.Size || 0),
    Sha256: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
    IsEntry: isEntry
  };
  if (isEntry) {
    result.PublishPath = latestPath;
    result.VersionPublishPath = versionPath;
    result.PreviewUrl = publicDomainUrl(latestPath) || getFileUrl(latestPath, false);
    result.VersionPreviewUrl = publicDomainUrl(versionPath) || getFileUrl(versionPath, false);
  }
  return ok(result, isEntry ? "入口与运行上下文已发布" : "编译资产已发布");
}
function latestVersion(appId, versionNo) {
  var where = [["AppId", "=", appId]];
  if (!isBlank(versionNo)) {
    var vn = text(versionNo);
    if (vn.charAt(0).toLowerCase() !== "v") vn = "v" + vn;
    where.push(["VersionNo", "=", vn]);
  }
  return V8.FormEngine.GetTableData("mci_ai_app_version", {
    _Where: where,
    _SelectFields: ["Id", "AppId", "AppName", "VersionNo", "VersionName", "Status", "PublishPath", "PreviewUrl", "BuildLog", "ChangeSummary", "FileCount", "TotalSize", "CreateTime"],
    _OrderBy: "CreateTime",
    _OrderByType: "DESC",
    _PageSize: 1
  });
}
function readFileContent(file) {
  var content = readText(file.HdfsPath, true);
  if (!content || content.Code !== 1) return "";
  return text(content.Data);
}
function findSourceFile(files, path) {
  var target = normalizePath(path).toLowerCase();
  for (var i = 0; i < files.length; i++) {
    if (normalizePath(files[i].FilePath).toLowerCase() === target) return files[i];
  }
  return null;
}
function findFirstFile(files, suffix) {
  suffix = suffix.toLowerCase();
  for (var i = 0; i < files.length; i++) {
    var p = normalizePath(files[i].FilePath).toLowerCase();
    if (p.lastIndexOf(suffix) === p.length - suffix.length) return files[i];
  }
  return null;
}
function htmlHasDocument(content) {
  var v = text(content).toLowerCase();
  return v.indexOf("<!doctype") >= 0 || v.indexOf("<html") >= 0;
}
function replaceAllText(input, search, replacement) {
  return text(input).split(search).join(replacement);
}
function inlineWebHtml(files, app) {
  var indexFile = findSourceFile(files, "index.html") || findFirstFile(files, ".html");
  var html = indexFile ? readFileContent(indexFile) : "";
  if (isBlank(html)) {
    html = "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + text(app.Name) + "</title></head><body><main class=\"empty\"><h1>" + text(app.Name) + "</h1><p>" + text(app.Description) + "</p></main></body></html>";
  }
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (parseInt(f.IsDirectory || 0) === 1) continue;
    var path = normalizePath(f.FilePath);
    var lower = path.toLowerCase();
    if (lower === "index.html") continue;
    var body = readFileContent(f);
    if (lower.lastIndexOf(".css") === lower.length - 4) {
      html = replaceAllText(html, "<link rel=\"stylesheet\" href=\"" + path + "\">", "<style>\n" + body + "\n</style>");
      html = replaceAllText(html, "<link rel=\"stylesheet\" href=\"/" + path + "\">", "<style>\n" + body + "\n</style>");
    }
    if (lower.lastIndexOf(".js") === lower.length - 3) {
      html = replaceAllText(html, "<script src=\"" + path + "\"></script>", "<script>\n" + body + "\n</script>");
      html = replaceAllText(html, "<script src=\"/" + path + "\"></script>", "<script>\n" + body + "\n</script>");
    }
  }
  return html;
}
function extractBlock(content, name) {
  var re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i");
  var m = text(content).match(re);
  return m ? m[1] : "";
}
function extractStyleBlocks(content) {
  var re = /<style[^>]*>([\s\S]*?)<\/style>/ig;
  var styles = [];
  var m;
  while ((m = re.exec(text(content))) !== null) {
    styles.push(m[1] || "");
  }
  return styles.join("\n");
}
function escapeHtml(input) {
  return text(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function rpxToPx(input) {
  return text(input).replace(/(-?\d+(?:\.\d+)?)rpx/g, function(all, value) {
    var px = parseFloat(value) / 2;
    var str = (Math.round(px * 100) / 100).toString();
    return str + "px";
  });
}
function normalizeUniStyle(css) {
  var value = rpxToPx(css);
  value = value.replace(/(^|[\s,{])page(?=[\s,{.#:])/g, "$1.mci-screen");
  value = value.replace(/::v-deep|\/deep\//g, "");
  value = value.replace(/:deep\(([^)]*)\)/g, "$1");
  return value;
}
function simplifyTemplateText(template) {
  var value = text(template);
  value = value.replace(/{{\s*item\.name\s*}}/g, "服务项目");
  value = value.replace(/{{\s*item\.price\s*}}/g, "168");
  value = value.replace(/{{\s*item\.desc\s*}}/g, "专业护理与预约服务");
  value = value.replace(/{{\s*item\.tags\s*}}/g, "剪发 / 烫染 / 护理");
  value = value.replace(/{{\s*item\.name\[0\]\s*}}/g, "A");
  value = value.replace(/{{\s*([^}]+)\s*}}/g, function(all, expr) {
    expr = text(expr).toLowerCase();
    if (expr.indexOf("price") >= 0) return "168";
    if (expr.indexOf("name") >= 0 || expr.indexOf("title") >= 0) return "示例项目";
    if (expr.indexOf("desc") >= 0 || expr.indexOf("remark") >= 0) return "这里展示页面预览数据";
    return "示例";
  });
  return value;
}
function transformVueTemplate(vue, app, pageTitle) {
  var template = extractBlock(vue, "template");
  if (isBlank(template)) template = "<view class=\"page\"><text>" + text(pageTitle || app.Name) + "</text></view>";
  template = simplifyTemplateText(template);
  template = template
    .replace(/\s+v-for=\"[^\"]*\"/g, "")
    .replace(/\s+v-if=\"[^\"]*\"/g, "")
    .replace(/\s+v-else-if=\"[^\"]*\"/g, "")
    .replace(/\s+v-else/g, "")
    .replace(/\s+v-show=\"[^\"]*\"/g, "")
    .replace(/\s+v-model=\"[^\"]*\"/g, "")
    .replace(/\s+:[\w:.-]+=\"[^\"]*\"/g, "")
    .replace(/\s+@[\w:.-]+=\"[^\"]*\"/g, "")
    .replace(/\s+key=\"[^\"]*\"/g, "")
    .replace(/<view([^>]*)>/gi, "<div$1>")
    .replace(/<\/view>/gi, "</div>")
    .replace(/<text([^>]*)>/gi, "<span$1>")
    .replace(/<\/text>/gi, "</span>")
    .replace(/<image([^>]*)\/>/gi, "<img$1>")
    .replace(/<image([^>]*)>/gi, "<img$1>")
    .replace(/<\/image>/gi, "")
    .replace(/<scroll-view([^>]*)>/gi, "<div$1>")
    .replace(/<\/scroll-view>/gi, "</div>")
    .replace(/<picker([^>]*)>/gi, "<div$1>")
    .replace(/<\/picker>/gi, "</div>")
    .replace(/<swiper([^>]*)>/gi, "<div$1>")
    .replace(/<\/swiper>/gi, "</div>")
    .replace(/<swiper-item([^>]*)>/gi, "<div$1>")
    .replace(/<\/swiper-item>/gi, "</div>");
  return template;
}
function parsePagesConfig(files) {
  var file = findSourceFile(files, "pages.json");
  if (!file) return {};
  var content = readFileContent(file);
  if (isBlank(content)) return {};
  try { return JSON.parse(content); } catch (e) { return {}; }
}
function pageTitleOf(cfg, path) {
  var title = "";
  if (cfg && cfg.pages) {
    for (var i = 0; i < cfg.pages.length; i++) {
      if (normalizePath(cfg.pages[i].path) === normalizePath(path)) {
        title = text(cfg.pages[i].style && cfg.pages[i].style.navigationBarTitleText);
      }
    }
  }
  if (!isBlank(title)) return title;
  var parts = normalizePath(path).split("/");
  return parts.length > 1 ? parts[parts.length - 2] : path;
}
function tabTextOf(cfg, path, fallback) {
  if (cfg && cfg.tabBar && cfg.tabBar.list) {
    for (var i = 0; i < cfg.tabBar.list.length; i++) {
      if (normalizePath(cfg.tabBar.list[i].pagePath) === normalizePath(path)) {
        return text(cfg.tabBar.list[i].text || fallback);
      }
    }
  }
  return fallback;
}
function collectUniPages(files, cfg) {
  var pages = [];
  var seen = {};
  if (cfg && cfg.pages && cfg.pages.length) {
    for (var i = 0; i < cfg.pages.length; i++) {
      var path = normalizePath(cfg.pages[i].path);
      var file = findSourceFile(files, path + ".vue");
      if (file) {
        seen[path.toLowerCase()] = true;
        pages.push({ path: path, title: pageTitleOf(cfg, path), tabText: tabTextOf(cfg, path, pageTitleOf(cfg, path)), file: file });
      }
    }
  }
  for (var j = 0; j < files.length; j++) {
    var p = normalizePath(files[j].FilePath);
    if (p.toLowerCase().indexOf("pages/") === 0 && p.toLowerCase().lastIndexOf(".vue") === p.length - 4) {
      var pagePath = p.substring(0, p.length - 4);
      if (!seen[pagePath.toLowerCase()]) {
        seen[pagePath.toLowerCase()] = true;
        pages.push({ path: pagePath, title: pageTitleOf(cfg, pagePath), tabText: tabTextOf(cfg, pagePath, pageTitleOf(cfg, pagePath)), file: files[j] });
      }
    }
  }
  if (!pages.length) {
    var first = findFirstFile(files, ".vue");
    if (first) pages.push({ path: normalizePath(first.FilePath).replace(/\.vue$/i, ""), title: "首页", tabText: "首页", file: first });
  }
  return pages;
}
function tabIconSvg(index) {
  var icons = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm1 5v5h4v2h-6V8z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0z"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5z"/></svg>'
  ];
  return icons[index % icons.length];
}
function compileUniAppHtml(files, app) {
  var cfg = parsePagesConfig(files);
  var pages = collectUniPages(files, cfg);
  var globalStyle = "";
  var appFile = findSourceFile(files, "App.vue");
  if (appFile) globalStyle = extractStyleBlocks(readFileContent(appFile));
  var pageHtml = [];
  var bottomHtml = [];
  for (var i = 0; i < pages.length; i++) {
    var vue = readFileContent(pages[i].file);
    var tpl = transformVueTemplate(vue, app, pages[i].title);
    var style = extractStyleBlocks(vue);
    pageHtml.push("<section class=\"mci-screen\" data-page-index=\"" + i + "\"" + (i === 0 ? "" : " hidden") + "><div class=\"mci-navbar\">" + escapeHtml(pages[i].title) + "</div>" + tpl + "<style>" + normalizeUniStyle(style) + "</style></section>");
    bottomHtml.push("<button type=\"button\" data-switch-page=\"" + i + "\"" + (i === 0 ? " class=\"active\"" : "") + "><span class=\"mci-tab-icon\">" + tabIconSvg(i) + "</span><span>" + escapeHtml(pages[i].tabText || pages[i].title) + "</span></button>");
  }
  var css = normalizeUniStyle(globalStyle);
  return "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\">\n<title>" + escapeHtml(app.Name) + "</title>\n<style>\n*{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#f4f7fb,#eef3ff);font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"Microsoft YaHei\",sans-serif;color:#20242c}.preview-shell{min-height:100vh;display:grid;place-items:center;padding:20px}.phone{width:min(430px,100%);height:min(860px,calc(100vh - 40px));min-height:720px;background:#f6f7fb;border:1px solid #dde3ee;border-radius:30px;overflow:hidden;box-shadow:0 22px 70px rgba(20,30,50,.18);display:flex;flex-direction:column}.phone-status{height:34px;background:#fff;display:flex;align-items:center;justify-content:center;color:#8a93a3;font-size:12px}.mci-screens{flex:1;min-height:0;overflow:auto}.mci-screen{min-height:100%;padding-bottom:72px}.mci-navbar{position:sticky;top:0;z-index:2;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);font-weight:700;border-bottom:1px solid #edf1f7}.mci-tabbar{height:58px;display:grid;grid-template-columns:repeat(" + pages.length + ",1fr);border-top:1px solid #edf1f7;background:#fff}.mci-tabbar button{border:0;background:#fff;color:#7a8290;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}.mci-tab-icon{display:block;width:20px;height:20px}.mci-tab-icon svg{width:20px;height:20px;fill:currentColor}.mci-tabbar button.active{color:#ff5f2e;font-weight:700}img{max-width:100%;display:block}input{border:0;outline:0}.mci-preview-toast{position:fixed;left:50%;bottom:82px;z-index:50;transform:translateX(-50%);max-width:calc(100% - 36px);padding:10px 16px;border-radius:999px;background:rgba(20,30,48,.9);color:#fff;font-size:12px;box-shadow:0 10px 30px rgba(20,30,48,.22)}.card.is-selected{border-color:#ff7a45;box-shadow:0 10px 28px rgba(255,95,46,.16)}@media(max-width:767px){body{background:#f6f7fb}.preview-shell{display:block;min-height:100vh;padding:0}.phone{width:100%;height:100vh;min-height:100vh;border:0;border-radius:0;box-shadow:none}.phone-status{display:none}}" + css + "\n</style>\n</head>\n<body>\n<div class=\"preview-shell\"><div class=\"phone\"><div class=\"phone-status\">Microi UniApp H5 Preview</div><main class=\"mci-screens\">" + pageHtml.join("") + "</main><nav class=\"mci-tabbar\">" + bottomHtml.join("") + "</nav></div></div>\n<script>(function(){var buttons=document.querySelectorAll('[data-switch-page]');var pages=document.querySelectorAll('[data-page-index]');function show(i){for(var p=0;p<pages.length;p++){pages[p].hidden=String(p)!==String(i)}for(var b=0;b<buttons.length;b++){if(String(buttons[b].getAttribute('data-switch-page'))===String(i)){buttons[b].classList.add('active')}else{buttons[b].classList.remove('active')}}}for(var i=0;i<buttons.length;i++){buttons[i].addEventListener('click',function(){show(this.getAttribute('data-switch-page'))})}var historyKey='mci-preview-history:'+(document.body.getAttribute('data-app-key')||document.title);function feedback(message){var old=document.querySelector('.mci-preview-toast');if(old)old.remove();var toast=document.createElement('div');toast.className='mci-preview-toast';toast.textContent=message;document.body.appendChild(toast);setTimeout(function(){toast.remove()},1800)}document.addEventListener('click',function(event){var card=event.target.closest&&event.target.closest('.card');if(card){card.classList.toggle('is-selected');var title=card.querySelector('.card-title');var value=title?title.textContent.trim():'精选内容';var saved=[];try{saved=JSON.parse(localStorage.getItem(historyKey)||'[]')}catch(e){}saved.unshift({Title:value,Time:new Date().toISOString()});localStorage.setItem(historyKey,JSON.stringify(saved.slice(0,20)));feedback('已打开“'+value+'”，记录已保存');return}var more=event.target.closest&&event.target.closest('.more');if(more){feedback('已加载全部内容');return}var action=event.target.closest&&event.target.closest('.hero-actions button');if(action){var actions=action.parentNode.querySelectorAll('button');var target=actions[0]===action?1:2;if(buttons[target])show(target);feedback(actions[0]===action?'已进入核心功能':'已打开使用指南')}})})();</script>\n</body>\n</html>";
}
function compilePreviewHtml(files, app) {
  var fullDocument = findSourceFile(files, "index.html");
  if (fullDocument && htmlHasDocument(readFileContent(fullDocument))) return inlineWebHtml(files, app);
  var fullDocument = findSourceFile(files, "index.html");
  if (fullDocument && htmlHasDocument(readFileContent(fullDocument))) return inlineWebHtml(files, app);
  return text(app.AppType) === "Web" ? inlineWebHtml(files, app) : compileUniAppHtml(files, app);
}
function previewUrl(appId, versionNo) {
  return "/apiengine/ai_app_preview--OsClient--" + text(V8.OsClient) + "--?AppId=" + text(appId) + "&v=" + text(versionNo) + "&t=" + V8.Method.GetTimestamp();
}

var appId = text(V8.Param.AppId || V8.Param.ProjectId);
if (isBlank(appId)) return fail("AppId不能为空");
var app = getApp(appId);
if (!app || app.Code !== 1 || !app.Data) return { Code: 2, Data: null, Msg: "AI应用不存在" };
var requestedAction = text(V8.Param.Action || "Build");
if (requestedAction === "PromoteStoreAsset") {
  var singleAppKey = ensureAppKey(app.Data);
  var singleVersionNo = normalizeVersion(V8.Param.VersionNo || V8.Param.AppVersion || app.Data.CurrentVersion || 1);
  var singleAsset = V8.Param.Asset || null;
  if (!isBlank(V8.Param.AssetJson)) {
    try {
      singleAsset = JSON.parse(text(V8.Param.AssetJson));
    } catch (singleAssetJsonError) {
      return fail("AssetJson不是有效的 JSON 对象：" + singleAssetJsonError.message);
    }
  }
  var singleResult = promoteStoreAsset(app.Data, singleAppKey, singleVersionNo, singleAsset);
  if (!singleResult || singleResult.Code !== 1) return singleResult || fail("商城编译资产发布失败");
  return ok({
    AppId: appId,
    AppKey: singleAppKey,
    VersionNo: singleVersionNo,
    Asset: singleResult.Data,
    PreviewUrl: singleResult.Data.PreviewUrl || "",
    VersionPreviewUrl: singleResult.Data.VersionPreviewUrl || "",
    PublishPath: singleResult.Data.PublishPath || "",
    VersionPublishPath: singleResult.Data.VersionPublishPath || ""
  }, singleResult.Msg);
}
if (requestedAction === "PromoteStoreAssets") {
  var promotedAppKey = ensureAppKey(app.Data);
  var promotedVersionNo = normalizeVersion(V8.Param.VersionNo || V8.Param.AppVersion || app.Data.CurrentVersion || 1);
  var promotedAssets = V8.Param.Assets;
  if (!isBlank(V8.Param.AssetsJson)) {
    try {
      promotedAssets = JSON.parse(text(V8.Param.AssetsJson));
    } catch (assetsJsonError) {
      return fail("AssetsJson不是有效的 JSON 数组：" + assetsJsonError.message);
    }
  }
  var promotedResult = promoteStoreAssets(app.Data, promotedAppKey, promotedVersionNo, promotedAssets);
  if (!promotedResult || promotedResult.Code !== 1) return promotedResult || fail("商城编译资产发布失败");
  return ok({
    AppId: appId,
    AppKey: promotedAppKey,
    VersionNo: promotedVersionNo,
    PreviewUrl: promotedResult.Data.PreviewUrl,
    VersionPreviewUrl: promotedResult.Data.VersionPreviewUrl,
    PublishPath: promotedResult.Data.PublishPath,
    VersionPublishPath: promotedResult.Data.VersionPublishPath,
    Assets: promotedResult.Data.Assets,
    AssetCount: promotedResult.Data.AssetCount
  }, "商城编译资产已发布到固定最新版与历史版本目录");
}
if (requestedAction === "RepairStableLatest") {
  var repairLatest = latestVersion(appId);
  var repairVersionNo = repairLatest && repairLatest.Code === 1 && repairLatest.Data && repairLatest.Data.length
    ? text(repairLatest.Data[0].VersionNo)
    : normalizeVersion(app.Data.CurrentVersion || 1);
  var repairAppKey = ensureAppKey(app.Data);
  var repairResult = null;
  // 优先以当前完整 dist/build 目录为事实源。历史上曾有只发布
  // index.html + 认证桥接脚本的补丁版本；若直接按该 BuildLog 修复，
  // 会把稳定入口切到一个缺少哈希 JS/CSS 的不完整版本并造成白板。
  var repairFilesResult = getFiles(appId);
  if (!repairFilesResult || repairFilesResult.Code !== 1) return repairFilesResult || fail("读取源码失败");
  var repairFiles = repairFilesResult.Data || [];
  var repairBuildRoot = findBuildRoot(repairFiles);
  if (!isBlank(repairBuildRoot)) {
    repairResult = publishCompiledFiles(repairFiles, repairBuildRoot, repairAppKey, repairVersionNo);
  }
  // 仅当源码记录中没有完整编译目录时，才回退到历史不可变资产清单。
  if (!repairResult && repairLatest && repairLatest.Code === 1 && repairLatest.Data && repairLatest.Data.length) {
    var repairBuildLog = {};
    try { repairBuildLog = JSON.parse(text(repairLatest.Data[0].BuildLog)); } catch (repairLogError) { repairBuildLog = {}; }
    var repairVersionAssets = toArray(repairBuildLog.Assets);
    var repairHasEntry = false;
    for (var repairAssetIndex = 0; repairAssetIndex < repairVersionAssets.length; repairAssetIndex++) {
      if (normalizePath(repairVersionAssets[repairAssetIndex].Path).toLowerCase() === "index.html") repairHasEntry = true;
    }
    if (repairHasEntry && repairVersionAssets.length) {
      repairResult = promoteStoreAssets(app.Data, repairAppKey, repairVersionNo, repairVersionAssets);
    }
  }
  if (!repairResult) {
    return fail("当前应用没有可修复的完整编译产物");
  }
  if (!repairResult || repairResult.Code !== 1) return repairResult || fail("固定最新版入口修复失败");
  var repairPublicPath = repairResult.Data.PublishPath || repairResult.Data.EntryPath;
  var repairUrl = publicDomainUrl(repairPublicPath);
  if (isBlank(repairUrl)) repairUrl = getFileUrl(repairPublicPath, false);
  var repairRow = {
    Id: appId,
    PreviewUrl: repairUrl,
    PublicPublishPath: repairPublicPath,
    LastBuildMsg: "已同步固定最新版入口，历史版本 " + repairVersionNo + " 保持可访问。",
    UpdateTime: now()
  };
  var previewVersionSegment = "/versions/" + normalizePath(repairVersionNo) + "/";
  if (!isBlank(app.Data.AppPreview) && text(app.Data.AppPreview).indexOf(previewVersionSegment) >= 0) {
    repairRow.AppPreview = text(app.Data.AppPreview).replace(previewVersionSegment, "/");
  }
  var repairUpdate = V8.FormEngine.UptFormData("sys_microistore", repairRow);
  if (!repairUpdate || repairUpdate.Code !== 1) return repairUpdate || fail("固定最新版入口已上传，但商城记录更新失败");
  return ok({
    AppId: appId,
    AppKey: repairAppKey,
    VersionNo: repairVersionNo,
    PreviewUrl: repairUrl,
    PublishPath: repairPublicPath,
    VersionPublishPath: repairResult.Data.VersionPublishPath || repairResult.Data.VersionEntryPath,
    AssetCount: repairResult.Data.AssetCount
  }, "固定最新版入口已修复，历史版本保持不变");
}
if (text(app.Data.AppType) === "MicroService") {
  if (isBlank(app.Data.PreviewUrl)) return fail("微服务尚未生成编译产物，请先通过 MCP 或 VS Code 完成首次编译发布。");
  return ok({
    AppId: appId,
    AppKey: ensureAppKey(app.Data),
    PreviewUrl: app.Data.PreviewUrl,
    PublishPath: app.Data.PublicPublishPath || "",
    BuildStatus: app.Data.BuildStatus || "Success",
    Message: "MicroService 使用专用发布链路，已保留当前正确的编译发布版本。"
  }, "微服务已使用当前编译发布版本");
}
var filesResult = getFiles(appId);
if (!filesResult || filesResult.Code !== 1) return filesResult || fail("读取源码失败");
var files = filesResult.Data || [];
var versionCounter = parseInt(app.Data.CurrentVersion || 1);
var nextVersion = versionCounter + 1;
var latest = latestVersion(appId);
var latestVersionNo = latest && latest.Code === 1 && latest.Data && latest.Data.length ? latest.Data[0].VersionNo : "";
var versionNo = latestVersionNo ? nextSemanticVersion(latestVersionNo) : normalizeVersion(versionCounter);
var appKey = ensureAppKey(app.Data);
var publishRoot = "ai-app-publish/" + appKey;
var versionRoot = publishRoot + "/versions/" + versionNo;
var buildRoot = findBuildRoot(files);
var previewHtml = "";
var publicPath = "";
var versionPath = "";
var url = "";
var versionUrl = "";
var buildMode = "LegacyGeneratedPreview";
var compiledAssets = null;
if (!isBlank(buildRoot)) {
  var compiledResult = publishCompiledFiles(files, buildRoot, appKey, versionNo);
  if (!compiledResult || compiledResult.Code !== 1) return compiledResult || fail("真实编译产物发布失败");
  compiledAssets = compiledResult.Data;
  publicPath = compiledAssets.EntryPath;
  versionPath = compiledAssets.VersionEntryPath || publicPath;
  url = publicDomainUrl(publicPath);
  if (isBlank(url)) url = getFileUrl(publicPath, false);
  versionUrl = publicDomainUrl(versionPath);
  if (isBlank(versionUrl)) versionUrl = getFileUrl(versionPath, false);
  buildMode = "CompiledAssets";
} else {
  previewHtml = injectRuntimeContext(compilePreviewHtml(files, app.Data));
  var upload = uploadText(publishRoot, "index.html", previewHtml, false);
  if (!upload || upload.Code !== 1) return upload || fail("发布预览文件失败");
  publicPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var stablePath = stablePublishPath(appKey);
  var stableMove = movePublicObject(publicPath, stablePath);
  if (stableMove && stableMove.Code === 1) publicPath = stablePath;
  var versionUpload = uploadText(versionRoot, "index.html", previewHtml, false);
  versionPath = versionUpload && versionUpload.Code === 1 && versionUpload.Data ? versionUpload.Data.HdfsPath || "" : "";
  url = publicDomainUrl(publicPath);
  if (isBlank(url)) url = getFileUrl(publicPath, false);
  if (isBlank(url)) url = previewUrl(appId, versionNo);
  versionUrl = publicDomainUrl(versionPath);
  if (isBlank(versionUrl)) versionUrl = getFileUrl(versionPath, false);
}
var fileCount = 0;
var totalSize = 0;
for (var i = 0; i < files.length; i++) {
  if (parseInt(files[i].IsDirectory || 0) === 1) continue;
  fileCount++;
  totalSize += parseInt(files[i].Size || 0);
}
var version = V8.FormEngine.AddFormData("mci_ai_app_version", {
  AppId: appId,
  AppName: app.Data.Name || "",
  VersionNo: versionNo,
  VersionName: versionNo,
  Status: "Published",
  SourceSnapshotPath: app.Data.PrivateSourcePath || ("ai-app-source/" + appId),
  PublishPath: versionPath || publicPath || versionRoot,
  PreviewUrl: versionUrl || url,
  BuildTaskId: "",
  BuildLog: buildMode === "CompiledAssets" ? JSON.stringify({ Mode: buildMode, AssetCount: compiledAssets.AssetCount, TotalSize: compiledAssets.TotalSize, Assets: compiledAssets.Assets }) : previewHtml,
  ChangeSummary: text(V8.Param.ChangeSummary || (app.Data.AppType === "Web" ? "Web 应用服务端发布" : "UniApp H5 预览编译发布")),
  FileCount: fileCount,
  TotalSize: totalSize
});
if (!version || version.Code !== 1) return version;
V8.FormEngine.UptFormData("sys_microistore", {
  Id: appId,
  AppKey: appKey,
  CurrentVersion: nextVersion,
  Status: "Published",
  BuildStatus: "Success",
  PreviewUrl: url,
  PublicPublishPath: publicPath || publishRoot,
  LastBuildTaskId: "",
  LastBuildMsg: buildMode === "CompiledAssets" ? "真实编译产物已完整发布，共 " + compiledAssets.AssetCount + " 个文件。" : ((app.Data.AppType === "Web" ? "Web 应用已服务端发布。" : "UniApp 已服务端生成兼容预览版本。") + (stableMove && stableMove.Code === 1 ? " 已生成固定应用Key地址。" : " 已使用当前HDFS发布地址。")),
  UpdateTime: now()
});
return ok({
  AppId: appId,
  AppKey: appKey,
  Version: version.Data,
  PreviewUrl: url,
  PublishPath: publicPath || publishRoot,
  StablePath: stablePath,
  StableMove: stableMove,
  BuildStatus: "Success",
  BuildMode: buildMode,
  AssetCount: compiledAssets ? compiledAssets.AssetCount : 1,
  Message: buildMode === "CompiledAssets" ? "真实 H5 编译产物发布成功" : (app.Data.AppType === "Web" ? "Web 应用发布成功" : "UniApp H5 兼容预览发布成功")
});
