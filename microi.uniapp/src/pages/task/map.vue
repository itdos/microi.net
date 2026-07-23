<template>
  <mci-page-shell class="map-page" :style="mciTokenStyle" :title="pageTitle" :subtitle="pageSubtitle" @back="goBack">
    <template #right><view class="refresh-action" hover-class="refresh-action--pressed" @tap="loadNearby"><text>↻</text></view></template>
    <view class="range-band"><text>范围</text><slider class="range-slider" :value="radius" min="1" max="50" step="1" active-color="#087DA8" background-color="#dce7eb" block-size="18" @change="changeRadius" /><text>{{ radius }} km</text></view>
    <view class="map-wrap">
      <view v-if="loading" class="map-loading"><mci-skeleton type="detail" :rows="4" /><text>正在获取位置与数据</text></view>
      <map v-else class="business-map" :latitude="latitude" :longitude="longitude" :markers="markers" :include-points="markers" :show-location="true" :enable-zoom="true" @markertap="selectMarker" />
      <view v-if="!loading && !markers.length" class="map-empty"><text>当前范围内暂无{{ entityLabel }}</text></view>
    </view>
    <view v-if="selected" class="entity-sheet">
      <view class="entity-sheet__handle"></view>
      <view class="entity-sheet__heading">
        <view><text>{{ selectedTitle }}</text><text>{{ selectedSubtitle }}</text></view>
        <view @tap="selected = null"><text>×</text></view>
      </view>

      <template v-if="mode === 'device'">
        <view class="entity-sheet__row"><text>安装位置</text><text>{{ selected.AnzhuangWZ || '-' }}</text></view>
        <view class="entity-sheet__row"><text>设备状态</text><text>{{ selected.ShebeiZT || '-' }}</text></view>
      </template>
      <template v-else>
        <view class="entity-sheet__row"><text>订单数量</text><text>{{ selected.DingdanSL || 0 }}</text></view>
        <view class="entity-sheet__row"><text>设备数量</text><text>{{ selected.ShebeiSL || 0 }}</text></view>
        <view v-if="mode === 'contacts'" class="contacts-block">
          <text class="contacts-label">客户联系人</text>
          <mci-skeleton v-if="contactsLoading" type="list" :rows="2" />
          <view v-else class="contact-chips">
            <view v-for="contact in contacts" :key="contact.Id" class="contact-chip" @tap="openContact(contact)"><text>{{ contact.Xingming || '未命名' }}</text></view>
            <text v-if="!contacts.length" class="contacts-empty">暂无联系人</text>
          </view>
        </view>
      </template>

      <view class="entity-sheet__actions">
        <view @tap="openSelected"><text>{{ primaryActionLabel }}</text></view>
        <view @tap="navigate"><text>导航到现场</text></view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { callApiEngine, openForm } from '@/platform/business-runtime.js'

