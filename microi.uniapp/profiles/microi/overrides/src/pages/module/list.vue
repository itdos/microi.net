<template>
  <view class="module-list" :style="mciTokenStyle">
    <view class="module-header mci-safe-top">
      <view class="module-nav mci-safe-nav-row">
        <view class="module-nav__button" hover-class="module-nav__button--pressed" role="button" aria-label="返回" @tap="goBack"><view class="module-nav__back" aria-hidden="true" /></view>
        <text class="module-nav__title">{{ config.title || '业务列表' }}</text>
        <view v-if="canAddRecord" class="module-nav__button module-nav__button--add" hover-class="module-nav__button--pressed"
          role="button" tabindex="0" :aria-label="`新增${config.title || '业务数据'}`" @tap="openAdd" @keydown.enter="openAdd">
          <view class="mci-icon-plus" aria-hidden="true" />
        </view>
        <view v-else class="module-nav__button module-nav__button--placeholder" aria-hidden="true"></view>
      </view>
      <view class="search-row">
        <view class="search-input-wrap">
          <input v-model="keyword" class="search-input" confirm-type="search" :placeholder="`搜索${config.title || '业务数据'}`" @input="scheduleSearch" @confirm="search" />
          <view v-if="keyword" class="search-clear" hover-class="search-clear--pressed" aria-label="清空搜索" @tap.stop="clearKeyword"><view class="mci-icon-close" aria-hidden="true" /></view>
        </view>
        <view v-if="filterFields.length" class="filter-button" :class="{ active: activeFilterCount }" hover-class="filter-button--pressed" role="button" tabindex="0" @tap="filterVisible = true" @keydown.enter="filterVisible = true">
          <view class="filter-button__icon" aria-hidden="true"><view /></view>
          <text>筛选</text>
          <text v-if="activeFilterCount" class="filter-button__badge">{{ activeFilterCount }}</text>
        </view>
        <view v-if="hasActiveSearch" class="search-button" role="button" tabindex="0" @tap="resetSearch" @keydown.enter="resetSearch">重置</view>
      </view>
      <scroll-view class="period-scroll" scroll-x :show-scrollbar="false">
        <view class="period-row">
          <view v-for="item in periods" :key="item.value" class="period-item"
            :class="{ active: period === item.value }" role="button" tabindex="0" @tap="changePeriod(item.value)" @keydown.enter="changePeriod(item.value)">
            <text>{{ item.label }}</text>
            <text>{{ periodCounts[item.value] ?? '·' }}</text>
          </view>
        </view>
      </scroll-view>
      <scroll-view v-if="statusOptions.length" class="status-scroll" scroll-x :show-scrollbar="false">
        <view class="status-row">
          <view class="status-item" :class="{ active: !status }" role="button" tabindex="0" @tap="changeStatus('')" @keydown.enter="changeStatus('')">全部状态</view>
          <view v-for="item in statusOptions" :key="String(item)" class="status-item"
            :class="{ active: String(status) === String(item) }" role="button" tabindex="0" @tap="changeStatus(item)" @keydown.enter="changeStatus(item)">{{ optionLabel(config.statusField, item) }}</view>
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
          hover-class="data-card--pressed" role="button" tabindex="0" @tap="openDetail(row)" @keydown.enter="openDetail(row)">
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
            <text v-if="hiddenLineCount(row)" class="field-list__more">另有 {{ hiddenLineCount(row) }} 项，进入详情查看</text>
          </view>
          <view class="data-card__foot">
            <text>{{ cardBottomText(row) }}</text>
            <view class="data-card__links">
              <view v-if="rowActions(row).length" class="data-card__more" hover-class="data-card__more--pressed"
                role="button" tabindex="0" aria-label="更多操作" @tap.stop="openActionMenu(row)" @keydown.enter.stop="openActionMenu(row)">
                <view class="more-icon" aria-hidden="true"><view></view><view></view><view></view></view>
                <text>更多</text>
              </view>
            </view>
          </view>
        </view>
        <view class="load-state">{{ loading ? '正在加载…' : finished ? `已加载全部 ${count} 条` : '继续上拉加载' }}</view>
      </view>
      <view v-else-if="!loading" class="state-panel">
        <text class="state-panel__title">暂无{{ config.title || '' }}数据</text>
        <text class="state-panel__text">{{ canAddRecord ? '可调整搜索条件，或点击右上角新增' : '可调整搜索条件后重试' }}</text>
      </view>
    </scroll-view>
    <mci-filter-sheet
      :visible="filterVisible"
      :fields="filterFields"
      :values="appliedFilterValues"
      :definitions="config.definition?.fields || []"
      :table-name="config.table || ''"
      :menu-id="config.menuId || menuId"
      :module-engine-key="config.key || ''"
      @close="filterVisible = false"
      @reset="resetAdvancedFilters"
      @apply="applyAdvancedFilters"
    />
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getToken, getUser } from '@/utils/request.js'
import {
  formatDateTime,
  formatMoney,
  loadModulePeriodCounts,
  loadModuleRows,
  openForm,
  PERIOD_OPTIONS,
  statisticsFieldValue
} from '@/platform/business-runtime.js'
import { fieldDisplayValue, hydrateNativeFormOptions } from '@/platform/native-form.js'
import { loadModuleDefinition } from '@/platform/module-registry.js'
import { compileListConfig, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { appendStandardDeleteAction } from '@/platform/module-delete.js'
import { canAddMenuRecord } from '@/platform/menu-permission.js'
import { hasExactMenuPermission } from '@/platform/menu-permission.js'
import { getTenantModuleRowActions } from '@/platform/module-extension.js'
import { showRowActionSheet } from '@/platform/row-action-sheet.js'
import { listReturnMixin } from '@/platform/list-return.js'
import { buildListFilterWhere, hasListFilterValue } from '@/platform/list-filter-fields.mjs'
import { userFacingFallback } from '@/platform/user-facing-display.mjs'

export default {
  mixins: [themeMixin, listReturnMixin],
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
      viewManifest: null,
      filterVisible: false,
      appliedFilterValues: {},
      searchTimer: null,
      periodCountTimer: null
    }
  },
  computed: {
    periodLabel() {
      return this.periods.find((item) => item.value === this.period)?.label || '全部'
    },
    statusOptions() {
      return this.config.statusOptions || []
    },
    filterFields() {
      return Array.isArray(this.config.filterFields) ? this.config.filterFields : []
    },
    activeFilterCount() {
      return this.filterFields.filter((field) => hasListFilterValue(this.appliedFilterValues[field.key])).length
    },
    advancedWhere() {
      return buildListFilterWhere(this.filterFields, this.appliedFilterValues, this.currentUser)
    },
    currentUser() {
      return getUser() || {}
    },
    statisticsValue() {
      const value = statisticsFieldValue(this.dataAppend, this.config.statisticsField, 0)
      return formatMoney(value)
    },
    canAddRecord() {
      return canAddMenuRecord(this.menuId, getUser() || {})
    },
    hasActiveSearch() {
      return Boolean(this.keyword.trim() || this.period !== 'all' || this.status || this.activeFilterCount)
    }
  },
  onLoad(options) {
    this.menuId = decodeURIComponent(options.menuId || '')
    if (!getToken()) {
      this.loading = false
      uni.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.initialize()
  },
  onUnload() {
    clearTimeout(this.searchTimer)
    clearTimeout(this.periodCountTimer)
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
      const dynamic = compileListConfig(manifest, this.baseConfig.definition?.fields || [])
      if (!dynamic) return
      this.viewManifest = manifest
      const merged = { ...this.baseConfig }
      if (!merged.hasConfiguredMobileFields && dynamic.lines?.length) merged.lines = dynamic.lines
      if (!merged.hasConfiguredMobileFields && dynamic.bottomFields?.length) merged.bottomFields = dynamic.bottomFields
      if (dynamic.tagsFromViewSchema) merged.tagFields = dynamic.tagFields || []
      ;['titleField', 'statusField', 'summaryField', 'imageField', 'periodField',
        'statisticsField', 'statisticsLabel', 'statisticsFormat'].forEach((name) => {
        if (name === 'titleField' && merged.hasConfiguredMobileFields) return
        if (merged.hasConfiguredCardFields && ['summaryField', 'imageField'].includes(name)) return
        if (dynamic[name] !== undefined && dynamic[name] !== null && dynamic[name] !== '') merged[name] = dynamic[name]
      })
      if (dynamic.statusFromViewSchema) {
        merged.statusField = dynamic.statusField || ''
        merged.statusOptions = dynamic.statusOptions || []
      }
      merged.selectFields = [...new Set([
        ...(merged.selectFields || []),
        ...(dynamic.requiredFields || [])
      ].filter(Boolean))]
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
          extraWhere: this.advancedWhere,
          refresh
        })
        if (requestId !== this.requestId) return
        const nextRows = reset ? result.rows : [...this.rows, ...result.rows]
        const fieldNames = [...new Set([
          this.config.titleField,
          this.config.statusField,
          ...(this.config.tagFields || []),
          ...(this.config.lines || []).map((line) => line.field),
          ...(this.config.bottomFields || []).map((item) => typeof item === 'string' ? item : item.field)
        ].filter(Boolean))]
        await hydrateNativeFormOptions(this.config.definition, nextRows[0] || {}, {
          eagerDropdowns: true,
          records: nextRows,
          fieldNames,
          pageSize: 100,
          maxPages: 5,
          menuId: this.config.menuId,
          moduleEngineKey: this.config.key,
          timeoutMs: 8000
        })
        if (requestId !== this.requestId) return
        this.rows = nextRows
        this.count = result.count
        this.dataAppend = result.append
        this.finished = this.rows.length >= result.count || result.rows.length < this.config.pageSize
        if (!this.finished) this.pageIndex += 1
        if (reset) {
          clearTimeout(this.periodCountTimer)
          const keyword = this.keyword.trim()
          if (keyword) {
            this.periodCounts = {}
          } else {
            // 周期角标会额外发起多次统计请求。列表首屏和搜索优先，用户空闲后再加载角标。
            this.periodCountTimer = setTimeout(() => {
              loadModulePeriodCounts(this.config, {
                keyword: '',
                status: this.status,
                extraWhere: this.advancedWhere,
                refresh
              }).then((counts) => {
                if (requestId === this.requestId && !this.keyword.trim()) this.periodCounts = counts
              }).catch(() => {})
            }, 800)
          }
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
    search() {
      clearTimeout(this.searchTimer)
      clearTimeout(this.periodCountTimer)
      this.loadData(true, true)
    },
    // zhy：动态模块列表输入关键词后自动防抖检索。
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      clearTimeout(this.periodCountTimer)
      this.searchTimer = setTimeout(() => this.loadData(true, true), 350)
    },
    // zhy：重置关键词、时间周期和状态筛选。
    resetSearch() {
      clearTimeout(this.searchTimer)
      clearTimeout(this.periodCountTimer)
      this.keyword = ''
      this.period = 'all'
      this.status = ''
      this.appliedFilterValues = {}
      this.loadData(true, true)
    },
    // zhy：动态模块列表搜索支持一键清空并立即刷新。
    clearKeyword() {
      if (!this.keyword) return
      clearTimeout(this.searchTimer)
      clearTimeout(this.periodCountTimer)
      this.keyword = ''
      this.loadData(true, true)
    },
    changePeriod(value) {
      if (this.period === value) return
      this.period = value
      this.loadData(true, true)
    },
    changeStatus(value) {
      this.status = value
      this.loadData(true, true)
    },
    applyAdvancedFilters(values) {
      this.appliedFilterValues = values && typeof values === 'object' ? values : {}
      this.filterVisible = false
      this.loadData(true, true)
    },
    resetAdvancedFilters() {
      this.appliedFilterValues = {}
      this.filterVisible = false
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
      return fieldDisplayValue(field, value, { moduleTitle: this.config.title })
    },
    titleValue(row) {
      const value = this.optionLabel(this.config.titleField, row[this.config.titleField])
      return value && !['暂无', '信息未解析'].includes(value) ? value : '未命名记录'
    },
    statusValue(row) {
      const value = this.config.statusField ? this.optionLabel(this.config.statusField, row[this.config.statusField]) : ''
      return ['暂无', '信息未解析'].includes(value) ? '' : value
    },
    tagValues(row) {
      return (this.config.tagFields || []).map((name) => this.optionLabel(name, row[name])).filter((value) => value && !['暂无', '信息未解析'].includes(value)).slice(0, 3)
    },
    visibleLines(row) {
      return this.availableLines(row).slice(0, 5)
    },
    availableLines(row) {
      return (this.config.lines || []).filter((line) => row[line.field] !== undefined && row[line.field] !== null && row[line.field] !== '')
    },
    hiddenLineCount(row) {
      return Math.max(0, this.availableLines(row).length - 5)
    },
    displayLine(row, line) {
      const field = this.field(line.field)
      return field ? fieldDisplayValue(field, row[line.field], { moduleTitle: this.config.title }) : userFacingFallback(row[line.field])
    },
    cardBottomText(row) {
      const values = (this.config.bottomFields || []).map((item) => {
        const descriptor = typeof item === 'string' ? { field: item } : item
        return this.optionLabel(descriptor.field, row[descriptor.field])
      }).filter((value) => value && value !== '暂无')
      return values.length
        ? values.join(' · ')
        : this.cardTimeText(row)
    },
    cardTimeText(row) {
      const updated = row.UpdateTime
      const created = row.CreateTime
      const value = updated || created
      return value ? `${updated ? '更新于' : '创建于'} ${this.formatTime(value)}` : ''
    },
    formatTime(value) { return formatDateTime(value) },
    rowActions(row) {
      const user = getUser() || {}
      const actions = [
        ...(this.config.actionSchema || []).filter((action) => isActionVisible(action, row)),
        ...getTenantModuleRowActions({
          tableName: this.config.table,
          menuId: this.config.menuId || this.menuId,
          user,
          canApprove: hasExactMenuPermission(this.config.menuId || this.menuId, ['审批'], user)
        }, row)
      ]
      return appendStandardDeleteAction(actions, {
        row,
        user,
        menuId: this.config.menuId || this.menuId,
        tableName: this.config.table,
        moduleEngineKey: this.config.key,
        title: this.titleValue(row)
      })
    },
    openActionMenu(row) {
      const actions = this.rowActions(row)
      if (!actions.length) return
      showRowActionSheet(actions, (action) => this.runAction(action, row))
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
      this.mciNavigateToDetail(`/pages/module/detail?menuId=${encodeURIComponent(this.menuId)}&id=${encodeURIComponent(row.Id)}`)
    },
    openAdd() {
      if (!this.canAddRecord) {
        uni.showToast({ title: '暂无新增权限', icon: 'none' })
        return
      }
      this.mciMarkDetailReturn()
      openForm({
        table: this.config.table,
        mode: 'Add',
        title: `新增${this.config.title}`,
        menuId: this.config.menuId,
        menuAliases: this.config.menuAliases
      })
    },
    shouldMciRefreshForDataChange(event = {}) {
      const changedTable = String(event.table || '').trim().toLowerCase()
      const listTable = String(this.config.table || '').trim().toLowerCase()
      return !changedTable || !listTable || changedTable === listTable
    },
    async onMciListDataChanged() {
      await this.loadView(true)
      await this.loadData(true, true)
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  },
  onBackPress() {
    if (this.filterVisible) {
      this.filterVisible = false
      return true
    }
    return false
  }
}
</script>

