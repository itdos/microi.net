<template>
  <ClientOnly>
    <section
      v-if="shouldRender"
      id="ai-apps"
      class="app-market"
      :class="{ 'app-market-home': isHomePage, 'app-market-page': isAppsPage }"
    >
      <div class="market-shell">
        <header class="market-heading">
          <div>
            <span class="market-kicker">MICROI AI APPLICATIONS</span>
            <h2>AI 应用</h2>
            <p>基于吾码低代码、UniApp 与 Web 应用引擎构建，发布于公有 HDFS，可直接在线预览。</p>
          </div>
          <a v-if="isHomePage" class="market-more-glow" href="/apps.html">
            <span>查看全部 AI 应用</span>
            <span aria-hidden="true">→</span>
          </a>
        </header>

        <div v-if="isAppsPage" class="market-toolbar">
          <div class="filter-groups">
            <div class="filter-group">
              <span>应用类型</span>
              <div class="category-tabs" role="radiogroup" aria-label="应用类型">
                <button
                  v-for="item in applicationTypes"
                  :key="item.value"
                  type="button"
                  role="radio"
                  :aria-checked="activeType === item.value"
                  :class="{ active: activeType === item.value }"
                  @click="selectType(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
            <div class="filter-group">
              <span>应用分类</span>
              <div class="category-tabs" role="radiogroup" aria-label="应用分类">
                <button
                  v-for="item in businessCategories"
                  :key="item.value"
                  type="button"
                  role="radio"
                  :aria-checked="activeCategory === item.value"
                  :class="{ active: activeCategory === item.value }"
                  @click="selectCategory(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
          <label class="market-search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              v-model="keyword"
              type="search"
              placeholder="搜索应用"
              @input="scheduleKeywordSearch"
            />
          </label>
        </div>

        <div
          v-if="showInitialSkeleton"
          class="app-grid app-grid-skeleton"
          aria-label="正在读取应用"
          aria-busy="true"
        >
          <article v-for="index in skeletonCount" :key="index" class="app-card app-card-skeleton">
            <div class="skeleton-block skeleton-preview"></div>
            <div class="app-content">
              <div class="skeleton-block skeleton-title"></div>
              <div class="skeleton-block skeleton-line"></div>
              <div class="skeleton-block skeleton-line short"></div>
              <div class="skeleton-footer">
                <div class="skeleton-block skeleton-chip"></div>
                <div class="skeleton-block skeleton-action"></div>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="loadError" class="market-state">{{ loadError }}</div>
        <div v-else-if="liveApps.length === 0" class="market-state">没有找到匹配的应用。</div>

        <div
          v-else
          class="app-grid"
          :class="{ 'app-grid-refreshing': isLoading }"
          :aria-busy="isLoading"
        >
          <article
            v-for="app in liveApps"
            :key="app.AppKey"
            class="app-card"
            tabindex="0"
            @click="openDetail(app)"
            @keydown.enter="openDetail(app)"
          >
            <div
              class="app-preview"
              :class="[`preview-${app.tone}`, previewFitClass(app.ApplicationType)]"
            >
              <img
                v-if="app.AppPreviewUrl && !brokenPreviewKeys.has(app.AppKey)"
                :src="app.AppPreviewUrl"
                :alt="`${app.Name}应用预览图`"
                loading="lazy"
                decoding="async"
                @error="markPreviewBroken(app.AppKey)"
              />
              <div v-else class="preview-empty" aria-hidden="true">
                <span class="preview-empty-orbit orbit-one"></span>
                <span class="preview-empty-orbit orbit-two"></span>
                <strong>{{ app.icon }}</strong>
                <small>MICROI APPLICATION</small>
              </div>
              <div class="preview-shade"></div>
              <span class="preview-badge">{{ typeLabel(app.ApplicationType) }}</span>
              <span class="preview-icon" aria-hidden="true">{{ app.icon }}</span>
            </div>
            <div class="app-content">
              <div class="app-title-row">
                <h3>{{ app.Name }}</h3>
                <span class="online-dot">已上线</span>
              </div>
              <p>{{ app.Description }}</p>
              <footer>
                <span class="type-tag">{{ typeLabel(app.ApplicationType) }}</span>
                <span class="app-stats">{{ app.ViewCount }} 次浏览 · {{ app.InstallCount }} 次安装</span>
                <button type="button" @click.stop="openDetail(app)">
                  查看详情
                  <span aria-hidden="true">→</span>
                </button>
              </footer>
            </div>
          </article>
        </div>

        <nav
          v-if="!loadError && totalCount > 0"
          class="market-pagination"
          aria-label="AI应用分页"
          :aria-busy="isLoading"
        >
          <button type="button" :disabled="isLoading || pageIndex <= 1" @click="changePage(pageIndex - 1)">上一页</button>
          <span>第 {{ pageIndex }} / {{ pageCount }} 页 · 共 {{ totalCount }} 个应用</span>
          <button type="button" :disabled="isLoading || pageIndex >= pageCount" @click="changePage(pageIndex + 1)">下一页</button>
        </nav>
      </div>
    </section>
  </ClientOnly>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import { resolveSiteApiBase } from '../utils/site-api-base.js'

