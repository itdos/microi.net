/*
 * Microi AI Application authentication bridge.
 *
 * Anonymous users may browse an application's UI and read-only demo state.
 * A persistent app_* operation opens the shared Microi login dialog, then
 * retries the request with the authenticated token. Server-side ApiEngine
 * remains the authority for write detection and UserId isolation.
 */
import V8 from './microi.v8.js';
import JSEncrypt from '../Microi.Client/node_modules/jsencrypt/bin/jsencrypt.min.js';

const nativeFetch = typeof window !== 'undefined' && window.fetch
  ? window.fetch.bind(window)
  : null;
const NativeXHR = typeof window !== 'undefined' ? window.XMLHttpRequest : null;
const AUTH_CODES = new Set([401, -1, 1001, 1002]);
// Stop before Microi's `--OsClient--tenant--` suffix. Interface-engine keys
// created for AI applications use the shared app_ prefix and underscore words.
const APP_ENGINE_PATH = /\/apiengine\/(app_[a-z0-9_]+)/i;
// This is intentionally a positive write list. A naming heuristic must never
// block an anonymous first screen merely because a read-only engine uses a
// domain verb such as `calculate`, `convert`, `trend` or `status`. Unknown
// operations are sent anonymously first; the server-side user guard remains
// authoritative and returns Code=1001 for a persistent write, at which point
// the bridge opens the login dialog and retries once.
const WRITE_ENGINE_KEY = /(?:^|_)(accept|ack|activate|add|adjust|allocate|append|apply|approve|archive|arrive|assign|attach|bind|book|cancel|certify|change|checkin|checkout|claim|clear|clock|close|collect|complete|confirm|consume|create|decide|decline|delete|depart|detach|dispatch|drop|end|event|execute|expire|finalize|finish|handover|hide|hold|import|ingest|initialize|insert|invite|issue|join|leave|lock|mark|move|occupy|open|order|pack|pass|pause|pay|pick|post|prepare|process|propose|publish|quarantine|raise|rebuild|receive|recall|reconcile|record|redeem|refund|register|reject|release|remove|reopen|reorder|replace|request|reschedule|reset|resolve|restore|resume|retire|retry|return|reverse|review|revoke|rollback|rotate|run|save|schedule|scrap|seal|seat|send|serve|set|settle|ship|simulate|skip|snapshot|start|submit|suspend|take|toggle|transfer|transition|unassign|update|upt|vacate|verify|vote|watched|withdraw)(?:_|$)/i;
const OSCLIENT_SUFFIX = /--OsClient--[^/]*--$/i;
const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;

let loginPromise = null;
let modal = null;
let sysConfig = {};
let captchaId = '';
let captchaObjectUrl = '';
let lastUserIntentAt = 0;
const USER_INTENT_WINDOW_MS = 30000;

function installUserIntentTracking() {
  if (document.documentElement.dataset.microiAiUserIntentTracking === 'true') return;
  document.documentElement.dataset.microiAiUserIntentTracking = 'true';
  const mark = event => {
    if (event && event.isTrusted === false) return;
    lastUserIntentAt = Date.now();
  };
  ['pointerdown', 'keydown', 'input', 'change', 'submit'].forEach(type => {
    document.addEventListener(type, mark, true);
  });
}

function hasRecentUserIntent() {
  const active = typeof navigator !== 'undefined' && navigator.userActivation
    ? navigator.userActivation.isActive
    : false;
  return active || Date.now() - lastUserIntentAt <= USER_INTENT_WINDOW_MS;
}

