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
        <view><text>{{ totalCount }}</text><text>设备总数</text></view>
        <view><text>{{ completedCount }}</text><text>已完成</text></view>
        <view><text>{{ unfinishedCount }}</text><text>未完成</text></view>
      </view>

      <scroll-view class="device-scroll" scroll-y :refresher-enabled="true" :refresher-triggered="refreshing" :lower-threshold="120" @refresherrefresh="refresh" @scrolltolower="loadMore">
        <view class="search-band">
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
          <view v-if="keyword" class="search-feedback">
            <text>{{ searching ? '正在检索设备...' : `找到 ${count} 台匹配设备` }}</text>
            <text @tap="clearSearch">清除条件</text>
          </view>
        </view>
        <view v-if="devices.length" class="device-list">
          <view v-for="device in devices" :key="device.Id" class="device-card" hover-class="device-card--pressed" @tap="openDevice(device)">
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
        <view v-else-if="keyword" class="empty-state"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>没有匹配的任务设备</text><text>请更换设备名称、型号、编号或安装位置后重试</text><view class="empty-state__action" hover-class="empty-state__action--pressed" @tap="clearSearch"><text>清除搜索</text></view></view>
        <view v-else class="empty-state"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>当前任务尚未关联设备</text><text>添加后可在这里逐台查看和处理</text></view>
        <view class="safe-space"></view>
      </scroll-view>

      <view v-if="canManageDevices" class="bottom-bar">
        <view class="add-button" hover-class="add-button--pressed" @tap="addDevices"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>添加售后设备</text></view>
      </view>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import { loadTask, loadTaskDeviceSummary, loadTaskDevicesPage } from '@/utils/xjy-task.js'

