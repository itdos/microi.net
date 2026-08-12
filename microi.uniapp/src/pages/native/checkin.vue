<template>
  <view class="checkin-page" :style="mciTokenStyle">
    <view v-if="typePickerOpen || targetPickerOpen" class="dropdown-backdrop" @tap="closeDropdowns"></view>
    <view class="page-header mci-safe-top">
      <view class="nav-row mci-safe-nav-row">
        <view class="nav-icon" @tap="goBack"><text>‹</text></view>
        <text class="nav-title">拜访打卡</text>
        <view class="nav-record" @tap="openRecords">记录</view>
      </view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <mci-skeleton v-if="initialLoading" type="form" :rows="6" />
      <view v-else class="content">
        <view class="time-panel">
          <text class="current-time">{{ currentTime }}</text>
          <text class="time-note">今日共打卡 {{ todayCount }} 次</text>
          <view v-if="todayCheckinRecords.length" class="checkin-time-group">
            <text class="checkin-time-title">今日打卡时间</text>
            <scroll-view class="checkin-time-scroll" scroll-x enable-flex>
              <view class="checkin-time-list">
                <view v-for="(record, index) in todayCheckinRecords" :key="record.id || `${record.time}-${index}`"
                  class="checkin-time-chip" :class="{ 'checkin-time-chip--clickable': record.id }"
                  hover-class="checkin-time-chip--pressed" @tap="openCheckinDetail(record)">
                  <view class="checkin-time-dot"></view>
                  <text>{{ checkinTimeLabel(record.time) }}</text>
                  <text v-if="record.id" class="checkin-time-arrow">›</text>
                </view>
              </view>
            </scroll-view>
          </view>
          <text v-else class="checkin-time-empty">今日暂无打卡记录</text>
        </view>

        <view class="section">
          <view class="section-heading">
            <text class="section-title">现场位置</text>
            <view class="text-action" @tap="chooseLocation">重新定位</view>
          </view>
          <view class="map-wrap" @tap="chooseLocation">
            <map
              v-if="mapReady && location.latitude && location.longitude"
              class="map-view"
              :latitude="location.latitude"
              :longitude="location.longitude"
              :markers="markers"
              :show-location="true"
              :enable-zoom="true"
            />
            <view v-else class="map-placeholder">
              <image src="/static/xjy/map.png" mode="aspectFit" />
              <text>{{ locating ? '正在获取位置...' : '点击获取现场位置' }}</text>
            </view>
          </view>
          <text class="address-text">{{ location.address || '尚未选择打卡地址' }}</text>
        </view>

        <view class="section form-section">
          <view class="field">
            <view class="field-heading">
              <text class="field-label">拜访对象类型</text>
            </view>
            <view class="type-combobox">
              <view class="type-combobox__control" :class="{ focused: typePickerOpen }">
                <input
                  :value="form.targetType"
                  class="type-combobox__input"
                  placeholder="输入关键词检索"
                  @focus="openTypePicker"
                  @input="handleTypeInput"
                />
                <text class="type-combobox__arrow" :class="{ open: typePickerOpen }" @tap.stop="toggleTypePicker">›</text>
              </view>
              <view v-if="typePickerOpen" class="type-combobox__dropdown">
                <view
                  v-for="option in filteredTargetTypes"
                  :key="option"
                  class="type-combobox__option"
                  :class="{ selected: option === form.targetType }"
                  hover-class="type-combobox__option--pressed"
                  @tap.stop="selectTargetType(option)"
                >
                  <text>{{ option }}</text><text v-if="option === form.targetType">✓</text>
                </view>
                <view v-if="!filteredTargetTypes.length" class="type-combobox__empty"><text>未找到匹配类型</text></view>
              </view>
            </view>
          </view>
          <view class="field field--target">
            <view class="field-heading"><text class="field-label">拜访对象</text></view>
            <mci-visit-target-combobox
              ref="targetCombobox"
              :model-value="form.name"
              :selected-id="targetId"
              :module-key="targetModuleKey"
              :target-type="form.targetType"
              @update:model-value="handleTargetValue"
              @select="selectTarget"
              @clear="clearSelectedTarget"
              @open-change="handleTargetPickerOpen"
            />
            <text class="field-help">可检索当前账号有权查看的{{ form.targetType }}；未检索到时保留输入并按新对象提交</text>
          </view>
          <view class="field field--textarea">
            <view class="field-heading">
              <text class="field-label">现场备注</text>
            </view>
            <view class="field-textarea-wrap">
              <textarea v-model="form.remark" class="field-textarea" maxlength="500" placeholder="记录本次拜访或现场服务情况" />
              <text class="field-count">{{ form.remark.length }}/500</text>
            </view>
          </view>
        </view>

        <view class="section">
          <view class="section-heading">
            <view>
              <text class="section-title">现场照片</text>
              <text class="section-subtitle">最多 6 张，默认添加时间与位置水印</text>
            </view>
            <view class="text-action" @tap="chooseFromAlbum">从相册选择</view>
          </view>
          <view class="photo-grid">
            <view v-for="(photo, index) in photos" :key="photo.path" class="photo-item">
              <image :src="photo.path" mode="aspectFill" @tap="previewPhoto(index)" />
              <view class="photo-remove" @tap="removePhoto(index)"><text>×</text></view>
            </view>
            <view v-if="photos.length < 6" class="photo-add" @tap="openWatermarkCamera">
              <image src="/static/xjy/watermarkCamera/camera.png" mode="aspectFit" />
              <text>水印拍照</text>
            </view>
          </view>
        </view>

        <view class="privacy-note">
          <view class="privacy-mark"></view>
          <text>定位与照片只用于本次业务打卡和服务留痕。</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="!initialLoading" class="submit-bar">
      <button class="submit-button" :loading="submitting" :disabled="submitting" @tap="submit">
        <view v-if="!submitting" class="submit-check-icon"><text>✓</text></view>
        <text>{{ submitting ? '正在提交' : '确认打卡' }}</text>
      </button>
    </view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser } from '@/utils/request.js'
