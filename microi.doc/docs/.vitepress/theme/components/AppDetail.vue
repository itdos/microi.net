<template>
  <ClientOnly>
    <main v-if="isDetailPage" class="app-detail-page" data-mci-ui-root>
      <div class="app-detail-shell">
        <a class="app-detail-back" href="/apps.html">
          <span aria-hidden="true">←</span>
          返回 AI 应用
        </a>

        <div v-if="loading" class="app-detail-skeleton" aria-busy="true" aria-label="正在读取应用详情">
          <span class="app-detail-visually-hidden">正在读取应用详情</span>
          <section class="app-detail-skeleton-hero" aria-hidden="true">
            <i class="app-detail-skeleton-block app-detail-skeleton-icon"></i>
            <div>
              <i class="app-detail-skeleton-block short"></i>
              <i class="app-detail-skeleton-block title"></i>
              <i class="app-detail-skeleton-block text"></i>
              <i class="app-detail-skeleton-block text compact"></i>
            </div>
            <div class="app-detail-skeleton-actions">
              <i class="app-detail-skeleton-block"></i>
              <i class="app-detail-skeleton-block"></i>
            </div>
          </section>
          <section class="app-detail-skeleton-facts" aria-hidden="true">
            <i v-for="index in 5" :key="index" class="app-detail-skeleton-block"></i>
          </section>
          <section class="app-detail-skeleton-panel" aria-hidden="true">
            <i class="app-detail-skeleton-block media"></i>
            <div>
              <i class="app-detail-skeleton-block title"></i>
              <i class="app-detail-skeleton-block text"></i>
              <i class="app-detail-skeleton-block text compact"></i>
            </div>
          </section>
        </div>
        <div v-else-if="errorMessage" class="app-detail-state app-detail-error">
          <strong>暂时无法打开应用详情</strong>
          <span>{{ errorMessage }}</span>
          <button type="button" @click="loadApp">重新读取</button>
        </div>

        <template v-else-if="app">
          <section class="app-detail-hero">
            <div class="app-detail-icon" :class="`tone-${app.tone}`">{{ app.icon }}</div>
            <div class="app-detail-summary">
              <div class="app-detail-labels">
                <span class="app-detail-eyebrow">{{ typeLabel(app.ApplicationType) }}</span>
                <span v-if="app.IsRecommend" class="app-detail-recommend-tag">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z"/></svg>
                  推荐
                </span>
              </div>
              <h1>{{ app.Name }}</h1>
              <p>{{ app.Description }}</p>
              <div class="app-detail-meta">
                <span>{{ categoryLabel(app.Category) }}</span>
                <span>{{ app.AppAuthor || app.OwnerName || 'Microi吾码' }}</span>
                <span>{{ app.AppVersion || `v${app.CurrentVersion || 1}.0.0` }}</span>
              </div>
            </div>
            <div class="app-detail-actions">
              <button v-if="app.ExperienceUrl" type="button" class="primary" @click="openPreview">
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
              <button
                v-if="isSuperAdmin"
                type="button"
                class="recommend"
                :class="{ active: app.IsRecommend }"
                :disabled="recommendBusy"
                @click="setRecommend"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z"/></svg>
                {{ app.IsRecommend ? '取消推荐应用' : '设置为推荐应用' }}
              </button>
              <a class="secondary" href="/apps.html">浏览更多应用</a>
            </div>
          </section>
          <p v-if="favoriteMessage" class="app-detail-action-message" role="status">{{ favoriteMessage }}</p>
          <p v-if="recommendMessage" class="app-detail-action-message" role="status">{{ recommendMessage }}</p>

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

          <section class="app-detail-cover-card" aria-label="应用预览图">
            <img
              v-if="app.AppPreviewUrl && !previewImageBroken"
              :src="app.AppPreviewUrl"
              :alt="`${app.Name}应用预览图`"
              :class="previewFitClass(app.ApplicationType)"
              loading="eager"
              @error="previewImageBroken = true"
            />
            <div v-else class="app-detail-cover-empty">
              <div class="app-detail-icon small" :class="`tone-${app.tone}`">{{ app.icon }}</div>
              <strong>{{ app.Name }}</strong>
              <span>应用预览图完善中</span>
            </div>
          </section>

          <section class="app-detail-changelog" aria-labelledby="app-detail-changelog-title">
            <header class="app-detail-changelog-header">
              <div class="app-detail-changelog-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 8v4l2.7 1.6M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
                </svg>
              </div>
              <div class="app-detail-changelog-title">
                <span>VERSION HISTORY</span>
                <h2 id="app-detail-changelog-title">更新日志</h2>
                <p>从当前版本到历史演进，清晰了解每一次新增、优化、修复与兼容变化。</p>
              </div>
              <div class="app-detail-changelog-count" :class="{ muted: !changeLogs.length }">
                <strong>{{ changeLogTotal }}</strong>
                <span>条版本记录</span>
              </div>
            </header>

            <div v-if="changeLogLoading" class="app-detail-changelog-loading" aria-busy="true">
              <article v-for="index in 2" :key="index">
                <i class="app-detail-skeleton-block badge"></i>
                <i class="app-detail-skeleton-block heading"></i>
                <i class="app-detail-skeleton-block paragraph"></i>
              </article>
            </div>

            <div v-else-if="visibleChangeLogs.length" id="app-detail-changelog-list" class="app-detail-changelog-timeline">
              <article
                v-for="(log, index) in visibleChangeLogs"
                :key="log.Id || `${log.Version}-${log.ReleaseTime}`"
                class="app-detail-changelog-item"
                :class="{ current: isCurrentChangeLog(log) }"
                :data-tone="getChangeTypeMeta(log.ChangeType).tone"
                :style="{ '--change-index': index }"
              >
                <i class="app-detail-changelog-dot" aria-hidden="true"></i>
                <div class="app-detail-changelog-card">
                  <header>
                    <div class="app-detail-changelog-badges">
                      <span class="type">{{ getChangeTypeMeta(log.ChangeType).label }}</span>
                      <span class="version">{{ log.Version || '未标注版本' }}</span>
                      <span v-if="isCurrentChangeLog(log)" class="current-version">当前版本</span>
                    </div>
                    <time :datetime="log.ReleaseTime || undefined">{{ formatChangeLogDate(log.ReleaseTime) }}</time>
                  </header>
                  <h3>{{ log.Title || `${log.Version || '当前版本'} 更新` }}</h3>
                  <p>{{ log.Content || '该版本暂未填写详细说明。' }}</p>
                </div>
              </article>
            </div>

            <div v-else class="app-detail-changelog-empty" :class="{ error: changeLogError }">
              <span class="app-detail-changelog-empty-icon" aria-hidden="true">{{ changeLogError ? '!' : '↻' }}</span>
              <div>
                <strong v-if="changeLogError">更新日志暂时未能读取</strong>
                <strong v-else-if="changeLogAvailable">当前应用尚未补录独立更新日志</strong>
                <strong v-else>当前商城源尚未提供更新日志能力</strong>
                <p v-if="changeLogError">{{ changeLogError }}</p>
                <p v-else-if="changeLogAvailable">发布者补录后，这里会自动呈现对应版本的完整变化。</p>
                <p v-else>请先更新该来源的应用商城应用，再重新打开详情。</p>
              </div>
              <button v-if="changeLogError" type="button" @click="loadChangeLogs(app.Id)">重新读取</button>
            </div>

            <button
              v-if="changeLogs.length > CHANGE_LOG_COLLAPSED_COUNT"
              type="button"
              class="app-detail-changelog-toggle"
              :aria-expanded="changeLogExpanded"
              aria-controls="app-detail-changelog-list"
              @click="changeLogExpanded = !changeLogExpanded"
            >
              {{ changeLogExpanded ? '收起历史版本' : `展开全部 ${changeLogs.length} 条记录` }}
              <span aria-hidden="true">{{ changeLogExpanded ? '↑' : '↓' }}</span>
            </button>
          </section>

          <section class="app-detail-content">
            <article class="app-detail-description-card">
              <header>
                <div>
                  <span>APP DETAILS</span>
                  <h2>应用详情</h2>
                </div>
              </header>
              <div
                v-if="app.DetailHtml"
                class="app-detail-richtext vp-doc"
                v-html="app.DetailHtml"
              />
              <div v-else class="app-detail-description-empty">
                <strong>{{ app.Name }}</strong>
                <p>{{ app.Description }}</p>
              </div>
            </article>

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
import {
  formatChangeLogDate,
  getChangeTypeMeta,
  isSameAppVersion,
  normalizeChangeLogResponse
} from '../utils/app-changelog.js'
import { resolveApplicationExperienceUrl } from '../utils/app-preview-url.js'
import { OFFICIAL_MICROI_API_BASE } from '../utils/site-api-base.js'
import { resolveUploadedResourceUrl } from '../utils/upload-resource-url.js'
import {
  buildSiteSessionHeaders,
  getOrCreateSiteDid,
  isSiteSessionExpired,
  normalizeSiteToken,
  readRotatedSiteToken
} from '../utils/site-session.js'

