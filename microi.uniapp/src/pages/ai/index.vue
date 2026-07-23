<template>
  <view class="assistant-route-page" :style="mciTokenStyle">
    <view v-if="featureLoading" class="message-fallback-page" aria-label="消息中心加载中">
      <view class="message-fallback-header mci-safe-top">
        <view class="message-fallback-nav">
          <text class="message-fallback-title">消息中心</text>
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
          <text class="message-fallback-title">消息中心</text>
        </view>
      </view>
      <view class="message-fallback-content">
        <view class="message-fallback-tabs">
          <view class="message-fallback-tab is-active">消息</view>
          <view class="message-fallback-tab">通讯录</view>
        </view>
        <view class="message-empty-card">
          <image class="message-empty-icon" src="/static/xjy/repair/xiaoxi.png" mode="aspectFit" />
          <text class="message-empty-title">暂无新消息</text>
          <text class="message-empty-copy">新的通知与会话将在这里显示</text>
          <button class="message-empty-button" @tap="openMessages">查看消息</button>
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
    this.resolveFeatureAvailability()
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
      uni.switchTab({ url: '/pages/workspace/index' })
    },
    openMessages() {
      uni.switchTab({ url: '/pages/message/index' })
    }
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
.message-fallback-tab { position: relative; display: flex; align-items: center; justify-content: center; color: #78919a; font-size: 28rpx; }
.message-fallback-tab.is-active { color: #0b8ca7; font-weight: 700; background: #eef8fa; }
.message-fallback-tab.is-active::after { content: ''; position: absolute; left: 30%; right: 30%; bottom: 0; height: 5rpx; background: #0b8ca7; }
.message-empty-card { min-height: 520rpx; padding: 72rpx 40rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; border: 1rpx solid #e1eaed; border-radius: 8rpx; background: #fff; }
.message-empty-icon { width: 112rpx; height: 112rpx; opacity: .76; }
.message-empty-title { margin-top: 30rpx; font-size: 31rpx; font-weight: 700; }
.message-empty-copy { margin-top: 12rpx; color: #8399a1; font-size: 25rpx; }
.message-empty-button { width: 280rpx; height: 78rpx; margin-top: 40rpx; border: 0; border-radius: 8rpx; background: #0b8ca7; color: #fff; font-size: 28rpx; line-height: 78rpx; }
.message-empty-button::after { border: 0; }
</style>
