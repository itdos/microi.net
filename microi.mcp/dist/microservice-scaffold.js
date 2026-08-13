import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const APP_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/u;
const ROUTE_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*)?$/u;
const ROUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/u;
const VUE_VERSION = '3.5.40';
const VITE_VERSION = '7.3.6';
const VITE_PLUGIN_VUE_VERSION = '6.0.8';
const TYPESCRIPT_VERSION = '5.9.3';
const VUE_TSC_VERSION = '3.3.9';
function assertPlainAiApplicationsDirectory(directory) {
    if (!directory || !path.isAbsolute(directory)) {
        throw new Error('AI 应用目录必须是绝对路径。');
    }
    const resolved = path.resolve(directory);
    if (path.basename(resolved) !== 'AI应用') {
        throw new Error(`本地脚手架只能写入名为“AI应用”的目录：${resolved}`);
    }
    const stat = fs.lstatSync(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`AI 应用目录必须是真实目录且不能是符号链接：${resolved}`);
    }
    return fs.realpathSync(resolved);
}
function normalizeBuildVersion(value) {
    const version = String(value || 'v0.1.0').trim();
    if (!VERSION_PATTERN.test(version)) {
        throw new Error(`buildVersion 必须是 v1.2.3 形式：${value}`);
    }
    return version;
}
function toPascalCase(value) {
    const result = value
        .split(/[-_]+/u)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
        .replace(/[^A-Za-z0-9]/gu, '');
    if (!result || !/^[A-Za-z]/u.test(result)) {
        throw new Error(`路由 name 无法生成安全的 Vue 组件名：${value}`);
    }
    return result;
}
function normalizeRoutes(routes) {
    if (!Array.isArray(routes) || routes.length < 1 || routes.length > 50) {
        throw new Error('routes 数量必须在 1 到 50 之间。');
    }
    const pathSet = new Set();
    const nameSet = new Set();
    const sourceFileSet = new Set();
    const explicitHomes = routes.filter(route => route.isHome === true);
    if (explicitHomes.length > 1)
        throw new Error('routes 最多只能有一个 isHome=true。');
    return routes.map((route, index) => {
        const routePath = String(route.path || '').trim();
        const routeName = String(route.name || '').trim();
        const title = String(route.title || '').trim();
        if (!ROUTE_PATH_PATTERN.test(routePath) || routePath.includes('..')) {
            throw new Error(`路由 path 不合法：${route.path}`);
        }
        if (!ROUTE_NAME_PATTERN.test(routeName)) {
            throw new Error(`路由 name 不合法：${route.name}`);
        }
        if (!title || title.length > 100) {
            throw new Error(`路由 title 不能为空且不能超过 100 个字符：${route.title}`);
        }
        const normalizedPathKey = routePath.toLowerCase();
        const normalizedNameKey = routeName.toLowerCase();
        if (pathSet.has(normalizedPathKey))
            throw new Error(`路由 path 重复：${routePath}`);
        if (nameSet.has(normalizedNameKey))
            throw new Error(`路由 name 重复：${routeName}`);
        pathSet.add(normalizedPathKey);
        nameSet.add(normalizedNameKey);
        const sourceFile = `src/pages/${toPascalCase(routeName)}Page.vue`;
        if (sourceFileSet.has(sourceFile.toLowerCase()))
            throw new Error(`路由页面文件名重复：${sourceFile}`);
        sourceFileSet.add(sourceFile.toLowerCase());
        return {
            path: routePath,
            name: routeName,
            title,
            description: String(route.description || '').trim(),
            sourceFile,
            sort: index * 10,
            isHome: explicitHomes.length > 0 ? route.isHome === true : index === 0,
        };
    });
}
function fallbackMicroiSdk() {
    return [
        'function createClient(initial = {}) {',
        '  const readStoredToken = () => { try { return localStorage.getItem("Token") || localStorage.getItem("authorization") || "" } catch { return "" } }',
        '  const storeToken = (token) => { try { localStorage.setItem("Token", token); localStorage.setItem("authorization", token) } catch {} }',
        '  let config = { apiBase: "", osClient: "", token: readStoredToken(), ...(initial || {}) }',
        '  const configure = (next = {}) => { config = { ...config, ...(next || {}) }; return client }',
        '  const getConfig = () => ({ ...config })',
        '  const setToken = (token) => {',
        '    const previousToken = String(config.token || "")',
        '    config.token = String(token || "")',
        '    storeToken(config.token)',
        '    if (config.token !== previousToken && typeof config.onTokenChanged === "function") config.onTokenChanged(config.token, previousToken, client)',
        '    return client',
        '  }',
        '  const clearToken = () => setToken("")',
        '  const getToken = () => String(config.token || readStoredToken())',
        '  async function post(url, data = {}) {',
        '    const target = /^https?:\\/\\//i.test(url) ? url : String(config.apiBase || "").replace(/\\/+$/, "") + "/" + String(url || "").replace(/^\\/+/, "")',
        '    const headers = { "Content-Type": "application/json", osclient: config.osClient || "" }',
        '    const requestToken = getToken()',
        '    if (requestToken) headers.Authorization = "Bearer " + requestToken',
        '    const response = await fetch(target, { method: "POST", headers, body: JSON.stringify(data || {}) })',
        '    const body = await response.json()',
        '    const responseToken = response.headers.get("authorization") || response.headers.get("token") || body?.DataAppend?.Token || body?.Data?.Token || body?.Token || ""',
        '    const normalizedToken = String(responseToken || "").replace(/^Bearer\\s+/i, "")',
        '    if (normalizedToken && (!requestToken || getToken() === requestToken)) setToken(normalizedToken)',
        '    if ([401, -1, 1001, 1002].includes(Number(body?.Code)) && (!requestToken || getToken() === requestToken)) {',
        '      clearToken()',
        '      if (typeof config.onAuthExpired === "function") config.onAuthExpired(body, client)',
        '    }',
        '    return body',
        '  }',
        '  const install = (app) => {',
        '    if (app?.config?.globalProperties) app.config.globalProperties.$V8 = client',
        '    if (typeof app?.provide === "function") app.provide("MicroiV8", client)',
        '    return client',
        '  }',
        '  const client = {',
        '    configure, getConfig, setToken, clearToken, getToken, GetToken: getToken, post, install,',
        '    GetSysConfig: async () => { const result = await post("/api/DiyTable/getSysConfig", { OsClient: config.osClient, _SearchEqual: { IsEnable: 1 } }); return result?.Code === 1 ? (result.Data || {}) : null },',
        '    Login: (data = {}) => post("/api/SysUser/login", { _ClientType: "PC", ...(data || {}) }),',
        '    ApiEngine: { Run: (key, data = {}) => post("/apiengine/" + encodeURIComponent(key), data) },',
        '    FormEngine: { GetTableData: (table, data = {}) => post("/api/FormEngine/GetTableData", { FormEngineKey: table, ...(data || {}) }) },',
        '  }',
        '  return client',
        '}',
        'export function createMicroiV8(options = {}) { return createClient(options) }',
        'export const V8 = createMicroiV8()',
        'export const MicroiV8 = V8',
        'export default V8',
        '',
    ].join('\n');
}
export function resolveMicroiSdkSource(workspaceRoot) {
    const candidates = [
        process.env.MICROI_V8_SDK_PATH,
        workspaceRoot ? path.join(workspaceRoot, 'microi.skills', 'microi.v8.js') : '',
        process.env.MICROI_WORKSPACE_ROOT ? path.join(process.env.MICROI_WORKSPACE_ROOT, 'microi.skills', 'microi.v8.js') : '',
        path.join(process.cwd(), 'microi.skills', 'microi.v8.js'),
    ].filter(Boolean);
    for (const candidate of candidates) {
        try {
            const resolved = path.resolve(candidate);
            const stat = fs.lstatSync(resolved);
            if (stat.isFile() && !stat.isSymbolicLink())
                return fs.readFileSync(resolved, 'utf8');
        }
        catch {
            // Optional SDK discovery falls back to the small compatible client below.
        }
    }
    return undefined;
}
function buildMicroiBridge(options) {
    return [
        "import { createMicroiV8 } from './utils/microi.v8.js'",
        '',
        `const standaloneDefaults = ${JSON.stringify({
            apiBase: options.apiBaseUrl || '',
            osClient: options.osClient || '',
        })} as const`,
        '',
        'export interface MicroiRouteContext {',
        '  microRoute?: string',
        '  microRoutePath?: string',
        '  [key: string]: unknown',
        '}',
        '',
        'export interface MicroiContext {',
        '  apiBase: string',
        '  osClient: string',
        '  token: string',
        '  menuId: string',
        '  menuName: string',
        '  moduleEngineKey: string',
        '  diyTableId: string',
        '  appKey: string',
        '  version: string',
        '  microRoute: string',
        '  route: MicroiRouteContext',
        '}',
        '',
        'type MicroiV8Runtime = ReturnType<typeof createMicroiV8> & {',
        '  GetToken?: () => string',
        '  GetSysConfig?: (refresh?: boolean) => Promise<Record<string, unknown> | null>',
        '  Login?: (payload: Record<string, unknown>) => Promise<{ Code: number; Msg?: string; Data?: unknown }>',
        '}',
        '',
        'function stringValue(value: unknown): string {',
        "  return typeof value === 'string' ? value : ''",
        '}',
        '',
        'function getLocalRoutePath(): string {',
        "  const hashPath = String(window.location.hash || '').replace(/^#/, '').split('?')[0] || ''",
        "  return hashPath.startsWith('/') ? hashPath : ''",
        '}',
        '',
        'export function getMicroiContext(): MicroiContext {',
        '  const data = window.microApp?.getData?.() || {}',
        '  const route = data.route && typeof data.route === \'object\' ? data.route as MicroiRouteContext : {}',
        '  const permission = data.permissionContext && typeof data.permissionContext === \'object\' ? data.permissionContext as Record<string, unknown> : {}',
        '  return {',
        '    apiBase: stringValue(data.apiBase) || standaloneDefaults.apiBase,',
        '    osClient: stringValue(data.osClient) || standaloneDefaults.osClient,',
        '    token: stringValue(data.token),',
        '    menuId: stringValue(data.menuId) || stringValue(permission.sysMenuId),',
        '    menuName: stringValue(data.menuName),',
        '    moduleEngineKey: stringValue(data.moduleEngineKey) || stringValue(permission.moduleEngineKey),',
        '    diyTableId: stringValue(data.diyTableId) || stringValue(permission.diyTableId),',
        '    appKey: stringValue(data.appKey),',
        '    version: stringValue(data.version),',
        "    microRoute: stringValue(data.microRoute) || stringValue(route.microRoute) || stringValue(route.microRoutePath) || (window.microApp ? '' : getLocalRoutePath()),",
        '    route,',
        '  }',
        '}',
        '',
        'export const microiV8 = createMicroiV8() as MicroiV8Runtime',
        "let appliedHostToken = ''",
        '',
        'export function configureMicroiV8(context: MicroiContext = getMicroiContext()) {',
        '  microiV8.configure?.({',
        '    apiBase: context.apiBase,',
        '    osClient: context.osClient,',
        '    onTokenChanged: (token: string, requestToken: string) => {',
        "      window.microApp?.dispatch?.({ type: 'micro-app:token', data: { token, requestToken } })",
        '    },',
        "    onAuthExpired: () => window.dispatchEvent(new CustomEvent('microi:auth-expired')),",
        '  })',
        '  if (context.token && context.token !== appliedHostToken) {',
        '    appliedHostToken = context.token',
        '    microiV8.setToken?.(context.token)',
        '  }',
        '  return microiV8',
        '}',
        '',
    ].join('\n');
}
function buildStandaloneAuthModule() {
    return [
        "import { reactive } from 'vue'",
        "import { configureMicroiV8, microiV8 } from './microi'",
        "import type { MicroiContext } from './microi'",
        '',
        'export function isEnabledFlag(value: unknown): boolean {',
        '  if (value === true || value === 1) return true',
        "  if (typeof value !== 'string') return false",
        "  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())",
        '}',
        '',
        'export function useMicroiAuthentication() {',
        '  const state = reactive({',
        "    account: '', password: '', captchaId: '', captchaValue: '', captchaImage: '',",
        "    captchaEnabled: false, loading: true, authenticated: false, error: '',",
        '  })',
        '',
        '  function revokeCaptcha() {',
        "    if (state.captchaImage.startsWith('blob:')) URL.revokeObjectURL(state.captchaImage)",
        "    state.captchaImage = ''",
        '  }',
        '',
        '  async function refreshCaptcha(context: MicroiContext) {',
        '    revokeCaptcha()',
        "    state.captchaId = ''",
        "    state.captchaValue = ''",
        '    if (!state.captchaEnabled) return',
        "    const apiBase = String(context.apiBase || '').replace(/\\/+$/, '')",
        "    if (!apiBase || !context.osClient) throw new Error('独立运行缺少 apiBase 或 osClient')",
        "    const url = new URL(apiBase + '/api/Captcha/GetCaptcha')",
        "    url.searchParams.set('OsClient', context.osClient)",
        '    const response = await fetch(url, { headers: { osclient: context.osClient } })',
        "    if (!response.ok) throw new Error('验证码加载失败：HTTP ' + response.status)",
        "    const captchaId = response.headers.get('captchaid') || ''",
        "    if (!captchaId) throw new Error('验证码响应缺少 captchaid')",
        '    state.captchaId = captchaId',
        '    state.captchaImage = URL.createObjectURL(await response.blob())',
        '  }',
        '',
        '  function acceptHostContext(context: MicroiContext) {',
        '    configureMicroiV8(context)',
        '    if (context.token) state.authenticated = true',
        '  }',
        '',
        '  async function initialize(context: MicroiContext) {',
        '    state.loading = true',
        "    state.error = ''",
        '    try {',
        '      acceptHostContext(context)',
        '      if (context.token || microiV8.GetToken?.()) {',
        '        state.authenticated = true',
        '        return',
        '      }',
        '      const sysConfig = await microiV8.GetSysConfig?.(true)',
        "      if (!sysConfig || typeof sysConfig !== 'object') throw new Error('无法读取当前租户系统配置')",
        '      state.captchaEnabled = isEnabledFlag((sysConfig as Record<string, unknown>).EnableCaptcha)',
        '      await refreshCaptcha(context)',
        '      state.authenticated = false',
        '    } catch (error) {',
        "      state.error = error instanceof Error ? error.message : String(error || '初始化登录失败')",
        '      state.authenticated = false',
        '    } finally {',
        '      state.loading = false',
        '    }',
        '  }',
        '',
        '  async function login(context: MicroiContext) {',
        "    if (!state.account.trim() || !state.password) { state.error = '请输入帐号和密码'; return false }",
        "    if (state.captchaEnabled && (!state.captchaId || !state.captchaValue.trim())) { state.error = '请输入验证码'; return false }",
        '    state.loading = true',
        "    state.error = ''",
        '    try {',
        '      configureMicroiV8(context)',
        '      const payload: Record<string, unknown> = {',
        "        Account: state.account.trim(), Pwd: state.password, _ClientType: 'PC',",
        '      }',
        '      if (state.captchaEnabled) {',
        '        payload._CaptchaId = state.captchaId',
        '        payload._CaptchaValue = state.captchaValue.trim()',
        '      }',
        '      const result = await microiV8.Login?.(payload)',
        "      if (!result || result.Code !== 1) throw new Error(result?.Msg || '登录失败')",
        "      if (!microiV8.GetToken?.()) throw new Error('登录成功响应缺少 Token')",
        '      state.authenticated = true',
        "      state.password = ''",
        '      revokeCaptcha()',
        '      return true',
        '    } catch (error) {',
        "      state.error = error instanceof Error ? error.message : String(error || '登录失败')",
        '      if (state.captchaEnabled) await refreshCaptcha(context).catch(() => undefined)',
        '      return false',
        '    } finally {',
        '      state.loading = false',
        '    }',
        '  }',
        '',
        '  async function expire(context: MicroiContext) {',
        '    state.authenticated = false',
        "    state.error = '登录已失效，请重新登录'",
        '    await initialize(context)',
        '  }',
        '',
        '  return { state, initialize, login, refreshCaptcha, acceptHostContext, expire, revokeCaptcha }',
        '}',
        '',
    ].join('\n');
}
function buildRoutesModule(routes) {
    const imports = routes.map((route, index) => `import RoutePage${index + 1} from './pages/${path.basename(route.sourceFile)}'`);
    const rows = routes.map((route, index) => `  { path: ${JSON.stringify(route.path)}, name: ${JSON.stringify(route.name)}, title: ${JSON.stringify(route.title)}, isHome: ${route.isHome}, component: RoutePage${index + 1} },`);
    return [
        "import type { Component } from 'vue'",
        ...imports,
        '',
        'export interface MicroServiceRoute {',
        '  path: string',
        '  name: string',
        '  title: string',
        '  isHome: boolean',
        '  component: Component',
        '}',
        '',
        'export const routes: readonly MicroServiceRoute[] = [',
        ...rows,
        ']',
        '',
        'export function normalizeRoutePath(value: unknown): string {',
        "  const routePath = String(value || '').trim()",
        "  return routePath ? (routePath.startsWith('/') ? routePath : '/' + routePath) : routes.find(route => route.isHome)?.path || routes[0]!.path",
        '}',
        '',
        'export function findRoute(value: unknown): MicroServiceRoute {',
        '  const normalized = normalizeRoutePath(value)',
        '  return routes.find(route => route.path === normalized) || routes.find(route => route.isHome) || routes[0]!',
        '}',
        '',
    ].join('\n');
}
function buildAppVue(name) {
    return [
        '<template>',
        '  <main class="mci-page" data-testid="microservice-root">',
        '    <section v-if="auth.loading && !auth.authenticated" class="mci-auth-state" aria-live="polite">',
        '      <span class="mci-auth-spinner" aria-hidden="true"></span>',
        '      <div><strong>正在连接吾码平台</strong><p>正在读取租户配置与登录状态…</p></div>',
        '    </section>',
        '',
        '    <form v-else-if="!auth.authenticated" class="mci-auth-card" data-testid="standalone-login" @submit.prevent="signIn">',
        '      <div class="mci-auth-brand"><span>MICROI</span><h1>{{ applicationName }}</h1><p>使用当前吾码平台帐号登录</p></div>',
        '      <label><span>帐号</span><input v-model="auth.account" name="account" autocomplete="username" placeholder="请输入帐号" /></label>',
        '      <label><span>密码</span><input v-model="auth.password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>',
        '      <label v-if="auth.captchaEnabled"><span>验证码</span><div class="mci-captcha-row"><input v-model="auth.captchaValue" name="captcha" autocomplete="off" placeholder="请输入验证码" /><button type="button" class="mci-captcha" title="刷新验证码" @click="refreshCaptcha"><img v-if="auth.captchaImage" :src="auth.captchaImage" alt="验证码，点击刷新" /><span v-else>刷新</span></button></div></label>',
        '      <p v-if="auth.error" class="mci-auth-error" role="alert">{{ auth.error }}</p>',
        '      <div class="mci-auth-actions"><button type="submit" class="primary" :disabled="auth.loading">{{ auth.loading ? \'登录中…\' : \'登录并进入\' }}</button><button type="button" @click="retryAuth">重新读取配置</button></div>',
        '      <p class="mci-auth-tip">嵌入吾码菜单或 V8.OpenAppDialog 时会安全复用宿主登录态；独立访问时才显示此登录页。</p>',
        '    </form>',
        '',
        '    <template v-else>',
        '      <header class="mci-header">',
        '        <div>',
        '          <p class="mci-eyebrow">MCP · AI 应用 · Vue 3</p>',
        '          <h1>{{ applicationName }}</h1>',
        '          <p class="mci-subtitle">同一微服务通过菜单上下文切换内部页面路由</p>',
        '        </div>',
        '        <span class="mci-status" :class="{ online: embedded }">{{ embedded ? \'MicroApp 已连接\' : \'独立运行\' }}</span>',
        '      </header>',
        '',
        '      <nav class="mci-tabs" aria-label="微服务页面">',
        '        <button v-for="item in routes" :key="item.path" type="button" :class="{ active: activeRoute.path === item.path }" @click="setLocalRoute(item.path)">{{ item.title }}</button>',
        '      </nav>',
        '',
        '      <component :is="activeRoute.component" :context="context" :route="activeRoute" />',
        '    </template>',
        '  </main>',
        '</template>',
        '',
        '<script setup lang="ts">',
        "import { computed, onMounted, onUnmounted, ref } from 'vue'",
        "import { useMicroiAuthentication } from './auth'",
        "import { configureMicroiV8, getMicroiContext } from './microi'",
        "import type { MicroiContext } from './microi'",
        "import { findRoute, normalizeRoutePath, routes } from './routes'",
        '',
        `const applicationName = ${JSON.stringify(name)}`,
        'const context = ref<MicroiContext>(getMicroiContext())',
        'const authFlow = useMicroiAuthentication()',
        'const auth = authFlow.state',
        "const localRoute = ref(context.value.microRoute || routes.find(item => item.isHome)?.path || routes[0]!.path)",
        'const activeRoute = computed(() => findRoute(localRoute.value))',
        'const embedded = computed(() => Boolean(window.microApp))',
        'let removeListener: (() => void) | null = null',
        'let removeHashListener: (() => void) | null = null',
        '',
        'function refreshContext(data?: Record<string, unknown>) {',
        '  context.value = { ...getMicroiContext(), ...(data || {}) } as MicroiContext',
        '  localRoute.value = normalizeRoutePath(context.value.microRoute || context.value.route?.microRoute || context.value.route?.microRoutePath || localRoute.value)',
        '  configureMicroiV8(context.value)',
        '  authFlow.acceptHostContext(context.value)',
        '}',
        '',
        'function setLocalRoute(routePath: string) {',
        '  const normalized = normalizeRoutePath(routePath)',
        '  localRoute.value = normalized',
        "  if (!window.microApp && window.location.hash !== '#' + normalized) window.location.hash = normalized",
        '}',
        '',
        'async function signIn() { await authFlow.login(context.value) }',
        'async function retryAuth() { await authFlow.initialize(context.value) }',
        'async function refreshCaptcha() { await authFlow.refreshCaptcha(context.value).catch(error => { auth.error = error instanceof Error ? error.message : String(error) }) }',
        'const handleAuthExpired = () => { void authFlow.expire(context.value) }',
        '',
        'onMounted(async () => {',
        '  refreshContext()',
        '  if (window.microApp?.addDataListener) {',
        '    window.microApp.addDataListener(refreshContext, true)',
        '    removeListener = () => window.microApp?.removeDataListener?.(refreshContext)',
        '  } else {',
        '    const handleHashChange = () => { localRoute.value = normalizeRoutePath(getMicroiContext().microRoute || localRoute.value) }',
        "    window.addEventListener('hashchange', handleHashChange)",
        "    removeHashListener = () => window.removeEventListener('hashchange', handleHashChange)",
        '  }',
        "  window.addEventListener('microi:auth-expired', handleAuthExpired)",
        '  await authFlow.initialize(context.value)',
        '})',
        '',
        "onUnmounted(() => { removeListener?.(); removeHashListener?.(); window.removeEventListener('microi:auth-expired', handleAuthExpired); authFlow.revokeCaptcha() })",
        '</script>',
        '',
    ].join('\n');
}
function buildContextPage(description) {
    return [
        '<template>',
        '  <section class="mci-panel" data-testid="page-context">',
        '    <div class="mci-panel-heading">',
        '      <div><p class="mci-kicker">页面一</p><h2>{{ route.title }}</h2></div>',
        '      <span class="mci-chip">上下文握手</span>',
        '    </div>',
        '    <p class="mci-description">{{ pageDescription }}</p>',
        '    <div class="mci-metric-grid">',
        '      <article><span>租户</span><strong>{{ context.osClient || \'本地预览\' }}</strong></article>',
        '      <article><span>应用 Key</span><strong>{{ context.appKey || \'尚未注入\' }}</strong></article>',
        '      <article><span>菜单</span><strong>{{ context.menuName || \'尚未注入\' }}</strong></article>',
        '      <article><span>内部路由</span><strong>{{ route.path }}</strong></article>',
        '    </div>',
        '    <div class="mci-checklist">',
        '      <span class="passed">✓ Vue 组件已渲染</span>',
        '      <span :class="context.appKey ? \'passed\' : \'pending\'">{{ context.appKey ? \'✓ MicroApp 数据已注入\' : \'○ 等待平台注入\' }}</span>',
        '    </div>',
        '  </section>',
        '</template>',
        '',
        '<script setup lang="ts">',
        "import type { MicroiContext } from '../microi'",
        "import type { MicroServiceRoute } from '../routes'",
        '',
        `const pageDescription = ${JSON.stringify(description || '验证宿主菜单、租户、应用 Key 与内部路由能否完整传入 Vue 微服务。')}`,
        'defineProps<{ context: MicroiContext; route: MicroServiceRoute }>()',
        '</script>',
        '',
    ].join('\n');
}
function buildInteractionPage(description) {
    return [
        '<template>',
        '  <section class="mci-panel" data-testid="page-interaction">',
        '    <div class="mci-panel-heading">',
        '      <div><p class="mci-kicker">页面二</p><h2>{{ route.title }}</h2></div>',
        '      <span class="mci-chip">交互与复用</span>',
        '    </div>',
        '    <p class="mci-description">{{ pageDescription }}</p>',
        '    <div class="mci-action-card">',
        '      <div><span>交互计数</span><strong data-testid="counter-value">{{ count }}</strong></div>',
        '      <button type="button" data-testid="counter-button" @click="count += 1">点击验证 Vue 响应</button>',
        '    </div>',
        '    <dl class="mci-details">',
        '      <dt>MenuId</dt><dd>{{ context.menuId || \'尚未注入\' }}</dd>',
        '      <dt>BuildVersion</dt><dd>{{ context.version || \'尚未注入\' }}</dd>',
        '      <dt>RoutePath</dt><dd>{{ route.path }}</dd>',
        '    </dl>',
        '  </section>',
        '</template>',
        '',
        '<script setup lang="ts">',
        "import { ref } from 'vue'",
        "import type { MicroiContext } from '../microi'",
        "import type { MicroServiceRoute } from '../routes'",
        '',
        `const pageDescription = ${JSON.stringify(description || '验证第二个菜单能复用同一份编译产物，并切换到独立 Vue 页面。')}`,
        'const count = ref(0)',
        'defineProps<{ context: MicroiContext; route: MicroServiceRoute }>()',
        '</script>',
        '',
    ].join('\n');
}
function buildGenericPage(description, index) {
    return [
        '<template>',
        `  <section class="mci-panel" data-testid="page-${index + 1}">`,
        '    <div class="mci-panel-heading"><div><p class="mci-kicker">测试页面</p><h2>{{ route.title }}</h2></div></div>',
        '    <p class="mci-description">{{ pageDescription }}</p>',
        '    <dl class="mci-details"><dt>AppKey</dt><dd>{{ context.appKey || \'尚未注入\' }}</dd><dt>RoutePath</dt><dd>{{ route.path }}</dd></dl>',
        '  </section>',
        '</template>',
        '',
        '<script setup lang="ts">',
        "import type { MicroiContext } from '../microi'",
        "import type { MicroServiceRoute } from '../routes'",
        '',
        `const pageDescription = ${JSON.stringify(description || '验证平台微服务内部路由与 Vue 组件映射。')}`,
        'defineProps<{ context: MicroiContext; route: MicroServiceRoute }>()',
        '</script>',
        '',
    ].join('\n');
}
function buildStyles() {
    return [
        ':root {',
        '  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;',
        '  color: #172033;',
        '  background: #f3f6fb;',
        '  font-synthesis: none;',
        '}',
        '* { box-sizing: border-box; }',
        'html, body { min-height: 100%; }',
        'body { margin: 0; min-width: 320px; background: #f3f6fb; }',
        'button { font: inherit; }',
        '.mci-page {',
        '  --mci-primary: #2563eb;',
        '  --mci-primary-soft: #e8f0ff;',
        '  --mci-surface: #ffffff;',
        '  --mci-surface-muted: #f7f9fc;',
        '  --mci-border: #d9e2ef;',
        '  --mci-text: #172033;',
        '  --mci-text-muted: #526176;',
        '  min-height: var(--micro-app-available-height, 100vh);',
        '  padding: clamp(16px, 3vw, 32px);',
        '  color: var(--mci-text);',
        '}',
        '.mci-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 22px; }',
        '.mci-eyebrow, .mci-kicker { margin: 0 0 6px; color: var(--mci-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }',
        '.mci-header h1, .mci-panel h2 { margin: 0; line-height: 1.25; }',
        '.mci-header h1 { font-size: clamp(24px, 4vw, 34px); }',
        '.mci-panel h2 { font-size: 20px; }',
        '.mci-subtitle, .mci-description { color: var(--mci-text-muted); line-height: 1.7; }',
        '.mci-subtitle { margin: 8px 0 0; }',
        '.mci-description { margin: 0 0 20px; }',
        '.mci-status, .mci-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border: 1px solid var(--mci-border); border-radius: 999px; background: var(--mci-surface); color: var(--mci-text-muted); font-size: 12px; white-space: nowrap; }',
        '.mci-status.online { border-color: #86d7af; background: #eaf8f1; color: #17633d; }',
        '.mci-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }',
        '.mci-tabs button, .mci-action-card button { min-height: 44px; border: 1px solid var(--mci-border); border-radius: 10px; padding: 0 16px; background: var(--mci-surface); color: var(--mci-text); cursor: pointer; transition: border-color .15s ease, background .15s ease, color .15s ease; }',
        '.mci-tabs button:hover, .mci-tabs button:focus-visible { border-color: var(--mci-primary); outline: none; }',
        '.mci-tabs button.active { border-color: var(--mci-primary); background: var(--mci-primary); color: #fff; }',
        '.mci-panel { border: 1px solid var(--mci-border); border-radius: 16px; padding: clamp(18px, 3vw, 28px); background: var(--mci-surface); box-shadow: 0 12px 32px rgba(31, 45, 68, .07); }',
        '.mci-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }',
        '.mci-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }',
        '.mci-metric-grid article, .mci-action-card { border: 1px solid var(--mci-border); border-radius: 12px; padding: 16px; background: var(--mci-surface-muted); }',
        '.mci-metric-grid span, .mci-action-card span { display: block; margin-bottom: 8px; color: var(--mci-text-muted); font-size: 12px; }',
        '.mci-metric-grid strong, .mci-action-card strong { display: block; overflow-wrap: anywhere; font-size: 15px; }',
        '.mci-checklist { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }',
        '.mci-checklist span { padding: 8px 10px; border-radius: 8px; font-size: 13px; }',
        '.mci-checklist .passed { background: #eaf8f1; color: #17633d; }',
        '.mci-checklist .pending { background: #fff7e6; color: #805500; }',
        '.mci-action-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; }',
        '.mci-action-card strong { font-size: 28px; }',
        '.mci-action-card button { border-color: var(--mci-primary); background: var(--mci-primary); color: #fff; }',
        '.mci-details { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 10px 16px; margin: 20px 0 0; }',
        '.mci-details dt { color: var(--mci-text-muted); }',
        '.mci-details dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; }',
        '.mci-auth-state, .mci-auth-card { width: min(100%, 460px); margin: clamp(28px, 10vh, 96px) auto; border: 1px solid var(--mci-border); border-radius: 20px; background: var(--mci-surface); box-shadow: 0 24px 64px rgba(31, 45, 68, .14); }',
        '.mci-auth-state { display: flex; align-items: center; gap: 16px; padding: 24px; }',
        '.mci-auth-state strong { display: block; margin-bottom: 4px; }',
        '.mci-auth-state p, .mci-auth-brand p, .mci-auth-tip { margin: 0; color: var(--mci-text-muted); line-height: 1.65; }',
        '.mci-auth-spinner { width: 32px; height: 32px; flex: 0 0 32px; border: 3px solid var(--mci-primary-soft); border-top-color: var(--mci-primary); border-radius: 50%; animation: mci-auth-spin .8s linear infinite; }',
        '.mci-auth-card { display: grid; gap: 17px; padding: clamp(22px, 5vw, 34px); }',
        '.mci-auth-brand { padding-bottom: 4px; }',
        '.mci-auth-brand > span { display: inline-flex; margin-bottom: 14px; border-radius: 999px; padding: 5px 10px; background: var(--mci-primary-soft); color: var(--mci-primary); font-size: 12px; font-weight: 800; letter-spacing: .12em; }',
        '.mci-auth-brand h1 { margin: 0 0 8px; font-size: clamp(23px, 5vw, 30px); line-height: 1.25; }',
        '.mci-auth-card label { display: grid; gap: 7px; color: var(--mci-text-muted); font-size: 13px; font-weight: 650; }',
        '.mci-auth-card input { width: 100%; min-height: 46px; border: 1px solid var(--mci-border); border-radius: 11px; padding: 0 13px; background: var(--mci-surface-muted); color: var(--mci-text); outline: none; transition: border-color .15s ease, box-shadow .15s ease; }',
        '.mci-auth-card input:focus { border-color: var(--mci-primary); box-shadow: 0 0 0 3px var(--mci-primary-soft); }',
        '.mci-captcha-row { display: grid; grid-template-columns: minmax(0, 1fr) 132px; gap: 10px; }',
        '.mci-captcha { min-height: 46px; overflow: hidden; border: 1px solid var(--mci-border); border-radius: 11px; padding: 0; background: var(--mci-surface-muted); color: var(--mci-primary); cursor: pointer; }',
        '.mci-captcha img { display: block; width: 100%; height: 44px; object-fit: contain; }',
        '.mci-auth-error { margin: -2px 0 0; border-radius: 10px; padding: 10px 12px; background: #fff0f0; color: #b42318; line-height: 1.5; }',
        '.mci-auth-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }',
        '.mci-auth-actions button { min-height: 46px; border: 1px solid var(--mci-border); border-radius: 11px; padding: 0 16px; background: var(--mci-surface); color: var(--mci-text); cursor: pointer; }',
        '.mci-auth-actions button.primary { border-color: var(--mci-primary); background: var(--mci-primary); color: #fff; font-weight: 700; }',
        '.mci-auth-actions button:disabled { cursor: wait; opacity: .65; }',
        '.mci-auth-tip { border-top: 1px solid var(--mci-border); padding-top: 15px; font-size: 12px; }',
        '@keyframes mci-auth-spin { to { transform: rotate(360deg); } }',
        '@media (prefers-color-scheme: dark) {',
        '  :root, body { background: #0f1724; color: #e8edf5; }',
        '  .mci-page { --mci-primary: #6ea0ff; --mci-primary-soft: #1b315c; --mci-surface: #182232; --mci-surface-muted: #111b2a; --mci-border: #33435a; --mci-text: #e8edf5; --mci-text-muted: #b3bfd0; }',
        '  .mci-status.online, .mci-checklist .passed { background: #133929; color: #b8f1d4; }',
        '  .mci-checklist .pending { background: #3b2d12; color: #ffe1a1; }',
        '  .mci-auth-error { background: #442020; color: #ffb4ae; }',
        '}',
        '@media (max-width: 820px) { .mci-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }',
        '@media (max-width: 560px) {',
        '  .mci-header, .mci-panel-heading, .mci-action-card { display: grid; }',
        '  .mci-metric-grid { grid-template-columns: 1fr; }',
        '  .mci-tabs button { flex: 1 1 140px; }',
        '  .mci-details { grid-template-columns: 1fr; gap: 4px; }',
        '  .mci-details dd { margin-bottom: 10px; }',
        '  .mci-auth-actions, .mci-captcha-row { grid-template-columns: 1fr; }',
        '}',
        '@media (prefers-reduced-motion: reduce) { .mci-auth-spinner { animation-duration: 1.8s; } }',
        '',
    ].join('\n');
}
function buildViteConfig() {
    return [
        "import { defineConfig } from 'vite'",
        "import vue from '@vitejs/plugin-vue'",
        '',
        'export default defineConfig({',
        "  base: './',",
        '  plugins: [vue()],',
        '  build: {',
        "    outDir: 'dist',",
        "    assetsDir: 'assets',",
        '    emptyOutDir: true,',
        "    target: 'es2020',",
        '    sourcemap: false,',
        '  },',
        '})',
        '',
    ].join('\n');
}
function buildTsConfig() {
    return `${JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            useDefineForClassFields: true,
            module: 'ESNext',
            moduleResolution: 'Bundler',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            strict: true,
            noUncheckedIndexedAccess: true,
            noEmit: true,
            allowJs: true,
            checkJs: false,
            isolatedModules: true,
            verbatimModuleSyntax: true,
            resolveJsonModule: true,
            skipLibCheck: true,
            types: ['vite/client'],
        },
        include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue', 'src/**/*.js', 'tests/**/*.ts'],
    }, null, 2)}\n`;
}
function buildEnvTypes() {
    return [
        '/// <reference types="vite/client" />',
        '',
        'interface MicroAppRuntime {',
        '  getData?: () => Record<string, unknown>',
        '  addDataListener?: (listener: (data?: Record<string, unknown>) => void, autoTrigger?: boolean) => void',
        '  removeDataListener?: (listener: (data?: Record<string, unknown>) => void) => void',
        '  dispatch?: (data: unknown) => void',
        '}',
        '',
        'interface Window {',
        '  microApp?: MicroAppRuntime',
        '}',
        '',
    ].join('\n');
}
function buildMainModule() {
    return [
        "import { createApp } from 'vue'",
        "import App from './App.vue'",
        "import { configureMicroiV8, microiV8 } from './microi'",
        "import './style.css'",
        '',
        'const app = createApp(App)',
        'configureMicroiV8()',
        'microiV8.install?.(app)',
        "app.mount('#app')",
        '',
    ].join('\n');
}
function buildFileContents(options, routes, buildVersion) {
    const createdAt = options.createdAt || new Date().toISOString();
    const files = new Map();
    const projectConfig = {
        schemaVersion: 1,
        runtime: 'micro-app',
        applicationType: 'MicroService',
        appKey: options.appKey,
        name: options.name,
        description: options.description || '',
        osClient: options.osClient || '',
        apiBaseUrl: options.apiBaseUrl || '',
        entry: 'index.html',
        distDir: 'dist',
        routeManifest: 'microi.routes.json',
        version: buildVersion,
        createdAt,
    };
    const routeManifest = routes.map(route => ({
        path: route.path,
        name: route.name,
        title: route.title,
        sourceFile: route.sourceFile,
        sort: route.sort,
        isHome: route.isHome,
    }));
    files.set('.gitignore', 'node_modules/\ndist/\n.microi-micro-app-sync.json\n.sync-seg-*\nsync-source-files.json\n');
    files.set('.microi-micro-app.json', `${JSON.stringify(projectConfig, null, 2)}\n`);
    files.set('microi.routes.json', `${JSON.stringify(routeManifest, null, 2)}\n`);
    files.set('package.json', `${JSON.stringify({
        name: options.appKey,
        private: true,
        version: buildVersion.slice(1),
        type: 'module',
        engines: { node: '^20.19.0 || >=22.12.0' },
        scripts: {
            dev: 'vite --host 0.0.0.0',
            typecheck: 'vue-tsc --noEmit',
            build: 'npm run typecheck && vite build',
            preview: 'vite preview --host 0.0.0.0',
        },
        dependencies: { vue: VUE_VERSION },
        devDependencies: {
            '@vitejs/plugin-vue': VITE_PLUGIN_VUE_VERSION,
            typescript: TYPESCRIPT_VERSION,
            vite: VITE_VERSION,
            'vue-tsc': VUE_TSC_VERSION,
        },
    }, null, 2)}\n`);
    files.set('index.html', '<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Microi Vue 微服务</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n');
    files.set('vite.config.ts', buildViteConfig());
    files.set('tsconfig.json', buildTsConfig());
    files.set('src/env.d.ts', buildEnvTypes());
    files.set('src/main.ts', buildMainModule());
    files.set('src/App.vue', buildAppVue(options.name));
    files.set('src/auth.ts', buildStandaloneAuthModule());
    files.set('src/microi.ts', buildMicroiBridge(options));
    files.set('src/routes.ts', buildRoutesModule(routes));
    files.set('src/style.css', buildStyles());
    files.set('src/utils/microi.v8.js', options.sdkSource || fallbackMicroiSdk());
    routes.forEach((route, index) => {
        const page = index === 0
            ? buildContextPage(route.description || '')
            : index === 1
                ? buildInteractionPage(route.description || '')
                : buildGenericPage(route.description || '', index);
        files.set(route.sourceFile, page);
    });
    return files;
}
export function buildVueMicroServiceScaffoldPlan(options) {
    const aiApplicationsDirectory = assertPlainAiApplicationsDirectory(options.aiApplicationsDirectory);
    const appKey = String(options.appKey || '').trim();
    const name = String(options.name || '').trim();
    if (!APP_KEY_PATTERN.test(appKey))
        throw new Error('appKey 只能使用小写字母、数字、连字符和下划线，长度不超过 64。');
    if (!name || name.length > 120)
        throw new Error('name 不能为空且不能超过 120 个字符。');
    const buildVersion = normalizeBuildVersion(options.buildVersion);
    const routes = normalizeRoutes(options.routes);
    const fileContents = buildFileContents({ ...options, appKey, name }, routes, buildVersion);
    const files = [...fileContents.entries()].map(([relativePath, content]) => ({
        relativePath,
        size: Buffer.byteLength(content, 'utf8'),
        sha256: crypto.createHash('sha256').update(content, 'utf8').digest('hex'),
    })).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    return {
        targetDirectory: path.join(aiApplicationsDirectory, appKey),
        appKey,
        name,
        buildVersion,
        routes,
        files,
        fileContents,
    };
}
function existingScaffoldMatches(plan) {
    try {
        const stat = fs.lstatSync(plan.targetDirectory);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            return false;
        const config = JSON.parse(fs.readFileSync(path.join(plan.targetDirectory, '.microi-micro-app.json'), 'utf8'));
        const routes = JSON.parse(fs.readFileSync(path.join(plan.targetDirectory, 'microi.routes.json'), 'utf8'));
        if (config.appKey !== plan.appKey || config.applicationType !== 'MicroService' || routes.length !== plan.routes.length)
            return false;
        return plan.routes.every((route, index) => {
            const existing = routes[index] || {};
            return existing.path === route.path
                && existing.name === route.name
                && existing.title === route.title
                && existing.sourceFile === route.sourceFile
                && Boolean(existing.isHome) === route.isHome;
        });
    }
    catch {
        return false;
    }
}
export function scaffoldVueMicroService(options) {
    const plan = buildVueMicroServiceScaffoldPlan(options);
    if (fs.existsSync(plan.targetDirectory)) {
        if (existingScaffoldMatches(plan)) {
            return {
                created: false,
                skipped: true,
                targetDirectory: plan.targetDirectory,
                appKey: plan.appKey,
                fileCount: plan.files.length,
                routes: plan.routes,
            };
        }
        throw new Error(`目标目录已存在且不是同一份脚手架，已拒绝覆盖：${plan.targetDirectory}`);
    }
    const parent = path.dirname(plan.targetDirectory);
    const temporaryDirectory = path.join(parent, `.${plan.appKey}.microi-scaffold-${process.pid}-${crypto.randomUUID()}`);
    try {
        fs.mkdirSync(temporaryDirectory, { recursive: false });
        for (const [relativePath, content] of plan.fileContents.entries()) {
            const absolutePath = path.resolve(temporaryDirectory, relativePath);
            if (!absolutePath.startsWith(path.resolve(temporaryDirectory) + path.sep)) {
                throw new Error(`脚手架文件越过目标目录：${relativePath}`);
            }
            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.writeFileSync(absolutePath, content, 'utf8');
        }
        renameScaffoldDirectoryWithRetry(temporaryDirectory, plan.targetDirectory);
    }
    catch (error) {
        if (fs.existsSync(temporaryDirectory))
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        throw error;
    }
    return {
        created: true,
        skipped: false,
        targetDirectory: plan.targetDirectory,
        appKey: plan.appKey,
        fileCount: plan.files.length,
        routes: plan.routes,
    };
}
function renameScaffoldDirectoryWithRetry(sourceDirectory, targetDirectory) {
    const retryableCodes = new Set(['EPERM', 'EACCES', 'EBUSY']);
    const delays = [25, 50, 100, 200];
    for (let attempt = 0;; attempt += 1) {
        try {
            fs.renameSync(sourceDirectory, targetDirectory);
            return;
        }
        catch (error) {
            const code = error?.code || '';
            if (!retryableCodes.has(code) || attempt >= delays.length)
                throw error;
            // Windows Defender/indexers can briefly hold a newly-created directory.
            // Keep the atomic rename contract and retry only bounded transient errors.
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
        }
    }
}
//# sourceMappingURL=microservice-scaffold.js.map