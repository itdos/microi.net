<template>
  <mci-page-shell class="task-page" :style="mciTokenStyle" title="售后任务" subtitle="接单、服务与验收全流程" @back="goBack">
    <template #right>
      <view class="nav-scan" hover-class="nav-scan--pressed" @tap="scan"><image :src="xjyAssets.scan" mode="aspectFit" /></view>
    </template>

    <view class="task-toolbar">
      <view class="search-box">
        <text class="search-box__icon">⌕</text>
        <input v-model="keyword" confirm-type="search" placeholder="客户、任务编号、类型或服务人员" @confirm="search" />
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

    <view class="quick-filter">
      <scroll-view class="period-scroll" scroll-x :show-scrollbar="false">
        <view class="period-row">
          <view v-for="item in periods" :key="item.value" class="period-chip" :class="{ active: period === item.value }" @tap="selectPeriod(item.value)"><text>{{ item.label }}</text><text class="period-chip__count">{{ periodCount(item) }}</text></view>
        </view>
      </scroll-view>
      <view class="mine-switch" @tap="toggleMine">
        <view class="mine-switch__track" :class="{ active: mineOnly }"><view class="mine-switch__thumb"></view></view>
        <text>只看我的</text>
      </view>
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
      <mci-skeleton v-if="loading && pageIndex === 1" type="list" :rows="6" />

      <view v-else-if="rows.length" class="task-list">
        <mci-task-card v-for="(item, index) in rows" :key="item.Id || index"
          :item="taskCardItem(item)" :index="index"
          :state-class="taskStateClass(item.state)" @open="openTask" @phone="callPhone" />
        <view class="load-state"><text v-if="loading">正在加载...</text><text v-else-if="finished">共 {{ count }} 个任务，已全部加载</text><text v-else>上拉加载更多</text></view>
      </view>

      <view v-else class="empty-state">
        <image src="/static/xjy/repair/renwu.png" mode="aspectFit" />
        <text class="empty-state__title">当前条件下没有任务</text>
        <text class="empty-state__desc">可切换状态、时间或关闭“只看我的”</text>
        <view class="empty-state__button" @tap="resetFilters"><text>重置筛选</text></view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>

    <view class="floating-add" hover-class="floating-add--pressed" @tap="addTask"><text>＋</text></view>

    <view v-if="filterVisible" class="sheet-mask" @tap="filterVisible = false">
      <view class="filter-sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-heading"><view><text class="sheet-title">更多筛选</text><text class="sheet-subtitle">筛选条件会自动保留</text></view><view class="sheet-close" @tap="filterVisible = false"><text>×</text></view></view>

        <view class="filter-group">
          <text class="filter-label">时间口径</text>
          <picker :range="dateFields" range-key="label" :value="dateFieldIndex" @change="dateField = dateFields[$event.detail.value].value">
            <view class="picker-control"><text>{{ selectedDateFieldLabel }}</text><text>›</text></view>
          </picker>
        </view>

        <view v-if="period === 'custom'" class="filter-group">
          <text class="filter-label">自定义时间范围</text>
          <view class="date-grid">
            <picker mode="date" :value="customStart" @change="customStart = $event.detail.value"><view class="picker-control"><text>{{ customStart || '开始日期' }}</text></view></picker>
            <picker mode="date" :value="customEnd" @change="customEnd = $event.detail.value"><view class="picker-control"><text>{{ customEnd || '结束日期' }}</text></view></picker>
          </view>
        </view>

        <view class="filter-group">
          <text class="filter-label">所在城市</text>
          <input v-model="city" class="filter-input" placeholder="输入省、市或区县" />
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
import { themeMixin } from '@/utils/theme.js'
import { formatDateTime, openForm, scanDevice } from '@/platform/business-runtime.js'
import { listReturnMixin } from '@/platform/list-return.js'
import MciTaskCard from '@/components/mci-task-card/mci-task-card.vue'
import {
  TASK_DATE_FIELDS,
  TASK_PERIODS,
  TASK_STATES,
  loadTaskPeriodCounts,
  loadTaskSummaryCounts,
  loadTaskStateCounts,
  loadTasks,
  taskStateClass
} from '@/utils/xjy-task.js'

