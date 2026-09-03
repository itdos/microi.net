<template>
  <section class="home-overview" data-testid="platform-home-overview">
    <div v-if="loading" class="overview-skeleton" role="status" aria-label="首页概览加载中">
      <div class="skeleton-heading"><span></span><span></span></div>
      <div class="skeleton-metrics"><span v-for="item in 4" :key="item"></span></div>
      <div class="skeleton-body"><span></span><span></span></div>
    </div>

    <div v-else-if="errorMessage" class="overview-error" role="alert">
      <el-icon><Warning /></el-icon>
      <div><strong>工作概览暂时不可用</strong><span>{{ errorMessage }}</span></div>
      <button type="button" @click="loadDashboard">重新加载</button>
    </div>

    <template v-else>
      <header class="overview-heading">
        <div>
          <span>{{ greetingLabel }}</span>
          <h2>{{ currentUserName }}，这是你的工作概览</h2>
          <p>趋势与常用应用均来自当前账号的真实访问记录，并按现有菜单权限过滤。</p>
        </div>
        <button type="button" class="assistant-link" @click="openAssistant">
          打开完整 AI 助手 <el-icon><Right /></el-icon>
        </button>
      </header>

      <div class="metric-strip" aria-label="个人使用统计">
        <div v-for="metric in metrics" :key="metric.key" class="metric-item">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </div>
      </div>

      <div class="overview-body">
        <section class="trend-panel">
          <div class="section-heading">
            <div><strong>近 7 日使用趋势</strong><span>菜单打开次数</span></div>
            <em>{{ dashboard.DataAsOf || '' }}</em>
          </div>
          <div ref="chartRef" class="usage-chart" data-testid="home-usage-chart"></div>
        </section>

        <section class="apps-panel" data-testid="home-frequent-apps">
          <div class="section-heading">
            <div><strong>常用应用</strong><span>{{ dashboard.HasHistory ? '按实际打开频率排序' : '尚无记录，先为你展示可用入口' }}</span></div>
          </div>
          <div v-if="dashboard.FrequentApps?.length" class="app-grid">
            <button
              v-for="app in dashboard.FrequentApps"
              :key="app.Id"
              type="button"
              class="app-entry"
              @click="openApp(app)"
            >
              <span class="app-icon" :style="iconTone(app)">
                <img v-if="resolveMenuIcon(app.Icon)" :src="resolveMenuIcon(app.Icon)" alt="" />
                <i v-else-if="app.IconClass" :class="app.IconClass" aria-hidden="true"></i>
                <b v-else>{{ appInitial(app.Name) }}</b>
              </span>
              <span class="app-copy"><strong>{{ app.Name }}</strong><small>{{ app.OpenCount ? `${app.OpenCount} 次访问` : '可立即打开' }}</small></span>
              <el-icon><Right /></el-icon>
            </button>
          </div>
          <div v-else class="apps-empty">当前账号暂无可用菜单，请联系管理员配置权限。</div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup name="homeoverview-widget">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Right, Warning } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'
import { useDiyStore } from '@/pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const { proxy } = getCurrentInstance()
const router = useRouter()
const diyStore = useDiyStore()
const pageEngineStore = usePageEngineStore()
const { dark, formData } = storeToRefs(pageEngineStore)
const loading = ref(true)
const errorMessage = ref('')
const chartRef = ref(null)
const dashboard = ref({
  TodayOpenCount: 0,
  WeekOpenCount: 0,
  UsedAppCount: 0,
  AccessibleAppCount: 0,
  AiToolCount: 29,
  Dates: [],
  Counts: [],
  FrequentApps: [],
  HasHistory: false,
  DataAsOf: '',
})
let chartInstance = null
let resizeObserver = null
let themeObserver = null

const currentUserName = computed(() => {
  const user = diyStore.GetCurrentUser || {}
  return user.Name || user.Account || '你好'
})

const greetingLabel = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const metrics = computed(() => [
  { key: 'today', label: '今日打开', value: dashboard.value.TodayOpenCount || 0, hint: '当前账号' },
  { key: 'week', label: '近 7 日访问', value: dashboard.value.WeekOpenCount || 0, hint: '真实使用次数' },
  { key: 'used', label: '已使用应用', value: dashboard.value.UsedAppCount || 0, hint: `共 ${dashboard.value.AccessibleAppCount || 0} 个可用` },
  { key: 'ai', label: 'AI 图像工具', value: dashboard.value.AiToolCount || 29, hint: '生成与精确处理' },
])

