<template>
  <mci-page-shell
    class="service-page"
    :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]"
    :title="t('service.title')"
    :subtitle="t('service.subtitle')"
    @back="goBack"
  >
    <view class="service-content">
      <view v-for="section in sections" :key="section.title" class="section">
        <text class="section-title">{{ section.title }}</text>
        <text class="section-text">{{ section.text }}</text>
      </view>
      <view class="update-time">
        <text>{{ t('service.lastUpdate') }}</text>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  computed: {
    sections() {
      return [
        { title: this.t('service.intro'), text: this.t('service.introText', { appName: this.runtimeBranding.appName }) },
        { title: this.t('service.connection'), text: this.t('service.connectionText') },
        { title: this.t('service.account'), text: this.t('service.accountText') },
        { title: this.t('service.permissions'), text: this.t('service.permissionsText') },
        { title: this.t('service.changes'), text: this.t('service.changesText') },
        { title: this.t('service.contact'), text: this.t('service.contactText') }
      ]
    }
  },
  methods: {
    goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/login/index' }) }) }
  }
}
</script>

<style lang="scss" scoped>
.service-page {
  min-height: 100vh;
  padding: 0;
  background: var(--mci-app-canvas, #f4f6f5);
}

.service-content {
  box-sizing: border-box;
  margin: -12rpx 24rpx 0;
  padding: 34rpx 28rpx calc(60rpx + var(--mci-safe-bottom));
  border: 1rpx solid var(--mci-divider, rgba(20, 65, 84, .1));
  border-radius: 32rpx;
  background: var(--mci-app-surface, #fefffe);
  box-shadow: var(--mci-shadow-deck);
}

.section {
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--mci-divider, rgba(20, 65, 84, .1));
}

.section:first-child { padding-top: 0; }
.section:last-of-type { border-bottom: 0; }

.section-title {
  display: block;
  margin-bottom: 14rpx;
  color: var(--mci-text-primary, #17313d);
  font-size: 30rpx;
  font-weight: 700;
}

.section-text {
  display: block;
  color: var(--mci-text-secondary, rgba(23, 49, 61, .66));
  font-size: 26rpx;
  line-height: 1.78;
}

.update-time {
  margin-top: 36rpx;
  text-align: center;
}

.update-time text {
  color: var(--mci-text-tertiary, rgba(23, 49, 61, .46));
  font-size: 24rpx;
}
</style>
