<template>
  <div class="studio" data-mci-ui-root>
    <aside class="studio__rail" aria-label="治理中心导航">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">M</span>
        <div><strong>Microi吾码</strong><small>AI PLATFORM</small></div>
      </div>
      <nav>
        <button
          v-for="item in routes"
          :key="item.path"
          type="button"
          :class="{ active: currentRoute === item.path }"
          :aria-current="currentRoute === item.path ? 'page' : undefined"
          @click="navigate(item.path)"
        >
          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
          <span><small>{{ item.eyebrow }}</small><strong>{{ item.title }}</strong></span>
        </button>
      </nav>
      <div class="rail-foot">
        <span class="health-dot" aria-hidden="true"></span>
        <span><strong>{{ context.osClient || '未连接租户' }}</strong><small>{{ context.buildVersion }}</small></span>
      </div>
    </aside>

    <section class="studio__body">
      <header class="topbar">
        <div>
          <small>MICROI / {{ activeRoute.eyebrow }}</small>
          <h1>{{ activeRoute.title }}</h1>
        </div>
        <div class="topbar__actions" aria-label="界面偏好">
          <button type="button" class="top-icon" :aria-label="theme === 'dark' ? '切换亮色主题' : '切换暗色主题'" @click="toggleTheme">{{ theme === 'dark' ? '☀' : '◐' }}</button>
          <button type="button" class="top-icon" :aria-label="shape === 'flat' ? '切换圆角形态' : '切换扁平形态'" @click="toggleShape">{{ shape === 'flat' ? '◯' : '□' }}</button>
          <label class="palette-picker"><span>主色</span><select v-model="palette" aria-label="选择界面主色" @change="applyPreferences"><option v-for="item in palettes" :key="item" :value="item">{{ paletteLabels[item] }}</option></select></label>
          <button type="button" class="mci-button" @click="reload">刷新</button>
        </div>
      </header>

      <nav class="mobile-nav" aria-label="移动端治理导航">
        <button v-for="item in routes" :key="item.path" type="button" :class="{ active: currentRoute === item.path }" @click="navigate(item.path)">
          <span aria-hidden="true">{{ item.icon }}</span><small>{{ item.title }}</small>
        </button>
      </nav>

      <main class="studio__content">
        <component :is="activeComponent" :key="currentRoute" :context="context" @navigate="navigate" />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import { routes, type RoutePath } from './domain/navigation'
import { callMicroiHost, getHostContext } from './platform/host'
import OverviewPage from './pages/OverviewPage.vue'
import PortalPage from './pages/PortalPage.vue'
import IdentityPage from './pages/IdentityPage.vue'
import AccessPage from './pages/AccessPage.vue'
import ConfigurationPage from './pages/ConfigurationPage.vue'
import ReleasePage from './pages/ReleasePage.vue'
import ServicesPage from './pages/ServicesPage.vue'
import ObservabilityPage from './pages/ObservabilityPage.vue'
import AssetsPage from './pages/AssetsPage.vue'
import ImportPage from './pages/ImportPage.vue'

