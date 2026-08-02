import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface VueMicroServiceRouteInput {
  path: string;
  name: string;
  title: string;
  description?: string;
  isHome?: boolean;
}

export interface VueMicroServiceScaffoldOptions {
  aiApplicationsDirectory: string;
  appKey: string;
  name: string;
  description?: string;
  apiBaseUrl?: string;
  osClient?: string;
  buildVersion?: string;
  routes: VueMicroServiceRouteInput[];
  sdkSource?: string;
  createdAt?: string;
}

export interface VueMicroServiceScaffoldPlan {
  targetDirectory: string;
  appKey: string;
  name: string;
  buildVersion: string;
  routes: Array<VueMicroServiceRouteInput & {
    sourceFile: string;
    sort: number;
    isHome: boolean;
  }>;
  files: Array<{ relativePath: string; size: number; sha256: string }>;
  fileContents: Map<string, string>;
}

export interface VueMicroServiceScaffoldResult {
  created: boolean;
  skipped: boolean;
  targetDirectory: string;
  appKey: string;
  fileCount: number;
  routes: VueMicroServiceScaffoldPlan['routes'];
}

const APP_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/u;
const ROUTE_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*)?$/u;
const ROUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/u;
const VUE_VERSION = '3.5.40';
const VITE_VERSION = '7.3.6';
const VITE_PLUGIN_VUE_VERSION = '6.0.8';
const TYPESCRIPT_VERSION = '5.9.3';
const VUE_TSC_VERSION = '3.3.9';

function assertPlainAiApplicationsDirectory(directory: string): string {
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

function normalizeBuildVersion(value?: string): string {
  const version = String(value || 'v0.1.0').trim();
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`buildVersion 必须是 v1.2.3 形式：${value}`);
  }
  return version;
}