const MODE_META = {
  device: { title: '设备地图', entity: '设备', action: '查看设备详情' },
  customer: { title: '客户地图', entity: '客户', action: '查看客户详情' },
  contacts: { title: '联系人地图', entity: '客户', action: '查看全部联系人' },
  visit: { title: '跟进地图', entity: '客户', action: '查看跟进记录' }
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      mode: 'device', customerId: '', radius: 15, latitude: 30.2741, longitude: 120.1551,
      rows: [], markers: [], selected: null, loading: true, contactsLoading: false, contacts: []
    }
  },
  computed: {
    meta() { return MODE_META[this.mode] || MODE_META.device },
    pageTitle() { return this.meta.title },
    entityLabel() { return this.meta.entity },
    pageSubtitle() { return this.markers.length ? `附近 ${this.markers.length} 个${this.entityLabel}` : `按现场位置查找${this.entityLabel}` },
    selectedTitle() { return this.mode === 'device' ? (this.selected.KehuMC || '客户设备') : (this.selected.KehuMC || '客户') },
    selectedSubtitle() { return this.mode === 'device' ? (this.selected.ShebeiBH || this.selected.ShebeiXH || '') : ([this.selected.Chengshi, this.selected.XiangxiDZ].filter(Boolean).join(' ') || this.selected.LianxiR || '') },
    primaryActionLabel() { return this.meta.action }
  },
  onLoad(options) {
    this.mode = MODE_META[options.mode] ? options.mode : 'device'
    this.customerId = decodeURIComponent(options.customerId || '')
    this.customerId && this.mode === 'device' ? this.loadCustomerDevices() : this.loadNearby()
  },
  methods: {
    coordinates(item) {
      return this.mode === 'device'
        ? { latitude: Number(item.KehuSB_Lat), longitude: Number(item.KehuSB_Lng) }
        : { latitude: Number(item.KehuDT_Lat), longitude: Number(item.KehuDT_Lng) }
    },
    markerRows(rows) {
      return (rows || []).map((item, index) => ({ item, index, ...this.coordinates(item) }))
        .filter((entry) => Number.isFinite(entry.latitude) && entry.latitude !== 0 && Number.isFinite(entry.longitude) && entry.longitude !== 0)
        .map((entry) => ({ id: entry.index, latitude: entry.latitude, longitude: entry.longitude, width: 28, height: 36, title: this.mode === 'device' ? (entry.item.KehuMC || entry.item.ShebeiBH || '设备') : (entry.item.KehuMC || '客户') }))
    },
    applyRows(rows) {
      this.rows = Array.isArray(rows) ? rows : []
      this.markers = this.markerRows(this.rows)
      this.selected = null
      this.contacts = []
      if (this.markers.length) { this.latitude = this.markers[0].latitude; this.longitude = this.markers[0].longitude }
    },
    async loadCustomerDevices() {
      this.loading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_KehuSB', { _Where: [{ Name: 'KehuID', Type: '=', Value: this.customerId }], _PageIndex: 1, _PageSize: 500 })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '设备加载失败')
        this.applyRows(result.Data)
      } catch (error) { uni.showToast({ title: error.message || '设备加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    loadNearby() {
      if (this.customerId && this.mode === 'device') { this.loadCustomerDevices(); return }
      this.loading = true
      uni.getLocation({
        type: 'gcj02', isHighAccuracy: true,
        success: async (position) => {
          this.latitude = Number(position.latitude); this.longitude = Number(position.longitude)
          try {
            const engine = this.mode === 'device' ? 'get_location_shebei-v2' : 'get_location_kehu-v2'
            const result = await callApiEngine(engine, { Km: Number(this.radius), Latitude: this.latitude, Longitude: this.longitude })
            if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || `${this.entityLabel}加载失败`)
            this.applyRows(result.Data || [])
          } catch (error) { uni.showToast({ title: error.message || `${this.entityLabel}加载失败`, icon: 'none' }) }
        },
        fail: () => uni.showToast({ title: '请授权定位后重试', icon: 'none' }),
        complete: () => { this.loading = false }
      })
    },
    changeRadius(event) { this.radius = Number(event.detail.value || 15); if (!this.customerId) this.loadNearby() },
    async selectMarker(event) {
      const index = Number(event.detail.markerId)
      this.selected = this.rows[index] || null
      this.contacts = []
      if (this.selected && this.mode === 'contacts') await this.loadContacts(this.selected.Id)
    },
    async loadContacts(customerId) {
      this.contactsLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_LianxiR', { _Where: [{ Name: 'KehuID', Type: '=', Value: customerId }], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 100 })
        this.contacts = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
      } catch (error) { this.contacts = [] }
      finally { this.contactsLoading = false }
    },
    openContact(contact) { openForm({ table: 'Diy_LianxiR', rowId: contact.Id, mode: 'View', title: '联系人详情', menuAliases: ['联系人'] }) },
    openSelected() {
      if (!this.selected) return
      if (this.mode === 'device') { openForm({ table: 'Diy_KehuSB', rowId: this.selected.Id, mode: 'View', title: '设备详情', menuAliases: ['客户设备', '设备管理'] }); return }
      if (this.mode === 'customer') { uni.navigateTo({ url: `/pages/business/detail?key=customers&id=${encodeURIComponent(this.selected.Id)}` }); return }
      const key = this.mode === 'visit' ? 'visits' : 'contacts'
      uni.navigateTo({ url: `/pages/business/list?key=${key}&whereField=KehuID&whereValue=${encodeURIComponent(this.selected.Id)}` })
    },
    navigate() {
      if (!this.selected) return
      const location = this.coordinates(this.selected)
      uni.openLocation({ latitude: location.latitude, longitude: location.longitude, name: this.selectedTitle, address: this.selectedSubtitle, scale: 16 })
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.map-page { height: 100vh; overflow: hidden; }
.refresh-action { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; color: #087da8; font-size: 37rpx; transition: transform .18s ease; }
.refresh-action--pressed { transform: rotate(90deg); }
.range-band { box-sizing: border-box; display: grid; grid-template-columns: 70rpx minmax(0,1fr) 90rpx; align-items: center; height: 86rpx; padding: 0 24rpx; border-bottom: 1rpx solid #e2ebee; background: #fff; color: #55727c; font-size: 22rpx; }
.range-band > text:last-child { color: #087da8; font-weight: 700; text-align: right; }
.range-slider { margin: 0; }
.map-wrap { position: relative; height: calc(100vh - var(--mci-safe-top) - 92rpx - 86rpx); }
.business-map { width: 100%; height: 100%; }
.map-loading { position: absolute; inset: 0; padding: 22rpx; background: #f3f7f9; }
.map-loading > text { display: block; margin-top: 20rpx; color: #71868f; font-size: 22rpx; text-align: center; }
.map-empty { position: absolute; top: 24rpx; right: 24rpx; left: 24rpx; padding: 18rpx; border: 1rpx solid #dce7eb; border-radius: 7rpx; background: rgba(255,255,255,.94); color: #667e87; font-size: 23rpx; text-align: center; }
.entity-sheet { position: fixed; right: 18rpx; bottom: calc(18rpx + var(--mci-safe-bottom)); left: 18rpx; z-index: 30; padding: 10rpx 22rpx 21rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #fff; box-shadow: 0 12rpx 30rpx rgba(16,49,61,.18); animation: sheetUp .2s ease-out both; }
.entity-sheet__handle { width: 62rpx; height: 7rpx; margin: 0 auto 13rpx; border-radius: 4rpx; background: #d7e1e5; }
.entity-sheet__heading { display: flex; align-items: center; justify-content: space-between; min-height: 70rpx; border-bottom: 1rpx solid #edf2f4; }
.entity-sheet__heading > view:first-child text { display: block; }
.entity-sheet__heading > view:first-child text:first-child { color: #294b57; font-size: 27rpx; font-weight: 750; }
.entity-sheet__heading > view:first-child text:last-child { margin-top: 3rpx; color: #84969d; font-size: 19rpx; }
.entity-sheet__heading > view:last-child { width: 52rpx; height: 52rpx; border-radius: 50%; background: #f0f5f7; color: #71858d; font-size: 33rpx; line-height: 52rpx; text-align: center; }
.entity-sheet__row { display: grid; grid-template-columns: 130rpx minmax(0,1fr); align-items: center; min-height: 65rpx; border-bottom: 1rpx solid #f0f4f5; }
.entity-sheet__row text:first-child { color: #788c94; font-size: 21rpx; }
.entity-sheet__row text:last-child { color: #294b57; font-size: 22rpx; text-align: right; }
.contacts-block { padding: 14rpx 0 5rpx; border-bottom: 1rpx solid #edf2f4; }
.contacts-label { color: #788c94; font-size: 21rpx; }
.contact-chips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.contact-chip { padding: 8rpx 14rpx; border-radius: 6rpx; background: #edf7fa; color: #087da8; font-size: 21rpx; }
.contacts-empty { color: #96a6ac; font-size: 21rpx; }
.entity-sheet__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 17rpx; }
.entity-sheet__actions view { height: 70rpx; border-radius: 7rpx; background: #eaf6f9; color: #087da8; font-size: 22rpx; font-weight: 650; line-height: 70rpx; text-align: center; }
.entity-sheet__actions view:last-child { background: #087da8; color: #fff; }
@keyframes sheetUp { from { opacity: 0; transform: translateY(40rpx); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .entity-sheet, .refresh-action { animation: none; transition: none; } }
</style>
