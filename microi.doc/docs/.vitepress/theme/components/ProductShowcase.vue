<template>
  <section v-if="shouldRender" id="ai-apps" class="ai-app-market" aria-labelledby="ai-app-market-title">
    <div class="ai-app-shell">
      <header class="ai-app-heading">
        <h2 id="ai-app-market-title">{{ copy.apps }}</h2>
        <div class="ai-app-toolbar">
          <div class="ai-app-categories" role="radiogroup" :aria-label="copy.categories">
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
          <div class="ai-app-controls">
            <div ref="sortRoot" class="ai-app-sort" @keydown.esc="closeSortMenu">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h8M8 18h4"/><path d="M4 4v16m0 0-2.5-2.5M4 20l2.5-2.5"/></svg>
              <span>{{ copy.sort }}</span>
              <button
                type="button"
                class="ai-app-sort-trigger"
                aria-haspopup="listbox"
                :aria-expanded="sortMenuOpen"
                :aria-label="copy.sortLabel"
                @click.stop="toggleSortMenu"
              >
                <strong>{{ selectedSortLabel }}</strong>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>
              </button>
              <div v-if="sortMenuOpen" class="ai-app-sort-menu" role="listbox" :aria-label="copy.sortLabel">
                <button
                  v-for="item in sortOptions"
                  :key="item.value"
                  type="button"
                  role="option"
                  :aria-selected="sortBy === item.value"
                  :class="{ active: sortBy === item.value }"
                  @click.stop="selectSort(item.value)"
                >
                  <span>{{ item.label }}</span>
                  <svg v-if="sortBy === item.value" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
                </button>
              </div>
            </div>
            <label class="ai-app-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <span class="sr-only">{{ copy.search }}</span>
              <input v-model="keyword" type="search" :placeholder="copy.search" @input="scheduleKeywordSearch" />
            </label>
          </div>
        </div>
      </header>

      <div v-if="showInitialSkeleton" class="ai-app-grid" aria-label="正在读取应用" aria-busy="true">
        <article v-for="index in pageSize" :key="index" class="ai-app-card ai-app-card-skeleton">
          <div class="skeleton skeleton-preview"></div>
          <div class="skeleton-meta">
            <span class="skeleton skeleton-avatar"></span>
            <div><span class="skeleton skeleton-name"></span><span class="skeleton skeleton-copy"></span></div>
          </div>
        </article>
      </div>

      <div v-else-if="loadError && !liveApps.length" class="ai-app-state">
        <p>{{ loadError }}</p>
        <button type="button" @click="resetAndLoad">重新加载</button>
      </div>
      <div v-else-if="!liveApps.length" class="ai-app-state">{{ copy.empty }}</div>

      <div v-else class="ai-app-grid" :aria-busy="isLoading">
        <article
          v-for="app in liveApps"
          :key="app.Id || app.AppKey"
          class="ai-app-card"
          tabindex="0"
          @click="openDetail(app)"
          @keydown.enter="openDetail(app)"
        >
          <div class="ai-app-preview" :class="previewFitClass(app.ApplicationType)">
            <img
              v-if="app.AppPreviewUrl && !brokenPreviewKeys.has(app.AppKey)"
              :src="app.AppPreviewUrl"
              :alt="`${app.Name}应用预览图`"
              loading="lazy"
              decoding="async"
              @error="markPreviewBroken(app.AppKey)"
            />
            <div v-else class="ai-app-preview-fallback" aria-hidden="true">
              <span>{{ app.icon }}</span>
              <small>MICROI AI</small>
            </div>
            <div class="ai-app-stats" aria-label="应用数据">
              <span :title="`${app.ViewCount} 次浏览`">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                {{ compactNumber(app.ViewCount) }}
              </span>
              <span :title="`${app.InstallCount} 次下载`">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2"/></svg>
                {{ compactNumber(app.InstallCount) }}
              </span>
              <button
                type="button"
                class="ai-app-favorite"
                :class="{ active: favoriteIds.has(app.Id), busy: favoriteBusyIds.has(app.Id) }"
                :disabled="favoriteBusyIds.has(app.Id)"
                :title="favoriteIds.has(app.Id) ? '取消收藏' : '收藏应用'"
                @click.stop="setFavorite(app)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>
                {{ compactNumber(app.FavoriteCount) }}
              </button>
            </div>
          </div>
          <div class="ai-app-meta">
            <div class="ai-app-author-avatar" aria-hidden="true">
              <img v-if="app.AuthorAvatarUrl" :src="app.AuthorAvatarUrl" alt="" loading="lazy" />
              <span v-else>{{ app.authorInitial }}</span>
            </div>
            <div class="ai-app-copy">
              <div class="ai-app-name-row">
                <h3>{{ app.Name }}</h3>
                <span class="ai-app-member" :class="app.memberTone" :title="app.memberLabel" aria-label="会员标识">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.4 2.1 3.2-.3.9 3.1 2.8 1.7-1.3 3 1.3 3-2.8 1.7-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.7 1.3-3-1.3-3 2.8-1.7.9-3.1 3.2.3L12 2Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
                </span>
                <span class="ai-app-author">{{ app.AppAuthor }}</span>
              </div>
              <p :title="app.Description">{{ app.Description }}</p>
            </div>
          </div>
        </article>
      </div>

      <div ref="sentinel" class="ai-app-sentinel" aria-live="polite">
        <span v-if="isLoading && liveApps.length" class="ai-app-loading"><i></i>{{ copy.loadingMore }}</span>
        <button v-else-if="loadError && liveApps.length" type="button" @click="loadApplications">{{ copy.retry }}</button>
        <span v-else-if="liveApps.length && !hasMore" class="ai-app-finished">{{ copy.finished }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import { OFFICIAL_MICROI_API_BASE } from '../utils/site-api-base.js'

const props = defineProps({
  locale: { type: String, default: 'zh-CN' }
})
const route = useRoute()
// 官网应用广场始终读取 iTdos 的公开白名单接口，避免本地开发 API 误指向其它租户。
const API_BASE = OFFICIAL_MICROI_API_BASE
const OS_CLIENT = 'iTdos'
const pageSize = 12

const liveApps = ref([])
const activeCategory = ref('all')
const keyword = ref('')
const sortBy = ref('AppUpdateTime')
const pageIndex = ref(1)
const totalCount = ref(0)
const hasMore = ref(true)
const isLoading = ref(false)
const loadError = ref('')
const fileServer = ref('')
const sentinel = ref(null)
const sortRoot = ref(null)
const sortMenuOpen = ref(false)
const brokenPreviewKeys = ref(new Set())
const favoriteIds = ref(new Set())
const favoriteBusyIds = ref(new Set())
const authToken = ref('')
let requestController = null
let keywordTimer = null
let observer = null
let requestSequence = 0

const isEnglish = computed(() => props.locale === 'en-US' || /^\/en(?:\/|$)/.test(route.path || ''))
const copy = computed(() => isEnglish.value ? {
  apps: 'AI Apps', categories: 'App categories', sort: 'Sort', sortLabel: 'Sort applications', search: 'Search apps',
  empty: 'No matching applications found.', loadingMore: 'Loading more applications', retry: 'Loading failed, retry', finished: 'All applications loaded'
} : {
  apps: 'AI 应用', categories: '应用分类', sort: '排序', sortLabel: '应用排序', search: '搜索应用',
  empty: '没有找到匹配的应用。', loadingMore: '正在加载更多应用', retry: '加载失败，点击重试', finished: '已加载全部应用'
})

const defaultBusinessCategories = [
  { label: '全部', value: 'all' },
  { label: '企业应用', value: 'business' },
  { label: '办公协同', value: 'office' },
  { label: '数据分析', value: 'data' },
  { label: '效率工具', value: 'tools' },
  { label: '行业应用', value: 'industry' },
  { label: '教育学习', value: 'education' },
  { label: '生活服务', value: 'lifestyle' },
  { label: '游戏', value: 'game' },
  { label: '创意设计', value: 'creative' },
  { label: '营销运营', value: 'marketing' },
  { label: '平台能力', value: 'platform' },
  { label: '其它', value: 'other' }
]
const businessCategories = ref(defaultBusinessCategories)
const categoryEnglishLabels = { all: 'All', business: 'Business', office: 'Collaboration', data: 'Analytics', tools: 'Productivity', industry: 'Industry', education: 'Education', lifestyle: 'Lifestyle', game: 'Games', creative: 'Creative', marketing: 'Marketing', platform: 'Platform', other: 'Other' }
const sortOptions = computed(() => isEnglish.value ? [
  { label: 'Recently updated', value: 'AppUpdateTime' },
  { label: 'Recently published', value: 'AppPublishTime' },
  { label: 'Most viewed', value: 'ViewCount' },
  { label: 'Most downloaded', value: 'InstallCount' },
  { label: 'Most favorited', value: 'FavoriteCount' }
] : [
  { label: '最近更新', value: 'AppUpdateTime' },
  { label: '最新发布', value: 'AppPublishTime' },
  { label: '浏览最多', value: 'ViewCount' },
  { label: '下载最多', value: 'InstallCount' },
  { label: '收藏最多', value: 'FavoriteCount' }
])
const selectedSortLabel = computed(() => sortOptions.value.find(item => item.value === sortBy.value)?.label || sortOptions.value[0]?.label || '')

const currentPath = computed(() => route.path || (typeof window !== 'undefined' ? window.location.pathname : ''))
const shouldRender = computed(() => ['/', '/index', '/index.html', '/en/', '/en/index', '/en/index.html', '/apps', '/apps.html'].includes(currentPath.value))
const showInitialSkeleton = computed(() => isLoading.value && !liveApps.value.length)

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
      const path = normalizeUploadValue(item, depth + 1)
      if (path) return path
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['Path', 'FilePathName', 'FullPath', 'Url', 'url', 'src']) {
      const path = normalizeUploadValue(value[key], depth + 1)
      if (path) return path
    }
    return ''
  }
  const source = String(value).trim()
  if (!source) return ''
  if (/^[{[]/.test(source)) {
    try { return normalizeUploadValue(JSON.parse(source), depth + 1) } catch (_) { return source }
  }
  return source.replace(/^['"]|['"]$/g, '')
}

function resolveAssetUrl(value) {
  const path = normalizeUploadValue(value)
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  if (path.startsWith('/file/')) return `${API_BASE.replace(/\/+$/, '')}${path}`
  const server = fileServer.value.replace(/\/+$/, '')
  return server ? `${server}/${path.replace(/^\/+/, '')}` : path
}

function normalizeApp(app) {
  const name = plainText(app.AppName || app.Name) || '未命名应用'
  const category = app.Category || 'other'
  const iconMap = { business: '企', office: '办', data: '数', tools: '工', industry: '业', education: '学', lifestyle: '生', game: '游', creative: '创', marketing: '营', platform: 'M', other: 'AI' }
  const publisher = plainText(app.PublisherType)
  const isOfficial = /官方|平台/.test(publisher)
  const author = plainText(app.AppAuthor) || 'Microi Creator'
  return {
    ...app,
    Id: String(app.Id || ''),
    AppKey: String(app.AppKey || app.Id || ''),
    ApplicationType: String(app.ApplicationType || app.AppType || 'Platform'),
    Name: name,
    Description: plainText(app.Description) || '基于 Microi吾码 构建的 AI 应用。',
    AppAuthor: author,
    AppPreviewUrl: resolveAssetUrl(app.AppPreview),
    AuthorAvatarUrl: resolveAssetUrl(app.AppAuthorAvatar),
    authorInitial: author.slice(0, 1).toUpperCase(),
    memberLabel: isOfficial ? 'Microi 官方会员' : 'Microi 创作者会员',
    memberTone: isOfficial ? 'official' : 'creator',
    icon: iconMap[category] || 'AI',
    ViewCount: Number(app.ViewCount || 0),
    InstallCount: Number(app.InstallCount || 0),
    FavoriteCount: Number(app.FavoriteCount || 0)
  }
}

function keyValueOptions(value) {
  const localize = item => isEnglish.value ? { ...item, label: categoryEnglishLabels[item.value] || item.label } : item
  if (!Array.isArray(value) || !value.length) return defaultBusinessCategories.map(localize)
  const normalized = value
    .map(item => ({ label: String(item?.Value || '').trim(), value: String(item?.Key || '').trim() }))
    .filter(item => item.label && item.value)
    .map(localize)
  return normalized.length ? [{ label: isEnglish.value ? 'All' : '全部', value: 'all' }, ...normalized] : defaultBusinessCategories.map(localize)
}

function compactNumber(value) {
  const number = Number(value || 0)
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}w`
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`
  return String(number)
}

function previewFitClass(applicationType) {
  const normalizedType = String(applicationType || '').toLowerCase()
  return normalizedType === 'uniapp' || normalizedType === 'web'
    ? 'preview-fit-contain'
    : 'preview-fit-cover'
}

function normalizeToken(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim()
}

function syncAuth() {
  if (typeof window === 'undefined') return
  const token = normalizeToken(localStorage.getItem('microi_doc_token'))
  let hasUser = false
  try { hasUser = Boolean(JSON.parse(localStorage.getItem('microi_doc_user') || 'null')?.Id) } catch (_) {}
  authToken.value = token && hasUser ? token : ''
  if (!authToken.value) favoriteIds.value = new Set()
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}`, Token: authToken.value } : {}
}

async function loadFavoriteStatus(appIds) {
  if (!authToken.value || !appIds.length) return
  try {
    const response = await fetch(`${API_BASE}/apiengine/official_ai_app_favorite?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ Action: 'Status', AppIds: appIds })
    })
    const result = await response.json()
    if (result.Code !== 1) return
    const next = new Set(favoriteIds.value)
    for (const id of result.Data?.FavoriteIds || []) next.add(String(id))
    favoriteIds.value = next
  } catch (_) {
    // 收藏状态不阻塞公开应用列表。
  }
}

