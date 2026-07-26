<template>
  <ClientOnly>
    <main v-if="isDetailPage" class="app-detail-page">
      <div class="app-detail-shell">
        <a class="app-detail-back" href="/apps.html">
          <span aria-hidden="true">←</span>
          返回 AI 应用
        </a>

        <div v-if="loading" class="app-detail-state">正在读取应用详情...</div>
        <div v-else-if="errorMessage" class="app-detail-state app-detail-error">
          <strong>暂时无法打开应用详情</strong>
          <span>{{ errorMessage }}</span>
        </div>

        <template v-else-if="app">
          <section class="app-detail-hero">
            <div class="app-detail-icon" :class="`tone-${app.tone}`">{{ app.icon }}</div>
            <div class="app-detail-summary">
              <span class="app-detail-eyebrow">{{ typeLabel(app.ApplicationType) }}</span>
              <h1>{{ app.Name }}</h1>
              <p>{{ app.Description }}</p>
              <div class="app-detail-meta">
                <span>{{ categoryLabel(app.Category) }}</span>
                <span>{{ app.AppAuthor || app.OwnerName || 'Microi吾码' }}</span>
                <span>{{ app.AppVersion || `v${app.CurrentVersion || 1}.0.0` }}</span>
              </div>
            </div>
            <div class="app-detail-actions">
              <button v-if="app.PreviewUrl" type="button" class="primary" @click="openPreview">
                立即体验
                <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                class="favorite"
                :class="{ active: isFavorite }"
                :disabled="favoriteBusy"
                @click="setFavorite"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>
                {{ isFavorite ? '已收藏' : '收藏应用' }} · {{ formatNumber(app.FavoriteCount) }}
              </button>
              <a class="secondary" href="/apps.html">浏览更多应用</a>
            </div>
          </section>
          <p v-if="favoriteMessage" class="app-detail-action-message" role="status">{{ favoriteMessage }}</p>

          <section class="app-detail-facts" aria-label="应用数据">
            <article>
              <strong>{{ formatNumber(app.ViewCount) }}</strong>
              <span>浏览次数</span>
            </article>
            <article>
              <strong>{{ formatNumber(app.InstallCount) }}</strong>
              <span>安装次数</span>
            </article>
            <article>
              <strong>{{ formatNumber(app.FavoriteCount) }}</strong>
              <span>收藏次数</span>
            </article>
            <article>
              <strong>{{ typeLabel(app.ApplicationType) }}</strong>
              <span>应用类型</span>
            </article>
            <article>
              <strong>{{ updatedDate }}</strong>
              <span>最近更新</span>
            </article>
          </section>

          <section class="app-detail-content">
            <div class="app-detail-preview-card">
              <header>
                <div>
                  <span>APP PREVIEW</span>
                  <h2>应用预览</h2>
                </div>
                <button v-if="app.PreviewUrl" type="button" @click="openPreview">新窗口打开</button>
              </header>
              <div v-if="app.PreviewUrl && app.ApplicationType !== 'Platform'" class="app-detail-browser">
                <div class="browser-bar">
                  <i></i><i></i><i></i>
                  <span>{{ app.Name }}</span>
                </div>
                <iframe
                  :src="versionedPreviewUrl"
                  :title="`${app.Name}在线预览`"
                  loading="eager"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
              <div v-else class="app-detail-platform">
                <div class="app-detail-icon small" :class="`tone-${app.tone}`">{{ app.icon }}</div>
                <strong>{{ app.Name }}</strong>
                <p>这是吾码平台能力应用，安装后会合并到对应的后台模块中。</p>
              </div>
            </div>

            <aside class="app-detail-about">
              <span>ABOUT THIS APP</span>
              <h2>关于此应用</h2>
              <p>{{ app.Description }}</p>
              <dl>
                <div>
                  <dt>应用 Key</dt>
                  <dd>{{ app.AppKey }}</dd>
                </div>
                <div>
                  <dt>发布状态</dt>
                  <dd>已上线</dd>
                </div>
                <div>
                  <dt>应用分类</dt>
                  <dd>{{ categoryLabel(app.Category) }}</dd>
                </div>
                <div>
                  <dt>运行方式</dt>
                  <dd>公有 HDFS 在线访问</dd>
                </div>
              </dl>
            </aside>
          </section>
        </template>
      </div>
    </main>
  </ClientOnly>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vitepress'
import { withPreviewVersion } from '../utils/app-preview-url.js'
import { OFFICIAL_MICROI_API_BASE } from '../utils/site-api-base.js'

