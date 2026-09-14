<template>
  <mci-page-shell class="devices-page" :style="mciTokenStyle" title="任务设备" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="6" />

    <view v-else-if="error" class="error-state">
      <image src="/static/xjy/business/shebei.png" mode="aspectFit" />
      <text>任务设备加载失败</text>
      <text>{{ error }}</text>
      <view hover-class="retry-button--pressed" @tap="load(true)"><text>重新加载</text></view>
    </view>

    <template v-else>
      <view class="summary-band">
        <view class="map-entry" hover-class="map-entry--pressed" @tap="openMap"><image src="/static/xjy/business/eqpMap.png" mode="aspectFit" /><text>设备地图</text></view>
        <view class="summary-filter" :class="{ active: serviceStatus === 'all' }" hover-class="summary-filter--pressed" @tap="changeServiceStatus('all')"><text>{{ totalCount }}</text><text>设备总数</text></view>
        <view class="summary-filter summary-filter--complete" :class="{ active: serviceStatus === 'completed' }" hover-class="summary-filter--pressed" @tap="changeServiceStatus('completed')"><text>{{ completedCount }}</text><text>已完成</text></view>
        <view class="summary-filter summary-filter--unfinished" :class="{ active: serviceStatus === 'unfinished' }" hover-class="summary-filter--pressed" @tap="changeServiceStatus('unfinished')"><text>{{ unfinishedCount }}</text><text>未完成</text></view>
      </view>

      <scroll-view class="device-scroll" scroll-y :scroll-top="mciScrollCommand" :refresher-enabled="true" :refresher-triggered="refreshing" :lower-threshold="120" @scroll="handleMciListScroll" @refresherrefresh="refresh" @scrolltolower="loadMore">
        <view class="search-band">
          <view class="search-row">
            <view class="search-box">
              <view class="search-icon"></view>
              <input
                v-model="keyword"
                confirm-type="search"
                maxlength="100"
                placeholder="搜索设备名称、型号、编号、安装位置"
                @input="queueSearch"
                @confirm="runSearch"
              />
              <view v-if="keyword" class="search-clear" hover-class="search-clear--pressed" @tap="clearSearch"><text>×</text></view>
            </view>
            <view v-if="filterFields.length" class="filter-button" :class="{ active: activeFilterCount > 0 }" hover-class="filter-button--pressed" @tap="openAdvancedFilters">
              <view class="filter-button__icon" aria-hidden="true"><view></view><view></view><view></view></view>
              <text>筛选</text><text v-if="activeFilterCount" class="filter-button__count">{{ activeFilterCount }}</text>
            </view>
          </view>
          <view v-if="hasListFilters" class="search-feedback">
            <text>{{ searching ? '正在筛选设备...' : `当前条件找到 ${count} 台设备` }}</text>
            <text @tap="resetAllFilters">重置筛选</text>
          </view>
        </view>
        <view v-if="devices.length" class="device-list">
          <view v-for="device in devices" :id="deviceAnchorId(device)" :key="device.Id" class="device-card device-list-session-item" hover-class="device-card--pressed" @tap="openDevice(device)">
            <image src="/static/xjy/business/shebei.png" mode="aspectFit" />
            <view class="device-copy">
              <text class="device-name">{{ device.name }}</text>
              <text class="device-meta">{{ [device.model, device.code].filter(Boolean).join(' · ') || '暂无型号与设备编号' }}</text>
              <text class="device-position">安装位置：{{ device.position || '暂未维护' }}</text>
            </view>
            <view class="device-side"><text class="device-status" :class="{ complete: device.status === '已完成' }">{{ device.status }}</text><text class="device-arrow">›</text></view>
          </view>
          <view class="list-end"><text v-if="loadingMore">正在加载更多...</text><text v-else-if="finished">已展示全部 {{ count }} 台任务设备</text><text v-else>上拉加载更多</text></view>
        </view>
        <view v-else-if="hasListFilters" class="empty-state"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>没有符合条件的任务设备</text><text>请调整服务状态、搜索词或筛选字段后重试</text><view class="empty-state__action" hover-class="empty-state__action--pressed" @tap="resetAllFilters"><text>重置筛选</text></view></view>
        <view v-else class="empty-state"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>当前任务尚未关联设备</text><text>添加后可在这里逐台查看和处理</text></view>
        <view class="safe-space"></view>
      </scroll-view>

      <view v-if="canManageDevices" class="bottom-bar">
        <view class="add-button" hover-class="add-button--pressed" @tap="addDevices"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>添加售后设备</text></view>
      </view>

      <root-portal v-if="filterOpen">
        <view class="filter-mask" @tap="closeAdvancedFilters" @touchmove.stop.prevent="noop">
          <view class="filter-sheet" @tap.stop @touchmove.stop>
            <view class="filter-sheet__handle"></view>
            <view class="filter-sheet__head">
              <view><text>设备筛选</text><text>与后台“售后订单设备列表”筛选配置保持一致</text></view>
              <view class="filter-sheet__close" hover-class="filter-sheet__close--pressed" @tap="closeAdvancedFilters"><text>×</text></view>
            </view>
            <scroll-view class="filter-sheet__scroll" scroll-y :show-scrollbar="false">
              <view v-for="field in filterFields" :key="field.key" class="filter-field">
                <view class="filter-field__head"><text>{{ field.label }}</text><text v-if="field.hint">{{ field.hint }}</text></view>
                <mci-list-filter-field
                  :field="field"
                  v-model="filterDraft[field.key]"
                  :menu-id="deviceMenuId"
                  :module-engine-key="deviceModuleEngineKey"
                  :table-child-auth="tableChildAuth"
                  :form-data="filterFormData"
                />
              </view>
              <view class="filter-sheet__safe"></view>
            </scroll-view>
            <view class="filter-sheet__footer">
              <view class="filter-sheet__reset" hover-class="filter-sheet__button--pressed" @tap="resetAdvancedFilters"><text>重置</text></view>
              <view class="filter-sheet__apply" hover-class="filter-sheet__button--pressed" @tap="applyAdvancedFilters"><text>查看结果</text></view>
            </view>
          </view>
        </view>
      </root-portal>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import { listReturnMixin } from '@/platform/list-return.js'
