<template>
  <view class="assistant-route-page" :style="mciTokenStyle">
    <view v-if="featureLoading" class="message-fallback-page" aria-label="AI助手加载中">
      <view class="message-fallback-header mci-safe-top">
        <view class="message-fallback-nav">
          <text class="message-fallback-title">AI 助手</text>
        </view>
      </view>
      <view class="message-fallback-content">
        <mci-skeleton type="list" :rows="5" />
      </view>
    </view>
    <mci-ai-assistant v-else-if="featureEnabled" ref="assistant" @close="leaveAssistant" />
    <view v-else class="message-fallback-page">
      <view class="message-fallback-header mci-safe-top">
        <view class="message-fallback-nav">
          <text class="message-fallback-title">AI 助手</text>
        </view>
      </view>
      <view class="message-fallback-content">
        <view class="message-empty-card">
          <image class="message-empty-icon" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
          <text class="message-empty-title">当前企业暂未开放 AI 助手</text>
          <text class="message-empty-copy">请由平台管理员开启移动端 AI 开关，并为当前角色配置可用模型和数据范围。</text>
          <button class="message-empty-button" @tap="leaveAssistant"><view class="message-empty-button__back" aria-hidden="true" /><text>返回首页</text></button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import MciAiAssistant from './components/mci-ai-assistant/mci-ai-assistant.vue'
import shareMixin from '@/utils/share.js'
import { themeMixin } from '@/utils/theme.js'
import { getAiAssistantEnabled } from '@/utils/sysconfig.js'
import { getToken, getUser, removeToken } from '@/utils/request.js'
import { reLaunchToLogin } from '@/platform/auth-entry.mjs'
import { setAppNativeDockVisible } from '@/platform/app-native-dock.mjs'

export default {
  name: 'AiAssistantPage',
  components: { MciAiAssistant },
  mixins: [themeMixin, shareMixin],
  data() {
    return {
      featureLoading: true,
      featureEnabled: false
    }
  },
  onLoad() {
    const token = getToken()
    const user = getUser() || {}
    if (!token || !user.Id) {
      if (token) removeToken()
      reLaunchToLogin({ redirect: '/pages/ai/index' })
      return
    }
    this.resolveFeatureAvailability()
  },
  onShow() {
    setAppNativeDockVisible(false)
  },
  onUnload() {
    setAppNativeDockVisible(true)
  },
  methods: {
    async resolveFeatureAvailability() {
      this.featureLoading = true
      this.featureEnabled = await getAiAssistantEnabled({ refresh: true })
      this.featureLoading = false
    },
    leaveAssistant() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (pages && pages.length > 1) {
        uni.navigateBack()
        return
      }
      uni.switchTab({ url: '/pages/home/index' })
    },
    openMessages() { uni.switchTab({ url: '/pages/message/index' }) }
  },
  onBackPress() {
    const assistant = this.featureEnabled && this.$refs.assistant
    if (assistant && assistant.handleBack && assistant.handleBack()) return true
    return false
  }
}
</script>

<style scoped>
.assistant-route-page { width: 100%; height: 100vh; overflow: hidden; background: #f3f7f9; }
.message-fallback-page { width: 100%; height: 100%; background: #f3f7f9; color: #173944; }
.message-fallback-header { box-sizing: border-box; background: #fff; border-bottom: 1rpx solid #e3ecef; }
.message-fallback-nav { min-height: var(--mci-nav-height, 44px); padding: 0 120rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.message-fallback-title { min-width: 0; font-size: 34rpx; font-weight: 700; text-align: center; white-space: nowrap; }
.message-fallback-content { height: calc(100% - var(--mci-safe-top) - var(--mci-nav-height)); padding: 26rpx 28rpx calc(var(--mci-safe-bottom) + 28rpx); box-sizing: border-box; }
.message-fallback-tabs { height: 82rpx; display: grid; grid-template-columns: repeat(2, 1fr); align-items: stretch; margin-bottom: 24rpx; border: 1rpx solid #dbe7ea; border-radius: 8rpx; overflow: hidden; background: #fff; }
.message-fallback-tab { position: relative; display: flex; align-items: center; justify-content: center; color: #536b76; font-size: 28rpx; }
.message-fallback-tab.is-active { color: var(--mci-color-primary, #006c82); font-weight: 700; background: #eef8fa; }
.message-fallback-tab.is-active::after { content: ''; position: absolute; left: 30%; right: 30%; bottom: 0; height: 5rpx; background: var(--mci-color-primary, #006c82); }
.message-empty-card { min-height: 520rpx; padding: 72rpx 40rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; border: 1rpx solid #e1eaed; border-radius: 8rpx; background: #fff; }
.message-empty-icon { width: 112rpx; height: 112rpx; opacity: .76; }
.message-empty-title { margin-top: 30rpx; font-size: 31rpx; font-weight: 700; }
.message-empty-copy { margin-top: 12rpx; color: #536b76; font-size: 25rpx; }
.message-empty-button { width: 280rpx; height: 78rpx; margin-top: 40rpx; border: 0; border-radius: 8rpx; background: var(--mci-color-primary, #006d84); color: #fff; font-size: 28rpx; line-height: 78rpx; display: flex; align-items: center; justify-content: center; gap: 13rpx; }
.message-empty-button::after { border: 0; }
.message-empty-button__icon { position: relative; width: 28rpx; height: 22rpx; border: 3rpx solid currentColor; border-radius: 5rpx; box-sizing: border-box; }
.message-empty-button__icon::after { position: absolute; left: 4rpx; bottom: -7rpx; width: 8rpx; height: 8rpx; border-left: 3rpx solid currentColor; transform: skew(-28deg); content: ''; }
.message-empty-button__back { width: 18rpx; height: 18rpx; border-left: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(45deg); }
</style>

<style scoped>
.assistant-route-page, .message-fallback-page { background: var(--mci-app-canvas, #f4f6f5); }
.message-fallback-header { position: relative; overflow: hidden; border: 0; background: var(--mci-gradient-primary); }
.message-fallback-header::after { position: absolute; right: -12%; bottom: -78rpx; left: -12%; height: 106rpx; border-radius: 50% 50% 0 0; background: var(--mci-home-horizon, #fff1e4); content: ''; transform: translateY(68rpx); }
.message-fallback-nav { position: relative; z-index: 1; min-height: calc(var(--mci-nav-height, 44px) + 28rpx); }
.message-fallback-title { color: var(--mci-text-on-primary, #fff); font-size: 34rpx; }
.message-fallback-content { padding: 0 24rpx calc(var(--mci-safe-bottom) + 28rpx); }
.message-empty-card { min-height: 520rpx; margin-top: -12rpx; padding: 60rpx 36rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 32rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-deck); }
.message-empty-title { color: var(--mci-text-primary, #17313d); }
.message-empty-copy { color: var(--mci-text-secondary, rgba(23,49,61,.66)); line-height: 1.65; text-align: center; }
.message-empty-button { min-height: 88rpx; height: 88rpx; border-radius: 22rpx; background: var(--mci-gradient-primary); }
</style>

<style scoped>
/* Blue Suite AI route fallback. */
.assistant-route-page,
.message-fallback-page { background: var(--mci-app-canvas, #f8fafc); }
.message-fallback-header { border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); background: #fff; }
.message-fallback-header::after { display: none; }
.message-fallback-title { color: var(--mci-text-primary, #111827); font-weight: 720; }
.message-empty-card { border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 28rpx; background: #fff; box-shadow: var(--mci-shadow-card); }
.message-empty-button { border-radius: 20rpx; background: var(--mci-color-primary, #2563eb); box-shadow: none; }
</style>