const route = useRoute()
// 应用详情与列表使用同一官方公开源，防止开发环境误读其它租户。
const APP_API_BASE = OFFICIAL_MICROI_API_BASE
const OS_CLIENT = 'iTdos'

const app = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const authToken = ref('')
const isFavorite = ref(false)
const favoriteBusy = ref(false)
const favoriteMessage = ref('')

const isDetailPage = computed(() => ['/app-detail', '/app-detail.html'].includes(route.path || ''))
const updatedDate = computed(() => {
  const value = app.value?.AppUpdateTime || app.value?.UpdateTime
  return value ? String(value).slice(0, 10) : '持续更新'
})
const versionedPreviewUrl = computed(() => withPreviewVersion(
  app.value?.PreviewUrl,
  app.value || {},
  typeof window === 'undefined' ? 'https://microi.net' : window.location.origin,
  { apiBase: APP_API_BASE, osClient: OS_CLIENT }
))

function queryAppKey() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('app') || ''
}

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

function normalizeApp(item) {
  const applicationType = item.ApplicationType || item.AppType || 'Web'
  const category = item.Category || (applicationType === 'Platform' ? 'platform' : 'other')
  const iconMap = {
    game: '游', business: '企', office: '办', education: '学', tools: '工',
    lifestyle: '生', creative: '创', data: '数', marketing: '营', industry: '业',
    platform: 'M', other: 'AI'
  }
  const toneMap = {
    game: 'indigo', business: 'navy', office: 'blue', education: 'violet',
    tools: 'cyan', lifestyle: 'green', creative: 'purple', data: 'cyan',
    marketing: 'orange', industry: 'navy', platform: 'indigo', other: 'blue'
  }
  return {
    ...item,
    Name: item.AppName || item.Name,
    Description: plainText(item.AppDetail || item.Description) || '基于 Microi吾码构建的在线应用。',
    AppKey: item.AppKey || item.AppId,
    ApplicationType: applicationType,
    Category: category,
    icon: iconMap[category] || 'AI',
    tone: toneMap[category] || 'blue',
    ViewCount: Number(item.ViewCount || 0),
    InstallCount: Number(item.InstallCount || 0),
    FavoriteCount: Number(item.FavoriteCount || 0)
  }
}

function normalizeToken(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim()
}

function syncAuth() {
  if (typeof window === 'undefined') return
  let hasUser = false
  try { hasUser = Boolean(JSON.parse(localStorage.getItem('microi_doc_user') || 'null')?.Id) } catch (_) {}
  const token = normalizeToken(localStorage.getItem('microi_doc_token'))
  authToken.value = token && hasUser ? token : ''
  if (!authToken.value) isFavorite.value = false
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}`, Token: authToken.value } : {}
}

function syncTokenFromResponse(response) {
  const token = normalizeToken(response?.headers?.get?.('authorization'))
  if (!token || token === authToken.value) return
  authToken.value = token
  localStorage.setItem('microi_doc_token', token)
  window.dispatchEvent(new CustomEvent('microi-token-refreshed'))
}

function isSessionExpired(result) {
  return [1001, 1002].includes(Number(result?.Code)) || /登录|权限|Token/i.test(result?.Msg || '')
}

async function loadFavoriteStatus() {
  if (!authToken.value || !app.value?.Id) return
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_app_favorite?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ Action: 'Status', AppIds: [app.value.Id] })
    })
    syncTokenFromResponse(response)
    const result = await response.json()
    if (isSessionExpired(result)) {
      authToken.value = ''
      return
    }
    if (result.Code === 1) {
      isFavorite.value = (result.Data?.FavoriteIds || []).map(String).includes(String(app.value.Id))
    }
  } catch (_) {
    // 收藏状态不阻断公开详情。
  }
}

async function setFavorite() {
  if (!app.value || favoriteBusy.value) return
  favoriteMessage.value = ''
  if (!authToken.value) {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.href = `/login.html?redirect=${redirect}`
    return
  }
  favoriteBusy.value = true
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_app_favorite?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ Action: 'Set', AppId: app.value.Id, IsFavorite: !isFavorite.value })
    })
    syncTokenFromResponse(response)
    const result = await response.json()
    if (result.Code !== 1) {
      if (isSessionExpired(result)) {
        authToken.value = ''
        window.location.href = `/login.html?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
        return
      }
      throw new Error(result.Msg || '收藏失败')
    }
    isFavorite.value = Boolean(result.Data?.IsFavorite)
    app.value.FavoriteCount = Number(result.Data?.FavoriteCount || 0)
    favoriteMessage.value = isFavorite.value ? '已加入收藏' : '已取消收藏'
  } catch (error) {
    favoriteMessage.value = error?.message || '收藏失败，请稍后重试'
  } finally {
    favoriteBusy.value = false
  }
}