function flag(value) {
  if (value === true || value === 1) return true;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function normalizeBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function contextValue() {
  let microData = {};
  try {
    microData = window.microApp && typeof window.microApp.getData === 'function'
      ? (window.microApp.getData() || {})
      : {};
  } catch (error) {}
  return { ...window.__MICROI_APP_CONTEXT__, ...microData };
}

function runtime() {
  const query = new URLSearchParams(window.location.search);
  const context = contextValue();
  let apiBase = context.apiBase || context.ApiBase || window.MicroiApiBase
    || query.get('apiBase') || query.get('ApiBase') || '';
  let osClient = context.osClient || context.OsClient || window.MicroiOsClient
    || query.get('OsClient') || query.get('osClient') || '';
  if (!apiBase && /(^|\.)static\.itdos\.com$/i.test(window.location.hostname)) {
    apiBase = 'https://api.itdos.com';
  }
  if (!osClient && /(^|\.)static\.itdos\.com$/i.test(window.location.hostname)) {
    osClient = 'iTdos';
  }
  if (!apiBase) apiBase = window.location.origin;
  if (!osClient) osClient = localStorage.getItem('OsClient') || 'iTdos';
  apiBase = normalizeBase(apiBase);
  window.__MICROI_APP_CONTEXT__ = {
    ...context,
    apiBase,
    ApiBase: apiBase,
    osClient: String(osClient),
    OsClient: String(osClient)
  };
  window.MicroiApiBase = apiBase;
  window.MicroiOsClient = String(osClient);
  document.documentElement.dataset.microiAiAuthReady = 'true';
  document.documentElement.dataset.microiOsClient = String(osClient);
  try {
    // Many generated applications read `window.microApp.getData()` first and
    // use `{}` as the fallback. In a standalone HDFS page that empty object is
    // truthy and masks `__MICROI_APP_CONTEXT__`, so expose the same context
    // through a tiny compatible microApp facade. A real host-provided getData
    // function is preserved and merged with the portable runtime defaults.
    const microApp = window.microApp || (window.microApp = {});
    if (typeof microApp.getData !== 'function') {
      const getData = function () { return { ...(window.__MICROI_APP_CONTEXT__ || {}) }; };
      getData.__microiRuntimeFallback = true;
      microApp.getData = getData;
    } else if (!microApp.getData.__microiRuntimeFallback) {
      const originalGetData = microApp.getData.bind(microApp);
      const getData = function () {
        let current = {};
        try { current = originalGetData() || {}; } catch (error) {}
        return { ...(window.__MICROI_APP_CONTEXT__ || {}), ...current };
      };
      getData.__microiRuntimeFallback = true;
      microApp.getData = getData;
    }
  } catch (error) {}
  V8.configure({
    apiBase,
    osClient: String(osClient),
    clientType: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile' : 'PC'
  });
  return { apiBase, osClient: String(osClient) };
}

function normalizeToken(value) {
  return String(value || '').replace(/^Bearer\s+/i, '').trim();
}

function isAppEngineUrl(value) {
  return APP_ENGINE_PATH.test(String(value || ''));
}

function appEngineKey(value) {
  const match = String(value || '').match(APP_ENGINE_PATH);
  return match ? match[1] : '';
}

function isLikelyWrite(value) {
  const key = appEngineKey(value);
  return Boolean(key) && WRITE_ENGINE_KEY.test(key);
}

function rewriteApiUrl(value) {
  const raw = String(value || '');
  if (!isAppEngineUrl(raw)) return raw;
  try {
    const target = new URL(raw, window.location.href);
    const current = new URL(window.location.href);
    const resolved = runtime();
    target.pathname = target.pathname.replace(OSCLIENT_SUFFIX, '');
    if (target.origin === current.origin && resolved.apiBase !== current.origin) {
      return resolved.apiBase + target.pathname + target.search + target.hash;
    }
    return target.toString();
  } catch (error) {}
  return raw;
}

function setRequestHeaders(headers) {
  const resolved = runtime();
  const next = new Headers(headers || {});
  next.delete('OsClient');
  next.set('osclient', resolved.osClient);
  next.set('did', V8.getDid());
  const token = normalizeToken(V8.getToken());
  if (token) {
    next.set('Token', token);
    next.set('Authorization', `Bearer ${token}`);
  } else {
    next.delete('Token');
    next.delete('Authorization');
  }
  return next;
}

function authenticatedIdentity() {
  const user = V8.getUser() || {};
  const id = String(user.Id || user.id || user.UserId || '').trim();
  const name = String(user.Name || user.name || user.Account || user.account || '').trim();
  return id ? { id, name } : null;
}

function requestIdentity() {
  const authenticated = authenticatedIdentity();
  if (authenticated) return authenticated;
  const deviceId = String(V8.getDid() || 'browser')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 80) || 'browser';
  return { id: `anon_${deviceId}`, name: '访客' };
}