const route = useRoute()
const APP_API_BASE = resolveSiteApiBase(import.meta.env.VITE_MICROI_PUBLIC_API_BASE)
const OS_CLIENT = 'iTdos'

const liveApps = ref([])
const activeType = ref('all')
const activeCategory = ref('all')
const keyword = ref('')
const isLoading = ref(false)
const loadError = ref('')
const pageIndex = ref(1)
const totalCount = ref(0)
const fileServer = ref('')
const brokenPreviewKeys = ref(new Set())
let mounted = false
let requestSequence = 0
let requestController = null
let keywordTimer = null

const defaultApplicationTypes = [
  { label: '全部', value: 'all' },
  { label: '平台应用', value: 'Platform' },
  { label: 'Web', value: 'Web' },
  { label: 'UniApp', value: 'UniApp' },
  { label: '微服务', value: 'MicroService' }
]

const defaultBusinessCategories = [
  { label: '全部', value: 'all' },
  { label: '游戏', value: 'game' },
  { label: '企业应用', value: 'business' },
  { label: '办公协同', value: 'office' },
  { label: '教育学习', value: 'education' },
  { label: '效率工具', value: 'tools' },
  { label: '生活服务', value: 'lifestyle' },
  { label: '创意设计', value: 'creative' },
  { label: '数据分析', value: 'data' },
  { label: '营销运营', value: 'marketing' },
  { label: '行业应用', value: 'industry' },
  { label: '平台能力', value: 'platform' },
  { label: '其它', value: 'other' }
]
const applicationTypes = ref(defaultApplicationTypes)
const businessCategories = ref(defaultBusinessCategories)

const currentPath = computed(() => route.path || (typeof window !== 'undefined' ? window.location.pathname : ''))
const isHomePage = computed(() => ['/', '/index', '/index.html'].includes(currentPath.value))
const isAppsPage = computed(() => ['/apps', '/apps.html'].includes(currentPath.value))
const shouldRender = computed(() => isHomePage.value || isAppsPage.value)
const pageSize = computed(() => isHomePage.value ? 8 : 12)
const skeletonCount = computed(() => pageSize.value)
const pageCount = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
const showInitialSkeleton = computed(() => isLoading.value && liveApps.value.length === 0)

