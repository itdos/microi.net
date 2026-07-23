<template>
  <view class="camera-page" :style="mciTokenStyle">
    <!-- #ifdef MP-WEIXIN -->
    <camera
      v-if="!sourcePath"
      class="camera-view"
      device-position="back"
      :flash="flashMode"
      resolution="high"
      @initdone="cameraReady = true"
      @error="handleCameraError"
    />
    <!-- #endif -->

    <!-- #ifndef MP-WEIXIN -->
    <view v-if="!sourcePath" class="camera-fallback">
      <image src="/static/xjy/watermarkCamera/camera.png" mode="aspectFit" />
      <text>当前平台使用系统相册或相机选择照片</text>
      <button @tap="chooseImage">选择照片</button>
    </view>
    <!-- #endif -->

    <image v-if="sourcePath" class="photo-preview" :src="sourcePath" mode="aspectFit" />
    <view v-if="!sourcePath && !cameraReady" class="camera-skeleton" aria-label="相机初始化中">
      <view class="camera-skeleton__frame"></view>
      <view class="camera-skeleton__line"></view>
    </view>

    <view class="camera-nav mci-safe-top mci-safe-nav-row">
      <view class="nav-button" @tap="goBack"><text>×</text></view>
      <text class="nav-title">现场水印相机</text>
      <view class="nav-button" @tap="toggleFlash"><text>{{ flashMode === 'torch' ? '开' : '关' }}</text></view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <view v-if="!sourcePath" class="focus-guide">
      <view class="corner corner--tl"></view>
      <view class="corner corner--tr"></view>
      <view class="corner corner--bl"></view>
      <view class="corner corner--br"></view>
    </view>
    <!-- #endif -->

    <view class="watermark-preview">
      <view class="watermark-brand">
        <image :src="xjyAssets.logo" mode="aspectFill" />
        <view>
          <text class="watermark-title">集福鲤服务现场</text>
          <text class="watermark-time">{{ currentTime }}</text>
        </view>
      </view>
      <text v-if="customer" class="watermark-line">客户：{{ customer }}</text>
      <text class="watermark-line">位置：{{ locationText }}</text>
    </view>

    <view class="camera-controls">
      <template v-if="!sourcePath">
        <view class="side-control" @tap="chooseImage">
          <view class="side-icon"><text>相册</text></view>
        </view>
        <view class="shutter" :class="{ 'is-processing': processing }" @tap="takePhoto">
          <view class="shutter-inner"></view>
        </view>
        <view class="side-control" @tap="toggleFlash">
          <view class="side-icon"><text>{{ flashMode === 'torch' ? '闪光开' : '闪光关' }}</text></view>
        </view>
      </template>
      <template v-else>
        <button class="control-button control-button--plain" :disabled="processing" @tap="retake">重拍</button>
        <button class="control-button control-button--confirm" :loading="processing" :disabled="processing" @tap="confirmPhoto">
          {{ processing ? '生成水印中' : '使用照片' }}
        </button>
      </template>
    </view>

    <canvas
      v-if="sourcePath && processing"
      canvas-id="watermarkCanvas"
      id="watermarkCanvas"
      class="watermark-canvas"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
    />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 0,
      flashMode: 'off',
      currentTime: '',
      customer: '',
      address: '',
      latitude: '',
      longitude: '',
      sourcePath: '',
      processing: false,
      cameraReady: false,
      timer: null,
      canvasWidth: 1,
      canvasHeight: 1
    }
  },
  computed: {
    locationText() {
      if (this.address) return this.address
      if (this.longitude && this.latitude) return `${this.longitude}, ${this.latitude}`
      return '现场位置待补充'
    }
  },
  onLoad(options) {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    this.customer = options.customer ? decodeURIComponent(options.customer) : ''
    this.address = options.address ? decodeURIComponent(options.address) : ''
    this.latitude = options.latitude ? decodeURIComponent(options.latitude) : ''
    this.longitude = options.longitude ? decodeURIComponent(options.longitude) : ''
    this.updateTime()
    this.timer = setInterval(this.updateTime, 1000)
    // Non-WeChat targets use the system picker and do not emit camera initdone.
    // #ifndef MP-WEIXIN
    this.cameraReady = true
    // #endif
  },
  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    updateTime() {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      this.currentTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    },
    toggleFlash() {
      this.flashMode = this.flashMode === 'torch' ? 'off' : 'torch'
    },
    takePhoto() {
      if (this.processing) return
      // #ifdef MP-WEIXIN
      this.processing = true
      const camera = uni.createCameraContext()
      camera.takePhoto({
        quality: 'high',
        success: (result) => { this.sourcePath = result.tempImagePath },
        fail: () => uni.showToast({ title: '拍照失败，请检查相机权限', icon: 'none' }),
        complete: () => { this.processing = false }
      })
      // #endif
      // #ifndef MP-WEIXIN
      this.chooseImage()
      // #endif
    },
    chooseImage() {
      if (this.processing) return
      const success = (path) => { if (path) this.sourcePath = path }
      if (uni.chooseMedia) {
        uni.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'], success: (result) => success(result.tempFiles && result.tempFiles[0] && result.tempFiles[0].tempFilePath) })
      } else {
        uni.chooseImage({ count: 1, sourceType: ['camera', 'album'], success: (result) => success(result.tempFilePaths && result.tempFilePaths[0]) })
      }
    },
    retake() {
      if (!this.processing) this.sourcePath = ''
    },
    handleCameraError() {
      this.cameraReady = true
      uni.showModal({ title: '无法使用相机', content: '请在小程序设置中允许使用摄像头，或从相册选择现场照片。', showCancel: false })
    },
    shortText(value, maxLength) {
      const text = String(value || '')
      return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
    },
    async confirmPhoto() {
      if (!this.sourcePath || this.processing) return
      this.processing = true
      try {
        const path = await this.renderWatermark(this.sourcePath)
        const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel()
        if (eventChannel && eventChannel.emit) eventChannel.emit('watermarkCaptured', { path })
        uni.navigateBack()
      } catch (error) {
        uni.showToast({ title: error.message || '水印生成失败', icon: 'none' })
      } finally {
        this.processing = false
      }
    },
    getImageInfo(path) {
      return new Promise((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: reject }))
    },
    renderWatermark(path) {
      return this.getImageInfo(path).then((info) => new Promise((resolve, reject) => {
        const sourceWidth = Number(info.width || 1080)
        const sourceHeight = Number(info.height || 1440)
        const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight))
        const width = Math.max(1, Math.round(sourceWidth * scale))
        const height = Math.max(1, Math.round(sourceHeight * scale))
        const panelHeight = Math.max(190, Math.round(height * 0.18))
        const padding = Math.max(28, Math.round(width * 0.035))
        const titleSize = Math.max(28, Math.round(width * 0.038))
        const textSize = Math.max(22, Math.round(width * 0.026))
        this.canvasWidth = width
        this.canvasHeight = height
        this.$nextTick(() => {
          setTimeout(() => {
            const context = uni.createCanvasContext('watermarkCanvas', this)
            context.drawImage(path, 0, 0, width, height)
            context.setFillStyle('rgba(5, 38, 50, 0.76)')
            context.fillRect(0, height - panelHeight, width, panelHeight)
            context.setFillStyle('#ffffff')
            context.setFontSize(titleSize)
            context.fillText('集福鲤服务现场', padding, height - panelHeight + padding + titleSize)
            context.setFontSize(textSize)
            context.setFillStyle('rgba(255, 255, 255, 0.92)')
            context.fillText(this.currentTime, padding, height - panelHeight + padding + titleSize + textSize + 16)
            const customerText = this.customer ? `客户：${this.shortText(this.customer, 28)}` : '客户：现场业务记录'
            context.fillText(customerText, padding, height - panelHeight + padding + titleSize + textSize * 2 + 30)
            context.setFillStyle('rgba(255, 255, 255, 0.78)')
            context.fillText(`位置：${this.shortText(this.locationText, 34)}`, padding, height - padding)
            context.draw(false, () => {
              setTimeout(() => {
                uni.canvasToTempFilePath({
                  canvasId: 'watermarkCanvas',
                  destWidth: width,
                  destHeight: height,
                  fileType: 'jpg',
                  quality: 0.9,
                  success: (result) => resolve(result.tempFilePath),
                  fail: reject
                }, this)
              }, 180)
            })
          }, 80)
        })
      }))
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style lang="scss" scoped>
.camera-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: #07161d; color: #fff; }
.camera-view, .photo-preview { position: absolute; inset: 0; width: 100%; height: 100%; background: #07161d; }
.camera-skeleton { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0a222c; }
.camera-skeleton__frame,.camera-skeleton__line { background: linear-gradient(90deg, rgba(255,255,255,.06) 25%, rgba(255,255,255,.18) 45%, rgba(255,255,255,.06) 65%); background-size: 300% 100%; animation: cameraShimmer 1.2s ease-in-out infinite; }
.camera-skeleton__frame { width: 310rpx; height: 420rpx; border-radius: 8px; }
.camera-skeleton__line { width: 220rpx; height: 22rpx; margin-top: 28rpx; border-radius: 6rpx; }
@keyframes cameraShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.camera-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48rpx; box-sizing: border-box; background: #0b2631; text-align: center; }
.camera-fallback image { width: 128rpx; height: 128rpx; }
.camera-fallback text { margin-top: 24rpx; color: #b9ccd3; font-size: 25rpx; line-height: 1.6; }
.camera-fallback button { width: 260rpx; height: 76rpx; margin-top: 30rpx; border-radius: 8rpx; background: #0b86d4; color: #fff; font-size: 25rpx; line-height: 76rpx; }
.camera-fallback button::after { border: none; }
.camera-nav { position: absolute; top: 0; right: 0; left: 0; display: grid; grid-template-columns: 88rpx minmax(0, 1fr) 88rpx; align-items: end; min-height: 88rpx; padding-right: calc(18rpx + var(--mci-capsule-right)); padding-left: 18rpx; padding-bottom: 12rpx; box-sizing: content-box; background: rgba(4, 26, 35, 0.42); z-index: 4; }
.nav-button { display: flex; align-items: center; justify-content: center; width: 72rpx; height: 64rpx; border-radius: 50%; background: rgba(255, 255, 255, 0.12); font-size: 38rpx; }
.nav-button:last-child { justify-self: end; font-size: 21rpx; }
.nav-title { align-self: center; color: #fff !important; text-align: center; font-size: 29rpx; font-weight: 650; }
.focus-guide { position: absolute; top: 26%; left: 50%; width: 430rpx; height: 430rpx; transform: translateX(-50%); pointer-events: none; }
.corner { position: absolute; width: 54rpx; height: 54rpx; border-color: rgba(255, 255, 255, 0.78); border-style: solid; }
.corner--tl { top: 0; left: 0; border-width: 3rpx 0 0 3rpx; }
.corner--tr { top: 0; right: 0; border-width: 3rpx 3rpx 0 0; }
.corner--bl { bottom: 0; left: 0; border-width: 0 0 3rpx 3rpx; }
.corner--br { right: 0; bottom: 0; border-width: 0 3rpx 3rpx 0; }
.watermark-preview { position: absolute; right: 24rpx; bottom: 230rpx; left: 24rpx; padding: 20rpx 22rpx; border-left: 6rpx solid #35c49a; background: rgba(5, 38, 50, 0.78); z-index: 3; }
.watermark-brand { display: flex; align-items: center; gap: 14rpx; }
.watermark-brand image { width: 54rpx; height: 54rpx; border-radius: 8rpx; }
.watermark-title { display: block; font-size: 27rpx; font-weight: 700; }
.watermark-time { display: block; margin-top: 4rpx; color: rgba(255, 255, 255, 0.78); font-size: 21rpx; }
.watermark-line { display: block; margin-top: 10rpx; overflow: hidden; color: rgba(255, 255, 255, 0.88); text-overflow: ellipsis; white-space: nowrap; font-size: 22rpx; }
.camera-controls { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: space-around; min-height: 190rpx; padding: 18rpx 36rpx calc(18rpx + var(--mci-safe-bottom)); background: rgba(3, 20, 27, 0.82); box-sizing: border-box; z-index: 5; }
.side-control { display: flex; align-items: center; justify-content: center; width: 120rpx; height: 90rpx; }
.side-icon { display: flex; align-items: center; justify-content: center; width: 88rpx; height: 58rpx; border: 1rpx solid rgba(255, 255, 255, 0.24); border-radius: 8rpx; background: rgba(255, 255, 255, 0.08); font-size: 19rpx; }
.shutter { display: flex; align-items: center; justify-content: center; width: 126rpx; height: 126rpx; border: 6rpx solid rgba(255, 255, 255, 0.88); border-radius: 50%; }
.shutter-inner { width: 98rpx; height: 98rpx; border-radius: 50%; background: #fff; transition: transform 120ms ease; }
.shutter:active .shutter-inner { transform: scale(0.86); }
.shutter.is-processing { opacity: 0.55; }
.control-button { width: 290rpx; height: 82rpx; margin: 0; border-radius: 8rpx; font-size: 26rpx; font-weight: 650; line-height: 82rpx; }
.control-button::after { border: none; }
.control-button--plain { background: rgba(255, 255, 255, 0.14); color: #fff; }
.control-button--confirm { background: #e94b2c; color: #fff; }
.watermark-canvas { position: fixed; left: -10000px; bottom: -10000px; pointer-events: none; }
</style>
