<template>
  <view class="module-list" :style="mciTokenStyle">
    <view class="module-header mci-safe-top">
      <view class="module-nav mci-safe-nav-row">
        <view class="module-nav__button" hover-class="module-nav__button--pressed" @tap="goBack"><text>‹</text></view>
        <text class="module-nav__title">{{ config.title || '业务列表' }}</text>
        <view class="module-nav__button module-nav__button--add" hover-class="module-nav__button--pressed" @tap="openAdd"><text>＋</text></view>
      </view>
      <view class="search-row">
        <input v-model="keyword" class="search-input" confirm-type="search" :placeholder="`搜索${config.title || '业务数据'}`" @confirm="search" />
        <view class="search-button" @tap="search">搜索</view>
      </view>
      <scroll-view class="period-scroll" scroll-x :show-scrollbar="false">
        <view class="period-row">
          <view v-for="item in periods" :key="item.value" class="period-item"
            :class="{ active: period === item.value }" @tap="changePeriod(item.value)">
            <text>{{ item.label }}</text>
            <text>{{ periodCounts[item.value] ?? '·' }}</text>
          </view>
        </view>
      </scroll-view>
      <scroll-view v-if="statusOptions.length" class="status-scroll" scroll-x :show-scrollbar="false">
        <view class="status-row">
          <view class="status-item" :class="{ active: !status }" @tap="changeStatus('')">全部状态</view>
          <view v-for="item in statusOptions" :key="String(item)" class="status-item"
            :class="{ active: String(status) === String(item) }" @tap="changeStatus(item)">{{ optionLabel(config.statusField, item) }}</view>
        </view>
      </scroll-view>
    </view>

    <view v-if="config.table" class="summary-strip">
      <view><text>{{ loading && pageIndex === 1 ? '--' : count }}</text><text>{{ periodLabel }}记录</text></view>
      <view v-if="config.statisticsField"><text>{{ statisticsValue }}</text><text>{{ config.statisticsLabel }}</text></view>
      <image :src="config.icon" mode="aspectFit" />
    </view>

    <scroll-view class="data-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing"
      @refresherrefresh="refresh" @scrolltolower="loadMore">
      <mci-skeleton v-if="loading && pageIndex === 1" type="list" :rows="5" />
      <view v-else-if="error && !rows.length" class="state-panel">
        <text class="state-panel__title">列表加载失败</text>
        <text class="state-panel__text">{{ error }}</text>
        <view class="mci-btn" @tap="loadData(true, true)">重新加载</view>
      </view>
      <view v-else-if="rows.length" class="card-list">
        <view v-for="(row, index) in rows" :key="row.Id || index" class="data-card"
          hover-class="data-card--pressed" @tap="openDetail(row)">
          <view class="data-card__head">
            <view><text class="data-card__index">{{ index + 1 }}</text><text class="data-card__title">{{ titleValue(row) }}</text></view>
            <text v-if="statusValue(row)" class="status-chip">{{ statusValue(row) }}</text>
          </view>
          <view v-if="tagValues(row).length" class="tag-row">
            <text v-for="tag in tagValues(row)" :key="tag">{{ tag }}</text>
          </view>
          <view class="field-list">
            <view v-for="line in visibleLines(row)" :key="line.field" class="field-row">
              <text>{{ line.label }}</text><text>{{ displayLine(row, line) }}</text>
            </view>
          </view>
          <view v-if="rowActions(row).length" class="action-row" @tap.stop>
            <view v-for="action in rowActions(row)" :key="action.Key" @tap.stop="runAction(action, row)">{{ action.Label }}</view>
          </view>
          <view class="data-card__foot"><text>{{ formatTime(row.CreateTime || row.UpdateTime) }}</text><text>查看详情 ›</text></view>
        </view>
        <view class="load-state">{{ loading ? '正在加载…' : finished ? `已加载全部 ${count} 条` : '继续上拉加载' }}</view>
      </view>
      <view v-else-if="!loading" class="state-panel">
        <text class="state-panel__title">暂无{{ config.title || '' }}数据</text>
        <text class="state-panel__text">可调整搜索条件，或使用右上角新增</text>
      </view>
    </scroll-view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import {
  formatDateTime,
  formatMoney,
  loadModulePeriodCounts,
  loadModuleRows,
  openForm,
  PERIOD_OPTIONS,
  statisticsFieldValue
} from '@/platform/business-runtime.js'
import { fieldDisplayValue } from '@/platform/native-form.js'
import { loadModuleDefinition } from '@/platform/module-registry.js'
import { compileListConfig, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      menuId: '',
      baseConfig: {},
      config: {},
      keyword: '',
      period: 'all',
      periods: PERIOD_OPTIONS.filter((item) => item.value !== 'custom'),
      periodCounts: {},
      status: '',
      rows: [],
      count: 0,
      dataAppend: {},
      pageIndex: 1,
      loading: true,
      refreshing: false,
      finished: false,
      error: '',
      requestId: 0,
      actionRunning: false,
      viewManifest: null
    }
  },
  computed: {
    periodLabel() {
      return this.periods.find((item) => item.value === this.period)?.label || '全部'
    },
    statusOptions() {
      return this.config.statusOptions || []
    },
    statisticsValue() {
      const value = statisticsFieldValue(this.dataAppend, this.config.statisticsField, 0)
      return formatMoney(value)
    }
  },
  onLoad(options) {
    this.menuId = decodeURIComponent(options.menuId || '')
    this.initialize()
  },
  methods: {
    async initialize(refresh = false) {
      this.loading = true
      this.error = ''
      try {
        this.baseConfig = await loadModuleDefinition(this.menuId, refresh)
        this.config = { ...this.baseConfig }
        await this.loadView(refresh)
        await this.loadData(true, refresh)
      } catch (error) {
        this.error = error.message || '模块加载失败'
        this.loading = false
      }
    },
    async loadView(refresh = false) {
      let manifest = await loadModuleViewManifest(this.baseConfig, {
        scene: 'Card',
        device: 'Mobile',
        user: getUser() || {},
        refresh
      })
      if (!manifest) {
        manifest = await loadModuleViewManifest(this.baseConfig, {
          scene: 'List',
          device: 'Mobile',
          user: getUser() || {},
          refresh
        })
      }
      const dynamic = compileListConfig(manifest)
      if (!dynamic) return
      this.viewManifest = manifest
      const merged = { ...this.baseConfig }
      ;['tagFields', 'lines', 'statusOptions'].forEach((name) => {
        if (dynamic[name] && dynamic[name].length) merged[name] = dynamic[name]
      })
      ;['titleField', 'statusField', 'summaryField', 'imageField', 'periodField',
        'statisticsField', 'statisticsLabel', 'statisticsFormat'].forEach((name) => {
        if (dynamic[name] !== undefined && dynamic[name] !== null && dynamic[name] !== '') merged[name] = dynamic[name]
      })
      if (dynamic.actionSchema && dynamic.actionSchema.length) merged.actionSchema = dynamic.actionSchema
      this.config = merged
    },
    async loadData(reset = false, refresh = false) {
      if (this.loading && !reset && this.rows.length) return
      if (!reset && this.finished) return
      const requestId = ++this.requestId
      if (reset) {
        this.pageIndex = 1
        this.finished = false
      }
      this.loading = true
      this.error = ''
      try {
        const result = await loadModuleRows(this.config, {
          pageIndex: this.pageIndex,
          keyword: this.keyword.trim(),
          period: this.period,
          status: this.status,
          refresh
        })
        if (requestId !== this.requestId) return
        this.rows = reset ? result.rows : [...this.rows, ...result.rows]
        this.count = result.count
        this.dataAppend = result.append
        this.finished = this.rows.length >= result.count || result.rows.length < this.config.pageSize
        if (!this.finished) this.pageIndex += 1
        if (reset) {
          loadModulePeriodCounts(this.config, {
            keyword: this.keyword.trim(),
            status: this.status,
            refresh
          }).then((counts) => {
            if (requestId === this.requestId) this.periodCounts = counts
          }).catch(() => {})
        }
      } catch (error) {
        if (requestId === this.requestId) this.error = error.message || '数据加载失败'
      } finally {
        if (requestId === this.requestId) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    search() { this.loadData(true, true) },
    changePeriod(value) {
      if (this.period === value) return
      this.period = value
      this.loadData(true, true)
    },
    changeStatus(value) {
      this.status = value
      this.loadData(true, true)
    },
    async refresh() {
      this.refreshing = true
      await this.initialize(true)
      this.refreshing = false
    },
    loadMore() { this.loadData(false) },
    field(name) {
      return (this.config.definition?.fields || []).find((field) => field.Name === name)
    },
    optionLabel(fieldName, value) {
      const field = this.field(fieldName)
      if (!field) return String(value ?? '')
      return fieldDisplayValue(field, value)
    },
    titleValue(row) {
      return this.optionLabel(this.config.titleField, row[this.config.titleField]) || `记录 ${String(row.Id || '').slice(-6)}`
    },
    statusValue(row) {
      return this.config.statusField ? this.optionLabel(this.config.statusField, row[this.config.statusField]) : ''
    },
    tagValues(row) {
      return (this.config.tagFields || []).map((name) => this.optionLabel(name, row[name])).filter((value) => value && value !== '-').slice(0, 3)
    },
    visibleLines(row) {
      return (this.config.lines || []).filter((line) => row[line.field] !== undefined && row[line.field] !== null && row[line.field] !== '').slice(0, 4)
    },
    displayLine(row, line) {
      const field = this.field(line.field)
      return field ? fieldDisplayValue(field, row[line.field]) : String(row[line.field] ?? '-')
    },
    formatTime(value) { return formatDateTime(value) },
    rowActions(row) {
      return (this.config.actionSchema || []).filter((action) => isActionVisible(action, row))
    },
    async runAction(action, row) {
      if (this.actionRunning) return
      this.actionRunning = true
      try {
        await executeViewAction(action, {
          form: row,
          user: getUser() || {},
          menu: this.baseConfig.menu || {},
          tableName: this.config.table,
          refresh: () => this.loadData(true, true)
        })
      } finally {
        this.actionRunning = false
      }
    },
    openDetail(row) {
      if (!row.Id) return
      uni.navigateTo({
        url: `/pages/module/detail?menuId=${encodeURIComponent(this.menuId)}&id=${encodeURIComponent(row.Id)}`
      })
    },
    openAdd() {
      openForm({
        table: this.config.table,
        mode: 'Add',
        title: `新增${this.config.title}`,
        menuId: this.config.menuId,
        menuAliases: this.config.menuAliases
      })
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style scoped>
.module-list { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: #18313d; background: #f4f8fa; }
.module-header { position: relative; z-index: 3; background: #fff; box-shadow: 0 4rpx 16rpx rgba(20, 74, 99, .06); }
.module-nav { min-height: 88rpx; display: grid; grid-template-columns: 72rpx minmax(0, 1fr) 72rpx; align-items: center; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; }
.module-nav__button { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #214958; font-size: 42rpx; }
.module-nav__button--add { color: #e54625; }
.module-nav__button--pressed { background: #edf5f8; }
.module-nav__title { overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; font-size: 31rpx; font-weight: 750; }
.search-row { display: grid; grid-template-columns: minmax(0, 1fr) 108rpx; gap: 12rpx; padding: 12rpx 22rpx 16rpx; }
.search-input { height: 76rpx; padding: 0 22rpx; border: 1px solid #dce7eb; border-radius: 8px; background: #f6f9fa; font-size: 25rpx; }
.search-button { display: flex; align-items: center; justify-content: center; color: #087da8; font-size: 26rpx; font-weight: 700; }
.period-scroll, .status-scroll { width: 100%; white-space: nowrap; }
.period-row, .status-row { display: inline-flex; min-width: 100%; padding: 0 22rpx 14rpx; box-sizing: border-box; }
.period-item { min-width: 112rpx; height: 76rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #dfe8eb; color: #71858d; background: #fff; font-size: 23rpx; }
.period-item:first-child { border-radius: 8px 0 0 8px; }
.period-item:last-child { border-radius: 0 8px 8px 0; }
.period-item text:last-child { margin-top: 2rpx; font-size: 19rpx; }
.period-item.active { border-color: #e54625; color: #fff; background: #e54625; }
.status-row { gap: 12rpx; }
.status-item { height: 64rpx; display: flex; align-items: center; padding: 0 24rpx; border: 1px solid #dfe8eb; border-radius: 8px; color: #637880; background: #fff; font-size: 23rpx; }
.status-item.active { border-color: #087da8; color: #087da8; background: #edf8fb; }
.module-header, .summary-strip { flex: 0 0 auto; }
.summary-strip { margin: 18rpx 22rpx; min-height: 142rpx; display: flex; align-items: center; gap: 38rpx; padding: 20rpx 28rpx; border-radius: 8px; color: #fff; background: linear-gradient(120deg, #087fbd, #18aa9d); box-shadow: 0 10rpx 28rpx rgba(8, 127, 189, .15); }
.summary-strip > view { display: flex; flex-direction: column; gap: 4rpx; }
.summary-strip > view text:first-child { font-size: 39rpx; font-weight: 800; }
.summary-strip > view text:last-child { opacity: .82; font-size: 22rpx; }
.summary-strip image { width: 70rpx; height: 70rpx; margin-left: auto; opacity: .86; }
.data-scroll { flex: 1 1 auto; min-height: 0; height: auto; }
.card-list { padding: 0 22rpx calc(40rpx + var(--mci-safe-bottom)); }
.data-card { margin-bottom: 18rpx; overflow: hidden; border: 1px solid #e1eaed; border-radius: 8px; background: #fff; box-shadow: 0 6rpx 18rpx rgba(21, 66, 83, .05); transition: transform .16s ease; }
.data-card--pressed { transform: scale(.99); }
.data-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; padding: 22rpx 24rpx 16rpx; }
.data-card__head > view { min-width: 0; display: flex; align-items: center; gap: 12rpx; }
.data-card__index { flex: 0 0 auto; width: 42rpx; height: 42rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #087da8; background: #edf8fb; font-size: 20rpx; }
.data-card__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #17313b; font-size: 29rpx; font-weight: 750; }
.status-chip { flex: 0 0 auto; padding: 8rpx 14rpx; border-radius: 6px; color: #267a5c; background: #eef9f4; font-size: 21rpx; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8rpx; padding: 0 24rpx 14rpx; }
.tag-row text { padding: 5rpx 11rpx; border-radius: 5px; color: #647880; background: #f3f6f7; font-size: 20rpx; }
.field-list { margin: 0 24rpx; padding: 16rpx 0; border-top: 1px solid #edf2f4; }
.field-row { display: grid; grid-template-columns: 150rpx minmax(0, 1fr); gap: 18rpx; padding: 8rpx 0; font-size: 24rpx; line-height: 1.55; }
.field-row text:first-child { color: #85979e; }
.field-row text:last-child { color: #334f59; overflow-wrap: anywhere; }
.action-row { display: flex; flex-wrap: wrap; gap: 12rpx; padding: 0 24rpx 18rpx; }
.action-row view { min-width: 120rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; padding: 0 18rpx; border: 1px solid #b7dce8; border-radius: 7px; color: #087da8; font-size: 22rpx; }
.data-card__foot { display: flex; justify-content: space-between; padding: 16rpx 24rpx; border-top: 1px solid #edf2f4; color: #98a7ac; font-size: 21rpx; }
.data-card__foot text:last-child { color: #087da8; }
.load-state { padding: 28rpx; color: #8a9ba1; font-size: 22rpx; text-align: center; }
.state-panel { min-height: 45vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 40rpx; text-align: center; }
.state-panel__title { font-size: 30rpx; font-weight: 750; }
.state-panel__text { color: #7f9198; font-size: 23rpx; }
.state-panel .mci-btn { min-width: 220rpx; margin-top: 10rpx; }
@media (prefers-reduced-motion: reduce) { .data-card { transition: none; } }
</style>
