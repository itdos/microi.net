<template>
  <section
    class="mci-nuget-stats"
    :class="`mci-nuget-stats--${variant}`"
    :aria-label="copy.ariaLabel"
    :aria-busy="state === 'refreshing'"
    :data-state="state"
  >
    <a
      class="mci-nuget-stats__card"
      :href="stats.profileUrl"
      target="_blank"
      rel="noopener noreferrer"
      :title="copy.linkTitle"
    >
      <span class="mci-nuget-stats__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z" />
          <path d="m5 7.5 7 3.5 7-3.5M12 11v9" />
          <circle cx="8.5" cy="9.2" r="1" />
        </svg>
      </span>

      <span class="mci-nuget-stats__body">
        <span class="mci-nuget-stats__eyebrow">
          <i aria-hidden="true"></i>{{ copy.eyebrow }}
        </span>
        <strong class="mci-nuget-stats__title">{{ copy.title }}</strong>
        <span v-if="variant !== 'sidebar'" class="mci-nuget-stats__description">{{ copy.description }}</span>
      </span>

      <span class="mci-nuget-stats__metric" :aria-label="`${exactDownloads} ${copy.downloads}`">
        <strong>{{ compactDownloads }}</strong>
        <span>{{ copy.downloads }}</span>
        <small>{{ exactDownloads }}</small>
        <span class="mci-nuget-stats__status" role="status" aria-live="polite">
          <span class="mci-nuget-stats__status-orbit" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span>{{ statusText }}</span>
        </span>
      </span>

      <span class="mci-nuget-stats__arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </span>
    </a>

    <p v-if="variant !== 'sidebar'" class="mci-nuget-stats__meta">
      <span>{{ sourceText }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ copy.methodNote }}</span>
    </p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vitepress'
import {
  NUGET_FALLBACK_STATS,
  formatCompactDownloads,
  loadCachedNugetStats,
  loadLocalNugetStats,
  loadNugetOwnerStats,
  persistLocalNugetStats,
  preferHigherNugetStats
} from '../utils/nuget-downloads.js'

const props = defineProps({
  variant: {
    type: String,
    default: 'feature',
    validator: value => ['feature', 'home', 'sidebar'].includes(value)
  },
  locale: {
    type: String,
    default: ''
  }
})

const route = useRoute()
const stats = ref({ ...NUGET_FALLBACK_STATS })
const displayDownloads = ref(NUGET_FALLBACK_STATS.totalDownloads)
const state = ref('cache-loading')
let mounted = false
let animationFrame = 0
let animationResolve

const activeLocale = computed(() => props.locale || (/^\/en(?:\/|$)/.test(route.path || '') ? 'en-US' : 'zh-CN'))
const isEnglish = computed(() => activeLocale.value.toLowerCase().startsWith('en'))
const compactDownloads = computed(() => formatCompactDownloads(displayDownloads.value, activeLocale.value))
const exactDownloads = computed(() => new Intl.NumberFormat(activeLocale.value).format(displayDownloads.value))