function toPascalCase(value: string): string {
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

function normalizeRoutes(routes: VueMicroServiceRouteInput[]): VueMicroServiceScaffoldPlan['routes'] {
  if (!Array.isArray(routes) || routes.length < 1 || routes.length > 50) {
    throw new Error('routes 数量必须在 1 到 50 之间。');
  }
  const pathSet = new Set<string>();
  const nameSet = new Set<string>();
  const sourceFileSet = new Set<string>();
  const explicitHomes = routes.filter(route => route.isHome === true);
  if (explicitHomes.length > 1) throw new Error('routes 最多只能有一个 isHome=true。');

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
    if (pathSet.has(normalizedPathKey)) throw new Error(`路由 path 重复：${routePath}`);
    if (nameSet.has(normalizedNameKey)) throw new Error(`路由 name 重复：${routeName}`);
    pathSet.add(normalizedPathKey);
    nameSet.add(normalizedNameKey);

    const sourceFile = `src/pages/${toPascalCase(routeName)}Page.vue`;
    if (sourceFileSet.has(sourceFile.toLowerCase())) throw new Error(`路由页面文件名重复：${sourceFile}`);
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

function fallbackMicroiSdk(): string {
  return [
    'function createClient(initial = {}) {',
    '  let config = { apiBase: "", osClient: "", token: "", ...(initial || {}) }',
    '  const configure = (next = {}) => { config = { ...config, ...(next || {}) }; return client }',
    '  const getConfig = () => ({ ...config })',
    '  const setToken = (token) => {',
    '    const previousToken = String(config.token || "")',
    '    config.token = String(token || "")',
    '    if (config.token !== previousToken && typeof config.onTokenChanged === "function") config.onTokenChanged(config.token, previousToken, client)',
    '    return client',
    '  }',
    '  const clearToken = () => setToken("")',
    '  async function post(url, data = {}) {',
    '    const target = /^https?:\\/\\//i.test(url) ? url : String(config.apiBase || "").replace(/\\/+$/, "") + "/" + String(url || "").replace(/^\\/+/, "")',
    '    const headers = { "Content-Type": "application/json", osclient: config.osClient || "" }',
    '    if (config.token) headers.Authorization = "Bearer " + config.token',
    '    const response = await fetch(target, { method: "POST", headers, body: JSON.stringify(data || {}) })',
    '    const refreshedToken = response.headers.get("authorization") || response.headers.get("token") || ""',
    '    if (refreshedToken) setToken(refreshedToken.replace(/^Bearer\\s+/i, ""))',
    '    return response.json()',
    '  }',
    '  const install = (app) => {',
    '    if (app?.config?.globalProperties) app.config.globalProperties.$V8 = client',
    '    if (typeof app?.provide === "function") app.provide("MicroiV8", client)',
    '    return client',
    '  }',
    '  const client = {',
    '    configure, getConfig, setToken, clearToken, post, install,',
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

export function resolveMicroiSdkSource(workspaceRoot?: string): string | undefined {
  const candidates = [
    process.env.MICROI_V8_SDK_PATH,
    workspaceRoot ? path.join(workspaceRoot, 'microi.skills', 'microi.v8.js') : '',
    process.env.MICROI_WORKSPACE_ROOT ? path.join(process.env.MICROI_WORKSPACE_ROOT, 'microi.skills', 'microi.v8.js') : '',
    path.join(process.cwd(), 'microi.skills', 'microi.v8.js'),
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const resolved = path.resolve(candidate);
      const stat = fs.lstatSync(resolved);
      if (stat.isFile() && !stat.isSymbolicLink()) return fs.readFileSync(resolved, 'utf8');
    } catch {
      // Optional SDK discovery falls back to the small compatible client below.
    }
  }
  return undefined;
}

function buildMicroiBridge(): string {
  return [
    "import { createMicroiV8 } from './utils/microi.v8.js'",
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
    '  appKey: string',
    '  version: string',
    '  microRoute: string',
    '  route: MicroiRouteContext',
    '}',
    '',
    'function stringValue(value: unknown): string {',
    "  return typeof value === 'string' ? value : ''",
    '}',
    '',
    'function getLocalRoutePath(): string {',
    "  const hashPath = String(window.location.hash || '').replace(/^#/, '').split('?')[0]",
    "  return hashPath.startsWith('/') ? hashPath : ''",
    '}',
    '',
    'export function getMicroiContext(): MicroiContext {',
    '  const data = window.microApp?.getData?.() || {}',
    '  const route = data.route && typeof data.route === \'object\' ? data.route as MicroiRouteContext : {}',
    '  return {',
    '    apiBase: stringValue(data.apiBase),',
    '    osClient: stringValue(data.osClient),',
    '    token: stringValue(data.token),',
    '    menuId: stringValue(data.menuId),',
    '    menuName: stringValue(data.menuName),',
    '    appKey: stringValue(data.appKey),',
    '    version: stringValue(data.version),',
    "    microRoute: stringValue(data.microRoute) || stringValue(route.microRoute) || stringValue(route.microRoutePath) || (window.microApp ? '' : getLocalRoutePath()),",
    '    route,',
    '  }',
    '}',
    '',
    'export const microiV8 = createMicroiV8()',
    "let appliedHostToken = ''",
    '',
    'export function configureMicroiV8(context: MicroiContext = getMicroiContext()) {',
    '  microiV8.configure?.({',
    '    apiBase: context.apiBase,',
    '    osClient: context.osClient,',
    '    onTokenChanged: (token: string, requestToken: string) => {',
    "      window.microApp?.dispatch?.({ type: 'micro-app:token', data: { token, requestToken } })",
    '    },',
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

function buildRoutesModule(routes: VueMicroServiceScaffoldPlan['routes']): string {
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

function buildAppVue(name: string): string {
  return [
    '<template>',
    '  <main class="mci-page" data-testid="microservice-root">',
    '    <header class="mci-header">',
    '      <div>',
    '        <p class="mci-eyebrow">MCP · AI 应用 · Vue 3</p>',
    '        <h1>{{ applicationName }}</h1>',
    '        <p class="mci-subtitle">同一微服务通过菜单上下文切换内部页面路由</p>',
    '      </div>',
    '      <span class="mci-status" :class="{ online: embedded }">{{ embedded ? \'MicroApp 已连接\' : \'本地预览\' }}</span>',
    '    </header>',
    '',
    '    <nav class="mci-tabs" aria-label="测试页面">',
    '      <button',
    '        v-for="item in routes"',
    '        :key="item.path"',
    '        type="button"',
    '        :class="{ active: activeRoute.path === item.path }"',
    '        @click="setLocalRoute(item.path)"',
    '      >',
    '        {{ item.title }}',
    '      </button>',
    '    </nav>',
    '',
    '    <component :is="activeRoute.component" :context="context" :route="activeRoute" />',
    '  </main>',
    '</template>',
    '',
    '<script setup lang="ts">',
    "import { computed, onMounted, onUnmounted, ref } from 'vue'",
    "import { configureMicroiV8, getMicroiContext } from './microi'",
    "import type { MicroiContext } from './microi'",
    "import { findRoute, normalizeRoutePath, routes } from './routes'",
    '',
    `const applicationName = ${JSON.stringify(name)}`,
    'const context = ref<MicroiContext>(getMicroiContext())',
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
    '}',
    '',
    'function setLocalRoute(routePath: string) {',
    '  const normalized = normalizeRoutePath(routePath)',
    '  localRoute.value = normalized',
    "  if (!window.microApp && window.location.hash !== '#' + normalized) window.location.hash = normalized",
    '}',
    '',
    'onMounted(() => {',
    '  refreshContext()',
    '  if (window.microApp?.addDataListener) {',
    '    window.microApp.addDataListener(refreshContext, true)',
    '    removeListener = () => window.microApp?.removeDataListener?.(refreshContext)',
    '  } else {',
    '    const handleHashChange = () => { localRoute.value = normalizeRoutePath(getMicroiContext().microRoute || localRoute.value) }',
    "    window.addEventListener('hashchange', handleHashChange)",
    "    removeHashListener = () => window.removeEventListener('hashchange', handleHashChange)",
    '  }',
    '})',
    '',
    'onUnmounted(() => { removeListener?.(); removeHashListener?.() })',
    '</script>',
    '',
  ].join('\n');
}

function buildContextPage(description: string): string {
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

function buildInteractionPage(description: string): string {
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

function buildGenericPage(description: string, index: number): string {
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

function buildStyles(): string {
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
    '@media (prefers-color-scheme: dark) {',
    '  :root, body { background: #0f1724; color: #e8edf5; }',
    '  .mci-page { --mci-primary: #6ea0ff; --mci-primary-soft: #1b315c; --mci-surface: #182232; --mci-surface-muted: #111b2a; --mci-border: #33435a; --mci-text: #e8edf5; --mci-text-muted: #b3bfd0; }',
    '  .mci-status.online, .mci-checklist .passed { background: #133929; color: #b8f1d4; }',
    '  .mci-checklist .pending { background: #3b2d12; color: #ffe1a1; }',
    '}',
    '@media (max-width: 820px) { .mci-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }',
    '@media (max-width: 560px) {',
    '  .mci-header, .mci-panel-heading, .mci-action-card { display: grid; }',
    '  .mci-metric-grid { grid-template-columns: 1fr; }',
    '  .mci-tabs button { flex: 1 1 140px; }',
    '  .mci-details { grid-template-columns: 1fr; gap: 4px; }',
    '  .mci-details dd { margin-bottom: 10px; }',
    '}',
    '',
  ].join('\n');
}

function buildViteConfig(): string {
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

function buildTsConfig(): string {
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

function buildEnvTypes(): string {
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

function buildMainModule(): string {
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

function buildFileContents(options: VueMicroServiceScaffoldOptions, routes: VueMicroServiceScaffoldPlan['routes'], buildVersion: string): Map<string, string> {
  const createdAt = options.createdAt || new Date().toISOString();
  const files = new Map<string, string>();
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
  files.set('.gitignore', 'node_modules/\ndist/\n.microi-micro-app-sync.json\n');
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
  files.set('src/microi.ts', buildMicroiBridge());
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

export function buildVueMicroServiceScaffoldPlan(options: VueMicroServiceScaffoldOptions): VueMicroServiceScaffoldPlan {
  const aiApplicationsDirectory = assertPlainAiApplicationsDirectory(options.aiApplicationsDirectory);
  const appKey = String(options.appKey || '').trim();
  const name = String(options.name || '').trim();
  if (!APP_KEY_PATTERN.test(appKey)) throw new Error('appKey 只能使用小写字母、数字、连字符和下划线，长度不超过 64。');
  if (!name || name.length > 120) throw new Error('name 不能为空且不能超过 120 个字符。');
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

function existingScaffoldMatches(plan: VueMicroServiceScaffoldPlan): boolean {
  try {
    const stat = fs.lstatSync(plan.targetDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    const config = JSON.parse(fs.readFileSync(path.join(plan.targetDirectory, '.microi-micro-app.json'), 'utf8')) as Record<string, unknown>;
    const routes = JSON.parse(fs.readFileSync(path.join(plan.targetDirectory, 'microi.routes.json'), 'utf8')) as Array<Record<string, unknown>>;
    if (config.appKey !== plan.appKey || config.applicationType !== 'MicroService' || routes.length !== plan.routes.length) return false;
    return plan.routes.every((route, index) => {
      const existing = routes[index] || {};
      return existing.path === route.path
        && existing.name === route.name
        && existing.title === route.title
        && existing.sourceFile === route.sourceFile
        && Boolean(existing.isHome) === route.isHome;
    });
  } catch {
    return false;
  }
}

export function scaffoldVueMicroService(options: VueMicroServiceScaffoldOptions): VueMicroServiceScaffoldResult {
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
  } catch (error) {
    if (fs.existsSync(temporaryDirectory)) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
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

function renameScaffoldDirectoryWithRetry(sourceDirectory: string, targetDirectory: string): void {
  const retryableCodes = new Set(['EPERM', 'EACCES', 'EBUSY']);
  const delays = [25, 50, 100, 200];
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(sourceDirectory, targetDirectory);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code || '';
      if (!retryableCodes.has(code) || attempt >= delays.length) throw error;
      // Windows Defender/indexers can briefly hold a newly-created directory.
      // Keep the atomic rename contract and retry only bounded transient errors.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
}
