/*
 * Microi V8 前端标准开发包。
 * 面向 Vue 3 与 uni-app 项目，不强依赖固定的界面库或状态管理方案。
 * 统一封装吾码接口引擎、表单引擎、文件服务、登录态与旧版 V8 前端接口。
 */

// 默认把这些状态码视为登录态失效，便于各端统一跳转或清理缓存。
const DEFAULT_AUTH_CODES = [401, -1, 1001, 1002];

// 禁用常见占位图和外部二维码资源，避免前端误把临时素材带到正式项目。
const DEFAULT_BLOCKED_ASSET = /(qrserver\.com|create-qr-code|picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com)/i;

// 兼容浏览器、uni-app、小程序运行时以及测试环境中的全局对象读取。
function getGlobalValue(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis[key] !== undefined) return globalThis[key];
  } catch (e) {}
  return undefined;
}

function getUni() {
  try {
    if (typeof uni !== 'undefined' && uni && typeof uni === 'object') return uni;
  } catch (e) {}
  const runtimeUni = getGlobalValue('uni');
  return runtimeUni && typeof runtimeUni === 'object' ? runtimeUni : null;
}

function hasWindow() {
  return typeof window !== 'undefined' && !!window;
}

// 下面这些方法只做路径与查询参数拼装，不参与业务语义判断。
function normalizeBase(url) {
  return String(url || '').replace(/\/+$/, '');
}

function trimLeftSlash(value) {
  return String(value || '').replace(/^\/+/, '');
}

function joinUrl(base, path) {
  const value = String(path || '');
  if (/^(https?:|data:|blob:|file:)/i.test(value)) return value;
  return `${normalizeBase(base)}/${trimLeftSlash(value)}`;
}

function appendQuery(url, key, value) {
  if (!value || new RegExp(`[?&]${key}=`, 'i').test(url)) return url;
  const sep = url.indexOf('?') >= 0 ? '&' : '?';
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

function appendQueryObject(url, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return url;
  const parts = [];
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value === undefined || value === null || value === '') return;
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);
  });
  if (!parts.length) return url;
  return `${url}${url.indexOf('?') >= 0 ? '&' : '?'}${parts.join('&')}`;
}

function parseMaybeJson(value, fallback = {}) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  const text = value.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

// 没有 uni 或浏览器缓存时退回内存缓存，保证单元测试和服务端渲染不会崩溃。
function createMemoryStorage() {
  const cache = new Map();
  return {
    get(key) {
      return cache.has(key) ? cache.get(key) : '';
    },
    set(key, value) {
      cache.set(key, value);
    },
    remove(key) {
      cache.delete(key);
    }
  };
}

function createDefaultStorage() {
  const runtimeUni = getUni();
  if (runtimeUni && typeof runtimeUni.getStorageSync === 'function') {
    return {
      get(key) {
        try {
          return runtimeUni.getStorageSync(key) || '';
        } catch (e) {
          return '';
        }
      },
      set(key, value) {
        try {
          runtimeUni.setStorageSync(key, value);
        } catch (e) {}
      },
      remove(key) {
        try {
          runtimeUni.removeStorageSync(key);
        } catch (e) {}
      }
    };
  }

  if (hasWindow() && window.localStorage) {
    return {
      get(key) {
        try {
          return window.localStorage.getItem(key) || '';
        } catch (e) {
          return '';
        }
      },
      set(key, value) {
        try {
          window.localStorage.setItem(key, value);
        } catch (e) {}
      },
      remove(key) {
        try {
          window.localStorage.removeItem(key);
        } catch (e) {}
      }
    };
  }

  return createMemoryStorage();
}

function serializeUser(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function deserializeUser(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  return parseMaybeJson(value, null);
}

// 吾码文件字段可能来自上传控件、HDFS 接口、字符串或 JSON 字符串，这里统一抽取可用路径。
function extractUploadPath(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    const raw = Array.isArray(value) ? (value[0] || {}) : value;
    if (typeof raw === 'string') return extractUploadPath(raw);
    return raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL ||
      raw.FullUrl || raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || '';
  }

  const text = String(value || '').trim();
  if (!text) return '';
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    return extractUploadPath(parseMaybeJson(text, text));
  }
  return text;
}

function normalizeUploadValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(extractUploadPath).filter(Boolean);
  if (typeof value === 'object') {
    const path = extractUploadPath(value);
    return path ? [path] : [];
  }

  const text = String(value || '').trim();
  if (!text) return [];
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    const parsed = parseMaybeJson(text, null);
    if (Array.isArray(parsed)) return parsed.map(extractUploadPath).filter(Boolean);
    const path = extractUploadPath(parsed);
    return path ? [path] : [];
  }
  return [text];
}

function normalizeUploadData(body) {
  const raw = Array.isArray(body && body.Data) ? (body.Data[0] || {}) : ((body && body.Data) || {});
  const path = raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || raw.Url || raw.FileUrl || '';
  const url = raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL || '';
  return { ...raw, Path: path, Url: url };
}

function normalizeClientUploadPath(value) {
  let path = String(value || 'upload').trim().replace(/\\/g, '/');
  if (/^(https?:|data:|blob:|file:)/i.test(path)) throw new Error('上传路径不合法。');
  path = path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  if (!path || path.startsWith('~') || path.includes('..') || path.includes(':')) {
    throw new Error('上传路径不合法。');
  }
  const parts = path.split('/').filter(Boolean);
  if (!parts.length || parts.some((item) => item === '.' || item === '..')) {
    throw new Error('上传路径不合法。');
  }
  return parts.join('/');
}

function normalizeFileUrlData(data, assetUrl, fallback = '') {
  const raw = Array.isArray(data) ? (data[0] || '') : (data || '');
  if (typeof raw === 'string') return assetUrl(raw || fallback);
  const url = raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL || raw.FullUrl || '';
  const path = raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || '';
  return assetUrl(url || path || fallback);
}

function getHeaderValue(headers, key) {
  if (!headers) return '';
  const lower = key.toLowerCase();
  for (const name of Object.keys(headers)) {
    if (String(name).toLowerCase() === lower) return headers[name];
  }
  return '';
}

function setSingletonHeader(headers, key, value) {
  const lower = String(key).toLowerCase();
  Object.keys(headers).forEach((name) => {
    if (String(name).toLowerCase() === lower) delete headers[name];
  });
  if (value !== undefined && value !== null && value !== '') headers[key] = value;
}

function normalizeBearer(value) {
  const text = String(value || '').trim();
  return /^Bearer\s+/i.test(text) ? text.replace(/^Bearer\s+/i, '') : text;
}

// 兼容浏览器上传对象、组件包装对象和 uni-app 临时文件路径。
function isUploadFileLike(value) {
  if (!value) return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return typeof value.arrayBuffer === 'function';
}