import { callApiEngine, openForm, openLowCodeMenu } from '@/platform/business-runtime.js'
import { normalizeChosenLocation, reverseGeocode } from '@/platform/location.js'
import {
  checkinDetailFormOptions,
  checkinTimeLabel,
  normalizeCheckinStatistics
} from '@/platform/checkin-statistics.mjs'
import { updateTask } from '@/utils/xjy-task.js'
import MciVisitTargetCombobox from '@/components/mci-visit-target-combobox/mci-visit-target-combobox.vue'

const AMAP_REVERSE_GEOCODE_ENGINE = 'xjy-amap-regeo'
const TARGET_TYPES = ['客户', '项目合伙人', '供应商', '商家']
const TARGET_MODULE_KEYS = {
  客户: 'customers',
  项目合伙人: 'partners',
  供应商: 'suppliers',
  商家: 'stores'
}

export default {
  components: { MciVisitTargetCombobox },
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 0,
      timer: null,
      currentTime: '',
      todayCount: 0,
      todayCheckinRecords: [],
      initialLoading: true,
      locating: false,
      mapReady: false,
      mapMountTimer: null,
      submitting: false,
      location: { latitude: 0, longitude: 0, address: '' },
      photos: [],
      form: { targetType: '客户', name: '', remark: '' },
      taskId: '',
      targetId: '',
      selectedTargetName: '',
      returnToFollowup: false,
      typePickerOpen: false,
      typeSearchActive: false,
      targetPickerOpen: false
    }
  },
  computed: {
    markers() {
      if (!this.location.latitude || !this.location.longitude) return []
      return [{ id: 1, latitude: this.location.latitude, longitude: this.location.longitude, width: 28, height: 36 }]
    },
    filteredTargetTypes() {
      if (!this.typeSearchActive) return TARGET_TYPES
      const keyword = String(this.form.targetType || '').trim()
      return keyword ? TARGET_TYPES.filter((item) => item.includes(keyword)) : TARGET_TYPES
    },
    targetModuleKey() {
      return TARGET_MODULE_KEYS[this.form.targetType] || ''
    }
  },
  onLoad(options) {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    const visitTarget = options.customer || options.name
    if (visitTarget) this.form.name = decodeURIComponent(visitTarget)
    this.taskId = decodeURIComponent(options.taskId || '')
    this.form.targetType = decodeURIComponent(options.targetType || '客户')
    this.targetId = this.form.targetType === '客户' ? decodeURIComponent(options.customerId || '') : ''
    this.returnToFollowup = String(options.returnToFollowup || '0') === '1'
    this.selectedTargetName = this.targetId ? this.form.name : ''
    this.updateTime()
    this.timer = setInterval(this.updateTime, 1000)
    this.initializePage()
  },
  onUnload() {
    if (this.timer) clearInterval(this.timer)
    if (this.mapMountTimer) clearTimeout(this.mapMountTimer)
  },
  methods: {
    initializePage() {
      // 首屏只等待一次视图刷新，统计、定位和地图均在内容可操作后异步加载。
      this.$nextTick(() => {
        this.initialLoading = false
        this.loadTodayStatistics()
        setTimeout(() => this.chooseLocation(false), 60)
      })
    },
    updateTime() {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      this.currentTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    },
    checkinTimeLabel,
    async loadTodayStatistics() {
      try {
        const result = await callApiEngine('sign_statistics', {})
        const statistics = normalizeCheckinStatistics(result)
        this.todayCount = statistics.count
        this.todayCheckinRecords = statistics.records
      } catch (e) {}
    },
    openCheckinDetail(record) {
      const options = checkinDetailFormOptions(record)
      if (options) openForm(options)
    },
    requestCurrentCheckinLocation() {
      return new Promise((resolve, reject) => {
        uni.getLocation({
          type: 'gcj02',
          isHighAccuracy: true,
          highAccuracyExpireTime: 5000,
          success: resolve,
          fail: reject
        })
      })
    },
    requestChosenCheckinLocation() {
      return new Promise((resolve, reject) => {
        uni.chooseLocation({
          success: resolve,
          fail: reject
        })
      })
    },
    async resolveCheckinLocation(source) {
      const immediate = normalizeChosenLocation(source, null)
      this.location = { ...this.location, latitude: immediate.latitude, longitude: immediate.longitude, address: immediate.address || '' }
      this.scheduleMapMount()
      if (immediate.address) return
      let geocode = null
      try {
        geocode = await reverseGeocode(source.longitude, source.latitude, {
          apiEngineKey: AMAP_REVERSE_GEOCODE_ENGINE
        })
      } catch (error) {
        // 地图选点自带地址时仍可使用选点结果；自动定位会在下方校验地址。
      }
      const location = normalizeChosenLocation(source, geocode)
      if (!location.address) throw new Error('当前坐标的详细地址解析失败')
      this.location = location
    },
    scheduleMapMount() {
      if (this.mapReady || this.mapMountTimer) return
      this.mapMountTimer = setTimeout(() => {
        this.mapReady = true
        this.mapMountTimer = null
      }, 180)
    },
    async chooseLocation(showPicker = true) {
      if (this.locating) return
      this.locating = true
      try {
        let source
        if (showPicker && uni.chooseLocation) {
          try {
            source = await this.requestChosenCheckinLocation()
          } catch (error) {
            const message = String(error && error.errMsg || error && error.message || '')
            if (/cancel/i.test(message)) return
            source = await this.requestCurrentCheckinLocation()
          }
        } else {
          source = await this.requestCurrentCheckinLocation()
        }
        await this.resolveCheckinLocation(source)
        if (showPicker) uni.showToast({ title: '签到地点已更新', icon: 'success' })
      } catch (error) {
        uni.showToast({
          title: showPicker ? '位置选择失败' : '无法获取位置，请检查定位权限',
          icon: 'none'
        })
      } finally {
        this.locating = false
      }
    },
    openTypePicker() {
      if (this.$refs.targetCombobox) this.$refs.targetCombobox.closeOptions()
      // 默认值只是当前选中项，不应被当成检索关键词；展开时先展示全部类型。
      this.typeSearchActive = false
      this.typePickerOpen = true
    },
    toggleTypePicker() {
      if (!this.typePickerOpen && this.$refs.targetCombobox) this.$refs.targetCombobox.closeOptions()
      this.typePickerOpen = !this.typePickerOpen
      if (this.typePickerOpen) this.typeSearchActive = false
    },
    handleTargetPickerOpen(open) {
      this.targetPickerOpen = Boolean(open)
      if (open) this.typePickerOpen = false
    },
    closeDropdowns() {
      this.typePickerOpen = false
      this.targetPickerOpen = false
      if (this.$refs.targetCombobox) this.$refs.targetCombobox.closeOptions()
    },
    handleTypeInput(event) {
      this.form.targetType = String(event && event.detail && event.detail.value || '')
      this.typeSearchActive = true
      this.typePickerOpen = true
      this.clearSelectedTarget(true)
    },
    selectTargetType(option) {
      const changed = option !== this.form.targetType
      this.form.targetType = option
      this.typeSearchActive = false
      this.typePickerOpen = false
      if (changed) this.clearSelectedTarget(true)
      this.$nextTick(() => {
        if (this.$refs.targetCombobox) this.$refs.targetCombobox.openOptions()
      })
    },
    selectTarget(payload) {
      this.targetId = String(payload && payload.id || '')
      this.selectedTargetName = String(payload && payload.name || '')
      this.form.name = this.selectedTargetName
    },
    clearSelectedTarget(clearName = false) {
      this.targetId = ''
      this.selectedTargetName = ''
      if (clearName === true) this.form.name = ''
    },
    handleTargetValue(value) {
      value = String(value || '')
      this.form.name = value
      if (this.targetId && value.trim() !== this.selectedTargetName.trim()) this.clearSelectedTarget()
    },
    openWatermarkCamera() {
      if (this.photos.length >= 6) return
      const query = [
        `customer=${encodeURIComponent(this.form.name || '')}`,
        `address=${encodeURIComponent(this.location.address || '')}`,
        `latitude=${encodeURIComponent(this.location.latitude || '')}`,
        `longitude=${encodeURIComponent(this.location.longitude || '')}`
      ].join('&')
      uni.navigateTo({
        url: `/pages/native/watermark-camera?${query}`,
        success: (result) => {
          if (!result.eventChannel) return
          result.eventChannel.on('watermarkCaptured', (data) => {
            if (!data || !data.path) return
            this.photos = [...this.photos, { path: data.path, size: Number(data.size || 0), watermarked: true }].slice(0, 6)
          })
        }
      })
    },
    chooseFromAlbum() {
      const count = 6 - this.photos.length
      if (count <= 0) return
      const success = (files) => {
        const additions = files.map((file) => ({ path: file.tempFilePath || file.path, size: file.size || 0 })).filter((file) => file.path)
        this.photos = [...this.photos, ...additions].slice(0, 6)
      }
      if (uni.chooseMedia) {
        uni.chooseMedia({ count, mediaType: ['image'], sourceType: ['album'], success: (res) => success(res.tempFiles || []) })
      } else {
        uni.chooseImage({ count, sourceType: ['album'], success: (res) => success((res.tempFilePaths || []).map((path) => ({ path }))) })
      }
    },
    removePhoto(index) {
      this.photos.splice(index, 1)
    },
    previewPhoto(index) {
      uni.previewImage({ current: index, urls: this.photos.map((item) => item.path) })
    },
    async uploadPhotos() {
      const uploaded = []
      for (const photo of this.photos) {
        const result = await V8.uploadFile(photo.path, { path: 'xjy/checkin', preview: true })
        uploaded.push(result.Data)
      }
      return uploaded
    },
    async submit() {
      if (this.submitting) return
      if (!this.location.address) {
        uni.showToast({ title: '请先获取现场位置', icon: 'none' })
        return
      }
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入拜访对象', icon: 'none' })
        return
      }
      if (!TARGET_TYPES.includes(this.form.targetType)) {
        uni.showToast({ title: '请选择拜访对象类型', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const user = getUser() || {}
        const uploaded = await this.uploadPhotos()
        const result = await V8.FormEngine.AddFormData('Diy_location', {
          BaifangDXLX: this.form.targetType,
          BaifangDX: this.form.name.trim(),
          DakaDD: this.location.address,
          Beizhu: this.form.remark.trim(),
          Tupian: uploaded.length ? JSON.stringify(uploaded) : '',
          TenantName: user.TenantName || '',
          TenantId: user.TenantId || '',
          DakaR: user.Name || user.Account || '',
          DakaSJ: this.currentTime,
          KehuID: this.form.targetType === '客户' ? this.targetId : '',
          ShouhouDDID: this.taskId || ''
        })
        if (!result || result.Code !== 1) throw new Error((result && result.Msg) || '打卡提交失败')
        if (this.taskId) await updateTask(this.taskId, { ShangmenSJ: this.currentTime })
        this.todayCount += 1
        const checkinId = String(result.Data?.Id || (typeof result.Data === 'string' ? result.Data : ''))
        this.todayCheckinRecords = [
          { id: checkinId, time: this.currentTime },
          ...this.todayCheckinRecords
        ]
        if (this.returnToFollowup && typeof this.getOpenerEventChannel === 'function') {
          // 回传仅用于通知来源页，不能让事件通道异常把已成功落库的打卡误报为失败。
          try {
            const eventChannel = this.getOpenerEventChannel()
            if (eventChannel && typeof eventChannel.emit === 'function') {
              eventChannel.emit('checkinSuccess', {
                id: result.Data?.Id || (typeof result.Data === 'string' ? result.Data : ''),
                customerId: this.form.targetType === '客户' ? this.targetId : '',
                customerName: this.form.name.trim(),
                time: this.currentTime
              })
            }
          } catch (error) {}
        }
        uni.showToast({ title: '打卡成功', icon: 'success' })
        setTimeout(() => this.goBack(), 700)
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '打卡提交失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
    openRecords() {
      openLowCodeMenu({ key: 'attendanceRecords', title: '打卡记录', table: 'Diy_location', menuAliases: ['打卡记录', '拜访打卡', '打卡'] })
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style lang="scss" scoped>
.checkin-page { height: 100vh; overflow: hidden; background: #f4f8fa; color: #18313d; }
.dropdown-backdrop { position: fixed; z-index: 8; inset: 0; background: transparent; }
.page-header { background: #fff; border-bottom: 1rpx solid #e2ecef; }
.nav-row { display: grid; grid-template-columns: 72rpx 1fr 72rpx; align-items: center; min-height: 88rpx; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; }
.nav-icon { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; font-size: 44rpx; }
.nav-title { text-align: center; font-size: 32rpx; font-weight: 650; }
.nav-record { color: #0b86d4; text-align: center; font-size: 24rpx; }
.page-scroll { height: calc(100vh - 178rpx - var(--mci-safe-top) - var(--mci-safe-bottom)); }
.content { padding: 22rpx 24rpx 160rpx; }
.time-panel { position: relative; display: flex; flex-direction: column; padding: 28rpx; border-radius: 16rpx; overflow: hidden; background: linear-gradient(120deg, #0b86d4, #12a6b3 65%, #31af81); color: #fff; box-shadow: 0 10rpx 28rpx rgba(11, 134, 212, 0.16); }
.current-time { position: relative; font-size: 37rpx; font-weight: 700; }
.time-note { position: relative; margin-top: 8rpx; color: rgba(255, 255, 255, 0.78); font-size: 23rpx; }
.checkin-time-group { position: relative; margin-top: 20rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.2); }
.checkin-time-title { display: block; margin-bottom: 12rpx; color: rgba(255, 255, 255, 0.78); font-size: 21rpx; }
.checkin-time-scroll { width: 100%; white-space: nowrap; }
.checkin-time-list { display: inline-flex; gap: 12rpx; padding-right: 8rpx; }
.checkin-time-chip { display: inline-flex; align-items: center; gap: 8rpx; padding: 9rpx 14rpx; border: 1rpx solid rgba(255, 255, 255, 0.26); border-radius: 999rpx; background: rgba(255, 255, 255, 0.13); color: #fff; font-size: 22rpx; }
.checkin-time-chip--clickable { padding-right: 10rpx; }
.checkin-time-chip--pressed { opacity: 0.68; transform: scale(0.97); }
.checkin-time-dot { width: 8rpx; height: 8rpx; border-radius: 50%; background: #baf8d9; box-shadow: 0 0 8rpx rgba(186, 248, 217, 0.7); }
.checkin-time-arrow { margin-left: 2rpx; color: rgba(255, 255, 255, 0.72); font-size: 28rpx; line-height: 1; }
.checkin-time-empty { position: relative; margin-top: 18rpx; padding-top: 15rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.18); color: rgba(255, 255, 255, 0.62); font-size: 21rpx; }
.section { margin-top: 20rpx; padding: 22rpx; border: 1rpx solid #e1ebef; border-radius: 16rpx; background: #fff; box-shadow: 0 6rpx 18rpx rgba(24, 76, 98, 0.05); }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.section-heading > view { display: flex; flex-direction: column; }
.section-title { font-size: 28rpx; font-weight: 650; }
.section-subtitle { margin-top: 4rpx; color: #8a9fa8; font-size: 21rpx; }
.text-action { padding: 10rpx 0 10rpx 24rpx; color: #0b86d4; font-size: 23rpx; }
.map-wrap { width: 100%; aspect-ratio: 16 / 8; border-radius: 14rpx; overflow: hidden; background: #eaf3f6; }
.map-view { width: 100%; height: 100%; }
.map-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; color: #718994; font-size: 23rpx; }
.map-placeholder image { width: 92rpx; height: 92rpx; margin-bottom: 12rpx; opacity: 0.75; }
.address-text { display: block; margin-top: 14rpx; color: #4d6975; font-size: 23rpx; line-height: 34rpx; }
.form-section { padding-top: 8rpx; padding-bottom: 8rpx; }
.field { display: flex; flex-direction: column; align-items: stretch; min-height: 92rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf3f5; }
.field:last-child { border-bottom: none; }
.field--textarea { padding-bottom: 20rpx; }
.field-heading { display: flex; align-items: center; justify-content: space-between; min-height: 48rpx; }
.field-label { color: #536f7a; font-size: 25rpx; font-weight: 600; }
.type-combobox { position: relative; z-index: 30; width: 100%; margin-top: 6rpx; }
.type-combobox__control { box-sizing: border-box; height: 76rpx; display: grid; grid-template-columns: minmax(0, 1fr) 48rpx; align-items: center; padding-left: 14rpx; border: 2rpx solid #d8e6eb; border-radius: 12rpx; background: #fff; }
.type-combobox__control.focused { border-color: #28a7cf; box-shadow: 0 0 0 4rpx rgba(40, 167, 207, .08); }
.type-combobox__input { width: 100%; height: 72rpx; color: #233f4b; font-size: 25rpx; }
.type-combobox__arrow { align-self: center; justify-self: center; color: #81969e; font-size: 38rpx; line-height: 1; transform: rotate(90deg); transform-origin: center; transition: transform .18s ease; }
.type-combobox__arrow.open { transform: rotate(-90deg); }
.type-combobox__dropdown { position: absolute; top: 84rpx; right: 0; left: 0; overflow: hidden; border: 1rpx solid #dce8ec; border-radius: 12rpx; background: #fff; box-shadow: 0 14rpx 38rpx rgba(22, 63, 79, .16); }
.type-combobox__option { min-height: 76rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 18rpx; border-bottom: 1rpx solid #edf3f5; color: #35515c; font-size: 24rpx; }
.type-combobox__option:last-child { border-bottom: 0; }
.type-combobox__option.selected { background: #eef9fc; color: #087fae; }
.type-combobox__option--pressed { background: #f0f7f9; }
.type-combobox__empty { min-height: 96rpx; display: flex; align-items: center; justify-content: center; color: #83979e; font-size: 22rpx; }
.field--target { position: relative; z-index: 10; }
.field-help { margin-top: 10rpx; color: #8a9da4; font-size: 20rpx; line-height: 30rpx; }
.field-textarea-wrap { position: relative; width: 100%; }
.field-textarea { box-sizing: border-box; width: 100%; min-height: 180rpx; padding: 10rpx 0 36rpx; color: #233f4b; font-size: 25rpx; line-height: 38rpx; }
.field-count { position: absolute; right: 0; bottom: 4rpx; color: #a0afb5; font-size: 20rpx; }
.photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.photo-item, .photo-add { position: relative; aspect-ratio: 1; border-radius: 12rpx; overflow: hidden; }
.photo-item image { width: 100%; height: 100%; }
.photo-remove { position: absolute; top: 6rpx; right: 6rpx; display: flex; align-items: center; justify-content: center; width: 40rpx; height: 40rpx; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 30rpx; }
.photo-add { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2rpx dashed #cbdce3; background: #f5f9fa; color: #748d98; font-size: 22rpx; }
.photo-add image { width: 54rpx; height: 54rpx; margin-bottom: 8rpx; }
.privacy-note { display: flex; align-items: flex-start; margin: 18rpx 8rpx 0; color: #8a9fa8; font-size: 21rpx; line-height: 32rpx; }
.privacy-mark { flex: 0 0 auto; width: 8rpx; height: 8rpx; margin: 12rpx 12rpx 0 0; border-radius: 50%; background: #1f9d72; }
.submit-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 5; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e1ebef; background: rgba(255, 255, 255, 0.96); }
.submit-button { display: flex; align-items: center; justify-content: center; gap: 12rpx; width: 100%; height: 84rpx; margin: 0; border: none; border-radius: 16rpx; background: #e94b2c; color: #fff; font-size: 28rpx; font-weight: 650; line-height: 84rpx; box-shadow: 0 9rpx 24rpx rgba(233, 75, 44, 0.22); }
.submit-check-icon { display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border: 3rpx solid rgba(255,255,255,.88); border-radius: 50%; font-size: 22rpx; line-height: 1; }
.submit-button::after { border: none; }
@media (prefers-reduced-motion: reduce) { .type-combobox__arrow { transition: none; } }
</style>