function applyIdentityToObject(value) {
  const identity = requestIdentity();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return {
    ...value,
    ClientKey: identity.id,
    ActorKey: identity.id,
    UserId: identity.id,
    UserName: identity.name
  };
}

function applyIdentityToBody(body, headers) {
  if (!body) return body;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    const identity = requestIdentity();
    const next = new URLSearchParams(body);
    next.set('ClientKey', identity.id);
    next.set('ActorKey', identity.id);
    next.set('UserId', identity.id);
    next.set('UserName', identity.name);
    return next;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const identity = requestIdentity();
    const next = new FormData();
    for (const pair of body.entries()) next.append(pair[0], pair[1]);
    next.set('ClientKey', identity.id);
    next.set('ActorKey', identity.id);
    next.set('UserId', identity.id);
    next.set('UserName', identity.name);
    return next;
  }
  if (typeof body !== 'string') return body;
  const contentType = String(new Headers(headers || {}).get('content-type') || '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return applyIdentityToBody(new URLSearchParams(body), headers).toString();
  }
  if (contentType.includes('application/json') || /^[\s]*[\[{]/.test(body)) {
    try { return JSON.stringify(applyIdentityToObject(JSON.parse(body))); } catch (error) {}
  }
  return body;
}

function bodyAuthExpired(body, status) {
  if (Number(status) === 401 || AUTH_CODES.has(Number(body && body.Code))) return true;
  if (V8.getToken()) return false;
  const message = String(body && (body.Msg || body.Message || body.message) || '');
  return /(?:请先|需要|尚未|未)登录|登录后|没有权限|无权限|身份验证|Token.*(?:失效|缺失)/i.test(message);
}

function bodyAction(body, headers) {
  let value = body;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    value = Object.fromEntries(body.entries());
  } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
    value = Object.fromEntries(body.entries());
  } else if (typeof body === 'string') {
    const contentType = String(new Headers(headers || {}).get('content-type') || '').toLowerCase();
    try {
      value = contentType.includes('application/x-www-form-urlencoded')
        ? Object.fromEntries(new URLSearchParams(body).entries())
        : JSON.parse(body);
    } catch (error) { value = null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return String(value.Action || value.action || value.Command || value.command || value.Operation || value.operation || '');
}

function bodyLikelyWrites(body, headers) {
  const action = bodyAction(body, headers);
  return Boolean(action) && WRITE_ENGINE_KEY.test(`_${action}_`);
}

function registerUrl(path) {
  const local = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  return `${local ? 'http://localhost:2015' : 'https://microi.net'}/${path}`;
}

function injectStyles() {
  if (document.getElementById('microi-ai-auth-style')) return;
  const style = document.createElement('style');
  style.id = 'microi-ai-auth-style';
  style.textContent = `
    .mci-auth-mask{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.52);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}
    .mci-auth-mask[hidden]{display:none!important}
    .mci-auth-card{width:min(420px,100%);background:#fff;border:1px solid rgba(148,163,184,.24);border-radius:20px;box-shadow:0 28px 80px rgba(15,23,42,.28);padding:30px;color:#172033;position:relative}
    .mci-auth-close{position:absolute;right:18px;top:16px;border:0;background:transparent;color:#64748b;font-size:24px;cursor:pointer}
    .mci-auth-brand{display:flex;align-items:center;gap:10px;color:#135ee8;font-weight:800;font-size:15px;letter-spacing:.04em}.mci-auth-logo{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#1769ff,#05a8bf);display:grid;place-items:center;color:#fff;font-size:18px}
    .mci-auth-title{font-size:25px;line-height:1.25;margin:22px 0 6px;font-weight:760}.mci-auth-sub{font-size:14px;color:#64748b;margin:0 0 22px}
    .mci-auth-field{display:block;margin:0 0 14px}.mci-auth-field span{display:block;font-size:13px;font-weight:650;margin:0 0 7px}.mci-auth-field input{box-sizing:border-box;width:100%;height:46px;border:1px solid #dbe3ef;border-radius:11px;padding:0 13px;font-size:15px;outline:0;background:#f8fafc;color:#172033}.mci-auth-field input:focus{border-color:#1769ff;box-shadow:0 0 0 3px rgba(23,105,255,.12);background:#fff}
    .mci-auth-captcha{display:grid;grid-template-columns:1fr 120px;gap:10px}.mci-auth-captcha img{width:120px;height:46px;object-fit:cover;border-radius:10px;border:1px solid #dbe3ef;cursor:pointer}
    .mci-auth-captcha-field[hidden],.mci-auth-privacy[hidden]{display:none!important}
    .mci-auth-privacy{display:flex;gap:8px;align-items:flex-start;color:#64748b;font-size:13px;margin:2px 0 14px}.mci-auth-privacy input{margin-top:2px}.mci-auth-message{min-height:20px;margin:0 0 8px;color:#dc2626;font-size:13px}.mci-auth-submit{width:100%;height:46px;border:0;border-radius:11px;background:linear-gradient(135deg,#1769ff,#0e88d8);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 10px 26px rgba(23,105,255,.25)}.mci-auth-submit:disabled{opacity:.65;cursor:wait}
    .mci-auth-links{display:flex;justify-content:space-between;margin-top:16px;font-size:13px}.mci-auth-links a{color:#1769ff;text-decoration:none}.mci-auth-note{margin:18px 0 0;padding:12px 14px;border-radius:11px;background:#eff6ff;color:#475569;font-size:12px;line-height:1.65}
    @media(prefers-color-scheme:dark){.mci-auth-card{background:#111827;color:#f8fafc;border-color:#334155}.mci-auth-field input{background:#0f172a;border-color:#334155;color:#f8fafc}.mci-auth-sub,.mci-auth-privacy,.mci-auth-note{color:#aab6c8}.mci-auth-note{background:#172554}}
  `;
  document.head.appendChild(style);
}

function ensureModal() {
  if (modal) return modal;
  injectStyles();
  const mask = document.createElement('div');
  mask.className = 'mci-auth-mask';
  mask.hidden = true;
  mask.innerHTML = `
    <form class="mci-auth-card" autocomplete="on">
      <button class="mci-auth-close" type="button" aria-label="关闭">×</button>
      <div class="mci-auth-brand"><span class="mci-auth-logo">M</span><span>Microi 吾码</span></div>
      <h2 class="mci-auth-title">登录后继续操作</h2>
      <p class="mci-auth-sub">应用可以匿名浏览，保存的业务数据将安全归属到您的账号。</p>
      <label class="mci-auth-field"><span>账号</span><input name="account" autocomplete="username" required placeholder="手机号或账号"></label>
      <label class="mci-auth-field"><span>密码</span><input name="password" type="password" autocomplete="current-password" required placeholder="请输入登录密码"></label>
      <label class="mci-auth-field mci-auth-captcha-field" hidden><span>验证码</span><div class="mci-auth-captcha"><input name="captcha" autocomplete="off" placeholder="图形验证码"><img alt="点击刷新验证码"></div></label>
      <label class="mci-auth-privacy" hidden><input name="privacy" type="checkbox"><span></span></label>
      <div class="mci-auth-message" role="alert"></div>
      <button class="mci-auth-submit" type="submit">登录并继续</button>
      <div class="mci-auth-links"><a data-link="register" target="_blank">注册账号</a><a data-link="forgot" target="_blank">忘记密码</a></div>
      <p class="mci-auth-note">登录只在您保存、提交或修改数据时需要；继续浏览不会创建个人数据。</p>
    </form>`;
  document.body.appendChild(mask);
  const form = mask.querySelector('form');
  mask.querySelector('[data-link="register"]').href = registerUrl('register.html');
  mask.querySelector('[data-link="forgot"]').href = registerUrl('login.html#forgot');
  modal = {
    mask,
    form,
    account: form.elements.account,
    password: form.elements.password,
    captcha: form.elements.captcha,
    captchaField: mask.querySelector('.mci-auth-captcha-field'),
    captchaImage: mask.querySelector('.mci-auth-captcha img'),
    privacy: form.elements.privacy,
    privacyLabel: mask.querySelector('.mci-auth-privacy'),
    privacyText: mask.querySelector('.mci-auth-privacy span'),
    message: mask.querySelector('.mci-auth-message'),
    submit: mask.querySelector('.mci-auth-submit'),
    close: mask.querySelector('.mci-auth-close')
  };
  modal.account.value = localStorage.getItem('microi_last_login_account') || '';
  modal.captchaImage.addEventListener('click', () => void loadCaptcha());
  return modal;
}

async function jsonRequest(path, options = {}) {
  if (!nativeFetch) throw new Error('当前浏览器不支持网络请求');
  const resolved = runtime();
  const response = await nativeFetch(resolved.apiBase + path, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (error) { body = { Code: 0, Msg: text || `HTTP ${response.status}` }; }
  return { response, body };
}

async function loadSysConfig() {
  const resolved = runtime();
  const result = await jsonRequest('/api/FormEngine/GetSysConfig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', osclient: resolved.osClient, did: V8.getDid() },
    body: JSON.stringify({ OsClient: resolved.osClient, _SearchEqual: { IsEnable: 1 } })
  });
  if (!result.body || Number(result.body.Code) !== 1) {
    throw new Error((result.body && result.body.Msg) || '系统登录配置加载失败');
  }
  sysConfig = result.body.Data || {};
  return sysConfig;
}

