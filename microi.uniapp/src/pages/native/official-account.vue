<template>
  <mci-page-shell class="official-account-page" :style="mciTokenStyle" title="关注公众号" subtitle="微信一键关注" @back="goBack">
    <view class="official-account-content">
      <view class="official-account-card">
        <view class="official-account-mark">关</view>
        <text class="official-account-title">关注关联公众号</text>
        <text class="official-account-description">点击下方按钮打开公众号主页并完成关注。已关注用户不会重复关注。</text>
        <!-- #ifdef MP-WEIXIN -->
        <button class="follow-button" :disabled="configLoading || !accountReady" @tap="openProfile">{{ configLoading ? '正在读取公众号配置…' : '一键关注公众号' }}</button>
        <official-account class="official-account-widget" @load="handleOfficialAccountLoad" @error="handleOfficialAccountError" />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <text class="official-account-fallback">当前仅微信小程序支持一键关注公众号。</text>
        <!-- #endif -->
        <text v-if="errorMessage" class="official-account-error">{{ errorMessage }}</text>
      </view>
      <button class="return-button" @tap="goBack">返回查看页面</button>
    </view>
  </mci-page-shell>
</template>

<script>
import { buildFriendShare, buildTimelineShare, getOfficialAccountUsername, openOfficialAccountProfile, warmOfficialAccountConfig } from '@/utils/share.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  onShareAppMessage() { return buildFriendShare(this, 'pages/native/official-account') },
  onShareTimeline() { return buildTimelineShare(this, 'pages/native/official-account') },
  onLoad() {
    warmOfficialAccountConfig().then(() => {
      this.accountReady = Boolean(getOfficialAccountUsername())
      this.configLoading = false
      if (!this.accountReady) this.errorMessage = '后台尚未配置可用的公众号原始 ID，请联系管理员。'
    })
  },
  mixins: [themeMixin],
  data() { return { errorMessage: '', configLoading: true, accountReady: false } },
  methods: {
    openProfile() {
      openOfficialAccountProfile()
    },
    handleOfficialAccountLoad(event) {
      const status = event && event.detail ? Number(event.detail.status) : 0
      if (status && status !== 0) {
        this.errorMessage = status === 5
          ? '当前分享入口不支持公众号组件，请点击上方“一键关注公众号”。'
          : '公众号关注组件暂时不可用，请点击上方“一键关注公众号”重试。'
      }
    },
    handleOfficialAccountError(event) {
      const status = event && event.detail ? Number(event.detail.status) : 0
      this.errorMessage = status === 5
        ? '当前分享入口不支持公众号组件，请点击上方“一键关注公众号”。'
        : '公众号关注组件暂时不可用，请点击上方“一键关注公众号”重试。'
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.official-account-page { min-height: 100vh; background: #f4f8fa; }
.official-account-content { padding: 36rpx 24rpx calc(36rpx + var(--mci-safe-bottom)); }
.official-account-card { padding: 42rpx 28rpx 34rpx; border: 1rpx solid #dce8ec; border-radius: 18rpx; background: #fff; text-align: center; box-shadow: 0 12rpx 30rpx rgba(34, 77, 91, .08); }
.official-account-mark { width: 76rpx; height: 76rpx; margin: 0 auto 20rpx; border-radius: 50%; color: #fff; background: #11a66a; font-size: 32rpx; line-height: 76rpx; }
.official-account-title { display: block; color: #183b48; font-size: 32rpx; font-weight: 750; }
.official-account-description { display: block; margin: 16rpx auto 24rpx; color: #6d858d; font-size: 22rpx; line-height: 1.6; }
.follow-button { height: 78rpx; margin: 6rpx 0 24rpx; border-radius: 10rpx; color: #fff; background: #11a66a; font-size: 27rpx; line-height: 78rpx; }
.follow-button::after { border: none; }
.official-account-widget { display: block; width: 100%; min-height: 168rpx; }
.official-account-fallback, .official-account-error { display: block; color: #a16d31; font-size: 21rpx; line-height: 1.6; }
.return-button { height: 82rpx; margin: 28rpx 0 0; border-radius: 10rpx; color: #087fbd; background: #e7f5f9; font-size: 26rpx; line-height: 82rpx; }
.return-button::after { border: none; }
</style>