export default {
  mixins: [themeMixin],
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
      error: ''
    }
  },
  computed: {
    unfinishedCount() { return Math.max(0, this.totalCount - this.completedCount) },
    isOwner() { return !!(this.currentUser.Id && String(this.currentUser.Id) === String(this.task.serviceUserId)) },
    isAdmin() { return Number(this.currentUser.Level || 0) >= 999 || /管理员/.test(this.currentUser.RoleName || '') },
    canManageDevices() { return this.task.state === '待服务' && (this.isOwner || this.isAdmin) }
  },
  onLoad(options) {
    this.taskId = decodeURIComponent(options.taskId || '')
    this.taskType = decodeURIComponent(options.taskType || '')
    this.currentUser = getUser() || {}
    this.load()
  },
  onShow() { if (!this.loading && this.task.Id) this.load(true, false) },
  onUnload() { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchRequestId += 1 },
  methods: {
    async load(reset = true, showLoading = true) {
      if (!this.taskId) { this.error = '缺少任务编号'; this.loading = false; return }
      if (!reset && (this.loadingMore || this.finished)) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.finished = false }
      if (showLoading) this.loading = true
      else if (!reset) this.loadingMore = true
      this.error = ''
      try {
        const [taskResult, page, summary] = await Promise.all([
          reset ? loadTask(this.taskId, true) : Promise.resolve({ task: this.task }),
          loadTaskDevicesPage(this.taskId, { pageIndex: this.pageIndex, pageSize: this.pageSize, keyword: this.keyword, refresh: reset }),
          reset ? loadTaskDeviceSummary(this.taskId, true) : Promise.resolve({ completed: this.completedCount })
        ])
        if (requestId !== this.loadRequestId) return
        this.task = taskResult.task
        this.devices = reset ? page.rows : [...this.devices, ...page.rows]
        this.count = page.count
        if (!String(this.keyword || '').trim()) this.totalCount = page.count
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
    async refresh() { this.refreshing = true; await this.load(true, false) },
    loadMore() { if (!this.searching) this.load(false, false) },
    openDevice(device) {
      const type = this.taskType || this.task.type || ''
      uni.navigateTo({ url: `/pages/task/device?id=${encodeURIComponent(device.Id)}&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(type)}` })
    },
    openMap() {
      const type = this.taskType || this.task.type || ''
      const filters = { keyword: String(this.keyword || '').trim() }
      uni.navigateTo({ url: `/pages/task/map?mode=device&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(type)}&filters=${encodeURIComponent(JSON.stringify(filters))}` })
    },
    addDevices() {
      uni.navigateTo({ url: `/pages/task/add-devices?taskId=${encodeURIComponent(this.taskId)}&customerId=${encodeURIComponent(this.task.KehuID || '')}` })
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
.device-scroll { height: calc(100vh - var(--mci-safe-top) - 92rpx - 116rpx - var(--mci-safe-bottom)); }
.search-band { padding: 17rpx 20rpx 12rpx; background: #f4f8f9; }.search-box { height: 88rpx; display: flex; align-items: center; gap: 16rpx; padding: 0 14rpx 0 22rpx; border: 1px solid #dbe7ea; border-radius: 9px; background: #fff; box-sizing: border-box; box-shadow: 0 4rpx 12rpx rgba(24,64,78,.04); }.search-icon { position: relative; flex: none; width: 23rpx; height: 23rpx; border: 3rpx solid #789099; border-radius: 50%; box-sizing: border-box; }.search-icon::after { content: ''; position: absolute; right: -10rpx; bottom: -7rpx; width: 12rpx; height: 3rpx; border-radius: 2rpx; background: #789099; transform: rotate(45deg); }.search-box input { min-width: 0; height: 84rpx; flex: 1; color: #294b57; font-size: 23rpx; }.search-clear { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #748b94; background: #edf3f5; font-size: 32rpx; transition: transform .16s ease, background .16s ease; }.search-clear--pressed { transform: scale(.92); background: #e2ecef; }.search-feedback { min-height: 56rpx; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 4rpx; color: #83969d; font-size: 19rpx; }.search-feedback text:last-child { min-width: 100rpx; color: #087da8; text-align: right; }
.device-list { padding: 4rpx 20rpx 0; }
.device-card { min-height: 122rpx; display: grid; grid-template-columns: 54rpx minmax(0,1fr) auto; gap: 14rpx; align-items: center; margin-bottom: 14rpx; padding: 15rpx 16rpx; border: 1px solid #dfe9ec; border-radius: 9px; background: #fff; box-sizing: border-box; box-shadow: 0 5rpx 15rpx rgba(24,64,78,.05); transition: transform .16s ease, background .16s ease; }.device-card--pressed { transform: scale(.988); background: #f0f7f9; }
.device-card > image { width: 48rpx; height: 48rpx; }.device-copy { min-width: 0; }.device-name,.device-meta,.device-position { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.device-name { color: #294b57; font-size: 25rpx; font-weight: 700; }.device-meta { margin-top: 6rpx; color: #70868e; font-size: 20rpx; }.device-position { margin-top: 5rpx; color: #95a4aa; font-size: 19rpx; }
.device-side { display: flex; align-items: center; gap: 10rpx; }.device-status { max-width: 110rpx; padding: 7rpx 10rpx; border-radius: 5px; color: #b36b19; background: #fff1df; font-size: 19rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.device-status.complete { color: #147351; background: #e9f7f1; }.device-arrow { color: #9aabb1; font-size: 33rpx; }
.list-end { height: 76rpx; color: #8a9ba2; font-size: 20rpx; line-height: 76rpx; text-align: center; }.empty-state,.error-state { min-height: 54vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40rpx; text-align: center; }.empty-state image,.error-state image { width: 112rpx; height: 112rpx; opacity: .45; }.empty-state text:nth-child(2),.error-state text:nth-child(2) { margin-top: 20rpx; color: #365762; font-size: 27rpx; font-weight: 700; }.empty-state text:nth-child(3),.error-state text:nth-child(3) { margin-top: 8rpx; color: #8799a0; font-size: 21rpx; line-height: 1.55; }.empty-state__action { min-width: 180rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; margin-top: 25rpx; border-radius: 7px; color: #fff; background: #087da8; font-size: 22rpx; transition: transform .16s ease; }.empty-state__action--pressed { transform: scale(.97); }.error-state > view { margin-top: 25rpx; padding: 15rpx 30rpx; border-radius: 7px; color: #fff; background: #087da8; font-size: 23rpx; transition: transform .16s ease; }.retry-button--pressed { transform: scale(.97); }
.safe-space { height: calc(120rpx + var(--mci-safe-bottom)); }.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 30; padding: 15rpx 22rpx calc(15rpx + var(--mci-safe-bottom)); border-top: 1px solid #e1eaed; background: rgba(255,255,255,.97); }.add-button { height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 12rpx; border-radius: 7px; color: #fff; background: #e54625; font-size: 25rpx; font-weight: 700; transition: transform .16s ease; }.add-button image { width: 32rpx; height: 32rpx; }.add-button--pressed { transform: scale(.985); }
@media (prefers-reduced-motion: reduce) { .device-card,.add-button,.error-state > view,.summary-band .map-entry,.search-clear,.empty-state__action { transition: none; } }
</style>
