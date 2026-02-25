<template>
  <view class="privacy-page" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <view class="privacy-content">
      <view class="section">
        <text class="section-title">{{ t('privacy.intro') }}</text>
        <text class="section-text">{{ t('privacy.introText', { appName }) }}</text>
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
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appName: appConfig.appName
    }
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