function plainText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUploadValue(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = normalizeUploadValue(item, depth + 1)
      if (result) return result
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['Path', 'FilePathName', 'FullPath', 'Url', 'url', 'src']) {
      const result = normalizeUploadValue(value[key], depth + 1)
      if (result) return result
    }
    return ''
  }
  const text = String(value).trim()
  if (!text) return ''
  if (/^[{[]/.test(text)) {
    try {
      return normalizeUploadValue(JSON.parse(text), depth + 1)
    } catch (_) {
      return text
    }
  }
  return text.replace(/^['"]|['"]$/g, '')
}

function resolvePreviewUrl(value) {
  const path = normalizeUploadValue(value)
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  if (path.startsWith('/file/')) return `${APP_API_BASE.replace(/\/+$/, '')}${path}`
  const server = fileServer.value.replace(/\/+$/, '')
  if (!server) return path
  return `${server}/${path.replace(/^\/+/, '')}`
}

function normalizeApp(app) {
  const applicationType = app.ApplicationType || app.AppType || 'Web'
  const category = app.Category || (applicationType === 'Platform' ? 'platform' : 'other')
  const iconByCategory = {
    game: '游', business: '企', office: '办', education: '学', tools: '工',
    lifestyle: '生', creative: '创', data: '数', marketing: '营', industry: '业',
    platform: 'M', other: 'AI'
  }
  const toneByCategory = {
    game: 'indigo', business: 'navy', office: 'blue', education: 'violet', tools: 'cyan',
    lifestyle: 'green', creative: 'purple', data: 'cyan', marketing: 'orange', industry: 'navy',
    platform: 'indigo', other: 'blue'
  }
  return {
    ...app,
    Name: app.AppName || app.Name || '未命名应用',
    Description: plainText(app.AppDetail || app.Description) || '基于 Microi吾码构建的在线应用。',
    AppKey: app.AppKey || app.AppId || app.Id,
    AppPreviewUrl: resolvePreviewUrl(app.AppPreview),
    ApplicationType: applicationType,
    Category: category,
    icon: iconByCategory[category] || 'AI',
    tone: toneByCategory[category] || 'blue',
    ViewCount: Number(app.ViewCount || 0),
    InstallCount: Number(app.InstallCount || 0)
  }
}

function typeLabel(value) {
  return { Platform: '平台应用', UniApp: 'UniApp', Web: 'Web', MicroService: '微服务' }[value] || value
}

function previewFitClass(applicationType) {
  const normalizedType = String(applicationType || '').toLowerCase()
  return normalizedType === 'uniapp' || normalizedType === 'web'
    ? 'preview-fit-contain'
    : 'preview-fit-cover'
}

function isAllowed(value, options) {
  return options.some(item => item.value === value) ? value : 'all'
}

function keyValueOptions(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) return fallback
  const normalized = value
    .map(item => ({
      label: String(item?.Value ?? item?.Label ?? '').trim(),
      value: String(item?.Key ?? item?.Value ?? '').trim()
    }))
    .filter(item => item.label && item.value)
  return normalized.length ? [{ label: '全部', value: 'all' }, ...normalized] : fallback
}

function readUrlState() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (isAppsPage.value) {
    activeType.value = isAllowed(params.get('type') || 'all', applicationTypes.value)
    activeCategory.value = isAllowed(params.get('category') || 'all', businessCategories.value)
    keyword.value = params.get('q') || ''
    pageIndex.value = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  } else {
    activeType.value = 'all'
    activeCategory.value = 'all'
    keyword.value = ''
    pageIndex.value = Math.max(1, Number.parseInt(params.get('aiPage') || '1', 10) || 1)
  }
}

function writeUrlState(replace = false) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (isAppsPage.value) {
    setOrDelete(url.searchParams, 'type', activeType.value === 'all' ? '' : activeType.value)
    setOrDelete(url.searchParams, 'category', activeCategory.value === 'all' ? '' : activeCategory.value)
    setOrDelete(url.searchParams, 'q', keyword.value.trim())
    setOrDelete(url.searchParams, 'page', pageIndex.value > 1 ? pageIndex.value : '')
    url.searchParams.delete('aiPage')
  } else {
    setOrDelete(url.searchParams, 'aiPage', pageIndex.value > 1 ? pageIndex.value : '')
  }
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function setOrDelete(params, key, value) {
  if (value === '' || value === null || value === undefined) params.delete(key)
  else params.set(key, String(value))
}

async function loadApplications() {
  if (!shouldRender.value) return
  const sequence = ++requestSequence
  requestController?.abort()
  requestController = new AbortController()
  isLoading.value = true
  loadError.value = ''
  try {
    const payload = {
      OsClient: OS_CLIENT,
      PageIndex: pageIndex.value,
      PageSize: pageSize.value,
      SortBy: isHomePage.value ? 'ViewCount' : 'AppUpdateTime',
      SortOrder: 'DESC'
    }
    if (isAppsPage.value && activeType.value !== 'all') payload.ApplicationType = activeType.value
    if (isAppsPage.value && activeCategory.value !== 'all') payload.Category = activeCategory.value
    if (isAppsPage.value && keyword.value.trim()) payload.Keyword = keyword.value.trim()
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_apps?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: requestController.signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (result.Code !== 1 || !Array.isArray(result.Data)) {
      throw new Error(result.Msg || '已发布应用读取失败')
    }
    if (sequence !== requestSequence) return
    fileServer.value = String(result.DataAppend?.FileServer || '').trim()
    applicationTypes.value = keyValueOptions(result.DataAppend?.ApplicationTypes, defaultApplicationTypes)
    businessCategories.value = keyValueOptions(result.DataAppend?.Categories, defaultBusinessCategories)
    totalCount.value = Number(result.DataCount || 0)
    liveApps.value = result.Data.map(normalizeApp)
    brokenPreviewKeys.value = new Set()
  } catch (error) {
    if (error?.name === 'AbortError' || sequence !== requestSequence) return
    liveApps.value = []
    totalCount.value = 0
    loadError.value = `AI 应用暂时无法读取：${error?.message || '网络异常'}`
  } finally {
    if (sequence === requestSequence) isLoading.value = false
  }
}

function selectType(value) {
  if (activeType.value === value) return
  activeType.value = value
  pageIndex.value = 1
  writeUrlState()
  loadApplications()
}

function selectCategory(value) {
  if (activeCategory.value === value) return
  activeCategory.value = value
  pageIndex.value = 1
  writeUrlState()
  loadApplications()
}

function scheduleKeywordSearch() {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    pageIndex.value = 1
    writeUrlState(true)
    loadApplications()
  }, 320)
}