const route = useRoute()
// 应用详情与列表使用同一官方公开源，防止开发环境误读其它租户。
const APP_API_BASE = OFFICIAL_MICROI_API_BASE
const OS_CLIENT = 'iTdos'

const app = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const authToken = ref('')
const authDid = ref('')
const currentUser = ref(null)
const isFavorite = ref(false)
const favoriteBusy = ref(false)
const favoriteMessage = ref('')
const recommendBusy = ref(false)
const recommendMessage = ref('')
const fileServer = ref('')
const previewImageBroken = ref(false)
const changeLogs = ref([])
const changeLogTotal = ref(0)
const changeLogAvailable = ref(null)
const changeLogLoading = ref(false)
const changeLogError = ref('')
const changeLogExpanded = ref(false)
const CHANGE_LOG_COLLAPSED_COUNT = 5
const isSuperAdmin = computed(() => Boolean(authToken.value && currentUser.value?.Id && Number(currentUser.value?.Level || 0) >= 9999))

// VitePress 的 route.path 在不同导航方式/版本中可能包含查询串；应用详情页
// 必须只按 pathname 判断，否则 /app-detail.html?app=xxx 会整页被 v-if 隐藏。
const isDetailPage = computed(() => {
  const path = String(route.path || '').split(/[?#]/, 1)[0].replace(/\/$/, '')
  return ['/app-detail', '/app-detail.html'].includes(path)
})
const updatedDate = computed(() => {
  const value = app.value?.AppUpdateTime || app.value?.UpdateTime
  return value ? String(value).slice(0, 10) : '持续更新'
})
const visibleChangeLogs = computed(() => changeLogExpanded.value
  ? changeLogs.value
  : changeLogs.value.slice(0, CHANGE_LOG_COLLAPSED_COUNT))
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

function resolveAssetUrl(value) {
  return resolveUploadedResourceUrl(value, {
    apiBase: APP_API_BASE,
    baseUrl: typeof window === 'undefined' ? 'https://microi.net' : window.location.origin,
    fileServer: fileServer.value
  })
}

function sanitizeRichText(value) {
  const source = String(value || '').trim()
  if (!source) return ''
  if (typeof document === 'undefined') return plainText(source)
  const template = document.createElement('template')
  template.innerHTML = source
  template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,base').forEach(node => node.remove())
  template.content.querySelectorAll('*').forEach(node => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      const rawValue = String(attr.value || '').trim()
      if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
        node.removeAttribute(attr.name)
        continue
      }
      if (name === 'href') {
        if (!/^(https?:|mailto:|tel:|#|\/)/i.test(rawValue)) node.removeAttribute(attr.name)
        else {
          node.setAttribute('target', '_blank')
          node.setAttribute('rel', 'noopener noreferrer')
        }
      }
      if (name === 'src') {
        const safeSrc = resolveAssetUrl(rawValue)
        if (!safeSrc || !/^(https?:|data:image\/|blob:|\/)/i.test(safeSrc)) node.removeAttribute(attr.name)
        else node.setAttribute('src', safeSrc)
      }
    }
  })
  return template.innerHTML.trim()
}

function previewFitClass(applicationType) {
  return ['uniapp', 'web'].includes(String(applicationType || '').toLowerCase())
    ? 'preview-fit-contain'
    : 'preview-fit-cover'
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
    Description: plainText(item.Description || item.AppDetail) || '基于 Microi吾码构建的在线应用。',
    DetailHtml: sanitizeRichText(item.AppDetail || item.Description),
    AppPreviewUrl: resolveAssetUrl(item.AppPreview),
    AppKey: item.AppKey || item.AppId,
    ApplicationType: applicationType,
    ExperienceUrl: resolveApplicationExperienceUrl(item, typeof window === 'undefined' ? undefined : window, {
      baseUrl: typeof window === 'undefined' ? 'https://microi.net' : window.location.origin,
      apiBase: APP_API_BASE,
      fileServer: fileServer.value,
      osClient: OS_CLIENT
    }),
    Category: category,
    icon: iconMap[category] || 'AI',
    tone: toneMap[category] || 'blue',
    ViewCount: Number(item.ViewCount || 0),
    InstallCount: Number(item.InstallCount || 0),
    FavoriteCount: Number(item.FavoriteCount || 0),
    IsRecommend: Number(item.IsRecommend || 0) === 1 ? 1 : 0
  }
}

