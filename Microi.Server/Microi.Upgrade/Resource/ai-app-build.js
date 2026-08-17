/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_build
 * Version: v1.6.9
 * Function:
 * - AI应用编译发布、固定最新版发布、可恢复大文件下载登记与受控静态资源热修；固定入口使用永久加载壳解析数据库已提交的当前版本，历史入口保留不可变产物；并在发布前拒绝 HTTP 错误、Code=0、长度或哈希不一致的源文件。
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

/*
 * AppType 是历史的官方/社区分类，运行类型必须以 ApplicationType 为准。
 * 旧数据只有在 AppType 明确保存运行类型时才兼容；Official/Community
 * 等分类值不能误入 UniApp 编译分支。
 */
function applicationTypeOf(app) {
  app = app || {};
  var current = text(app.ApplicationType).replace(/^\s+|\s+$/g, "");
  if (current !== "") return current;
  var legacy = text(app.AppType).replace(/^\s+|\s+$/g, "").toLowerCase();
  if (legacy === "uniapp") return "UniApp";
  if (legacy === "microservice") return "MicroService";
  if (legacy === "regular") return "Regular";
  return "Web";
}
function isUniAppApplication(app) {
  return applicationTypeOf(app).toLowerCase() === "uniapp";
}
function hasUniAppPreviewShell(html) {
  var source = text(html);
  if (source.indexOf('data-microi-preview-shell="true"') >= 0) return true;
  // 兼容标记属性引入前已经发布的真实手机壳，同时避免正文偶然出现
  // “Microi UniApp H5 Preview” 字样时被误判为外壳。
  return source.indexOf("Microi UniApp H5 Preview") >= 0
    && source.indexOf('class="preview-phone"') >= 0
    && source.indexOf('class="preview-status"') >= 0
    && source.indexOf('id="microi-preview-frame"') >= 0;
}
/* UNIFIED_UNIAPP_PREVIEW_SHELL_V1 */
function createUniAppPreviewShell(appKey, appName, buildVersion) {
  var safeKey = escapeHtml(appKey);
  var safeName = escapeHtml(appName);
  var versionJson = JSON.stringify(text(buildVersion));
  return '<!doctype html>\n' +
    '<html lang="zh-CN">\n<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">\n' +
    '  <title>' + safeName + '</title>\n' +
    '  <style>\n' +
    '    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}\n' +
    '    body{display:grid;min-height:100vh;place-items:center;padding:24px}\n' +
    '    .preview-phone{display:flex;width:min(430px,100%);height:min(880px,calc(100vh - 48px));min-height:680px;flex-direction:column;overflow:hidden;border:1px solid #d9e0ea;border-radius:34px;background:#fff;box-shadow:0 28px 90px rgba(31,42,68,.2)}\n' +
    '    .preview-status{display:flex;height:30px;flex:0 0 30px;align-items:center;justify-content:center;border-bottom:1px solid #edf0f5;background:#fff;color:#667085;font-size:11px;letter-spacing:.02em}\n' +
    '    iframe{display:block;width:100%;height:100%;flex:1;border:0;background:#fff}\n' +
    '    @media(max-width:767px),(pointer:coarse) and (max-width:1024px){html,body{background:#fff}body{display:block;padding:0}.preview-phone{width:100%;height:100dvh;min-height:100vh;border:0;border-radius:0;box-shadow:none}.preview-status{display:none}}\n' +
    '  </style>\n</head>\n<body>\n' +
    '  <main class="preview-phone" data-microi-preview-shell="true" data-app-key="' + safeKey + '">\n' +
    '    <div class="preview-status">Microi UniApp H5 Preview</div>\n' +
    '    <iframe id="microi-preview-frame" title="' + safeName + '" allow="clipboard-read; clipboard-write; geolocation"></iframe>\n' +
    '  </main>\n' +
    '  <script>(function(){var current=new URL(location.href);var target=new URL("./app.html",current);target.search="";target.hash="";target.searchParams.set("v",' + versionJson + ');var apiBase=current.searchParams.get("apiBase")||current.searchParams.get("ApiBase");var osClient=current.searchParams.get("OsClient")||current.searchParams.get("osClient");if(apiBase)target.searchParams.set("apiBase",apiBase);if(osClient)target.searchParams.set("OsClient",osClient);document.getElementById("microi-preview-frame").src=target.href;})();<\/script>\n' +
    '</body>\n</html>';
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
/* ALIYUN_CDN_STABLE_ASSET_REFRESH_V1
 * 固定最新版会覆盖同名 OSS 对象。CDN 可能继续返回旧入口甚至旧的 404
 * 响应，因此发布完成后只刷新 index/app/auth 这些可变入口；带版本号及哈希
 * 的不可变资产不刷新，避免无意义消耗 CDN 配额。
 */
function aliyunPercentEncode(value) {
  return encodeURIComponent(text(value))
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/%7E/gi, "~");
}
function osClientSecretValue(name) {
  try { return text(V8.OsClientModel && V8.OsClientModel[name]); } catch (e) { return ""; }
}
function refreshStableCdnPaths(paths, allowMutableAssets) {
  var fileServer = "";
  try { fileServer = text(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, ""); } catch (e) {}
  if (!/^https?:\/\//i.test(fileServer)) return ok({ Skipped: true, Reason: "FileServer不是HTTP CDN地址" });
  var accessKeyId = osClientSecretValue("AliOssPublicAccessKeyId");
  var accessKeySecret = osClientSecretValue("AliOssPublicAccessKeySecret");
  if (isBlank(accessKeyId) || isBlank(accessKeySecret)) return ok({ Skipped: true, Reason: "未配置公有桶AccessKey" });
  var urls = [];
  var seen = {};
  var sourcePaths = toArray(paths);
  for (var i = 0; i < sourcePaths.length; i++) {
    var normalized = normalizePath(sourcePaths[i]);
    var lower = normalized.toLowerCase();
    if (!allowMutableAssets && !/(^|\/)(index\.html|app\.html|microi-ai-app-auth\.js)$/.test(lower)) continue;
    var url = publicDomainUrl(normalized);
    if (isBlank(url) || seen[url]) continue;
    seen[url] = true;
    urls.push(url);
  }
  if (!urls.length) return ok({ Skipped: true, Reason: "没有可变入口需要刷新" });
  var parameters = {
    AccessKeyId: accessKeyId,
    Action: "RefreshObjectCaches",
    Format: "JSON",
    ObjectPath: urls.join("\n"),
    ObjectType: "File",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: text(newId()),
    SignatureVersion: "1.0",
    Timestamp: System.DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"),
    Version: "2018-05-10"
  };
  var keys = Object.keys(parameters).sort();
  var canonical = [];
  for (var k = 0; k < keys.length; k++) canonical.push(aliyunPercentEncode(keys[k]) + "=" + aliyunPercentEncode(parameters[keys[k]]));
  var canonicalQuery = canonical.join("&");
  var stringToSign = "GET&%2F&" + aliyunPercentEncode(canonicalQuery);
  var hmac = new System.Security.Cryptography.HMACSHA1(System.Text.Encoding.UTF8.GetBytes(accessKeySecret + "&"));
  var signature = System.Convert.ToBase64String(hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(stringToSign)));
  hmac.Dispose();
  var requestUrl = "https://cdn.aliyuncs.com/?Signature=" + aliyunPercentEncode(signature) + "&" + canonicalQuery;
  try {
    var responseText = text(V8.Http.Get({ Url: requestUrl, Timeout: 30 }));
    var response = JSON.parse(responseText || "{}");
    if (!isBlank(response.Code) || isBlank(response.RequestId)) {
      return fail("CDN刷新提交失败：" + text(response.Message || response.Code, "未知错误"));
    }
    return ok({ Skipped: false, RequestId: text(response.RequestId), RefreshTaskId: text(response.RefreshTaskId), UrlCount: urls.length });
  } catch (refreshError) {
    return fail("CDN刷新提交失败：" + refreshError.message);
  }
}
function stablePublishPath(appKey) {
  return text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + text(appKey) + "/latest/index.html";
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
function legacyRedirectHtml(targetUrl, versionNo) {
  var safeTarget = escapeHtml(text(targetUrl));
  return '<!doctype html>\n' +
    '<html lang="zh-CN">\n<head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '  <title>Microi AI Application ' + text(versionNo) + '</title>\n' +
    '  <style>html,body,iframe{width:100%;height:100%;margin:0;border:0}body{overflow:hidden;background:#071617}iframe{display:block}</style>\n' +
    '</head>\n<body>\n' +
    '  <iframe src="' + safeTarget + '" title="Microi AI Application ' + text(versionNo) + '"' +
    ' allow="autoplay *; fullscreen *; gamepad *; clipboard-write *" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>\n' +
    '  <noscript><a href="' + safeTarget + '">打开 Microi AI Application ' + text(versionNo) + '</a></noscript>\n' +
    '</body>\n</html>\n';
}
function immutableRuntimeBaseUrl(appKey, versionNo, rawBaseUrl) {
  var fileServer = "";
  try { fileServer = text(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, ""); } catch (error) { fileServer = ""; }
  var tenantKey = text(V8.OsClient).toLowerCase();
  var baseUrl = text(rawBaseUrl).replace(/\/+$/, "");
  if (!/^https:\/\//i.test(fileServer) || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(versionNo)) return "";
  if (baseUrl.indexOf("?") >= 0 || baseUrl.indexOf("#") >= 0) return "";
  var expectedPrefix = fileServer + "/microi/application-assets/v3/tenants/" + tenantKey
    + "/kinds/runtime/apps/" + appKey + "/releases/" + versionNo + "/requests/";
  if (baseUrl.toLowerCase().indexOf(expectedPrefix.toLowerCase()) !== 0) return "";
  var suffix = baseUrl.substring(expectedPrefix.length);
  return /^[a-f0-9]{64}\/assets$/i.test(suffix) ? baseUrl : "";
}
function stableRuntimeResolverBaseUrl(appKey) {
  var apiBase = "";
  try { apiBase = text(V8.SysConfig && V8.SysConfig.ApiBase).replace(/\/+$/, ""); } catch (error) { apiBase = ""; }
  if (!/^https:\/\//i.test(apiBase)) return "";
  return apiBase + "/micro-app/v3/tenants/" + encodeURIComponent(text(V8.OsClient).toLowerCase())
    + "/kinds/runtime/apps/" + encodeURIComponent(appKey) + "/assets";
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
  var rows = [];
  var seen = {};
  var pageSize = 500;
  var maxPages = 100;
  for (var pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
    var page = V8.FormEngine.GetTableData("mci_ai_app_file", {
      _Where: [["AppId", "=", appId]],
      _SelectFields: ["Id", "AppId", "AppName", "VersionId", "FilePath", "FileName", "FileType", "HdfsPath", "PublishHdfsPath", "StorageScope", "ContentHash", "Size", "Version", "IsDirectory", "CreateTime", "UpdateTime"],
      _OrderBy: "FilePath",
      _OrderByType: "ASC",
      _PageIndex: pageIndex,
      _PageSize: pageSize
    });
    if (!page || page.Code !== 1) return page || fail("读取应用文件清单失败");
    var pageRows = page.Data || [];
    for (var rowIndex = 0; rowIndex < pageRows.length; rowIndex++) {
      var normalized = normalizePath(pageRows[rowIndex].FilePath).toLowerCase();
      if (seen[normalized]) return fail("应用文件路径重复，拒绝构建：" + normalized);
      seen[normalized] = true;
      rows.push(pageRows[rowIndex]);
    }
    if (pageRows.length < pageSize) return { Code: 1, Data: rows, DataCount: rows.length, Msg: "成功" };
  }
  return fail("应用文件超过50000条，拒绝使用不完整清单构建");
}
/* REAL_COMPILED_DIST_V1 */
function readFileBase64(file) {
  if (!file || isBlank(file.HdfsPath)) return fail("源码文件地址为空");
  var storageScope = text(file.StorageScope).toLowerCase();
  var normalizedHdfsPath = normalizePath(file.HdfsPath).toLowerCase();
  if (storageScope === "publicbuildstream" || storageScope === "publicbuildonly" || normalizedHdfsPath.indexOf("/ai-app-publish/") >= 0) {
    var publicResult = readPublishedBase64(file.HdfsPath);
    if (!publicResult || publicResult.Code !== 1) return publicResult || fail("读取公有编译源文件失败");
    return validateSourceFileBase64(file, publicResult.Data);
  }
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
  var statusCode = parseInt(response.StatusCode || 0);
  if (statusCode && (statusCode < 200 || statusCode >= 300)) return fail("下载源码文件失败，HTTP " + statusCode + "：" + file.FilePath);
  var responseContent = text(response.Content).replace(/^\s+|\s+$/g, "");
  if (responseContent.charAt(0) === "{") {
    try {
      var storagePayload = JSON.parse(responseContent);
      if (storagePayload && parseInt(storagePayload.Code) === 0) {
        return fail("源码对象不可用：" + text(storagePayload.Msg, file.FilePath));
      }
    } catch (storagePayloadError) {}
  }
  return validateSourceFileBase64(file, System.Convert.ToBase64String(response.RawBytes));
}
function validateSourceFileBase64(file, base64) {
  var bytes = System.Convert.FromBase64String(text(base64));
  var expectedSize = parseInt(file && file.Size || 0);
  if (expectedSize > 0 && bytes.Length !== expectedSize) {
    return fail("源码文件长度不一致：" + text(file && file.FilePath) + "，expected=" + expectedSize + "，actual=" + bytes.Length);
  }
  var expectedHash = text(file && file.ContentHash).toLowerCase();
  var scope = text(file && file.StorageScope).toLowerCase();
  var base64WireHash = scope !== "publicbuildstream" && scope !== "publicbuildonly";
  if (base64WireHash && !isBlank(expectedHash) && V8.EncryptHelper && V8.EncryptHelper.SHA256) {
    var actualHash = text(V8.EncryptHelper.SHA256(text(base64))).toLowerCase();
    if (actualHash !== expectedHash) {
      return fail("源码文件哈希不一致：" + text(file && file.FilePath));
    }
  }
  return ok(text(base64));
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
  // VS Code/MCP 同步后的当前应用产物统一写入 build/。部分历史应用仍残留
  // 已被对象存储清理的 dist/ 元数据，因此必须优先选择 build/；只有当前
  // 应用没有 build/ 时才兼容旧 dist/ 与 UniApp H5 目录。
  var roots = ["build/", "dist/", "unpackage/dist/build/h5/"];
  for (var r = 0; r < roots.length; r++) {
    for (var i = 0; i < files.length; i++) {
      var path = normalizePath(files[i].FilePath).toLowerCase();
      if (path === roots[r] + "index.html") return roots[r];
    }
  }
  return "";
}
function stablePublishFilePath(appKey, relativePath, versionNo) {
  // latest 是不含具体版本号的永久分享别名；历史版本仍写入 versions/vX。
  // 这样既不会把分享链接锁死在旧版本，也能隔离曾被 CDN 长缓存的根路径错误响应。
  var versionRoot = isBlank(versionNo) ? "/latest" : "/versions/" + normalizePath(versionNo);
  return text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + text(appKey) + versionRoot + "/" + normalizePath(relativePath);
}
function publishTextAsset(uploadRoot, appKey, relativePath, versionNo, content) {
  var upload = uploadText(uploadRoot, relativePath, content, false);
  if (!upload || upload.Code !== 1) return upload || fail("发布 HTML 失败");
  var uploadedPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var targetPath = stablePublishFilePath(appKey, relativePath, versionNo);
  var moveResult = movePublicObject(uploadedPath, targetPath);
  if (!moveResult || moveResult.Code !== 1) {
    return fail("提升 HTML 到固定路径失败：" + relativePath
      + "；源=" + uploadedPath
      + "；目标=" + targetPath
      + "；存储错误=" + text(moveResult && moveResult.Msg, "未知"));
  }
  return ok({ Path: targetPath, Move: moveResult });
}
function publishBase64Asset(uploadRoot, appKey, relativePath, versionNo, base64) {
  var upload = uploadBase64(uploadRoot, relativePath, base64, false);
  if (!upload || upload.Code !== 1) return upload || fail("发布编译产物失败");
  var uploadedPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var targetPath = stablePublishFilePath(appKey, relativePath, versionNo);
  var moveResult = movePublicObject(uploadedPath, targetPath);
  if (!moveResult || moveResult.Code !== 1) {
    return fail("提升编译资产到固定路径失败：" + relativePath
      + "；源=" + uploadedPath
      + "；目标=" + targetPath
      + "；存储错误=" + text(moveResult && moveResult.Msg, "未知"));
  }
  return ok({ Path: targetPath, Move: moveResult });
}
function publishBase64ToExactPublicPath(uploadRoot, relativePath, targetPath, base64) {
  var upload = uploadBase64(uploadRoot, relativePath, base64, false);
  if (!upload || upload.Code !== 1) return upload || fail("上传固定路径资源失败");
  var uploadedPath = upload.Data ? upload.Data.HdfsPath || "" : "";
  var moveResult = movePublicObject(uploadedPath, targetPath);
  if (!moveResult || moveResult.Code !== 1) {
    return fail("提升资源到固定路径失败：" + relativePath
      + "；源=" + uploadedPath
      + "；目标=" + targetPath
      + "；存储错误=" + text(moveResult && moveResult.Msg, "未知"));
  }
  return ok({ Path: targetPath, Move: moveResult });
}
function publishCompiledFiles(files, buildRoot, app, appKey, versionNo) {
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
        if (isEntry && isUniAppApplication(app) && !hasUniAppPreviewShell(publishedHtml)) {
          // 真实 UniApp H5 入口保存为 app.html；固定 index.html 只负责
          // PC 手机壳与移动端去壳。这样不修改应用自身 DOM/CSS，也不会把 Web 应用误包裹。
          var versionInnerResult = publishTextAsset(versionPublishRoot, appKey, "app.html", versionNo, publishedHtml);
          if (!versionInnerResult || versionInnerResult.Code !== 1) return versionInnerResult || fail("发布 UniApp 历史版内层入口失败");
          var latestInnerResult = publishTextAsset(latestPublishRoot, appKey, "app.html", "", publishedHtml);
          if (!latestInnerResult || latestInnerResult.Code !== 1) return latestInnerResult || fail("发布 UniApp 最新内层入口失败");
          var versionInnerPath = versionInnerResult.Data ? versionInnerResult.Data.Path || "" : "";
          var latestInnerPath = latestInnerResult.Data ? latestInnerResult.Data.Path || "" : "";
          for (var existingAssetIndex = assets.length - 1; existingAssetIndex >= 0; existingAssetIndex--) {
            if (normalizePath(assets[existingAssetIndex].Path).toLowerCase() === "app.html") assets.splice(existingAssetIndex, 1);
          }
          assets.push({
            Path: "app.html",
            FilePathName: versionInnerPath,
            StableFilePathName: latestInnerPath,
            Size: parseInt(files[i].Size || 0),
            IsEntry: false,
            GeneratedFrom: relativePath
          });
          publishedHtml = injectRuntimeContext(createUniAppPreviewShell(appKey, app.Name || app.AppName, versionNo));
        }
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
  var existingRow = existing && existing.Code === 1 && existing.Data ? existing.Data : null;
  var existingHdfsPath = text(existingRow && existingRow.HdfsPath);
  var existingScope = text(existingRow && existingRow.StorageScope).toLowerCase();
  var hasPrivateSource = !isBlank(existingHdfsPath)
    && existingHdfsPath.toLowerCase().indexOf("/ai-app-source/") >= 0
    && existingScope !== "publicbuildstream"
    && existingScope !== "publicbuildonly";
  var row = {
    AppId: app.Id,
    AppName: app.Name || "",
    FilePath: filePath,
    FileName: fileNameOf(relativePath),
    FileType: fileNameOf(relativePath).indexOf(".") >= 0 ? fileNameOf(relativePath).split(".").pop().toLowerCase() : "bin",
    HdfsPath: hasPrivateSource ? existingHdfsPath : versionPath,
    PublishHdfsPath: latestPath,
    StorageScope: hasPrivateSource ? "PrivateSource+PublicBuild" : "PublicBuildOnly",
    ContentHash: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
    Size: parseInt(source.size || source.Size || 0),
    IsDirectory: 0,
    Version: 1
  };
  if (existingRow && existingRow.Id) {
    row.Id = existingRow.Id;
    return V8.FormEngine.UptFormData("mci_ai_app_file", row);
  }
  return V8.FormEngine.AddFormData("mci_ai_app_file", row);
}
function promoteStoreAssets(app, appKey, versionNo, rawAssets, requireEntry) {
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
      var sourceFileId = text(source.sourceFileId || source.SourceFileId);
      if (isBlank(sourcePath) && isBlank(inlineBase64) && isBlank(sourceFileId)) return fail("编译资产缺少源码文件、公有地址或内联内容：" + relativePath);
      var sourceBase64Result;
      if (!isBlank(inlineBase64)) {
        sourceBase64Result = ok(inlineBase64);
      } else if (!isBlank(sourcePath)) {
        sourceBase64Result = readPublishedBase64(sourcePath);
      } else {
        var sourceFileResult = V8.FormEngine.GetFormData("mci_ai_app_file", {
          _Where: [["Id", "=", sourceFileId], ["AND", "AppId", "=", app.Id]],
          _PageSize: 1
        });
        if (!sourceFileResult || sourceFileResult.Code !== 1 || !sourceFileResult.Data) return fail("编译源码文件不存在：" + relativePath);
        sourceBase64Result = readFileBase64(sourceFileResult.Data);
      }
      if (!sourceBase64Result || sourceBase64Result.Code !== 1) return sourceBase64Result || fail("读取商城编译资产失败");
      var versionResult;
      var latestResult;
      if (/\.html?$/i.test(relativePath)) {
        var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(sourceBase64Result.Data));
        html = injectRuntimeContext(html);
        if (isEntry && isUniAppApplication(app) && !hasUniAppPreviewShell(html)) {
          var promotedVersionInner = publishTextAsset(versionRoot, appKey, "app.html", versionNo, html);
          if (!promotedVersionInner || promotedVersionInner.Code !== 1) return promotedVersionInner || fail("发布商城 UniApp 历史版内层入口失败");
          var promotedLatestInner = publishTextAsset(latestRoot, appKey, "app.html", "", html);
          if (!promotedLatestInner || promotedLatestInner.Code !== 1) return promotedLatestInner || fail("发布商城 UniApp 最新内层入口失败");
          var promotedVersionInnerPath = promotedVersionInner.Data ? promotedVersionInner.Data.Path || "" : "";
          var promotedLatestInnerPath = promotedLatestInner.Data ? promotedLatestInner.Data.Path || "" : "";
          var promotedInnerUpdate = upsertPublishedBuildFile(app, "app.html", source, promotedVersionInnerPath, promotedLatestInnerPath);
          if (!promotedInnerUpdate || promotedInnerUpdate.Code !== 1) return promotedInnerUpdate || fail("写入 UniApp 内层入口元数据失败");
          for (var existingPromotedIndex = promoted.length - 1; existingPromotedIndex >= 0; existingPromotedIndex--) {
            if (normalizePath(promoted[existingPromotedIndex].Path).toLowerCase() === "app.html") promoted.splice(existingPromotedIndex, 1);
          }
          promoted.push({
            Path: "app.html",
            FilePathName: promotedVersionInnerPath,
            StableFilePathName: promotedLatestInnerPath,
            Size: parseInt(source.size || source.Size || 0),
            Sha256: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
            IsEntry: false,
            GeneratedFrom: relativePath
          });
          html = injectRuntimeContext(createUniAppPreviewShell(appKey, app.Name || app.AppName, versionNo));
        }
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
  if (isBlank(latestEntry) && requireEntry !== false) return fail("编译资产缺少 index.html");
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
/* STABLE_ASSET_HOTFIX_V1
 * 只覆盖 latest 固定最新版，用于修复已经发布过但内容异常的静态素材。
 * 历史版本目录保持不可变；调用方必须传入该文件原有的历史版本路径，避免
 * 源码同步后 mci_ai_app_file.HdfsPath 被私有源码路径覆盖。
 */
function promoteStableStoreAssets(app, appKey, rawAssets) {
  var sourceAssets = toArray(rawAssets);
  if (!sourceAssets.length) return fail("Assets不能为空");
  if (sourceAssets.length > 100) return fail("稳定资源热修单批不能超过100个文件");
  var latestRoot = "ai-app-publish/" + appKey;
  var promoted = [];
  var stablePaths = [];
  for (var i = 0; i < sourceAssets.length; i++) {
    var source = sourceAssets[i] || {};
    var relativePath = normalizePath(source.path || source.Path || source.fileName || source.FileName);
    if (isBlank(relativePath)) return fail("稳定资源热修路径不能为空");
    var sourcePath = text(source.filePathName || source.FilePathName || source.hdfsPath || source.HdfsPath || source.url || source.Url);
    var inlineBase64 = text(source.fileByteBase64 || source.FileByteBase64 || source.contentBase64 || source.ContentBase64 || source.base64 || source.Base64);
    var sourceFileId = text(source.sourceFileId || source.SourceFileId);
    if (isBlank(sourcePath) && isBlank(inlineBase64) && isBlank(sourceFileId)) return fail("稳定资源热修缺少源码文件：" + relativePath);
    var sourceBase64Result;
    if (!isBlank(inlineBase64)) {
      sourceBase64Result = ok(inlineBase64);
    } else if (!isBlank(sourcePath)) {
      sourceBase64Result = readPublishedBase64(sourcePath);
    } else {
      var sourceFileResult = V8.FormEngine.GetFormData("mci_ai_app_file", {
        _Where: [["Id", "=", sourceFileId], ["AND", "AppId", "=", app.Id]],
        _PageSize: 1
      });
      if (!sourceFileResult || sourceFileResult.Code !== 1 || !sourceFileResult.Data) return fail("稳定资源热修源码文件不存在：" + relativePath);
      sourceBase64Result = readFileBase64(sourceFileResult.Data);
    }
    if (!sourceBase64Result || sourceBase64Result.Code !== 1) return sourceBase64Result || fail("读取稳定资源热修源码失败");
    var versionPath = text(source.versionFilePathName || source.VersionFilePathName);
    if (isBlank(versionPath)) {
      var publishedFile = V8.FormEngine.GetFormData("mci_ai_app_file", {
        _Where: [["AppId", "=", app.Id], ["AND", "FilePath", "=", "dist/" + relativePath]],
        _PageSize: 1
      });
      if (publishedFile && publishedFile.Code === 1 && publishedFile.Data && /\/versions\//i.test(text(publishedFile.Data.HdfsPath))) {
        versionPath = text(publishedFile.Data.HdfsPath);
      }
    }
    if (isBlank(versionPath)) {
      var snapshotVersionNo = normalizeVersion(source.snapshotVersionNo || source.SnapshotVersionNo || app.CurrentVersion || 1);
      versionPath = stablePublishFilePath(appKey, relativePath, snapshotVersionNo);
      var previousPaths = toArray(source.previousFilePathNames || source.PreviousFilePathNames);
      var singlePreviousPath = text(source.previousFilePathName || source.PreviousFilePathName);
      if (!isBlank(singlePreviousPath)) previousPaths.unshift(singlePreviousPath);
      previousPaths.push(text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + appKey + "/" + relativePath);
      previousPaths.push(stablePublishFilePath(appKey, relativePath, ""));
      var previousBase64Result = null;
      for (var previousIndex = 0; previousIndex < previousPaths.length; previousIndex++) {
        var previousPath = normalizePath(previousPaths[previousIndex]);
        if (isBlank(previousPath) || /\/versions\//i.test(previousPath)) continue;
        var candidatePrevious = readPublishedBase64(previousPath);
        if (candidatePrevious && candidatePrevious.Code === 1 && !isBlank(candidatePrevious.Data)) {
          previousBase64Result = candidatePrevious;
          break;
        }
      }
      var allowCreateMissingHistory = source.allowCreateMissingHistory === true || source.AllowCreateMissingHistory === true
        || parseInt(source.allowCreateMissingHistory || source.AllowCreateMissingHistory || 0) === 1;
      if ((!previousBase64Result || previousBase64Result.Code !== 1) && !allowCreateMissingHistory) {
        return fail("稳定资源热修无法快照旧资源：" + relativePath);
      }
      var snapshotBase64 = previousBase64Result && previousBase64Result.Code === 1
        ? previousBase64Result.Data
        : sourceBase64Result.Data;
      var snapshotResult = publishBase64ToExactPublicPath(latestRoot + "/snapshot", relativePath, versionPath, snapshotBase64);
      if (!snapshotResult || snapshotResult.Code !== 1) return snapshotResult || fail("稳定资源热修历史快照失败：" + relativePath);
    }
    if (!/\/versions\//i.test(versionPath)) return fail("稳定资源热修缺少不可变历史路径：" + relativePath);

    var rootPath = text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + appKey + "/" + relativePath;
    var latestResult;
    var rootResult;
    if (/\.html?$/i.test(relativePath)) {
      var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(sourceBase64Result.Data));
      var runtimeHtml = injectRuntimeContext(html);
      var runtimeHtmlBase64 = System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(runtimeHtml));
      latestResult = publishTextAsset(latestRoot, appKey, relativePath, "", runtimeHtml);
      rootResult = publishBase64ToExactPublicPath(latestRoot, relativePath, rootPath, runtimeHtmlBase64);
    } else {
      latestResult = publishBase64Asset(latestRoot, appKey, relativePath, "", sourceBase64Result.Data);
      rootResult = publishBase64ToExactPublicPath(latestRoot, relativePath, rootPath, sourceBase64Result.Data);
    }
    if (!latestResult || latestResult.Code !== 1) return latestResult || fail("稳定资源热修发布失败：" + relativePath);
    if (!rootResult || rootResult.Code !== 1) return rootResult || fail("稳定资源根路径热修发布失败：" + relativePath);
    var latestPath = latestResult.Data ? latestResult.Data.Path || "" : "";
    var fileUpdate = upsertPublishedBuildFile(app, relativePath, source, versionPath, latestPath);
    if (!fileUpdate || fileUpdate.Code !== 1) return fileUpdate || fail("写入稳定资源热修元数据失败：" + relativePath);
    promoted.push({ Path: relativePath, StableFilePathName: latestPath, RootFilePathName: rootPath, VersionFilePathName: versionPath, Size: parseInt(source.size || source.Size || 0) });
    stablePaths.push(latestPath);
    stablePaths.push(rootPath);
  }
  return ok({ Assets: promoted, AssetCount: promoted.length, StablePaths: stablePaths }, "稳定资源热修发布成功");
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
  var generatedInner = null;
  if (/\.html?$/i.test(relativePath)) {
    var html = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(sourceBase64Result.Data));
    html = injectRuntimeContext(html);
    if (isEntry && isUniAppApplication(app) && !hasUniAppPreviewShell(html)) {
      var versionInnerResult = publishTextAsset(versionRoot, appKey, "app.html", normalizedVersion, html);
      if (!versionInnerResult || versionInnerResult.Code !== 1) return versionInnerResult || fail("发布商城 UniApp 历史版内层入口失败");
      var latestInnerResult = publishTextAsset(latestRoot, appKey, "app.html", "", html);
      if (!latestInnerResult || latestInnerResult.Code !== 1) return latestInnerResult || fail("发布商城 UniApp 最新内层入口失败");
      var versionInnerPath = versionInnerResult.Data ? versionInnerResult.Data.Path || "" : "";
      var latestInnerPath = latestInnerResult.Data ? latestInnerResult.Data.Path || "" : "";
      var innerUpdate = upsertPublishedBuildFile(app, "app.html", source, versionInnerPath, latestInnerPath);
      if (!innerUpdate || innerUpdate.Code !== 1) return innerUpdate || fail("写入 UniApp 内层入口元数据失败");
      generatedInner = {
        Path: "app.html",
        FilePathName: versionInnerPath,
        StableFilePathName: latestInnerPath,
        Size: parseInt(source.size || source.Size || 0),
        Sha256: source.sha256 || source.Sha256 || source.hash || source.Hash || "",
        IsEntry: false,
        GeneratedFrom: relativePath
      };
      html = injectRuntimeContext(createUniAppPreviewShell(appKey, app.Name || app.AppName, normalizedVersion));
    }
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
    if (generatedInner) result.GeneratedAssets = [generatedInner];
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
  return applicationTypeOf(app).toLowerCase() === "web" ? inlineWebHtml(files, app) : compileUniAppHtml(files, app);
}
function previewUrl(appId, versionNo) {
  return "/apiengine/ai_app_preview--OsClient--" + text(V8.OsClient) + "--?AppId=" + text(appId) + "&v=" + text(versionNo) + "&t=" + V8.Method.GetTimestamp();
}

var appId = text(V8.Param.AppId || V8.Param.ProjectId);
if (isBlank(appId)) return fail("AppId不能为空");
var app = getApp(appId);
if (!app || app.Code !== 1 || !app.Data) return { Code: 2, Data: null, Msg: "AI应用不存在" };
var requestedAction = text(V8.Param.Action || "Build");
/* RESUMABLE_PUBLIC_DOWNLOAD_REGISTRATION_V1
 * 大安装包先通过 ApplicationAsset Protocol v3 完成分片、断点续传、逐片
 * SHA-256 与服务端合并校验；这里只登记已经 Succeeded 的不可变公有对象，
 * 不再跨存储上下文二次移动。禁止 Jint 读取大文件或绕过会话审计。
 * PromoteResumablePublicDownload 作为已发布调用名继续兼容。 */
if (requestedAction === "RegisterResumablePublicDownload"
  || requestedAction === "PromoteResumablePublicDownload") {
  var downloadAppKey = ensureAppKey(app.Data);
  var downloadSessionId = text(V8.Param.SessionId);
  var downloadVersionNo = text(V8.Param.VersionNo || V8.Param.AppVersion);
  var downloadRelativePath = normalizePath(V8.Param.RelativePath);
  var downloadExpectedSha256 = text(V8.Param.ExpectedSha256).toLowerCase();
  var downloadExpectedSize = parseInt(V8.Param.ExpectedSize || -1);
  if (!/^mciau-[a-f0-9]{30,64}$/i.test(downloadSessionId)) return fail("SessionId不合法");
  if (!/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(downloadVersionNo)) return fail("VersionNo不合法");
  if (!/^downloads\/[A-Za-z0-9._-]+$/.test(downloadRelativePath)) return fail("RelativePath只允许当前应用downloads目录中的安全文件名");
  if (!/^[a-f0-9]{64}$/.test(downloadExpectedSha256)) return fail("ExpectedSha256不合法");
  if (!(downloadExpectedSize > 0)) return fail("ExpectedSize必须大于0");

  var downloadSession = V8.FormEngine.GetFormData("mci_ai_app_file", {
    _Where: [
      ["Id", "=", downloadSessionId],
      ["AND", "StorageScope", "=", "ApplicationAssetMultipartSession"]
    ],
    _PageSize: 1
  });
  if (!downloadSession || downloadSession.Code !== 1 || !downloadSession.Data) return fail("可恢复上传会话不存在");
  var downloadState;
  try { downloadState = JSON.parse(text(downloadSession.Data.Remark)); }
  catch (downloadStateError) { return fail("可恢复上传会话检查点不是有效JSON"); }
  var downloadSourceRoot = "microi/application-assets/v3/tenants/" + text(V8.OsClient).toLowerCase()
    + "/kinds/runtime/apps/" + downloadAppKey + "/releases/" + downloadVersionNo + "/requests/";
  var downloadSourcePath = normalizePath(downloadState.FinalPath);
  if (text(downloadState.Status) !== "Succeeded"
    || text(downloadState.Phase) !== "Prepared"
    || parseInt(downloadState.ProgressPercent || 0) !== 100
    || parseInt(downloadState.ReceivedBytes || -1) !== downloadExpectedSize
    || parseInt(downloadState.TotalSize || -1) !== downloadExpectedSize
    || text(downloadState.AppId) !== text(app.Data.Id)
    || text(downloadState.AppKey) !== downloadAppKey
    || text(downloadState.VersionNo) !== downloadVersionNo
    || normalizePath(downloadState.RelativePath) !== downloadRelativePath
    || text(downloadState.ExpectedSha256).toLowerCase() !== downloadExpectedSha256
    || downloadSourcePath.toLowerCase().indexOf(downloadSourceRoot.toLowerCase()) !== 0
    || downloadSourcePath.toLowerCase().slice(-("/assets/" + downloadRelativePath).length)
       !== ("/assets/" + downloadRelativePath).toLowerCase()) {
    return fail("上传会话尚未完成或应用、版本、路径、大小、哈希证据不一致");
  }
  var downloadTargetPath = downloadSourcePath;
  downloadState.DownloadRegisteredAt = now();
  downloadState.DownloadPublicPath = downloadTargetPath;
  downloadState.DownloadPublicUrl = publicDomainUrl(downloadTargetPath);
  var downloadAudit = V8.FormEngine.UptFormData("mci_ai_app_file", {
    Id: downloadSessionId,
    Remark: JSON.stringify(downloadState)
  });
  if (!downloadAudit || downloadAudit.Code !== 1) {
    return fail("大文件公有地址登记失败：" + text(downloadAudit && downloadAudit.Msg, "未知错误"));
  }
  return ok({
    AppId: app.Data.Id,
    AppKey: downloadAppKey,
    VersionNo: downloadVersionNo,
    SessionId: downloadSessionId,
    RelativePath: downloadRelativePath,
    Sha256: downloadExpectedSha256,
    Size: downloadExpectedSize,
    FilePathName: downloadTargetPath,
    Url: publicDomainUrl(downloadTargetPath)
  }, "可恢复大文件公有地址已登记并写回审计");
}
/* LEGACY_MICRO_APP_REDIRECT_PUBLISH_V1
 * 兼容入口只允许指向当前租户、当前应用、当前语义版本的 v3 不可变
 * committed runtime。版本目录保留不可变目标；固定当前入口使用 v3
 * resolver 作为永久 iframe 目标，即使 CDN 长期缓存入口壳也仍解析数据库
 * 已提交的最新版本。版本目录先发布，固定入口最后切换。 */
if (requestedAction === "PublishLegacyMicroAppRedirects") {
  var redirectAppKey = ensureAppKey(app.Data);
  var redirectVersionNo = text(V8.Param.VersionNo || V8.Param.AppVersion);
  var redirectBaseUrl = immutableRuntimeBaseUrl(redirectAppKey, redirectVersionNo, V8.Param.ImmutableBaseUrl);
  if (isBlank(redirectBaseUrl)) {
    return fail("ImmutableBaseUrl必须是当前租户、当前应用、当前版本的v3不可变运行时目录");
  }
  var stableResolverBaseUrl = stableRuntimeResolverBaseUrl(redirectAppKey);
  var redirectRoot = text(V8.OsClient).toLowerCase() + "/micro-app/" + redirectAppKey + "/";
  var redirectEntries = [
    { RelativePath: redirectVersionNo + "/index.html", TargetUrl: redirectBaseUrl + "/index.html" },
    { RelativePath: redirectVersionNo + "/unity/index.html", TargetUrl: redirectBaseUrl + "/unity/index.html" },
    { RelativePath: "unity/index.html", TargetUrl: (stableResolverBaseUrl || redirectBaseUrl) + "/unity/index.html" },
    { RelativePath: "index.html", TargetUrl: (stableResolverBaseUrl || redirectBaseUrl) + "/index.html" }
  ];
  var redirectStageRoot = "legacy-micro-app-redirect-stage/" + redirectAppKey + "/" + text(newId());
  var redirectPublished = [];
  var redirectRefreshPaths = [];
  for (var redirectIndex = 0; redirectIndex < redirectEntries.length; redirectIndex++) {
    var redirectEntry = redirectEntries[redirectIndex];
    var redirectTargetPath = redirectRoot + redirectEntry.RelativePath;
    var redirectUpload = uploadText(
      redirectStageRoot,
      redirectEntry.RelativePath,
      legacyRedirectHtml(redirectEntry.TargetUrl, redirectVersionNo),
      false
    );
    if (!redirectUpload || redirectUpload.Code !== 1) return redirectUpload || fail("兼容入口上传失败");
    var redirectUploadedPath = redirectUpload.Data ? redirectUpload.Data.HdfsPath || "" : "";
    var redirectMove = movePublicObject(redirectUploadedPath, redirectTargetPath);
    if (!redirectMove || redirectMove.Code !== 1) {
      return fail("兼容入口提升失败：" + redirectEntry.RelativePath
        + "；源=" + redirectUploadedPath
        + "；目标=" + redirectTargetPath
        + "；存储错误=" + text(redirectMove && redirectMove.Msg, "未知"));
    }
    redirectRefreshPaths.push(redirectTargetPath);
    redirectPublished.push({
      RelativePath: redirectEntry.RelativePath,
      TargetUrl: redirectEntry.TargetUrl,
      FilePathName: redirectTargetPath
    });
  }
  var redirectRefreshResult = refreshStableCdnPaths(redirectRefreshPaths, true);
  if (!redirectRefreshResult || redirectRefreshResult.Code !== 1) {
    return redirectRefreshResult || fail("兼容入口已发布，但CDN刷新失败");
  }
  return ok({
    AppId: appId,
    AppKey: redirectAppKey,
    VersionNo: redirectVersionNo,
    ImmutableBaseUrl: redirectBaseUrl,
    Published: redirectPublished,
    CdnRefresh: redirectRefreshResult.Data
  }, "兼容入口已发布并提交CDN刷新");
}
/* LEGACY_MICRO_APP_CDN_REFRESH_V1
 * v3 的权威入口是 versionless resolver，但历史外链仍可能位于
 * /{tenant}/micro-app/{appKey}/。这里只允许刷新当前应用自己的显式路径，
 * 不复制对象、不接受通配符，也不能跨应用或跨租户刷新。 */
if (requestedAction === "RefreshLegacyMicroAppCdn") {
  var legacyRefreshAppKey = ensureAppKey(app.Data);
  var legacyRefreshRoot = text(V8.OsClient).toLowerCase() + "/micro-app/" + legacyRefreshAppKey + "/";
  var legacyRefreshPaths = [];
  if (!isBlank(V8.Param.PathsJson)) {
    try { legacyRefreshPaths = toArray(JSON.parse(text(V8.Param.PathsJson))); }
    catch (legacyRefreshJsonError) { return fail("PathsJson不是有效的JSON数组：" + legacyRefreshJsonError.message); }
  }
  if (!legacyRefreshPaths.length) return fail("至少传入1个需要刷新的兼容入口路径");
  if (legacyRefreshPaths.length > 100) return fail("单次CDN刷新不能超过100个显式路径");
  var scopedLegacyRefreshPaths = [];
  for (var legacyRefreshIndex = 0; legacyRefreshIndex < legacyRefreshPaths.length; legacyRefreshIndex++) {
    var legacyExplicitPath = normalizePath(legacyRefreshPaths[legacyRefreshIndex]);
    if (isBlank(legacyExplicitPath)) return fail("CDN刷新路径不能为空");
    var legacyFullPath = legacyExplicitPath.toLowerCase().indexOf(legacyRefreshRoot.toLowerCase()) === 0
      ? legacyExplicitPath
      : legacyRefreshRoot + legacyExplicitPath;
    if (legacyFullPath.toLowerCase().indexOf(legacyRefreshRoot.toLowerCase()) !== 0) {
      return fail("CDN刷新路径超出当前应用兼容发布目录");
    }
    scopedLegacyRefreshPaths.push(legacyFullPath);
  }
  var legacyRefreshResult = refreshStableCdnPaths(scopedLegacyRefreshPaths, true);
  if (!legacyRefreshResult || legacyRefreshResult.Code !== 1) {
    return legacyRefreshResult || fail("兼容入口CDN刷新失败");
  }
  return ok({
    AppId: appId,
    AppKey: legacyRefreshAppKey,
    ExplicitPathCount: scopedLegacyRefreshPaths.length,
    CdnRefresh: legacyRefreshResult.Data
  }, "兼容入口CDN刷新任务已提交");
}
if (requestedAction === "RefreshStableCdn") {
  var refreshAppKey = ensureAppKey(app.Data);
  var refreshAppRoot = text(V8.OsClient).toLowerCase() + "/ai-app-publish/" + refreshAppKey + "/";
  var refreshBasePath = refreshAppRoot + "latest/";
  var manualRefreshPaths = [
    refreshBasePath + "index.html",
    refreshBasePath + "app.html",
    refreshBasePath + "microi-ai-app-auth.js"
  ];
  var explicitRefreshPaths = [];
  if (!isBlank(V8.Param.PathsJson)) {
    try { explicitRefreshPaths = toArray(JSON.parse(text(V8.Param.PathsJson))); }
    catch (refreshPathsJsonError) { return fail("PathsJson不是有效的 JSON 数组：" + refreshPathsJsonError.message); }
  }
  if (explicitRefreshPaths.length > 100) return fail("单次CDN刷新不能超过100个显式路径");
  for (var refreshIndex = 0; refreshIndex < explicitRefreshPaths.length; refreshIndex++) {
    var explicitPath = normalizePath(explicitRefreshPaths[refreshIndex]);
    var fullRefreshPath = explicitPath.toLowerCase().indexOf(refreshAppRoot.toLowerCase()) === 0
      ? explicitPath
      : refreshBasePath + explicitPath;
    var fullRefreshPathLower = fullRefreshPath.toLowerCase();
    if (fullRefreshPathLower.indexOf(refreshAppRoot.toLowerCase()) !== 0 || fullRefreshPathLower.indexOf("/versions/") >= 0) {
      return fail("CDN刷新路径超出当前应用可变发布目录");
    }
    manualRefreshPaths.push(fullRefreshPath);
  }
  var manualRefreshResult = refreshStableCdnPaths(manualRefreshPaths, explicitRefreshPaths.length > 0);
  if (!manualRefreshResult || manualRefreshResult.Code !== 1) return manualRefreshResult || fail("固定最新版CDN刷新失败");
  return ok({ AppId: appId, AppKey: refreshAppKey, ExplicitPathCount: explicitRefreshPaths.length, CdnRefresh: manualRefreshResult.Data }, "固定最新版CDN刷新任务已提交");
}
if (requestedAction === "PromoteStableAssetsBatch") {
  var stableAppKey = ensureAppKey(app.Data);
  var stableAssets = V8.Param.Assets;
  if (!isBlank(V8.Param.AssetsJson)) {
    try { stableAssets = JSON.parse(text(V8.Param.AssetsJson)); }
    catch (stableAssetsJsonError) { return fail("AssetsJson不是有效的 JSON 数组：" + stableAssetsJsonError.message); }
  }
  var stableResult = promoteStableStoreAssets(app.Data, stableAppKey, stableAssets);
  if (!stableResult || stableResult.Code !== 1) return stableResult || fail("稳定资源热修失败");
  return stableResult;
}
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
if (requestedAction === "PromoteStoreAssetsBatch") {
  var batchAppKey = ensureAppKey(app.Data);
  var batchVersionNo = normalizeVersion(V8.Param.VersionNo || V8.Param.AppVersion || app.Data.CurrentVersion || 1);
  var batchAssets = V8.Param.Assets;
  if (!isBlank(V8.Param.AssetsJson)) {
    try {
      batchAssets = JSON.parse(text(V8.Param.AssetsJson));
    } catch (batchAssetsJsonError) {
      return fail("AssetsJson不是有效的 JSON 数组：" + batchAssetsJsonError.message);
    }
  }
  var batchResult = promoteStoreAssets(app.Data, batchAppKey, batchVersionNo, batchAssets, false);
  if (!batchResult || batchResult.Code !== 1) return batchResult || fail("商城编译资产分批发布失败");
  return ok({
    AppId: appId,
    AppKey: batchAppKey,
    VersionNo: batchVersionNo,
    Assets: batchResult.Data.Assets,
    AssetCount: batchResult.Data.AssetCount,
    PreviewUrl: batchResult.Data.PreviewUrl || "",
    PublishPath: batchResult.Data.PublishPath || ""
  }, "商城编译资产分批发布成功");
}
if (requestedAction === "FinalizeStoreAssets") {
  var finalizedAppKey = ensureAppKey(app.Data);
  var finalizedVersionNo = normalizeVersion(V8.Param.VersionNo || V8.Param.AppVersion || app.Data.CurrentVersion || 1);
  var finalizedPath = stablePublishFilePath(finalizedAppKey, "index.html", "");
  var finalizedVersionPath = stablePublishFilePath(finalizedAppKey, "index.html", finalizedVersionNo);
  var finalizedUrl = publicDomainUrl(finalizedPath);
  if (isBlank(finalizedUrl)) finalizedUrl = getFileUrl(finalizedPath, false);
  var finalizedCount = parseInt(V8.Param.AssetCount || 0);
  var finalizedVersion = V8.FormEngine.AddFormData("mci_ai_app_version", {
    AppId: appId,
    AppName: app.Data.Name || "",
    VersionNo: finalizedVersionNo,
    VersionName: finalizedVersionNo,
    Status: "Published",
    SourceSnapshotPath: app.Data.PrivateSourcePath || ("ai-app-source/" + appId),
    PublishPath: finalizedVersionPath,
    PreviewUrl: publicDomainUrl(finalizedVersionPath),
    BuildTaskId: "",
    BuildLog: JSON.stringify({ Mode: "BatchedCompiledAssets", AssetCount: finalizedCount }),
    ChangeSummary: text(V8.Param.ChangeSummary || "分批发布统一登录与租户运行时"),
    FileCount: finalizedCount,
    TotalSize: parseInt(V8.Param.TotalSize || 0)
  });
  if (!finalizedVersion || finalizedVersion.Code !== 1) return finalizedVersion || fail("分批发布版本记录写入失败");
  var finalizedUpdate = V8.FormEngine.UptFormData("sys_microistore", {
    Id: appId,
    AppKey: finalizedAppKey,
    CurrentVersion: parseInt(app.Data.CurrentVersion || 0) + 1,
    Status: "Published",
    BuildStatus: "Success",
    PreviewUrl: finalizedUrl,
    PublicPublishPath: finalizedPath,
    LastBuildTaskId: "",
    LastBuildMsg: "真实编译产物已分批发布，共 " + finalizedCount + " 个文件。",
    UpdateTime: now()
  });
  if (!finalizedUpdate || finalizedUpdate.Code !== 1) return finalizedUpdate || fail("分批发布商城记录更新失败");
  return ok({ AppId: appId, AppKey: finalizedAppKey, VersionNo: finalizedVersionNo, PreviewUrl: finalizedUrl, PublishPath: finalizedPath, AssetCount: finalizedCount }, "分批发布已完成");
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
    repairResult = publishCompiledFiles(repairFiles, repairBuildRoot, app.Data, repairAppKey, repairVersionNo);
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
if (applicationTypeOf(app.Data).toLowerCase() === "microservice") {
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
var cdnRefreshResult = ok({ Skipped: true, Reason: "尚未生成固定最新版入口" });
if (!isBlank(buildRoot)) {
  var compiledResult = publishCompiledFiles(files, buildRoot, app.Data, appKey, versionNo);
  if (!compiledResult || compiledResult.Code !== 1) return compiledResult || fail("真实编译产物发布失败");
  compiledAssets = compiledResult.Data;
  publicPath = compiledAssets.EntryPath;
  versionPath = compiledAssets.VersionEntryPath || publicPath;
  url = publicDomainUrl(publicPath);
  if (isBlank(url)) url = getFileUrl(publicPath, false);
  versionUrl = publicDomainUrl(versionPath);
  if (isBlank(versionUrl)) versionUrl = getFileUrl(versionPath, false);
  buildMode = "CompiledAssets";
  var stableAssetPaths = [];
  for (var stableAssetIndex = 0; stableAssetIndex < compiledAssets.Assets.length; stableAssetIndex++) {
    stableAssetPaths.push(compiledAssets.Assets[stableAssetIndex].StableFilePathName);
  }
  cdnRefreshResult = refreshStableCdnPaths(stableAssetPaths);
} else {
  previewHtml = injectRuntimeContext(compilePreviewHtml(files, app.Data));
  if (isUniAppApplication(app.Data) && !hasUniAppPreviewShell(previewHtml)) {
    var fallbackVersionInner = publishTextAsset(versionRoot, appKey, "app.html", versionNo, previewHtml);
    if (!fallbackVersionInner || fallbackVersionInner.Code !== 1) return fallbackVersionInner || fail("发布 UniApp 历史版内层入口失败");
    var fallbackLatestInner = publishTextAsset(publishRoot, appKey, "app.html", "", previewHtml);
    if (!fallbackLatestInner || fallbackLatestInner.Code !== 1) return fallbackLatestInner || fail("发布 UniApp 最新内层入口失败");
    previewHtml = injectRuntimeContext(createUniAppPreviewShell(appKey, app.Data.Name || app.Data.AppName, versionNo));
    buildMode = "GeneratedUniAppShell";
  }
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
  cdnRefreshResult = refreshStableCdnPaths([publicPath, stablePath]);
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
  ChangeSummary: text(V8.Param.ChangeSummary || (applicationTypeOf(app.Data).toLowerCase() === "web" ? "Web 应用服务端发布" : "UniApp H5 预览编译发布")),
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
  LastBuildMsg: buildMode === "CompiledAssets" ? "真实编译产物已完整发布，共 " + compiledAssets.AssetCount + " 个文件。" : ((applicationTypeOf(app.Data).toLowerCase() === "web" ? "Web 应用已服务端发布。" : "UniApp 已服务端生成 PC 手机壳与移动端去壳预览。") + (stableMove && stableMove.Code === 1 ? " 已生成固定应用Key地址。" : " 已使用当前HDFS发布地址。")),
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
  CdnRefresh: cdnRefreshResult,
  BuildStatus: "Success",
  BuildMode: buildMode,
  AssetCount: compiledAssets ? compiledAssets.AssetCount : 1,
  Message: buildMode === "CompiledAssets" ? "真实 H5 编译产物发布成功" : (applicationTypeOf(app.Data).toLowerCase() === "web" ? "Web 应用发布成功" : "UniApp H5 预览发布成功")
});
