<template>
  <view class="pe-widget" :class="`pe-widget--${widget.type}`">
    <view v-if="widget.loading" class="pe-widget__loading">
      <view v-for="index in 3" :key="index" />
    </view>

    <view v-else-if="widget.error" class="pe-widget__state pe-widget__state--error">
      <mci-symbol name="info" tone="danger" :size="52" />
      <view><text>{{ widget.label }}</text><text>{{ widget.error }}</text></view>
    </view>

    <view v-else-if="widget.type === 'unsupported'" class="pe-widget__state">
      <mci-symbol name="info" :size="52" />
      <view><text>{{ widget.label }}</text><text>移动端暂不支持 {{ widget.originalType || '该组件' }}，不会执行远程代码</text></view>
    </view>

    <view v-else-if="widget.type === 'workbench'" class="pe-workbench">
      <image v-if="workbench.icon" :src="asset(workbench.icon)" mode="aspectFit" />
      <view><text>{{ workbench.title || widget.label }}</text><text>{{ workbench.subTitle || '移动工作空间' }}</text></view>
    </view>

    <view v-else-if="widget.type === 'statistic'" class="pe-stat-grid">
      <view v-for="(item, index) in dataRows" :key="`${widget.key}:${index}`" class="pe-stat" :style="{ borderTopColor: color(index) }">
        <text class="pe-stat__label">{{ item.name || item.title || item.label || `指标 ${index + 1}` }}</text>
        <text class="pe-stat__value">{{ displayValue(item.value) }}</text>
      </view>
      <view v-if="!dataRows.length" class="pe-widget__empty">暂无指标数据</view>
    </view>

    <view v-else-if="widget.type === 'progress'" class="pe-progress-list">
      <view v-for="(item, index) in dataRows" :key="`${widget.key}:${index}`" class="pe-progress">
        <view class="pe-progress__heading"><text>{{ item.title || item.name || `进度 ${index + 1}` }}</text><text>{{ progressValue(item) }}%</text></view>
        <progress :percent="progressValue(item)" :activeColor="color(index)" backgroundColor="#e8eff2" stroke-width="8" />
        <text v-if="item.subTitle" class="pe-progress__note">{{ item.subTitle }}</text>
      </view>
      <view v-if="!dataRows.length" class="pe-widget__empty">暂无进度数据</view>
    </view>

    <view v-else-if="widget.type === 'links'" class="pe-links">
      <view v-for="(item, index) in dataRows" :key="`${widget.key}:${index}`" class="pe-link" hover-class="pe-link--pressed" @tap="openLink(item)">
        <image :src="asset(item.iconUrl || item.icon)" mode="aspectFit" />
        <text>{{ item.title || item.name || `入口 ${index + 1}` }}</text>
      </view>
      <view v-if="!dataRows.length" class="pe-widget__empty">暂无快捷入口</view>
    </view>

    <view v-else-if="widget.type === 'tabel'" class="pe-table-cards">
      <view v-if="tableTotal" class="pe-table-cards__summary">共 {{ tableTotal }} 条</view>
      <view v-for="(row, rowIndex) in tableRows" :key="row.Id || `${widget.key}:${rowIndex}`" class="pe-table-card">
        <view v-for="header in tableHeaders" :key="header.prop" class="pe-table-card__field">
          <text>{{ header.label }}</text><text>{{ displayValue(row[header.prop]) }}</text>
        </view>
      </view>
      <view v-if="!tableRows.length" class="pe-widget__empty">暂无明细数据</view>
    </view>

    <view v-else-if="chartTypes.includes(widget.type)" class="pe-chart">
      <view v-if="widget.label" class="pe-chart__title">{{ widget.label }}</view>
      <view v-for="(row, rowIndex) in chartRows" :key="`${widget.key}:${rowIndex}`" class="pe-chart__row">
        <view class="pe-chart__heading"><text>{{ row.label }}</text><text>{{ displayValue(row.total) }}</text></view>
        <view class="pe-chart__bars">
          <view v-for="(segment, segmentIndex) in row.segments" :key="segmentIndex" class="pe-chart__bar" :style="{ width: `${segment.percent}%`, backgroundColor: color(segmentIndex) }" />
        </view>
      </view>
      <view v-if="chartLegend.length" class="pe-chart__legend">
        <view v-for="(item, index) in chartLegend" :key="`${widget.key}:legend:${index}`"><view :style="{ backgroundColor: color(index) }" /><text>{{ item }}</text></view>
      </view>
      <view v-if="!chartRows.length" class="pe-widget__empty">暂无图表数据</view>
    </view>

    <view v-else-if="widget.type === 'steps' || widget.type === 'timeline'" class="pe-timeline">
      <view v-for="(item, index) in stepRows" :key="`${widget.key}:${index}`" class="pe-timeline__item">
        <view class="pe-timeline__rail"><view :style="{ backgroundColor: color(index) }" /><view v-if="index < stepRows.length - 1" /></view>
        <view class="pe-timeline__copy"><text>{{ item.title || item.name || `步骤 ${index + 1}` }}</text><text>{{ item.description || item.content || item.timestamp || '' }}</text></view>
      </view>
      <view v-if="!stepRows.length" class="pe-widget__empty">暂无步骤数据</view>
    </view>

    <view v-else-if="widget.type === 'collapse'" class="pe-collapse">
      <view v-for="(item, index) in dataRows" :key="`${widget.key}:${index}`" class="pe-collapse__item">
        <view class="pe-collapse__heading" hover-class="pe-collapse__heading--pressed" @tap="toggleCollapse(index)">
          <text>{{ item.title || item.name || `内容 ${index + 1}` }}</text><view class="pe-collapse__toggle" :class="{ 'is-expanded': expanded[index] }" aria-hidden="true" />
        </view>
        <text v-if="expanded[index]" class="pe-collapse__content">{{ plainText(item.content || item.description) }}</text>
      </view>
      <view v-if="!dataRows.length" class="pe-widget__empty">暂无折叠内容</view>
    </view>

    <view v-else-if="widget.type === 'descriptions'" class="pe-descriptions">
      <view v-for="(item, index) in descriptionRows" :key="`${widget.key}:${index}`"><text>{{ item.label }}</text><text>{{ displayValue(item.value) }}</text></view>
      <view v-if="!descriptionRows.length" class="pe-widget__empty">暂无描述数据</view>
    </view>

    <image v-else-if="widget.type === 'image' && mediaUrl" class="pe-media pe-media--image" :src="mediaUrl" mode="widthFix" />
    <video v-else-if="widget.type === 'video' && mediaUrl" class="pe-media" :src="mediaUrl" :controls="widget.options.controls !== false" :autoplay="widget.options.autoplay === true" :loop="widget.options.loop === true" :muted="widget.options.muted !== false" />

    <swiper v-else-if="widget.type === 'carousel' && dataRows.length" class="pe-carousel" circular autoplay indicator-dots>
      <swiper-item v-for="(item, index) in dataRows" :key="`${widget.key}:${index}`"><image :src="asset(item.url || item.src)" mode="aspectFill" /></swiper-item>
    </swiper>

    <view v-else-if="widget.type === 'aiengine'" class="pe-ai" hover-class="pe-ai--pressed" @tap="openAi">
      <view class="pe-ai__icon">AI</view><view><text>AI 助手</text><text>进入当前企业的智能助手</text></view><view class="pe-ai__arrow" aria-hidden="true" />
    </view>

    <view v-else-if="widget.type === 'pageengine'" class="pe-widget__state">
      <mci-symbol name="info" :size="52" /><view><text>{{ widget.label }}</text><text>{{ widget.pageId ? '嵌套页面暂未加载' : '未配置嵌套页面' }}</text></view>
    </view>

    <view v-else class="pe-widget__empty">{{ widget.label }} 暂无可展示数据</view>
  </view>
