<template>
  <view class="dashboard-page" :style="mciTokenStyle">
    <view class="dashboard-header mci-safe-top">
      <view class="dashboard-nav mci-safe-nav-row">
        <view class="dashboard-nav__button" hover-class="dashboard-pressed" aria-label="返回" @tap="goBack">
          <view class="dashboard-nav__back" aria-hidden="true" />
        </view>
        <view class="dashboard-nav__copy">
          <text class="dashboard-nav__title">数据看板</text>
          <text class="dashboard-nav__subtitle">{{ configured ? '租户配置 · 权限实时生效' : '当前账号授权概览' }}</text>
        </view>
        <view class="dashboard-nav__button" hover-class="dashboard-pressed" aria-label="刷新看板" @tap="refresh">
          <view class="dashboard-nav__refresh" aria-hidden="true" />
        </view>
      </view>
    </view>

    <scroll-view class="dashboard-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="refresh">
      <mci-skeleton v-if="loading" type="list" :rows="6" />
      <view v-else class="dashboard-content">
        <view class="dashboard-hero">
          <view class="dashboard-hero__grid" aria-hidden="true" />
          <view class="dashboard-hero__icon" aria-hidden="true">
            <view v-for="height in [42, 68, 88, 56]" :key="height" :style="{ height: `${height}%` }" />
          </view>
          <view class="dashboard-hero__copy">
            <text class="dashboard-hero__kicker">{{ dashboardConfig?.hero?.kicker || '权限数据' }}</text>
            <text class="dashboard-hero__title">{{ dashboardConfig?.hero?.title || '应用能力概览' }}</text>
            <text class="dashboard-hero__subtitle">{{ dashboardConfig?.hero?.subtitle || '只统计当前账号已经授权的菜单和分组' }}</text>
          </view>
        </view>

        <view class="dashboard-metrics">
          <view v-for="metric in metrics" :key="metric.key" class="dashboard-metric">
            <view class="dashboard-metric__mark" aria-hidden="true" />
            <text class="dashboard-metric__value">{{ metric.value }}</text>
            <text class="dashboard-metric__label">{{ metric.label }}</text>
          </view>
        </view>

        <template v-if="configured">
          <view v-for="block in dashboardConfig.blocks" :key="block.key" class="dashboard-card">
            <view class="dashboard-section-head">
              <view>
                <text class="dashboard-section-title">{{ block.title || blockTitle(block.type) }}</text>
                <text v-if="block.subtitle" class="dashboard-section-subtitle">{{ block.subtitle }}</text>
              </view>
            </view>

            <view v-if="block.type === 'MetricGrid'" class="dashboard-block-metrics">
              <view v-for="metric in metricItems(block.metrics)" :key="metric.key">
                <text>{{ metric.value }}</text><text>{{ metric.label }}</text>
              </view>
            </view>

            <view v-else-if="block.type === 'ActionGrid'" class="dashboard-actions">
              <view v-for="action in block.actions" :key="action.Key" class="dashboard-action" hover-class="dashboard-pressed" @tap="runAction(action)">
                <view class="dashboard-action__icon" aria-hidden="true"><view /><view /><view /></view>
                <text>{{ action.Label }}</text>
              </view>
            </view>

            <view v-else class="dashboard-ranking">
              <view v-for="(row, index) in rowsFor(block)" :key="`${block.key}:${index}`" class="dashboard-ranking__row">
                <text class="dashboard-ranking__index">{{ index + 1 }}</text>
                <view class="dashboard-ranking__content">
                  <view><text>{{ rowLabel(block, row) }}</text><text>{{ rowValue(block, row) }}</text></view>
                  <view class="dashboard-ranking__track"><view :style="{ width: `${rowPercent(block, row)}%` }" /></view>
                </view>
              </view>
              <view v-if="!rowsFor(block).length" class="dashboard-empty">暂无可展示数据</view>
            </view>
          </view>
        </template>

        <view v-else class="dashboard-card">
          <view class="dashboard-section-head">
            <view>
              <text class="dashboard-section-title">授权应用分布</text>
              <text class="dashboard-section-subtitle">随当前账号菜单权限实时变化</text>
            </view>
          </view>
          <view class="dashboard-ranking">
            <view v-for="(group, index) in groupRows" :key="group.key" class="dashboard-ranking__row">
              <text class="dashboard-ranking__index">{{ index + 1 }}</text>
              <view class="dashboard-ranking__content">
                <view><text>{{ group.title }}</text><text>{{ group.count }} 个应用</text></view>
                <view class="dashboard-ranking__track"><view :style="{ width: `${group.percent}%`, background: group.accent }" /></view>
              </view>
            </view>
            <view v-if="!groupRows.length" class="dashboard-empty">当前账号暂无授权应用</view>
          </view>
        </view>

        <view class="dashboard-footnote">
          <view class="dashboard-footnote__shield" aria-hidden="true"><view /></view>
          <text>{{ configured ? '数据来自租户 ViewSchema 与白名单接口，仍受当前角色和数据权限约束。' : '当前为安全回退视图；租户配置 Dashboard-Mobile 后可展示真实业务指标。' }}</text>
        </view>
        <view class="dashboard-safe-bottom" aria-hidden="true" />
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getToken, getUser } from '@/utils/request.js'
import { loadAccessibleModuleGroups } from '@/platform/module-registry.js'
import { compileDashboardConfig, loadDashboardViewManifest } from '@/platform/view-manifest.js'
import { loadViewMetricValues } from '@/platform/view-metrics.js'
import { loadDashboardBlocks } from '@/platform/view-dashboard.js'
import { executeViewAction } from '@/platform/view-actions.js'
import shareMixin from '@/utils/share.js'