function resetChangeLogState() {
  changeLogs.value = []
  changeLogTotal.value = 0
  changeLogAvailable.value = null
  changeLogError.value = ''
  changeLogExpanded.value = false
}

function applyChangeLogResponse(result) {
  const normalized = normalizeChangeLogResponse(result)
  changeLogs.value = normalized.logs
  changeLogTotal.value = normalized.total
  changeLogAvailable.value = normalized.available
}

async function loadChangeLogs(storeId) {
  if (!storeId || changeLogLoading.value) return null
  changeLogLoading.value = true
  changeLogError.value = ''
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/get-microi-store-model?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Id: storeId, IncludePackage: false })
    })
    const result = await response.json()
    if (result.Code !== 1) throw new Error(result.Msg || '更新日志读取失败')
    applyChangeLogResponse(result)
    return result.Data || null
  } catch (error) {
    changeLogs.value = []
    changeLogTotal.value = 0
    changeLogAvailable.value = null
    changeLogError.value = error?.message || '网络异常，请稍后重试。'
    return null
  } finally {
    changeLogLoading.value = false
  }
}

function isCurrentChangeLog(log) {
  return isSameAppVersion(log?.Version, app.value?.AppVersion)
}

function syncAuth() {
  if (typeof window === 'undefined') return
  try { currentUser.value = JSON.parse(localStorage.getItem('microi_doc_user') || 'null') } catch (_) { currentUser.value = null }
  const hasUser = Boolean(currentUser.value?.Id)
  const token = normalizeSiteToken(localStorage.getItem('microi_doc_token'))
  authToken.value = token && hasUser ? token : ''
  authDid.value = getOrCreateSiteDid(localStorage, window.crypto)
  if (!authToken.value) {
    currentUser.value = null
    isFavorite.value = false
  }
}

function authHeaders() {
  return buildSiteSessionHeaders({ token: authToken.value, osClient: OS_CLIENT, did: authDid.value })
}

function syncTokenFromResponse(response) {
  const token = readRotatedSiteToken(response)
  if (!token || token === authToken.value) return
  authToken.value = token
  localStorage.setItem('microi_doc_token', token)
  window.dispatchEvent(new CustomEvent('microi-token-refreshed'))
}

