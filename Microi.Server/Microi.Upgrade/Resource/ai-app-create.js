/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：ai_app_create
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_create
 * Version: v1.2.3
 * Function:
 * - 统一使用 sys_microistore 作为应用主表；新建 Web 与 MicroService 默认使用 Vue 3 + Vite + TypeScript 稳定架构；UniApp 脚手架通过接口引擎自定义地址调用，确保系统日志/监控可按真实 ApiEngineKey 归因。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || "成功" }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || "执行失败" }; }
function text(value, fallback) {
  if (value === null || value === undefined) return fallback || "";
  return String(value);
}
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, "") === ""; }
function now() { return DateNow("yyyy-MM-dd HH:mm:ss"); }
function newId() { return V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid(); }
function currentUserId() { return V8.CurrentUser && V8.CurrentUser.Id ? text(V8.CurrentUser.Id) : ""; }
function currentUserName() { return V8.CurrentUser ? text(V8.CurrentUser.Name || V8.CurrentUser.Account || "") : ""; }
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
function fileTypeOf(path) {
  var name = fileNameOf(path).toLowerCase();
  var idx = name.lastIndexOf(".");
  return idx > -1 ? name.substring(idx + 1) : "text";
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
function readText(hdfsPath, limit) {
  if (isBlank(hdfsPath)) return ok("");
  var result = V8.Method.GetPrivateFileText({
    OsClient: V8.OsClient,
    FilePathName: hdfsPath,
    Limit: limit !== false
  });
  if (!result || result.Code !== 1) return result || fail("读取文件失败");
  return ok(text(result.Data));
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
function sha256(content) {
  if (V8.EncryptHelper && V8.EncryptHelper.SHA256) return V8.EncryptHelper.SHA256(text(content));
  return text(content).length.toString();
}
function normalizeAppKey(value, fallback) {
  var raw = text(value);
  if (isBlank(raw)) raw = text(fallback);
  raw = raw.toLowerCase()
    .replace(/s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (isBlank(raw)) raw = "app-" + text(newId()).toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 12);
  if (!/^[a-z]/.test(raw)) raw = "app-" + raw;
  if (raw.length > 80) raw = raw.substring(0, 80).replace(/[-_]+$/g, "");
  return raw;
}
function isValidExplicitAppKey(value) {
  var raw = text(value);
  return /^[A-Za-z][A-Za-z0-9_-]{1,79}$/.test(raw);
}
function getApp(appId) {
  return V8.FormEngine.GetFormData("sys_microistore", {
    _Where: [["Id", "=", appId]],
    _SelectFields: ["Id", "Name", "AppKey", "AppType", "Description", "Category", "Status", "OwnerUserId", "OwnerName", "CurrentVersion", "PreviewUrl", "PublicPublishPath", "PrivateSourcePath", "BuildStatus", "LastBuildTaskId", "LastBuildMsg", "LastConversationId", "CreateTime", "UpdateTime"]
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
function getVersions(appId) {
  return V8.FormEngine.GetTableData("mci_ai_app_version", {
    _Where: [["AppId", "=", appId]],
    _SelectFields: ["Id", "AppId", "AppName", "VersionNo", "VersionName", "Status", "SourceSnapshotPath", "PublishPath", "PreviewUrl", "BuildTaskId", "BuildLog", "ChangeSummary", "FileCount", "TotalSize", "CreateTime", "UpdateTime"],
    _OrderBy: "CreateTime",
    _OrderByType: "DESC",
    _PageSize: 100
  });
}

function starterFiles(appType, appName, description) {
  if (appType === "UniApp") return beautyUniAppFiles(appName, description);
  if (appType === "MicroService") return microServiceStarterFiles(appName, description);
  return webStarterFiles(appName, description);
}
function sourceLines(items) { return items.join("\n") + "\n"; }
function safeScriptJson(value) { return JSON.stringify(text(value)).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029"); }
function vuePackageJson(appType) {
  return JSON.stringify({
    name: appType === "MicroService" ? "microi-ai-microservice" : "microi-ai-web-app" ,
    version: "1.0.0" ,
    private: true,
    type: "module" ,
    engines: { node: "^20.19.0 || >=22.12.0" },
    scripts: { dev: "vite", typecheck: "vue-tsc --noEmit", build: "vue-tsc --noEmit && vite build", preview: "vite preview" },
    dependencies: { vue: "3.5.40" },
    devDependencies: { "@vitejs/plugin-vue": "6.0.8", typescript: "5.9.3", vite: "7.3.6", "vue-tsc": "3.3.9" }
  }, null, 2);
}
function vueTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      module: "ESNext",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      skipLibCheck: true,
      moduleResolution: "Bundler",
      allowJs: true,
      checkJs: false,
      resolveJsonModule: true,
      isolatedModules: true,
      esModuleInterop: true,
      strict: true,
      noEmit: true,
      types: ["vite/client"]
    },
    include: ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue", "vite.config.ts"]
  }, null, 2);
}
function vueViteConfig() {
  return sourceLines([
    "import { defineConfig } from 'vite'",
    "import vue from '@vitejs/plugin-vue'",
    "",
    "export default defineConfig({",
    "  base: './',",
    "  plugins: [vue()],",
    "  build: {",
    "    outDir: 'dist',",
    "    assetsDir: 'assets',",
    "    emptyOutDir: true,",
    "  },",
    "})",
  ]);
}
function vueIndexHtml() {
  return sourceLines([
    "<!doctype html>",
    "<html lang=\"zh-CN\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    "    <meta name=\"color-scheme\" content=\"light\" />",
    "    <title>Microi AI Application</title>",
    "  </head>",
    "  <body>",
    "    <div id=\"app\"></div>",
    "    <script type=\"module\" src=\"/src/main.ts\"></script>",
    "  </body>",
    "</html>",
  ]);
}
function vueEnvDts() {
  return sourceLines([
    "/// <reference types=\"vite/client\" />",
    "",
    "interface MicroAppHost {",
    "  getData?: () => Record<string, unknown>",
    "  dispatch?: (payload: unknown) => void",
    "}",
    "",
    "interface Window {",
    "  microApp?: MicroAppHost",
    "  __MICROI_APP_CONTEXT__?: Record<string, unknown>",
    "}",
  ]);
}
function vueMicroiSdk() {
  return "/*\n * Microi V8 前端标准开发包。\n * 面向 Vue 3 与 uni-app 项目，不强依赖固定的界面库或状态管理方案。\n * 统一封装吾码接口引擎、表单引擎、文件服务、登录态与旧版 V8 前端接口。\n */\n\n// 默认把这些状态码视为登录态失效，便于各端统一跳转或清理缓存。\nconst DEFAULT_AUTH_CODES = [401, -1, 1001, 1002];\n\n// 禁用常见占位图和外部二维码资源，避免前端误把临时素材带到正式项目。\nconst DEFAULT_BLOCKED_ASSET = /(qrserver\\.com|create-qr-code|picsum\\.photos|placehold\\.co|placeholder\\.com|dummyimage\\.com)/i;\n\n// 兼容浏览器、uni-app、小程序运行时以及测试环境中的全局对象读取。\nfunction getGlobalValue(key) {\n  try {\n    if (typeof globalThis !== 'undefined' && globalThis[key] !== undefined) return globalThis[key];\n  } catch (e) {}\n  return undefined;\n}\n\nfunction getUni() {\n  try {\n    if (typeof uni !== 'undefined' && uni && typeof uni === 'object') return uni;\n  } catch (e) {}\n  const runtimeUni = getGlobalValue('uni');\n  return runtimeUni && typeof runtimeUni === 'object' ? runtimeUni : null;\n}\n\nfunction hasWindow() {\n  return typeof window !== 'undefined' && !!window;\n}\n\n// 下面这些方法只做路径与查询参数拼装，不参与业务语义判断。\nfunction normalizeBase(url) {\n  return String(url || '').replace(/\\/+$/, '');\n}\n\nfunction trimLeftSlash(value) {\n  return String(value || '').replace(/^\\/+/, '');\n}\n\nfunction joinUrl(base, path) {\n  const value = String(path || '');\n  if (/^(https?:|data:|blob:|file:)/i.test(value)) return value;\n  return `${normalizeBase(base)}/${trimLeftSlash(value)}`;\n}\n\nfunction appendQuery(url, key, value) {\n  if (!value || new RegExp(`[?&]${key}=`, 'i').test(url)) return url;\n  const sep = url.indexOf('?') >= 0 ? '&' : '?';\n  return `${url}${sep}${key}=${encodeURIComponent(value)}`;\n}\n\nfunction appendQueryObject(url, data) {\n  if (!data || typeof data !== 'object' || Array.isArray(data)) return url;\n  const parts = [];\n  Object.keys(data).forEach((key) => {\n    const value = data[key];\n    if (value === undefined || value === null || value === '') return;\n    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);\n    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);\n  });\n  if (!parts.length) return url;\n  return `${url}${url.indexOf('?') >= 0 ? '&' : '?'}${parts.join('&')}`;\n}\n\nfunction parseMaybeJson(value, fallback = {}) {\n  if (typeof value !== 'string') return value == null ? fallback : value;\n  const text = value.trim();\n  if (!text) return fallback;\n  try {\n    return JSON.parse(text);\n  } catch (e) {\n    return fallback;\n  }\n}\n\n// 没有 uni 或浏览器缓存时退回内存缓存，保证单元测试和服务端渲染不会崩溃。\nfunction createMemoryStorage() {\n  const cache = new Map();\n  return {\n    get(key) {\n      return cache.has(key) ? cache.get(key) : '';\n    },\n    set(key, value) {\n      cache.set(key, value);\n    },\n    remove(key) {\n      cache.delete(key);\n    }\n  };\n}\n\nfunction createDefaultStorage() {\n  const runtimeUni = getUni();\n  if (runtimeUni && typeof runtimeUni.getStorageSync === 'function') {\n    return {\n      get(key) {\n        try {\n          return runtimeUni.getStorageSync(key) || '';\n        } catch (e) {\n          return '';\n        }\n      },\n      set(key, value) {\n        try {\n          runtimeUni.setStorageSync(key, value);\n        } catch (e) {}\n      },\n      remove(key) {\n        try {\n          runtimeUni.removeStorageSync(key);\n        } catch (e) {}\n      }\n    };\n  }\n\n  if (hasWindow() && window.localStorage) {\n    return {\n      get(key) {\n        try {\n          return window.localStorage.getItem(key) || '';\n        } catch (e) {\n          return '';\n        }\n      },\n      set(key, value) {\n        try {\n          window.localStorage.setItem(key, value);\n        } catch (e) {}\n      },\n      remove(key) {\n        try {\n          window.localStorage.removeItem(key);\n        } catch (e) {}\n      }\n    };\n  }\n\n  return createMemoryStorage();\n}\n\nfunction serializeUser(value) {\n  if (!value) return '';\n  return typeof value === 'string' ? value : JSON.stringify(value);\n}\n\nfunction deserializeUser(value) {\n  if (!value) return null;\n  if (typeof value === 'object') return value;\n  return parseMaybeJson(value, null);\n}\n\n// 吾码文件字段可能来自上传控件、HDFS 接口、字符串或 JSON 字符串，这里统一抽取可用路径。\nfunction extractUploadPath(value) {\n  if (!value) return '';\n  if (typeof value === 'object') {\n    const raw = Array.isArray(value) ? (value[0] || {}) : value;\n    if (typeof raw === 'string') return extractUploadPath(raw);\n    return raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL ||\n      raw.FullUrl || raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || '';\n  }\n\n  const text = String(value || '').trim();\n  if (!text) return '';\n  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {\n    return extractUploadPath(parseMaybeJson(text, text));\n  }\n  return text;\n}\n\nfunction normalizeUploadValue(value) {\n  if (!value) return [];\n  if (Array.isArray(value)) return value.map(extractUploadPath).filter(Boolean);\n  if (typeof value === 'object') {\n    const path = extractUploadPath(value);\n    return path ? [path] : [];\n  }\n\n  const text = String(value || '').trim();\n  if (!text) return [];\n  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {\n    const parsed = parseMaybeJson(text, null);\n    if (Array.isArray(parsed)) return parsed.map(extractUploadPath).filter(Boolean);\n    const path = extractUploadPath(parsed);\n    return path ? [path] : [];\n  }\n  return [text];\n}\n\nfunction normalizeUploadData(body) {\n  const raw = Array.isArray(body && body.Data) ? (body.Data[0] || {}) : ((body && body.Data) || {});\n  const path = raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || raw.Url || raw.FileUrl || '';\n  const url = raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL || '';\n  return { ...raw, Path: path, Url: url };\n}\n\nfunction normalizeClientUploadPath(value) {\n  let path = String(value || 'upload').trim().replace(/\\\\/g, '/');\n  if (/^(https?:|data:|blob:|file:)/i.test(path)) throw new Error('上传路径不合法。');\n  path = path.replace(/^\\/+/, '').replace(/\\/+$/, '').replace(/\\/{2,}/g, '/');\n  if (!path || path.startsWith('~') || path.includes('..') || path.includes(':')) {\n    throw new Error('上传路径不合法。');\n  }\n  const parts = path.split('/').filter(Boolean);\n  if (!parts.length || parts.some((item) => item === '.' || item === '..')) {\n    throw new Error('上传路径不合法。');\n  }\n  return parts.join('/');\n}\n\nfunction normalizeFileUrlData(data, assetUrl, fallback = '') {\n  const raw = Array.isArray(data) ? (data[0] || '') : (data || '');\n  if (typeof raw === 'string') return assetUrl(raw || fallback);\n  const url = raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL || raw.FullUrl || '';\n  const path = raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || '';\n  return assetUrl(url || path || fallback);\n}\n\nfunction isLocalPackagedAsset(path) {\n  return /^(?:\\.\\/)?\\/?static\\//i.test(String(path || ''));\n}\n\nfunction hasPublicUploadFlag(value) {\n  if (!value || typeof value !== 'object') return false;\n  const raw = Array.isArray(value) ? (value[0] || {}) : value;\n  return raw.Limit === false || raw.Limit === 0 || String(raw.Limit).toLowerCase() === 'false' ||\n    raw.IsPrivate === false || raw.Private === false || raw.Public === true;\n}\n\nfunction isKnownPublicUploadPath(path) {\n  // Ordinary form uploads such as /xjy/img and /xjy/file are private by default.\n  // They must use the Managed signer instead of being mistaken for CDN assets.\n  return /^\\/?(?:public|mci-public|xjy\\/xjy\\/miniapp-assets|xjy\\/miniapp\\/share)\\//i.test(String(path || ''));\n}\n\nfunction getHeaderValue(headers, key) {\n  if (!headers) return '';\n  const lower = key.toLowerCase();\n  if (typeof headers.get === 'function') {\n    const value = headers.get(key) || headers.get(lower);\n    if (value) return value;\n  }\n  for (const name of Object.keys(headers)) {\n    if (String(name).toLowerCase() === lower) return headers[name];\n  }\n  return '';\n}\n\nfunction setSingletonHeader(headers, key, value) {\n  const lower = String(key).toLowerCase();\n  Object.keys(headers).forEach((name) => {\n    if (String(name).toLowerCase() === lower) delete headers[name];\n  });\n  if (value !== undefined && value !== null && value !== '') headers[key] = value;\n}\n\nfunction normalizeBearer(value) {\n  const text = String(value || '').trim();\n  return /^Bearer\\s+/i.test(text) ? text.replace(/^Bearer\\s+/i, '') : text;\n}\n\n// 兼容浏览器上传对象、组件包装对象和 uni-app 临时文件路径。\nfunction isUploadFileLike(value) {\n  if (!value) return false;\n  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;\n  return typeof value.arrayBuffer === 'function';\n}\n\nfunction pickUploadFileLike(value) {\n  if (!value) return null;\n  if (isUploadFileLike(value)) return value;\n  if (typeof value !== 'object') return null;\n  const keys = ['file', 'raw', 'blob', 'originFileObj', 'tempFile', 'data'];\n  for (const key of keys) {\n    const picked = pickUploadFileLike(value[key]);\n    if (picked) return picked;\n  }\n  return null;\n}\n\nfunction pickUploadFileName(value) {\n  if (!value) return '';\n  if (typeof value === 'object') {\n    if (value.name) return String(value.name);\n    const keys = ['file', 'raw', 'blob', 'originFileObj', 'tempFile', 'data'];\n    for (const key of keys) {\n      const name = pickUploadFileName(value[key]);\n      if (name) return name;\n    }\n    const path = value.path || value.tempFilePath || value.url || value.src || value.localUrl || value.fullPath || '';\n    if (path) return inferUploadFileName(path);\n  }\n  return '';\n}\n\nfunction inferUploadFileName(value) {\n  const text = String(value || '').split('?')[0].split('#')[0];\n  const name = decodeURIComponent((text.split('/').pop() || '').trim());\n  return name && name.indexOf(':') < 0 ? name : '';\n}\n\nfunction pickUploadFileSource(filePath, options = {}) {\n  const candidates = [options.file, filePath];\n  for (const item of candidates) {\n    if (!item) continue;\n    if (typeof item === 'string') return item;\n    if (typeof item === 'object') {\n      const path = item.path || item.tempFilePath || item.url || item.src || item.localUrl || item.fullPath || '';\n      if (path) return String(path);\n    }\n  }\n  return '';\n}\n\nasync function resolveFetchUploadFile(filePath, options = {}) {\n  const direct = pickUploadFileLike(options.file) || pickUploadFileLike(filePath);\n  const name = options.fileName || pickUploadFileName(options.file) || pickUploadFileName(filePath) || inferUploadFileName(filePath) || 'file';\n  if (direct) return { file: direct, name };\n\n  const source = pickUploadFileSource(filePath, options);\n  if (source && typeof fetch === 'function' && /^(blob:|data:)/i.test(source)) {\n    const res = await fetch(source);\n    const blob = await res.blob();\n    return { file: blob, name };\n  }\n  return { file: null, name };\n}\n\n// 控制接口并发，适合列表页批量请求时给后端和小程序运行时减压。\nfunction createQueue(maxConcurrent) {\n  const limit = Number(maxConcurrent || 0);\n  if (!limit || limit <= 0) {\n    return async function runNow(task) {\n      return task();\n    };\n  }\n\n  let active = 0;\n  const waiting = [];\n  function release() {\n    if (waiting.length) {\n      const next = waiting.shift();\n      active += 1;\n      next();\n    } else {\n      active = Math.max(0, active - 1);\n    }\n  }\n\n  return function runQueued(task) {\n    return new Promise((resolve, reject) => {\n      const start = () => {\n        Promise.resolve()\n          .then(task)\n          .then(resolve, reject)\n          .finally(release);\n      };\n      if (active < limit) {\n        active += 1;\n        start();\n      } else {\n        waiting.push(start);\n      }\n    });\n  };\n}\n\nfunction defaultToast(message) {\n  const runtimeUni = getUni();\n  if (runtimeUni && typeof runtimeUni.showToast === 'function') {\n    runtimeUni.showToast({ title: String(message || ''), icon: 'none' });\n    return;\n  }\n  if (hasWindow() && typeof window.alert === 'function') window.alert(String(message || ''));\n}\n\nfunction defaultConfirm(message) {\n  const runtimeUni = getUni();\n  if (runtimeUni && typeof runtimeUni.showModal === 'function') {\n    return new Promise((resolve) => {\n      runtimeUni.showModal({\n        title: '',\n        content: String(message || ''),\n        success: (res) => resolve(!!res.confirm),\n        fail: () => resolve(false)\n      });\n    });\n  }\n  if (hasWindow() && typeof window.confirm === 'function') return Promise.resolve(window.confirm(String(message || '')));\n  return Promise.resolve(true);\n}\n\n// fetch 的超时需要 AbortController；不支持时由运行时自身处理。\nfunction createFetchTimeout(timeout) {\n  if (typeof AbortController === 'undefined') return {};\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), Number(timeout || 30000));\n  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };\n}\n\nfunction getSafeArea() {\n  const runtimeUni = getUni();\n  if (runtimeUni && typeof runtimeUni.getSystemInfoSync === 'function') {\n    try {\n      const info = runtimeUni.getSystemInfoSync();\n      const insets = info.safeAreaInsets || {};\n      const safeArea = info.safeArea || {};\n      return {\n        top: Number(insets.top || safeArea.top || info.statusBarHeight || 0),\n        bottom: Number(insets.bottom || 0),\n        left: Number(insets.left || 0),\n        right: Number(insets.right || 0),\n        statusBarHeight: Number(info.statusBarHeight || 0),\n        windowHeight: Number(info.windowHeight || 0),\n        windowWidth: Number(info.windowWidth || 0),\n        platform: info.platform || ''\n      };\n    } catch (e) {}\n  }\n  return { top: 0, bottom: 0, left: 0, right: 0, statusBarHeight: 0, windowHeight: 0, windowWidth: 0, platform: '' };\n}\n\n// 常用日期、数字与显示格式化，兼容旧版前端 V8 写法。\nfunction formatDate(value, format = 'yyyy-MM-dd HH:mm:ss') {\n  const date = value instanceof Date ? value : new Date(value || Date.now());\n  if (Number.isNaN(date.getTime())) return '';\n  const pad = (num, len = 2) => String(num).padStart(len, '0');\n  const map = {\n    yyyy: date.getFullYear(),\n    MM: pad(date.getMonth() + 1),\n    dd: pad(date.getDate()),\n    HH: pad(date.getHours()),\n    mm: pad(date.getMinutes()),\n    ss: pad(date.getSeconds()),\n    SSS: pad(date.getMilliseconds(), 3)\n  };\n  return Object.keys(map).reduce((text, key) => text.replace(new RegExp(key, 'g'), map[key]), format);\n}\n\nfunction toNumber(value, fallback = 0) {\n  const num = Number(value);\n  return Number.isFinite(num) ? num : fallback;\n}\n\nfunction maskPhone(value) {\n  const text = String(value || '');\n  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(-4)}` : text;\n}\n\nfunction formatCompactNumber(value, digits = 2) {\n  const num = toNumber(value, 0);\n  const abs = Math.abs(num);\n  if (abs >= 100000000) return `${(num / 100000000).toFixed(digits).replace(/\\.?0+$/, '')}亿`;\n  if (abs >= 10000) return `${(num / 10000).toFixed(digits).replace(/\\.?0+$/, '')}万`;\n  return `${num}`;\n}\n\nfunction addTime(value, unit, number) {\n  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());\n  const amount = Number(number || 0);\n  switch (unit) {\n    case 's':\n      date.setSeconds(date.getSeconds() + amount);\n      break;\n    case 'n':\n    case 'm':\n      date.setMinutes(date.getMinutes() + amount);\n      break;\n    case 'h':\n      date.setHours(date.getHours() + amount);\n      break;\n    case 'd':\n      date.setDate(date.getDate() + amount);\n      break;\n    case 'w':\n      date.setDate(date.getDate() + amount * 7);\n      break;\n    case 'q':\n      date.setMonth(date.getMonth() + amount * 3);\n      break;\n    case 'M':\n      date.setMonth(date.getMonth() + amount);\n      break;\n    case 'y':\n      date.setFullYear(date.getFullYear() + amount);\n      break;\n    default:\n      date.setMilliseconds(date.getMilliseconds() + amount);\n      break;\n  }\n  return date;\n}\n\nfunction diffTime(value, unit, value2) {\n  const d1 = value instanceof Date ? value : new Date(value);\n  const d2 = value2 instanceof Date ? value2 : new Date(value2 || Date.now());\n  const t1 = d1.getTime();\n  const t2 = d2.getTime();\n  const year = d2.getFullYear() - d1.getFullYear();\n  const map = {\n    y: year,\n    q: year * 4 + Math.floor(d2.getMonth() / 4) - Math.floor(d1.getMonth() / 4),\n    M: year * 12 + d2.getMonth() - d1.getMonth(),\n    m: year * 12 + d2.getMonth() - d1.getMonth(),\n    ms: t2 - t1,\n    w: Math.floor((t2 + 345600000) / 604800000) - Math.floor((t1 + 345600000) / 604800000),\n    d: Math.floor(t2 / 86400000) - Math.floor(t1 / 86400000),\n    h: Math.floor(t2 / 3600000) - Math.floor(t1 / 3600000),\n    n: Math.floor(t2 / 60000) - Math.floor(t1 / 60000),\n    s: Math.floor(t2 / 1000) - Math.floor(t1 / 1000)\n  };\n  return map[unit];\n}\n\n// 老项目里常用 Date.prototype.Format/AddTime/DiffTime，这里只在缺失时补齐。\nfunction installDatePrototypeCompat() {\n  if (typeof Date === 'undefined' || !Date.prototype) return;\n  if (typeof Date.prototype.Format !== 'function') {\n    Object.defineProperty(Date.prototype, 'Format', {\n      configurable: true,\n      writable: true,\n      value(format) {\n        return format ? formatDate(this, format) : this;\n      }\n    });\n  }\n  if (typeof Date.prototype.AddTime !== 'function') {\n    Object.defineProperty(Date.prototype, 'AddTime', {\n      configurable: true,\n      writable: true,\n      value(unit, number) {\n        return addTime(this, unit, number);\n      }\n    });\n  }\n  if (typeof Date.prototype.DiffTime !== 'function') {\n    Object.defineProperty(Date.prototype, 'DiffTime', {\n      configurable: true,\n      writable: true,\n      value(unit, time2) {\n        return diffTime(this, unit, time2);\n      }\n    });\n  }\n}\n\nexport function createMicroiV8(options = {}) {\n  // 运行时配置可通过 createMicroiV8(options) 或 client.configure(next) 覆盖。\n  let config = {\n    apiBase: '',\n    webBase: '',\n    fileServer: '',\n    osClient: '',\n    token: '',\n    clientType: getUni() ? 'Mobile' : 'PC',\n    did: '',\n    didKey: 'microi_did',\n    tokenKey: 'microi_token',\n    userKey: 'microi_user',\n    loginUrl: '',\n    formQueryEngineKey: '',\n    timeout: 30000,\n    maxConcurrent: 0,\n    appendOsClientQuery: false,\n    authCodes: DEFAULT_AUTH_CODES,\n    blockedAssetPattern: DEFAULT_BLOCKED_ASSET,\n    translate: (message) => message,\n    requestAdapter: null,\n    onAuthExpired: null,\n    onTokenChanged: null,\n    toast: null,\n    confirm: null,\n    ...options\n  };\n\n  const storage = options.storage || createDefaultStorage();\n  let runQueued = createQueue(config.maxConcurrent);\n  let refreshTokenPromise = null;\n  let tokenMaintenanceTimer = null;\n  let stopBrowserResumeListeners = null;\n\n  // 更新配置后立即刷新并发队列，保证 maxConcurrent 热更新生效。\n  function configure(next = {}) {\n    config = { ...config, ...next };\n    if (Object.prototype.hasOwnProperty.call(next, 'maxConcurrent')) {\n      runQueued = createQueue(config.maxConcurrent);\n    }\n    return client;\n  }\n\n  function tr(message) {\n    try {\n      return config.translate ? config.translate(message) : message;\n    } catch (e) {\n      return message;\n    }\n  }\n\n  function toast(message) {\n    if (!message) return;\n    const text = tr(message);\n    if (typeof config.toast === 'function') return config.toast(text);\n    return defaultToast(text);\n  }\n\n  function confirm(message) {\n    if (typeof config.confirm === 'function') return config.confirm(tr(message));\n    return defaultConfirm(tr(message));\n  }\n\n  function getToken() {\n    return config.token || storage.get(config.tokenKey) || '';\n  }\n\n  function getDid() {\n    if (config.did) return String(config.did);\n    const stored = storage.get(config.didKey);\n    if (stored) return String(stored);\n    const prefix = String(config.clientType || 'Client').replace(/[^a-z0-9_-]/gi, '') || 'Client';\n    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'\n      ? crypto.randomUUID()\n      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;\n    const did = `${prefix}:${random}`;\n    storage.set(config.didKey, did);\n    return did;\n  }\n\n  function setToken(token) {\n    const previousToken = getToken();\n    const nextToken = token || '';\n    config = { ...config, token: nextToken };\n    storage.set(config.tokenKey, nextToken);\n    if (nextToken !== previousToken && typeof config.onTokenChanged === 'function') {\n      try {\n        config.onTokenChanged(nextToken, previousToken, client);\n      } catch (e) {}\n    }\n  }\n\n  function clearToken() {\n    config = { ...config, token: '' };\n    storage.remove(config.tokenKey);\n    storage.remove(config.userKey);\n  }\n\n  function setUser(user) {\n    storage.set(config.userKey, serializeUser(user));\n  }\n\n  function getUser() {\n    return deserializeUser(storage.get(config.userKey));\n  }\n\n  function isAuthExpired(body, statusCode) {\n    if (Number(statusCode) === 401) return true;\n    const code = body && body.Code;\n    return config.authCodes.indexOf(code) >= 0;\n  }\n\n  function readTokenClaims(token = getToken()) {\n    try {\n      const normalized = normalizeBearer(token);\n      const parts = normalized.split('.');\n      if (parts.length < 2) return null;\n      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');\n      if (typeof Buffer !== 'undefined') {\n        return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));\n      }\n      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);\n      const binary = atob(padded);\n      const bytes = Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');\n      return JSON.parse(decodeURIComponent(bytes));\n    } catch (e) {\n      return null;\n    }\n  }\n\n  function shouldRefreshToken(token = getToken()) {\n    const claims = readTokenClaims(token);\n    const expiresAt = Number(claims && claims.exp);\n    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return true;\n    const issuedAt = Number(claims.MicroiTokenIssuedAt || claims.iat);\n    const now = Math.floor(Date.now() / 1000);\n    const lifetime = Number.isFinite(issuedAt) && issuedAt > 0 && expiresAt > issuedAt\n      ? expiresAt - issuedAt\n      : Math.max(0, expiresAt - now);\n    const lead = Math.min(24 * 60 * 60, Math.max(5 * 60, Math.floor(lifetime / 10)));\n    return expiresAt - now <= lead;\n  }\n\n  function isSameToken(left, right) {\n    return normalizeBearer(left) === normalizeBearer(right);\n  }\n\n  function handleReturnedToken(headers, requestToken, authEnabled) {\n    const auth = getHeaderValue(headers, 'authorization') || getHeaderValue(headers, 'token');\n    const token = normalizeBearer(auth);\n    if (!token) return;\n    // 登录等匿名请求允许建立新会话；受保护请求只能续签自己发起时的会话。\n    // 否则登录前的慢响应可能把刚登录得到的新 Token 覆盖回旧 Token。\n    if (!authEnabled || isSameToken(getToken(), requestToken)) setToken(token);\n  }\n\n  function handleAuthExpired(body, requestToken) {\n    // 该响应属于已经被替换的旧会话时，不得清理当前的新登录态。\n    if (!isSameToken(getToken(), requestToken)) return false;\n    clearToken();\n    if (typeof config.onAuthExpired === 'function') {\n      config.onAuthExpired(body, client);\n    }\n    return true;\n  }\n\n  // 所有相对地址默认走 apiBase，必要时自动追加 OsClient。\n  function buildUrl(url) {\n    let fullUrl = /^(https?:|data:|blob:|file:)/i.test(String(url || '')) ? String(url) : joinUrl(config.apiBase, url);\n    if (config.appendOsClientQuery && config.osClient && fullUrl.indexOf('/apiengine/') < 0) {\n      fullUrl = appendQuery(fullUrl, 'OsClient', config.osClient);\n    }\n    return fullUrl;\n  }\n\n  // 普通请求统一携带 osclient、Token 与 Authorization，减少各项目重复拼装。\n  function buildHeaders(options = {}) {\n    const token = options.auth === false ? '' : getToken();\n    const headers = {\n      'Content-Type': 'application/json',\n      ...(options.header || {}),\n      ...(options.headers || {})\n    };\n    if (config.osClient) setSingletonHeader(headers, 'osclient', config.osClient);\n    const did = getDid();\n    if (did) setSingletonHeader(headers, 'did', did);\n    if (token) {\n      setSingletonHeader(headers, 'Token', token);\n      setSingletonHeader(headers, 'Authorization', `Bearer ${token}`);\n    }\n    if (options.apiEngine) headers.apiengine = '1';\n    return headers;\n  }\n\n  function buildUploadHeaders(options = {}) {\n    const headers = buildHeaders(options);\n    Object.keys(headers).forEach((key) => {\n      if (String(key).toLowerCase() === 'content-type') delete headers[key];\n    });\n    return headers;\n  }\n\n  // 请求核心：优先走自定义适配器，其次 uni.request，最后回退 fetch。\n  async function request(options = {}) {\n    const method = String(options.method || 'POST').toUpperCase();\n    let fullUrl = buildUrl(options.url || options.path || '');\n    const authEnabled = options.auth !== false;\n    const requestToken = authEnabled ? getToken() : '';\n    const headers = buildHeaders(options);\n    const data = options.data === undefined ? {} : options.data;\n    const timeout = options.timeout || config.timeout;\n\n    const perform = async () => {\n      let response;\n      if (typeof config.requestAdapter === 'function') {\n        response = await config.requestAdapter({ ...options, url: fullUrl, method, data, header: headers, headers, timeout });\n      } else {\n        const runtimeUni = getUni();\n        if (runtimeUni && typeof runtimeUni.request === 'function') {\n          response = await new Promise((resolve, reject) => {\n            runtimeUni.request({\n              url: fullUrl,\n              method,\n              data,\n              header: headers,\n              timeout,\n              success: resolve,\n              fail: reject\n            });\n          });\n        } else if (typeof fetch === 'function') {\n          if ((method === 'GET' || method === 'HEAD') && data && typeof data === 'object') {\n            fullUrl = appendQueryObject(fullUrl, data);\n          }\n          const timer = createFetchTimeout(timeout);\n          try {\n            const fetchOptions = {\n              method,\n              headers,\n              signal: timer.signal\n            };\n            if (method !== 'GET' && method !== 'HEAD') fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data || {});\n            const res = await fetch(fullUrl, fetchOptions);\n            const text = await res.text();\n            const resultData = parseMaybeJson(text, text);\n            const resultHeaders = {};\n            res.headers.forEach((value, key) => { resultHeaders[key] = value; });\n            response = { statusCode: res.status, data: resultData, header: resultHeaders, headers: resultHeaders };\n          } finally {\n            if (typeof timer.cleanup === 'function') timer.cleanup();\n          }\n        } else {\n          throw new Error('未找到 MicroiV8 请求适配器。');\n        }\n      }\n\n      const statusCode = response.statusCode || response.status || 200;\n      const body = response.data === undefined ? response.body : response.data;\n      const headersReturned = response.header || response.headers || {};\n\n      if (authEnabled && isAuthExpired(body, statusCode)) {\n        const expiredCurrentSession = handleAuthExpired(body, requestToken);\n        // 登录前发出的旧请求可以正常失败，但不能弹过期框、跳登录或清理新 Token。\n        if (!expiredCurrentSession) throw body || new Error('旧登录会话已失效');\n        if (options.silentError !== true) toast((body && body.Msg) || '登录已过期');\n        throw body || new Error('登录已过期');\n      }\n\n      handleReturnedToken(headersReturned, requestToken, authEnabled);\n\n      if (statusCode >= 400) {\n        const error = body || new Error(`请求失败: ${statusCode}`);\n        if (options.silentError !== true) toast((body && body.Msg) || `请求失败: ${statusCode}`);\n        throw error;\n      }\n\n      if (options.checkCode && body && body.Code !== 1) {\n        if (options.silentError !== true) toast(body.Msg || '请求失败');\n        throw body;\n      }\n\n      return body;\n    };\n\n    return runQueued(perform);\n  }\n\n  function get(url, data = {}, options = {}) {\n    return request({ ...options, url, data, method: 'GET' });\n  }\n\n  function post(url, data = {}, options = {}) {\n    return request({ ...options, url, data, method: 'POST' });\n  }\n\n  function postForm(url, data = {}, options = {}) {\n    const body = new URLSearchParams();\n    const formData = config.osClient && data.OsClient === undefined\n      ? { OsClient: config.osClient, ...data }\n      : data;\n    Object.keys(formData || {}).forEach((key) => {\n      const value = formData[key];\n      if (value !== undefined && value !== null) body.set(key, String(value));\n    });\n    return request({\n      ...options,\n      url,\n      data: body.toString(),\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',\n        ...(options.headers || {})\n      }\n    });\n  }\n\n  async function refreshToken() {\n    if (refreshTokenPromise) return refreshTokenPromise;\n    const oldToken = getToken();\n    if (!oldToken) return { Code: 1001, Msg: '请求未携带Token，请重新登录。' };\n\n    refreshTokenPromise = request({\n      url: '/api/SysUser/refreshToken',\n      method: 'POST',\n      auth: false,\n      checkCode: false,\n      silentError: true,\n      headers: {\n        Authorization: `Bearer ${normalizeBearer(oldToken)}`,\n        Token: normalizeBearer(oldToken)\n      },\n      data: {\n        authorization: normalizeBearer(oldToken),\n        OsClient: config.osClient || undefined,\n        _ClientType: config.clientType || undefined\n      }\n    }).then((result) => {\n      if (result && result.Code !== 1 && isAuthExpired(result)) {\n        handleAuthExpired(result, oldToken);\n      }\n      return result;\n    }).finally(() => {\n      refreshTokenPromise = null;\n    });\n    return refreshTokenPromise;\n  }\n\n  async function resumeAuthSession(force = false) {\n    const token = getToken();\n    if (!token) return { Code: 1001, Msg: '请求未携带Token，请重新登录。' };\n    if (!force && !shouldRefreshToken(token)) return { Code: 1, Data: { Refreshed: false } };\n    return refreshToken();\n  }\n\n  function stopTokenMaintenance() {\n    if (tokenMaintenanceTimer) {\n      clearInterval(tokenMaintenanceTimer);\n      tokenMaintenanceTimer = null;\n    }\n    if (typeof stopBrowserResumeListeners === 'function') {\n      stopBrowserResumeListeners();\n      stopBrowserResumeListeners = null;\n    }\n  }\n\n  function startTokenMaintenance(options = {}) {\n    stopTokenMaintenance();\n    const intervalMs = Math.max(60 * 1000, Number(options.intervalMs || 60 * 1000));\n    const maintain = () => { void resumeAuthSession(false); };\n    tokenMaintenanceTimer = setInterval(maintain, intervalMs);\n    if (hasWindow()) {\n      const onResume = () => {\n        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;\n        maintain();\n      };\n      document.addEventListener('visibilitychange', onResume);\n      window.addEventListener('focus', onResume);\n      window.addEventListener('pageshow', onResume);\n      stopBrowserResumeListeners = () => {\n        document.removeEventListener('visibilitychange', onResume);\n        window.removeEventListener('focus', onResume);\n        window.removeEventListener('pageshow', onResume);\n      };\n    }\n    maintain();\n    return stopTokenMaintenance;\n  }\n\n  // 资源地址统一过滤占位图，并兼容 HDFS 私有文件、FileServer 和绝对地址。\n  function assetUrl(value) {\n    const picked = extractUploadPath(value);\n    if (!picked || isBlockedAsset(picked)) return '';\n    if (/^(https?:|data:|blob:|file:)/i.test(picked)) return picked;\n    if (isLocalPackagedAsset(picked)) return picked;\n    if (/^\\/?file\\//i.test(picked)) return joinUrl(config.apiBase, picked);\n    if (/^\\//.test(picked) || /^[a-z0-9_-]+\\//i.test(picked)) return joinUrl(config.fileServer || config.apiBase, picked);\n    return picked;\n  }\n\n  function isBlockedAsset(value) {\n    return config.blockedAssetPattern ? config.blockedAssetPattern.test(String(value || '')) : false;\n  }\n\n  function hasPrivateFileAccessContext(options = {}) {\n    const resourceKind = String(options.resourceKind || options.ResourceKind || 'FormField').trim();\n    const resourceId = String(options.resourceId || options.ResourceId || '').trim();\n    const formEngineKey = String(options.formEngineKey || options.FormEngineKey || '').trim();\n    const formDataId = String(options.formDataId || options.FormDataId || '').trim();\n    const fieldId = String(options.fieldId || options.FieldId || '').trim();\n    const sysMenuId = String(options.sysMenuId || options.SysMenuId || options.menuId || options.MenuId || '').trim();\n    const formFieldReady = Boolean(formEngineKey && formDataId && fieldId && sysMenuId);\n\n    if (resourceKind === 'UserAvatar' || resourceKind === 'MenuImportTemplate' || resourceKind === 'DeptImportTemplate') {\n      return Boolean(resourceId);\n    }\n    if (resourceKind === 'FileManagerObject') return Boolean(resourceId && sysMenuId);\n    if (resourceKind === 'FormFieldDerivedPreview') {\n      return formFieldReady && Boolean(options.originalFilePathName || options.OriginalFilePathName);\n    }\n    return resourceKind === 'FormField' && formFieldReady;\n  }\n\n  async function resolveFileUrl(filePathName, options = {}) {\n    const path = extractUploadPath(filePathName);\n    if (!path || isBlockedAsset(path)) return '';\n    if (/^(https?:|blob:|data:|file:)/i.test(path)) return assetUrl(path);\n    if (isLocalPackagedAsset(path) || options.private === false || hasPublicUploadFlag(filePathName) || isKnownPublicUploadPath(path)) {\n      return assetUrl(path);\n    }\n    // 私有对象没有权威资源上下文时直接失败关闭，禁止以裸路径换取签名。\n    if (!hasPrivateFileAccessContext(options)) return '';\n\n    async function requestPrivateFileUrl() {\n      try {\n        const body = await apiEngineRun('platform-private-file-url', {\n          OsClient: config.osClient,\n          FilePathName: path,\n          FormEngineKey: options.formEngineKey || options.FormEngineKey,\n          FormDataId: options.formDataId || options.FormDataId,\n          FieldId: options.fieldId || options.FieldId,\n          SysMenuId: options.sysMenuId || options.SysMenuId || options.menuId || options.MenuId,\n          ResourceKind: options.resourceKind || options.ResourceKind,\n          ResourceId: options.resourceId || options.ResourceId,\n          OriginalFilePathName: options.originalFilePathName || options.OriginalFilePathName,\n          _TableChildAuth: options.tableChildAuth || options._TableChildAuth,\n          HDFS: options.hdfs || options.HDFS\n        }, {\n          checkCode: false,\n          silentError: true\n        });\n        if (body && body.Code === 1 && body.Data) return normalizeFileUrlData(body.Data, assetUrl, path);\n      } catch (e) {}\n      return '';\n    }\n\n    return (await requestPrivateFileUrl()) || '';\n  }\n\n  // 文件上传同时支持 uni.uploadFile 与浏览器 fetch/FormData。\n  async function uploadFile(filePath, options = {}) {\n    const runtimeUni = getUni();\n    const action = options.action || (options.anonymous ? 'UniappUploadAnonymous' : 'UniappUpload');\n    const rawFormData = options.formData || {};\n    const uploadData = {\n      ...rawFormData,\n      OsClient: config.osClient,\n      Limit: options.limit === false ? 'false' : 'true',\n      Preview: options.preview === false ? 'false' : 'true',\n      Multiple: options.multiple ? 'true' : 'false'\n    };\n    uploadData.Path = normalizeClientUploadPath(options.path || uploadData.Path || uploadData.path || 'upload');\n    delete uploadData.path;\n\n    let body;\n    const fetchSource = pickUploadFileSource(filePath, options);\n    const canFetchUpload = typeof fetch === 'function' && typeof FormData !== 'undefined' &&\n      (!!pickUploadFileLike(options.file) || !!pickUploadFileLike(filePath) || /^(blob:|data:)/i.test(fetchSource));\n    const uploadByFetch = async () => {\n      const picked = await resolveFetchUploadFile(filePath, options);\n      const file = picked.file;\n      if (!file) throw new Error('未提供上传文件。');\n      const formData = new FormData();\n      Object.keys(uploadData).forEach((key) => formData.append(key, uploadData[key]));\n      formData.append(options.name || 'file', file, picked.name || (file && file.name) || 'file');\n      const res = await fetch(buildUrl(options.url || `/api/HDFS/${action}`), {\n        method: 'POST',\n        headers: buildUploadHeaders({ ...options, headers: options.headers || {} }),\n        body: formData\n      });\n      handleReturnedToken(res.headers);\n      const text = await res.text();\n      return parseMaybeJson(text, text);\n    };\n\n    if (options.preferFetch === true && canFetchUpload) {\n      try {\n        body = await uploadByFetch();\n      } catch (e) {\n        if (!(runtimeUni && typeof runtimeUni.uploadFile === 'function')) throw e;\n      }\n    }\n    if (!body) {\n      if (runtimeUni && typeof runtimeUni.uploadFile === 'function') {\n        try {\n          body = await new Promise((resolve, reject) => {\n            runtimeUni.uploadFile({\n              url: buildUrl(options.url || `/api/HDFS/${action}`),\n              filePath,\n              name: options.name || 'file',\n              header: buildUploadHeaders({ ...options, headers: options.headers || {} }),\n              formData: uploadData,\n              success: (res) => {\n                handleReturnedToken(res.header || res.headers || {});\n                resolve(parseMaybeJson(res.data, res.data));\n              },\n              fail: reject\n            });\n          });\n        } catch (e) {\n          if (!canFetchUpload) throw e;\n          body = await uploadByFetch();\n        }\n      } else if (canFetchUpload) {\n        body = await uploadByFetch();\n      } else {\n        throw new Error('未找到 MicroiV8 上传适配器。');\n      }\n    }\n\n    if (!body || body.Code !== 1) {\n      if (options.silentError !== true) toast((body && body.Msg) || '上传失败');\n      throw body || new Error('上传失败');\n    }\n\n    const data = normalizeUploadData(body);\n    if (!data.Path) {\n      const error = { Code: 0, Msg: '上传返回文件路径为空' };\n      if (options.silentError !== true) toast(error.Msg);\n      throw error;\n    }\n    if (!data.Url && options.resolveUrl !== false) data.Url = await resolveFileUrl(data.Path);\n    return { ...body, Data: data };\n  }\n\n  function apiEngineRun(key, data = {}, options = {}) {\n    const body = { ...(data || {}) };\n    if (config.osClient && body.OsClient === undefined) body.OsClient = config.osClient;\n    return post(`/apiengine/${key}`, body, { apiEngine: true, checkCode: options.checkCode !== false, ...options });\n  }\n\n  function apiEngineRunLegacy(key, data = {}, options = {}) {\n    const body = { ApiEngineKey: key, OsClient: config.osClient, ...(data || {}) };\n    return post('/api/ApiEngine/Run', body, { checkCode: false, ...options });\n  }\n\n  function formEngineRequest(action, table, data = {}, options = {}) {\n    const actionKey = String(action || '').toLowerCase();\n    const readActions = ['gettabledata', 'getformdata', 'gettabledatatree'];\n    const isRead = readActions.indexOf(actionKey) >= 0;\n    const body = { OsClient: config.osClient, FormEngineKey: table, ...(data || {}) };\n\n    if (isRead && config.formQueryEngineKey && options.readUseQueryEngine !== false) {\n      return apiEngineRun(config.formQueryEngineKey, { Action: actionKey, ...body }, { checkCode: false, ...options });\n    }\n\n    return post(`/api/formengine/${actionKey}-${table}`, body, { checkCode: false, ...options });\n  }\n\n  function formEngineAnonymous(action, table, data = {}, options = {}) {\n    const name = String(action || '');\n    const body = { FormEngineKey: table, OsClient: config.osClient, ...(data || {}) };\n    return post(`/api/FormEngine/${name}`, body, { auth: false, checkCode: false, ...options });\n  }\n\n  function withCallback(promise, callback) {\n    if (typeof callback === 'function') {\n      promise.then((result) => callback(result)).catch((error) => callback(error));\n    }\n    return promise;\n  }\n\n  // 兼容旧版 FormEngine 调用：既支持 (table, row, callback)，也支持完整参数对象。\n  function normalizeLegacyFormArgs(first, second, third, rowModelMode = false) {\n    let data = {};\n    let callback = third;\n    if (typeof first === 'string') {\n      const source = second && typeof second === 'object' ? second : {};\n      data.FormEngineKey = first;\n      if (rowModelMode) {\n        data._RowModel = {};\n        Object.keys(source).forEach((key) => {\n          if (key === 'Id') {\n            // zhy：新增接口的外层 Id 用于请求寻址，行模型中的 Id 才会进入表单 V8 上下文。\n            data.Id = source[key];\n            data._RowModel.Id = source[key];\n          } else data._RowModel[key] = source[key];\n        });\n      } else {\n        data = { ...data, ...source };\n      }\n      if (typeof second === 'function') callback = second;\n    } else {\n      data = first && typeof first === 'object' ? { ...first } : {};\n      callback = typeof second === 'function' ? second : third;\n    }\n    if (config.osClient && data.OsClient === undefined) data.OsClient = config.osClient;\n    return { data, callback };\n  }\n\n  // zhy：表单写入的权限、租户和执行控制参数必须保留在请求外层，不能混入业务表单字段。\n  const formWriteOuterKeys = new Set([\n    'FormEngineKey', 'OsClient', 'Id', '_SysMenuId', '_TableChildAuth',\n    '_InvokeType', '_NotSaveField', '_NoLineForAdd', '_ForceUpt', '_DataLog', '_Lang'\n  ]);\n\n  // zhy：同时兼容新版小写请求选项与旧 SDK 的首字母大写选项，避免切换标准接口后丢失请求头。\n  function normalizeFormWriteOptions(options = {}) {\n    return {\n      ...options,\n      Header: options.Header || options.Headers || options.header || options.headers || {},\n      Auth: options.Auth !== undefined ? options.Auth : options.auth,\n      Timeout: options.Timeout || options.timeout,\n      SilentError: options.SilentError === true || options.silentError === true\n    };\n  }\n\n  // zhy：字符串更新重载先读取服务端最新完整记录，再合并局部修改，满足客户端表单事件的完整数据契约。\n  function formEngineUpdate(first, second, third) {\n    if (typeof first !== 'string') {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.UptFormData, data), callback);\n    }\n\n    const source = second && typeof second === 'object' ? { ...second } : {};\n    const callback = typeof third === 'function' ? third : null;\n    const options = normalizeFormWriteOptions(third && typeof third === 'object' ? third : {});\n    const rowId = source.Id;\n    const outer = { FormEngineKey: first, Id: rowId };\n    const patch = {};\n\n    // zhy：拆分外层控制参数与业务字段，并兼容调用方显式传入 _RowModel/_FormData。\n    Object.keys(source).forEach((key) => {\n      if (key === '_FormData' || key === '_RowModel') return;\n      if (formWriteOuterKeys.has(key)) outer[key] = source[key];\n      else patch[key] = source[key];\n    });\n    Object.assign(patch, source._RowModel || {}, source._FormData || {});\n    if (config.osClient && outer.OsClient === undefined) outer.OsClient = config.osClient;\n\n    const promise = (async () => {\n      if (rowId === undefined || rowId === null || rowId === '') {\n        return { Code: 0, Msg: 'UptFormData requires Id.' };\n      }\n      // zhy：携带相同菜单和子表授权上下文读取最新记录，防止绕过行级权限或使用页面旧快照覆盖新数据。\n      const readParam = {\n        FormEngineKey: first,\n        Id: rowId,\n        ...(outer._SysMenuId ? { _SysMenuId: outer._SysMenuId } : {}),\n        ...(outer._TableChildAuth ? { _TableChildAuth: outer._TableChildAuth } : {})\n      };\n      const current = await legacyPost(legacyApi.GetFormData, readParam, null, options);\n      if (!current || Number(current.Code) !== 1 || !current.Data) return current;\n      // zhy：以服务端最新记录为基准合并 patch，并按 PC 平台一致的完整 _FormData 契约提交。\n      const formData = { ...current.Data, ...patch, Id: rowId };\n      return legacyPost(legacyApi.UptFormData, { ...outer, _FormData: formData }, null, options);\n    })();\n    return withCallback(promise, callback);\n  }\n\n  async function legacyPost(url, data = {}, callback, option = {}) {\n    const body = await request({\n      url,\n      data: data || {},\n      method: option.Method || 'POST',\n      headers: option.Header || option.Headers || {},\n      apiEngine: !!option.IsApiEngine,\n      auth: option.Auth !== false,\n      timeout: option.Timeout,\n      checkCode: false,\n      silentError: option.SilentError === true\n    });\n    const result = body && typeof body === 'object' ? { ...body, Headers: body.Headers || {} } : body;\n    if (typeof callback === 'function') callback(result, result && result.Headers);\n    return result;\n  }\n\n  async function legacyGet(url, data = {}, callback, option = {}) {\n    const body = await request({\n      url,\n      data: data || {},\n      method: 'GET',\n      headers: option.Header || option.Headers || {},\n      apiEngine: !!option.IsApiEngine,\n      auth: option.Auth !== false,\n      timeout: option.Timeout,\n      responseType: option.ResponseType,\n      checkCode: false,\n      silentError: option.SilentError === true\n    });\n    const result = option.ResponseType === 'arraybuffer'\n      ? { Code: 1, Data: body, Headers: {} }\n      : (body && typeof body === 'object' ? { ...body, Headers: body.Headers || {} } : body);\n    if (typeof callback === 'function') callback(result, result && result.Headers);\n    return result;\n  }\n\n  async function legacyRawRequest(param = {}) {\n    const method = param.Method || param.method || 'POST';\n    const url = param.Url || param.url || param.path || '';\n    const data = param.Data || param.Param || param.data || {};\n    const body = await request({\n      url,\n      data,\n      method,\n      headers: param.Header || param.Headers || param.headers || {},\n      apiEngine: !!param.IsApiEngine,\n      auth: param.Auth !== false,\n      timeout: param.Timeout,\n      responseType: param.ResponseType,\n      checkCode: false,\n      silentError: param.SilentError === true\n    });\n    return { data: body, headers: body && body.Headers ? body.Headers : {} };\n  }\n\n  function legacyOpen(url) {\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.navigateTo === 'function') {\n      runtimeUni.navigateTo({ url });\n      return;\n    }\n    if (hasWindow()) window.location.href = url;\n  }\n\n  function legacyNavigateTo(url, isVerify) {\n    if (isVerify && !legacyIsLogin()) {\n      if (config.loginUrl) legacyOpen(config.loginUrl);\n      else toast('请登录');\n      return;\n    }\n    legacyOpen(url);\n  }\n\n  function legacyGetCurrentUser(refresh, callback) {\n    if (refresh) {\n      legacyPost('/apiengine/platform-current-user', {}, (result) => {\n        if (result && result.Code) legacySetCurrentUser(result.Data || {});\n        if (typeof callback === 'function') callback(result);\n      });\n    }\n    return getUser() || deserializeUser(storage.get('CurrentUser')) || {};\n  }\n\n  function legacySetCurrentUser(user) {\n    setUser(user || {});\n    storage.set('CurrentUser', serializeUser(user || {}));\n  }\n\n  function legacyGetToken() {\n    return getToken() || storage.get('Token') || storage.get('authorization') || '';\n  }\n\n  function legacySetToken(token) {\n    setToken(token || '');\n    storage.set('Token', token || '');\n    storage.set('authorization', token || '');\n    storage.set('TokenExpires', token ? formatDate(addTime(new Date(), 'm', 15), 'yyyy-MM-dd HH:mm:ss') : '');\n    if (!token) legacySetCurrentUser({});\n  }\n\n  function legacyIsLogin() {\n    const user = legacyGetCurrentUser();\n    return !!(legacyGetToken() && user && user.Id);\n  }\n\n  function legacyGetUrlQuery(property, pageInstance) {\n    let query = null;\n    if (pageInstance) {\n      query = (pageInstance.$mp && pageInstance.$mp.query) ||\n        (pageInstance.$scope && pageInstance.$scope.options) ||\n        (pageInstance.$page && pageInstance.$page.options) ||\n        (pageInstance.$options && pageInstance.$options.pageQuery) ||\n        null;\n    }\n    if (!query && hasWindow()) {\n      query = {};\n      const params = new URLSearchParams(window.location.search || '');\n      params.forEach((value, key) => { query[key] = value; });\n    }\n    return property ? (query && query[property]) : query;\n  }\n\n  function legacyGetStrLength(value) {\n    const text = String(value || '');\n    const chinese = text.match(/[\\u4e00-\\u9fa5\\u3000-\\u303f\\uff00-\\uffef]/g);\n    return (chinese ? chinese.length * 2 : 0) + text.length - (chinese ? chinese.length : 0);\n  }\n\n  function legacyTips(text, isSuccess = true, timeOrOption = {}) {\n    const option = typeof timeOrOption === 'object' ? timeOrOption : { Time: timeOrOption };\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.showToast === 'function') {\n      runtimeUni.showToast({\n        title: String(text || ''),\n        icon: option.Icon || (isSuccess === false ? 'none' : 'success'),\n        duration: option.Time || (isSuccess === false ? 2000 : 1000)\n      });\n      return;\n    }\n    toast(text);\n  }\n\n  function legacyConfirmTips(content, callback, option = {}) {\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.showModal === 'function') {\n      runtimeUni.showModal({\n        title: option.Title || '提示',\n        content: String(content || ''),\n        showCancel: option.ShowCancel === false ? false : true,\n        confirmColor: option.OKColor || '#5677fc',\n        confirmText: option.OKText || '确定',\n        success(res) {\n          if (res.confirm && typeof callback === 'function') callback(res);\n          if (!res.confirm && typeof option.CancelCallback === 'function') option.CancelCallback(res);\n        }\n      });\n      return;\n    }\n    confirm(content).then((ok) => {\n      if (ok && typeof callback === 'function') callback();\n      if (!ok && typeof option.CancelCallback === 'function') option.CancelCallback();\n    });\n  }\n\n  function legacyLoading(title, mask = true) {\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.showLoading === 'function') {\n      runtimeUni.showLoading({ title: title || '请稍候...', mask });\n    }\n  }\n\n  function legacyHideLoading() {\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.hideLoading === 'function') runtimeUni.hideLoading();\n  }\n\n  async function legacyUpload(param = {}, callback) {\n    if (!param.File && !param.file && !param.filePath) {\n      const error = { Code: 0, Msg: '前端参数错误！' };\n      if (typeof callback === 'function') callback(error);\n      return error;\n    }\n    try {\n      legacyLoading('上传中...');\n      const result = await uploadFile(param.File || param.filePath || param.file, {\n        file: param.FileObject || param.fileObject || param.file,\n        fileName: param.FileName || param.fileName,\n        path: param.Path || param.path || 'upload',\n        limit: param.Limit,\n        preview: param.Preview,\n        anonymous: !!param._Anonymous,\n        name: param.Name || param.name || 'file',\n        formData: param\n      });\n      if (typeof callback === 'function') callback(result);\n      return result;\n    } catch (error) {\n      const result = error && error.Code !== undefined ? error : { Code: 0, Data: error, Msg: error && error.message ? error.message : '上传失败' };\n      if (typeof callback === 'function') callback(result);\n      return result;\n    } finally {\n      legacyHideLoading();\n    }\n  }\n\n  function base64ToBlob(dataURI) {\n    const byteString = atob(String(dataURI).split(',')[1] || '');\n    const mimeString = String(dataURI).split(',')[0].split(':')[1].split(';')[0];\n    const buffer = new ArrayBuffer(byteString.length);\n    const view = new Uint8Array(buffer);\n    for (let i = 0; i < byteString.length; i += 1) view[i] = byteString.charCodeAt(i);\n    return new Blob([buffer], { type: mimeString });\n  }\n\n  function base64ToFile(dataurl, filename = 'file') {\n    const blob = base64ToBlob(dataurl);\n    if (typeof File !== 'undefined') return new File([blob], filename, { type: blob.type });\n    blob.name = filename;\n    return blob;\n  }\n\n  function legacyDownload(url, option = {}, callback) {\n    const runtimeUni = getUni();\n    if (runtimeUni && typeof runtimeUni.downloadFile === 'function') {\n      legacyLoading('下载中...');\n      return new Promise((resolve) => {\n        runtimeUni.downloadFile({\n          url,\n          ...(option || {}),\n          success(res) {\n            const result = { Code: res.statusCode === 200 ? 1 : 0, Data: res, Msg: res.errMsg || '' };\n            if (typeof callback === 'function') callback(result);\n            resolve(result);\n          },\n          fail(err) {\n            const result = { Code: 0, Data: err, Msg: err.errMsg || '下载失败' };\n            if (typeof callback === 'function') callback(result);\n            resolve(result);\n          },\n          complete() {\n            legacyHideLoading();\n          }\n        });\n      });\n    }\n    return legacyGet(url, {}, callback, option);\n  }\n\n  function install(app, options = {}) {\n    if (Object.keys(options).length) configure(options);\n    if (!app || !app.config) return client;\n    app.config.globalProperties.$V8 = client;\n    app.config.globalProperties.$Microi = client;\n    app.config.globalProperties.V8 = client;\n    if (typeof app.provide === 'function') app.provide('MicroiV8', client);\n    return client;\n  }\n\n  // 现代接口：新项目优先使用这些小写方法和命名空间。\n  const client = {\n    get config() {\n      return config;\n    },\n    storage,\n    configure,\n    install,\n    request,\n    get,\n    post,\n    postForm,\n    toast,\n    confirm,\n    getToken,\n    setToken,\n    clearToken,\n    removeToken: clearToken,\n    getDid,\n    readTokenClaims,\n    shouldRefreshToken,\n    refreshToken,\n    resumeAuthSession,\n    startTokenMaintenance,\n    stopTokenMaintenance,\n    getUser,\n    setUser,\n    setCurrentUser: setUser,\n    getCurrentUser: getUser,\n    assetUrl,\n    sanitizeAssetUrl: assetUrl,\n    resolveAssetUrl: assetUrl,\n    resolveAvatarUrl: resolveFileUrl,\n    resolveFileUrl,\n    isBlockedAsset,\n    extractUploadPath,\n    normalizeUploadValue,\n    uploadFile,\n    getSafeArea,\n    formatDate,\n    toNumber,\n    maskPhone,\n    formatCompactNumber,\n    ApiEngine: {\n      Run: apiEngineRun,\n      RunLegacy: apiEngineRunLegacy\n    },\n    FormEngine: {\n      Request: formEngineRequest,\n      GetTableData: (table, data, options) => formEngineRequest('gettabledata', table, data, options),\n      GetFormData: (table, data, options) => formEngineRequest('getformdata', table, data, options),\n      GetTableDataTree: (table, data, options) => formEngineRequest('gettabledatatree', table, data, options),\n      AddFormData: (table, data, options) => formEngineRequest('addformdata', table, data, options),\n      UptFormData: (table, data, options) => formEngineRequest('uptformdata', table, data, options),\n      DelFormData: (table, data, options) => formEngineRequest('delformdata', table, data, options),\n      GetTableDataAnonymous: (table, data, options) => formEngineAnonymous('GetTableDataAnonymous', table, data, options),\n      GetFormDataAnonymous: (table, data, options) => formEngineAnonymous('GetFormDataAnonymous', table, data, options),\n      GetTableDataTreeAnonymous: (table, data, options) => formEngineAnonymous('GetTableDataTreeAnonymous', table, data, options)\n    }\n  };\n\n  // 旧版前端 V8 依赖的后端接口路径，保留原名称以减少迁移成本。\n  const legacyApi = {\n    MicroiInit: '/apiengine/microi-init',\n    GetSysConfig: '/apiengine/platform-sys-config',\n    Login: '/api/SysUser/login',\n    AddFormData: '/api/FormEngine/addFormData',\n    AddFormDataBatch: '/api/FormEngine/addFormDataBatch',\n    DelFormData: '/api/FormEngine/delFormData',\n    DelFormDataBatch: '/api/FormEngine/delFormDataBatch',\n    DelFormDataByWhere: '/api/FormEngine/delFormDataByWhere',\n    UptFormData: '/api/FormEngine/uptFormData',\n    UptFormDataBatch: '/api/FormEngine/uptFormDataBatch',\n    UptFormDataByWhere: '/api/FormEngine/uptFormDataByWhere',\n    GetFormData: '/api/FormEngine/getFormData',\n    GetFormDataAnonymous: '/api/FormEngine/getFormDataAnonymous',\n    GetTableData: '/api/FormEngine/getTableData',\n    GetTableDataAnonymous: '/api/FormEngine/GetTableDataAnonymous',\n    GetTableDataTree: '/api/FormEngine/getTableDataTree',\n    GetTableDataTreeAnonymous: '/api/FormEngine/getTableDataTreeAnonymous',\n    ApiEngineRun: '/api/ApiEngine/run',\n    ModuleEngineRun: '/apiengine/platform-module-data',\n    RefreshToken: '/api/SysUser/refreshToken',\n    RefreshLoginUser: '/api/SysUser/refreshLoginUser',\n    Upload: '/api/HDFS/Upload',\n    UploadAnonymous: '/api/HDFS/uploadAnonymous',\n    UniappUpload: '/api/HDFS/UniappUpload',\n    UniappUploadAnonymous: '/api/HDFS/uniappUploadAnonymous',\n    GetCurrentUser: '/apiengine/platform-current-user',\n    GetDateTimeNow: '/api/os/getDateTimeNow',\n    AddSysLog: '/apiengine/platform-client-log',\n    GetOsClientByDomain: '/apiengine/platform-os-client-by-domain',\n    ApiEngine: {}\n  };\n\n  // 旧版接口：尽量保持历史项目里的调用名、字段名和回调形态。\n  Object.assign(client, {\n    Store: null,\n    IDE: getUni() ? 'UniApp' : 'PCVue3',\n    AppLogo: '',\n    AppKey: '',\n    H5Url: config.webBase || '',\n    DateTimeNow: new Date(),\n    ClientType: getUni() ? 'H5' : 'Web',\n    ClientSystem: '',\n    PageUrlLogin: config.loginUrl || '',\n    PageSizes: [10, 20, 50, 100],\n    SysConfig: {},\n    SafeArea: getSafeArea(),\n    Api: legacyApi,\n    Extend: {\n      Open: legacyOpen,\n      DateTimeFormat: formatDate,\n      DateDiff: diffTime,\n      Add0(value, length) {\n        return String(value || '').padStart(Number(length || 0), '0');\n      }\n    },\n    Window: {},\n    Form: {},\n    IsNull(value) {\n      return value === null || value === undefined || value === '' || value === 'undefined' || value === 'null';\n    },\n    IsNotNull(value) {\n      return !client.IsNull(value);\n    },\n    FormSet(fieldName, value) {\n      client.Form[fieldName] = value;\n    },\n    Run(v8Code) {\n      return Function('V8', `\"use strict\"; return (async function(){${v8Code || ''}\\n}).call(V8);`)(client);\n    },\n    Open: legacyOpen,\n    GetFileServerUrl: assetUrl,\n    GetStorageSync: storage.get,\n    SetStorageSync: storage.set,\n    GetOsClientByDomain: async function getOsClientByDomain(getCache) {\n      const cached = getCache ? storage.get('OsClient') : '';\n      if (cached) {\n        configure({ osClient: cached });\n        return { Code: 1, Data: { OsClient: cached } };\n      }\n      const domain = hasWindow() ? window.location.host.toLowerCase() : '';\n      const result = await legacyPost(legacyApi.GetOsClientByDomain, { Domain: domain }, null, { SilentError: true });\n      if (result && result.Code === 1 && result.Data && result.Data.OsClient) {\n        configure({ osClient: result.Data.OsClient });\n        storage.set('OsClient', result.Data.OsClient);\n      }\n      return result;\n    },\n    GetSysConfig: async function getSysConfig(refresh) {\n      if (!refresh) {\n        const cached = storage.get('SysConfig');\n        if (cached) return parseMaybeJson(cached, {});\n      }\n      const result = await legacyPost(legacyApi.GetSysConfig, {\n        OsClient: config.osClient,\n        _SearchEqual: { IsEnable: 1 }\n      }, null, { SilentError: true });\n      if (result && result.Code === 1) {\n        const model = result.Data || {};\n        client.SysConfig = model;\n        if (model.FileServer) configure({ fileServer: model.FileServer });\n        if (model.H5Url) client.H5Url = model.H5Url;\n        if (model.AppLogo) client.AppLogo = model.AppLogo;\n        storage.set('SysConfig', JSON.stringify(model));\n        return model;\n      }\n      return null;\n    },\n    GetSysConfigSync() {\n      return client.SysConfig && Object.keys(client.SysConfig).length\n        ? client.SysConfig\n        : parseMaybeJson(storage.get('SysConfig'), {});\n    },\n    SetSysConfig(sysConfig) {\n      const model = typeof sysConfig === 'string' ? parseMaybeJson(sysConfig, {}) : (sysConfig || {});\n      client.SysConfig = model;\n      storage.set('SysConfig', JSON.stringify(model));\n    },\n    InitDateTimeTimer: null,\n    InitDateTimeNow() {\n      return legacyPost(legacyApi.GetDateTimeNow, {}, (result) => {\n        if (result && result.Code) {\n          client.DateTimeNow = new Date(result.Data);\n          if (client.InitDateTimeTimer) clearInterval(client.InitDateTimeTimer);\n          client.InitDateTimeTimer = setInterval(() => {\n            client.DateTimeNow = addTime(client.DateTimeNow, 's', 1);\n          }, 1000);\n        }\n      });\n    },\n    RefreshLoginUser: async function refreshLoginUser() {\n      const result = await legacyPost(legacyApi.RefreshLoginUser, {});\n      if (result && result.Code) legacySetCurrentUser(result.Data || {});\n      return result;\n    },\n    RefreshToken: async function refreshToken(callback) {\n      const token = legacyGetToken();\n      if (!token) return { Code: 0, Msg: 'Token 为空。' };\n      const result = await client.refreshToken();\n      if (result && result.Code) legacySetCurrentUser(result.Data || {});\n      if (typeof callback === 'function') callback(result);\n      return result;\n    },\n    ArrayBufferToBase64(arrayBuffer) {\n      const bytes = new Uint8Array(arrayBuffer);\n      let binary = '';\n      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });\n      if (typeof btoa === 'function') return btoa(binary);\n      return binary;\n    },\n    GetCurrentUser: legacyGetCurrentUser,\n    SetCurrentUser: legacySetCurrentUser,\n    GetToken: legacyGetToken,\n    SetToken: legacySetToken,\n    Login(param) {\n      const loginParam = { ...(param || {}) };\n      if (!loginParam._ClientType) loginParam._ClientType = config.clientType || (getUni() ? 'Mobile' : 'PC');\n      return legacyPost(legacyApi.Login, loginParam, (result) => {\n        if (result && result.Code) legacySetCurrentUser(result.Data || {});\n      }, { DataType: 'form' });\n    },\n    Logout() {\n      legacySetToken('');\n    },\n    Tips: legacyTips,\n    Msg: legacyTips,\n    GetStrLength: legacyGetStrLength,\n    ConfirmTips: legacyConfirmTips,\n    IsAndroid() {\n      return String(getSafeArea().platform || '').toLowerCase() === 'android';\n    },\n    IsPhoneX() {\n      const area = getSafeArea();\n      return area.bottom > 0;\n    },\n    Loading: legacyLoading,\n    ShowLoading: legacyLoading,\n    HideLoading: legacyHideLoading,\n    Post: legacyPost,\n    PostAsync: legacyPost,\n    Get: legacyGet,\n    PostAll(allParams = [], callback) {\n      return withCallback(Promise.all(allParams.map((item) => legacyPost(item.Url || item.url, item.Data || item.Param || item.data || {}, null, item))), callback);\n    },\n    request(options = {}) {\n      if (options && (options.Url || options.Data || options.Method || options.Param)) return legacyRawRequest(options);\n      return request(options);\n    },\n    GetClientType() {\n      return getUni() ? 'H5' : 'Web';\n    },\n    GetClientSystem() {\n      return getSafeArea().platform || '';\n    },\n    AddSysLog(param) {\n      return legacyPost(legacyApi.AddSysLog, param || {}, null, { DataType: 'form', SilentError: true });\n    },\n    CheckResult(result) {\n      if (!result || typeof result !== 'object') return false;\n      if (result.Code !== 1) {\n        legacyTips(result.Msg || '操作失败', false, 3000);\n        return false;\n      }\n      return true;\n    },\n    IsLogin: legacyIsLogin,\n    NavigateTo: legacyNavigateTo,\n    RouterPush: legacyNavigateTo,\n    Upload: legacyUpload,\n    UploadAnonymous(param, callback) {\n      return legacyUpload({ ...(param || {}), _Anonymous: true }, callback);\n    },\n    Download: legacyDownload,\n    DownloadFile: legacyDownload,\n    ImgBase64ToFile: base64ToFile,\n    ImgBase63ToBlob: base64ToBlob,\n    HidePhone: maskPhone,\n    ImgExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],\n    IsImg(link = '') {\n      const clean = String(link || '').split('?')[0].toLowerCase();\n      return client.ImgExtensions.some((ext) => clean.endsWith(ext));\n    },\n    NavigateToMiniProgram(appId, path, param, callback) {\n      const runtimeUni = getUni();\n      if (runtimeUni && typeof runtimeUni.navigateToMiniProgram === 'function') {\n        runtimeUni.navigateToMiniProgram({\n          appId,\n          path,\n          extraData: param,\n          success: (res) => callback && callback({ Code: 1, Data: res }),\n          fail: (err) => callback && callback({ Code: 0, Data: err, Msg: err.errMsg })\n        });\n      }\n    },\n    GetUrlQuery: legacyGetUrlQuery,\n    GetCountStr(count) {\n      return formatCompactNumber(count, Number(count) < 100000 ? 2 : 1);\n    }\n  });\n\n  // 这些属性在旧项目中常被直接赋值，因此保留取值器和赋值器同步到 config。\n  Object.defineProperties(client, {\n    ApiBase: {\n      get: () => config.apiBase,\n      set: (value) => configure({ apiBase: value })\n    },\n    OsClient: {\n      get: () => config.osClient,\n      set: (value) => configure({ osClient: value })\n    },\n    FileServer: {\n      get: () => config.fileServer,\n      set: (value) => configure({ fileServer: value })\n    }\n  });\n\n  // 新旧两套接口引擎调用方式并存：字符串 key 走新路由，对象参数兼容旧路由。\n  Object.assign(client.ApiEngine, {\n    Run(urlOrKey, dataOrCallback, callback) {\n      if (typeof urlOrKey === 'string') {\n        const data = dataOrCallback && typeof dataOrCallback === 'object' ? dataOrCallback : {};\n        const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;\n        return withCallback(apiEngineRun(urlOrKey, data, { checkCode: false }), cb);\n      }\n      const param = urlOrKey || {};\n      const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;\n      const key = param.ApiEngineKey || param.apiEngineKey;\n      return withCallback(key ? apiEngineRun(key, param, { checkCode: false }) : apiEngineRunLegacy('', param, { checkCode: false }), cb);\n    },\n    RunDirect: apiEngineRun,\n    RunLegacy: apiEngineRunLegacy\n  });\n\n  // 模块引擎和表单引擎沿用旧版命名，内部统一走 legacyPost。\n  client.ModuleEngine = {\n    Run(moduleKeyOrParam, dataOrCallback, callback) {\n      const data = typeof moduleKeyOrParam === 'string'\n        ? { ModuleEngineKey: moduleKeyOrParam, ...(dataOrCallback || {}) }\n        : (moduleKeyOrParam || {});\n      const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;\n      return withCallback(legacyPost(legacyApi.ModuleEngineRun, { Action: 'GetTableData', ...data }), cb);\n    }\n  };\n\n  Object.assign(client.FormEngine, {\n    AddFormData(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third, true);\n      return withCallback(legacyPost(legacyApi.AddFormData, data), callback);\n    },\n    AddFormDataBatch(param, callback) {\n      return withCallback(legacyPost(legacyApi.AddFormDataBatch, param || {}), callback);\n    },\n    AddTableData(param, callback) {\n      return withCallback(legacyPost(legacyApi.AddFormDataBatch, param || {}), callback);\n    },\n    DelFormData(param, callback) {\n      return withCallback(legacyPost(legacyApi.DelFormData, param || {}), callback);\n    },\n    DelFormDataBatch(param, callback) {\n      return withCallback(legacyPost(legacyApi.DelFormDataBatch, param || {}), callback);\n    },\n    DelFormDataByWhere(param, callback) {\n      return withCallback(legacyPost(legacyApi.DelFormDataByWhere, param || {}), callback);\n    },\n    UptFormData(first, second, third) {\n      // zhy：统一委托公共更新适配器，保证 UniApp、H5 和其它独立前端使用同一写入契约。\n      return formEngineUpdate(first, second, third);\n    },\n    UptFormDataByWhere(param, callback) {\n      return withCallback(legacyPost(legacyApi.UptFormDataByWhere, param || {}), callback);\n    },\n    UptFormDataBatch(param, callback) {\n      return withCallback(legacyPost(legacyApi.UptFormDataBatch, param || {}), callback);\n    },\n    UptTableData(param, callback) {\n      return withCallback(legacyPost(legacyApi.UptFormDataBatch, param || {}), callback);\n    },\n    GetFormData(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(`${legacyApi.GetFormData}-${data.FormEngineKey || ''}`, data), callback);\n    },\n    GetFormDataAnonymous(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.GetFormDataAnonymous, data, null, { Auth: false }), callback);\n    },\n    GetTableData(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.GetTableData, data), callback);\n    },\n    GetTableDataAnonymous(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.GetTableDataAnonymous, data, null, { Auth: false }), callback);\n    },\n    GetTableDataTree(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.GetTableDataTree, data), callback);\n    },\n    GetTableDataTreeAnonymous(first, second, third) {\n      const { data, callback } = normalizeLegacyFormArgs(first, second, third);\n      return withCallback(legacyPost(legacyApi.GetTableDataTreeAnonymous, data, null, { Auth: false }), callback);\n    }\n  });\n\n  installDatePrototypeCompat();\n  return client;\n}\n\nexport const V8 = createMicroiV8();\nexport const MicroiV8 = V8;\nexport const installMicroiV8 = (app, options = {}) => V8.install(app, options);\n\nexport default V8;\n";
}
function vueMicroiBridge() {
  return sourceLines([
    "import { createMicroiV8 } from '../utils/microi.v8.js'",
    "",
    "export interface MicroiContext {",
    "  apiBase: string",
    "  osClient: string",
    "  token: string",
    "  appKey: string",
    "  menuId: string",
    "  menuName: string",
    "  version: string",
    "  microRoute: string",
    "  route: Record<string, unknown>",
    "}",
    "",
    "export interface ApiEngineResult<TData = unknown> {",
    "  Code: number",
    "  Data?: TData",
    "  Msg?: string",
    "}",
    "",
    "function asRecord(value: unknown): Record<string, unknown> {",
    "  return value && typeof value === 'object' ? value as Record<string, unknown> : {}",
    "}",
    "",
    "function readString(source: Record<string, unknown>, ...keys: string[]): string {",
    "  for (const key of keys) {",
    "    const value = source[key]",
    "    if (typeof value === 'string' && value.trim()) return value",
    "  }",
    "  return ''",
    "}",
    "",
    "function localRoutePath(): string {",
    "  const value = String(window.location.hash || '').replace(/^#/, '').split('?')[0]",
    "  return value.startsWith('/') ? value : ''",
    "}",
    "",
    "export function getMicroiContext(): MicroiContext {",
    "  const microAppData = asRecord(window.microApp?.getData?.())",
    "  const injectedData = asRecord(window.__MICROI_APP_CONTEXT__)",
    "  const data = { ...injectedData, ...microAppData }",
    "  const route = asRecord(data.route)",
    "  return {",
    "    apiBase: readString(data, 'apiBase', 'ApiBase') || String(import.meta.env.VITE_MICROI_API_BASE || ''),",
    "    osClient: readString(data, 'osClient', 'OsClient') || String(import.meta.env.VITE_MICROI_OS_CLIENT || ''),",
    "    token: readString(data, 'token', 'Token'),",
    "    appKey: readString(data, 'appKey', 'AppKey'),",
    "    menuId: readString(data, 'menuId', 'MenuId'),",
    "    menuName: readString(data, 'menuName', 'MenuName'),",
    "    version: readString(data, 'version', 'Version'),",
    "    microRoute: readString(data, 'microRoute', 'MicroRoute') || readString(route, 'microRoute', 'microRoutePath') || (window.microApp ? '' : localRoutePath()),",
    "    route,",
    "  }",
    "}",
    "",
    "export const microiV8 = createMicroiV8()",
    "let appliedHostToken = ''",
    "",
    "export function configureMicroiV8(context: MicroiContext = getMicroiContext()) {",
    "  microiV8.configure({",
    "    apiBase: context.apiBase,",
    "    osClient: context.osClient,",
    "    tokenKey: 'microi_token',",
    "    userKey: 'microi_user',",
    "    appendOsClientQuery: true,",
    "    onTokenChanged: (token: string, requestToken: string) => {",
    "      window.microApp?.dispatch?.({ type: 'micro-app:token', data: { token, requestToken } })",
    "    },",
    "  })",
    "  if (context.token !== appliedHostToken) {",
    "    appliedHostToken = context.token",
    "    if (context.token) microiV8.setToken(context.token)",
    "    else microiV8.clearToken()",
    "  }",
    "  return microiV8",
    "}",
    "",
    "export async function runApiEngine<TData = unknown>(key: string, data: Record<string, unknown> = {}): Promise<ApiEngineResult<TData>> {",
    "  return await microiV8.ApiEngine.Run(key, data, { checkCode: true }) as ApiEngineResult<TData>",
    "}",
  ]);
}
function vueMain() {
  return sourceLines([
    "import { createApp } from 'vue'",
    "import App from './App.vue'",
    "import { configureMicroiV8, getMicroiContext } from './platform/microi'",
    "import './style.css'",
    "",
    "const context = getMicroiContext()",
    "const V8 = configureMicroiV8(context)",
    "const app = createApp(App)",
    "V8.install(app)",
    "app.provide('microiContext', context)",
    "app.mount('#app')",
  ]);
}
function vueAppFile(appName, description, appType) {
  var appNameJson = safeScriptJson(appName);
  var descriptionJson = safeScriptJson(description);
  var appTypeJson = safeScriptJson(appType);
  return sourceLines([
    "<template>",
    "  <main class=\"app-shell\">",
    "    <section class=\"hero\">",
    "      <p class=\"eyebrow\">Microi {{ applicationType }}</p>",
    "      <h1>{{ applicationName }}</h1>",
    "      <p class=\"description\">{{ applicationDescription || '从这里开始实现业务页面。' }}</p>",
    "      <div class=\"actions\">",
    "        <button type=\"button\" :disabled=\"pending\" @click=\"callExample\">",
    "          {{ pending ? '调用中…' : '通过 Microi SDK 调用示例接口' }}",
    "        </button>",
    "      </div>",
    "    </section>",
    "    <section class=\"panel\" aria-live=\"polite\">",
    "      <h2>运行上下文</h2>",
    "      <dl>",
    "        <div><dt>租户</dt><dd>{{ context.osClient || '等待宿主注入' }}</dd></div>",
    "        <div><dt>应用 Key</dt><dd>{{ context.appKey || '尚未注入' }}</dd></div>",
    "        <div><dt>路由</dt><dd>{{ context.microRoute || '/' }}</dd></div>",
    "      </dl>",
    "      <pre>{{ result }}</pre>",
    "    </section>",
    "  </main>",
    "</template>",
    "",
    "<script setup lang=\"ts\">",
    "import { ref } from 'vue'",
    "import { getMicroiContext, runApiEngine } from './platform/microi'",
    "",
    "const applicationName = " + appNameJson,
    "const applicationDescription = " + descriptionJson,
    "const applicationType = " + appTypeJson,
    "const context = getMicroiContext()",
    "const pending = ref(false)",
    "const result = ref('SDK 已就绪；请把示例 ApiEngineKey 替换为真实接口。')",
    "",
    "async function callExample() {",
    "  pending.value = true",
    "  try {",
    "    result.value = JSON.stringify(await runApiEngine('your-api-engine-key'), null, 2)",
    "  } catch (error: unknown) {",
    "    result.value = error instanceof Error ? error.message : String(error)",
    "  } finally {",
    "    pending.value = false",
    "  }",
    "}",
    "</script>",
  ]);
}
function vueStyle() {
  return sourceLines([
    ":root{font-family:Inter,\"Microsoft YaHei\",system-ui,sans-serif;color:#172033;background:#f5f7fb;font-synthesis:none;text-rendering:optimizeLegibility}",
    "*{box-sizing:border-box}",
    "html,body,#app{min-height:100%;margin:0}",
    "button{font:inherit}",
    ".app-shell{width:min(1040px,100%);min-height:100%;margin:0 auto;padding:clamp(20px,4vw,56px);display:grid;gap:20px}",
    ".hero,.panel{border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 18px 48px rgba(37,51,77,.08)}",
    ".hero{padding:clamp(24px,5vw,52px);background:linear-gradient(135deg,#fff 0%,#f4f7ff 100%)}",
    ".eyebrow{margin:0;color:#f05a28;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}",
    "h1{margin:12px 0 10px;font-size:clamp(32px,6vw,54px);line-height:1.08}",
    ".description{max-width:680px;margin:0;color:#5f6b7a;line-height:1.75}",
    ".actions{margin-top:26px}",
    "button{min-height:42px;border:0;border-radius:10px;padding:0 18px;background:#f05a28;color:#fff;font-weight:700;cursor:pointer}",
    "button:disabled{cursor:wait;opacity:.65}",
    ".panel{padding:24px}",
    "h2{margin:0 0 16px;font-size:18px}",
    "dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 16px}",
    "dl div{padding:12px;border-radius:10px;background:#f7f9fc}",
    "dt{color:#667085;font-size:12px}",
    "dd{margin:6px 0 0;overflow-wrap:anywhere;font-weight:700}",
    "pre{min-height:96px;margin:0;padding:14px;overflow:auto;border-radius:10px;background:#172033;color:#dbe7ff;white-space:pre-wrap}",
    "@media(max-width:640px){.app-shell{padding:16px}.hero,.panel{border-radius:12px}dl{grid-template-columns:1fr}}",
  ]);
}
function vueReadme(appName, description, appType) {
  return sourceLines([
    "# " + text(appName),
    "",
    "- 运行类型：" + text(appType),
    "- 说明：" + text(description),
    "- 技术基线：Vue 3.5.40 + Vite 7.3.6 + TypeScript 5.9.3",
    "- Node.js：^20.19.0 || >=22.12.0",
    "",
    "```bash",
    "npm install",
    "npm run typecheck",
    "npm run build",
    "```",
    "",
    "平台调用统一从 `src/platform/microi.ts` 导入，底层复用 `src/utils/microi.v8.js` 的模块级 SDK 单例；业务页面不要自行拼接租户、Token 或接口地址。",
  ]);
}
function vueStarterFiles(appType, appName, description) {
  var files = [
    { FilePath: "package.json", Content: vuePackageJson(appType) },
    { FilePath: "tsconfig.json", Content: vueTsConfig() },
    { FilePath: "vite.config.ts", Content: vueViteConfig() },
    { FilePath: "index.html", Content: vueIndexHtml() },
    { FilePath: "src/env.d.ts", Content: vueEnvDts() },
    { FilePath: "src/main.ts", Content: vueMain() },
    { FilePath: "src/App.vue", Content: vueAppFile(appName, description, appType) },
    { FilePath: "src/style.css", Content: vueStyle() },
    { FilePath: "src/platform/microi.ts", Content: vueMicroiBridge() },
    { FilePath: "src/utils/microi.v8.js", Content: vueMicroiSdk() },
    { FilePath: "README.md", Content: vueReadme(appName, description, appType) }
  ];
  if (appType === "MicroService") {
    files.splice(4, 0, { FilePath: "microi.routes.json", Content: JSON.stringify([{ path: "/", name: "home", title: "首页", sort: 0, isHome: true }], null, 2) });
  }
  return files;
}
function microServiceStarterFiles(appName, description) {
  return vueStarterFiles("MicroService", appName, description);
}
function webStarterFiles(appName, description) {
  return vueStarterFiles("Web", appName, description);
}
function beautyUniAppFiles(appName, description) {
  return [
    { FilePath: "package.json", Content: '{"scripts":{"dev:h5":"uni --platform h5","build:h5":"uni build --platform h5"},"dependencies":{},"devDependencies":{}}' },
    { FilePath: "manifest.json", Content: '{"name":"' + appName + '","appid":"","description":"' + description + '","versionName":"1.0.0","versionCode":"100"}' },
    { FilePath: "pages.json", Content: '{"pages":[{"path":"pages/index/index","style":{"navigationBarTitleText":"预约首页"}},{"path":"pages/services/index","style":{"navigationBarTitleText":"服务项目"}},{"path":"pages/stylists/index","style":{"navigationBarTitleText":"技师团队"}},{"path":"pages/booking/index","style":{"navigationBarTitleText":"在线预约"}},{"path":"pages/mine/index","style":{"navigationBarTitleText":"我的预约"}}],"tabBar":{"color":"#7a7f8c","selectedColor":"#ff5f2e","list":[{"pagePath":"pages/index/index","text":"首页"},{"pagePath":"pages/services/index","text":"服务"},{"pagePath":"pages/stylists/index","text":"技师"},{"pagePath":"pages/mine/index","text":"我的"}]}}' },
    { FilePath: "main.js", Content: "import App from './App'\nimport { createSSRApp } from 'vue'\nexport function createApp(){const app=createSSRApp(App);return {app}}" },
    { FilePath: "App.vue", Content: '<script>export default{onLaunch(){}}</script><style>page{background:#f6f7fb;color:#20242c}.mci-card{background:#fff;border-radius:16rpx;box-shadow:0 12rpx 34rpx rgba(28,39,60,.08)}</style>' },
    { FilePath: "common/microi-api.js", Content: 'const OS_CLIENT="' + V8.OsClient + '"\nexport function runApiEngine(apiEngineKey,data={}){const key=String(apiEngineKey||"").trim();if(!key)throw new Error("ApiEngineKey不能为空");return uni.request({url:"/apiengine/"+encodeURIComponent(key),method:"POST",header:{OsClient:OS_CLIENT,apiengine:"1"},data:{OsClient:OS_CLIENT,...data}})}' },
    { FilePath: "pages/index/index.vue", Content: '<template><view class="page"><view class="hero"><text class="eyebrow">Beauty Booking</text><text class="title">' + appName + '</text><text class="desc">' + description + '</text><view class="actions"><button>立即预约</button><button class="ghost">查看服务</button></view></view><view class="stats"><view><text>32</text><span>精选服务</span></view><view><text>18</text><span>专业技师</span></view><view><text>4.9</text><span>用户评分</span></view></view></view></template><style>.page{min-height:100vh;padding:32rpx}.hero{padding:42rpx;border-radius:24rpx;background:linear-gradient(135deg,#ff7043,#ff3d2e);color:#fff}.eyebrow{font-size:24rpx;opacity:.88}.title{display:block;margin-top:18rpx;font-size:46rpx;font-weight:800}.desc{display:block;margin-top:18rpx;line-height:1.7}.actions{display:flex;gap:20rpx;margin-top:32rpx}button{border-radius:999rpx;background:#fff;color:#ff5f2e}.ghost{background:rgba(255,255,255,.18);color:#fff}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18rpx;margin-top:24rpx}.stats view{padding:26rpx;border-radius:18rpx;background:#fff;text-align:center}.stats text{display:block;color:#20242c;font-size:36rpx;font-weight:800}.stats span{color:#7a8290;font-size:24rpx}</style>' },
    { FilePath: "pages/services/index.vue", Content: '<template><view class="page"><view v-for="item in services" :key="item.name" class="card"><text class="name">{{item.name}}</text><text class="price">¥{{item.price}}</text><text class="desc">{{item.desc}}</text></view></view></template><script setup>const services=[{name:"精致剪发",price:88,desc:"洗剪吹与造型建议"},{name:"头皮护理",price:168,desc:"舒缓护理与头皮清洁"},{name:"时尚烫染",price:398,desc:"预约设计师定制发色"}]</script><style>.page{padding:28rpx}.card{margin-bottom:20rpx;padding:30rpx;border-radius:18rpx;background:#fff}.name{font-size:32rpx;font-weight:700}.price{float:right;color:#ff5f2e;font-size:32rpx;font-weight:800}.desc{display:block;margin-top:14rpx;color:#7a8290}</style>' },
    { FilePath: "pages/stylists/index.vue", Content: '<template><view class="page"><view v-for="item in stylists" :key="item.name" class="stylist"><view class="avatar">{{item.name[0]}}</view><view><text class="name">{{item.name}}</text><text class="tags">{{item.tags}}</text></view><button>预约</button></view></view></template><script setup>const stylists=[{name:"Anna",tags:"剪发 / 烫染"},{name:"Mia",tags:"护理 / 造型"},{name:"Leo",tags:"男士理发"}]</script><style>.page{padding:28rpx}.stylist{display:flex;align-items:center;gap:22rpx;margin-bottom:18rpx;padding:24rpx;border-radius:18rpx;background:#fff}.avatar{width:88rpx;height:88rpx;border-radius:50%;display:grid;place-items:center;background:#fff0e9;color:#ff5f2e;font-weight:800}.name{display:block;font-size:30rpx;font-weight:700}.tags{display:block;margin-top:8rpx;color:#7a8290}button{margin-left:auto;border-radius:999rpx;background:#ff5f2e;color:#fff}</style>' },
    { FilePath: "pages/booking/index.vue", Content: '<template><view class="page"><view class="form"><input placeholder="姓名"/><input placeholder="手机号"/><picker><view class="picker">选择服务项目</view></picker><picker><view class="picker">选择预约时间</view></picker><button>提交预约</button></view></view></template><style>.page{padding:28rpx}.form{padding:30rpx;border-radius:20rpx;background:#fff}input,.picker{height:88rpx;margin-bottom:20rpx;border-radius:12rpx;background:#f5f7fb;padding:0 22rpx;color:#555}button{height:88rpx;border-radius:999rpx;background:#ff5f2e;color:#fff}</style>' },
    { FilePath: "pages/mine/index.vue", Content: '<template><view class="page"><view class="profile"><text class="name">会员用户</text><text>查看预约、积分与优惠券</text></view><view class="cell">我的预约</view><view class="cell">优惠券</view><view class="cell">门店地址</view></view></template><style>.page{padding:28rpx}.profile{padding:34rpx;border-radius:20rpx;background:#20242c;color:#fff}.name{display:block;font-size:34rpx;font-weight:800;margin-bottom:10rpx}.cell{margin-top:18rpx;padding:28rpx;border-radius:16rpx;background:#fff;color:#333}</style>' },
    { FilePath: "README.md", Content: "# " + appName + "\n\n" + description + "\n\n功能包含：服务项目、技师团队、在线预约、会员中心、接口引擎调用封装。" }
  ];
}

var name = text(V8.Param.Name || V8.Param.AppName);
if (isBlank(name)) return fail("应用名称不能为空");
var requestedAppType = text(V8.Param.AppType || V8.Param.ProjectType);
var appType = /microservice|micro-service|微服务/i.test(requestedAppType) ? "MicroService" : (/uni/i.test(requestedAppType) ? "UniApp" : "Web");
var description = text(V8.Param.Description || V8.Param.Requirement);
var explicitKey = !isBlank(V8.Param.AppKey);
if (explicitKey && !isValidExplicitAppKey(V8.Param.AppKey)) return fail("应用Key必须以英文字母开头，只允许英文字母、数字、-、_，长度2-80位");
var appKey = explicitKey ? text(V8.Param.AppKey) : normalizeAppKey("", name);
var keyExists = V8.FormEngine.GetFormData("sys_microistore", {
  _Where: [["AppKey", "=", appKey]],
  _SelectFields: ["Id", "Name", "AppKey"]
});
if (keyExists && keyExists.Code === 1 && keyExists.Data && keyExists.Data.Id) {
  if (explicitKey) return fail("应用Key已存在，请换一个唯一的应用Key");
  appKey = appKey + "-" + text(newId()).toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 6);
}
var exists = V8.FormEngine.GetFormData("sys_microistore", {
  _Where: [["Name", "=", name], ["AppType", "=", appType]],
  _SelectFields: ["Id", "Name", "AppKey", "AppType", "Description", "Status", "CurrentVersion", "PreviewUrl", "BuildStatus", "PrivateSourcePath", "PublicPublishPath"]
});
if (exists && exists.Code === 1 && exists.Data && exists.Data.Id) {
  if (isBlank(exists.Data.AppKey)) {
    var legacyKey = normalizeAppKey("", exists.Data.Name || exists.Data.Id);
    V8.FormEngine.UptFormData("sys_microistore", { Id: exists.Data.Id, AppKey: legacyKey });
    exists.Data.AppKey = legacyKey;
  }
  var existingFiles = getFiles(exists.Data.Id);
  return ok({
    Id: exists.Data.Id,
    Name: exists.Data.Name,
    AppKey: exists.Data.AppKey,
    AppType: exists.Data.AppType,
    Existing: true,
    Files: existingFiles && existingFiles.Code === 1 ? existingFiles.Data || [] : []
  }, "应用已存在，已返回已有记录");
}
var app = V8.FormEngine.AddFormData("sys_microistore", {
  Name: name,
  AppName: name,
  AppId: appKey,
  AppKey: appKey,
  AppType: appType,
  ApplicationType: appType,
  Description: description,
  AppDetail: description,
  Category: text(V8.Param.Category || "other"),
  Status: "Draft",
  OwnerUserId: currentUserId(),
  OwnerName: currentUserName(),
  CurrentVersion: 1,
  BuildStatus: "None",
  PrivateSourcePath: "ai-app-source/",
  PublicPublishPath: "ai-app-publish/"
});
if (!app || app.Code !== 1) return app;
var appId = app.Data.Id || app.Data;
var files = [];
if (V8.Param.WithStarter !== false && V8.Param.WithStarter !== 0) {
  var starter = starterFiles(appType, name, description);
  for (var i = 0; i < starter.length; i++) {
    var save = V8.ApiEngine.Run("ai_app_save_file", {
      AppId: appId,
      FilePath: starter[i].FilePath,
      Content: starter[i].Content,
      IsDirectory: 0
    });
    if (!save || save.Code !== 1) return save;
    files.push(save.Data);
  }
}
return ok({ Id: appId, Name: name, AppKey: appKey, AppType: appType, Files: files });