async function loadCaptcha() {
  const view = ensureModal();
  view.captchaField.hidden = true;
  view.captchaImage.removeAttribute('src');
  if (!flag(sysConfig.EnableCaptcha)) {
    captchaId = '';
    return;
  }
  const resolved = runtime();
  const response = await nativeFetch(`${resolved.apiBase}/api/Captcha/GetCaptcha?OsClient=${encodeURIComponent(resolved.osClient)}`, {
    headers: { osclient: resolved.osClient, did: V8.getDid() }
  });
  if (!response.ok) throw new Error('验证码加载失败');
  captchaId = response.headers.get('captchaid') || '';
  if (!captchaId) throw new Error('验证码标识缺失，请刷新后重试');
  const captchaBlob = await response.blob();
  if (!captchaBlob.size) throw new Error('验证码图片为空，请刷新后重试');
  if (captchaObjectUrl) URL.revokeObjectURL(captchaObjectUrl);
  captchaObjectUrl = URL.createObjectURL(captchaBlob);
  await new Promise((resolve, reject) => {
    const done = (callback) => {
      window.clearTimeout(timer);
      view.captchaImage.onload = null;
      view.captchaImage.onerror = null;
      callback();
    };
    const timer = window.setTimeout(() => done(() => reject(new Error('验证码图片加载超时'))), 8000);
    view.captchaImage.onload = () => done(resolve);
    view.captchaImage.onerror = () => done(() => reject(new Error('验证码图片解析失败')));
    view.captchaImage.src = captchaObjectUrl;
  });
  view.captchaField.hidden = false;
}