const engineKey = computed(() => String(props.widgetObj?.widgetParams?.[0]?.value || 'platform-home-overview').trim())

function normalizeResult(result) {
  if (result?.Result?.Code !== undefined) return result.Result
  return result
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = normalizeResult(await proxy.DiyCommon.ApiEngine.Run(engineKey.value, { Action: 'Dashboard' }))
    if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '接口未返回有效数据')
    dashboard.value = { ...dashboard.value, ...(result.Data || {}) }
    await nextTick()
    renderChart()
  } catch (error) {
    errorMessage.value = String(error?.message || error || '加载失败')
  } finally {
    loading.value = false
    await nextTick()
    renderChart()
  }
}

function renderChart() {
  if (loading.value || errorMessage.value || !chartRef.value) return
  if (!chartInstance) chartInstance = echarts.init(chartRef.value)
  const rootStyle = getComputedStyle(chartRef.value)
  const primary = rootStyle.getPropertyValue('--mci-theme-color').trim() || '#7c3aed'
  const text = rootStyle.getPropertyValue('--mci-text-secondary').trim() || (dark.value ? '#aab4c4' : '#6b7280')
  const border = rootStyle.getPropertyValue('--mci-border-color').trim() || (dark.value ? 'rgba(255,255,255,.10)' : '#e7eaf0')
  chartInstance.setOption({
    animationDuration: 420,
    grid: { top: 22, right: 14, bottom: 28, left: 38 },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>打开 {c} 次' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dashboard.value.Dates || [],
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
      axisLabel: { color: text, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: text, fontSize: 11 },
      splitLine: { lineStyle: { color: border, type: 'dashed' } },
    },
    series: [{
      name: '菜单打开次数',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      data: dashboard.value.Counts || [],
      lineStyle: { width: 3, color: primary },
      itemStyle: { color: primary, borderColor: dark.value ? '#111827' : '#fff', borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: echarts.color.modifyAlpha(primary, 0.26) },
          { offset: 1, color: echarts.color.modifyAlpha(primary, 0.02) },
        ]),
      },
    }],
  }, true)
}

function openAssistant() {
  router.push('/mic-ai-engine')
}

function openApp(app) {
  const url = String(app?.Url || '').trim()
  if (!url || !url.startsWith('/') || url.startsWith('//')) return
  router.push(url)
}

function resolveMenuIcon(icon) {
  const value = String(icon || '').trim()
  if (!value) return ''
  return proxy.DiyCommon.GetServerPath ? proxy.DiyCommon.GetServerPath(value) : value
}

function appInitial(name) {
  return String(name || '应').trim().slice(0, 1)
}

function iconTone(app) {
  const tones = [
    ['#7c3aed', 'rgba(124,58,237,.10)'],
    ['#2563eb', 'rgba(37,99,235,.10)'],
    ['#0f9f91', 'rgba(15,159,145,.10)'],
    ['#ea7b13', 'rgba(234,123,19,.11)'],
  ]
  const text = String(app?.Id || app?.Name || '')
  const index = [...text].reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length
  return { color: tones[index][0], backgroundColor: tones[index][1] }
}

watch(dark, () => nextTick(renderChart))
watch(() => formData.value?.JsonObj?.formConfig?.lastRefreshTime, loadDashboard)

