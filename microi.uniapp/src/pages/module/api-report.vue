<template>
  <mci-page-shell class="api-report" :style="mciTokenStyle" :title="title" :subtitle="subtitle" @back="goBack">
    <view class="report-content">
      <view class="filter-card">
        <view class="filter-row">
          <picker mode="date" :value="filters.start" @change="setDate('start', $event)">
            <view class="filter-value"><text class="filter-label">开始日期</text><text>{{ filters.start }}</text></view>
          </picker>
          <picker mode="date" :value="filters.end" @change="setDate('end', $event)">
            <view class="filter-value"><text class="filter-label">结束日期</text><text>{{ filters.end }}</text></view>
          </picker>
        </view>
        <input v-if="config.nameFilter" v-model="filters.name" class="name-input" placeholder="输入员工姓名（可选）" confirm-type="search" @confirm="loadReport" />
        <view class="filter-actions">
          <button class="mci-btn mci-btn--ghost" @tap="resetFilters">重置</button>
          <button class="mci-btn mci-btn--primary" :disabled="loading" @tap="loadReport">查询</button>
          <button class="mci-btn mci-btn--ghost" :disabled="!rows.length" @tap="printReport">打印</button>
        </view>
      </view>

      <mci-skeleton v-if="loading" type="list" :rows="5" />
      <view v-else-if="error" class="state-card">
        <text class="state-title">报表加载失败</text>
        <text class="state-text">{{ error }}</text>
        <button class="mci-btn mci-btn--primary" @tap="loadReport">重新加载</button>
      </view>
      <view v-else-if="!rows.length" class="state-card">
        <text class="state-title">暂无统计数据</text>
        <text class="state-text">请调整日期或员工条件后重新查询</text>
      </view>
      <view v-else class="report-list">
        <view class="result-heading">
          <text>共 {{ rows.length }} 条统计结果</text>
          <text>业务数据已按当前条件实时更新</text>
        </view>
        <view v-for="(row, rowIndex) in rows" :key="rowIndex" class="report-card" :class="{ 'report-card--total': isTotal(row) }">
          <view class="report-card__head">
            <text class="report-card__title">{{ rowTitle(row, rowIndex) }}</text>
            <text v-if="row.yf" class="report-card__period">{{ row.yf }}</text>
          </view>
          <view class="report-grid">
            <view v-for="column in visibleColumns(row)" :key="column[0]" class="report-field">
              <text class="report-field__label">{{ column[1] }}</text>
              <text class="report-field__value">{{ formatValue(row[column[0]]) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getBusinessModule } from '@/platform/business.js'
import { callApiEngine, requireLogin } from '@/platform/business-runtime.js'

function today() {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultFilters() {
  const end = today()
  return { start: `${end.slice(0, 4)}-01-01`, end, name: '' }
}

export default {
  mixins: [themeMixin],
  data() {
    return { key: '', config: {}, filters: defaultFilters(), rows: [], loading: true, error: '' }
  },
  computed: {
    title() { return this.config.title || '业务报表' },
    subtitle() { return this.config.subtitle || '实时业务统计' }
  },
  onLoad(options) {
    this.key = decodeURIComponent(String(options && options.key || ''))
    this.config = getBusinessModule(this.key) || {}
    if (!this.config.apiEngineKey) {
      this.loading = false
      this.error = '报表配置不存在'
      return
    }
    if (!requireLogin()) {
      this.loading = false
      return
    }
    this.loadReport()
  },
  methods: {
    setDate(field, event) { this.filters[field] = event.detail.value },
    resetFilters() { this.filters = defaultFilters(); this.loadReport() },
    async loadReport() {
      if (this.loading && this.rows.length) return
      if (this.filters.start && this.filters.end && this.filters.start > this.filters.end) {
        uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
        return
      }
      this.loading = true
      this.error = ''
      try {
        const response = await callApiEngine(this.config.apiEngineKey, {
          KaishiSJ: this.filters.start,
          JieshuSJ: this.filters.end,
          ...(this.config.nameFilter && this.filters.name.trim() ? { Name: this.filters.name.trim() } : {})
        })
        const rows = Array.isArray(response) ? response : response && Array.isArray(response.Data) ? response.Data : []
        if (!rows.length && response && response.Msg && ![0, 1].includes(Number(response.Code))) {
          throw new Error(response.Msg)
        }
        this.rows = rows
      } catch (error) {
        this.rows = []
        this.error = error.message || '报表查询失败'
      } finally {
        this.loading = false
      }
    },
    visibleColumns(row) {
      return (this.config.columns || []).filter((column) => !['name', 'gsmc', 'yf'].includes(column[0]) && row[column[0]] !== undefined)
    },
    rowTitle(row, index) { return row.name || row.gsmc || `统计项 ${index + 1}` },
    isTotal(row) { return row.name === '总计' || row.gsmc === '总计' },
    formatValue(value) {
      if (value === null || value === undefined || value === '') return '-'
      if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value))) {
        return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      }
      return String(value)
    },
    printReport() {
      // #ifdef H5
      if (typeof window !== 'undefined' && typeof window.print === 'function') { window.print(); return }
      // #endif
      uni.showToast({ title: 'App/小程序请在 H5 端打印', icon: 'none' })
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style lang="scss" scoped>
.api-report { min-height: 100vh; background: #f4f8fa; }
.report-content { padding: 20rpx 22rpx calc(42rpx + var(--mci-safe-bottom)); }
.filter-card, .report-card, .state-card { border: 1px solid var(--mci-border, #e3ecef); border-radius: 8px; background: #fff; }
.filter-card { margin-bottom: 18rpx; padding: 22rpx; }
.filter-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.filter-value { display: flex; flex-direction: column; gap: 7rpx; padding: 16rpx; border: 1px solid #dde8ec; border-radius: 7px; color: #1f3d47; font-size: 24rpx; }
.filter-label { color: #81949c; font-size: 23rpx; }
.name-input { height: 76rpx; margin-top: 14rpx; padding: 0 18rpx; border: 1px solid #dde8ec; border-radius: 7px; background: #fff; font-size: 24rpx; }
.filter-actions { display: flex; gap: 12rpx; margin-top: 16rpx; }
.filter-actions .mci-btn { min-width: 0; flex: 1; margin: 0; font-size: 23rpx; }
.state-card { min-height: 360rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 36rpx; text-align: center; }
.state-title { color: #17313b; font-size: 30rpx; font-weight: 750; }
.state-text { color: #7b8f97; font-size: 23rpx; line-height: 1.6; }
.result-heading { display: flex; justify-content: space-between; gap: 18rpx; padding: 4rpx 4rpx 14rpx; color: #78909a; font-size: 23rpx; line-height: 32rpx; }
.report-card { margin-bottom: 14rpx; padding: 20rpx; }
.report-card--total { border-color: rgba(8,125,168,.35); background: #f3fbfd; }
.report-card__head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding-bottom: 14rpx; border-bottom: 1px solid #edf2f4; }
.report-card__title { min-width: 0; overflow: hidden; color: #17313b; font-size: 28rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.report-card__period { flex: none; color: #087da8; font-size: 22rpx; }
.report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx 18rpx; padding-top: 16rpx; }
.report-field { min-width: 0; display: flex; flex-direction: column; gap: 5rpx; }
.report-field__label { color: #80939b; font-size: 23rpx; line-height: 31rpx; }
.report-field__value { overflow-wrap: anywhere; color: #203d47; font-size: 24rpx; font-variant-numeric: tabular-nums; }
@media print { .filter-card { display: none; } .report-content { padding: 0; } .report-card { break-inside: avoid; } }
</style>

<style scoped>
.api-report { background: var(--mci-app-canvas, #f4f6f5); }
.report-content { padding: 0 24rpx calc(40rpx + var(--mci-safe-bottom)); }
.filter-card { margin-top: -12rpx; padding: 26rpx 24rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 32rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-deck); }
.filter-value, .name-input { min-height: 88rpx; border: 0; border-radius: 18rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.filter-label { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); }
.filter-actions { gap: 12rpx; }
.filter-actions .mci-btn { min-height: 88rpx; padding: 0 22rpx; border-radius: 18rpx; }
.result-heading { color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.report-card, .state-card { border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 22rpx; background: var(--mci-app-surface, #fefffe); box-shadow: none; }
.report-card--total { border-color: var(--mci-border-color-hover, rgba(20,65,84,.18)); background: var(--mci-color-info-soft, #e5f0f4); }
.report-card__head, .report-field { border-color: var(--mci-divider, rgba(20,65,84,.1)); }
.report-field__label { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); }
.report-field__value { color: var(--mci-text-primary, #17313d); }
</style>