function changePage(value) {
  const next = Math.max(1, Math.min(pageCount.value, value))
  if (next === pageIndex.value) return
  pageIndex.value = next
  writeUrlState()
  loadApplications()
}

function handlePopState() {
  readUrlState()
  loadApplications()
}

function markPreviewBroken(appKey) {
  const next = new Set(brokenPreviewKeys.value)
  next.add(appKey)
  brokenPreviewKeys.value = next
}

function openDetail(app) {
  window.location.href = `/app-detail.html?app=${encodeURIComponent(app.AppKey || app.Id)}`
}

watch(currentPath, () => {
  if (!mounted || !shouldRender.value) return
  readUrlState()
  loadApplications()
})

onMounted(() => {
  mounted = true
  readUrlState()
  window.addEventListener('popstate', handlePopState)
  loadApplications()
})

onBeforeUnmount(() => {
  mounted = false
  requestController?.abort()
  if (keywordTimer) clearTimeout(keywordTimer)
  window.removeEventListener('popstate', handlePopState)
})
</script>

<style scoped>
.app-market {
  --market-bg: #f7f9fc;
  --market-card: #fff;
  --market-line: #e6eaf0;
  --market-ink: #172033;
  --market-muted: #687386;
  --market-primary: #1769e0;
  position: relative;
  width: 100%;
  padding: 76px 24px 88px;
  background:
    radial-gradient(circle at 50% 0, rgba(39, 111, 243, .08), transparent 32%),
    var(--market-bg);
  color: var(--market-ink);
}

.app-market-home {
  padding-top: 40px;
  padding-bottom: 58px;
}

.app-market-home .market-heading {
  margin-bottom: 20px;
}

.app-market-home .market-heading h2 {
  font-size: clamp(27px, 3.2vw, 36px);
}

.app-market-home .market-heading p {
  margin-top: 7px;
}

.app-market-home .app-preview {
  height: 204px;
}

.app-market-page {
  padding-top: 54px;
}

:global(html.dark .app-market) {
  --market-bg: #0b1220;
  --market-card: #111a2a;
  --market-line: rgba(148, 163, 184, .18);
  --market-ink: #f4f7fb;
  --market-muted: #9aa8bd;
  --market-primary: #67a5ff;
}

.market-shell {
  width: min(1240px, 100%);
  margin-inline: auto;
}

.market-heading,
.market-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.market-heading {
  margin-bottom: 28px;
}