function pickUploadFileLike(value) {
  if (!value) return null;
  if (isUploadFileLike(value)) return value;
  if (typeof value !== 'object') return null;
  const keys = ['file', 'raw', 'blob', 'originFileObj', 'tempFile', 'data'];
  for (const key of keys) {
    const picked = pickUploadFileLike(value[key]);
    if (picked) return picked;
  }
  return null;
}

function pickUploadFileName(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    if (value.name) return String(value.name);
    const keys = ['file', 'raw', 'blob', 'originFileObj', 'tempFile', 'data'];
    for (const key of keys) {
      const name = pickUploadFileName(value[key]);
      if (name) return name;
    }
    const path = value.path || value.tempFilePath || value.url || value.src || value.localUrl || value.fullPath || '';
    if (path) return inferUploadFileName(path);
  }
  return '';
}

function inferUploadFileName(value) {
  const text = String(value || '').split('?')[0].split('#')[0];
  const name = decodeURIComponent((text.split('/').pop() || '').trim());
  return name && name.indexOf(':') < 0 ? name : '';
}

function pickUploadFileSource(filePath, options = {}) {
  const candidates = [options.file, filePath];
  for (const item of candidates) {
    if (!item) continue;
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      const path = item.path || item.tempFilePath || item.url || item.src || item.localUrl || item.fullPath || '';
      if (path) return String(path);
    }
  }
  return '';
}

async function resolveFetchUploadFile(filePath, options = {}) {
  const direct = pickUploadFileLike(options.file) || pickUploadFileLike(filePath);
  const name = options.fileName || pickUploadFileName(options.file) || pickUploadFileName(filePath) || inferUploadFileName(filePath) || 'file';
  if (direct) return { file: direct, name };

  const source = pickUploadFileSource(filePath, options);
  if (source && typeof fetch === 'function' && /^(blob:|data:)/i.test(source)) {
    const res = await fetch(source);
    const blob = await res.blob();
    return { file: blob, name };
  }
  return { file: null, name };
}

// 控制接口并发，适合列表页批量请求时给后端和小程序运行时减压。
function createQueue(maxConcurrent) {
  const limit = Number(maxConcurrent || 0);
  if (!limit || limit <= 0) {
    return async function runNow(task) {
      return task();
    };
  }

  let active = 0;
  const waiting = [];
  function release() {
    if (waiting.length) {
      const next = waiting.shift();
      active += 1;
      next();
    } else {
      active = Math.max(0, active - 1);
    }
  }

  return function runQueued(task) {
    return new Promise((resolve, reject) => {
      const start = () => {
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(release);
      };
      if (active < limit) {
        active += 1;
        start();
      } else {
        waiting.push(start);
      }
    });
  };
}

function defaultToast(message) {
  const runtimeUni = getUni();
  if (runtimeUni && typeof runtimeUni.showToast === 'function') {
    runtimeUni.showToast({ title: String(message || ''), icon: 'none' });
    return;
  }
  if (hasWindow() && typeof window.alert === 'function') window.alert(String(message || ''));
}