async function loadApp() {
  if (!isDetailPage.value || loading.value) return
  const appKey = queryAppKey()
  if (!appKey) {
    errorMessage.value = '缺少应用标识，请从 AI 应用列表重新进入。'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_apps?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OsClient: OS_CLIENT, Keyword: appKey, PageIndex: 1, PageSize: 500 })
    })
    const result = await response.json()
    if (result.Code !== 1 || !Array.isArray(result.Data)) throw new Error(result.Msg || '应用读取失败')
    const matched = result.Data.find(item => String(item.AppKey || item.AppId) === appKey)
    if (!matched) throw new Error('应用不存在或尚未发布')
    app.value = normalizeApp(matched)
    await Promise.all([recordView(), loadFavoriteStatus()])
  } catch (error) {
    errorMessage.value = error?.message || '网络异常'
  } finally {
    loading.value = false
  }
}

async function recordView() {
  if (!app.value) return
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_marketplace_app_open?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OsClient: OS_CLIENT, AppId: app.value.Id, AppKey: app.value.AppKey })
    })
    const result = await response.json()
    if (result.Code === 1 && result.Data) {
      app.value.ViewCount = Number(result.Data.ViewCount || app.value.ViewCount)
      app.value.InstallCount = Number(result.Data.InstallCount || app.value.InstallCount)
      app.value.PreviewUrl = result.Data.PreviewUrl || app.value.PreviewUrl
    }
  } catch (_) {
    // 浏览统计失败不阻断详情页。
  }
}

function openPreview() {
  if (!versionedPreviewUrl.value) return
  window.open(versionedPreviewUrl.value, '_blank', 'noopener,noreferrer')
}

function typeLabel(value) {
  return { Platform: '平台应用', UniApp: 'UniApp', Web: 'Web', MicroService: '微服务' }[value] || value
}