function expireAuth() {
  authToken.value = ''
  currentUser.value = null
  isFavorite.value = false
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_user')
  window.dispatchEvent(new CustomEvent('microi-logout'))
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
    if (isSiteSessionExpired(result, response.status)) {
      expireAuth()
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
      if (isSiteSessionExpired(result, response.status)) {
        expireAuth()
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

async function setRecommend() {
  if (!app.value || !isSuperAdmin.value || recommendBusy.value) return
  recommendMessage.value = ''
  recommendBusy.value = true
  const desired = !Boolean(app.value.IsRecommend)
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_app_recommend?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ AppId: app.value.Id, IsRecommend: desired })
    })
    syncTokenFromResponse(response)
    const result = await response.json()
    if (result.Code !== 1) {
      if (isSiteSessionExpired(result, response.status)) {
        expireAuth()
        window.location.href = `/login.html?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
        return
      }
      throw new Error(result.Msg || '推荐状态保存失败')
    }
    app.value.IsRecommend = Number(result.Data?.IsRecommend || 0) === 1 ? 1 : 0
    recommendMessage.value = result.Msg || (app.value.IsRecommend ? '已设置为推荐应用' : '已取消推荐应用')
  } catch (error) {
    recommendMessage.value = error?.message || '推荐状态保存失败，请稍后重试'
  } finally {
    recommendBusy.value = false
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
  app.value = null
  resetChangeLogState()
  try {
    const response = await fetch(`${APP_API_BASE}/apiengine/official_ai_apps?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ExactAppKey: appKey, PageIndex: 1, PageSize: 1 })
    })
    const result = await response.json()
    if (result.Code !== 1 || !Array.isArray(result.Data)) throw new Error(result.Msg || '应用读取失败')
    fileServer.value = String(result.DataAppend?.FileServer || '').trim()
    const matched = result.Data.find(item => String(item.AppKey || item.AppId || item.Id) === appKey)
    if (!matched) throw new Error('应用不存在或尚未发布')
    previewImageBroken.value = false
    const detailModel = await loadChangeLogs(matched.Id)
    app.value = normalizeApp({ ...matched, ...(detailModel || {}) })
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
      // 浏览统计只更新计数；立即体验地址始终以 official_ai_apps 的公开记录
      // 为单一事实源，避免详情页被统计接口中的历史版本地址覆盖。
    }
  } catch (_) {
    // 浏览统计失败不阻断详情页。
  }
}

function openPreview() {
  if (!app.value?.ExperienceUrl) return
  window.open(app.value.ExperienceUrl, '_blank', 'noopener,noreferrer')
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
  --mci-app-detail-surface: #fff;
  --mci-app-detail-surface-soft: #f7f9fc;
  --mci-app-detail-surface-raised: #eef3fa;
  --mci-app-detail-text: #172033;
  --mci-app-detail-text-soft: #536078;
  --mci-app-detail-text-muted: #778398;
  --mci-app-detail-line: #e2e7ef;
  --mci-app-detail-line-strong: #ccd6e5;
  --mci-app-detail-primary: #1769e0;
  --mci-app-detail-primary-soft: rgba(23, 105, 224, .09);
  --mci-app-detail-cool: #0891b2;
  --mci-app-detail-shadow: 0 20px 54px rgba(32, 51, 84, .09);
  --mci-app-change-feature: #1769e0;
  --mci-app-change-improvement: #7c3aed;
  --mci-app-change-fix: #d97706;
  --mci-app-change-security: #059669;
  --mci-app-change-breaking: #dc2626;
  --mci-app-change-compatibility: #0891b2;
  min-height: calc(100vh - 64px);
  padding: 46px 24px 88px;
  background:
    radial-gradient(circle at 16% 0, rgba(47, 114, 246, .1), transparent 28rem),
    #f5f7fb;
  color: #172033;
}

:global(html.dark .app-detail-page) {
  --mci-app-detail-surface: #111a2a;
  --mci-app-detail-surface-soft: #0e1726;
  --mci-app-detail-surface-raised: #162134;
  --mci-app-detail-text: #f4f7fb;
  --mci-app-detail-text-soft: #cbd5e1;
  --mci-app-detail-text-muted: #9eacc0;
  --mci-app-detail-line: rgba(148, 163, 184, .18);
  --mci-app-detail-line-strong: rgba(148, 163, 184, .3);
  --mci-app-detail-primary: #60a5fa;
  --mci-app-detail-primary-soft: rgba(96, 165, 250, .12);
  --mci-app-detail-cool: #35b8d5;
  --mci-app-detail-shadow: 0 22px 62px rgba(0, 0, 0, .28);
  --mci-app-change-feature: #60a5fa;
  --mci-app-change-improvement: #a78bfa;
  --mci-app-change-fix: #fbbf24;
  --mci-app-change-security: #34d399;
  --mci-app-change-breaking: #fb7185;
  --mci-app-change-compatibility: #22d3ee;
  background:
    radial-gradient(circle at 16% 0, rgba(47, 114, 246, .16), transparent 28rem),
    #0b1220;
  color: #f4f7fb;
}

.app-detail-shell {
  width: min(1320px, 100%);
  margin: 0 auto;
  animation: app-detail-enter .42s cubic-bezier(.25, .46, .45, .94) both;
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
  transition: color 160ms ease, transform 160ms ease;
}

.app-detail-back:hover {
  color: var(--mci-app-detail-primary);
  transform: translateX(-2px);
}

.app-detail-back:focus-visible,
.app-detail-actions button:focus-visible,
.app-detail-actions a:focus-visible,
.app-detail-state button:focus-visible,
.app-detail-changelog button:focus-visible {
  outline: 3px solid var(--mci-app-detail-primary-soft);
  outline-offset: 3px;
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

.app-detail-state button {
  display: inline-flex;
  min-width: 112px;
  min-height: 44px;
  margin: 10px auto 0;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mci-app-detail-primary);
  border-radius: 12px;
  background: var(--mci-app-detail-primary);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  transition: transform 160ms ease;
}

.app-detail-state button:active { transform: scale(.97); }

.app-detail-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-detail-skeleton {
  display: grid;
  gap: 20px;
}

.app-detail-skeleton-hero,
.app-detail-skeleton-facts,
.app-detail-skeleton-panel {
  border: 1px solid var(--mci-app-detail-line);
  border-radius: 24px;
  background: var(--mci-app-detail-surface);
  box-shadow: var(--mci-app-detail-shadow);
}

