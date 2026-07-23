<template>
  <view
    v-if="aiAssistantEnabled"
    class="mci-ai-launcher"
    :style="launcherStyle"
    role="button"
    aria-label="打开服务助手"
    @touchstart="startDrag"
    @touchmove="moveDrag"
    @touchend="endDrag"
    @touchcancel="cancelDrag"
    @tap="openAssistant"
  >
    <view class="mci-ai-launcher__halo" />
    <image class="mci-ai-launcher__robot" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
    <view class="mci-ai-launcher__badge">AI</view>
  </view>
</template>

<script>
import { getAiAssistantEnabled } from '@/utils/sysconfig.js'

const POSITION_KEY = 'mci_ai_assistant_position'
const LEGACY_POSITION_KEY = 'xjy_ai_assistant_position'
const DRAG_THRESHOLD = 12

export default {
  name: 'MciAiLauncher',
  data() {
    return {
      x: 0,
      y: 0,
      windowWidth: 375,
      windowHeight: 667,
      dragState: null,
      dragged: false,
      opening: false,
      aiAssistantEnabled: false
    }
  },
  computed: {
    launcherStyle() {
      return `left:${this.x}px;top:${this.y}px;`
    }
  },
  mounted() {
    this.resolveAssistantVisibility()
  },
  methods: {
    async resolveAssistantVisibility() {
      const enabled = await getAiAssistantEnabled()
      this.aiAssistantEnabled = enabled
      if (enabled) this.initializePosition()
    },
    initializePosition() {
      let info = {}
      try {
        info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
      } catch (error) {}
      this.windowWidth = Number(info.windowWidth || info.screenWidth || 375)
      this.windowHeight = Number(info.windowHeight || info.screenHeight || 667)
      let saved = null
      try {
        saved = uni.getStorageSync(POSITION_KEY) || uni.getStorageSync(LEGACY_POSITION_KEY)
      } catch (error) {}
      const size = 64
      this.x = saved && Number.isFinite(Number(saved.x)) ? Number(saved.x) : this.windowWidth - size - 16
      this.y = saved && Number.isFinite(Number(saved.y)) ? Number(saved.y) : this.windowHeight - size - 112
      this.clampPosition()
    },
    clampPosition() {
      const size = 64
      this.x = Math.max(10, Math.min(this.windowWidth - size - 10, this.x))
      this.y = Math.max(72, Math.min(this.windowHeight - size - 82, this.y))
    },
    startDrag(event) {
      const touch = event.touches && event.touches[0]
      if (!touch) return
      this.dragged = false
      this.dragState = { x: touch.clientX, y: touch.clientY, left: this.x, top: this.y }
    },
    moveDrag(event) {
      if (!this.dragState) return
      const touch = event.touches && event.touches[0]
      if (!touch) return
      const dx = touch.clientX - this.dragState.x
      const dy = touch.clientY - this.dragState.y
      if (!this.dragged && (dx * dx + dy * dy) < DRAG_THRESHOLD * DRAG_THRESHOLD) return
      this.dragged = true
      this.x = this.dragState.left + dx
      this.y = this.dragState.top + dy
      this.clampPosition()
    },
    endDrag() {
      const shouldOpen = !!this.dragState && !this.dragged
      this.dragState = null
      if (shouldOpen) {
        // 微信小程序的 catchtouchmove 参与手势判定后不一定继续派发 tap，
        // 短触在 touchend 直接打开；H5 鼠标仍由 @tap 兜底。
        this.openAssistant()
        return
      }
      try {
        uni.setStorageSync(POSITION_KEY, { x: this.x, y: this.y })
      } catch (error) {}
      setTimeout(() => { this.dragged = false }, 80)
    },
    cancelDrag() {
      this.dragState = null
      this.dragged = false
    },
    openAssistant() {
      if (this.dragged || this.opening) return
      this.opening = true
      uni.navigateTo({
        url: '/pages/ai/index',
        fail: (error) => {
          console.error('[MciAiLauncher] navigate failed:', error)
          uni.showToast({ title: '服务助手打开失败，请重试', icon: 'none' })
        },
        complete: () => {
          setTimeout(() => { this.opening = false }, 280)
        }
      })
    }
  }
}
</script>

<style scoped>
.mci-ai-launcher { position: fixed; z-index: 980; width: 112rpx; height: 112rpx; border: 1rpx solid rgba(24, 166, 184, .34); border-radius: 50%; background: #fff; box-shadow: 0 16rpx 38rpx rgba(2, 72, 103, .24), 0 3rpx 12rpx rgba(229, 70, 37, .14); display: flex; align-items: center; justify-content: center; transform: translateZ(0); }
.mci-ai-launcher:active { transform: scale(.96) translateZ(0); }
.mci-ai-launcher__halo { position: absolute; inset: -8rpx; border: 2rpx solid rgba(24, 166, 184, .38); border-radius: 50%; animation: mciAiHalo 2.8s ease-out infinite; pointer-events: none; }
.mci-ai-launcher__robot { width: 100rpx; height: 100rpx; animation: mciAiFloat 3.8s ease-in-out infinite; pointer-events: none; }
.mci-ai-launcher__badge { position: absolute; right: -5rpx; bottom: -2rpx; min-width: 38rpx; height: 30rpx; padding: 0 6rpx; box-sizing: border-box; border-radius: 15rpx; background: #e94b2c; color: #fff; font-size: 17rpx; line-height: 30rpx; text-align: center; box-shadow: 0 4rpx 10rpx rgba(229, 70, 37, .28); pointer-events: none; }
@keyframes mciAiHalo { 0% { transform: scale(.88); opacity: .72; } 75%, 100% { transform: scale(1.2); opacity: 0; } }
@keyframes mciAiFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5rpx); } }
@media (prefers-reduced-motion: reduce) { .mci-ai-launcher__halo, .mci-ai-launcher__robot { animation: none; } }
</style>