const updateTime = computed(() => {
  if (!stats.value.queriedAt) return ''
  const date = new Date(stats.value.queriedAt)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(activeLocale.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
})

const copy = computed(() => isEnglish.value ? {
  ariaLabel: 'Microi NuGet download statistics',
  eyebrow: 'NUGET OFFICIAL LIVE DATA',
  title: 'Ranks first by downloads among publicly searchable .NET AI low-code platforms',
  description: 'Public packages owned by ITdos, aggregated by the official iTdos API Engine and retained in Redis plus a daily database snapshot.',
  downloads: 'downloads',
  cacheLoading: 'Reading recent data',
  updating: 'Updating now',
  current: 'Current API live total',
  cached: 'Latest successful total',
  database: 'Daily database snapshot',
  browser: 'Browser last-success snapshot',
  fallback: 'Embedded recent snapshot',
  liveSource: `${stats.value.packageCount} packages · current API live total${updateTime.value ? ` · ${updateTime.value}` : ''}`,
  cachedSource: `${stats.value.packageCount} packages · Redis latest successful total${updateTime.value ? ` · ${updateTime.value}` : ''}`,
  databaseSource: `${stats.value.packageCount} packages · daily database snapshot${updateTime.value ? ` · ${updateTime.value}` : ''}`,
  browserSource: `${stats.value.packageCount} packages · browser last-success snapshot${updateTime.value ? ` · ${updateTime.value}` : ''}`,
  fallbackSource: 'Built-in recent snapshot · opening the profile shows the current public data',
  methodNote: 'Official indexes update asynchronously; the category statement is based on publicly searchable peers, not an official Microsoft ranking.',
  linkTitle: 'Open the official ITdos profile on NuGet'
} : {
  ariaLabel: 'Microi吾码 NuGet 下载量统计',
  eyebrow: 'NUGET 官方实时数据',
  title: 'NuGet 可公开检索的 .NET AI 低代码平台中下载量位居首位',
  description: '由 iTdos 官方接口引擎汇总 ITdos 名下公开包，成功结果先写入 Redis，再按日持久化到数据库。长期、可核验的数据可从侧面反映平台成熟度与开发者采用情况。',
  downloads: '累计下载',
  cacheLoading: '正在读取最近数据',
  updating: '正在更新',
  current: '当前 API 实时汇总',
  cached: '最近一次成功汇总',
  database: '数据库每日持久快照',
  browser: '浏览器最近成功快照',
  fallback: '官网内置最近快照',
  liveSource: `${stats.value.packageCount} 个公开包 · 当前 API 实时汇总${updateTime.value ? ` · 更新于 ${updateTime.value}` : ''}`,
  cachedSource: `${stats.value.packageCount} 个公开包 · Redis 最近一次成功汇总${updateTime.value ? ` · 更新于 ${updateTime.value}` : ''}`,
  databaseSource: `${stats.value.packageCount} 个公开包 · 数据库每日持久快照${updateTime.value ? ` · 更新于 ${updateTime.value}` : ''}`,
  browserSource: `${stats.value.packageCount} 个公开包 · 浏览器最近成功快照${updateTime.value ? ` · 更新于 ${updateTime.value}` : ''}`,
  fallbackSource: '官网内置最近快照 · 点击前往 NuGet 官方主页查看公开数据',
  methodNote: 'NuGet 各官方索引异步同步，数值可能短时略有差异；“位居首位”按可公开检索的同类平台下载量口径，不代表微软 / NuGet 官方评选。',
  linkTitle: '前往 NuGet 官方 ITdos 主页查看全部包与实时下载量'
})

const statusText = computed(() => {
  if (state.value === 'cache-loading') return copy.value.cacheLoading
  if (state.value === 'refreshing') return copy.value.updating
  if (state.value === 'live') return copy.value.current
  if (state.value === 'cached') {
    if (stats.value.stage === 'database') return copy.value.database
    if (stats.value.stage === 'browser') return copy.value.browser
    return copy.value.cached
  }
  return copy.value.fallback
})

const sourceText = computed(() => {
  if (state.value === 'live') return copy.value.liveSource
  if (state.value === 'refreshing' || state.value === 'cached') {
    if (stats.value.stage === 'database') return copy.value.databaseSource
    if (stats.value.stage === 'browser') return copy.value.browserSource
    if (stats.value.stage === 'cache') return copy.value.cachedSource
  }
  return copy.value.fallbackSource
})

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function cancelNumberAnimation() {
  if (animationFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animationFrame)
  animationFrame = 0
  if (animationResolve) animationResolve()
  animationResolve = undefined
}

function animateDownloads(nextValue, duration = 720) {
  const target = Number(nextValue)
  if (!Number.isFinite(target) || target < 0) return Promise.resolve()
  cancelNumberAnimation()

  const startValue = Number(displayDownloads.value) || 0
  if (startValue === target || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    displayDownloads.value = Math.floor(target)
    return Promise.resolve()
  }

  return new Promise(resolve => {
    animationResolve = resolve
    const startedAt = performance.now()
    const step = now => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      displayDownloads.value = Math.floor(startValue + ((target - startValue) * eased))
      if (progress < 1 && mounted) {
        animationFrame = requestAnimationFrame(step)
        return
      }
      displayDownloads.value = Math.floor(target)
      animationFrame = 0
      const done = animationResolve
      animationResolve = undefined
      done?.()
    }
    animationFrame = requestAnimationFrame(step)
  })
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)))
}

onMounted(async () => {
  mounted = true
  let successfulSnapshotLoaded = false

  const local = loadLocalNugetStats()
  if (local) {
    stats.value = preferHigherNugetStats(stats.value, local)
    displayDownloads.value = stats.value.totalDownloads
    state.value = 'cached'
    successfulSnapshotLoaded = true
  }

  try {
    const cached = await loadCachedNugetStats()
    if (!mounted) return
    stats.value = preferHigherNugetStats(stats.value, cached)
    persistLocalNugetStats(cached)
    successfulSnapshotLoaded = true
    animateDownloads(stats.value.totalDownloads, 360)
  } catch {
    // 服务端不可达时保留浏览器最后成功快照；首次访问再使用官网内置快照。
  }

  if (!mounted) return
  state.value = 'refreshing'
  const refreshingSince = performance.now()

  try {
    const refreshed = await loadNugetOwnerStats()
    if (!mounted) return
    await wait(950 - (performance.now() - refreshingSince))
    if (!mounted) return
    const selected = preferHigherNugetStats(stats.value, refreshed)
    const selectedCurrentRefresh = selected === refreshed && refreshed.isLive
    stats.value = selected
    persistLocalNugetStats(refreshed)
    successfulSnapshotLoaded = true
    await animateDownloads(stats.value.totalDownloads)
    if (!mounted) return
    state.value = selectedCurrentRefresh
      ? 'live'
      : (successfulSnapshotLoaded ? 'cached' : 'fallback')
  } catch {
    await wait(950 - (performance.now() - refreshingSince))
    if (!mounted) return
    state.value = successfulSnapshotLoaded ? 'cached' : 'fallback'
  }
})

onBeforeUnmount(() => {
  mounted = false
  cancelNumberAnimation()
})
</script>