onMounted(() => {
  loadDashboard()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    if (chartRef.value) resizeObserver.observe(chartRef.value)
  }
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => nextTick(renderChart))
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style lang="scss" scoped>
.home-overview {
  --home-panel: var(--mci-bg-card, var(--el-bg-color, #fff));
  --home-surface: var(--mci-bg-surface, var(--el-fill-color-light, #f7f8fb));
  --home-border: var(--mci-border-color, var(--el-border-color-lighter, #e7eaf0));
  --home-text: var(--mci-text-primary, var(--el-text-color-primary, #172033));
  --home-muted: var(--mci-text-secondary, var(--el-text-color-secondary, #697386));
  width: 100%;
  min-width: 0;
  min-height: 420px;
  box-sizing: border-box;
  color: var(--home-text);
  padding: 4px;
}

.overview-heading {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 4px 12px;
}

.overview-heading > div { min-width: 0; }
.overview-heading span { color: var(--mci-theme-color, #7c3aed); font-size: 11px; font-weight: 700; }
.overview-heading h2 { margin: 3px 0 2px; color: var(--home-text); font-size: clamp(20px, 2vw, 27px); letter-spacing: -.02em; }
.overview-heading p { margin: 0; color: var(--home-muted); font-size: 12px; }

.assistant-link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--mci-theme-color, #7c3aed) 25%, var(--home-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--mci-theme-color, #7c3aed) 6%, var(--home-panel));
  color: var(--mci-theme-color, #7c3aed);
  cursor: pointer;
  padding: 0 13px;
  white-space: nowrap;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--home-border);
  border-radius: 14px;
  background: var(--home-panel);
  overflow: hidden;
}

.metric-item {
  min-width: 0;
  min-height: 76px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-content: center;
  gap: 2px 10px;
  border-right: 1px solid var(--home-border);
  padding: 10px 16px;
}

.metric-item:last-child { border-right: 0; }
.metric-item span { color: var(--home-muted); font-size: 12px; }
.metric-item strong { grid-row: 1 / 3; grid-column: 2; color: var(--home-text); font-size: 27px; line-height: 1; }
.metric-item small { color: var(--home-muted); font-size: 10px; }

.overview-body {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, .9fr);
  gap: 12px;
  margin-top: 12px;
}

.trend-panel,
.apps-panel {
  min-width: 0;
  min-height: 250px;
  border: 1px solid var(--home-border);
  border-radius: 14px;
  background: var(--home-panel);
  padding: 13px 15px;
  box-sizing: border-box;
}

.section-heading {
  min-height: 34px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-heading > div { display: grid; gap: 1px; }
.section-heading strong { color: var(--home-text); font-size: 14px; }
.section-heading span,
.section-heading em { color: var(--home-muted); font-size: 10px; font-style: normal; }
.usage-chart { width: 100%; height: 195px; }

.app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.app-entry {
  min-width: 0;
  min-height: 57px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--home-text);
  cursor: pointer;
  padding: 5px 7px;
  text-align: left;
}

.app-entry:hover,
.app-entry:focus-visible { outline: none; background: var(--home-surface); }
.app-entry > .el-icon { color: var(--home-muted); font-size: 12px; }
.app-icon { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; overflow: hidden; }
.app-icon img { width: 100%; height: 100%; object-fit: contain; }
.app-icon i { font-size: 16px; }
.app-icon b { font-size: 13px; }
.app-copy { min-width: 0; display: grid; gap: 2px; }
.app-copy strong,
.app-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-copy strong { color: var(--home-text); font-size: 12px; font-weight: 600; }
.app-copy small { color: var(--home-muted); font-size: 10px; }
.apps-empty { min-height: 190px; display: grid; place-items: center; color: var(--home-muted); font-size: 12px; text-align: center; }

.overview-skeleton { display: grid; gap: 12px; }
.skeleton-heading { height: 66px; display: grid; align-content: center; gap: 8px; }
.skeleton-heading span,
.skeleton-metrics span,
.skeleton-body span { display: block; border-radius: 10px; background: linear-gradient(90deg, var(--home-surface), color-mix(in srgb, var(--home-surface) 60%, var(--home-panel)), var(--home-surface)); background-size: 200% 100%; animation: home-skeleton 1.3s ease-in-out infinite; }
.skeleton-heading span:first-child { width: 110px; height: 12px; }
.skeleton-heading span:last-child { width: 320px; height: 25px; }
.skeleton-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; }
.skeleton-metrics span { height: 76px; }
.skeleton-body { display: grid; grid-template-columns: 1.45fr .9fr; gap: 12px; }
.skeleton-body span { height: 260px; }
@keyframes home-skeleton { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

.overview-error { min-height: 360px; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--home-muted); }
.overview-error > .el-icon { color: var(--el-color-warning); font-size: 28px; }
.overview-error > div { display: grid; gap: 3px; }
.overview-error strong { color: var(--home-text); }
.overview-error button { border: 1px solid var(--home-border); border-radius: 9px; background: var(--home-panel); color: var(--home-text); cursor: pointer; padding: 7px 11px; }

@media (max-width: 980px) {
  .overview-body { grid-template-columns: 1fr; }
  .home-overview { min-height: 0; }
}

@media (max-width: 720px) {
  .home-overview { padding: 0; }
  .overview-heading { align-items: flex-start; }
  .overview-heading p,
  .assistant-link { display: none; }
  .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-item { border-bottom: 1px solid var(--home-border); }
  .metric-item:nth-child(2) { border-right: 0; }
  .metric-item:nth-child(n+3) { border-bottom: 0; }
  .overview-body { grid-template-columns: 1fr; }
  .app-grid { grid-template-columns: 1fr; }
  .skeleton-metrics { grid-template-columns: repeat(2, 1fr); }
  .skeleton-body { grid-template-columns: 1fr; }
}
</style>
