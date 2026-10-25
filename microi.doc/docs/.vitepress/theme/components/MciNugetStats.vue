<template>
  <section
    class="mci-nuget-stats"
    :class="`mci-nuget-stats--${variant}`"
    :aria-label="copy.ariaLabel"
    :aria-busy="state === 'snapshot-loading'"
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
        <time v-if="updateTime" class="mci-nuget-stats__updated-at" :datetime="stats.queriedAt">
          {{ copy.updatedAt }} {{ updateTime }}
        </time>
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
  loadLocalNugetStats,
  loadNugetSnapshot,
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
const state = ref(NUGET_FALLBACK_STATS.stage === 'build' ? 'build' : 'fallback')
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
    // 固定官方统计时区，让服务端预渲染与不同地区浏览器显示同一采集时间。
    timeZone: 'Asia/Shanghai',
    timeZoneName: 'short',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
})

const copy = computed(() => isEnglish.value ? {
  ariaLabel: 'Microi NuGet download statistics',
  eyebrow: 'NUGET OFFICIAL SNAPSHOT',
  title: 'Official NuGet package download statistics',
  description: 'Public ITdos packages are scheduled for collection every 3 hours. Check the collection time below: the initial build snapshot is updated after a successful online read.',
  downloads: 'downloads',
  snapshotLoading: 'Reading latest snapshot',
  snapshot: 'Last successful collection',
  updatedAt: 'Collected',
  browser: 'Browser last-success snapshot',
  build: 'Website build snapshot',
  fallback: 'Historical embedded snapshot',
  snapshotSource: `${stats.value.packageCount} packages · latest successful snapshot`,
  browserSource: `${stats.value.packageCount} packages · browser last-success snapshot`,
  buildSource: `${stats.value.packageCount} packages · snapshot captured for this website build`,
  fallbackSource: 'Historical snapshot · opening the profile shows the current public data',
  methodNote: 'Downloads include repeated restores and CI. They do not measure unique users, paying customers or market rank; official indexes may update at different times.',
  linkTitle: 'Open the official ITdos profile on NuGet'
} : {
  ariaLabel: 'Microi吾码 NuGet 下载量统计',
  eyebrow: 'NUGET 官方快照数据',
  title: 'NuGet 官方包下载统计',
  description: '统计覆盖 ITdos 名下公开包，采集计划为每 3 小时一次，请结合下方采集时间查看。页面初始显示构建快照，联网成功后更新为最近成功快照。',
  downloads: '累计下载',
  snapshotLoading: '正在读取最新快照',
  snapshot: '最近成功采集',
  updatedAt: '采集于',
  browser: '浏览器最近成功快照',
  build: '官网构建快照',
  fallback: '历史内置快照',
  snapshotSource: `${stats.value.packageCount} 个公开包 · 最新成功快照`,
  browserSource: `${stats.value.packageCount} 个公开包 · 浏览器最近成功快照`,
  buildSource: `${stats.value.packageCount} 个公开包 · 本次官网构建时读取的快照`,
  fallbackSource: '历史快照 · 点击前往 NuGet 官方主页查看公开数据',
  methodNote: '下载量包含重复还原与 CI，不等于独立用户、付费客户或市场排名；NuGet 官方各索引异步更新，数值可能短时不同。',
  linkTitle: '前往 NuGet 官方 ITdos 主页查看全部包与实时下载量'
})

const statusText = computed(() => {
  if (state.value === 'snapshot-loading') return copy.value.snapshotLoading
  if (state.value === 'snapshot') return copy.value.snapshot
  if (state.value === 'cached') return copy.value.browser
  if (state.value === 'build') return copy.value.build
  return copy.value.fallback
})

const sourceText = computed(() => {
  if (state.value === 'snapshot') return copy.value.snapshotSource
  if (stats.value.stage === 'browser') return copy.value.browserSource
  if (stats.value.stage === 'build') return copy.value.buildSource
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

onMounted(async () => {
  mounted = true
  state.value = 'snapshot-loading'
  let successfulSnapshotLoaded = false

  const local = loadLocalNugetStats()
  if (local) {
    stats.value = preferHigherNugetStats(stats.value, local)
    displayDownloads.value = stats.value.totalDownloads
    successfulSnapshotLoaded = stats.value.stage === 'browser'
  }

  try {
    const snapshot = await loadNugetSnapshot()
    if (!mounted) return
    // 服务端已按成功采集时间选定最新快照，浏览器历史高水位不能盖过权威结果。
    stats.value = snapshot
    persistLocalNugetStats(snapshot)
    await animateDownloads(stats.value.totalDownloads)
    if (!mounted) return
    state.value = 'snapshot'
  } catch {
    // 服务端不可达时保留浏览器最后成功快照；首次访问再使用带时间标识的内置快照。
    if (!mounted) return
    state.value = successfulSnapshotLoaded ? 'cached' : (stats.value.stage === 'build' ? 'build' : 'fallback')
  }
})

onBeforeUnmount(() => {
  mounted = false
  cancelNumberAnimation()
})
</script>