.market-kicker {
  display: block;
  margin-bottom: 8px;
  color: var(--market-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
}

.market-heading h2 {
  margin: 0;
  color: var(--market-ink);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
  letter-spacing: -.04em;
}

.market-heading p {
  margin: 10px 0 0;
  color: var(--market-muted);
  line-height: 1.65;
}

.market-more-glow {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  overflow: hidden;
  border: 1px solid rgba(96, 165, 250, .5);
  border-radius: 12px;
  background: linear-gradient(135deg, #1769e0, #5b8ff7);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 10px 26px rgba(23, 105, 224, .26);
  transition: transform .2s ease, box-shadow .2s ease;
}

.market-more-glow::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: -90%;
  left: -42%;
  width: 34%;
  height: 280%;
  transform: rotate(24deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
  animation: market-button-glow 3.2s ease-in-out infinite;
}

.market-more-glow:hover {
  transform: translateY(-2px);
  color: #fff;
  box-shadow: 0 14px 32px rgba(23, 105, 224, .36);
}

@keyframes market-button-glow {
  0%, 32% { left: -42%; opacity: 0; }
  42% { opacity: 1; }
  68%, 100% { left: 118%; opacity: 0; }
}

.market-toolbar {
  align-items: center;
  margin: 0 0 22px;
  padding: 14px;
  border: 1px solid var(--market-line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--market-card) 88%, transparent);
}

.filter-groups {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-group > span {
  flex: 0 0 auto;
  width: 56px;
  color: var(--market-ink);
  font-size: 12px;
  font-weight: 750;
}

.category-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.category-tabs button {
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--market-muted);
  cursor: pointer;
  font-weight: 650;
}

.category-tabs button.active {
  background: rgba(31, 111, 235, .11);
  color: var(--market-primary);
}

.market-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(260px, 100%);
  height: 38px;
  padding: 0 11px;
  border: 1px solid var(--market-line);
  border-radius: 8px;
  background: var(--market-card);
  color: var(--market-muted);
}

.market-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--market-ink);
}

.market-state {
  padding: 48px 20px;
  border: 1px dashed var(--market-line);
  border-radius: 12px;
  color: var(--market-muted);
  text-align: center;
}

.app-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.app-grid-refreshing::before {
  content: "";
  position: absolute;
  z-index: 4;
  top: 0;
  left: 0;
  width: 30%;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--market-primary), transparent);
  transform: translateX(-120%);
  animation: market-page-refresh .9s ease-in-out infinite;
  pointer-events: none;
}

.app-grid-refreshing .app-card {
  pointer-events: none;
}

@keyframes market-page-refresh {
  to { transform: translateX(430%); }
}

.app-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--market-line);
  border-radius: 20px;
  background: var(--market-card);
  box-shadow: 0 12px 34px rgba(25, 38, 64, .07);
  cursor: pointer;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}

.app-card:hover,
.app-card:focus-visible {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--market-primary) 42%, var(--market-line));
  box-shadow: 0 18px 38px rgba(25, 38, 64, .12);
  outline: 0;
}

.app-preview {
  position: relative;
  height: 224px;
  overflow: hidden;
  background: linear-gradient(145deg, #eaf1fb, #dfe8f5);
}

.app-preview > img {
  display: block;
  width: 100%;
  height: 100%;
  transition: transform .35s ease;
}

.preview-fit-contain > img {
  object-fit: contain;
  object-position: center;
}

.preview-fit-cover > img {
  object-fit: cover;
  object-position: top center;
}

.app-card:hover .app-preview > img {
  transform: scale(1.025);
}

.app-card:hover .preview-fit-contain > img {
  transform: none;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 9px;
  overflow: hidden;
  color: rgba(255,255,255,.94);
}

.preview-empty::before {
  content: "";
  position: absolute;
  inset: 18px;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.025));
  backdrop-filter: blur(6px);
}

.preview-empty strong,
.preview-empty small {
  position: relative;
  z-index: 1;
}

.preview-empty strong {
  display: grid;
  width: 70px;
  height: 70px;
  place-items: center;
  border: 1px solid rgba(255,255,255,.28);
  border-radius: 22px;
  background: rgba(255,255,255,.14);
  font-size: 24px;
  box-shadow: 0 16px 36px rgba(0,0,0,.2);
}

.preview-empty small {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .16em;
  opacity: .76;
}

.preview-empty-orbit {
  position: absolute;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 50%;
}

.orbit-one {
  width: 210px;
  height: 210px;
  transform: rotate(16deg);
}

.orbit-two {
  width: 290px;
  height: 120px;
  transform: rotate(-18deg);
}

.preview-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 58%, rgba(11, 21, 37, .3));
  pointer-events: none;
}

