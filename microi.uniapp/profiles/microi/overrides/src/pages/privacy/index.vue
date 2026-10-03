<template>
  <mci-page-shell class="privacy-page" :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]"
    title="隐私政策" subtitle="数据与权限说明" @back="goBack">
    <view class="privacy-content">
      <view class="section">
        <text class="section-title">{{ t('privacy.intro') }}</text>
        <text class="section-text">{{ t('privacy.introText', { appName: runtimeBranding.appName }) }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.infoCollect') }}</text>
        <text class="section-text">{{ t('privacy.infoCollectItem1') }}</text>
        <text class="section-text">{{ t('privacy.infoCollectItem2') }}</text>
        <text class="section-text">{{ t('privacy.infoCollectItem3') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.infoUse') }}</text>
        <text class="section-text">{{ t('privacy.infoUseDesc') }}</text>
        <text class="section-text">{{ t('privacy.infoUseItem1') }}</text>
        <text class="section-text">{{ t('privacy.infoUseItem2') }}</text>
        <text class="section-text">{{ t('privacy.infoUseItem3') }}</text>
        <text class="section-text">{{ t('privacy.infoUseItem4') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.infoStorage') }}</text>
        <text class="section-text">{{ t('privacy.infoStorageItem1') }}</text>
        <text class="section-text">{{ t('privacy.infoStorageItem2') }}</text>
        <text class="section-text">{{ t('privacy.infoStorageItem3') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.infoShare') }}</text>
        <text class="section-text">{{ t('privacy.infoShareDesc') }}</text>
        <text class="section-text">{{ t('privacy.infoShareItem1') }}</text>
        <text class="section-text">{{ t('privacy.infoShareItem2') }}</text>
        <text class="section-text">{{ t('privacy.infoShareItem3') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.yourRights') }}</text>
        <text class="section-text">{{ t('privacy.yourRightsItem1') }}</text>
        <text class="section-text">{{ t('privacy.yourRightsItem2') }}</text>
        <text class="section-text">{{ t('privacy.yourRightsItem3') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.minorProtection') }}</text>
        <text class="section-text">{{ t('privacy.minorProtectionDesc') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.policyUpdate') }}</text>
        <text class="section-text">{{ t('privacy.policyUpdateDesc') }}</text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacy.contactUs') }}</text>
        <text class="section-text">{{ t('privacy.contactUsDesc') }}</text>
      </view>

      <view class="update-time">
        <text>{{ t('privacy.lastUpdate') }}</text>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  methods: {
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/index' }) }) }
  }
}
</script>

<style lang="scss" scoped>
.privacy-page {
  min-height: 100vh;
  background: #ffffff;
  padding: 30rpx;
}

.privacy-content {
  padding-bottom: 60rpx;
}

.section {
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #333333;
  margin-bottom: 16rpx;
}

.section-text {
  display: block;
  font-size: 28rpx;
  color: #666666;
  line-height: 1.8;
  margin-bottom: 8rpx;
}

.update-time {
  margin-top: 60rpx;
  text-align: center;

  text {
    font-size: 24rpx;
    color: #999999;
  }
}
</style>

<style lang="scss" scoped>
/* Light Field legal reading rail. */
.privacy-page { min-height: 100vh; padding: 0; background: var(--mci-app-canvas, #f4f6f5); }
.privacy-content { box-sizing: border-box; margin: -12rpx 24rpx 0; padding: 34rpx 28rpx calc(60rpx + var(--mci-safe-bottom)); border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 32rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-deck); }
.section { margin: 0 !important; padding: 28rpx 0 !important; border: 0 !important; border-bottom: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)) !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
.section:first-child { padding-top: 0 !important; }
.section:last-of-type { border-bottom: 0 !important; }
.section-title { margin-bottom: 14rpx; color: var(--mci-text-primary, #17313d); font-size: 30rpx; font-weight: 700; }
.section-text { margin-bottom: 8rpx; color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 26rpx; line-height: 1.78; }
.update-time { margin-top: 36rpx; }
.update-time text { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); }
</style>
