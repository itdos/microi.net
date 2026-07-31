<template>
  <mci-page-shell class="select-page" :style="mciTokenStyle" title="选择售后设备" :subtitle="selectedIds.length ? `已选择 ${selectedIds.length} 台` : '从客户设备中选择'" @back="goBack">
    <view class="search-band"><view class="search-box"><text>⌕</text><input v-model="keyword" confirm-type="search" placeholder="搜索设备名称、型号、编号或位置" @input="scheduleSearch" @confirm="search" /><view v-if="keyword" @tap="clearKeyword"><text>×</text></view></view></view>
    <mci-skeleton v-if="loading && pageIndex === 1" type="list" :rows="6" />
    <scroll-view v-else class="device-scroll" scroll-y :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="refresh" @scrolltolower="loadMore">
      <view v-if="rows.length" class="device-list">
        <view v-for="device in rows" :key="device.Id" class="device-row" :class="{ selected: isSelected(device), disabled: isExisting(device) }" hover-class="device-row--pressed" @tap="toggle(device)">
          <view class="check-box"><text>{{ isExisting(device) ? '已' : isSelected(device) ? '✓' : '' }}</text></view><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><view class="device-copy"><text class="device-name">{{ device.ShangpinMC || device.ShebeiMC || '客户设备' }}</text><text class="device-meta">{{ [device.ShebeiXH, device.ShebeiBH].filter(Boolean).join(' · ') || '暂无型号与编号' }}</text><text class="device-position">{{ device.AnzhuangWZ || '暂未维护安装位置' }}</text></view><text class="device-state">{{ device.ShebeiZT || '-' }}</text>
        </view>
        <view class="load-state"><text v-if="loading">正在加载...</text><text v-else-if="finished">已展示全部 {{ count }} 台设备</text><text v-else>上拉加载更多</text></view>
      </view>
      <view v-else class="empty-state"><image src="/static/xjy/business/shebei.png" mode="aspectFit" /><text>没有可选客户设备</text><text>请先在客户档案中维护设备信息</text></view>
      <view class="safe-space"></view>
    </scroll-view>
    <view class="bottom-bar"><view class="select-all" @tap="toggleAll"><view class="check-box" :class="{ selected: allSelectableSelected }"><text>{{ allSelectableSelected ? '✓' : '' }}</text></view><text>本页全选</text></view><view class="submit-button" :class="{ disabled: !selectedIds.length || submitting }" hover-class="submit-button--pressed" @tap="submit"><text>{{ submitting ? '正在添加' : `添加 ${selectedIds.length || ''} 台设备` }}</text></view></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { addTaskDevices, loadTaskDevices } from '@/utils/xjy-task.js'