export default {
  name: 'NativeDashboardPage',
  mixins: [themeMixin, shareMixin],
  data() {
    return {
      loading: true,
      refreshing: false,
      groups: [],
      manifest: null,
      dashboardConfig: null,
      metricValues: {},
      blockRows: {},
      requestId: 0
    }
  },
  computed: {
    configured() { return Boolean(this.dashboardConfig) },
    user() { return getUser() || {} },
    modules() { return this.groups.flatMap((group) => group.items || []) },
    configuredMetrics() {
      if (!this.dashboardConfig) return []
      return [
        ...(this.dashboardConfig.metrics || []),
        ...(this.dashboardConfig.blocks || []).filter((block) => block.type === 'MetricGrid').flatMap((block) => block.metrics || [])
      ]
    },
    metrics() {
      if (!this.configuredMetrics.length) {
        return [
          { key: 'applications', label: '授权应用', value: String(this.modules.length) },
          { key: 'groups', label: '业务分组', value: String(this.groups.length) }
        ]
      }
      return this.metricItems(this.dashboardConfig.metrics || [])
    },
    groupRows() {
      const maximum = Math.max(1, ...this.groups.map((group) => (group.items || []).length))
      return this.groups.map((group) => ({
        key: group.key,
        title: group.title,
        count: (group.items || []).length,
        percent: Math.max(6, Math.round(((group.items || []).length / maximum) * 100)),
        accent: group.accent || '#087da8'
      })).sort((left, right) => right.count - left.count)
    }
  },
  onLoad() {
    if (!getToken()) {
      this.loading = false
      uni.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.loadData()
  },
  methods: {
    compactNumber(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return String(value ?? '-')
      if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`
      return String(number)
    },
    metricItems(metrics = []) {
      return metrics.map((metric) => {
        const key = metric.key || metric.field || metric.apiEngineKey
        const raw = String(metric.source || '').toLowerCase() === 'apiengine'
          ? this.metricValues[key]
          : (['modulecount', 'modules', 'applications'].includes(String(metric.field || '').toLowerCase())
              ? this.modules.length
              : ['groupcount', 'groups'].includes(String(metric.field || '').toLowerCase()) ? this.groups.length : '-')
        return {
          key,
          label: metric.label || metric.field || '统计',
          value: raw === undefined || raw === null || raw === '' ? '-' : `${this.compactNumber(raw)}${metric.suffix || ''}`
        }
      })
    },
    rowsFor(block) { return this.blockRows[block.key] || [] },
    rowField(block, index, explicit) { return explicit || (block.fields && block.fields[index] && block.fields[index].name) || '' },
    rowLabel(block, row) {
      const field = this.rowField(block, 0, block.labelField)
      return String((field && row[field]) ?? row.Label ?? row.Name ?? '未命名')
    },
    rowValue(block, row) {
      const field = this.rowField(block, 1, block.valueField)
      return this.compactNumber((field && row[field]) ?? row.Value ?? row.Count ?? 0)
    },
    rowPercent(block, row) {
      const valueField = this.rowField(block, 1, block.valueField)
      const maxField = block.maxField
      const value = Number((valueField && row[valueField]) ?? row.Value ?? row.Count ?? 0)
      const max = Number((maxField && row[maxField]) ?? row.Max ?? 0)
      if (Number.isFinite(max) && max > 0) return Math.min(100, Math.max(0, Math.round(value / max * 100)))
      const rows = this.rowsFor(block)
      const maximum = Math.max(1, ...rows.map((item) => Number((valueField && item[valueField]) ?? item.Value ?? item.Count ?? 0) || 0))
      return Math.min(100, Math.max(5, Math.round(value / maximum * 100)))
    },
    blockTitle(type) {
      return ({ MetricGrid: '核心指标', ProgressList: '进度概览', RankingList: '业务排行', ActionGrid: '快捷操作', StatusDistribution: '状态分布' })[type] || '数据概览'
    },
    async loadData(refresh = false) {
      const requestId = ++this.requestId
      this.loading = !refresh
      try {
        const [groups, manifest] = await Promise.all([
          loadAccessibleModuleGroups(refresh),
          loadDashboardViewManifest({ refresh, user: this.user })
        ])
        if (requestId !== this.requestId) return
        this.groups = groups
        this.manifest = manifest
        this.dashboardConfig = manifest ? compileDashboardConfig(manifest) : null
        if (this.dashboardConfig) {
          const context = { user: this.user, menu: manifest.Module || {}, form: {} }
          const [metricValues, blockRows] = await Promise.all([
            loadViewMetricValues(this.configuredMetrics, context),
            loadDashboardBlocks(this.dashboardConfig.blocks, context)
          ])
          if (requestId !== this.requestId) return
          this.metricValues = metricValues
          this.blockRows = blockRows
        } else {
          this.metricValues = {}
          this.blockRows = {}
        }
      } catch (error) {
        if (requestId === this.requestId) uni.showToast({ title: error.message || '看板加载失败', icon: 'none' })
      } finally {
        if (requestId === this.requestId) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    async refresh() {
      this.refreshing = true
      await this.loadData(true)
    },
    async runAction(action) {
      await executeViewAction(action, {
        user: this.user,
        menu: this.manifest?.Module || {},
        refresh: () => this.loadData(true)
      })
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/index' }) }) }
  }
}
</script>

<style scoped>
.dashboard-page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--mci-text-primary, #17313b); background: var(--mci-bg-base, #f3f7f9); }
.dashboard-header { flex: none; background: var(--mci-bg-elevated, #fff); border-bottom: 1rpx solid var(--mci-border-color, #e4ecef); }
.dashboard-nav { min-height: 94rpx; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; display: grid; grid-template-columns: 70rpx minmax(0, 1fr) 70rpx; align-items: center; box-sizing: border-box; }
.dashboard-nav__button { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.dashboard-nav__copy { min-width: 0; display: flex; flex-direction: column; align-items: center; }
.dashboard-nav__title { font-size: 31rpx; font-weight: 760; }
.dashboard-nav__subtitle { margin-top: 2rpx; max-width: 100%; overflow: hidden; color: var(--mci-text-secondary, #748991); font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-nav__back { width: 22rpx; height: 22rpx; border-left: 4rpx solid currentColor; border-bottom: 4rpx solid currentColor; transform: rotate(45deg); }
.dashboard-nav__refresh { width: 28rpx; height: 28rpx; border: 3rpx solid currentColor; border-left-color: transparent; border-radius: 50%; box-sizing: border-box; }
.dashboard-scroll { min-height: 0; flex: 1; }
.dashboard-content { padding: 24rpx 22rpx 0; }
.dashboard-hero { position: relative; min-height: 224rpx; padding: 32rpx 30rpx; display: flex; align-items: center; overflow: hidden; border-radius: 22rpx; color: #fff; background: linear-gradient(125deg, var(--mci-color-primary-dark, #063b5c), var(--mci-color-primary, #087da8) 67%, var(--mci-color-primary-light, #18a6b8)); box-shadow: 0 13rpx 30rpx rgba(6, 76, 105, .18); box-sizing: border-box; }
.dashboard-hero__grid { position: absolute; inset: 0; opacity: .13; background-image: linear-gradient(rgba(255,255,255,.35) 1rpx, transparent 1rpx), linear-gradient(90deg, rgba(255,255,255,.35) 1rpx, transparent 1rpx); background-size: 36rpx 36rpx; }
.dashboard-hero__icon { position: relative; z-index: 1; flex: none; width: 104rpx; height: 104rpx; padding: 20rpx 16rpx; display: flex; align-items: flex-end; justify-content: space-between; border: 1rpx solid rgba(255,255,255,.28); border-radius: 24rpx; background: rgba(255,255,255,.12); box-sizing: border-box; }
.dashboard-hero__icon view { width: 12rpx; border-radius: 7rpx 7rpx 2rpx 2rpx; background: #fff; }
.dashboard-hero__copy { position: relative; z-index: 1; min-width: 0; margin-left: 24rpx; display: flex; flex-direction: column; }
.dashboard-hero__kicker { color: rgba(255,255,255,.68); font-size: 18rpx; letter-spacing: 2rpx; }
.dashboard-hero__title { margin-top: 8rpx; font-size: 34rpx; line-height: 44rpx; font-weight: 780; }
.dashboard-hero__subtitle { margin-top: 8rpx; color: rgba(255,255,255,.76); font-size: 21rpx; line-height: 32rpx; }
.dashboard-metrics { margin: 20rpx 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.dashboard-metric { min-height: 144rpx; padding: 22rpx; display: flex; flex-direction: column; border: 1rpx solid var(--mci-border-color, #e0e9ec); border-radius: 18rpx; background: var(--mci-bg-elevated, #fff); box-sizing: border-box; box-shadow: 0 6rpx 18rpx rgba(17, 74, 101, .05); }
.dashboard-metric__mark { width: 36rpx; height: 6rpx; border-radius: 4rpx; background: linear-gradient(90deg, var(--mci-color-primary, #087da8), var(--mci-color-primary-light, #18a6b8)); }
.dashboard-metric__value { margin-top: 12rpx; overflow: hidden; font-size: 36rpx; line-height: 44rpx; font-weight: 780; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-metric__label { margin-top: 3rpx; color: var(--mci-text-secondary, #748991); font-size: 21rpx; }
.dashboard-card { margin-bottom: 20rpx; padding: 24rpx 22rpx; border: 1rpx solid var(--mci-border-color, #e1eaed); border-radius: 20rpx; background: var(--mci-bg-elevated, #fff); box-shadow: 0 7rpx 22rpx rgba(17, 74, 101, .05); }
.dashboard-section-head > view { display: flex; flex-direction: column; }
.dashboard-section-title { font-size: 29rpx; font-weight: 720; }
.dashboard-section-subtitle { margin-top: 4rpx; color: var(--mci-text-secondary, #748991); font-size: 20rpx; }
.dashboard-block-metrics { margin-top: 18rpx; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; }
.dashboard-block-metrics > view { min-height: 110rpx; padding: 18rpx; display: flex; flex-direction: column; border-radius: 14rpx; background: var(--mci-bg-soft, #f5f9fa); }
.dashboard-block-metrics text:first-child { font-size: 31rpx; font-weight: 750; }
.dashboard-block-metrics text:last-child { margin-top: 4rpx; color: var(--mci-text-secondary, #748991); font-size: 20rpx; }
.dashboard-actions { margin-top: 18rpx; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.dashboard-action { min-height: 112rpx; padding: 18rpx 8rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1rpx solid var(--mci-border-color, #e2eaed); border-radius: 15rpx; color: var(--mci-color-primary, #087da8); background: var(--mci-bg-soft, #f7fafb); font-size: 21rpx; text-align: center; }
.dashboard-action__icon { height: 35rpx; margin-bottom: 10rpx; display: flex; align-items: flex-end; gap: 5rpx; }
.dashboard-action__icon view { width: 7rpx; border-radius: 4rpx 4rpx 1rpx 1rpx; background: currentColor; }
.dashboard-action__icon view:nth-child(1) { height: 15rpx; }.dashboard-action__icon view:nth-child(2) { height: 28rpx; }.dashboard-action__icon view:nth-child(3) { height: 21rpx; }
.dashboard-ranking { margin-top: 12rpx; }
.dashboard-ranking__row { min-height: 94rpx; padding: 13rpx 0; display: grid; grid-template-columns: 48rpx minmax(0, 1fr); align-items: center; gap: 10rpx; border-top: 1rpx solid var(--mci-border-color, #edf2f4); box-sizing: border-box; }
.dashboard-ranking__row:first-child { border-top: 0; }
.dashboard-ranking__index { width: 38rpx; height: 38rpx; display: flex; align-items: center; justify-content: center; border-radius: 10rpx; color: var(--mci-color-primary, #087da8); background: rgba(8,125,168,.09); font-size: 22rpx; }
.dashboard-ranking__content { min-width: 0; }
.dashboard-ranking__content > view:first-child { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; font-size: 23rpx; }
.dashboard-ranking__content > view:first-child text:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-ranking__content > view:first-child text:last-child { flex: none; color: var(--mci-text-secondary, #748991); }
.dashboard-ranking__track { height: 9rpx; margin-top: 11rpx; overflow: hidden; border-radius: 6rpx; background: #eaf0f2; }
.dashboard-ranking__track view { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--mci-color-primary, #087da8), var(--mci-color-primary-light, #18a6b8)); }
.dashboard-empty { padding: 48rpx 20rpx; color: var(--mci-text-secondary, #81939a); font-size: 22rpx; text-align: center; }
.dashboard-footnote { margin: 28rpx 10rpx 0; display: flex; align-items: flex-start; gap: 14rpx; color: var(--mci-text-secondary, #748991); font-size: 20rpx; line-height: 32rpx; }
.dashboard-footnote__shield { flex: none; width: 28rpx; height: 32rpx; border: 3rpx solid var(--mci-color-primary, #087da8); border-radius: 12rpx 12rpx 14rpx 14rpx; box-sizing: border-box; }
.dashboard-footnote__shield view { width: 8rpx; height: 5rpx; margin: 8rpx auto 0; border-left: 3rpx solid var(--mci-color-primary, #087da8); border-bottom: 3rpx solid var(--mci-color-primary, #087da8); transform: rotate(-45deg); }
.dashboard-safe-bottom { height: calc(36rpx + var(--mci-safe-bottom)); }
.dashboard-pressed { opacity: .68; transform: scale(.96); }
</style>

<style scoped>
/* Microi Blue Suite dashboard: one branded overview card, then readable data cards. */
.dashboard-page, .dashboard-scroll { background: var(--mci-app-canvas, #f8fafc); }
.dashboard-header { position: relative; overflow: hidden; border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); background: #fff; }
.dashboard-header::after, .dashboard-hero::before { display: none; }
.dashboard-nav { position: relative; z-index: 1; min-height: 92rpx; }
.dashboard-nav__button { width: 72rpx; height: 72rpx; border-radius: 50%; color: var(--mci-color-primary, #2563eb); }
.dashboard-nav__title { color: var(--mci-text-primary, #111827); font-size: 31rpx; font-weight: 750; letter-spacing: 0; }
.dashboard-nav__subtitle { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 29rpx; letter-spacing: 0; }
.dashboard-content { padding: 20rpx 22rpx 0; }
.dashboard-hero { min-height: 190rpx; padding: 28rpx 26rpx; border: 0; border-radius: 28rpx; color: #fff; background: linear-gradient(135deg, var(--mci-color-primary-dark, #1749b6), var(--mci-color-primary, #2563eb), var(--mci-color-primary-light, #5b8cff)); box-shadow: 0 16rpx 38rpx rgba(37,99,235,.18); }
.dashboard-hero__grid { display: block; opacity: .08; }
.dashboard-hero__icon { width: 88rpx; height: 88rpx; padding: 18rpx 15rpx; border: 1rpx solid rgba(255,255,255,.3); border-radius: 20rpx; color: #fff; background: rgba(255,255,255,.14); }
.dashboard-hero__icon view { border-radius: 3rpx 3rpx 0 0; background: currentColor; }
.dashboard-hero__copy { margin-left: 20rpx; }
.dashboard-hero__kicker { color: rgba(255,255,255,.78); font-size: 22rpx; font-weight: 700; letter-spacing: .04em; }
.dashboard-hero__title { margin-top: 6rpx; color: #fff; font-size: 34rpx; font-weight: 780; letter-spacing: -.01em; }
.dashboard-hero__subtitle { margin-top: 6rpx; color: rgba(255,255,255,.84); font-size: 23rpx; line-height: 32rpx; }
.dashboard-metrics { margin: 18rpx 0; gap: 14rpx; border: 0; background: transparent; }
.dashboard-metric { min-height: 126rpx; padding: 20rpx 22rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 22rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.dashboard-metric__mark { width: 26rpx; height: 5rpx; border-radius: 5rpx; background: var(--mci-color-primary, #2563eb); }
.dashboard-metric__value { margin-top: 9rpx; color: var(--mci-text-primary, #111827); font-size: 34rpx; font-weight: 800; }
.dashboard-metric__label { color: var(--mci-text-secondary, #667280); font-size: 23rpx; line-height: 31rpx; letter-spacing: 0; }
.dashboard-card { margin-bottom: 16rpx; padding: 22rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.dashboard-section-head { padding-bottom: 14rpx; border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); }
.dashboard-section-title { color: var(--mci-text-primary, #111827); font-size: 27rpx; font-weight: 750; }
.dashboard-section-subtitle { color: var(--mci-text-secondary, #667280); font-size: 23rpx; line-height: 31rpx; }
.dashboard-block-metrics, .dashboard-actions { gap: 12rpx; overflow: visible; border: 0; }
.dashboard-block-metrics > view, .dashboard-action { border: 0; border-radius: 18rpx; background: #f8fafc; }
.dashboard-action { color: var(--mci-color-primary, #2563eb); }
.dashboard-ranking__row { border-top-color: var(--mci-divider, #e5e7eb); }
.dashboard-ranking__index { border-radius: 10rpx; color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-soft, #dbeafe); }
.dashboard-ranking__track { height: 8rpx; border-radius: 8rpx; background: #e5e7eb; }
.dashboard-ranking__track view { border-radius: inherit; background: var(--mci-color-primary, #2563eb); }
.dashboard-footnote { margin: 22rpx 4rpx 0; color: var(--mci-text-secondary, #667280); font-size: 23rpx; line-height: 34rpx; }
.dashboard-footnote__shield { border-color: var(--mci-color-primary, #2563eb); border-radius: 10rpx; }
@media (prefers-reduced-motion: reduce) { .dashboard-pressed { transition: none; } }
</style>