function encryptPassword(password) {
  const publicKey = window.MicroiLoginPublicKey
    || String(sysConfig.LoginRsaPublicKey || '').replace(/\\n/g, '\n').trim()
    || DEFAULT_PUBLIC_KEY;
  if (!publicKey) return password;
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKey);
  const encrypted = encryptor.encrypt(password);
  if (!encrypted) throw new Error('密码加密失败，请刷新后重试');
  return encrypted;
}

async function performLogin() {
  const view = ensureModal();
  const account = String(view.account.value || '').trim();
  const password = String(view.password.value || '');
  if (!account) throw new Error('请输入账号');
  if (!password) throw new Error('请输入密码');
  if (flag(sysConfig.EnablePrivacyPolicy) && !view.privacy.checked) {
    throw new Error(`请先勾选${sysConfig.PrivacyPolicyName || '同意隐私协议'}`);
  }
  const resolved = runtime();
  const data = new URLSearchParams();
  data.set('Account', account);
  data.set('Pwd', encryptPassword(password));
  data.set('OsClient', resolved.osClient);
  data.set('_ClientType', V8.config.clientType || 'PC');
  if (flag(sysConfig.EnableCaptcha)) {
    data.set('_CaptchaId', captchaId);
    data.set('_CaptchaValue', String(view.captcha.value || '').trim());
  }
  const result = await jsonRequest('/api/SysUser/Login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      osclient: resolved.osClient,
      did: V8.getDid()
    },
    body: data.toString()
  });
  if (!result.body || Number(result.body.Code) !== 1) {
    if (flag(sysConfig.EnableCaptcha)) await loadCaptcha();
    throw new Error((result.body && result.body.Msg) || '登录失败');
  }
  const token = normalizeToken(
    result.response.headers.get('authorization')
      || result.response.headers.get('token')
      || result.body.Token
      || (result.body.Data && (result.body.Data.Token || result.body.Data.Authorization))
  );
  if (!token) throw new Error('登录成功但未收到 Token，请检查服务端登录响应');
  V8.setToken(token);
  V8.setUser(result.body.Data || {});
  localStorage.setItem('microi_last_login_account', account);
  window.dispatchEvent(new CustomEvent('microi:ai-app-login', { detail: result.body.Data || {} }));
  return result.body.Data || {};
}