</template>

<script>
import { publicAssetUrl } from '@/platform/display.js'

const COLORS = ['#087da8', '#316ceb', '#1f9d72', '#d28619', '#7957d5', '#d75a43']
const TAB_ROUTES = new Set(['/pages/home/index', '/pages/workspace/index', '/pages/message/index', '/pages/profile/index'])

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export default {
  name: 'MciPageEngineWidget',
  props: { widget: { type: Object, required: true } },
  data() {
    return {
      expanded: {},
      chartTypes: ['bar', 'line', 'linebar', 'pie', 'funnel']
    }
  },
  computed: {
    dataRows() {
      if (Array.isArray(this.widget.data)) return this.widget.data
      return Array.isArray(this.widget.data?.data) ? this.widget.data.data : []
    },
    workbench() { return this.widget.data && typeof this.widget.data === 'object' ? this.widget.data : {} },
    tableRows() { return Array.isArray(this.widget.data?.bodyData) ? this.widget.data.bodyData.slice(0, 20) : [] },
    tableHeaders() {
      const headers = Array.isArray(this.widget.data?.headerData) ? this.widget.data.headerData : []
      return headers.filter((item) => item && item.prop).slice(0, 5).map((item) => ({ prop: item.prop, label: item.label || item.prop }))
    },
    tableTotal() { return Number(this.widget.data?.total || this.tableRows.length) },
    stepRows() {
      if (Array.isArray(this.widget.data)) return this.widget.data
      return Array.isArray(this.widget.data?.stepArr) ? this.widget.data.stepArr : this.dataRows
    },
    descriptionRows() {
      const source = this.widget.data
      if (Array.isArray(source)) {
        return source.slice(0, 30).map((item, index) => ({
          label: item?.label || item?.name || item?.title || `字段 ${index + 1}`,
          value: item?.value ?? item?.content ?? ''
        }))
      }
      if (!source || typeof source !== 'object') return []
      return Object.keys(source).filter((key) => !['searchData', 'data'].includes(key)).slice(0, 30)
        .map((key) => ({ label: key, value: source[key] }))
    },
    mediaUrl() { return this.asset(this.widget.mediaUrl) },
    chartLegend() {
      if (['bar', 'line', 'linebar'].includes(this.widget.type)) {
        return (Array.isArray(this.widget.data?.series) ? this.widget.data.series : []).map((item) => item?.name || '数据')
      }
      return []
    },
    chartRows() {
      if (['pie', 'funnel'].includes(this.widget.type)) {
        const rows = this.dataRows.slice(0, 16)
        const max = Math.max(1, ...rows.map((item) => Math.abs(numberValue(item?.value))))
        return rows.map((item, index) => ({
          label: item?.name || item?.title || `数据 ${index + 1}`,
          total: item?.value ?? 0,
          segments: [{ percent: Math.max(2, Math.min(100, Math.abs(numberValue(item?.value)) / max * 100)) }]
        }))
      }
      const xAxis = Array.isArray(this.widget.data?.xAxis) ? this.widget.data.xAxis : []
      const series = Array.isArray(this.widget.data?.series) ? this.widget.data.series : []
      const values = series.flatMap((item) => Array.isArray(item?.data) ? item.data.map(numberValue) : [])
      const max = Math.max(1, ...values.map(Math.abs))
      return xAxis.slice(0, 16).map((label, index) => {
        const rowValues = series.map((item) => numberValue(item?.data?.[index]))
        const segmentCount = Math.max(1, rowValues.length)
        return {
          label,
          total: rowValues.reduce((sum, value) => sum + value, 0),
          segments: rowValues.map((value) => ({ percent: Math.max(value ? 2 : 0, Math.min(100 / segmentCount, Math.abs(value) / max * 100 / segmentCount)) }))
        }
      })
    }
  },
  methods: {
    color(index) { return COLORS[index % COLORS.length] },
    asset(value) {
      const source = String(value || '').trim()
      if (!source || !/^(?:https?:|data:|\/|static\/)/i.test(source)) return '/static/microi-blue-256.png'
      return publicAssetUrl(source)
    },
    displayValue(value) {
      if (value === null || value === undefined || value === '') return '-'
      if (typeof value === 'object') {
        try { return JSON.stringify(value).slice(0, 160) } catch (error) { return '-' }
      }
      return String(value).slice(0, 160)
    },
    progressValue(item) { return Math.max(0, Math.min(100, numberValue(item?.percentage ?? item?.value))) },
    plainText(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000) },
    toggleCollapse(index) { this.expanded = { ...this.expanded, [index]: !this.expanded[index] } },
    openLink(item) {
      const target = String(item?.linkUrl || item?.url || '').trim()
      if (!/^\/pages\/[^?]+/.test(target)) {
        uni.showToast({ title: '该入口尚未适配移动端', icon: 'none' })
        return
      }
      if (TAB_ROUTES.has(target.split('?')[0])) uni.switchTab({ url: target.split('?')[0] })
      else uni.navigateTo({ url: target })
    },
    openAi() { uni.navigateTo({ url: '/pages/ai/index' }) }
  }
}
</script>