.app-detail-skeleton-hero {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 176px;
  align-items: center;
  gap: 28px;
  padding: 34px;
}

.app-detail-skeleton-hero > div:nth-child(2),
.app-detail-skeleton-panel > div,
.app-detail-skeleton-actions {
  display: grid;
  gap: 12px;
}

.app-detail-skeleton-actions .app-detail-skeleton-block { height: 44px; }
.app-detail-skeleton-icon { width: 132px; height: 132px; border-radius: 30px !important; }
.app-detail-skeleton-block.short { width: 92px; height: 12px; }
.app-detail-skeleton-block.title { width: min(420px, 78%); height: 38px; }
.app-detail-skeleton-block.text { width: min(680px, 94%); height: 15px; }
.app-detail-skeleton-block.text.compact { width: min(520px, 72%); }

.app-detail-skeleton-facts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 25px;
  gap: 24px;
}

.app-detail-skeleton-facts .app-detail-skeleton-block { height: 48px; }

.app-detail-skeleton-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, .7fr);
  gap: 24px;
  padding: 24px;
}

.app-detail-skeleton-panel .media { height: 320px; }

.app-detail-skeleton-block {
  display: block;
  width: 100%;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--mci-app-detail-surface-raised), var(--mci-app-detail-line), var(--mci-app-detail-surface-raised));
  background-size: 240% 100%;
  animation: app-detail-skeleton 1.15s ease-in-out infinite;
}

