<template>
  <mci-page-shell class="task-page" :style="mciTokenStyle" title="售后任务" subtitle="接单、服务与验收全流程" @back="goBack">
    <template #right>
      <view class="nav-scan" hover-class="nav-scan--pressed" @tap="scan"><image :src="xjyAssets.scan" mode="aspectFit" /></view>
    </template>

    <view class="task-toolbar">
      <view class="task-map-entry" hover-class="task-map-entry--pressed" @tap="openTaskMap">
        <image src="/static/xjy/business/customerMap.png" mode="aspectFit" />
        <text>任务地图</text>
      </view>
      <view class="search-box">
        <text class="search-box__icon">⌕</text>
        <input v-model="keyword" confirm-type="search" placeholder="客户、任务编号、类型或服务人员" @input="scheduleSearch" @confirm="search" />
        <view v-if="keyword" class="search-box__clear" @tap="clearKeyword"><text>×</text></view>
      </view>
      <view class="filter-button" :class="{ active: activeFilterCount }" hover-class="filter-button--pressed" @tap="filterVisible = true">
        <text class="filter-button__icon">≡</text><text>筛选</text><text v-if="activeFilterCount" class="filter-button__badge">{{ activeFilterCount }}</text>
      </view>
    </view>

    <scroll-view class="state-scroll" scroll-x :show-scrollbar="false">
      <view class="state-row">
        <view
          v-for="item in states"
          :key="item.value || 'all'"
          class="state-card"
          :class="[{ active: state === item.value }, stateClass(item.value)]"
          @tap="changeState(item.value)"
        >
          <text class="state-card__count">{{ stateCount(item) }}</text>
          <text class="state-card__label">{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="showMineSwitch" class="scope-row">
      <view v-for="option in scopeOptions" :key="option.value" class="scope-chip" :class="{ active: scope === option.value }" @tap="selectScope(option.value)">{{ option.label }}</view>
    </view>
    <view class="quick-filter">
      <scroll-view class="period-scroll" scroll-x :show-scrollbar="false">
        <view class="period-row">
          <view v-for="item in periods" :key="item.value" class="period-chip" :class="{ active: period === item.value }" @tap="selectPeriod(item.value)"><text>{{ item.label }}</text><text class="period-chip__count">{{ periodCount(item) }}</text></view>
        </view>
      </scroll-view>
    </view>
    <scroll-view v-if="typeOptions.length" class="type-scroll" scroll-x :show-scrollbar="false">
      <view class="type-row">
        <view class="type-chip" :class="{ active: !type }" @tap="changeType('')">全部类型</view>
        <view v-for="item in typeOptions" :key="item.name" class="type-chip" :class="{ active: type === item.name }" @tap="changeType(item.name)">{{ item.name }}<text>{{ item.count }}</text></view>
      </view>
    </scroll-view>

    <view v-if="stale" class="offline-tip"><text>网络较慢，当前先展示最近缓存的数据</text></view>

    <scroll-view
      class="task-scroll"
      scroll-y
      :scroll-top="mciScrollCommand"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @scroll="handleMciListScroll"
      @refresherrefresh="refresh"
      @scrolltolower="loadMore"
    >
      <view v-if="hasActiveListFilters" class="task-filter-feedback">
        <text>当前条件找到 {{ count }} 个任务</text>
        <view class="task-filter-reset" hover-class="task-filter-reset--pressed" @tap="resetFilters">
          <view class="task-filter-reset__icon" aria-hidden="true"></view>
          <text>重置筛选</text>
        </view>
      </view>

      <mci-skeleton v-if="loading && pageIndex === 1" type="list" :rows="6" />

      <view v-else-if="displayRows.length" class="task-list">
        <view
          v-for="(item, index) in displayRows"
          :id="taskAnchorId(item)"
          :key="item.Id || index"
          class="task-list-session-item"
          :class="{ 'task-list-session-item--focused': isFocusedTask(item) }"
        >
          <view v-if="isFocusedTask(item)" class="task-focus-label"><text>本次报修</text></view>
          <mci-task-card
            :item="taskCardItem(item)" :index="index"
            :state-class="taskStateClass(item.state)" @open="openTask" @phone="callPhone"
          />
        </view>
        <view class="load-state"><text v-if="loading">正在加载...</text><text v-else-if="finished">共 {{ count }} 个任务，已全部加载</text><text v-else>上拉加载更多</text></view>
      </view>

      <view v-else class="empty-state">
        <image src="/static/xjy/repair/renwu.png" mode="aspectFit" />
        <text class="empty-state__title">当前条件下没有任务</text>
        <text class="empty-state__desc">{{ emptyStateDescription }}</text>
        <view class="empty-state__button" @tap="resetFilters"><text>重置筛选</text></view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>

    <view v-if="canAddTask" class="floating-add" hover-class="floating-add--pressed" @tap="addTask"><text>＋</text></view>

    <view v-if="filterVisible" class="sheet-mask" @tap="filterVisible = false">
      <view class="filter-sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-heading"><view><text class="sheet-title">更多筛选</text><text class="sheet-subtitle">筛选字段与后台配置同步，条件会自动保留</text></view><view class="sheet-close" @tap="filterVisible = false"><text>×</text></view></view>

        <view v-if="period === 'custom'" class="filter-group">
          <text class="filter-label">自定义时间范围</text>
          <view class="date-grid">
            <picker mode="date" :value="customStart" @change="customStart = $event.detail.value"><view class="picker-control"><text>{{ customStart || '开始日期' }}</text></view></picker>
            <picker mode="date" :value="customEnd" @change="customEnd = $event.detail.value"><view class="picker-control"><text>{{ customEnd || '结束日期' }}</text></view></picker>
          </view>
        </view>

        <view class="filter-group">
          <text class="filter-label">所在城市</text>
          <mci-list-filter-field
            :field="cityFilterField"
            v-model="city"
            :menu-id="taskMenuId"
            :module-engine-key="taskModuleEngineKey"
            :form-data="filterFormData"
          />
        </view>

        <view v-for="field in taskFilterFields" :key="field.key" class="filter-group">
          <text class="filter-label">{{ field.label }}</text>
          <mci-list-filter-field
            :field="field"
            v-model="filterValues[field.key]"
            :menu-id="taskMenuId"
            :module-engine-key="taskModuleEngineKey"
            :form-data="filterFormData"
          />
        </view>

        <view class="filter-group">
          <text class="filter-label">排序方式</text>
          <view class="sort-tabs"><view :class="{ active: orderType === 'ASC' }" @tap="orderType = 'ASC'">时间升序</view><view :class="{ active: orderType === 'DESC' }" @tap="orderType = 'DESC'">时间降序</view></view>
        </view>

        <view class="sheet-actions"><view class="sheet-button sheet-button--plain" @tap="resetFilters(false)"><text>重置</text></view><view class="sheet-button sheet-button--primary" @tap="applyFilters"><text>查看结果</text></view></view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { buildFriendShare, buildTimelineShare } from '@/utils/share.js'
import { themeMixin } from '@/utils/theme.js'
import { findMenu, formatDateTime, openForm, scanDevice } from '@/platform/business-runtime.js'
import { canAddMenuRecord } from '@/platform/menu-permission.js'
import { listReturnMixin } from '@/platform/list-return.js'
import { getUser } from '@/utils/request.js'
import { getRoleProfile } from '@/tenants/xjy/business.js'
import { TASK_SCOPE_OPTIONS, normalizeTaskScope } from '@/tenants/xjy/task-responsibility.mjs'
import { readListEntryPeriod } from '@/platform/list-entry-period.mjs'
import { buildListFilterWhere, hasListFilterValue, validateListFilters } from '@/platform/list-filter-fields.mjs'
import MciListFilterField from '@/components/mci-list-filter-field/mci-list-filter-field.vue'
import MciTaskCard from '@/components/mci-task-card/mci-task-card.vue'
import {
  TASK_DATE_FIELDS,
  TASK_PERIODS,
  TASK_STATES,
  loadTaskFilterConfig,
  loadTaskPeriodCounts,
  loadTaskSummaryCounts,
  loadTaskStateCounts,
  loadTasks,
  taskStateClass
} from '@/utils/xjy-task.js'

const STATE_COUNT_KEYS = {
  '待接单': 'pending', '待服务': 'TodoCount', '待客服验收': 'acceptance',
  '待客户验收': 'cacceptance', '待评价': 'evaluated', '暂停': 'suspend', '已结束': 'FinishCount', '已取消': 'cancel'
}

export default {
  onShareAppMessage() { return buildFriendShare(this, 'pages/task/list') },
  onShareTimeline() { return buildTimelineShare(this, 'pages/task/list') },
  components: { MciListFilterField, MciTaskCard },
  mixins: [themeMixin, listReturnMixin],
  data() {
    return {
      states: TASK_STATES,
      periods: TASK_PERIODS,
      dateFields: TASK_DATE_FIELDS,
      rows: [],
      count: 0,
      stateCounts: {},
      typeCounts: {},
      periodCounts: {},
      pageIndex: 1,
      pageSize: 15,
      keyword: '',
      customerId: '',
      state: '',
      type: '',
      period: 'month',
      dateField: 'YujiSHSJ',
      customStart: '',
      customEnd: '',
      city: [],
      cityFilterField: { key: 'Chengshi', field: 'Chengshi', label: '所在城市', type: 'address', storage: 'region' },
      taskFilterFields: [],
      filterValues: {},
      taskModuleEngineKey: 'Diy_ShouhouDD',
      scopeOptions: TASK_SCOPE_OPTIONS,
      scope: 'todo',
      mineOnly: true,
      orderType: 'ASC',
      loading: true,
      refreshing: false,
      finished: false,
      stale: false,
      filterVisible: false,
      taskDataChanged: false,
      changedListener: null,
      loadRequestId: 0,
      searchTimer: null,
      taskListSessionKey: '',
      currentUser: {},
      taskMenuId: '',
      taskPermissionReady: false,
      focusTaskId: '',
      focusedTask: null
    }
  },
  computed: {
    customRange() {
      return this.customStart && this.customEnd ? [`${this.customStart} 00:00:00`, `${this.customEnd} 23:59:59`] : null
    },
    typeOptions() { return Object.keys(this.typeCounts).map((name) => ({ name, count: this.typeCounts[name] })).filter((item) => item.name !== '换芯') },
    activeFilterCount() {
      const configured = this.taskFilterFields.reduce((count, field) => count + Number(hasListFilterValue(this.filterValues[field.key])), 0)
      return Number(hasListFilterValue(this.city)) + configured + Number(this.orderType !== 'ASC') + Number(this.period === 'custom')
    },
    hasActiveListFilters() {
      const defaultScope = this.isCustomerAccount ? 'all' : 'todo'
      return Boolean(
        String(this.keyword || '').trim()
        || this.state
        || this.type
        || this.period !== 'month'
        || this.dateField !== 'YujiSHSJ'
        || hasListFilterValue(this.city)
        || Object.values(this.filterValues || {}).some((value) => hasListFilterValue(value))
        || this.orderType !== 'ASC'
        || this.scope !== defaultScope
      )
    },
    filterFormData() { return {} },
    roleProfile() { return getRoleProfile(this.currentUser) },
    isCustomerAccount() { return this.roleProfile.isCustomer === true },
    showMineSwitch() { return !this.isCustomerAccount },
    emptyStateDescription() {
      return this.isCustomerAccount ? '可切换状态、时间或其他筛选条件' : '可切换状态、时间或选择“我参与的”“全部有权”'
    },
    displayRows() {
      const rows = this.focusedTask ? [this.focusedTask, ...this.rows] : this.rows
      const seen = new Set()
      return rows.filter((item) => {
        const id = String(item && (item.Id || item.id) || '')
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
    },
    canAddTask() { return this.taskPermissionReady && canAddMenuRecord(this.taskMenuId, this.currentUser) }
  },
  onLoad(options = {}) {
    const entryPeriod = readListEntryPeriod(options, 'month')
    this.period = entryPeriod.period
    this.customStart = entryPeriod.customStart
    this.customEnd = entryPeriod.customEnd
    if (this.dateFields.some((item) => item.value === options.dateField)) this.dateField = options.dateField
    if (options.customerId) this.customerId = decodeURIComponent(options.customerId)
    if (options.state) this.state = decodeURIComponent(options.state)
    const user = getUser() || {}
    this.currentUser = user
    this.focusTaskId = decodeURIComponent(options.focusTaskId || options.taskId || '')
    this.scope = this.isCustomerAccount ? 'all' : normalizeTaskScope(options.scope, true)
    this.mineOnly = this.scope !== 'all'
    if (this.focusTaskId) {
      this.state = ''
      this.period = 'all'
    }
    const taskListSessionParts = [
      'task-list:v4',
      user.Id || user.Account || 'guest',
      this.customerId || 'all-customers',
      options.state ? `entry-state:${this.state}` : 'default-state',
      this.isCustomerAccount ? 'customer-scope' : `${this.scope}-scope`
    ]
    if (entryPeriod.forceFresh) {
      taskListSessionParts.push(`performance:${this.period}:${this.customStart || '-'}:${this.customEnd || '-'}`)
    }
    this.taskListSessionKey = taskListSessionParts.join('|')
    const restored = (this.focusTaskId || entryPeriod.forceFresh) ? null : this.restoreTaskListSession()
    this.bootstrap(restored)
    this.changedListener = () => { this.taskDataChanged = true }
    uni.$on('xjy:task-changed', this.changedListener)
  },
  onUnload() {
    clearTimeout(this.searchTimer)
    if (this.changedListener) uni.$off('xjy:task-changed', this.changedListener)
  },
  methods: {
    taskStateClass,
    async bootstrap(restored) {
      // 先确定当前任务菜单，再读取同一菜单的筛选定义，避免并发失败分支覆盖有效菜单上下文。
      await this.loadTaskCreatePermission()
      await this.loadFilterConfig(false)
      if (!restored) await this.loadData(true, true)
      else await this.refreshRestoredTaskList(restored)
    },
    async loadFilterConfig(refresh = false) {
      try {
        const config = await loadTaskFilterConfig(refresh)
        this.taskFilterFields = config.filterFields || []
        this.cityFilterField = config.cityFilterField || this.cityFilterField
        this.taskMenuId = config.menuId || this.taskMenuId
        this.taskModuleEngineKey = config.moduleEngineKey || 'Diy_ShouhouDD'
        const availableKeys = new Set(this.taskFilterFields.map((field) => field.key))
        this.filterValues = Object.fromEntries(Object.entries(this.filterValues || {}).filter(([key]) => availableKeys.has(key)))
      } catch (error) {
        // 菜单元数据暂时不可用时保留城市区域筛选，任务列表本身仍按既有权限加载。
        this.taskFilterFields = []
      }
    },
    async loadTaskCreatePermission(refresh = false) {
      this.taskPermissionReady = false
      this.currentUser = getUser() || {}
      try {
        const menu = await findMenu(['售后订单', '售后任务'], 'Diy_ShouhouDD', refresh)
        this.taskMenuId = String(menu && menu.Id || '')
      } catch (error) {
        this.taskMenuId = ''
      } finally {
        this.taskPermissionReady = true
      }
    },
    shouldMciRetainListSession() { return !!this.taskListSessionKey },
    getMciListSnapshotKey() { return this.taskListSessionKey },
    getMciListAnchorConfig() { return { container: '.task-scroll', items: '.task-list-session-item' } },
    taskAnchorId(item = {}) { return `mci-task-${String(item.Id || item.id || '').replace(/[^A-Za-z0-9_-]/g, '')}` },
    isFocusedTask(item = {}) { return !!this.focusTaskId && String(item.Id || item.id || '') === this.focusTaskId },
    getMciListSnapshot() {
      return {
        rows: [...this.rows],
        count: this.count,
        stateCounts: { ...this.stateCounts },
        typeCounts: { ...this.typeCounts },
        periodCounts: { ...this.periodCounts },
        pageIndex: this.pageIndex,
        keyword: this.keyword,
        customerId: this.customerId,
        state: this.state,
        type: this.type,
        period: this.period,
        dateField: this.dateField,
        customStart: this.customStart,
        customEnd: this.customEnd,
        city: this.city,
        filterValues: JSON.parse(JSON.stringify(this.filterValues || {})),
        scope: this.scope,
        mineOnly: this.isCustomerAccount ? false : this.mineOnly,
        orderType: this.orderType,
        finished: this.finished,
        stale: this.stale
      }
    },
    restoreTaskListSession() {
      const snapshot = this.mciReadRetainedListSnapshot()
      const payload = snapshot && snapshot.payload
      if (!payload || !Array.isArray(payload.rows)) return null
      const fields = [
        'rows', 'count', 'stateCounts', 'typeCounts', 'periodCounts', 'pageIndex', 'keyword',
        'customerId', 'state', 'type', 'period', 'dateField', 'customStart', 'customEnd',
        'city', 'filterValues', 'scope', 'mineOnly', 'orderType', 'finished', 'stale'
      ]
      fields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) this[field] = payload[field]
      })
      this.scope = this.isCustomerAccount ? 'all' : normalizeTaskScope(payload.scope, payload.mineOnly)
      this.mineOnly = this.scope !== 'all'
      this.loading = false
      this.refreshing = false
      this.mciApplyListSnapshotPosition(snapshot)
      return snapshot
    },
    taskFilters(overrides = {}) {
      return {
        pageIndex: this.pageIndex,
        pageSize: this.pageSize,
        keyword: this.keyword.trim(),
        state: this.state,
        type: this.type,
        period: this.period,
        customRange: this.customRange,
        dateField: this.dateField,
        city: this.taskCityStatisticValue(),
        extraWhere: this.buildTaskFilterWhere(),
        scope: this.scope,
        mineOnly: this.isCustomerAccount ? false : this.mineOnly,
        orderBy: this.dateField,
        orderType: this.orderType,
        customerId: this.customerId || '',
        ...overrides
      }
    },
    taskCityStatisticValue() {
      if (!Array.isArray(this.city)) return String(this.city || '').trim()
      const parts = this.city.filter((part) => part && part !== '全部')
      return parts[parts.length - 1] || ''
    },
    buildTaskFilterWhere() {
      return [
        ...buildListFilterWhere([this.cityFilterField], { Chengshi: this.city }, this.currentUser),
        ...buildListFilterWhere(this.taskFilterFields, this.filterValues, this.currentUser)
      ]
    },
    async refreshRestoredTaskList(snapshot) {
      if (!this.rows.length) return this.loadData(true, true)
      const requestId = ++this.loadRequestId
      const loadedCount = Math.max(this.pageSize, Math.ceil(this.rows.length / this.pageSize) * this.pageSize)
      try {
        const result = await loadTasks(this.taskFilters({ pageIndex: 1, pageSize: loadedCount, refresh: true }))
        if (requestId !== this.loadRequestId) return
        this.rows = result.rows
        this.count = result.count
        this.stale = result.stale
        this.finished = this.rows.length >= this.count || result.rows.length < loadedCount
        this.pageIndex = Math.ceil(this.rows.length / this.pageSize) + 1
        this.loadAuxiliaryCounts(this.taskFilters({ pageIndex: 1, refresh: true }), requestId)
        this.$nextTick(() => this.mciRestoreListAnchor(snapshot.anchor, snapshot.scrollTop))
      } catch (error) {
        // 已恢复的会话仍可继续使用；网络恢复后用户可下拉刷新。
        if (requestId === this.loadRequestId) this.stale = true
      }
    },
    async loadData(reset = false, refresh = false) {
      if (this.loading && !reset) return
      if (!reset && this.finished) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.finished = false }
      this.loading = true
      if (reset) this.mciRestoreListPosition(0)
      const filters = this.taskFilters({ refresh })
      try {
        const focusPromise = reset && this.focusTaskId
          ? this.loadFocusedTask(refresh).catch(() => null)
          : Promise.resolve(this.focusedTask)
        const [result, focusedTask] = await Promise.all([loadTasks(filters), focusPromise])
        if (requestId !== this.loadRequestId) return
        if (reset) this.focusedTask = focusedTask
        this.rows = reset ? result.rows : [...this.rows, ...result.rows]
        this.count = result.count
        this.stale = result.stale
        this.finished = this.rows.length >= this.count || result.rows.length < this.pageSize
        if (!this.finished) this.pageIndex += 1
        this.loading = false
        if (reset) this.loadAuxiliaryCounts(filters, requestId)
      } catch (error) {
        if (requestId === this.loadRequestId) uni.showToast({ title: error.message || '任务加载失败', icon: 'none' })
      } finally {
        if (requestId === this.loadRequestId) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    async loadFocusedTask(refresh = false) {
      const result = await loadTasks(this.taskFilters({
        pageIndex: 1,
        pageSize: 1,
        keyword: '',
        state: '',
        type: '',
        period: 'all',
        customRange: null,
        city: '',
        customerId: '',
        mineOnly: false,
        scope: 'all',
        refresh,
        extraWhere: [{ Name: 'Id', Type: '=', Value: this.focusTaskId }]
      }))
      return result.rows[0] || null
    },
    async loadAuxiliaryCounts(filters, requestId) {
      try {
        const [summary, states] = await Promise.all([
          loadTaskSummaryCounts(filters),
          loadTaskStateCounts(filters)
        ])
        if (requestId !== this.loadRequestId) return
        this.typeCounts = summary.typeCounts
        let periods = summary.periodCounts
        if (!Object.keys(periods).length) periods = await loadTaskPeriodCounts(filters)
        if (requestId !== this.loadRequestId) return
        this.periodCounts = periods
        this.stateCounts = states
      } catch (error) {}
    },
    stateCount(item) {
      if (!item.value) return this.state ? '·' : this.count
      const value = this.stateCounts[STATE_COUNT_KEYS[item.value]]
      if (value !== undefined) return value
      return this.state === item.value ? this.count : '·'
    },
    stateClass(value) { return value ? taskStateClass(value) : 'is-all' },
    periodCount(item) {
      if (Object.prototype.hasOwnProperty.call(this.periodCounts, item.value)) return this.periodCounts[item.value]
      if (item.value === 'custom' && !this.customRange) return '—'
      if (this.period === item.value) return this.count
      return '·'
    },
    shortType(value) { return String(value || '服务').slice(0, 2) },
    formatTime(value) { return formatDateTime(value) },
    taskCardItem(item) {
      return {
        ...item,
        planTimeText: this.formatTime(item.planTime)
      }
    },
    search() {
      clearTimeout(this.searchTimer)
      this.loadData(true, true)
    },
    // zhy：售后任务列表输入关键词后自动防抖检索。
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadData(true, true), 350)
    },
    clearKeyword() {
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.loadData(true, true)
    },
    changeState(value) { if (this.state === value) return; this.state = value; this.loadData(true, true) },
    changeType(value) { if (this.type === value) return; this.type = value; this.loadData(true, true) },
    selectPeriod(value) { this.period = value; if (value === 'custom') this.filterVisible = true; else this.loadData(true, true) },
    selectScope(scope) {
      if (this.isCustomerAccount || this.scope === scope) return
      this.scope = scope
      this.mineOnly = scope !== 'all'
      this.loadData(true, true)
    },
    applyFilters() {
      if (this.period === 'custom' && !this.customRange) { uni.showToast({ title: '请选择完整时间范围', icon: 'none' }); return }
      if (this.customStart && this.customEnd && this.customStart > this.customEnd) { uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' }); return }
      const validation = validateListFilters(this.taskFilterFields, this.filterValues)
      if (validation) { uni.showToast({ title: validation, icon: 'none' }); return }
      this.filterVisible = false
      this.loadData(true, true)
    },
    resetFilters(load = true) {
      this.keyword = ''; this.state = ''; this.type = ''; this.period = 'month'; this.dateField = 'YujiSHSJ'
      this.customStart = ''; this.customEnd = ''; this.city = []; this.filterValues = {}; this.scope = this.isCustomerAccount ? 'all' : 'todo'; this.mineOnly = this.scope !== 'all'; this.orderType = 'ASC'
      this.filterVisible = false
      if (load) this.loadData(true, true)
    },
    async refresh() { this.refreshing = true; try { await this.loadFilterConfig(true); await this.loadData(true, true) } finally { this.refreshing = false } },
    loadMore() { this.loadData(false, false) },
    async onMciListDetailReturned(scrollTop) {
      if (!this.taskDataChanged || !this.rows.length) return
      this.taskDataChanged = false
      const requestId = ++this.loadRequestId
      const loadedCount = Math.max(this.pageSize, Math.ceil(this.rows.length / this.pageSize) * this.pageSize)
      const anchor = { id: this.mciListAnchorId, offset: this.mciListAnchorOffset }
      try {
        const filters = this.taskFilters({ pageIndex: 1, pageSize: loadedCount, refresh: true })
        const result = await loadTasks(filters)
        if (requestId !== this.loadRequestId) return
        this.rows = result.rows
        this.count = result.count
        this.finished = this.rows.length >= this.count
        this.pageIndex = Math.ceil(this.rows.length / this.pageSize) + 1
        this.loadAuxiliaryCounts(filters, requestId)
      } catch (error) {
        console.warn('[TaskList] detail return refresh failed:', error && (error.message || error))
      } finally {
        if (requestId === this.loadRequestId) this.mciRestoreListAnchor(anchor, scrollTop)
      }
    },
    openTask(item) { this.mciNavigateToDetail(`/pages/task/detail?id=${encodeURIComponent(item.Id)}`) },
    openTaskMap() {
      const filters = {
        keyword: this.keyword.trim(), state: this.state, type: this.type, period: this.period,
        customRange: this.customRange, dateField: this.dateField, city: this.taskCityStatisticValue(),
        extraWhere: this.buildTaskFilterWhere(),
        scope: this.scope,
        mineOnly: this.isCustomerAccount ? false : this.mineOnly, orderBy: this.dateField, orderType: this.orderType,
        customerId: this.customerId || ''
      }
      this.mciNavigateToDetail(`/pages/task/map?mode=task&filters=${encodeURIComponent(JSON.stringify(filters))}`)
    },
    addTask() {
      if (!this.canAddTask) {
        uni.showToast({ title: '当前账号没有新增权限', icon: 'none' })
        return
      }
      this.mciMarkDetailReturn()
      openForm({ table: 'Diy_ShouhouDD', mode: 'Add', title: '新增售后任务', menuId: this.taskMenuId, menuAliases: ['售后订单', '售后任务'] })
    },
    scan() { this.mciMarkDetailReturn(); scanDevice() },
    callPhone(phone) { uni.makePhoneCall({ phoneNumber: String(phone) }) },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.task-page { height: 100vh; overflow: hidden; }
.nav-scan { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; transition: transform .18s ease; }
.nav-scan image { width: 48rpx; height: 48rpx; border-radius: 8rpx; }
.nav-scan--pressed { transform: scale(.92); }
.task-toolbar { display: grid; grid-template-columns: 78rpx minmax(0, 1fr) auto; gap: 12rpx; padding: 18rpx 22rpx 12rpx; background: #fff; }
.task-map-entry { height: 72rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #dce8ec; border-radius: 8px; background: #fff; box-sizing: border-box; transition: transform .16s ease, background-color .16s ease; }
.task-map-entry image { width: 34rpx; height: 34rpx; }
.task-map-entry text { margin-top: 1rpx; color: #087da8; font-size: 16rpx; font-weight: 650; line-height: 19rpx; white-space: nowrap; }
.task-map-entry--pressed { transform: scale(.94); background: #eef8fb; }
.search-box { height: 72rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr) 48rpx; align-items: center; padding: 0 10rpx; border: 1px solid #dce8ec; border-radius: 8px; background: #f3f7f9; box-sizing: border-box; }
.search-box input { width: 100%; height: 100%; font-size: 25rpx; }
.search-box__icon { color: #63808b; font-size: 35rpx; text-align: center; }
.search-box__clear { width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; color: #82979f; font-size: 34rpx; }
.filter-button { position: relative; height: 72rpx; min-width: 118rpx; display: flex; align-items: center; justify-content: center; gap: 7rpx; border: 1px solid #dce8ec; border-radius: 8px; color: #496873; background: #fff; font-size: 24rpx; }
.filter-button.active { color: #087da8; border-color: rgba(8,125,168,.36); background: #edf8fb; }
.filter-button__icon { font-size: 31rpx; transform: rotate(90deg); }
.filter-button__badge { position: absolute; top: -10rpx; right: -8rpx; min-width: 30rpx; height: 30rpx; padding: 0 5rpx; border: 2px solid #fff; border-radius: 16rpx; color: #fff; background: #e54625; font-size: 18rpx; line-height: 30rpx; text-align: center; }
.filter-button--pressed { transform: scale(.97); }
.state-scroll { width: 100%; background: #fff; white-space: nowrap; }
.state-row { display: inline-flex; gap: 12rpx; padding: 8rpx 22rpx 18rpx; }
.state-card { width: 128rpx; height: 96rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e0e9ec; border-radius: 8px; background: #fff; transition: transform .18s ease, border-color .18s ease, background-color .18s ease; }
.state-card__count { color: #1f4654; font-size: 29rpx; font-weight: 750; }
.state-card__label { margin-top: 5rpx; color: #718891; font-size: 20rpx; }
.state-card.active { border-color: #087da8; background: #eef8fb; transform: translateY(-2rpx); }
.state-card.active .state-card__label, .state-card.active .state-card__count { color: #087da8; }
.state-card.is-success.active { border-color: #17825f; background: #ecf8f3; }
.state-card.is-success.active text { color: #17825f; }
.state-card.is-danger.active { border-color: #c34c47; background: #fff2f1; }
.state-card.is-danger.active text { color: #c34c47; }
.quick-filter { display: grid; grid-template-columns: minmax(0,1fr); align-items: center; border-top: 1px solid #edf2f4; border-bottom: 1px solid #e7eef1; background: #fff; }
.period-scroll { min-width: 0; white-space: nowrap; }
.period-row { display: inline-flex; gap: 10rpx; padding: 14rpx 12rpx 14rpx 22rpx; }
.period-chip, .type-chip { flex: none; height: 52rpx; padding: 0 20rpx; border-radius: 6px; color: #5e7882; background: #f0f5f7; font-size: 21rpx; line-height: 52rpx; }
.period-chip { display: flex; align-items: center; gap: 7rpx; line-height: normal; }
.period-chip__count { font-size: 18rpx; opacity: .72; }
.period-chip.active, .type-chip.active { color: #fff; background: #087da8; }
.scope-row { display: flex; gap: 10rpx; padding: 12rpx 22rpx; background: #fff; border-bottom: 1px solid #e7eef1; }
.scope-chip { flex: 1; padding: 12rpx 8rpx; border-radius: 12rpx; background: #f0f5f7; color: #405e69; font-size: 22rpx; text-align: center; }
.scope-chip.active { background: #087da8; color: #fff; font-weight: 700; }
.type-scroll { width: 100%; border-bottom: 1px solid #e7eef1; background: #fff; white-space: nowrap; }
.type-row { display: inline-flex; gap: 10rpx; padding: 12rpx 22rpx; }
.type-chip text { margin-left: 7rpx; opacity: .72; }
.offline-tip { padding: 12rpx 22rpx; color: #7c5b1c; background: #fff8e6; font-size: 21rpx; }
.task-scroll { height: calc(100vh - var(--mci-safe-top) - 448rpx); }
.task-filter-feedback { min-height: 58rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 8rpx 24rpx 0; color: #83969d; font-size: 20rpx; box-sizing: border-box; }
.task-filter-reset { min-width: 138rpx; min-height: 56rpx; display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: #087da8; font-weight: 600; transition: transform .16s ease, opacity .16s ease; }
.task-filter-reset--pressed { opacity: .68; transform: scale(.96); }
.task-filter-reset__icon { position: relative; width: 22rpx; height: 22rpx; flex: none; border: 3rpx solid currentColor; border-left-color: transparent; border-radius: 50%; box-sizing: border-box; }
.task-filter-reset__icon::after { content: ''; position: absolute; left: -5rpx; top: -5rpx; width: 8rpx; height: 8rpx; border-left: 3rpx solid currentColor; border-top: 3rpx solid currentColor; transform: rotate(-18deg); }
.task-list { padding: 18rpx 20rpx 0; }
.task-list-session-item { position: relative; border-radius: 9px; }
.task-list-session-item--focused { padding: 4rpx; background: linear-gradient(135deg,rgba(229,70,37,.2),rgba(8,125,168,.16)); box-shadow: 0 0 0 2rpx rgba(229,70,37,.5),0 10rpx 26rpx rgba(28,76,94,.13); }
.task-focus-label { position: absolute; top: -12rpx; right: 18rpx; z-index: 2; padding: 7rpx 15rpx; border-radius: 16rpx; color: #fff; background: #e54625; box-shadow: 0 5rpx 12rpx rgba(197,57,31,.24); font-size: 19rpx; font-weight: 700; line-height: 1; }
.task-card { margin-bottom: 16rpx; border: 1px solid #e2eaed; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 5rpx 16rpx rgba(20,65,84,.055); transition: transform .16s ease; }
.task-card--pressed { transform: scale(.988); }
.task-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; padding: 22rpx 22rpx 16rpx; }
.task-card__identity { display: flex; min-width: 0; gap: 14rpx; }
.task-card__type { flex: none; width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #fff; background: linear-gradient(145deg,#087da8,#18a6b8); font-size: 22rpx; font-weight: 700; }
.task-card__heading { min-width: 0; }
.task-card__title, .task-card__no { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-card__title { color: #17333e; font-size: 28rpx; font-weight: 700; }
.task-card__no { margin-top: 7rpx; color: #81939a; font-size: 20rpx; }
.status-pill { flex: none; max-width: 160rpx; padding: 7rpx 12rpx; border-radius: 6px; color: #7a5b18; background: #fff5da; font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-pill.is-progress { color: #09688a; background: #eaf7fb; }
.status-pill.is-review { color: #7251a2; background: #f3eefb; }
.status-pill.is-success { color: #147351; background: #e9f7f1; }
.status-pill.is-danger { color: #ac413e; background: #fff0ef; }
.task-card__content { padding: 0 22rpx 17rpx; }
.task-card__summary { display: -webkit-box; margin-bottom: 14rpx; overflow: hidden; color: #405f69; font-size: 24rpx; line-height: 1.55; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.task-card__line { display: grid; grid-template-columns: 34rpx 116rpx minmax(0,1fr); align-items: start; min-height: 43rpx; }
.line-icon { color: #4c899f; font-size: 22rpx; }
.line-label { color: #80929a; font-size: 21rpx; }
.line-value { min-width: 0; overflow: hidden; color: #294b57; text-overflow: ellipsis; white-space: nowrap; font-size: 22rpx; }
.task-card__bottom { min-height: 70rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 20rpx 0 22rpx; border-top: 1px solid #edf2f4; background: #fbfcfd; }
.task-card__tag { padding: 5rpx 11rpx; border-radius: 5px; color: #765322; background: #fff5e6; font-size: 19rpx; }
.task-card__actions { display: flex; align-items: center; color: #087da8; }
.icon-action { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; margin-right: 6rpx; color: #087da8; font-size: 28rpx; }
.task-card__detail { font-size: 22rpx; font-weight: 600; }
.task-card__arrow { margin-left: 5rpx; font-size: 34rpx; }
.load-state { height: 90rpx; color: #8a9ba2; font-size: 21rpx; line-height: 90rpx; text-align: center; }
.empty-state { min-height: 56vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50rpx; box-sizing: border-box; }
.empty-state image { width: 110rpx; height: 110rpx; opacity: .48; }
.empty-state__title { margin-top: 22rpx; color: #345661; font-size: 28rpx; font-weight: 650; }
.empty-state__desc { margin-top: 9rpx; color: #85969d; font-size: 22rpx; }
.empty-state__button { margin-top: 28rpx; padding: 16rpx 34rpx; border: 1px solid #8ac3d7; border-radius: 6px; color: #087da8; font-size: 23rpx; }
.safe-space { height: calc(130rpx + var(--mci-safe-bottom)); }
.floating-add { position: fixed; right: max(28rpx,var(--mci-safe-right)); bottom: calc(32rpx + var(--mci-safe-bottom)); z-index: 12; width: 92rpx; height: 92rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: #e54625; box-shadow: 0 10rpx 24rpx rgba(197,57,31,.28); font-size: 48rpx; transition: transform .18s ease; }
.floating-add--pressed { transform: scale(.92); }
.sheet-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(10,31,39,.48); }
.filter-sheet { width: 100%; max-height: 84vh; padding: 12rpx 26rpx calc(22rpx + var(--mci-safe-bottom)); border-radius: 8px 8px 0 0; overflow-y: auto; background: #fff; box-sizing: border-box; animation: sheetUp .22s ease-out both; }
.sheet-handle { width: 72rpx; height: 8rpx; margin: 0 auto 19rpx; border-radius: 4rpx; background: #d7e1e5; }
.sheet-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 25rpx; }
.sheet-title, .sheet-subtitle { display: block; }
.sheet-title { color: #17333e; font-size: 31rpx; font-weight: 750; }
.sheet-subtitle { margin-top: 5rpx; color: #80929a; font-size: 21rpx; }
.sheet-close { width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #6d828b; background: #f1f5f7; font-size: 38rpx; }
.filter-group { margin-bottom: 22rpx; }
.filter-label { display: block; margin-bottom: 10rpx; color: #405f69; font-size: 23rpx; font-weight: 650; }
.picker-control, .filter-input { height: 76rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 20rpx; border: 1px solid #dbe6ea; border-radius: 7px; color: #294b57; background: #f7fafb; box-sizing: border-box; font-size: 24rpx; }
.filter-input { width: 100%; }
.date-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.sort-tabs { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #dbe6ea; border-radius: 7px; overflow: hidden; }
.sort-tabs view { height: 70rpx; color: #657d86; background: #f7fafb; font-size: 23rpx; line-height: 70rpx; text-align: center; }
.sort-tabs view.active { color: #fff; background: #087da8; }
.sheet-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 14rpx; margin-top: 30rpx; }
.sheet-button { height: 80rpx; border-radius: 7px; font-size: 25rpx; font-weight: 650; line-height: 80rpx; text-align: center; }
.sheet-button--plain { color: #486671; background: #edf3f5; }
.sheet-button--primary { color: #fff; background: #e54625; }
@keyframes sheetUp { from { transform: translateY(100%); opacity: .7; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .task-card, .filter-sheet, .floating-add, .task-map-entry { animation: none; transition: none; } }
</style>