const context = getHostContext()
const currentRoute = ref<RoutePath>(context.routePath as RoutePath)
const palettes = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const
const paletteLabels: Record<(typeof palettes)[number], string> = { black: '黑', white: '白', red: '红', orange: '橙', yellow: '黄', green: '绿', cyan: '青', blue: '蓝', purple: '紫' }
const stored = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback } catch { return fallback } }
const theme = ref(stored('mci-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
const palette = ref<(typeof palettes)[number]>((palettes.includes(stored('mci-palette', 'red') as never) ? stored('mci-palette', 'red') : 'red') as (typeof palettes)[number])
const shape = ref(stored('mci-shape', 'flat'))
const components: Record<RoutePath, unknown> = {
  '/overview': markRaw(OverviewPage), '/portal': markRaw(PortalPage), '/identity': markRaw(IdentityPage), '/access': markRaw(AccessPage), '/configuration': markRaw(ConfigurationPage), '/release': markRaw(ReleasePage),
  '/services': markRaw(ServicesPage), '/observability': markRaw(ObservabilityPage), '/assets': markRaw(AssetsPage), '/import': markRaw(ImportPage)
}
const activeRoute = computed(() => routes.find((item) => item.path === currentRoute.value) ?? routes[0])
const activeComponent = computed(() => components[currentRoute.value] ?? OverviewPage)

function applyPreferences() {
  document.documentElement.dataset.theme = theme.value
  document.documentElement.dataset.mciPalette = palette.value
  document.documentElement.dataset.mciShape = shape.value
  try { localStorage.setItem('mci-theme', theme.value); localStorage.setItem('mci-palette', palette.value); localStorage.setItem('mci-shape', shape.value) } catch { /* preference persistence is optional */ }
}
function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark'; applyPreferences() }
function toggleShape() { shape.value = shape.value === 'flat' ? 'rounded' : 'flat'; applyPreferences() }
function navigate(path: RoutePath) {
  currentRoute.value = path
  if (!callMicroiHost('replaceTab', { path: `/micro-app/${context.appKey}${path}` })) history.replaceState({}, '', `#${path}`)
}
function reload() { if (!callMicroiHost('reloadTab')) window.location.reload() }
applyPreferences()
</script>

<style scoped>
.studio { position: relative; display: grid; min-height: var(--micro-app-available-height, 100vh); grid-template-columns: 238px minmax(0, 1fr); overflow: hidden; background: var(--mci-bg-base); }
.studio::before { position: fixed; inset: 0; z-index: 0; background-image: linear-gradient(var(--mci-border-color) 1px, transparent 1px), linear-gradient(90deg, var(--mci-border-color) 1px, transparent 1px); background-size: 64px 64px; mask-image: linear-gradient(135deg, rgba(0,0,0,.6), transparent 68%); content: ''; pointer-events: none; }
.studio__rail { position: relative; z-index: 2; display: flex; min-height: var(--micro-app-available-height, 100vh); flex-direction: column; padding: 19px 13px; border-right: 1px solid var(--mci-border-color); background: color-mix(in srgb, var(--mci-bg-elevated) 94%, transparent); }
.brand { display: flex; align-items: center; gap: 11px; min-height: 48px; padding: 0 8px 18px; border-bottom: 1px solid var(--mci-border-color); }
.brand__mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 11px; color: var(--mci-text-on-primary); background: var(--mci-gradient-primary); box-shadow: var(--mci-shadow-button); font-size: 18px; font-weight: 850; }
.brand div, .rail-foot span:last-child { display: grid; gap: 2px; min-width: 0; }
.brand strong { font-size: 14px; }.brand small, .rail-foot small { color: var(--mci-text-tertiary); font-size: 9px; font-weight: 750; letter-spacing: .14em; }
nav { display: grid; gap: 5px; margin-top: 16px; }
nav button { display: flex; min-height: 55px; align-items: center; gap: 11px; padding: 8px 10px; border-color: transparent; background: transparent; box-shadow: none; text-align: left; }
nav button > span:last-child { display: grid; gap: 2px; }
nav button small { color: var(--mci-text-tertiary); font-size: 8px; font-weight: 750; letter-spacing: .11em; }
nav button strong { font-size: 13px; }
nav button.active { color: var(--mci-color-primary-strong); background: color-mix(in srgb, var(--mci-color-primary) 8%, var(--mci-bg-elevated)); }
.nav-icon { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border: 1px solid var(--mci-border-color); border-radius: 9px; background: var(--mci-bg-elevated); font-size: 16px; }
nav button.active .nav-icon { border-color: color-mix(in srgb, var(--mci-color-primary) 28%, transparent); color: var(--mci-text-on-primary); background: var(--mci-gradient-primary); }
.rail-foot { display: flex; align-items: center; gap: 9px; margin-top: auto; padding: 14px 9px 2px; border-top: 1px solid var(--mci-border-color); }
.rail-foot strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.health-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--mci-color-success); box-shadow: 0 0 0 5px color-mix(in srgb, var(--mci-color-success) 13%, transparent); }
.studio__body { position: relative; z-index: 1; min-width: 0; }
.topbar { position: sticky; top: 0; z-index: 10; display: flex; min-height: 76px; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 24px; border-bottom: 1px solid var(--mci-border-color); background: color-mix(in srgb, var(--mci-bg-elevated) 94%, transparent); }
.topbar small { color: var(--mci-color-primary); font-size: 9px; font-weight: 800; letter-spacing: .15em; }.topbar h1 { margin: 3px 0 0; font-size: 20px; }
.topbar__actions { display: flex; align-items: center; gap: 8px; }.top-icon { display: grid; width: 42px; min-height: 42px; place-items: center; font-size: 17px; }
.palette-picker { display: flex; min-height: 42px; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--mci-border-strong); border-radius: var(--mci-shape-input); background: var(--mci-bg-elevated); }.palette-picker span { color: var(--mci-text-secondary); font-size: 11px; }.palette-picker select { border: 0; color: var(--mci-text-primary); background: transparent; }
.studio__content { width: min(100%, 1600px); margin: 0 auto; padding: 22px 24px calc(28px + var(--mci-safe-bottom)); }
.mobile-nav { display: none; }
@media (max-width: 980px) { .studio { grid-template-columns: 78px minmax(0,1fr); }.studio__rail { padding-inline: 8px; }.brand { justify-content: center; padding-inline: 0; }.brand div, nav button > span:last-child, .rail-foot span:last-child { display: none; }.studio__rail nav button { justify-content: center; padding-inline: 0; }.rail-foot { justify-content: center; }.topbar { padding-inline: 16px; }.studio__content { padding-inline: 16px; } }
@media (max-width: 700px) { .studio { display: block; min-height: var(--micro-app-available-height, 100vh); }.studio__rail { display: none; }.topbar { position: relative; align-items: flex-start; flex-direction: column; padding-top: calc(12px + var(--mci-safe-top)); }.topbar__actions { width: 100%; overflow-x: auto; }.topbar__actions > * { flex: 0 0 auto; }.studio__content { padding: 14px 12px calc(86px + var(--mci-safe-bottom)); }.mobile-nav { position: sticky; top: 0; z-index: 20; display: flex; min-height: 60px; margin: 0; padding: 5px; border-top: 0; border-bottom: 1px solid var(--mci-border-color); background: color-mix(in srgb, var(--mci-bg-elevated) 96%, transparent); box-shadow: 0 8px 24px rgba(0,0,0,.06); overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin; }.mobile-nav button { display: grid; min-width: 68px; min-height: 48px; flex: 1 0 68px; place-items: center; gap: 2px; padding: 4px; }.mobile-nav button span { font-size: 17px; }.mobile-nav button small { font-size: 9px; letter-spacing: 0; }.mobile-nav button.active { color: var(--mci-color-primary); } }
</style>