async function showLogin() {
  if (V8.getToken()) return V8.getUser();
  if (loginPromise) return loginPromise;
  const view = ensureModal();
  document.documentElement.dataset.microiAiAuthState = 'prompt';
  view.mask.hidden = false;
  view.message.textContent = '';
  view.submit.disabled = false;
  view.account.focus();
  loginPromise = new Promise(async (resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      view.form.removeEventListener('submit', submit);
      view.close.removeEventListener('click', cancel);
      view.mask.removeEventListener('click', outside);
    };
    const cancel = () => {
      if (finished) return;
      finished = true;
      cleanup();
      view.mask.hidden = true;
      reject(new Error('已取消登录'));
    };
    const outside = (event) => { if (event.target === view.mask) cancel(); };
    const submit = async (event) => {
      event.preventDefault();
      view.submit.disabled = true;
      view.message.textContent = '';
      try {
        const user = await performLogin();
        finished = true;
        cleanup();
        view.mask.hidden = true;
        resolve(user);
      } catch (error) {
        view.message.textContent = error && error.message ? error.message : String(error);
      } finally {
        view.submit.disabled = false;
      }
    };
    view.form.addEventListener('submit', submit);
    view.close.addEventListener('click', cancel);
    view.mask.addEventListener('click', outside);
    try {
      await loadSysConfig();
      view.privacyLabel.hidden = !flag(sysConfig.EnablePrivacyPolicy);
      view.privacyText.textContent = sysConfig.PrivacyPolicyName || '同意隐私协议';
      await loadCaptcha();
    } catch (error) {
      view.message.textContent = error && error.message ? error.message : String(error);
    }
  }).finally(() => { loginPromise = null; });
  return loginPromise;
}

