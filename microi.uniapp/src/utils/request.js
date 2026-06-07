import appConfig from '../config.js';
import { createMicroiV8 } from './microi.v8.js';

const TOKEN_KEY = 'microi_token';
const USER_KEY = 'microi_user';

let redirectingToLogin = false;

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
  if (!runtimeUni || typeof runtimeUni.request !== 'function') {
    return Promise.reject(new Error('uni.request is not available in current runtime.'));
  }

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
          url: '/pages/mall/index',
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
  webBase: appConfig.webviewUrl,
  osClient: appConfig.osClient,
  tokenKey: TOKEN_KEY,
  userKey: USER_KEY,
  maxConcurrent: 8,
  appendOsClientQuery: true,
  requestAdapter: uniRequestAdapter,
  onAuthExpired: () => {
    removeToken();
    redirectToLogin();
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
}

export function setUser(user) {
  V8.setUser(user);
}

export function getUser() {
  return V8.getUser();
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