export default {
  mixins: [themeMixin],
  data() { return { taskId: '', customerId: '', keyword: '', rows: [], existingIds: [], selected: {}, count: 0, pageIndex: 1, pageSize: 20, loading: true, refreshing: false, finished: false, submitting: false, loadRequestId: 0, searchTimer: null } },
  computed: {
    selectedIds() { return Object.keys(this.selected).filter((id) => this.selected[id]) },
    selectableRows() { return this.rows.filter((row) => !this.isExisting(row)) },
    allSelectableSelected() { return this.selectableRows.length > 0 && this.selectableRows.every((row) => this.isSelected(row)) }
  },
  onLoad(options) { this.taskId = decodeURIComponent(options.taskId || ''); this.customerId = decodeURIComponent(options.customerId || ''); this.initialize() },
  onUnload() { clearTimeout(this.searchTimer) },
  methods: {
    async initialize() {
      try { const existing = await loadTaskDevices(this.taskId, true); this.existingIds = existing.map((item) => String(item.KehuSBID || item.ShebeiID || '')).filter(Boolean) } catch (error) {}
      this.loadDevices(true)
    },
    async loadDevices(reset = false) {
      if (this.loading && !reset) return
      if (!reset && this.finished) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.finished = false }
      this.loading = true
      try {
        const where = []
        if (this.customerId) where.push({ Name: 'KehuID', Type: '=', Value: this.customerId })
        const result = await V8.FormEngine.GetTableData('Diy_KehuSB', { _Keyword: this.keyword.trim(), _Where: where, _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: this.pageIndex, _PageSize: this.pageSize })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '设备加载失败')
        if (requestId !== this.loadRequestId) return
        const items = result.Data || []
        this.rows = reset ? items : [...this.rows, ...items]
        this.count = Number(result.DataCount || 0)
        this.finished = this.rows.length >= this.count || items.length < this.pageSize
        if (!this.finished) this.pageIndex += 1
      } catch (error) { if (requestId === this.loadRequestId) uni.showToast({ title: error.message || '设备加载失败', icon: 'none' }) } finally { if (requestId === this.loadRequestId) { this.loading = false; this.refreshing = false } }
    },
    isExisting(row) { return this.existingIds.includes(String(row.Id)) },
    isSelected(row) { return !!this.selected[row.Id] },
    toggle(row) { if (this.isExisting(row)) return; this.selected[row.Id] = !this.selected[row.Id] },
    toggleAll() { const value = !this.allSelectableSelected; this.selectableRows.forEach((row) => { this.selected[row.Id] = value }) },
    search() {
      clearTimeout(this.searchTimer)
      this.loadDevices(true)
    },
    // zhy：设备选择列表输入关键词后自动防抖检索。
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadDevices(true), 350)
    },
    clearKeyword() {
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.loadDevices(true)
    },
    async refresh() { this.refreshing = true; try { await this.loadDevices(true) } finally { this.refreshing = false } },
    loadMore() { this.loadDevices(false) },
    async submit() {
      if (!this.selectedIds.length || this.submitting) return
      this.submitting = true; uni.showLoading({ title: '正在添加', mask: true })
      try {
        const devices = this.rows.filter((row) => this.selectedIds.includes(String(row.Id)))
        await addTaskDevices(this.taskId, devices)
        uni.showToast({ title: `已添加 ${devices.length} 台设备`, icon: 'success' })
        setTimeout(() => this.goBack(), 650)
      } catch (error) { uni.showToast({ title: error.message || error.Msg || '设备添加失败', icon: 'none' }) } finally { uni.hideLoading(); this.submitting = false }
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.select-page{height:100vh;overflow:hidden}.search-band{padding:17rpx 22rpx;border-bottom:1px solid #e4ecef;background:#fff}.search-box{height:72rpx;display:grid;grid-template-columns:48rpx minmax(0,1fr) 48rpx;align-items:center;padding:0 10rpx;border:1px solid #dce7eb;border-radius:8px;background:#f4f8f9;box-sizing:border-box}.search-box>text{color:#617d87;font-size:34rpx;text-align:center}.search-box input{width:100%;font-size:24rpx}.search-box>view{height:44rpx;display:flex;align-items:center;justify-content:center;color:#83969e;font-size:33rpx}.device-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 108rpx - 112rpx - var(--mci-safe-bottom))}.device-list{padding:14rpx 22rpx 0}.device-row{min-height:116rpx;display:grid;grid-template-columns:46rpx 52rpx minmax(0,1fr) auto;gap:13rpx;align-items:center;margin-bottom:12rpx;padding:11rpx 16rpx;border:1px solid #e1eaed;border-radius:8px;background:#fff;box-sizing:border-box;transition:transform .16s ease,border-color .16s ease,background .16s ease}.device-row.selected{border-color:#68aec8;background:#edf8fb}.device-row.disabled{opacity:.6;background:#f1f4f5}.device-row--pressed{transform:scale(.988)}.check-box{width:36rpx;height:36rpx;border:2rpx solid #b9c9cf;border-radius:6rpx;color:#fff;background:#fff;font-size:21rpx;line-height:36rpx;text-align:center;box-sizing:border-box}.device-row.selected .check-box,.check-box.selected{border-color:#087da8;background:#087da8}.device-row.disabled .check-box{border-color:#9caeb5;color:#fff;background:#9caeb5;font-size:17rpx}.device-row>image{width:46rpx;height:46rpx}.device-copy{min-width:0}.device-name,.device-meta,.device-position{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-name{color:#294b57;font-size:24rpx;font-weight:700}.device-meta{margin-top:4rpx;color:#6d838c;font-size:20rpx}.device-position{margin-top:4rpx;color:#95a4aa;font-size:18rpx}.device-state{max-width:100rpx;padding:6rpx 9rpx;border-radius:5px;color:#147351;background:#eaf7f1;font-size:18rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.load-state{height:86rpx;color:#899aa1;font-size:20rpx;line-height:86rpx;text-align:center}.empty-state{min-height:58vh;display:flex;flex-direction:column;align-items:center;justify-content:center}.empty-state image{width:105rpx;height:105rpx;opacity:.42}.empty-state text:nth-child(2){margin-top:19rpx;color:#365762;font-size:27rpx;font-weight:650}.empty-state text:last-child{margin-top:7rpx;color:#899aa1;font-size:21rpx}.safe-space{height:20rpx}.bottom-bar{position:fixed;right:0;bottom:0;left:0;z-index:30;display:grid;grid-template-columns:auto minmax(240rpx,1fr);gap:18rpx;align-items:center;padding:15rpx 22rpx calc(15rpx + var(--mci-safe-bottom));border-top:1px solid #e3ebee;background:rgba(255,255,255,.97)}.select-all{height:82rpx;display:flex;align-items:center;gap:10rpx;color:#4e6973;font-size:22rpx}.submit-button{height:82rpx;border-radius:7px;color:#fff;background:#e54625;font-size:25rpx;font-weight:700;line-height:82rpx;text-align:center;transition:transform .16s ease}.submit-button.disabled{opacity:.48}.submit-button--pressed{transform:scale(.98)}@media(prefers-reduced-motion:reduce){.device-row,.submit-button{transition:none}}
</style>