async function fetchWithAuth(input, init = {}, retried = false) {
  const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  const appRequest = isAppEngineUrl(rawUrl);
  if (!appRequest) return nativeFetch(input, init);
  const writeRequest = isLikelyWrite(rawUrl) || bodyLikelyWrites(init.body, init.headers);
  const promptAllowed = hasRecentUserIntent();
  document.documentElement.dataset.microiLastEngine = appEngineKey(rawUrl) || '';
  document.documentElement.dataset.microiWriteDetected = writeRequest ? 'true' : 'false';
  document.documentElement.dataset.microiHasToken = V8.getToken() ? 'true' : 'false';
  if (!retried && writeRequest && !V8.getToken() && promptAllowed) await showLogin();
  const headers = setRequestHeaders(init.headers || (input && input.headers));
  const target = typeof input === 'string' || input instanceof URL ? rewriteApiUrl(rawUrl) : input;
  const requestBody = applyIdentityToBody(init.body, headers);
  const response = await nativeFetch(target, { ...init, headers, body: requestBody });
  let responseBody = null;
  try { responseBody = await response.clone().json(); } catch (error) {}
  if (!retried && bodyAuthExpired(responseBody, response.status) && promptAllowed) {
    V8.clearToken();
    await showLogin();
    return fetchWithAuth(input, init, true);
  }
  const returnedToken = normalizeToken(response.headers.get('authorization') || response.headers.get('token'));
  if (returnedToken) V8.setToken(returnedToken);
  return response;
}

function installFetchBridge() {
  if (!nativeFetch || window.fetch.__microiAiAuthBridge) return;
  const bridged = function (input, init) { return fetchWithAuth(input, init || {}); };
  bridged.__microiAiAuthBridge = true;
  window.fetch = bridged;
}

function installXhrBridge() {
  if (!NativeXHR || NativeXHR.prototype.__microiAiAuthBridge) return;
  const open = NativeXHR.prototype.open;
  const send = NativeXHR.prototype.send;
  const setRequestHeader = NativeXHR.prototype.setRequestHeader;
  NativeXHR.prototype.open = function (method, url, async, user, password) {
    this.__microiMethod = method;
    this.__microiUrl = String(url || '');
    return open.call(this, method, rewriteApiUrl(url), async === undefined ? true : async, user, password);
  };
  NativeXHR.prototype.send = function (body) {
    if (!isAppEngineUrl(this.__microiUrl)) return send.call(this, body);
    const promptAllowed = hasRecentUserIntent();
    const execute = () => {
      const resolved = runtime();
      setRequestHeader.call(this, 'osclient', resolved.osClient);
      setRequestHeader.call(this, 'did', V8.getDid());
      const token = normalizeToken(V8.getToken());
      if (token) {
        setRequestHeader.call(this, 'Token', token);
        setRequestHeader.call(this, 'Authorization', `Bearer ${token}`);
      }
      this.addEventListener('load', () => {
        try {
          const result = JSON.parse(this.responseText || '{}');
          if (bodyAuthExpired(result, this.status) && promptAllowed) {
            V8.clearToken();
            void showLogin();
          }
        } catch (error) {}
      }, { once: true });
      const requestBody = applyIdentityToBody(body, { 'content-type': this.__microiContentType || '' });
      send.call(this, requestBody);
    };
    if ((isLikelyWrite(this.__microiUrl) || bodyLikelyWrites(body, { 'content-type': this.__microiContentType || '' })) && !V8.getToken() && promptAllowed) {
      void showLogin().then(execute).catch(() => {});
      return;
    }
    execute();
  };
  NativeXHR.prototype.setRequestHeader = function (name, value) {
    const normalized = String(name || '').toLowerCase();
    if (normalized === 'content-type') this.__microiContentType = String(value || '');
    if (normalized === 'osclient') return;
    return setRequestHeader.call(this, name, value);
  };
  NativeXHR.prototype.__microiAiAuthBridge = true;
}

runtime();
installUserIntentTracking();
installFetchBridge();
installXhrBridge();
window.MicroiV8 = window.MicroiV8 || V8;
window.MicroiAiAppAuth = {
  login: showLogin,
  logout() { V8.clearToken(); window.dispatchEvent(new Event('microi:ai-app-logout')); },
  getUser: () => V8.getUser(),
  getToken: () => V8.getToken(),
  runtime
};