.preview-indigo { background: linear-gradient(145deg, #131c39, #302a7d); }
.preview-green { background: linear-gradient(145deg, #071c20, #0c4c3d); }
.preview-violet { background: linear-gradient(145deg, #6f4bf2, #b36df2); }
.preview-navy { background: linear-gradient(145deg, #0e1b30, #1d4478); }
.preview-cyan { background: linear-gradient(145deg, #071320, #0a4d67); }
.preview-purple { background: linear-gradient(145deg, #6440c8, #9b61f3); }
.preview-orange { background: linear-gradient(145deg, #0e2340, #c96633); }
.preview-blue { background: linear-gradient(145deg, #1769e0, #62a0ff); }

.preview-badge,
.preview-icon {
  position: absolute;
  z-index: 2;
}

.preview-badge {
  top: 12px;
  left: 12px;
  padding: 4px 8px;
  border: 1px solid rgba(255,255,255,.46);
  border-radius: 999px;
  background: rgba(10, 22, 39, .62);
  color: #fff;
  font-size: 10px;
  font-weight: 750;
  backdrop-filter: blur(8px);
}

.preview-icon {
  right: 12px;
  bottom: 10px;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(255,255,255,.42);
  border-radius: 9px;
  background: rgba(255,255,255,.92);
  color: #1c5fd4;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 20px rgba(8, 20, 38, .18);
}

.app-content {
  padding: 19px 20px 18px;
}

.app-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-title-row h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--market-ink);
  font-size: 18px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-dot {
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(22, 163, 74, .1);
  color: #16823c;
  font-size: 10px;
  font-weight: 750;
}

:global(html.dark .app-market .online-dot) {
  color: #55d889;
}

.app-content > p {
  display: -webkit-box;
  min-height: 46px;
  margin: 10px 0 16px;
  overflow: hidden;
  color: var(--market-muted);
  font-size: 13px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.app-content footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.type-tag {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(31, 111, 235, .09);
  color: var(--market-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.app-stats {
  flex: 1 1 auto;
  color: var(--market-muted);
  font-size: 10.5px;
  white-space: nowrap;
}

.app-content footer button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--market-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
}

.market-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 36px;
  margin-top: 26px;
  color: var(--market-muted);
  font-size: 12px;
}

.market-pagination button {
  min-width: 76px;
  height: 34px;
  border: 1px solid var(--market-line);
  border-radius: 8px;
  background: var(--market-card);
  color: var(--market-ink);
  cursor: pointer;
}

.market-pagination button:disabled {
  cursor: not-allowed;
  opacity: .42;
}

.app-card-skeleton {
  cursor: default;
  pointer-events: none;
}

.skeleton-block {
  overflow: hidden;
  border-radius: 8px;
  background: color-mix(in srgb, var(--market-line) 78%, var(--market-card));
}

.skeleton-block::after {
  content: "";
  display: block;
  width: 45%;
  height: 100%;
  transform: translateX(-160%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
  animation: skeleton-shimmer 1.35s ease-in-out infinite;
}

:global(html.dark .app-market .skeleton-block::after) {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent);
}

.skeleton-preview {
  height: 224px;
  border-radius: 0;
}

.app-market-home .skeleton-preview {
  height: 204px;
}

.skeleton-title {
  width: 52%;
  height: 20px;
  margin-bottom: 16px;
}

.skeleton-line {
  width: 100%;
  height: 11px;
  margin-bottom: 10px;
}

.skeleton-line.short {
  width: 72%;
}

.skeleton-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 21px;
}

.skeleton-chip {
  width: 64px;
  height: 22px;
  border-radius: 999px;
}

.skeleton-action {
  width: 70px;
  height: 22px;
}

@keyframes skeleton-shimmer {
  to { transform: translateX(340%); }
}

@media (prefers-reduced-motion: reduce) {
  .market-more-glow::before,
  .app-grid-refreshing::before,
  .skeleton-block::after {
    animation: none;
  }

  .app-card,
  .app-preview > img,
  .market-more-glow {
    transition: none;
  }
}

@media (max-width: 960px) {
  .app-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .app-market {
    padding: 54px 16px 64px;
  }

  .market-heading,
  .market-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .market-heading {
    width: 100%;
  }

  .market-more-glow {
    align-self: stretch;
  }

  .market-toolbar,
  .market-search {
    width: 100%;
  }

  .filter-group {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-group > span {
    width: auto;
  }

  .market-pagination {
    gap: 9px;
  }

  .market-pagination button {
    min-width: 66px;
  }
}

@media (max-width: 520px) {
  .app-grid {
    grid-template-columns: 1fr;
  }

  .app-preview,
  .skeleton-preview {
    height: 204px;
  }

  .market-pagination {
    font-size: 11px;
  }
}
</style>
