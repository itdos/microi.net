<template>
  <view class="checkin-page" :style="mciTokenStyle">
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
          <text class="time-note">今日已打卡 {{ todayCount }} 次</text>
        </view>

        <view class="section">
          <view class="section-heading">
            <text class="section-title">现场位置</text>
            <view class="text-action" @tap="chooseLocation">重新定位</view>
          </view>
          <view class="map-wrap" @tap="chooseLocation">
            <map
              v-if="location.latitude && location.longitude"
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
            <text class="field-label">拜访对象</text>
            <input v-model="form.name" class="field-input" placeholder="请输入客户或拜访对象" />
          </view>
          <view class="field field--textarea">
            <text class="field-label">现场备注</text>
            <textarea v-model="form.remark" class="field-textarea" maxlength="500" placeholder="记录本次拜访或现场服务情况" />
            <text class="field-count">{{ form.remark.length }}/500</text>
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
        {{ submitting ? '正在提交' : '确认打卡' }}
      </button>
    </view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser } from '@/utils/request.js'
import { callApiEngine, openLowCodeMenu } from '@/platform/business-runtime.js'
import { updateTask } from '@/utils/xjy-task.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 0,
      timer: null,
      currentTime: '',
      todayCount: 0,
      initialLoading: true,
      locating: false,
      submitting: false,
      location: { latitude: 0, longitude: 0, address: '' },
      photos: [],
      form: { name: '', remark: '' },
      taskId: '',
      customerId: ''
    }
  },
  computed: {
    markers() {
      if (!this.location.latitude || !this.location.longitude) return []
      return [{ id: 1, latitude: this.location.latitude, longitude: this.location.longitude, width: 28, height: 36 }]
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
    this.customerId = decodeURIComponent(options.customerId || '')
    this.updateTime()
    this.timer = setInterval(this.updateTime, 1000)
    this.initializePage()
  },
  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    async initializePage() {
      const locationReady = new Promise((resolve) => this.chooseLocation(false, resolve))
      await Promise.allSettled([this.loadTodayCount(), locationReady])
      this.initialLoading = false
    },
    updateTime() {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      this.currentTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    },
    async loadTodayCount() {
      try {
        const result = await callApiEngine('sign_statistics', {})
        this.todayCount = Number(result && result.Data !== undefined ? result.Data : result) || 0
      } catch (e) {}
    },
    chooseLocation(showPicker = true, finished) {
      if (this.locating) return
      this.locating = true
      const done = () => { this.locating = false; if (finished) finished() }
      if (showPicker && uni.chooseLocation) {
        uni.chooseLocation({
          success: (res) => {
            this.location = {
              latitude: Number(res.latitude || 0),
              longitude: Number(res.longitude || 0),
              address: `${res.name || ''}${res.address || ''}` || '已选择现场位置'
            }
          },
          fail: (error) => {
            if (!(error && error.errMsg && error.errMsg.includes('cancel'))) this.getCurrentLocation()
          },
          complete: done
        })
        return
      }
      this.getCurrentLocation(done)
    },
    getCurrentLocation(callback) {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          this.location = {
            latitude: Number(res.latitude || 0),
            longitude: Number(res.longitude || 0),
            address: this.location.address || `经度 ${Number(res.longitude).toFixed(6)}，纬度 ${Number(res.latitude).toFixed(6)}`
          }
        },
        fail: () => uni.showToast({ title: '无法获取位置，请检查定位权限', icon: 'none' }),
        complete: () => {
          this.locating = false
          if (callback) callback()
        }
      })
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
      this.submitting = true
      try {
        const user = getUser() || {}
        const uploaded = await this.uploadPhotos()
        const result = await V8.FormEngine.AddFormData('Diy_location', {
          BaifangDX: this.form.name.trim(),
          DakaDD: this.location.address,
          Beizhu: this.form.remark.trim(),
          Tupian: uploaded.length ? JSON.stringify(uploaded) : '',
          TenantName: user.TenantName || '',
          TenantId: user.TenantId || '',
          DakaR: user.Name || user.Account || '',
          DakaSJ: this.currentTime,
          KehuID: this.customerId || '',
          ShouhouDDID: this.taskId || ''
        })
        if (!result || result.Code !== 1) throw new Error((result && result.Msg) || '打卡提交失败')
        if (this.taskId) await updateTask(this.taskId, { ShangmenSJ: this.currentTime })
        this.todayCount += 1
        uni.showToast({ title: '打卡成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 700)
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
.field { display: grid; grid-template-columns: 138rpx minmax(0, 1fr); align-items: center; min-height: 92rpx; border-bottom: 1rpx solid #edf3f5; }
.field:last-child { border-bottom: none; }
.field--textarea { position: relative; align-items: start; padding: 24rpx 0; }
.field-label { color: #536f7a; font-size: 25rpx; }
.field-input { height: 72rpx; color: #233f4b; font-size: 25rpx; }
.field-textarea { box-sizing: border-box; width: 100%; min-height: 150rpx; padding: 8rpx 0 34rpx; color: #233f4b; font-size: 25rpx; line-height: 38rpx; }
.field-count { position: absolute; right: 0; bottom: 18rpx; color: #a0afb5; font-size: 20rpx; }
.photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.photo-item, .photo-add { position: relative; aspect-ratio: 1; border-radius: 12rpx; overflow: hidden; }
.photo-item image { width: 100%; height: 100%; }
.photo-remove { position: absolute; top: 6rpx; right: 6rpx; display: flex; align-items: center; justify-content: center; width: 40rpx; height: 40rpx; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 30rpx; }
.photo-add { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2rpx dashed #cbdce3; background: #f5f9fa; color: #748d98; font-size: 22rpx; }
.photo-add image { width: 54rpx; height: 54rpx; margin-bottom: 8rpx; }
.privacy-note { display: flex; align-items: flex-start; margin: 18rpx 8rpx 0; color: #8a9fa8; font-size: 21rpx; line-height: 32rpx; }
.privacy-mark { flex: 0 0 auto; width: 8rpx; height: 8rpx; margin: 12rpx 12rpx 0 0; border-radius: 50%; background: #1f9d72; }
.submit-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 5; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e1ebef; background: rgba(255, 255, 255, 0.96); }
.submit-button { display: flex; align-items: center; justify-content: center; width: 100%; height: 84rpx; margin: 0; border: none; border-radius: 16rpx; background: #e94b2c; color: #fff; font-size: 28rpx; font-weight: 650; line-height: 84rpx; box-shadow: 0 9rpx 24rpx rgba(233, 75, 44, 0.22); }
.submit-button::after { border: none; }
</style>