async function loadApplications() {
  if (!shouldRender.value || isLoading.value || !hasMore.value) return
  const sequence = ++requestSequence
  isLoading.value = true
  loadError.value = ''
  requestController = new AbortController()
  try {
    const payload = {
      PageIndex: pageIndex.value,
      PageSize: pageSize,
      SortBy: sortBy.value,
      SortOrder: 'DESC'
    }
    if (activeCategory.value !== 'all') payload.Category = activeCategory.value
    if (keyword.value.trim()) payload.Keyword = keyword.value.trim()
    const response = await fetch(`${API_BASE}/apiengine/official_ai_apps?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: requestController.signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (result.Code !== 1 || !Array.isArray(result.Data)) throw new Error(result.Msg || '应用读取失败')
    if (sequence !== requestSequence) return
    fileServer.value = String(result.DataAppend?.FileServer || '').trim()
    businessCategories.value = keyValueOptions(result.DataAppend?.Categories)
    totalCount.value = Number(result.DataCount || 0)
    const rows = result.Data.map(normalizeApp)
    const known = new Set(liveApps.value.map(item => item.Id || item.AppKey))
    const appended = rows.filter(item => !known.has(item.Id || item.AppKey))
    liveApps.value = [...liveApps.value, ...appended]
    hasMore.value = rows.length === pageSize && liveApps.value.length < totalCount.value
    pageIndex.value += 1
    await loadFavoriteStatus(appended.map(item => item.Id).filter(Boolean))
  } catch (error) {
    if (error?.name !== 'AbortError' && sequence === requestSequence) loadError.value = `AI 应用暂时无法读取：${error?.message || '网络异常'}`
  } finally {
    if (sequence === requestSequence) {
      isLoading.value = false
      maybeLoadVisibleSentinel()
    }
  }
}

function maybeLoadVisibleSentinel() {
  if (!hasMore.value || typeof window === 'undefined') return
  nextTick(() => {
    const rect = sentinel.value?.getBoundingClientRect()
    if (rect && rect.top <= window.innerHeight + 600 && rect.bottom >= -600) loadApplications()
  })
}

function resetAndLoad() {
  requestController?.abort()
  requestSequence += 1
  // 中止请求后旧请求的 finally 会因 sequence 失效而跳过清理；
  // 必须在这里主动释放加载锁，否则下一次筛选会被 isLoading 直接拦截。
  isLoading.value = false
  requestController = null
  liveApps.value = []
  pageIndex.value = 1
  totalCount.value = 0
  hasMore.value = true
  loadError.value = ''
  brokenPreviewKeys.value = new Set()
  nextTick(loadApplications)
}

function selectCategory(value) {
  if (activeCategory.value === value) return
  activeCategory.value = value
  resetAndLoad()
}

function toggleSortMenu() {
  sortMenuOpen.value = !sortMenuOpen.value
}

function closeSortMenu() {
  sortMenuOpen.value = false
}

function selectSort(value) {
  closeSortMenu()
  if (sortBy.value === value) return
  sortBy.value = value
  resetAndLoad()
}

function handleDocumentPointerDown(event) {
  if (!sortMenuOpen.value || sortRoot.value?.contains(event.target)) return
  closeSortMenu()
}

function scheduleKeywordSearch() {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(resetAndLoad, 320)
}

function markPreviewBroken(key) {
  const next = new Set(brokenPreviewKeys.value)
  next.add(key)
  brokenPreviewKeys.value = next
}

function openDetail(app) {
  if (typeof window !== 'undefined') window.location.href = `/app-detail.html?app=${encodeURIComponent(app.AppKey || app.Id)}`
}

async function setFavorite(app) {
  if (!authToken.value) {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}#ai-apps`)
    window.location.href = `/login.html?redirect=${redirect}`
    return
  }
  const nextBusy = new Set(favoriteBusyIds.value)
  nextBusy.add(app.Id)
  favoriteBusyIds.value = nextBusy
  const desired = !favoriteIds.value.has(app.Id)
  try {
    const response = await fetch(`${API_BASE}/apiengine/official_ai_app_favorite?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ Action: 'Set', AppId: app.Id, IsFavorite: desired })
    })
    const result = await response.json()
    if (result.Code !== 1) {
      if ([1001, 1002].includes(Number(result.Code)) || /登录|权限|Token/i.test(result.Msg || '')) {
        authToken.value = ''
        window.location.href = `/login.html?redirect=${encodeURIComponent(`${window.location.pathname}#ai-apps`)}`
        return
      }
      throw new Error(result.Msg || '收藏失败')
    }
    const next = new Set(favoriteIds.value)
    if (result.Data?.IsFavorite) next.add(app.Id)
    else next.delete(app.Id)
    favoriteIds.value = next
    app.FavoriteCount = Number(result.Data?.FavoriteCount || 0)
  } catch (error) {
    loadError.value = error?.message || '收藏失败，请稍后重试'
  } finally {
    const cleared = new Set(favoriteBusyIds.value)
    cleared.delete(app.Id)
    favoriteBusyIds.value = cleared
  }
}

function setupObserver() {
  observer?.disconnect()
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadApplications()
  }, { rootMargin: '600px 0px' })
  observer.observe(sentinel.value)
}

function handleAuthChange() {
  syncAuth()
  if (authToken.value) loadFavoriteStatus(liveApps.value.map(item => item.Id).filter(Boolean))
}

watch(currentPath, resetAndLoad)

onMounted(() => {
  syncAuth()
  setupObserver()
  window.addEventListener('storage', handleAuthChange)
  window.addEventListener('microi-login-success', handleAuthChange)
  window.addEventListener('microi-logout', handleAuthChange)
  window.addEventListener('microi-token-refreshed', handleAuthChange)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  loadApplications()
})

onBeforeUnmount(() => {
  requestController?.abort()
  observer?.disconnect()
  if (keywordTimer) clearTimeout(keywordTimer)
  window.removeEventListener('storage', handleAuthChange)
  window.removeEventListener('microi-login-success', handleAuthChange)
  window.removeEventListener('microi-logout', handleAuthChange)
  window.removeEventListener('microi-token-refreshed', handleAuthChange)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<style scoped>
.ai-app-market { width: 100%; color: #f7f7f7; }
.ai-app-shell { width: min(1440px, calc(100% - 48px)); margin: 0 auto; padding: 30px 0 96px; }
.ai-app-heading { margin-bottom: 18px; }
.ai-app-heading h2 { margin: 0 0 18px; color: #f7f7f7; font-size: 22px; font-weight: 680; letter-spacing: -.02em; }
.ai-app-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.ai-app-categories { display: flex; flex: 1; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.ai-app-categories::-webkit-scrollbar { display: none; }
.ai-app-categories button { flex: 0 0 auto; min-height: 36px; padding: 0 14px; border: 1px solid #333; border-radius: 9px; background: transparent; color: #979797; font: inherit; font-size: 13px; cursor: pointer; transition: background-color .18s, border-color .18s, color .18s; }
.ai-app-categories button:hover, .ai-app-categories button:focus-visible { border-color: #525252; color: #f7f7f7; outline: none; }
.ai-app-categories button.active { border-color: #4a4a4a; background: #2c2c2c; color: #fff; }
.ai-app-controls { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }
.ai-app-sort { position: relative; z-index: 6; min-height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 7px 0 11px; border: 1px solid #3b3b3b; border-radius: 19px; background: rgba(20,20,20,.72); color: #858585; transition: border-color .18s, background-color .18s; }
.ai-app-sort:focus-within { border-color: #666; background: #1c1c1c; box-shadow: 0 0 0 3px rgba(255,255,255,.045); }
.ai-app-sort > svg { flex: 0 0 16px; width: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ai-app-sort > span { font-size: 11px; color: #727272; }
.ai-app-sort-trigger { min-width: 106px; min-height: 30px; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 7px 0 3px; border: 0; border-radius: 13px; outline: 0; background: transparent; color: #ececec; cursor: pointer; font: inherit; }
.ai-app-sort-trigger strong { font-size: 12px; font-weight: 650; white-space: nowrap; }
.ai-app-sort-trigger svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform .18s; }
.ai-app-sort-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }
.ai-app-sort-menu { position: absolute; z-index: 20; top: calc(100% + 9px); right: 0; width: 176px; padding: 6px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: rgba(31,31,31,.98); box-shadow: 0 18px 44px rgba(0,0,0,.38); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.ai-app-sort-menu button { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: #aaa; cursor: pointer; font: inherit; font-size: 12px; text-align: left; }
.ai-app-sort-menu button:hover, .ai-app-sort-menu button:focus-visible { outline: 0; background: rgba(255,255,255,.07); color: #fff; }
.ai-app-sort-menu button.active { background: rgba(244,211,94,.1); color: #fff4c8; }
.ai-app-sort-menu svg { width: 15px; height: 15px; fill: none; stroke: #f4d35e; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ai-app-search { display: flex; flex: 0 0 250px; min-height: 38px; align-items: center; gap: 9px; padding: 0 13px; border: 1px solid #3b3b3b; border-radius: 19px; background: rgba(20,20,20,.7); }
.ai-app-search:focus-within { border-color: #6a6a6a; }
.ai-app-search svg { width: 17px; fill: none; stroke: #8a8a8a; stroke-width: 1.8; }
.ai-app-search input { width: 100%; border: 0; outline: 0; background: transparent; color: #f7f7f7; font: inherit; font-size: 13px; }
.ai-app-search input::placeholder { color: #777; }
.ai-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 16px; }
.ai-app-card { min-width: 0; cursor: pointer; border-radius: 12px; outline: none; }
.ai-app-card:focus-visible { box-shadow: 0 0 0 2px #f7f7f7; }
.ai-app-preview { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid #353535; border-radius: 12px; background: #171717; }
.ai-app-preview > img { width: 100%; height: 100%; display: block; transition: transform .35s ease, filter .35s ease; }
.preview-fit-contain > img { object-fit: contain; object-position: center; }
.preview-fit-cover > img { object-fit: cover; object-position: top center; }
.ai-app-card:hover .ai-app-preview > img, .ai-app-card:focus .ai-app-preview > img { transform: scale(1.025); filter: brightness(.72); }
.ai-app-card:hover .preview-fit-contain > img, .ai-app-card:focus .preview-fit-contain > img { transform: none; }
.ai-app-preview-fallback { width: 100%; height: 100%; display: grid; place-content: center; gap: 7px; text-align: center; background: radial-gradient(circle at 50% 30%, #333, #171717 65%); color: #e5e5e5; }
.ai-app-preview-fallback span { font-size: 42px; font-weight: 700; }
.ai-app-preview-fallback small { color: #777; font-size: 10px; letter-spacing: .18em; }
.ai-app-stats { position: absolute; z-index: 2; top: 10px; right: 10px; display: flex; align-items: center; gap: 6px; opacity: 0; transform: translateY(-5px); transition: opacity .18s, transform .18s; }
.ai-app-card:hover .ai-app-stats, .ai-app-card:focus-within .ai-app-stats { opacity: 1; transform: translateY(0); }
.ai-app-stats > span, .ai-app-stats > button { min-height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; background: rgba(13,13,13,.78); color: #f1f1f1; font: inherit; font-size: 12px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.ai-app-stats svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ai-app-favorite { cursor: pointer; }
.ai-app-favorite:hover { background: rgba(50,50,50,.92); }
.ai-app-favorite.active { color: #ff5c7c; }
.ai-app-favorite.active svg { fill: currentColor; }
.ai-app-favorite.busy { opacity: .55; cursor: wait; }
.ai-app-meta { display: flex; align-items: flex-start; gap: 10px; padding: 10px 6px 0; }
.ai-app-author-avatar { flex: 0 0 28px; width: 28px; height: 28px; overflow: hidden; display: grid; place-items: center; border: 1px solid #454545; border-radius: 50%; background: #282828; color: #d5d5d5; font-size: 12px; font-weight: 700; }
.ai-app-author-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ai-app-copy { min-width: 0; flex: 1; }
.ai-app-name-row { min-width: 0; display: flex; align-items: center; gap: 6px; height: 18px; }
.ai-app-name-row h3 { min-width: 0; overflow: hidden; margin: 0; color: #ececec; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.ai-app-member { flex: 0 0 15px; width: 15px; height: 15px; color: #26d8d8; }
.ai-app-member.creator { color: #a88cff; }
.ai-app-member svg { width: 100%; height: 100%; fill: currentColor; }
.ai-app-member svg path:last-child { fill: none; stroke: #141414; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ai-app-author { min-width: 0; margin-left: auto; overflow: hidden; color: #777; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.ai-app-copy p { overflow: hidden; margin: 5px 0 0; color: #8a8a8a; font-size: 12px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.ai-app-state { min-height: 220px; display: grid; place-content: center; gap: 12px; text-align: center; color: #888; }
.ai-app-state p { margin: 0; }
.ai-app-state button, .ai-app-sentinel button { min-height: 38px; padding: 0 16px; border: 1px solid #444; border-radius: 10px; background: #232323; color: #ddd; cursor: pointer; }
.ai-app-sentinel { min-height: 76px; display: grid; place-items: center; color: #696969; font-size: 12px; }
.ai-app-loading { display: inline-flex; align-items: center; gap: 8px; }
.ai-app-loading i { width: 14px; height: 14px; border: 2px solid #444; border-top-color: #eee; border-radius: 50%; animation: app-spin .8s linear infinite; }
.ai-app-finished { opacity: .75; }
.skeleton { display: block; border-radius: 8px; background: linear-gradient(100deg, #202020 20%, #2b2b2b 38%, #202020 56%); background-size: 220% 100%; animation: app-shimmer 1.4s linear infinite; }
.skeleton-preview { aspect-ratio: 16 / 9; border-radius: 12px; }
.skeleton-meta { display: flex; gap: 10px; padding: 10px 6px 0; }
.skeleton-avatar { width: 28px; height: 28px; border-radius: 50%; }
.skeleton-meta > div { flex: 1; }
.skeleton-name { width: 45%; height: 12px; margin: 1px 0 7px; }
.skeleton-copy { width: 86%; height: 9px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
@keyframes app-shimmer { to { background-position-x: -220%; } }
@keyframes app-spin { to { transform: rotate(360deg); } }
@media (max-width: 1180px) { .ai-app-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 1080px) { .ai-app-toolbar { align-items: stretch; flex-direction: column-reverse; gap: 12px; } .ai-app-controls { justify-content: flex-end; } }
@media (max-width: 900px) { .ai-app-controls { justify-content: flex-start; } .ai-app-search { flex-basis: auto; width: min(100%, 360px); } .ai-app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .ai-app-shell { width: min(100% - 28px, 1440px); padding-bottom: 64px; } .ai-app-controls { align-items: stretch; flex-direction: column; } .ai-app-sort, .ai-app-search { width: 100%; box-sizing: border-box; } .ai-app-sort-trigger { flex: 1; } .ai-app-sort-menu { left: 0; right: 0; width: auto; } .ai-app-grid { grid-template-columns: 1fr; gap: 24px; } .ai-app-stats { opacity: 1; transform: none; } .ai-app-author { max-width: 90px; } }
@media (prefers-reduced-motion: reduce) { .ai-app-preview > img, .ai-app-stats, .skeleton, .ai-app-loading i { transition: none; animation: none; } }
</style>