.app-detail-error strong {
  color: var(--mci-app-detail-text);
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
:global(html.dark .app-detail-cover-card),
:global(html.dark .app-detail-description-card),
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
.app-detail-description-card header span,
.app-detail-about > span {
  color: #1769e0;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .13em;
}

.app-detail-labels {
  display: flex;
  min-height: 28px;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.app-detail-recommend-tag {
  display: inline-flex;
  min-height: 26px;
  padding: 0 10px;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(217, 119, 6, .28);
  border-radius: 999px;
  background: rgba(245, 158, 11, .11);
  color: #b45309;
  font-size: 11px;
  font-weight: 850;
}

.app-detail-recommend-tag svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

:global(html.dark .app-detail-recommend-tag) {
  border-color: rgba(251, 191, 36, .35);
  background: rgba(245, 158, 11, .14);
  color: #fcd34d;
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
  transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.app-detail-actions button:active,
.app-detail-actions a:active { transform: scale(.97); }

@media (hover: hover) {
  .app-detail-actions button:hover:not(:disabled),
  .app-detail-actions a:hover { transform: translateY(-2px); }
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
.app-detail-actions .recommend {
  border: 1px solid rgba(217, 119, 6, .3);
  background: rgba(245, 158, 11, .08);
  color: #a75b06;
}

.app-detail-actions .recommend.active {
  border-color: rgba(217, 119, 6, .42);
  background: rgba(245, 158, 11, .16);
  color: #92400e;
}

.app-detail-actions .recommend svg { fill: currentColor; stroke: none; }
.app-detail-actions .favorite:disabled,
.app-detail-actions .recommend:disabled { opacity: .58; cursor: wait; }

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

:global(html.dark .app-detail-actions .recommend) {
  border-color: rgba(251, 191, 36, .28);
  background: rgba(245, 158, 11, .11);
  color: #fcd34d;
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

.app-detail-cover-card,
.app-detail-description-card,
.app-detail-about {
  overflow: hidden;
  border: 1px solid #e2e7ef;
  border-radius: 24px;
  background: #fff;
}

.app-detail-cover-card {
  display: grid;
  min-height: 360px;
  margin-bottom: 20px;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(23, 105, 224, .06), rgba(99, 102, 241, .025)),
    #fff;
}

.app-detail-cover-card > img {
  display: block;
  width: 100%;
  height: clamp(360px, 48vw, 680px);
  background: #f5f7fb;
}

.app-detail-cover-card > img.preview-fit-contain { object-fit: contain; }
.app-detail-cover-card > img.preview-fit-cover { object-fit: cover; }

.app-detail-cover-empty {
  display: grid;
  min-height: 360px;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: #687386;
  text-align: center;
}

.app-detail-cover-empty strong {
  color: #172033;
  font-size: 22px;
}

.app-detail-cover-empty span { font-size: 13px; }

:global(html.dark .app-detail-cover-card > img) { background: #07101e; }
:global(html.dark .app-detail-cover-empty) { color: #94a3b8; }
:global(html.dark .app-detail-cover-empty strong) { color: #f8fafc; }

.app-detail-changelog {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-bottom: 20px;
  padding: clamp(24px, 3vw, 38px);
  border: 1px solid var(--mci-app-detail-line);
  border-radius: 26px;
  background:
    linear-gradient(135deg, var(--mci-app-detail-primary-soft), transparent 42%),
    var(--mci-app-detail-surface);
  box-shadow: var(--mci-app-detail-shadow);
}

.app-detail-changelog > * {
  position: relative;
  z-index: 1;
}

.app-detail-changelog-header {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  align-items: center;
  gap: 17px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--mci-app-detail-line);
}

.app-detail-changelog-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border: 1px solid rgba(23, 105, 224, .22);
  border-radius: 16px;
  background: var(--mci-app-detail-primary-soft);
  color: var(--mci-app-detail-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4);
}

.app-detail-changelog-icon svg {
  width: 25px;
  height: 25px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.app-detail-changelog-title > span {
  color: var(--mci-app-detail-primary);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .15em;
}

.app-detail-changelog-title h2 {
  margin: 4px 0 5px;
  color: var(--mci-app-detail-text);
  font-size: clamp(25px, 3vw, 34px);
  letter-spacing: -.03em;
  line-height: 1.2;
}

.app-detail-changelog-title p {
  max-width: 720px;
  margin: 0;
  color: var(--mci-app-detail-text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.app-detail-changelog-count {
  display: grid;
  min-width: 104px;
  min-height: 70px;
  padding: 10px 15px;
  place-content: center;
  gap: 2px;
  border: 1px solid var(--mci-app-detail-line);
  border-radius: 16px;
  background: var(--mci-app-detail-surface-soft);
  text-align: center;
}

.app-detail-changelog-count strong {
  color: var(--mci-app-detail-primary);
  font-size: 25px;
  line-height: 1;
}

.app-detail-changelog-count span {
  color: var(--mci-app-detail-text-muted);
  font-size: 10px;
  font-weight: 700;
}

.app-detail-changelog-count.muted strong { color: var(--mci-app-detail-text-muted); }

.app-detail-changelog-timeline {
  position: relative;
  display: grid;
  gap: 14px;
  margin-top: 24px;
  padding-left: 34px;
}

.app-detail-changelog-timeline::before {
  position: absolute;
  top: 11px;
  bottom: 11px;
  left: 9px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--mci-app-detail-primary), var(--mci-app-detail-line-strong) 72%, transparent);
  content: "";
}

.app-detail-changelog-item {
  --change-tone: var(--mci-app-detail-primary);
  position: relative;
  min-width: 0;
  opacity: 0;
  transform: translateY(14px);
  animation: app-detail-change-enter .38s cubic-bezier(.25, .46, .45, .94) forwards;
  animation-delay: calc(var(--change-index, 0) * 45ms);
}

.app-detail-changelog-item[data-tone="feature"] { --change-tone: var(--mci-app-change-feature); }
.app-detail-changelog-item[data-tone="improvement"] { --change-tone: var(--mci-app-change-improvement); }
.app-detail-changelog-item[data-tone="fix"] { --change-tone: var(--mci-app-change-fix); }
.app-detail-changelog-item[data-tone="security"] { --change-tone: var(--mci-app-change-security); }
.app-detail-changelog-item[data-tone="breaking"] { --change-tone: var(--mci-app-change-breaking); }
.app-detail-changelog-item[data-tone="compatibility"] { --change-tone: var(--mci-app-change-compatibility); }

.app-detail-changelog-dot {
  position: absolute;
  z-index: 2;
  top: 22px;
  left: -31px;
  width: 14px;
  height: 14px;
  border: 4px solid var(--mci-app-detail-surface);
  border-radius: 50%;
  background: var(--change-tone);
  box-shadow: 0 0 0 2px var(--mci-app-detail-line-strong);
}

.app-detail-changelog-item.current .app-detail-changelog-dot {
  box-shadow: 0 0 0 3px var(--mci-app-detail-primary-soft), 0 0 0 5px var(--mci-app-detail-primary);
}

.app-detail-changelog-card {
  position: relative;
  min-width: 0;
  padding: 20px 22px;
  border: 1px solid var(--mci-app-detail-line);
  border-radius: 17px;
  background: var(--mci-app-detail-surface-soft);
  box-shadow: 0 8px 24px rgba(32, 51, 84, .055);
  transition: transform 180ms ease, border-color 180ms ease;
}

.app-detail-changelog-item.current .app-detail-changelog-card {
  border-color: var(--mci-app-detail-primary);
  background: linear-gradient(135deg, var(--mci-app-detail-primary-soft), var(--mci-app-detail-surface-soft) 58%);
  box-shadow: inset 3px 0 0 var(--mci-app-detail-primary), 0 12px 30px rgba(23, 105, 224, .1);
}

@media (hover: hover) {
  .app-detail-changelog-card:hover {
    border-color: var(--mci-app-detail-line-strong);
    transform: translateY(-2px);
  }
}

.app-detail-changelog-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.app-detail-changelog-badges {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.app-detail-changelog-badges span {
  display: inline-flex;
  min-height: 26px;
  padding: 0 9px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.app-detail-changelog-badges .type {
  border: 1px solid var(--change-tone);
  background: var(--mci-app-detail-surface);
  color: var(--change-tone);
}

.app-detail-changelog-badges .version {
  border: 1px solid var(--mci-app-detail-line);
  background: var(--mci-app-detail-surface-raised);
  color: var(--mci-app-detail-text);
  font-variant-numeric: tabular-nums;
}

.app-detail-changelog-badges .current-version {
  background: var(--mci-app-detail-primary);
  color: #fff;
}

.app-detail-changelog-card time {
  flex: 0 0 auto;
  color: var(--mci-app-detail-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.app-detail-changelog-card h3 {
  margin: 13px 0 7px;
  color: var(--mci-app-detail-text);
  font-size: 17px;
  line-height: 1.45;
}

.app-detail-changelog-card p {
  margin: 0;
  color: var(--mci-app-detail-text-soft);
  font-size: 13px;
  line-height: 1.82;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.app-detail-changelog-loading {
  display: grid;
  gap: 14px;
  margin-top: 24px;
  padding-left: 34px;
}

.app-detail-changelog-loading article {
  display: grid;
  gap: 13px;
  padding: 20px 22px;
  border: 1px solid var(--mci-app-detail-line);
  border-radius: 17px;
  background: var(--mci-app-detail-surface-soft);
}

.app-detail-changelog-loading .badge { width: 140px; height: 26px; }
.app-detail-changelog-loading .heading { width: min(420px, 76%); height: 21px; }
.app-detail-changelog-loading .paragraph { height: 54px; }

.app-detail-changelog-empty {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 15px;
  margin-top: 24px;
  padding: 20px;
  border: 1px dashed var(--mci-app-detail-line-strong);
  border-radius: 17px;
  background: var(--mci-app-detail-surface-soft);
}

.app-detail-changelog-empty.error { border-color: var(--mci-app-change-breaking); }

.app-detail-changelog-empty-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--mci-app-detail-primary-soft);
  color: var(--mci-app-detail-primary);
  font-size: 19px;
  font-weight: 900;
}

.app-detail-changelog-empty.error .app-detail-changelog-empty-icon {
  background: rgba(220, 38, 38, .09);
  color: var(--mci-app-change-breaking);
}

.app-detail-changelog-empty strong {
  display: block;
  color: var(--mci-app-detail-text);
  font-size: 14px;
}

.app-detail-changelog-empty p {
  margin: 5px 0 0;
  color: var(--mci-app-detail-text-muted);
  font-size: 12px;
  line-height: 1.65;
}

.app-detail-changelog-empty button,
.app-detail-changelog-toggle {
  display: inline-flex;
  min-height: 44px;
  padding: 0 17px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--mci-app-detail-line-strong);
  border-radius: 12px;
  background: var(--mci-app-detail-surface);
  color: var(--mci-app-detail-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  transition: transform 160ms ease, border-color 160ms ease, color 160ms ease;
}

.app-detail-changelog-toggle {
  margin: 18px auto 0;
}

@media (hover: hover) {
  .app-detail-changelog-empty button:hover,
  .app-detail-changelog-toggle:hover {
    border-color: var(--mci-app-detail-primary);
    color: var(--mci-app-detail-primary);
    transform: translateY(-1px);
  }
}

.app-detail-changelog-empty button:active,
.app-detail-changelog-toggle:active { transform: scale(.97); }

.app-detail-description-card {
  padding: 24px;
}

.app-detail-description-card header {
  display: flex;
  align-items: flex-end;
  margin-bottom: 18px;
}

.app-detail-description-card h2,
.app-detail-about h2 {
  margin: 5px 0 0;
  color: inherit;
  font-size: 24px;
}

.app-detail-richtext {
  min-height: 300px;
  color: #3e4a5e;
  font-size: 15px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}

.app-detail-richtext :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 20px auto;
  border-radius: 14px;
}

.app-detail-richtext :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.app-detail-richtext :deep(.mci-app-lead),
.app-detail-richtext :deep(.mci-app-section),
.app-detail-richtext :deep(.mci-app-boundary) {
  margin: 0 0 22px;
  padding: 24px;
  border: 1px solid #e4eaf2;
  border-radius: 18px;
  background: linear-gradient(145deg, #fff 0%, #f8fafc 100%);
  box-shadow: 0 12px 34px rgba(36, 55, 81, .06);
}

.app-detail-richtext :deep(.mci-app-lead) {
  padding: 30px;
  border-color: rgba(96, 79, 196, .2);
  background: radial-gradient(circle at 92% 10%, rgba(124, 98, 227, .14), transparent 36%), linear-gradient(145deg, #fbfaff 0%, #f4f7ff 100%);
}

.app-detail-richtext :deep(.mci-app-kicker),
.app-detail-richtext :deep(.mci-app-section > header p) {
  margin: 0 0 7px;
  color: #6251c7;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .09em;
}

.app-detail-richtext :deep(.mci-app-lead h2),
.app-detail-richtext :deep(.mci-app-section h2),
.app-detail-richtext :deep(.mci-app-boundary h2) {
  margin: 0 0 12px;
  color: #152039;
  line-height: 1.35;
}

.app-detail-richtext :deep(.mci-app-lead h2) { font-size: clamp(24px, 3vw, 34px); }
.app-detail-richtext :deep(.mci-app-section h2) { font-size: 22px; }
.app-detail-richtext :deep(.mci-app-lead > p:last-of-type) { max-width: 900px; }

.app-detail-richtext :deep(.mci-app-tags),
.app-detail-richtext :deep(.mci-flow) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
}

.app-detail-richtext :deep(.mci-app-tags span),
.app-detail-richtext :deep(.mci-flow span) {
  padding: 7px 11px;
  border: 1px solid rgba(98, 81, 199, .18);
  border-radius: 999px;
  color: #4436a2;
  background: rgba(255, 255, 255, .78);
  font-size: 12px;
  font-weight: 700;
}

.app-detail-richtext :deep(.mci-flow i) { color: #8b97aa; font-style: normal; }

.app-detail-richtext :deep(.mci-tech-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.app-detail-richtext :deep(.mci-tech-card) {
  padding: 17px;
  border: 1px solid #e5eaf1;
  border-radius: 14px;
  background: rgba(255, 255, 255, .82);
}

.app-detail-richtext :deep(.mci-tech-card b) { color: #27304a; }
.app-detail-richtext :deep(.mci-tech-card p) { margin: 8px 0 0; color: #5c687a; font-size: 13px; line-height: 1.7; }
.app-detail-richtext :deep(.mci-check-list) { padding-left: 20px; }
.app-detail-richtext :deep(.mci-check-list li) { margin: 8px 0; padding-left: 3px; }
.app-detail-richtext :deep(.mci-check-list.is-two-columns) { columns: 2; column-gap: 34px; }
.app-detail-richtext :deep(.mci-check-list.is-two-columns li) { break-inside: avoid; }
.app-detail-richtext :deep(.mci-app-note) { margin-top: 18px; padding: 13px 15px; border-left: 3px solid #7864d7; background: #f5f3ff; }
.app-detail-richtext :deep(.mci-app-boundary) { border-color: rgba(211, 139, 78, .26); background: linear-gradient(145deg, #fffdf9, #fff8ef); }

@media (max-width: 760px) {
  .app-detail-richtext :deep(.mci-tech-grid) { grid-template-columns: 1fr; }
  .app-detail-richtext :deep(.mci-check-list.is-two-columns) { columns: 1; }
  .app-detail-richtext :deep(.mci-app-lead),
  .app-detail-richtext :deep(.mci-app-section),
  .app-detail-richtext :deep(.mci-app-boundary) { padding: 18px; }
}

.app-detail-description-empty {
  display: grid;
  min-height: 300px;
  place-content: center;
  justify-items: center;
  gap: 10px;
  border: 1px dashed #dfe5ed;
  border-radius: 18px;
  color: #687386;
  text-align: center;
}

.app-detail-description-empty strong { color: #172033; font-size: 22px; }
.app-detail-description-empty p { max-width: 560px; margin: 0; line-height: 1.75; }

:global(html.dark .app-detail-richtext) { color: #cbd5e1; }
:global(html.dark .app-detail-richtext .mci-app-lead),
:global(html.dark .app-detail-richtext .mci-app-section),
:global(html.dark .app-detail-richtext .mci-app-boundary) { border-color: rgba(148, 163, 184, .2); background: #121a2a; }
:global(html.dark .app-detail-richtext .mci-app-lead h2),
:global(html.dark .app-detail-richtext .mci-app-section h2),
:global(html.dark .app-detail-richtext .mci-app-boundary h2),
:global(html.dark .app-detail-richtext .mci-tech-card b) { color: #f4f6fb; }
:global(html.dark .app-detail-richtext .mci-tech-card) { border-color: rgba(148, 163, 184, .16); background: rgba(15, 23, 42, .72); }
:global(html.dark .app-detail-richtext .mci-tech-card p) { color: #b8c2d3; }
:global(html.dark .app-detail-description-empty) { border-color: rgba(148, 163, 184, .24); color: #94a3b8; }
:global(html.dark .app-detail-description-empty strong) { color: #f8fafc; }

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

@keyframes app-detail-enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes app-detail-change-enter {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes app-detail-skeleton {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
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

  .app-detail-skeleton-hero {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .app-detail-skeleton-icon { width: 100px; height: 100px; border-radius: 24px !important; }
  .app-detail-skeleton-actions { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .app-detail-skeleton-panel { grid-template-columns: 1fr; }
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

  .app-detail-cover-card { min-height: 240px; }
  .app-detail-cover-card > img { height: 62vw; min-height: 240px; }
  .app-detail-description-card { padding: 20px; }

  .app-detail-skeleton-hero {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 16px;
    padding: 22px;
    border-radius: 22px;
  }

  .app-detail-skeleton-icon { width: 72px; height: 72px; border-radius: 18px !important; }
  .app-detail-skeleton-actions { grid-template-columns: 1fr; }
  .app-detail-skeleton-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 20px; }
  .app-detail-skeleton-panel { padding: 18px; }
  .app-detail-skeleton-panel .media { height: 230px; }

  .app-detail-changelog {
    padding: 20px 16px;
    border-radius: 22px;
  }

  .app-detail-changelog-header {
    grid-template-columns: 46px minmax(0, 1fr);
    align-items: start;
    gap: 13px;
    padding-bottom: 20px;
  }

  .app-detail-changelog-icon { width: 46px; height: 46px; border-radius: 14px; }
  .app-detail-changelog-icon svg { width: 22px; height: 22px; }
  .app-detail-changelog-title h2 { font-size: 25px; }
  .app-detail-changelog-title p { font-size: 12px; }

  .app-detail-changelog-count {
    grid-column: 1 / -1;
    grid-template-columns: auto auto;
    min-height: 48px;
    padding: 9px 14px;
    align-items: center;
    justify-content: start;
    gap: 8px;
    text-align: left;
  }

  .app-detail-changelog-count strong { font-size: 20px; }

  .app-detail-changelog-timeline,
  .app-detail-changelog-loading { margin-top: 20px; padding-left: 26px; }
  .app-detail-changelog-timeline::before { left: 7px; }
  .app-detail-changelog-dot { left: -25px; width: 12px; height: 12px; border-width: 3px; }
  .app-detail-changelog-card { padding: 17px 16px; border-radius: 15px; }
  .app-detail-changelog-card > header { align-items: flex-start; flex-direction: column; gap: 9px; }
  .app-detail-changelog-card h3 { font-size: 16px; }
  .app-detail-changelog-card p { font-size: 13px; line-height: 1.78; }
  .app-detail-changelog-empty { grid-template-columns: 42px minmax(0, 1fr); padding: 17px; }
  .app-detail-changelog-empty-icon { width: 42px; height: 42px; border-radius: 12px; }
  .app-detail-changelog-empty button { grid-column: 1 / -1; width: 100%; }
  .app-detail-changelog-toggle { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .app-detail-shell,
  .app-detail-changelog-item,
  .app-detail-skeleton-block {
    animation: none !important;
    opacity: 1;
    transform: none;
  }

  .app-detail-back,
  .app-detail-actions button,
  .app-detail-actions a,
  .app-detail-changelog-card,
  .app-detail-changelog button {
    transition: none !important;
  }
}
</style>
