<template>
  <view class="home-page" :style="mciTokenStyle">
    <view class="home-header mci-safe-top">
      <image v-if="xjyAssets.waterHero" class="header-water" :src="xjyAssets.waterHero" mode="aspectFill" />
      <mci-water-motion tone="dark" mode="hero" />
      <view class="header-shade"></view>
      <view class="topbar">
        <view class="brand">
          <image class="brand-logo" :src="logoUrl" mode="aspectFill" />
          <view class="brand-copy">
            <text class="brand-name">{{ appConfig.platformName }}</text>
            <text class="brand-subtitle">{{ appConfig.workspaceSubTitle }}</text>
          </view>
        </view>
        <view class="topbar-actions">
          <view v-if="featureEnabled('scan')" class="icon-button" hover-class="icon-button--pressed" @tap="handleScan">
            <image :src="xjyAssets.scan" mode="aspectFill" />
          </view>
          <view v-if="featureEnabled('messages')" class="icon-button" hover-class="icon-button--pressed" @tap="goMessages">
            <image src="/static/tab-message.png" mode="aspectFit" />
          </view>
        </view>
      </view>

      <view class="welcome-row">
        <view>
          <text class="welcome-title">{{ welcomeText }}</text>
          <text class="welcome-note">{{ welcomeIdentity }}</text>
          <text class="welcome-date">{{ todayText }}</text>
        </view>
        <view v-if="!isLoggedIn" class="login-button" @tap="goLogin">登录</view>
      </view>

      <view v-if="featureEnabled('business')" class="metrics" :class="{ 'is-loading': summaryLoading }">
        <view v-for="metric in metrics" :key="metric.key" class="metric" @tap="openModule(metric.key)">
          <view v-if="summaryLoading" class="metric-value metric-skeleton"></view>
          <text v-else class="metric-value">{{ compactNumber(metric.value) }}</text>
          <text class="metric-label">{{ metric.label }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      class="home-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refreshAll"
    >
      <view class="home-content">
        <view v-if="quickEntries.length" class="section-heading">
          <view>
            <text class="section-title">快捷处理</text>
            <text class="section-subtitle">按当前角色优先展示常用工作</text>
          </view>
          <view v-if="featureEnabled('businessCatalog')" class="text-action" @tap="goCatalog">全部</view>
        </view>

        <view v-if="quickEntries.length" class="quick-grid">
          <view
            v-for="item in quickEntries"
            :key="item.key"
            class="quick-item"
            hover-class="quick-item--pressed"
            @tap="openModule(item.key)"
          >
            <view class="quick-icon" :style="{ backgroundColor: `${item.accent}14` }">
              <image :src="item.icon" mode="aspectFit" />
              <text v-if="item.badgeKey && summary.tasks" class="quick-badge">{{ compactNumber(summary.tasks) }}</text>
            </view>
            <text class="quick-title">{{ item.title }}</text>
          </view>
        </view>

        <view
          v-for="(group, groupIndex) in visibleBusinessGroups"
          :key="group.key"
          class="business-section"
          :style="{ animationDelay: `${groupIndex * 55}ms` }"
        >
          <view class="group-heading">
            <view class="group-mark" :style="{ backgroundColor: group.accent }"></view>
            <view class="group-copy">
              <text class="group-title">{{ group.title }}</text>
              <text class="group-subtitle">{{ group.subtitle }}</text>
            </view>
          </view>
          <view class="module-grid">
            <view
              v-for="item in group.items"
              :key="item.key"
              class="module-item"
              hover-class="module-item--pressed"
              @tap="openModule(item.key)"
            >
              <view class="module-icon">
                <image :src="item.icon" mode="aspectFit" />
                <text v-if="item.badgeKey && summary.tasks" class="module-badge">{{ compactNumber(summary.tasks) }}</text>
              </view>
              <text class="module-name">{{ item.title }}</text>
            </view>
          </view>
        </view>

        <view class="service-promise">
          <view class="promise-line"></view>
          <text class="promise-title">{{ appConfig.promiseTitle }}</text>
          <text class="promise-text">{{ appConfig.promiseText }}</text>
        </view>
      </view>
    </scroll-view>
    <mci-ai-launcher v-if="featureEnabled('ai')" />
  </view>
</template>

<script>
import appConfig from '@/config.js'
import { getToken, getUser } from '@/utils/request.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'
import { themeMixin } from '@/utils/theme.js'
import {
  businessGroups,
  quickActions,
  getBusinessEntry,
  getRoleProfile
} from '@/platform/business.js'
import { openBusiness, scanDevice } from '@/platform/business-runtime.js'
import { loadSummarySnapshot, readSummarySnapshot, warmPrimaryTabs } from '@/platform/preload.js'
import { hasFeature, getProfileRoute } from '@/platform/profile/index.js'
import { captureInvitation } from '@/platform/invitation.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appConfig,
      statusBarHeight: 0,
      logoUrl: appConfig.logoUrl,
      isLoggedIn: false,
      currentUser: {},
      businessGroups,
      summary: { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 },
      summaryLoading: false,
      refreshing: false,
      summaryRequestId: 0
    }
  },
  computed: {
    roleProfile() {
      return getRoleProfile(this.currentUser)
    },
    welcomeText() {
      if (!this.isLoggedIn) return appConfig.guestWelcomeText
      const name = this.currentUser.Name || this.currentUser.Account || '您好'
      const hour = new Date().getHours()
      const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
      return `${name}，${greeting}`
    },
    welcomeIdentity() {
      if (!this.isLoggedIn) return appConfig.workspaceSubTitle
      return this.roleProfile.identityText || this.roleProfile.roleText
    },
    todayText() {
      const now = new Date()
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
    },
    metrics() {
      if (this.roleProfile.isCustomer) {
        return [
          { key: 'orders', label: '我的合同', value: this.summary.orders },
          { key: 'devices', label: '我的设备', value: this.summary.devices },
          { key: 'tasks', label: '售后进度', value: this.summary.tasks },
          { key: 'serviceRecords', label: '服务记录', value: this.summary.services }
        ]
      }
      if (this.roleProfile.isService) {
        return [
          { key: 'tasks', label: '待处理任务', value: this.summary.tasks },
          { key: 'customers', label: '服务客户', value: this.summary.customers },
          { key: 'serviceRecords', label: '服务记录', value: this.summary.services },
          { key: 'devices', label: '客户设备', value: this.summary.devices }
        ]
      }
      if (this.roleProfile.isSales) {
        return [
          { key: 'customers', label: '我的客户', value: this.summary.customers },
          { key: 'orders', label: '我的订单', value: this.summary.orders },
          { key: 'serviceRecords', label: '服务记录', value: this.summary.services },
          { key: 'tasks', label: '协同任务', value: this.summary.tasks }
        ]
      }
      return [
        { key: 'tasks', label: '待处理任务', value: this.summary.tasks },
        { key: 'customers', label: '全部客户', value: this.summary.customers },
        { key: 'orders', label: '合同订单', value: this.summary.orders },
        { key: 'devices', label: '客户设备', value: this.summary.devices }
      ]
    },
    visibleBusinessGroups() {
      const allowed = new Set(this.roleProfile.allowedGroupKeys || [])
      return this.businessGroups.filter((group) => allowed.has(group.key))
    },
    quickEntries() {
      const keys = [...this.roleProfile.primaryActions, ...quickActions]
      const unique = [...new Set(keys)].slice(0, 8)
      return unique.map((key) => ({ key, ...getBusinessEntry(key) })).filter((item) => item.title)
    }
  },
  onLoad(options) {
    captureInvitation(options || {})
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    this.loadBrand()
    const summary = readSummarySnapshot()
    if (summary) this.summary = summary
    warmPrimaryTabs(80)
  },
  onShow() {
    this.currentUser = getUser() || {}
    this.isLoggedIn = !!getToken()
    if (this.isLoggedIn) this.loadSummary()
  },
  methods: {
    featureEnabled(name) {
      return hasFeature(name)
    },
    async loadBrand() {
      try {
        const config = await getSysConfig()
        if (config && config.SysLogo) this.logoUrl = getServerPath(config.SysLogo)
      } catch (e) {}
    },
    async loadSummary(refresh = false) {
      if (this.summaryLoading && !refresh) return
      const requestId = ++this.summaryRequestId
      this.summaryLoading = true
      try {
        const summary = await loadSummarySnapshot({ refresh })
        if (requestId === this.summaryRequestId) this.summary = summary
      } catch (e) {
        console.warn('[XJY Home] summary load failed:', e && e.message)
      } finally {
        if (requestId === this.summaryRequestId) this.summaryLoading = false
      }
    },
    compactNumber(value) {
      const number = Number(value || 0)
      if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`
      return String(number)
    },
    openModule(key) {
      openBusiness(key)
    },
    handleScan() {
      scanDevice()
    },
    goCatalog() {
      const url = getProfileRoute('catalog')
      if (url) uni.navigateTo({ url })
    },
    goMessages() {
      uni.switchTab({ url: getProfileRoute('messages', '/pages/message/index') })
    },
    goLogin() {
      uni.navigateTo({ url: getProfileRoute('login', '/pages/login/index') })
    },
    async refreshAll() {
      this.refreshing = true
      if (!this.isLoggedIn) {
        this.refreshing = false
        return
      }
      try {
        await Promise.all([this.loadSummary(true), this.loadBrand()])
      } finally {
        this.refreshing = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.home-page {
  height: 100vh;
  overflow: hidden;
  background: #f4f8fa;
  color: #18313d;
}

.home-header {
  position: relative;
  z-index: 2;
  min-height: 390rpx;
  overflow: hidden;
  color: #fff;
  background: #063b5c;
}

.header-water {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.header-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(105deg, rgba(3, 37, 58, 0.96) 0%, rgba(4, 57, 78, 0.82) 50%, rgba(6, 80, 101, 0.38) 100%),
    linear-gradient(180deg, rgba(1, 28, 44, 0.08), rgba(1, 28, 44, 0.40));
  pointer-events: none;
}

.topbar,
.welcome-row,
.metrics {
  position: relative;
  z-index: 1;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104rpx;
  padding: 10rpx calc(28rpx + var(--mci-capsule-right)) 0 28rpx;
}

.brand {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-logo {
  width: 74rpx;
  height: 74rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 16rpx;
  box-shadow: 0 6rpx 18rpx rgba(2, 46, 78, 0.2);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-left: 16rpx;
}

.brand-name {
  color: #fff;
  font-size: 34rpx;
  line-height: 42rpx;
  font-weight: 700;
}

.brand-subtitle {
  margin-top: 2rpx;
  color: rgba(255, 255, 255, 0.76);
  font-size: 22rpx;
}

.topbar-actions {
  display: flex;
  gap: 14rpx;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.26);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.16);
  transition: transform 150ms ease;
}

.icon-button image {
  width: 34rpx;
  height: 34rpx;
  border-radius: 6rpx;
}

.icon-button--pressed {
  transform: scale(0.92);
}

.welcome-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 32rpx 16rpx;
}

.welcome-row > view:first-child {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.welcome-title {
  overflow: hidden;
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.welcome-note {
  margin-top: 6rpx;
  color: rgba(255, 255, 255, 0.75);
  font-size: 23rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.welcome-date {
  margin-top: 3rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 21rpx;
}

.login-button {
  flex: 0 0 auto;
  min-width: 104rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  border-radius: 14rpx;
  text-align: center;
  font-size: 25rpx;
  line-height: 1;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 12rpx 24rpx 26rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 16rpx;
  background: rgba(3, 63, 96, 0.18);
  backdrop-filter: blur(12rpx);
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 18rpx 6rpx;
}

.metric + .metric::before {
  position: absolute;
  top: 20rpx;
  bottom: 20rpx;
  left: 0;
  width: 1rpx;
  background: rgba(255, 255, 255, 0.18);
  content: '';
}

.metric-value {
  max-width: 100%;
  overflow: hidden;
  font-size: 34rpx;
  line-height: 42rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-label {
  max-width: 100%;
  margin-top: 4rpx;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.74);
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metrics.is-loading .metric-value {
  opacity: 0.62;
}
.metric-skeleton { width: 58rpx; height: 34rpx; margin: 0 auto; border-radius: 6rpx; background: linear-gradient(90deg, rgba(255,255,255,.14) 25%, rgba(255,255,255,.38) 45%, rgba(255,255,255,.14) 65%); background-size: 300% 100%; animation: homeMetricShimmer 1.2s ease-in-out infinite; }
@keyframes homeMetricShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.home-scroll {
  height: calc(100vh - 390rpx - var(--mci-safe-top));
}

.home-content {
  padding: 28rpx 24rpx calc(44rpx + var(--mci-safe-bottom));
}

.section-heading,
.group-heading {
  display: flex;
  align-items: center;
}

.section-heading {
  justify-content: space-between;
  margin: 2rpx 4rpx 18rpx;
}

.section-heading > view:first-child,
.group-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.section-title,
.group-title {
  font-size: 30rpx;
  line-height: 40rpx;
  font-weight: 650;
}

.section-subtitle,
.group-subtitle {
  margin-top: 3rpx;
  color: #75909c;
  font-size: 21rpx;
}

.text-action {
  padding: 12rpx 8rpx 12rpx 20rpx;
  color: #0b86d4;
  font-size: 24rpx;
}

.quick-grid,
.module-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.quick-grid {
  padding: 16rpx 8rpx 12rpx;
  border: 1rpx solid #e5eef2;
  border-radius: 16rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(17, 74, 101, 0.06);
}

.quick-item,
.module-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  transition: transform 150ms ease, opacity 150ms ease;
}

.quick-item {
  min-height: 142rpx;
  padding: 12rpx 4rpx;
}

.quick-item--pressed,
.module-item--pressed {
  opacity: 0.7;
  transform: scale(0.94);
}

.quick-icon,
.module-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 16rpx;
}

.quick-icon image {
  width: 48rpx;
  height: 48rpx;
}

.quick-title,
.module-name {
  width: 100%;
  overflow: hidden;
  color: #284652;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-title {
  margin-top: 10rpx;
  font-size: 23rpx;
}

.quick-badge,
.module-badge {
  position: absolute;
  top: -10rpx;
  right: -16rpx;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 7rpx;
  border: 3rpx solid #fff;
  border-radius: 16rpx;
  background: #e94b2c;
  color: #fff;
  font-size: 17rpx;
  line-height: 28rpx;
  text-align: center;
}

.business-section {
  margin-top: 30rpx;
  padding: 24rpx 18rpx 14rpx;
  border: 1rpx solid #e5eef2;
  border-radius: 16rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(17, 74, 101, 0.05);
  animation: sectionIn 420ms ease both;
}

.group-heading {
  padding: 0 8rpx 18rpx;
}

.group-mark {
  flex: 0 0 auto;
  width: 8rpx;
  height: 50rpx;
  margin-right: 16rpx;
  border-radius: 4rpx;
}

.module-grid {
  border-top: 1rpx solid #edf3f5;
}

.module-item {
  min-height: 136rpx;
  padding: 22rpx 4rpx 14rpx;
}

.module-icon {
  width: 66rpx;
  height: 66rpx;
}

.module-icon image {
  width: 58rpx;
  height: 58rpx;
}

.module-name {
  margin-top: 8rpx;
  font-size: 22rpx;
}

.service-promise {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 38rpx 8rpx 0;
  padding: 28rpx 24rpx;
  border-top: 1rpx solid #dce8ed;
}

.promise-line {
  width: 100rpx;
  height: 5rpx;
  border-radius: 3rpx;
  background: linear-gradient(90deg, #e94b2c, #0b86d4, #1f9d72);
}

.promise-title {
  margin-top: 16rpx;
  color: #365866;
  font-size: 25rpx;
  font-weight: 600;
}

.promise-text {
  margin-top: 8rpx;
  color: #8aa0aa;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
}

@keyframes sectionIn {
  from { opacity: 0; transform: translateY(18rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