<style lang="scss" scoped>
.pe-widget { min-width: 0; color: var(--mci-text-primary, #18313d); }
.pe-widget__loading { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14rpx; }
.pe-widget__loading view { height: 108rpx; border-radius: 16rpx; background: linear-gradient(100deg,#edf2f4 20%,#f8fafb 40%,#edf2f4 60%); background-size: 220% 100%; animation: peShimmer 1.2s linear infinite; }
.pe-widget__state { min-height: 112rpx; padding: 18rpx; display: flex; align-items: center; gap: 16rpx; box-sizing: border-box; border-radius: 16rpx; background: var(--mci-bg-base, #f4f8fa); }
.pe-widget__state--error { background: rgba(215,90,67,.08); }
.pe-widget__state-icon { flex: none; width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border-radius: 15rpx; background: rgba(8,125,168,.1); color: var(--mci-color-primary, #087da8); font-size: 25rpx; font-weight: 760; }
.pe-widget__state > view:last-child { min-width: 0; display: flex; flex-direction: column; gap: 5rpx; }
.pe-widget__state > view:last-child text:first-child { font-size: 25rpx; font-weight: 680; }
.pe-widget__state > view:last-child text:last-child { color: var(--mci-text-secondary, #6d828b); font-size: 21rpx; line-height: 1.45; }
.pe-widget__empty { min-height: 104rpx; display: flex; align-items: center; justify-content: center; color: var(--mci-text-tertiary, #8da0a8); font-size: 23rpx; }
.pe-workbench { min-height: 116rpx; padding: 20rpx; display: flex; align-items: center; gap: 18rpx; box-sizing: border-box; border-radius: 18rpx; background: linear-gradient(135deg,rgba(8,125,168,.11),rgba(49,108,235,.07)); }
.pe-workbench image { width: 72rpx; height: 72rpx; }
.pe-workbench > view { display: flex; flex-direction: column; gap: 6rpx; }
.pe-workbench > view text:first-child { font-size: 29rpx; font-weight: 730; }.pe-workbench > view text:last-child { color: var(--mci-text-secondary,#6d828b); font-size: 22rpx; }
.pe-stat-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14rpx; }
.pe-stat { min-height: 132rpx; padding: 19rpx; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; border: 1rpx solid var(--mci-border-color,#e1e9ec); border-top: 6rpx solid; border-radius: 17rpx; background: var(--mci-bg-elevated,#fff); }
.pe-stat__label { overflow: hidden; color: var(--mci-text-secondary,#6d828b); font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }.pe-stat__value { margin-top: 8rpx; font-size: 34rpx; font-weight: 780; }
.pe-progress-list,.pe-timeline,.pe-collapse,.pe-descriptions,.pe-table-cards,.pe-chart { display: flex; flex-direction: column; gap: 16rpx; }
.pe-progress__heading,.pe-chart__heading { display: flex; justify-content: space-between; gap: 16rpx; font-size: 23rpx; }.pe-progress__heading text:last-child,.pe-chart__heading text:last-child { font-weight: 720; }
.pe-progress__note { margin-top: 7rpx; color: var(--mci-text-tertiary,#8da0a8); font-size: 20rpx; }
.pe-links { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14rpx 8rpx; }.pe-link { min-width: 0; min-height: 120rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9rpx; border-radius: 16rpx; background: var(--mci-bg-base,#f4f8fa); }.pe-link--pressed { transform: scale(.95); opacity: .76; }.pe-link image { width: 54rpx; height: 54rpx; }.pe-link text { width: 100%; overflow: hidden; font-size: 20rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.pe-table-cards__summary { color: var(--mci-text-secondary,#6d828b); font-size: 21rpx; }.pe-table-card { padding: 14rpx 18rpx; border: 1rpx solid var(--mci-border-color,#e1e9ec); border-radius: 15rpx; }.pe-table-card__field { min-height: 54rpx; display: grid; grid-template-columns: minmax(120rpx,38%) minmax(0,1fr); align-items: center; gap: 14rpx; border-bottom: 1rpx solid var(--mci-border-color,#eef3f5); }.pe-table-card__field:last-child { border-bottom: 0; }.pe-table-card__field text:first-child { color: var(--mci-text-secondary,#6d828b); font-size: 21rpx; }.pe-table-card__field text:last-child { overflow: hidden; font-size: 22rpx; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.pe-chart__title { font-size: 25rpx; font-weight: 680; }.pe-chart__row { display: flex; flex-direction: column; gap: 7rpx; }.pe-chart__heading { color: var(--mci-text-secondary,#647d87); font-size: 20rpx; }.pe-chart__bars { min-height: 16rpx; display: flex; gap: 3rpx; align-items: stretch; border-radius: 10rpx; background: #edf2f4; overflow: hidden; }.pe-chart__bar { min-width: 0; min-height: 16rpx; border-radius: 9rpx; }.pe-chart__legend { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; padding-top: 4rpx; }.pe-chart__legend > view { display: flex; align-items: center; gap: 7rpx; color: var(--mci-text-secondary,#647d87); font-size: 19rpx; }.pe-chart__legend > view > view { width: 14rpx; height: 14rpx; border-radius: 50%; }
.pe-timeline__item { display: grid; grid-template-columns: 34rpx minmax(0,1fr); gap: 12rpx; }.pe-timeline__rail { display: flex; flex-direction: column; align-items: center; }.pe-timeline__rail view:first-child { flex: none; width: 20rpx; height: 20rpx; margin-top: 6rpx; border-radius: 50%; }.pe-timeline__rail view:last-child { flex: 1; width: 2rpx; min-height: 44rpx; background: var(--mci-border-color,#dfe9ed); }.pe-timeline__copy { display: flex; flex-direction: column; gap: 5rpx; padding-bottom: 18rpx; }.pe-timeline__copy text:first-child { font-size: 24rpx; font-weight: 650; }.pe-timeline__copy text:last-child { color: var(--mci-text-secondary,#6d828b); font-size: 21rpx; line-height: 1.5; }
.pe-collapse__item { overflow: hidden; border: 1rpx solid var(--mci-border-color,#e1e9ec); border-radius: 14rpx; }.pe-collapse__heading { min-height: 76rpx; padding: 0 18rpx; display: flex; align-items: center; justify-content: space-between; font-size: 23rpx; font-weight: 650; }.pe-collapse__heading--pressed { background: var(--mci-bg-base,#f4f8fa); }.pe-collapse__content { padding: 0 18rpx 18rpx; color: var(--mci-text-secondary,#6d828b); font-size: 22rpx; line-height: 1.65; }
.pe-descriptions > view { min-height: 58rpx; display: grid; grid-template-columns: 36% minmax(0,1fr); align-items: center; gap: 14rpx; border-bottom: 1rpx solid var(--mci-border-color,#edf2f4); }.pe-descriptions > view > text:first-child { color: var(--mci-text-secondary,#6d828b); font-size: 21rpx; }.pe-descriptions > view > text:last-child { font-size: 22rpx; text-align: right; }
.pe-media { width: 100%; min-height: 320rpx; border-radius: 16rpx; background: #0d1f28; }.pe-media--image { min-height: 0; background: var(--mci-bg-base,#f4f8fa); }.pe-carousel { height: 320rpx; border-radius: 16rpx; overflow: hidden; }.pe-carousel image { width: 100%; height: 100%; }
.pe-ai { min-height: 108rpx; padding: 17rpx; display: grid; grid-template-columns: 62rpx minmax(0,1fr) 28rpx; align-items: center; gap: 14rpx; box-sizing: border-box; border-radius: 17rpx; background: linear-gradient(135deg,rgba(49,108,235,.11),rgba(121,87,213,.09)); }.pe-ai--pressed { transform: scale(.98); }.pe-ai__icon { width: 62rpx; height: 62rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; background: linear-gradient(135deg,#316ceb,#7957d5); color: #fff; font-size: 21rpx; font-weight: 780; }.pe-ai > view:nth-child(2) { display: flex; flex-direction: column; gap: 5rpx; }.pe-ai > view:nth-child(2) text:first-child { font-size: 25rpx; font-weight: 700; }.pe-ai > view:nth-child(2) text:last-child { color: var(--mci-text-secondary,#6d828b); font-size: 20rpx; }.pe-ai > text:last-child { color: var(--mci-color-primary,#087da8); font-size: 34rpx; }
@keyframes peShimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .pe-widget__loading view { animation: none; }.pe-link,.pe-ai { transition: none; } }
</style>

<style lang="scss" scoped>
.pe-widget { color: var(--mci-ops-ink, #102634); }
.pe-widget__state { min-height: 108rpx; border: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-radius: var(--mci-ops-radius, 10rpx); background: #f2f6f7; }
.pe-widget__state--error { background: #f5e7e5; }
.pe-widget__state-icon { border-radius: 5rpx; color: #176f83; background: var(--mci-ops-accent-soft, #d9f0f3); }
.pe-workbench { border: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-left: 6rpx solid var(--mci-ops-accent, #11a7bd); border-radius: var(--mci-ops-radius, 10rpx); background: #eef5f6; }
.pe-stat-grid { gap: 0; overflow: hidden; border: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-radius: 6rpx; }
.pe-stat { min-height: 124rpx; border: 0; border-top: 0 !important; border-right: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-bottom: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-radius: 0; background: #f2f6f7; }
.pe-stat:nth-child(2n) { border-right: 0; }.pe-stat:nth-last-child(-n+2) { border-bottom: 0; }
.pe-stat__label { color: var(--mci-ops-muted, #687d87); }.pe-stat__value { color: var(--mci-ops-ink, #102634); }
.pe-links { gap: 0; overflow: hidden; border: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-radius: 6rpx; }
.pe-link { min-height: 112rpx; border-right: 1rpx solid var(--mci-ops-line-soft, #dce5e8); border-radius: 0; background: #f8fafb; }
.pe-link:last-child { border-right: 0; }
.pe-table-card { padding: 12rpx 18rpx; border-color: var(--mci-ops-line-soft, #dce5e8); border-radius: 6rpx; background: #f2f6f7; }
.pe-table-card__field, .pe-descriptions > view { min-height: 70rpx; border-bottom-color: var(--mci-ops-line-soft, #dce5e8); }
.pe-chart__bars { border-radius: 0; background: #e2e9ec; }.pe-chart__bar { border-radius: 0; }
.pe-collapse__item { border-color: var(--mci-ops-line-soft, #dce5e8); border-radius: 6rpx; }
.pe-collapse__heading { min-height: 84rpx; }
.pe-collapse__toggle { position: relative; width: 28rpx; height: 28rpx; color: #176f83; }
.pe-collapse__toggle::before, .pe-collapse__toggle::after { position: absolute; top: 12rpx; left: 1rpx; width: 26rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; }.pe-collapse__toggle::after { transform: rotate(90deg); transition: transform .15s ease; }.pe-collapse__toggle.is-expanded::after { transform: rotate(0); }
.pe-media, .pe-carousel { border-radius: 6rpx; }
.pe-ai { min-height: 108rpx; border: 1rpx solid var(--mci-ops-line, #ccd8dd); border-radius: var(--mci-ops-radius, 10rpx); background: #eef5f6; }
.pe-ai__icon { border-radius: 14rpx; background: var(--mci-color-primary-soft, #dbeafe); }
.pe-ai__arrow { width: 14rpx; height: 14rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; color: #176f83; transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) { .pe-collapse__toggle::after { transition: none; } }
</style>