function defaultConfirm(message) {
  const runtimeUni = getUni();
  if (runtimeUni && typeof runtimeUni.showModal === 'function') {
    return new Promise((resolve) => {
      runtimeUni.showModal({
        title: '',
        content: String(message || ''),
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
  }
  if (hasWindow() && typeof window.confirm === 'function') return Promise.resolve(window.confirm(String(message || '')));
  return Promise.resolve(true);
}

// fetch 的超时需要 AbortController；不支持时由运行时自身处理。
function createFetchTimeout(timeout) {
  if (typeof AbortController === 'undefined') return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(timeout || 30000));
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

function getSafeArea() {
  const runtimeUni = getUni();
  if (runtimeUni && typeof runtimeUni.getSystemInfoSync === 'function') {
    try {
      const info = runtimeUni.getSystemInfoSync();
      const insets = info.safeAreaInsets || {};
      const safeArea = info.safeArea || {};
      return {
        top: Number(insets.top || safeArea.top || info.statusBarHeight || 0),
        bottom: Number(insets.bottom || 0),
        left: Number(insets.left || 0),
        right: Number(insets.right || 0),
        statusBarHeight: Number(info.statusBarHeight || 0),
        windowHeight: Number(info.windowHeight || 0),
        windowWidth: Number(info.windowWidth || 0),
        platform: info.platform || ''
      };
    } catch (e) {}
  }
  return { top: 0, bottom: 0, left: 0, right: 0, statusBarHeight: 0, windowHeight: 0, windowWidth: 0, platform: '' };
}

// 常用日期、数字与显示格式化，兼容旧版前端 V8 写法。
function formatDate(value, format = 'yyyy-MM-dd HH:mm:ss') {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num, len = 2) => String(num).padStart(len, '0');
  const map = {
    yyyy: date.getFullYear(),
    MM: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    SSS: pad(date.getMilliseconds(), 3)
  };
  return Object.keys(map).reduce((text, key) => text.replace(new RegExp(key, 'g'), map[key]), format);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function maskPhone(value) {
  const text = String(value || '');
  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(-4)}` : text;
}

function formatCompactNumber(value, digits = 2) {
  const num = toNumber(value, 0);
  const abs = Math.abs(num);
  if (abs >= 100000000) return `${(num / 100000000).toFixed(digits).replace(/\.?0+$/, '')}亿`;
  if (abs >= 10000) return `${(num / 10000).toFixed(digits).replace(/\.?0+$/, '')}万`;
  return `${num}`;
}

function addTime(value, unit, number) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  const amount = Number(number || 0);
  switch (unit) {
    case 's':
      date.setSeconds(date.getSeconds() + amount);
      break;
    case 'n':
    case 'm':
      date.setMinutes(date.getMinutes() + amount);
      break;
    case 'h':
      date.setHours(date.getHours() + amount);
      break;
    case 'd':
      date.setDate(date.getDate() + amount);
      break;
    case 'w':
      date.setDate(date.getDate() + amount * 7);
      break;
    case 'q':
      date.setMonth(date.getMonth() + amount * 3);
      break;
    case 'M':
      date.setMonth(date.getMonth() + amount);
      break;
    case 'y':
      date.setFullYear(date.getFullYear() + amount);
      break;
    default:
      date.setMilliseconds(date.getMilliseconds() + amount);
      break;
  }
  return date;
}

function diffTime(value, unit, value2) {
  const d1 = value instanceof Date ? value : new Date(value);
  const d2 = value2 instanceof Date ? value2 : new Date(value2 || Date.now());
  const t1 = d1.getTime();
  const t2 = d2.getTime();
  const year = d2.getFullYear() - d1.getFullYear();
  const map = {
    y: year,
    q: year * 4 + Math.floor(d2.getMonth() / 4) - Math.floor(d1.getMonth() / 4),
    M: year * 12 + d2.getMonth() - d1.getMonth(),
    m: year * 12 + d2.getMonth() - d1.getMonth(),
    ms: t2 - t1,
    w: Math.floor((t2 + 345600000) / 604800000) - Math.floor((t1 + 345600000) / 604800000),
    d: Math.floor(t2 / 86400000) - Math.floor(t1 / 86400000),
    h: Math.floor(t2 / 3600000) - Math.floor(t1 / 3600000),
    n: Math.floor(t2 / 60000) - Math.floor(t1 / 60000),
    s: Math.floor(t2 / 1000) - Math.floor(t1 / 1000)
  };
  return map[unit];
}

// 老项目里常用 Date.prototype.Format/AddTime/DiffTime，这里只在缺失时补齐。
function installDatePrototypeCompat() {
  if (typeof Date === 'undefined' || !Date.prototype) return;
  if (typeof Date.prototype.Format !== 'function') {
    Object.defineProperty(Date.prototype, 'Format', {
      configurable: true,
      writable: true,
      value(format) {
        return format ? formatDate(this, format) : this;
      }
    });
  }
  if (typeof Date.prototype.AddTime !== 'function') {
    Object.defineProperty(Date.prototype, 'AddTime', {
      configurable: true,
      writable: true,
      value(unit, number) {
        return addTime(this, unit, number);
      }
    });
  }
  if (typeof Date.prototype.DiffTime !== 'function') {
    Object.defineProperty(Date.prototype, 'DiffTime', {
      configurable: true,
      writable: true,
      value(unit, time2) {
        return diffTime(this, unit, time2);
      }
    });
  }
}

export function createMicroiV8(options = {}) {
  // 运行时配置可通过 createMicroiV8(options) 或 client.configure(next) 覆盖。
  let config = {
    apiBase: '',
    webBase: '',
    fileServer: '',
    osClient: '',
    tokenKey: 'microi_token',
    userKey: 'microi_user',
    loginUrl: '',
    formQueryEngineKey: '',
    timeout: 30000,
    maxConcurrent: 0,
    appendOsClientQuery: false,
    authCodes: DEFAULT_AUTH_CODES,
    blockedAssetPattern: DEFAULT_BLOCKED_ASSET,
    translate: (message) => message,
    requestAdapter: null,
    onAuthExpired: null,
    toast: null,
    confirm: null,
    ...options
  };

  const storage = options.storage || createDefaultStorage();
  let runQueued = createQueue(config.maxConcurrent);

  // 更新配置后立即刷新并发队列，保证 maxConcurrent 热更新生效。
  function configure(next = {}) {
    config = { ...config, ...next };
    if (Object.prototype.hasOwnProperty.call(next, 'maxConcurrent')) {
      runQueued = createQueue(config.maxConcurrent);
    }
    return client;
  }

  function tr(message) {
    try {
      return config.translate ? config.translate(message) : message;
    } catch (e) {
      return message;
    }
  }

  function toast(message) {
    if (!message) return;
    const text = tr(message);
    if (typeof config.toast === 'function') return config.toast(text);
    return defaultToast(text);
  }

  function confirm(message) {
    if (typeof config.confirm === 'function') return config.confirm(tr(message));
    return defaultConfirm(tr(message));
  }

  function getToken() {
    return storage.get(config.tokenKey) || '';
  }

  function setToken(token) {
    storage.set(config.tokenKey, token || '');
  }

  function clearToken() {
    storage.remove(config.tokenKey);
    storage.remove(config.userKey);
  }

  function setUser(user) {
    storage.set(config.userKey, serializeUser(user));
  }

  function getUser() {
    return deserializeUser(storage.get(config.userKey));
  }

  function isAuthExpired(body, statusCode) {
    if (Number(statusCode) === 401) return true;
    const code = body && body.Code;
    return config.authCodes.indexOf(code) >= 0;
  }

  function handleReturnedToken(headers) {
    const auth = getHeaderValue(headers, 'authorization') || getHeaderValue(headers, 'token');
    const token = normalizeBearer(auth);
    if (token) setToken(token);
  }

  function handleAuthExpired(body) {
    clearToken();
    if (typeof config.onAuthExpired === 'function') {
      config.onAuthExpired(body, client);
    }
  }

  // 所有相对地址默认走 apiBase，必要时自动追加 OsClient。
  function buildUrl(url) {
    let fullUrl = /^(https?:|data:|blob:|file:)/i.test(String(url || '')) ? String(url) : joinUrl(config.apiBase, url);
    if (config.appendOsClientQuery && config.osClient && fullUrl.indexOf('/apiengine/') < 0) {
      fullUrl = appendQuery(fullUrl, 'OsClient', config.osClient);
    }
    return fullUrl;
  }

  // 普通请求统一携带 osclient、Token 与 Authorization，减少各项目重复拼装。
  function buildHeaders(options = {}) {
    const token = options.auth === false ? '' : getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.header || {}),
      ...(options.headers || {})
    };
    if (config.osClient) setSingletonHeader(headers, 'osclient', config.osClient);
    if (token) {
      setSingletonHeader(headers, 'Token', token);
      setSingletonHeader(headers, 'Authorization', `Bearer ${token}`);
    }
    if (options.apiEngine) headers.apiengine = '1';
    return headers;
  }

  function buildUploadHeaders(options = {}) {
    const headers = buildHeaders(options);
    Object.keys(headers).forEach((key) => {
      if (String(key).toLowerCase() === 'content-type') delete headers[key];
    });
    return headers;
  }

  // 请求核心：优先走自定义适配器，其次 uni.request，最后回退 fetch。
  async function request(options = {}) {
    const method = String(options.method || 'POST').toUpperCase();
    let fullUrl = buildUrl(options.url || options.path || '');
    const headers = buildHeaders(options);
    const data = options.data === undefined ? {} : options.data;
    const timeout = options.timeout || config.timeout;

    const perform = async () => {
      let response;
      if (typeof config.requestAdapter === 'function') {
        response = await config.requestAdapter({ ...options, url: fullUrl, method, data, header: headers, headers, timeout });
      } else {
        const runtimeUni = getUni();
        if (runtimeUni && typeof runtimeUni.request === 'function') {
          response = await new Promise((resolve, reject) => {
            runtimeUni.request({
              url: fullUrl,
              method,
              data,
              header: headers,
              timeout,
              success: resolve,
              fail: reject
            });
          });
        } else if (typeof fetch === 'function') {
          if ((method === 'GET' || method === 'HEAD') && data && typeof data === 'object') {
            fullUrl = appendQueryObject(fullUrl, data);
          }
          const timer = createFetchTimeout(timeout);
          try {
            const fetchOptions = {
              method,
              headers,
              signal: timer.signal
            };
            if (method !== 'GET' && method !== 'HEAD') fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data || {});
            const res = await fetch(fullUrl, fetchOptions);
            const text = await res.text();
            const resultData = parseMaybeJson(text, text);
            const resultHeaders = {};
            res.headers.forEach((value, key) => { resultHeaders[key] = value; });
            response = { statusCode: res.status, data: resultData, header: resultHeaders, headers: resultHeaders };
          } finally {
            if (typeof timer.cleanup === 'function') timer.cleanup();
          }
        } else {
          throw new Error('未找到 MicroiV8 请求适配器。');
        }
      }

      const statusCode = response.statusCode || response.status || 200;
      const body = response.data === undefined ? response.body : response.data;
      const headersReturned = response.header || response.headers || {};
      handleReturnedToken(headersReturned);

      if (options.auth !== false && isAuthExpired(body, statusCode)) {
        handleAuthExpired(body);
        if (options.silentError !== true) toast((body && body.Msg) || '登录已过期');
        throw body || new Error('登录已过期');
      }

      if (statusCode >= 400) {
        const error = body || new Error(`请求失败: ${statusCode}`);
        if (options.silentError !== true) toast((body && body.Msg) || `请求失败: ${statusCode}`);
        throw error;
      }

      if (options.checkCode && body && body.Code !== 1) {
        if (options.silentError !== true) toast(body.Msg || '请求失败');
        throw body;
      }

      return body;
    };

    return runQueued(perform);
  }

  function get(url, data = {}, options = {}) {
    return request({ ...options, url, data, method: 'GET' });
  }

  function post(url, data = {}, options = {}) {
    return request({ ...options, url, data, method: 'POST' });
  }

  // 资源地址统一过滤占位图，并兼容 HDFS 私有文件、FileServer 和绝对地址。
  function assetUrl(value) {
    const picked = extractUploadPath(value);
    if (!picked || isBlockedAsset(picked)) return '';
    if (/^(https?:|data:|blob:|file:)/i.test(picked)) return picked;
    if (/^\/?file\//i.test(picked)) return joinUrl(config.apiBase, picked);
    if (/^\//.test(picked) || /^[a-z0-9_-]+\//i.test(picked)) return joinUrl(config.fileServer || config.apiBase, picked);
    return picked;
  }

  function isBlockedAsset(value) {
    return config.blockedAssetPattern ? config.blockedAssetPattern.test(String(value || '')) : false;
  }

  async function resolveFileUrl(filePathName) {
    const path = extractUploadPath(filePathName);
    if (!path || isBlockedAsset(path)) return '';
    if (/^(https?:|blob:|data:|file:)/i.test(path)) return assetUrl(path);

    async function requestPrivate(action) {
      try {
        const body = await post(`/api/HDFS/${action}?FilePathName=${encodeURIComponent(path)}`, { OsClient: config.osClient }, {
          checkCode: false,
          silentError: true
        });
        if (body && body.Code === 1 && body.Data) return normalizeFileUrlData(body.Data, assetUrl, path);
      } catch (e) {}
      return '';
    }

    return (await requestPrivate('GetPrivateFileUrl')) || (await requestPrivate('MallFileUrl')) || assetUrl(path);
  }

  // 文件上传同时支持 uni.uploadFile 与浏览器 fetch/FormData。
  async function uploadFile(filePath, options = {}) {
    const runtimeUni = getUni();
    const action = options.action || (options.anonymous ? 'UniappUploadAnonymous' : 'UniappUpload');
    const rawFormData = options.formData || {};
    const uploadData = {
      ...rawFormData,
      OsClient: config.osClient,
      Limit: options.limit === false ? 'false' : 'true',
      Preview: options.preview === false ? 'false' : 'true',
      Multiple: options.multiple ? 'true' : 'false'
    };
    uploadData.Path = normalizeClientUploadPath(options.path || uploadData.Path || uploadData.path || 'upload');
    delete uploadData.path;

    let body;
    const fetchSource = pickUploadFileSource(filePath, options);
    const canFetchUpload = typeof fetch === 'function' && typeof FormData !== 'undefined' &&
      (!!pickUploadFileLike(options.file) || !!pickUploadFileLike(filePath) || /^(blob:|data:)/i.test(fetchSource));
    const uploadByFetch = async () => {
      const picked = await resolveFetchUploadFile(filePath, options);
      const file = picked.file;
      if (!file) throw new Error('未提供上传文件。');
      const formData = new FormData();
      Object.keys(uploadData).forEach((key) => formData.append(key, uploadData[key]));
      formData.append(options.name || 'file', file, picked.name || (file && file.name) || 'file');
      const res = await fetch(buildUrl(options.url || `/api/HDFS/${action}`), {
        method: 'POST',
        headers: buildUploadHeaders({ ...options, headers: options.headers || {} }),
        body: formData
      });
      const text = await res.text();
      return parseMaybeJson(text, text);
    };

    if (options.preferFetch === true && canFetchUpload) {
      try {
        body = await uploadByFetch();
      } catch (e) {
        if (!(runtimeUni && typeof runtimeUni.uploadFile === 'function')) throw e;
      }
    }
    if (!body) {
      if (runtimeUni && typeof runtimeUni.uploadFile === 'function') {
        try {
          body = await new Promise((resolve, reject) => {
            runtimeUni.uploadFile({
              url: buildUrl(options.url || `/api/HDFS/${action}`),
              filePath,
              name: options.name || 'file',
              header: buildUploadHeaders({ ...options, headers: options.headers || {} }),
              formData: uploadData,
              success: (res) => resolve(parseMaybeJson(res.data, res.data)),
              fail: reject
            });
          });
        } catch (e) {
          if (!canFetchUpload) throw e;
          body = await uploadByFetch();
        }
      } else if (canFetchUpload) {
        body = await uploadByFetch();
      } else {
        throw new Error('未找到 MicroiV8 上传适配器。');
      }
    }

    if (!body || body.Code !== 1) {
      if (options.silentError !== true) toast((body && body.Msg) || '上传失败');
      throw body || new Error('上传失败');
    }

    const data = normalizeUploadData(body);
    if (!data.Path) {
      const error = { Code: 0, Msg: '上传返回文件路径为空' };
      if (options.silentError !== true) toast(error.Msg);
      throw error;
    }
    if (!data.Url && options.resolveUrl !== false) data.Url = await resolveFileUrl(data.Path);
    return { ...body, Data: data };
  }

  function apiEngineRun(key, data = {}, options = {}) {
    const body = { ...(data || {}) };
    if (config.osClient && body.OsClient === undefined) body.OsClient = config.osClient;
    return post(`/apiengine/${key}`, body, { apiEngine: true, checkCode: options.checkCode !== false, ...options });
  }

  function apiEngineRunLegacy(key, data = {}, options = {}) {
    const body = { ApiEngineKey: key, OsClient: config.osClient, ...(data || {}) };
    return post('/api/ApiEngine/Run', body, { checkCode: false, ...options });
  }

  function formEngineRequest(action, table, data = {}, options = {}) {
    const actionKey = String(action || '').toLowerCase();
    const readActions = ['gettabledata', 'getformdata', 'gettabledatatree'];
    const isRead = readActions.indexOf(actionKey) >= 0;
    const body = { OsClient: config.osClient, FormEngineKey: table, ...(data || {}) };

    if (isRead && config.formQueryEngineKey && options.readUseQueryEngine !== false) {
      return apiEngineRun(config.formQueryEngineKey, { Action: actionKey, ...body }, { checkCode: false, ...options });
    }

    return post(`/api/formengine/${actionKey}-${table}`, body, { checkCode: false, ...options });
  }

  function formEngineAnonymous(action, table, data = {}, options = {}) {
    const name = String(action || '');
    const body = { FormEngineKey: table, OsClient: config.osClient, ...(data || {}) };
    return post(`/api/FormEngine/${name}`, body, { auth: false, checkCode: false, ...options });
  }

  function withCallback(promise, callback) {
    if (typeof callback === 'function') {
      promise.then((result) => callback(result)).catch((error) => callback(error));
    }
    return promise;
  }

  // 兼容旧版 FormEngine 调用：既支持 (table, row, callback)，也支持完整参数对象。
  function normalizeLegacyFormArgs(first, second, third, rowModelMode = false) {
    let data = {};
    let callback = third;
    if (typeof first === 'string') {
      const source = second && typeof second === 'object' ? second : {};
      data.FormEngineKey = first;
      if (rowModelMode) {
        data._RowModel = {};
        Object.keys(source).forEach((key) => {
          if (key === 'Id') data.Id = source[key];
          else data._RowModel[key] = source[key];
        });
      } else {
        data = { ...data, ...source };
      }
      if (typeof second === 'function') callback = second;
    } else {
      data = first && typeof first === 'object' ? { ...first } : {};
      callback = typeof second === 'function' ? second : third;
    }
    if (config.osClient && data.OsClient === undefined) data.OsClient = config.osClient;
    return { data, callback };
  }

  async function legacyPost(url, data = {}, callback, option = {}) {
    const body = await request({
      url,
      data: data || {},
      method: option.Method || 'POST',
      headers: option.Header || option.Headers || {},
      apiEngine: !!option.IsApiEngine,
      auth: option.Auth !== false,
      timeout: option.Timeout,
      checkCode: false,
      silentError: option.SilentError === true
    });
    const result = body && typeof body === 'object' ? { ...body, Headers: body.Headers || {} } : body;
    if (typeof callback === 'function') callback(result, result && result.Headers);
    return result;
  }

  async function legacyGet(url, data = {}, callback, option = {}) {
    const body = await request({
      url,
      data: data || {},
      method: 'GET',
      headers: option.Header || option.Headers || {},
      apiEngine: !!option.IsApiEngine,
      auth: option.Auth !== false,
      timeout: option.Timeout,
      responseType: option.ResponseType,
      checkCode: false,
      silentError: option.SilentError === true
    });
    const result = option.ResponseType === 'arraybuffer'
      ? { Code: 1, Data: body, Headers: {} }
      : (body && typeof body === 'object' ? { ...body, Headers: body.Headers || {} } : body);
    if (typeof callback === 'function') callback(result, result && result.Headers);
    return result;
  }

  async function legacyRawRequest(param = {}) {
    const method = param.Method || param.method || 'POST';
    const url = param.Url || param.url || param.path || '';
    const data = param.Data || param.Param || param.data || {};
    const body = await request({
      url,
      data,
      method,
      headers: param.Header || param.Headers || param.headers || {},
      apiEngine: !!param.IsApiEngine,
      auth: param.Auth !== false,
      timeout: param.Timeout,
      responseType: param.ResponseType,
      checkCode: false,
      silentError: param.SilentError === true
    });
    return { data: body, headers: body && body.Headers ? body.Headers : {} };
  }

  function legacyOpen(url) {
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.navigateTo === 'function') {
      runtimeUni.navigateTo({ url });
      return;
    }
    if (hasWindow()) window.location.href = url;
  }

  function legacyNavigateTo(url, isVerify) {
    if (isVerify && !legacyIsLogin()) {
      if (config.loginUrl) legacyOpen(config.loginUrl);
      else toast('请登录');
      return;
    }
    legacyOpen(url);
  }

  function legacyGetCurrentUser(refresh, callback) {
    if (refresh) {
      legacyPost('/api/SysUser/getCurrentUser', {}, (result) => {
        if (result && result.Code) legacySetCurrentUser(result.Data || {});
        if (typeof callback === 'function') callback(result);
      });
    }
    return getUser() || deserializeUser(storage.get('CurrentUser')) || {};
  }

  function legacySetCurrentUser(user) {
    setUser(user || {});
    storage.set('CurrentUser', serializeUser(user || {}));
  }

  function legacyGetToken() {
    return getToken() || storage.get('Token') || storage.get('authorization') || '';
  }

  function legacySetToken(token) {
    setToken(token || '');
    storage.set('Token', token || '');
    storage.set('authorization', token || '');
    storage.set('TokenExpires', token ? formatDate(addTime(new Date(), 'm', 15), 'yyyy-MM-dd HH:mm:ss') : '');
    if (!token) legacySetCurrentUser({});
  }

  function legacyIsLogin() {
    const user = legacyGetCurrentUser();
    return !!(legacyGetToken() && user && user.Id);
  }

  function legacyGetUrlQuery(property, pageInstance) {
    let query = null;
    if (pageInstance) {
      query = (pageInstance.$mp && pageInstance.$mp.query) ||
        (pageInstance.$scope && pageInstance.$scope.options) ||
        (pageInstance.$page && pageInstance.$page.options) ||
        (pageInstance.$options && pageInstance.$options.pageQuery) ||
        null;
    }
    if (!query && hasWindow()) {
      query = {};
      const params = new URLSearchParams(window.location.search || '');
      params.forEach((value, key) => { query[key] = value; });
    }
    return property ? (query && query[property]) : query;
  }

  function legacyGetStrLength(value) {
    const text = String(value || '');
    const chinese = text.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g);
    return (chinese ? chinese.length * 2 : 0) + text.length - (chinese ? chinese.length : 0);
  }

  function legacyTips(text, isSuccess = true, timeOrOption = {}) {
    const option = typeof timeOrOption === 'object' ? timeOrOption : { Time: timeOrOption };
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.showToast === 'function') {
      runtimeUni.showToast({
        title: String(text || ''),
        icon: option.Icon || (isSuccess === false ? 'none' : 'success'),
        duration: option.Time || (isSuccess === false ? 2000 : 1000)
      });
      return;
    }
    toast(text);
  }

  function legacyConfirmTips(content, callback, option = {}) {
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.showModal === 'function') {
      runtimeUni.showModal({
        title: option.Title || '提示',
        content: String(content || ''),
        showCancel: option.ShowCancel === false ? false : true,
        confirmColor: option.OKColor || '#5677fc',
        confirmText: option.OKText || '确定',
        success(res) {
          if (res.confirm && typeof callback === 'function') callback(res);
          if (!res.confirm && typeof option.CancelCallback === 'function') option.CancelCallback(res);
        }
      });
      return;
    }
    confirm(content).then((ok) => {
      if (ok && typeof callback === 'function') callback();
      if (!ok && typeof option.CancelCallback === 'function') option.CancelCallback();
    });
  }

  function legacyLoading(title, mask = true) {
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.showLoading === 'function') {
      runtimeUni.showLoading({ title: title || '请稍候...', mask });
    }
  }

  function legacyHideLoading() {
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.hideLoading === 'function') runtimeUni.hideLoading();
  }

  async function legacyUpload(param = {}, callback) {
    if (!param.File && !param.file && !param.filePath) {
      const error = { Code: 0, Msg: '前端参数错误！' };
      if (typeof callback === 'function') callback(error);
      return error;
    }
    try {
      legacyLoading('上传中...');
      const result = await uploadFile(param.File || param.filePath || param.file, {
        file: param.FileObject || param.fileObject || param.file,
        fileName: param.FileName || param.fileName,
        path: param.Path || param.path || 'upload',
        limit: param.Limit,
        preview: param.Preview,
        anonymous: !!param._Anonymous,
        name: param.Name || param.name || 'file',
        formData: param
      });
      if (typeof callback === 'function') callback(result);
      return result;
    } catch (error) {
      const result = error && error.Code !== undefined ? error : { Code: 0, Data: error, Msg: error && error.message ? error.message : '上传失败' };
      if (typeof callback === 'function') callback(result);
      return result;
    } finally {
      legacyHideLoading();
    }
  }

  function base64ToBlob(dataURI) {
    const byteString = atob(String(dataURI).split(',')[1] || '');
    const mimeString = String(dataURI).split(',')[0].split(':')[1].split(';')[0];
    const buffer = new ArrayBuffer(byteString.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < byteString.length; i += 1) view[i] = byteString.charCodeAt(i);
    return new Blob([buffer], { type: mimeString });
  }

  function base64ToFile(dataurl, filename = 'file') {
    const blob = base64ToBlob(dataurl);
    if (typeof File !== 'undefined') return new File([blob], filename, { type: blob.type });
    blob.name = filename;
    return blob;
  }

  function legacyDownload(url, option = {}, callback) {
    const runtimeUni = getUni();
    if (runtimeUni && typeof runtimeUni.downloadFile === 'function') {
      legacyLoading('下载中...');
      return new Promise((resolve) => {
        runtimeUni.downloadFile({
          url,
          ...(option || {}),
          success(res) {
            const result = { Code: res.statusCode === 200 ? 1 : 0, Data: res, Msg: res.errMsg || '' };
            if (typeof callback === 'function') callback(result);
            resolve(result);
          },
          fail(err) {
            const result = { Code: 0, Data: err, Msg: err.errMsg || '下载失败' };
            if (typeof callback === 'function') callback(result);
            resolve(result);
          },
          complete() {
            legacyHideLoading();
          }
        });
      });
    }
    return legacyGet(url, {}, callback, option);
  }

  function install(app, options = {}) {
    if (Object.keys(options).length) configure(options);
    if (!app || !app.config) return client;
    app.config.globalProperties.$V8 = client;
    app.config.globalProperties.$Microi = client;
    app.config.globalProperties.V8 = client;
    if (typeof app.provide === 'function') app.provide('MicroiV8', client);
    return client;
  }

  // 现代接口：新项目优先使用这些小写方法和命名空间。
  const client = {
    get config() {
      return config;
    },
    storage,
    configure,
    install,
    request,
    get,
    post,
    toast,
    confirm,
    getToken,
    setToken,
    clearToken,
    removeToken: clearToken,
    getUser,
    setUser,
    setCurrentUser: setUser,
    getCurrentUser: getUser,
    assetUrl,
    sanitizeAssetUrl: assetUrl,
    resolveAssetUrl: assetUrl,
    resolveAvatarUrl: resolveFileUrl,
    resolveFileUrl,
    isBlockedAsset,
    extractUploadPath,
    normalizeUploadValue,
    uploadFile,
    getSafeArea,
    formatDate,
    toNumber,
    maskPhone,
    formatCompactNumber,
    ApiEngine: {
      Run: apiEngineRun,
      RunLegacy: apiEngineRunLegacy
    },
    FormEngine: {
      Request: formEngineRequest,
      GetTableData: (table, data, options) => formEngineRequest('gettabledata', table, data, options),
      GetFormData: (table, data, options) => formEngineRequest('getformdata', table, data, options),
      GetTableDataTree: (table, data, options) => formEngineRequest('gettabledatatree', table, data, options),
      AddFormData: (table, data, options) => formEngineRequest('addformdata', table, data, options),
      UptFormData: (table, data, options) => formEngineRequest('uptformdata', table, data, options),
      DelFormData: (table, data, options) => formEngineRequest('delformdata', table, data, options),
      GetTableDataAnonymous: (table, data, options) => formEngineAnonymous('GetTableDataAnonymous', table, data, options),
      GetFormDataAnonymous: (table, data, options) => formEngineAnonymous('GetFormDataAnonymous', table, data, options),
      GetTableDataTreeAnonymous: (table, data, options) => formEngineAnonymous('GetTableDataTreeAnonymous', table, data, options)
    }
  };

  // 旧版前端 V8 依赖的后端接口路径，保留原名称以减少迁移成本。
  const legacyApi = {
    MicroiInit: '/apiengine/microi-init',
    GetSysConfig: '/api/DiyTable/getSysConfig',
    Login: '/api/SysUser/login',
    AddFormData: '/api/FormEngine/addFormData',
    AddFormDataBatch: '/api/FormEngine/addFormDataBatch',
    DelFormData: '/api/FormEngine/delFormData',
    DelFormDataBatch: '/api/FormEngine/delFormDataBatch',
    DelFormDataByWhere: '/api/FormEngine/delFormDataByWhere',
    UptFormData: '/api/FormEngine/uptFormData',
    UptFormDataBatch: '/api/FormEngine/uptFormDataBatch',
    UptFormDataByWhere: '/api/FormEngine/uptFormDataByWhere',
    GetFormData: '/api/FormEngine/getFormData',
    GetFormDataAnonymous: '/api/FormEngine/getFormDataAnonymous',
    GetTableData: '/api/FormEngine/getTableData',
    GetTableDataAnonymous: '/api/FormEngine/GetTableDataAnonymous',
    GetTableDataTree: '/api/FormEngine/getTableDataTree',
    GetTableDataTreeAnonymous: '/api/FormEngine/getTableDataTreeAnonymous',
    ApiEngineRun: '/api/ApiEngine/run',
    ModuleEngineRun: '/api/ModuleEngine/run',
    RefreshToken: '/api/SysUser/refreshToken',
    RefreshLoginUser: '/api/SysUser/refreshLoginUser',
    Upload: '/api/HDFS/Upload',
    UploadAnonymous: '/api/HDFS/uploadAnonymous',
    UniappUpload: '/api/HDFS/UniappUpload',
    UniappUploadAnonymous: '/api/HDFS/uniappUploadAnonymous',
    GetCurrentUser: '/api/SysUser/getCurrentUser',
    GetDateTimeNow: '/api/os/getDateTimeNow',
    AddSysLog: '/api/SysLog/addSysLog',
    GetOsClientByDomain: '/api/Os/getOsClientByDomain',
    ApiEngine: {}
  };

  // 旧版接口：尽量保持历史项目里的调用名、字段名和回调形态。
  Object.assign(client, {
    Store: null,
    IDE: getUni() ? 'UniApp' : 'PCVue3',
    AppLogo: '',
    AppKey: '',
    H5Url: config.webBase || '',
    DateTimeNow: new Date(),
    ClientType: getUni() ? 'H5' : 'Web',
    ClientSystem: '',
    PageUrlLogin: config.loginUrl || '',
    PageSizes: [10, 20, 50, 100],
    SysConfig: {},
    SafeArea: getSafeArea(),
    Api: legacyApi,
    Extend: {
      Open: legacyOpen,
      DateTimeFormat: formatDate,
      DateDiff: diffTime,
      Add0(value, length) {
        return String(value || '').padStart(Number(length || 0), '0');
      }
    },
    Window: {},
    Form: {},
    IsNull(value) {
      return value === null || value === undefined || value === '' || value === 'undefined' || value === 'null';
    },
    IsNotNull(value) {
      return !client.IsNull(value);
    },
    FormSet(fieldName, value) {
      client.Form[fieldName] = value;
    },
    Run(v8Code) {
      return Function('V8', `"use strict"; return (async function(){${v8Code || ''}\n}).call(V8);`)(client);
    },
    Open: legacyOpen,
    GetFileServerUrl: assetUrl,
    GetStorageSync: storage.get,
    SetStorageSync: storage.set,
    GetOsClientByDomain: async function getOsClientByDomain(getCache) {
      const cached = getCache ? storage.get('OsClient') : '';
      if (cached) {
        configure({ osClient: cached });
        return { Code: 1, Data: { OsClient: cached } };
      }
      const domain = hasWindow() ? window.location.host.toLowerCase() : '';
      const result = await legacyPost(legacyApi.GetOsClientByDomain, { Domain: domain }, null, { SilentError: true });
      if (result && result.Code === 1 && result.Data && result.Data.OsClient) {
        configure({ osClient: result.Data.OsClient });
        storage.set('OsClient', result.Data.OsClient);
      }
      return result;
    },
    GetSysConfig: async function getSysConfig(refresh) {
      if (!refresh) {
        const cached = storage.get('SysConfig');
        if (cached) return parseMaybeJson(cached, {});
      }
      const result = await legacyPost(legacyApi.GetSysConfig, {
        OsClient: config.osClient,
        _SearchEqual: { IsEnable: 1 }
      }, null, { SilentError: true });
      if (result && result.Code === 1) {
        const model = result.Data || {};
        client.SysConfig = model;
        if (model.FileServer) configure({ fileServer: model.FileServer });
        if (model.H5Url) client.H5Url = model.H5Url;
        if (model.AppLogo) client.AppLogo = model.AppLogo;
        storage.set('SysConfig', JSON.stringify(model));
        return model;
      }
      return null;
    },
    GetSysConfigSync() {
      return client.SysConfig && Object.keys(client.SysConfig).length
        ? client.SysConfig
        : parseMaybeJson(storage.get('SysConfig'), {});
    },
    SetSysConfig(sysConfig) {
      const model = typeof sysConfig === 'string' ? parseMaybeJson(sysConfig, {}) : (sysConfig || {});
      client.SysConfig = model;
      storage.set('SysConfig', JSON.stringify(model));
    },
    InitDateTimeTimer: null,
    InitDateTimeNow() {
      return legacyPost(legacyApi.GetDateTimeNow, {}, (result) => {
        if (result && result.Code) {
          client.DateTimeNow = new Date(result.Data);
          if (client.InitDateTimeTimer) clearInterval(client.InitDateTimeTimer);
          client.InitDateTimeTimer = setInterval(() => {
            client.DateTimeNow = addTime(client.DateTimeNow, 's', 1);
          }, 1000);
        }
      });
    },
    RefreshLoginUser: async function refreshLoginUser() {
      const result = await legacyPost(legacyApi.RefreshLoginUser, {});
      if (result && result.Code) legacySetCurrentUser(result.Data || {});
      return result;
    },
    RefreshToken: async function refreshToken(callback) {
      const token = legacyGetToken();
      if (!token) return { Code: 0, Msg: 'Token 为空。' };
      const result = await legacyPost(legacyApi.RefreshToken, { authorization: token });
      if (result && result.Code) legacySetCurrentUser(result.Data || {});
      if (typeof callback === 'function') callback(result);
      return result;
    },
    ArrayBufferToBase64(arrayBuffer) {
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      if (typeof btoa === 'function') return btoa(binary);
      return binary;
    },
    GetCurrentUser: legacyGetCurrentUser,
    SetCurrentUser: legacySetCurrentUser,
    GetToken: legacyGetToken,
    SetToken: legacySetToken,
    Login(param) {
      return legacyPost(legacyApi.Login, param, (result) => {
        if (result && result.Code) legacySetCurrentUser(result.Data || {});
      }, { DataType: 'form' });
    },
    Logout() {
      legacySetToken('');
    },
    Tips: legacyTips,
    Msg: legacyTips,
    GetStrLength: legacyGetStrLength,
    ConfirmTips: legacyConfirmTips,
    IsAndroid() {
      return String(getSafeArea().platform || '').toLowerCase() === 'android';
    },
    IsPhoneX() {
      const area = getSafeArea();
      return area.bottom > 0;
    },
    Loading: legacyLoading,
    ShowLoading: legacyLoading,
    HideLoading: legacyHideLoading,
    Post: legacyPost,
    PostAsync: legacyPost,
    Get: legacyGet,
    PostAll(allParams = [], callback) {
      return withCallback(Promise.all(allParams.map((item) => legacyPost(item.Url || item.url, item.Data || item.Param || item.data || {}, null, item))), callback);
    },
    request(options = {}) {
      if (options && (options.Url || options.Data || options.Method || options.Param)) return legacyRawRequest(options);
      return request(options);
    },
    GetClientType() {
      return getUni() ? 'H5' : 'Web';
    },
    GetClientSystem() {
      return getSafeArea().platform || '';
    },
    AddSysLog(param) {
      return legacyPost(legacyApi.AddSysLog, param || {}, null, { DataType: 'form', SilentError: true });
    },
    CheckResult(result) {
      if (!result || typeof result !== 'object') return false;
      if (result.Code !== 1) {
        legacyTips(result.Msg || '操作失败', false, 3000);
        return false;
      }
      return true;
    },
    IsLogin: legacyIsLogin,
    NavigateTo: legacyNavigateTo,
    RouterPush: legacyNavigateTo,
    Upload: legacyUpload,
    UploadAnonymous(param, callback) {
      return legacyUpload({ ...(param || {}), _Anonymous: true }, callback);
    },
    Download: legacyDownload,
    DownloadFile: legacyDownload,
    ImgBase64ToFile: base64ToFile,
    ImgBase63ToBlob: base64ToBlob,
    HidePhone: maskPhone,
    ImgExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
    IsImg(link = '') {
      const clean = String(link || '').split('?')[0].toLowerCase();
      return client.ImgExtensions.some((ext) => clean.endsWith(ext));
    },
    NavigateToMiniProgram(appId, path, param, callback) {
      const runtimeUni = getUni();
      if (runtimeUni && typeof runtimeUni.navigateToMiniProgram === 'function') {
        runtimeUni.navigateToMiniProgram({
          appId,
          path,
          extraData: param,
          success: (res) => callback && callback({ Code: 1, Data: res }),
          fail: (err) => callback && callback({ Code: 0, Data: err, Msg: err.errMsg })
        });
      }
    },
    GetUrlQuery: legacyGetUrlQuery,
    GetCountStr(count) {
      return formatCompactNumber(count, Number(count) < 100000 ? 2 : 1);
    }
  });

  // 这些属性在旧项目中常被直接赋值，因此保留取值器和赋值器同步到 config。
  Object.defineProperties(client, {
    ApiBase: {
      get: () => config.apiBase,
      set: (value) => configure({ apiBase: value })
    },
    OsClient: {
      get: () => config.osClient,
      set: (value) => configure({ osClient: value })
    },
    FileServer: {
      get: () => config.fileServer,
      set: (value) => configure({ fileServer: value })
    }
  });

  // 新旧两套接口引擎调用方式并存：字符串 key 走新路由，对象参数兼容旧路由。
  Object.assign(client.ApiEngine, {
    Run(urlOrKey, dataOrCallback, callback) {
      if (typeof urlOrKey === 'string') {
        const data = dataOrCallback && typeof dataOrCallback === 'object' ? dataOrCallback : {};
        const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;
        return withCallback(apiEngineRun(urlOrKey, data, { checkCode: false }), cb);
      }
      const param = urlOrKey || {};
      const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;
      const key = param.ApiEngineKey || param.apiEngineKey;
      return withCallback(key ? apiEngineRun(key, param, { checkCode: false }) : apiEngineRunLegacy('', param, { checkCode: false }), cb);
    },
    RunDirect: apiEngineRun,
    RunLegacy: apiEngineRunLegacy
  });

  // 模块引擎和表单引擎沿用旧版命名，内部统一走 legacyPost。
  client.ModuleEngine = {
    Run(moduleKeyOrParam, dataOrCallback, callback) {
      const data = typeof moduleKeyOrParam === 'string'
        ? { ModuleEngineKey: moduleKeyOrParam, ...(dataOrCallback || {}) }
        : (moduleKeyOrParam || {});
      const cb = typeof dataOrCallback === 'function' ? dataOrCallback : callback;
      return withCallback(legacyPost(legacyApi.ModuleEngineRun, data), cb);
    }
  };

  Object.assign(client.FormEngine, {
    AddFormData(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, true);
      return withCallback(legacyPost(legacyApi.AddFormData, data), callback);
    },
    AddFormDataBatch(param, callback) {
      return withCallback(legacyPost(legacyApi.AddFormDataBatch, param || {}), callback);
    },
    AddTableData(param, callback) {
      return withCallback(legacyPost(legacyApi.AddFormDataBatch, param || {}), callback);
    },
    DelFormData(param, callback) {
      return withCallback(legacyPost(legacyApi.DelFormData, param || {}), callback);
    },
    DelFormDataBatch(param, callback) {
      return withCallback(legacyPost(legacyApi.DelFormDataBatch, param || {}), callback);
    },
    DelFormDataByWhere(param, callback) {
      return withCallback(legacyPost(legacyApi.DelFormDataByWhere, param || {}), callback);
    },
    UptFormData(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, true);
      return withCallback(legacyPost(legacyApi.UptFormData, data), callback);
    },
    UptFormDataByWhere(param, callback) {
      return withCallback(legacyPost(legacyApi.UptFormDataByWhere, param || {}), callback);
    },
    UptFormDataBatch(param, callback) {
      return withCallback(legacyPost(legacyApi.UptFormDataBatch, param || {}), callback);
    },
    UptTableData(param, callback) {
      return withCallback(legacyPost(legacyApi.UptFormDataBatch, param || {}), callback);
    },
    GetFormData(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(`${legacyApi.GetFormData}-${data.FormEngineKey || ''}`, data), callback);
    },
    GetFormDataAnonymous(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(legacyApi.GetFormDataAnonymous, data, null, { Auth: false }), callback);
    },
    GetTableData(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(legacyApi.GetTableData, data), callback);
    },
    GetTableDataAnonymous(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(legacyApi.GetTableDataAnonymous, data, null, { Auth: false }), callback);
    },
    GetTableDataTree(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(legacyApi.GetTableDataTree, data), callback);
    },
    GetTableDataTreeAnonymous(first, second, third) {
      const { data, callback } = normalizeLegacyFormArgs(first, second, third, false);
      return withCallback(legacyPost(legacyApi.GetTableDataTreeAnonymous, data, null, { Auth: false }), callback);
    }
  });

  installDatePrototypeCompat();
  return client;
}

export const V8 = createMicroiV8();
export const MicroiV8 = V8;
export const installMicroiV8 = (app, options = {}) => V8.install(app, options);

export default V8;