import { buildListFilterWhere, hasListFilterValue, validateListFilters } from '@/platform/list-filter-fields.mjs'
import { TASK_DEVICE_FALLBACK_FILTER_FIELDS } from '@/tenants/xjy/task-device-filters.mjs'
import { loadTask, loadTaskDeviceFilterConfig, loadTaskDeviceSummary, loadTaskDevicesPage } from '@/utils/xjy-task.js'
import MciListFilterField from '@/components/mci-list-filter-field/mci-list-filter-field.vue'

export default {
  components: { MciListFilterField },
  mixins: [themeMixin, listReturnMixin],
  data() {
    return {
      taskId: '',
      taskType: '',
      task: {},
      devices: [],
      count: 0,
      totalCount: 0,
      completedCount: 0,
      pageIndex: 1,
      pageSize: 20,
      currentUser: {},
      loading: true,
      loadingMore: false,
      refreshing: false,
      finished: false,
      loadRequestId: 0,
      searchRequestId: 0,
      searchTimer: null,
      keyword: '',
      searching: false,
      serviceStatus: 'all',
      filterFields: TASK_DEVICE_FALLBACK_FILTER_FIELDS.map((field) => ({ ...field })),
      filterValues: {},
      filterDraft: {},
      filterOpen: false,
      deviceMenuId: '',
      deviceModuleEngineKey: '',
      tableChildAuth: null,
      error: '',
      deviceListSessionKey: ''
    }
  },
  computed: {
    unfinishedCount() { return Math.max(0, this.totalCount - this.completedCount) },
    activeFilterCount() { return this.filterFields.reduce((count, field) => count + (hasListFilterValue(this.filterValues[field.key]) ? 1 : 0), 0) },
    hasListFilters() { return Boolean(String(this.keyword || '').trim() || this.activeFilterCount || this.serviceStatus !== 'all') },
    filterFormData() { return { ShouhouDDID: this.taskId } },
    isOwner() { return !!(this.currentUser.Id && String(this.currentUser.Id) === String(this.task.serviceUserId)) },
    isAdmin() { return Number(this.currentUser.Level || 0) >= 999 || /管理员/.test(this.currentUser.RoleName || '') },
    canManageDevices() { return this.task.state === '待服务' && (this.isOwner || this.isAdmin) }
  },
  onLoad(options) {
    this.taskId = decodeURIComponent(options.taskId || '')
    this.taskType = decodeURIComponent(options.taskType || '')
    this.currentUser = getUser() || {}
    this.deviceListSessionKey = [
      'task-devices:v2',
      this.currentUser.Id || this.currentUser.Account || 'guest',
      this.taskId || 'missing-task'
    ].join('|')
    const restored = this.restoreDeviceListSession()
    this.bootstrap(restored)
  },
  onBackPress() {
    if (!this.filterOpen) return false
    this.closeAdvancedFilters()
    return true
  },
  onUnload() { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchRequestId += 1 },
  methods: {
    shouldMciRetainListSession() { return !!this.taskId && !!this.deviceListSessionKey },
    getMciListSnapshotKey() { return this.deviceListSessionKey },
    getMciListAnchorConfig() { return { container: '.device-scroll', items: '.device-list-session-item' } },
    deviceAnchorId(device = {}) { return `mci-device-${String(device.Id || device.id || '').replace(/[^A-Za-z0-9_-]/g, '')}` },
    getMciListSnapshot() {
      return {
        taskType: this.taskType,
        task: { ...this.task },
        devices: [...this.devices],
        count: this.count,
        totalCount: this.totalCount,
        completedCount: this.completedCount,
        pageIndex: this.pageIndex,
        keyword: this.keyword,
        serviceStatus: this.serviceStatus,
        filterValues: JSON.parse(JSON.stringify(this.filterValues || {})),
        finished: this.finished
      }
    },
    restoreDeviceListSession() {
      const snapshot = this.mciReadRetainedListSnapshot()
      const payload = snapshot && snapshot.payload
      if (!payload || !Array.isArray(payload.devices)) return null
      const fields = ['taskType', 'task', 'devices', 'count', 'totalCount', 'completedCount', 'pageIndex', 'keyword', 'serviceStatus', 'filterValues', 'finished']
      fields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) this[field] = payload[field]
      })
      this.loading = false
      this.loadingMore = false
      this.refreshing = false
      this.error = ''
      this.mciApplyListSnapshotPosition(snapshot)
      return snapshot
    },
    async bootstrap(restored) {
      if (!this.taskId) {
        await this.load()
        return
      }
      await this.loadFilterConfig(false)
      if (!restored) await this.load()
      else await this.refreshRestoredDeviceList(restored)
    },
    async loadFilterConfig(refresh = false) {
      try {
        const config = await loadTaskDeviceFilterConfig(this.taskId, refresh)
        this.filterFields = config.filterFields.length
          ? config.filterFields
          : TASK_DEVICE_FALLBACK_FILTER_FIELDS.map((field) => ({ ...field }))
        this.deviceMenuId = config.menuId || ''
        this.deviceModuleEngineKey = config.moduleEngineKey || ''
        this.tableChildAuth = config.tableChildAuth || null
        // 后台移除筛选字段后同步清理旧会话值，避免继续发送不可见条件。
        const availableKeys = new Set(this.filterFields.map((field) => field.key))
        this.filterValues = Object.fromEntries(Object.entries(this.filterValues || {}).filter(([key]) => availableKeys.has(key)))
      } catch (error) {
        // 元数据暂时不可用时保留四个基础筛选，列表读取仍可继续。
        if (!this.filterFields.length) this.filterFields = TASK_DEVICE_FALLBACK_FILTER_FIELDS.map((field) => ({ ...field }))
      }
    },
    buildFilterWhere() { return buildListFilterWhere(this.filterFields, this.filterValues, this.currentUser) },
    summaryOptions(refresh = false) {
      return { refresh, menuId: this.deviceMenuId, tableChildAuth: this.tableChildAuth }
    },
    async loadDeviceRange(targetCount, refresh = false) {
      const expected = Math.max(this.pageSize, Math.ceil(Number(targetCount || 0) / this.pageSize) * this.pageSize)
      const rangePageSize = Math.min(300, expected)
      const rows = []
      let count = 0
      let rangePageIndex = 1
      while (rows.length < expected) {
        const page = await loadTaskDevicesPage(this.taskId, {
          pageIndex: rangePageIndex,
          pageSize: rangePageSize,
          keyword: this.keyword,
          extraWhere: this.buildFilterWhere(),
          serviceStatus: this.serviceStatus,
          menuId: this.deviceMenuId,
          tableChildAuth: this.tableChildAuth,
          refresh
        })
        rows.push(...page.rows)
        count = page.count
        if (!page.rows.length || rows.length >= count || page.rows.length < rangePageSize) break
        rangePageIndex += 1
      }
      return { rows: rows.slice(0, expected), count }
    },
    async refreshRestoredDeviceList(snapshot) {
      if (!this.taskId) return
      const requestId = ++this.loadRequestId
      const loadedCount = Math.max(this.pageSize, this.devices.length)
      try {
        const [taskResult, page, summary] = await Promise.all([
          loadTask(this.taskId, true),
          this.loadDeviceRange(loadedCount, true),
          loadTaskDeviceSummary(this.taskId, this.summaryOptions(true))
        ])
        if (requestId !== this.loadRequestId) return
        this.task = taskResult.task
        this.devices = page.rows
        this.count = page.count
        this.totalCount = summary.total
        this.completedCount = summary.completed
        this.finished = this.devices.length >= this.count
        this.pageIndex = Math.ceil(this.devices.length / this.pageSize) + 1
        this.$nextTick(() => this.mciRestoreListAnchor(snapshot.anchor, snapshot.scrollTop))
      } catch (error) {
        // 后台校验失败时继续展示会话快照，避免用户丢失当前位置。
      }
    },
    async load(reset = true, showLoading = true) {
      if (!this.taskId) { this.error = '缺少任务编号'; this.loading = false; return }
      if (!reset && (this.loadingMore || this.finished)) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.finished = false }
      if (reset) this.mciRestoreListPosition(0)
      if (showLoading) this.loading = true
      else if (!reset) this.loadingMore = true
      this.error = ''
      try {
        const [taskResult, page, summary] = await Promise.all([
          reset ? loadTask(this.taskId, true) : Promise.resolve({ task: this.task }),
          loadTaskDevicesPage(this.taskId, {
            pageIndex: this.pageIndex,
            pageSize: this.pageSize,
            keyword: this.keyword,
            extraWhere: this.buildFilterWhere(),
            serviceStatus: this.serviceStatus,
            menuId: this.deviceMenuId,
            tableChildAuth: this.tableChildAuth,
            refresh: reset
          }),
          reset ? loadTaskDeviceSummary(this.taskId, this.summaryOptions(true)) : Promise.resolve({ total: this.totalCount, completed: this.completedCount })
        ])
        if (requestId !== this.loadRequestId) return
        this.task = taskResult.task
        this.devices = reset ? page.rows : [...this.devices, ...page.rows]
        this.count = page.count
        this.totalCount = summary.total
        this.completedCount = summary.completed
        this.finished = this.devices.length >= this.count || page.rows.length < this.pageSize
        if (!this.finished) this.pageIndex += 1
      } catch (error) {
        if (requestId === this.loadRequestId) {
          const message = error.message || '任务设备加载失败'
          if (reset) this.error = message
          else uni.showToast({ title: message, icon: 'none' })
        }
      } finally {
        if (requestId === this.loadRequestId) {
          this.loading = false
          this.loadingMore = false
          this.refreshing = false
        }
      }
    },
    queueSearch(event) {
      if (event && event.detail) this.keyword = event.detail.value || ''
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searching = true
      this.searchTimer = setTimeout(() => this.runSearch(), 300)
    },
    async runSearch() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = null
      const requestId = ++this.searchRequestId
      this.searching = true
      await this.load(true, false)
      if (requestId === this.searchRequestId) this.searching = false
    },
    clearSearch() {
      if (!this.keyword && !this.searching) return
      this.keyword = ''
      this.runSearch()
    },
    async changeServiceStatus(status) {
      if (this.serviceStatus === status) return
      this.serviceStatus = status
      await this.runSearch()
    },
    openAdvancedFilters() {
      this.filterDraft = JSON.parse(JSON.stringify(this.filterValues || {}))
      this.filterOpen = true
    },
    closeAdvancedFilters() { this.filterOpen = false },
    resetAdvancedFilters() { this.filterDraft = {} },
    applyAdvancedFilters() {
      const message = validateListFilters(this.filterFields, this.filterDraft)
      if (message) {
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.filterValues = JSON.parse(JSON.stringify(this.filterDraft || {}))
      this.filterOpen = false
      this.runSearch()
    },
    resetAllFilters() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.keyword = ''
      this.serviceStatus = 'all'
      this.filterValues = {}
      this.filterDraft = {}
      this.filterOpen = false
      this.runSearch()
    },
    noop() {},
    async refresh() {
      this.refreshing = true
      try {
        await this.loadFilterConfig(true)
        await this.load(true, false)
      } finally {
        this.refreshing = false
      }
    },
    loadMore() { if (!this.searching) this.load(false, false) },
    async onMciListDetailReturned(scrollTop) {
      const snapshot = {
        anchor: { id: this.mciListAnchorId, offset: this.mciListAnchorOffset },
        scrollTop
      }
      await this.refreshRestoredDeviceList(snapshot)
    },
    openDevice(device) {
      const type = this.taskType || this.task.type || ''
      this.mciNavigateToDetail(`/pages/task/device?id=${encodeURIComponent(device.Id)}&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(type)}`)
    },
    openMap() {
      const type = this.taskType || this.task.type || ''
      const filters = {
        keyword: String(this.keyword || '').trim(),
        serviceStatus: this.serviceStatus
      }
      this.mciNavigateToDetail(`/pages/task/map?mode=device&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(type)}&filters=${encodeURIComponent(JSON.stringify(filters))}`)
    },
    addDevices() {
      this.mciNavigateToDetail(`/pages/task/add-devices?taskId=${encodeURIComponent(this.taskId)}&customerId=${encodeURIComponent(this.task.KehuID || '')}`)
    },
    goBack() { uni.navigateBack({ fail: () => uni.redirectTo({ url: `/pages/task/detail?id=${encodeURIComponent(this.taskId)}` }) }) }
  }
}
</script>