<style scoped>
.module-list { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: #18313d; background: #f4f8fa; }
.module-header { position: relative; z-index: 3; background: #fff; box-shadow: 0 4rpx 16rpx rgba(20, 74, 99, .06); }
.module-nav { min-height: 88rpx; display: grid; grid-template-columns: 72rpx minmax(0, 1fr) 72rpx; align-items: center; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; }
.module-nav__button { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #214958; font-size: 42rpx; }
.module-nav__button--pressed { background: #edf5f8; }
.module-nav__title { overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; font-size: 31rpx; font-weight: 750; }
.search-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10rpx; padding: 12rpx 22rpx 16rpx; }
.search-input-wrap { position: relative; min-width: 0; }
.search-input { box-sizing: border-box; width: 100%; height: 76rpx; padding: 0 68rpx 0 22rpx; border: 1px solid #dce7eb; border-radius: 8px; background: #f6f9fa; font-size: 25rpx; }
.search-clear { position: absolute; top: 50%; right: 16rpx; display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; border-radius: 50%; color: #fff; background: #a9b7bd; font-size: 28rpx; transform: translateY(-50%); }
.search-clear--pressed { opacity: .68; }
.search-button { display: flex; align-items: center; justify-content: center; color: #087da8; font-size: 26rpx; font-weight: 700; }
.filter-button { position: relative; min-width: 100rpx; height: 76rpx; padding: 0 14rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; border: 1px solid #dce7eb; border-radius: 8px; color: #59727c; background: #fff; box-sizing: border-box; font-size: 24rpx; }
.filter-button.active { border-color: #087da8; color: #087da8; background: #edf8fb; }
.filter-button--pressed { opacity: .68; }
.filter-button__icon { position: relative; width: 25rpx; height: 22rpx; border-top: 3rpx solid currentColor; box-sizing: border-box; }
.filter-button__icon::before, .filter-button__icon::after { position: absolute; left: 4rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; }
.filter-button__icon::before { top: 6rpx; width: 17rpx; }
.filter-button__icon::after { top: 15rpx; left: 9rpx; width: 8rpx; }
.filter-button__badge { position: absolute; top: -9rpx; right: -8rpx; min-width: 30rpx; height: 30rpx; padding: 0 6rpx; display: flex; align-items: center; justify-content: center; border: 3rpx solid #fff; border-radius: 18rpx; color: #fff; background: #e54625; box-sizing: border-box; font-size: 18rpx; }
.period-scroll, .status-scroll { width: 100%; white-space: nowrap; }
.period-row, .status-row { display: inline-flex; min-width: 100%; padding: 0 22rpx 14rpx; box-sizing: border-box; }
.period-item { min-width: 112rpx; height: 76rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #dfe8eb; color: #71858d; background: #fff; font-size: 23rpx; }
.period-item:first-child { border-radius: 8px 0 0 8px; }
.period-item:last-child { border-radius: 0 8px 8px 0; }
.period-item text:last-child { margin-top: 2rpx; font-size: 22rpx; }
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
.data-card__foot, .data-card__links, .data-card__more, .more-icon { display: flex; align-items: center; }
.data-card__foot { justify-content: space-between; gap: 16rpx; min-height: 64rpx; padding: 8rpx 16rpx 8rpx 24rpx; border-top: 1px solid #edf2f4; color: #98a7ac; font-size: 21rpx; }
.data-card__links { flex: 0 0 auto; gap: 8rpx; }
.data-card__more { min-width: 102rpx; height: 64rpx; justify-content: center; gap: 8rpx; border-radius: 8px; color: #526d78; }
.data-card__more--pressed { background: #edf5f8; }
.more-icon { gap: 4rpx; }
.more-icon > view { width: 6rpx; height: 6rpx; border-radius: 50%; background: currentColor; }
.load-state { padding: 28rpx; color: #8a9ba1; font-size: 22rpx; text-align: center; }
.state-panel { min-height: 45vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 40rpx; text-align: center; }
.state-panel__title { font-size: 30rpx; font-weight: 750; }
.state-panel__text { color: #7f9198; font-size: 23rpx; }
.state-panel .mci-btn { min-width: 220rpx; margin-top: 10rpx; }
@media (prefers-reduced-motion: reduce) { .data-card { transition: none; } }
</style>

<style scoped>
/* Microi Blue Suite record browser: native white shell and concise record summaries. */
.module-list, .data-scroll { background: var(--mci-app-canvas, #f8fafc); }
.module-header { position: relative; border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); background: #fff; box-shadow: none; }
.module-header::after { display: none; }
.module-nav { min-height: 88rpx; grid-template-columns: 88rpx minmax(0, 1fr) 88rpx; }
.module-nav__button { width: 88rpx; height: 88rpx; border-radius: 18rpx; color: var(--mci-color-primary, #2563eb); }
.module-nav__button--add { justify-self: end; font-size: 34rpx; }
.module-nav__back { width: 18rpx; height: 18rpx; border-bottom: 4rpx solid currentColor; border-left: 4rpx solid currentColor; border-radius: 1rpx; transform: rotate(45deg); }
.module-nav__title { color: var(--mci-text-primary, #111827); font-size: 31rpx; font-weight: 750; letter-spacing: 0; }
.search-row { grid-template-columns: minmax(0,1fr) auto auto; gap: 10rpx; padding: 6rpx 22rpx 14rpx; background: #fff; }
.search-input-wrap { min-height: 88rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 18rpx; background: #f8fafc; }
.search-input { height: 88rpx; border: 0; border-radius: inherit; color: var(--mci-text-primary, #111827); background: transparent; }
.search-clear { right: 0; width: 88rpx; height: 88rpx; color: var(--mci-text-tertiary, #9ca3af); background: transparent; }
.filter-button, .search-button { min-height: 88rpx; height: 88rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 18rpx; color: var(--mci-text-secondary, #667280); background: #fff; }
.search-button { min-width: 78rpx; padding: 0 12rpx; border-color: transparent; color: var(--mci-color-primary, #2563eb); }
.filter-button.active { border-color: var(--mci-color-primary, #2563eb); color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-faint, #eff6ff); }
.period-scroll, .status-scroll { background: #fff; }
.period-row, .status-row { gap: 10rpx; padding: 0 22rpx 14rpx; }
.period-item, .status-item { min-height: 88rpx; height: 88rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 16rpx !important; color: var(--mci-text-secondary, #667280); background: #fff; }
.period-item:first-child, .period-item:last-child { border-radius: 16rpx; }
.period-item.active, .status-item.active { border-color: var(--mci-color-primary, #2563eb); color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-faint, #eff6ff); }
.summary-strip { min-height: 96rpx; margin: 14rpx 22rpx; padding: 14rpx 22rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 20rpx; color: var(--mci-text-primary, #111827); background: #fff; box-shadow: none; }
.summary-strip::before { display: none; }
.summary-strip > view text:first-child { color: var(--mci-color-primary, #2563eb); font-size: 36rpx; font-weight: 800; }
.summary-strip > view text:last-child { color: var(--mci-text-secondary, #667280); font-size: 22rpx; letter-spacing: 0; }
.summary-strip image { width: 54rpx; height: 54rpx; opacity: .55; }
.card-list { padding: 0 22rpx calc(36rpx + var(--mci-safe-bottom)); }
.data-card { position: relative; margin-bottom: 16rpx; padding: 0; overflow: hidden; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.data-card::before { display: none; }
.data-card--pressed { background: var(--mci-color-primary-faint, #eff6ff); box-shadow: none; transform: scale(.99); }
.data-card__head { padding: 22rpx 22rpx 14rpx; }
.data-card__index { width: 42rpx; height: 42rpx; border-radius: 12rpx; color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-soft, #dbeafe); font-weight: 700; }
.data-card__title { color: var(--mci-text-primary, #111827); font-size: 28rpx; font-weight: 750; }
.status-chip { border: 1rpx solid rgba(16,185,129,.24); border-radius: 12rpx; color: #059669; background: #ecfdf5; }
.tag-row { padding: 0 22rpx 12rpx; }
.tag-row text { border: 0; border-radius: 10rpx; color: var(--mci-text-secondary, #667280); background: #f1f5f9; }
.field-list { margin: 0 22rpx; padding: 12rpx 0 14rpx; border-color: var(--mci-divider, #e5e7eb); }
.field-row { grid-template-columns: 134rpx minmax(0,1fr); padding: 7rpx 0; font-size: 23rpx; }
.field-row text:first-child { color: var(--mci-text-tertiary, #9ca3af); }
.field-row text:last-child { color: var(--mci-text-primary, #111827); }
.field-list__more { display: block; padding-top: 8rpx; color: var(--mci-text-tertiary, #9ca3af); font-size: 22rpx; }
.data-card__foot { min-height: 88rpx; padding: 0 10rpx 0 22rpx; border-color: var(--mci-divider, #e5e7eb); color: var(--mci-text-tertiary, #9ca3af); }
.data-card__more { min-height: 88rpx; height: 88rpx; color: var(--mci-color-primary, #2563eb); }
.data-card__more { border-radius: 14rpx; }
.state-panel { background: var(--mci-app-canvas, #f8fafc); }
</style>