const STATE_COUNT_KEYS = {
  '待接单': 'pending', '待服务': 'TodoCount', '待商家验收': 'acceptance',
  '待客户验收': 'cacceptance', '待评价': 'evaluated', '暂停': 'suspend', '已结束': 'FinishCount', '已取消': 'cancel'
}

export default {
  components: { MciTaskCard },
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
      state: '',
      type: '',
      period: 'month',
      dateField: 'YujiSHSJ',
      customStart: '',
      customEnd: '',
      city: '',
      mineOnly: true,
      orderType: 'ASC',
      loading: true,
      refreshing: false,
      finished: false,
      stale: false,
      filterVisible: false,
      taskDataChanged: false,
      changedListener: null,
      loadRequestId: 0
    }
  },
  computed: {
    customRange() {
      return this.customStart && this.customEnd ? [`${this.customStart} 00:00:00`, `${this.customEnd} 23:59:59`] : null
    },
    dateFieldIndex() { return Math.max(0, this.dateFields.findIndex((item) => item.value === this.dateField)) },
    selectedDateFieldLabel() { return (this.dateFields[this.dateFieldIndex] || {}).label || '计划服务时间' },
    typeOptions() { return Object.keys(this.typeCounts).map((name) => ({ name, count: this.typeCounts[name] })).filter((item) => item.name !== '换芯') },
    activeFilterCount() {
      return Number(Boolean(this.city)) + Number(this.dateField !== 'YujiSHSJ') + Number(this.orderType !== 'ASC') + Number(this.period === 'custom')
    }
  },
  onLoad(options) {
    if (options.customerId) this.customerId = decodeURIComponent(options.customerId)
    if (options.state) this.state = decodeURIComponent(options.state)
    this.loadData(true, true)
    this.changedListener = () => { this.taskDataChanged = true }
    uni.$on('xjy:task-changed', this.changedListener)
  },
  onUnload() {
    if (this.changedListener) uni.$off('xjy:task-changed', this.changedListener)
  },
  methods: {
    taskStateClass,
    async loadData(reset = false, refresh = false) {
      if (this.loading && !reset) return
      if (!reset && this.finished) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.finished = false }
      this.loading = true
      const filters = {
        pageIndex: this.pageIndex, pageSize: this.pageSize, keyword: this.keyword.trim(), state: this.state,
        type: this.type, period: this.period, customRange: this.customRange, dateField: this.dateField,
        city: this.city.trim(), mineOnly: this.mineOnly, orderBy: this.dateField, orderType: this.orderType,
        customerId: this.customerId || '', refresh
      }
      try {
        const result = await loadTasks(filters)
        if (requestId !== this.loadRequestId) return
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
    search() { this.loadData(true, true) },
    clearKeyword() { this.keyword = ''; this.loadData(true, true) },
    changeState(value) { if (this.state === value) return; this.state = value; this.loadData(true, true) },
    changeType(value) { if (this.type === value) return; this.type = value; this.loadData(true, true) },
    selectPeriod(value) { this.period = value; if (value === 'custom') this.filterVisible = true; else this.loadData(true, true) },
    toggleMine() { this.mineOnly = !this.mineOnly; this.loadData(true, true) },
    applyFilters() {
      if (this.period === 'custom' && !this.customRange) { uni.showToast({ title: '请选择完整时间范围', icon: 'none' }); return }
      if (this.customStart && this.customEnd && this.customStart > this.customEnd) { uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' }); return }
      this.filterVisible = false
      this.loadData(true, true)
    },
    resetFilters(load = true) {
      this.keyword = ''; this.state = ''; this.type = ''; this.period = 'month'; this.dateField = 'YujiSHSJ'
      this.customStart = ''; this.customEnd = ''; this.city = ''; this.mineOnly = true; this.orderType = 'ASC'
      this.filterVisible = false
      if (load) this.loadData(true, true)
    },
    async refresh() { this.refreshing = true; try { await this.loadData(true, true) } finally { this.refreshing = false } },
    loadMore() { this.loadData(false, false) },
    async onMciListDetailReturned(scrollTop) {
      if (!this.taskDataChanged || !this.rows.length) return
      this.taskDataChanged = false
      const loadedCount = Math.max(this.pageSize, this.rows.length)
      try {
        const filters = {
          pageIndex: 1, pageSize: loadedCount, keyword: this.keyword.trim(), state: this.state,
          type: this.type, period: this.period, customRange: this.customRange, dateField: this.dateField,
          city: this.city.trim(), mineOnly: this.mineOnly, orderBy: this.dateField, orderType: this.orderType,
          customerId: this.customerId || '', refresh: true
        }
        const result = await loadTasks(filters)
        this.rows = result.rows
        this.count = result.count
        this.finished = this.rows.length >= this.count
        this.pageIndex = Math.ceil(this.rows.length / this.pageSize) + 1
        this.loadAuxiliaryCounts(filters, this.loadRequestId)
      } catch (error) {
        console.warn('[TaskList] detail return refresh failed:', error && (error.message || error))
      } finally {
        this.mciScrollCommand = Math.max(0, scrollTop - 1)
        this.$nextTick(() => { this.mciScrollCommand = scrollTop })
      }
    },
    openTask(item) { this.mciNavigateToDetail(`/pages/task/detail?id=${encodeURIComponent(item.Id)}`) },
    addTask() { this.mciMarkDetailReturn(); openForm({ table: 'Diy_ShouhouDD', mode: 'Add', title: '新增售后任务', menuAliases: ['售后订单', '售后任务'] }) },
    scan() { scanDevice() },
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
.task-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12rpx; padding: 18rpx 22rpx 12rpx; background: #fff; }
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
.quick-filter { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; border-top: 1px solid #edf2f4; border-bottom: 1px solid #e7eef1; background: #fff; }
.period-scroll { min-width: 0; white-space: nowrap; }
.period-row { display: inline-flex; gap: 10rpx; padding: 14rpx 12rpx 14rpx 22rpx; }
.period-chip, .type-chip { flex: none; height: 52rpx; padding: 0 20rpx; border-radius: 6px; color: #5e7882; background: #f0f5f7; font-size: 21rpx; line-height: 52rpx; }
.period-chip { display: flex; align-items: center; gap: 7rpx; line-height: normal; }
.period-chip__count { font-size: 18rpx; opacity: .72; }
.period-chip.active, .type-chip.active { color: #fff; background: #087da8; }
.mine-switch { height: 78rpx; display: flex; align-items: center; gap: 9rpx; padding: 0 22rpx 0 14rpx; border-left: 1px solid #e7eef1; color: #405e69; font-size: 21rpx; white-space: nowrap; }
.mine-switch__track { width: 58rpx; height: 32rpx; padding: 3rpx; border-radius: 19rpx; background: #cbd7dc; box-sizing: border-box; transition: background .18s ease; }
.mine-switch__thumb { width: 26rpx; height: 26rpx; border-radius: 50%; background: #fff; box-shadow: 0 2rpx 6rpx rgba(25,57,68,.22); transition: transform .18s ease; }
.mine-switch__track.active { background: #087da8; }
.mine-switch__track.active .mine-switch__thumb { transform: translateX(26rpx); }
.type-scroll { width: 100%; border-bottom: 1px solid #e7eef1; background: #fff; white-space: nowrap; }
.type-row { display: inline-flex; gap: 10rpx; padding: 12rpx 22rpx; }
.type-chip text { margin-left: 7rpx; opacity: .72; }
.offline-tip { padding: 12rpx 22rpx; color: #7c5b1c; background: #fff8e6; font-size: 21rpx; }
.task-scroll { height: calc(100vh - var(--mci-safe-top) - 448rpx); }
.task-list { padding: 18rpx 20rpx 0; }
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
@media (prefers-reduced-motion: reduce) { .task-card, .filter-sheet, .floating-add { animation: none; transition: none; } }
</style>
