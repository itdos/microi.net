<template>
  <view class="about-page">
    <view class="about-header">
      <image class="about-logo" :src="logoUrl" mode="aspectFit" />
      <text class="about-name">{{ appName }}</text>
      <text class="about-version">版本 1.0.0</text>
    </view>

    <view class="about-content">
      <view class="info-group">
        <view class="info-item" @tap="navigateToPrivacy">
          <text class="info-label">隐私政策</text>
          <text class="info-arrow">›</text>
        </view>
      </view>

      <view class="about-desc">
        <text class="desc-text">
          {{ appName }}是一款基于 Microi.net 低代码平台构建的企业级应用，
          提供高效便捷的移动办公体验。
        </text>
      </view>
    </view>

    <view class="about-footer">
      <text class="footer-text">© {{ currentYear }} {{ appName }}</text>
      <text class="footer-text">Powered by Microi.net</text>
    </view>
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'

export default {
  data() {
    return {
      appName: appConfig.appName,
      logoUrl: appConfig.logoUrl,
      currentYear: new Date().getFullYear()
    }
  },

  methods: {
    navigateToPrivacy() {
      uni.navigateTo({
        url: '/pages/privacy/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.about-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
  background: #ffffff;
}

.about-logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.about-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8rpx;
}

.about-version {
  font-size: 26rpx;
  color: #999999;
}

.about-content {
  flex: 1;
  padding: 30rpx;
}

.info-group {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 30rpx;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 30rpx;
  color: #333333;
}

.info-arrow {
  font-size: 36rpx;
  color: #cccccc;
}

.about-desc {
  padding: 30rpx;
  background: #ffffff;
  border-radius: 16rpx;
}

.desc-text {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.8;
}

.about-footer {
  padding: 40rpx 0;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.footer-text {
  font-size: 22rpx;
  color: #cccccc;
  margin-bottom: 8rpx;
}
</style>