<style scoped>
.devices-page { height: 100vh; overflow: hidden; }
.summary-band { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); padding: 20rpx 12rpx; border-bottom: 14rpx solid #edf3f5; background: #fff; }
.summary-band view { min-width: 0; padding: 5rpx 12rpx; border-right: 1px solid #e2eaed; text-align: center; }.summary-band view:last-child { border-right: 0; }
.summary-band text { display: block; }.summary-band text:first-child { color: #174b5d; font-size: 31rpx; font-weight: 750; }.summary-band text:last-child { margin-top: 5rpx; color: #82949b; font-size: 20rpx; }
.summary-band .map-entry { transition: transform .16s ease, background .16s ease; }.summary-band .map-entry image { display: block; width: 36rpx; height: 36rpx; margin: 0 auto; }.summary-band .map-entry text { margin-top: 5rpx; color: #087da8; font-size: 20rpx; font-weight: 600; }.map-entry--pressed { transform: scale(.94); background: #eef8fb; }
.summary-band .summary-filter { position: relative; border-radius: 7px; transition: transform .16s ease, background-color .16s ease, box-shadow .16s ease; }
.summary-band .summary-filter.active { background: #edf8fb; box-shadow: inset 0 0 0 1px rgba(8,125,168,.28); }
.summary-band .summary-filter.active text { color: #087da8; }
.summary-band .summary-filter--complete.active { background: #ecf8f3; box-shadow: inset 0 0 0 1px rgba(23,130,95,.28); }
.summary-band .summary-filter--complete.active text { color: #17825f; }
.summary-band .summary-filter--unfinished.active { background: #fff5e8; box-shadow: inset 0 0 0 1px rgba(194,113,26,.28); }
.summary-band .summary-filter--unfinished.active text { color: #a95d12; }
.summary-filter--pressed { transform: scale(.94); }
.device-scroll { height: calc(100vh - var(--mci-safe-top) - 92rpx - 116rpx - var(--mci-safe-bottom)); }
.search-band { padding: 17rpx 20rpx 12rpx; background: #f4f8f9; }.search-row { display: flex; align-items: center; gap: 12rpx; }.search-box { min-width: 0; height: 88rpx; flex: 1; display: flex; align-items: center; gap: 16rpx; padding: 0 14rpx 0 22rpx; border: 1px solid #dbe7ea; border-radius: 9px; background: #fff; box-sizing: border-box; box-shadow: 0 4rpx 12rpx rgba(24,64,78,.04); }.search-icon { position: relative; flex: none; width: 23rpx; height: 23rpx; border: 3rpx solid #789099; border-radius: 50%; box-sizing: border-box; }.search-icon::after { content: ''; position: absolute; right: -10rpx; bottom: -7rpx; width: 12rpx; height: 3rpx; border-radius: 2rpx; background: #789099; transform: rotate(45deg); }.search-box input { min-width: 0; height: 84rpx; flex: 1; color: #294b57; font-size: 23rpx; }.search-clear { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #748b94; background: #edf3f5; font-size: 32rpx; transition: transform .16s ease, background .16s ease; }.search-clear--pressed { transform: scale(.92); background: #e2ecef; }.filter-button { position: relative; flex: none; min-width: 116rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; padding: 0 14rpx; border: 1px solid #dbe7ea; border-radius: 9px; color: #496873; background: #fff; box-sizing: border-box; font-size: 22rpx; transition: transform .16s ease, background-color .16s ease; }.filter-button.active { color: #087da8; border-color: rgba(8,125,168,.36); background: #edf8fb; }.filter-button--pressed { transform: scale(.96); background: #edf6fa; }.filter-button__icon { display: flex; flex-direction: column; align-items: flex-start; gap: 4rpx; width: 24rpx; margin-right: 7rpx; }.filter-button__icon view { height: 3rpx; padding: 0; border: 0; border-radius: 2rpx; background: currentColor; }.filter-button__icon view:nth-child(1) { width: 24rpx; }.filter-button__icon view:nth-child(2) { width: 16rpx; }.filter-button__icon view:nth-child(3) { width: 8rpx; }.filter-button__count { min-width: 28rpx; height: 28rpx; margin-left: 5rpx; padding: 0 4rpx; border-radius: 14rpx; color: #fff; background: #e94b2c; font-size: 18rpx; line-height: 28rpx; text-align: center; }.search-feedback { min-height: 56rpx; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 4rpx; color: #83969d; font-size: 19rpx; }.search-feedback text:last-child { min-width: 100rpx; color: #087da8; text-align: right; }
.device-list { padding: 4rpx 20rpx 0; }
.device-card { min-height: 122rpx; display: grid; grid-template-columns: 54rpx minmax(0,1fr) auto; gap: 14rpx; align-items: center; margin-bottom: 14rpx; padding: 15rpx 16rpx; border: 1px solid #dfe9ec; border-radius: 9px; background: #fff; box-sizing: border-box; box-shadow: 0 5rpx 15rpx rgba(24,64,78,.05); transition: transform .16s ease, background .16s ease; }.device-card--pressed { transform: scale(.988); background: #f0f7f9; }
.device-card > image { width: 48rpx; height: 48rpx; }.device-copy { min-width: 0; }.device-name,.device-meta,.device-position { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.device-name { color: #294b57; font-size: 25rpx; font-weight: 700; }.device-meta { margin-top: 6rpx; color: #70868e; font-size: 20rpx; }.device-position { margin-top: 5rpx; color: #95a4aa; font-size: 19rpx; }
.device-side { display: flex; align-items: center; gap: 10rpx; }.device-status { max-width: 110rpx; padding: 7rpx 10rpx; border-radius: 5px; color: #b36b19; background: #fff1df; font-size: 19rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.device-status.complete { color: #147351; background: #e9f7f1; }.device-arrow { color: #9aabb1; font-size: 33rpx; }
.list-end { height: 76rpx; color: #8a9ba2; font-size: 20rpx; line-height: 76rpx; text-align: center; }.empty-state,.error-state { min-height: 54vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40rpx; text-align: center; }.empty-state image,.error-state image { width: 112rpx; height: 112rpx; opacity: .45; }.empty-state text:nth-child(2),.error-state text:nth-child(2) { margin-top: 20rpx; color: #365762; font-size: 27rpx; font-weight: 700; }.empty-state text:nth-child(3),.error-state text:nth-child(3) { margin-top: 8rpx; color: #8799a0; font-size: 21rpx; line-height: 1.55; }.empty-state__action { min-width: 180rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; margin-top: 25rpx; border-radius: 7px; color: #fff; background: #087da8; font-size: 22rpx; transition: transform .16s ease; }.empty-state__action--pressed { transform: scale(.97); }.error-state > view { margin-top: 25rpx; padding: 15rpx 30rpx; border-radius: 7px; color: #fff; background: #087da8; font-size: 23rpx; transition: transform .16s ease; }.retry-button--pressed { transform: scale(.97); }
.safe-space { height: calc(120rpx + var(--mci-safe-bottom)); }.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 30; padding: 15rpx 22rpx calc(15rpx + var(--mci-safe-bottom)); border-top: 1px solid #e1eaed; background: rgba(255,255,255,.97); }.add-button { height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 12rpx; border-radius: 7px; color: #fff; background: #e54625; font-size: 25rpx; font-weight: 700; transition: transform .16s ease; }.add-button image { width: 32rpx; height: 32rpx; }.add-button--pressed { transform: scale(.985); }
.filter-mask { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-end; background: rgba(10,31,39,.48); }
.filter-sheet { width: 100%; max-width: 430px; height: 78vh; max-height: 980rpx; display: flex; flex-direction: column; margin: 0 auto; padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; overflow: hidden; background: #f7fafb; box-sizing: border-box; animation: filterSheetUp .22s ease-out both; }
.filter-sheet__handle { width: 72rpx; height: 8rpx; flex: none; margin: 14rpx auto 4rpx; border-radius: 4rpx; background: #d2dde1; }
.filter-sheet__head { min-height: 104rpx; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 0 24rpx; }.filter-sheet__head > view:first-child { min-width: 0; }.filter-sheet__head > view:first-child text { display: block; }.filter-sheet__head > view:first-child text:first-child { color: #17343e; font-size: 31rpx; font-weight: 750; }.filter-sheet__head > view:first-child text:last-child { margin-top: 5rpx; overflow: hidden; color: #7f939b; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }.filter-sheet__close { width: 64rpx; height: 64rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #6d838c; background: #edf3f5; font-size: 40rpx; transition: transform .16s ease; }.filter-sheet__close--pressed { transform: scale(.92); }
.filter-sheet__scroll { width: 100%; height: 0; min-height: 0; flex: 1; }.filter-field { margin: 0 24rpx 24rpx; padding: 20rpx; border: 1px solid #e0e9ec; border-radius: 9px; background: #fff; }.filter-field__head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }.filter-field__head text:first-child { color: #405f69; font-size: 24rpx; font-weight: 650; }.filter-field__head text:last-child { color: #84979e; font-size: 20rpx; }.filter-sheet__safe { height: 24rpx; }
.filter-sheet__footer { flex: none; display: grid; grid-template-columns: 1fr 2fr; gap: 14rpx; padding: 16rpx 24rpx; border-top: 1px solid #dfe8eb; background: #fff; }.filter-sheet__footer > view { height: 82rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 26rpx; font-weight: 700; transition: transform .16s ease, opacity .16s ease; }.filter-sheet__reset { color: #526b74; border: 1px solid #d7e2e6; }.filter-sheet__apply { color: #fff; background: linear-gradient(135deg,#087fbd,#15a7a0); }.filter-sheet__button--pressed { transform: scale(.98); opacity: .84; }
@keyframes filterSheetUp { from { opacity: .72; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .device-card,.add-button,.error-state > view,.summary-band .map-entry,.summary-filter,.search-clear,.filter-button,.filter-sheet,.filter-sheet__close,.filter-sheet__footer > view,.empty-state__action { animation: none; transition: none; } }
</style>
