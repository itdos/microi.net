import appConfig from '../config.js';
import { createMicroiV8 } from './microi.v8.js';
import { shouldPromptAuthExpired } from '../platform/auth-expired-policy.mjs';
import { removeCachePrefix } from '../platform/cache.js';
import { clearRetainedListSessions } from '../platform/list-session.mjs';

const TOKEN_KEY = 'microi_token';
const USER_KEY = 'microi_user';

let redirectingToLogin = false;
let authExpiredPrompting = false;

function getRuntimeUni() {
  try {
    if (typeof uni !== 'undefined' && uni && typeof uni === 'object') return uni;
  } catch (e) {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis.uni) return globalThis.uni;
  } catch (e) {}
  return null;
}

function uniRequestAdapter(options = {}) {
  const runtimeUni = getRuntimeUni();
  if (runtimeUni && typeof runtimeUni.request === 'function') {
    return new Promise((resolve, reject) => {
      runtimeUni.request({
        url: options.url,
        method: options.method || 'POST',
        data: options.data,
        header: options.header || options.headers || {},
        timeout: options.timeout,
        responseType: options.responseType,
        success: resolve,
        fail: reject
      });
    });
  }

  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('No HTTP request adapter is available in current runtime.'));
  }

  const method = String(options.method || 'POST').toUpperCase();
  const headers = { ...(options.header || options.headers || {}) };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = Number(options.timeout || 30000);
  let url = options.url;
  let body;

  if ((method === 'GET' || method === 'HEAD') && options.data && typeof options.data === 'object') {
    const query = new URLSearchParams();
    Object.keys(options.data).forEach((key) => {
      const value = options.data[key];
      if (value !== undefined && value !== null) query.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });
    const queryText = query.toString();
    if (queryText) url += `${url.includes('?') ? '&' : '?'}${queryText}`;
  } else if (options.data !== undefined && options.data !== null) {
    const isRawBody = typeof options.data === 'string' || options.data instanceof ArrayBuffer ||
      (typeof FormData !== 'undefined' && options.data instanceof FormData) ||
      (typeof Blob !== 'undefined' && options.data instanceof Blob);
    body = isRawBody ? options.data : JSON.stringify(options.data);
    if (!isRawBody && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const timer = controller && timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  return fetch(url, { method, headers, body, signal: controller ? controller.signal : undefined })
    .then(async (response) => {
      const responseHeaders = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });
      let data;
      if (options.responseType === 'arraybuffer') {
        data = await response.arrayBuffer();
      } else {
        const text = await response.text();
        try { data = text ? JSON.parse(text) : {}; } catch (error) { data = text; }
      }
      return { data, statusCode: response.status, header: responseHeaders, headers: responseHeaders };
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

function redirectToLogin() {
  if (redirectingToLogin) return;
  redirectingToLogin = true;

  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages && pages.length ? pages[pages.length - 1] : null;
    let redirect = '';

    if (current && current.route) {
      const opts = current.options || {};
      const qs = Object.keys(opts).map((key) => `${key}=${encodeURIComponent(opts[key])}`).join('&');
      redirect = `/${current.route}${qs ? `?${qs}` : ''}`;
    }

    if (current && current.route && current.route.indexOf('pages/login') !== -1) {
      redirectingToLogin = false;
      return;
    }

    const url = `/pages/login/index${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;
    uni.navigateTo({
      url,
      fail: () => {
        uni.switchTab({
          url: '/pages/workspace/index',
          complete: () => {
            redirectingToLogin = false;
          }
        });
      },
      complete: () => {
        setTimeout(() => {
          redirectingToLogin = false;
        }, 800);
      }
    });
  } catch (e) {
    redirectingToLogin = false;
  }
}

export const V8 = createMicroiV8({
  apiBase: appConfig.apiBase,
  fileServer: appConfig.fileServer,
  webBase: '',
  osClient: appConfig.osClient,
  clientType: 'Mobile',
  tokenKey: TOKEN_KEY,
  userKey: USER_KEY,
  maxConcurrent: 8,
  appendOsClientQuery: true,
  requestAdapter: uniRequestAdapter,
  onAuthExpired: (body) => {
    removeToken();
    const runtimeUni = getRuntimeUni();
    const message = body && body.Msg ? String(body.Msg) : '当前登录身份已过期，请重新登录。';
    if (!shouldPromptAuthExpired(body, getCurrentRoute())) {
      authExpiredPrompting = false;
      // 让业务页已经发起的 navigateTo 先完成；届时 redirectToLogin 会识别登录页并退出。
      setTimeout(() => redirectToLogin(), 50);
      return;
    }
    if (!runtimeUni || typeof runtimeUni.showModal !== 'function' || authExpiredPrompting) {
      redirectToLogin();
      return;
    }
    authExpiredPrompting = true;
    runtimeUni.showModal({
      title: '登录身份已失效',
      content: message,
      showCancel: false,
      complete: () => {
        authExpiredPrompting = false;
        redirectToLogin();
      }
    });
  }
});

export function getToken() {
  return V8.getToken();
}

export function setToken(token) {
  V8.setToken(token);
}

export function removeToken() {
  V8.clearToken();
  // 登录用户维度的首页统计属于会话数据，退出或失效后不能继续从本地快照恢复。
  removeCachePrefix('tab:summary:');
  clearRetainedListSessions();
  const runtimeUni = getRuntimeUni();
  if (runtimeUni && typeof runtimeUni.$emit === 'function') {
    runtimeUni.$emit('mci:auth-changed');
    runtimeUni.$emit('xjy-auth-changed');
  }
}

function getCurrentRoute() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages && pages.length ? pages[pages.length - 1] : null;
    return current && current.route ? String(current.route) : '';
  } catch (error) {
    return '';
  }
}

function normalizeCurrentUser(user) {
  if (!user || typeof user !== 'object') return user;
  return user.CurrentUser && typeof user.CurrentUser === 'object'
    ? user.CurrentUser
    : user;
}

export function setUser(user) {
  V8.setUser(normalizeCurrentUser(user));
  const runtimeUni = getRuntimeUni();
  if (runtimeUni && typeof runtimeUni.$emit === 'function') {
    runtimeUni.$emit('mci:auth-changed');
    runtimeUni.$emit('xjy-auth-changed');
  }
}

export function getUser() {
  const user = V8.getUser();
  const currentUser = normalizeCurrentUser(user);
  // 兼容旧版授权登录已缓存的 { CurrentUser, Token, ... } 包装结构。
  if (currentUser && currentUser !== user) V8.setUser(currentUser);
  return currentUser;
}

export async function getVerifiedCurrentUser() {
  const cached = getUser() || {};
  if (cached.Id && (cached.Name || cached.Account)) return cached;
  const result = await post('/api/SysUser/GetCurrentUser', {});
  const refreshed = normalizeCurrentUser(result && result.Data);
  if (!result || Number(result.Code) !== 1 || !refreshed || !refreshed.Id || !(refreshed.Name || refreshed.Account)) {
    throw new Error((result && result.Msg) || '当前登录账号信息获取失败，请重新登录后再试');
  }
  setUser(refreshed);
  return refreshed;
}

export function request(options = {}) {
  const {
    url,
    method = 'POST',
    data = {},
    auth = true
  } = options;

  return V8.request({
    url,
    method,
    data,
    auth,
    checkCode: false
  });
}

export function get(url, data = {}, auth = true) {
  return request({ url, method: 'GET', data, auth });
}

export function post(url, data = {}, auth = true) {
  return request({ url, method: 'POST', data, auth });
}
