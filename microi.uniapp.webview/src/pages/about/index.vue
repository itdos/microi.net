<template>
  <view class="about-page" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <view class="about-header">
      <image class="about-logo" :src="logoUrl" mode="aspectFit" />
      <text class="about-name">{{ appName }}</text>
      <text class="about-version">{{ t('about.version') }} 1.0.0</text>
    </view>

    <view class="about-content">
      <view class="info-group">
        <view class="info-item" @tap="navigateToPrivacy">
          <text class="info-label">{{ t('about.privacy') }}</text>
          <text class="info-arrow">›</text>
        </view>
      </view>

      <view class="about-desc">
        <text class="desc-text">
          {{ appName }}{{ t('about.desc') }}
        </text>
      </view>
    </view>

    <view class="about-footer">
      <text class="footer-text">© {{ currentYear }} {{ companyName || appName }}</text>
      <text class="footer-text">Powered by {{ companyName || 'Microi.net' }}</text>
    </view>
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appName: appConfig.appName,
      logoUrl: appConfig.logoUrl || '/static/microi-blue-256.png',
      companyName: '',
      currentYear: new Date().getFullYear()
    }
  },

  onLoad() {
    this.loadSysConfig()
  },

  methods: {
    async loadSysConfig() {
      try {
        const cfg = await getSysConfig()
        if (cfg) {
          if (cfg.SysTitle) this.appName = cfg.SysTitle
          if (cfg.CompanyName) this.companyName = cfg.CompanyName
          if (cfg.SysLogo) {
            this.logoUrl = getServerPath(cfg.SysLogo)
          }
        }
      } catch (e) {
        console.log('[About] loadSysConfig:', e.message)
      }
    },

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