function categoryLabel(value) {
  return {
    game: '游戏', business: '企业应用', office: '办公协同', education: '教育学习',
    tools: '效率工具', lifestyle: '生活服务', creative: '创意设计', data: '数据分析',
    marketing: '营销运营', industry: '行业应用', platform: '平台能力', other: '其它'
  }[value] || value || '其它'
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function handleAuthChange() {
  syncAuth()
  loadFavoriteStatus()
}

onMounted(() => {
  syncAuth()
  loadApp()
  window.addEventListener('storage', handleAuthChange)
  window.addEventListener('microi-login-success', handleAuthChange)
  window.addEventListener('microi-logout', handleAuthChange)
  window.addEventListener('microi-token-refreshed', handleAuthChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleAuthChange)
  window.removeEventListener('microi-login-success', handleAuthChange)
  window.removeEventListener('microi-logout', handleAuthChange)
  window.removeEventListener('microi-token-refreshed', handleAuthChange)
})
</script>

<style scoped>
:global(body:has(.app-detail-page) .VPDoc) {
  padding: 0 !important;
}

:global(body:has(.app-detail-page) .VPDoc .container),
:global(body:has(.app-detail-page) .VPDoc .content),
:global(body:has(.app-detail-page) .VPDoc .content-container),
:global(body:has(.app-detail-page) .vp-doc) {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

:global(body:has(.app-detail-page) .VPDoc .content-container::before) {
  display: none !important;
}

.app-detail-page {
  min-height: calc(100vh - 64px);
  padding: 46px 24px 88px;
  background:
    radial-gradient(circle at 16% 0, rgba(47, 114, 246, .1), transparent 28rem),
    #f5f7fb;
  color: #172033;
}

:global(html.dark .app-detail-page) {
  background:
    radial-gradient(circle at 16% 0, rgba(47, 114, 246, .16), transparent 28rem),
    #0b1220;
  color: #f4f7fb;
}

.app-detail-shell {
  width: min(1320px, 100%);
  margin: 0 auto;
}

.app-detail-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  color: #4c5b72;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

:global(html.dark .app-detail-back) {
  color: #aab7ca;
}

.app-detail-state {
  display: grid;
  min-height: 360px;
  place-content: center;
  gap: 8px;
  border: 1px solid #e2e7ef;
  border-radius: 24px;
  background: #fff;
  color: #687386;
  text-align: center;
}

.app-detail-error strong {
  color: #172033;
  font-size: 20px;
}

.app-detail-hero {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  padding: 34px;
  border: 1px solid #e2e7ef;
  border-radius: 28px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 24px 70px rgba(32, 51, 84, .09);
}

:global(html.dark .app-detail-hero),
:global(html.dark .app-detail-facts),
:global(html.dark .app-detail-preview-card),
:global(html.dark .app-detail-about),
:global(html.dark .app-detail-state) {
  border-color: rgba(148, 163, 184, .18);
  background: #111a2a;
}

.app-detail-icon {
  display: grid;
  width: 132px;
  height: 132px;
  place-items: center;
  border-radius: 30px;
  color: #fff;
  font-size: 42px;
  font-weight: 900;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 18px 34px rgba(30, 64, 175, .2);
}

.app-detail-icon.small {
  width: 78px;
  height: 78px;
  border-radius: 20px;
  font-size: 26px;
}

.tone-indigo { background: linear-gradient(145deg, #1d2d73, #6b4ef7); }
.tone-green { background: linear-gradient(145deg, #087b69, #34c989); }
.tone-violet { background: linear-gradient(145deg, #6f4bf2, #b36df2); }
.tone-navy { background: linear-gradient(145deg, #132a49, #2f72d7); }
.tone-cyan { background: linear-gradient(145deg, #08759b, #28c0c7); }
.tone-purple { background: linear-gradient(145deg, #6440c8, #9b61f3); }
.tone-orange { background: linear-gradient(145deg, #dd6b2f, #ffb657); }
.tone-blue { background: linear-gradient(145deg, #1769e0, #62a0ff); }

.app-detail-eyebrow,
.app-detail-preview-card header span,
.app-detail-about > span {
  color: #1769e0;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .13em;
}

.app-detail-summary h1 {
  margin: 7px 0 8px;
  color: inherit;
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1.08;
  letter-spacing: -.045em;
}

.app-detail-summary > p {
  max-width: 720px;
  margin: 0;
  color: #687386;
  font-size: 16px;
  line-height: 1.75;
}

:global(html.dark .app-detail-summary > p),
:global(html.dark .app-detail-meta),
:global(html.dark .app-detail-facts span),
:global(html.dark .app-detail-about p),
:global(html.dark .app-detail-about dt) {
  color: #9eacc0;
}

.app-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 15px;
  color: #778398;
  font-size: 12px;
}

.app-detail-actions {
  display: grid;
  min-width: 156px;
  gap: 10px;
}

.app-detail-actions button,
.app-detail-actions a {
  display: inline-flex;
  min-height: 44px;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.app-detail-actions svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-detail-actions .primary {
  border: 1px solid #1769e0;
  background: #1769e0;
  color: #fff;
  box-shadow: 0 12px 24px rgba(23, 105, 224, .24);
}

.app-detail-actions .secondary {
  border: 1px solid #dfe5ed;
  background: #fff;
  color: #253148;
}

.app-detail-actions .favorite {
  border: 1px solid #dfe5ed;
  background: #fff;
  color: #536078;
}

.app-detail-actions .favorite.active {
  border-color: rgba(244, 63, 94, .3);
  background: rgba(244, 63, 94, .08);
  color: #e11d48;
}

.app-detail-actions .favorite.active svg { fill: currentColor; }
.app-detail-actions .favorite:disabled { opacity: .58; cursor: wait; }

.app-detail-action-message {
  margin: 10px 8px -8px;
  color: #1769e0;
  font-size: 12px;
  text-align: right;
}

:global(html.dark .app-detail-actions .secondary) {
  border-color: rgba(148, 163, 184, .2);
  background: #162134;
  color: #f4f7fb;
}

:global(html.dark .app-detail-actions .favorite) {
  border-color: rgba(148, 163, 184, .2);
  background: #162134;
  color: #cbd5e1;
}

:global(html.dark .app-detail-actions .favorite.active) {
  border-color: rgba(251, 113, 133, .38);
  background: rgba(244, 63, 94, .12);
  color: #fb7185;
}

.app-detail-facts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 20px 0;
  border: 1px solid #e2e7ef;
  border-radius: 22px;
  background: #fff;
}

.app-detail-facts article {
  position: relative;
  display: grid;
  min-height: 98px;
  place-content: center;
  gap: 7px;
  text-align: center;
}

.app-detail-facts article + article::before {
  content: "";
  position: absolute;
  left: 0;
  top: 28px;
  width: 1px;
  height: 42px;
  background: #e2e7ef;
}

.app-detail-facts strong {
  font-size: 20px;
}

.app-detail-facts span {
  color: #778398;
  font-size: 11px;
}

.app-detail-content {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, .7fr);
  align-items: start;
  gap: 20px;
}

.app-detail-preview-card,
.app-detail-about {
  overflow: hidden;
  border: 1px solid #e2e7ef;
  border-radius: 24px;
  background: #fff;
}

.app-detail-preview-card {
  padding: 24px;
}

.app-detail-preview-card header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.app-detail-preview-card h2,
.app-detail-about h2 {
  margin: 5px 0 0;
  color: inherit;
  font-size: 24px;
}

.app-detail-preview-card header button {
  border: 0;
  background: transparent;
  color: #1769e0;
  cursor: pointer;
  font-weight: 750;
}

.app-detail-browser {
  overflow: hidden;
  border: 1px solid #dfe5ed;
  border-radius: 18px;
  background: #eef2f7;
}

.browser-bar {
  display: flex;
  height: 42px;
  padding: 0 15px;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid #dfe5ed;
  background: #f8fafc;
}

.browser-bar i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff6b63;
}

.browser-bar i:nth-child(2) { background: #f7bf45; }
.browser-bar i:nth-child(3) { background: #38bd69; }

.browser-bar span {
  margin-left: 8px;
  color: #718096;
  font-size: 11px;
}

.app-detail-browser iframe {
  display: block;
  width: 100%;
  height: min(70vh, 720px);
  border: 0;
  background: #fff;
}

.app-detail-platform {
  display: grid;
  min-height: 420px;
  place-content: center;
  justify-items: center;
  gap: 14px;
  border-radius: 18px;
  background: linear-gradient(145deg, #eef4ff, #f8faff);
  text-align: center;
}

.app-detail-platform strong {
  font-size: 24px;
}

.app-detail-platform p {
  max-width: 420px;
  margin: 0;
  color: #687386;
  line-height: 1.7;
}

:global(html.dark .app-detail-browser) {
  border-color: rgba(148, 163, 184, .2);
  background: #07101e;
}

:global(html.dark .browser-bar) {
  border-bottom-color: rgba(148, 163, 184, .18);
  background: #0d1726;
}

:global(html.dark .browser-bar span) { color: #94a3b8; }

:global(html.dark .app-detail-browser iframe) {
  background: #07101e;
  color-scheme: dark;
}

:global(html.dark .app-detail-platform) {
  background:
    radial-gradient(circle at 50% 25%, rgba(99, 102, 241, .18), transparent 19rem),
    linear-gradient(145deg, #0b1423, #0d1727);
  color: #f8fafc;
}

:global(html.dark .app-detail-platform p) { color: #94a3b8; }

.app-detail-about {
  padding: 26px;
}

.app-detail-about p {
  margin: 16px 0 22px;
  color: #687386;
  font-size: 13px;
  line-height: 1.8;
}

.app-detail-about dl {
  display: grid;
  gap: 0;
  margin: 0;
}

.app-detail-about dl div {
  display: grid;
  gap: 5px;
  padding: 14px 0;
  border-top: 1px solid #e7ebf1;
}

:global(html.dark .app-detail-about dl div) {
  border-top-color: rgba(148, 163, 184, .18);
}

:global(html.dark .app-detail-facts article + article::before) {
  background: rgba(148, 163, 184, .18);
}

.app-detail-about dt {
  color: #778398;
  font-size: 11px;
}

.app-detail-about dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .app-detail-hero {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .app-detail-icon {
    width: 100px;
    height: 100px;
    border-radius: 24px;
  }

  .app-detail-actions {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .app-detail-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .app-detail-page {
    padding: 24px 14px 60px;
  }

  .app-detail-hero {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 16px;
    padding: 22px;
    border-radius: 22px;
  }

  .app-detail-icon {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    font-size: 26px;
  }

  .app-detail-summary h1 {
    font-size: 28px;
  }

  .app-detail-summary > p,
  .app-detail-meta {
    grid-column: 1 / -1;
  }

  .app-detail-actions {
    grid-template-columns: 1fr;
  }

  .app-detail-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .app-detail-facts article:nth-child(odd)::before {
    display: none;
  }

  .app-detail-browser iframe {
    height: 68vh;
  }
}
</style>
