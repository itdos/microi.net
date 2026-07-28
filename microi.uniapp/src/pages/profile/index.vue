<template>
  <view class="profile-page" :style="mciTokenStyle">
    <view class="profile-hero mci-safe-top">
      <image v-if="xjyAssets.waterHero" class="hero-water" :src="xjyAssets.waterHero" mode="aspectFill" />
      <mci-water-motion tone="dark" mode="hero" />
      <view class="hero-shade"></view>
      <view class="hero-top">
        <text class="hero-brand">{{ appConfig.platformName }}</text>
      </view>
      <view class="user-info" @tap="openProfile">
        <view class="avatar">
          <image v-if="avatarUrl" :src="avatarUrl" mode="aspectFill" @error="handleAvatarError" />
          <text v-else>{{ avatarChar }}</text>
        </view>
        <view v-if="isLoggedIn" class="user-copy">
          <view class="user-name-row">
            <text class="user-name">{{ currentUser.Name || currentUser.Account }}</text>
            <text class="role-tag">{{ roleProfile.primaryRole }}</text>
          </view>
          <text class="user-org">{{ orgText || appConfig.servicePlatformName }}</text>
        </view>
        <view v-else class="user-copy" @tap.stop="goLogin">
          <text class="user-name">登录 / 注册</text>
          <text class="user-org">登录后查看订单、设备和服务记录</text>
        </view>
        <text class="user-arrow">›</text>
      </view>
    </view>

    <scroll-view class="profile-scroll" scroll-y>
      <view class="profile-content">
        <view v-if="featureEnabled('business')" class="summary-panel">
          <view v-for="item in summaries" :key="item.key" class="summary-item" @tap="open(item.key)">
            <view v-if="summaryLoading" class="summary-value summary-skeleton"></view>
            <text v-else class="summary-value">{{ compactNumber(item.value) }}</text>
            <text class="summary-label">{{ item.label }}</text>
          </view>
        </view>

        <view class="quick-panel">
        <view v-for="item in visibleQuickItems" :key="item.key" class="quick-item" hover-class="quick-item--pressed" @tap="handleQuick(item)">
            <image :src="item.icon" mode="aspectFit" />
            <text>{{ item.title }}</text>
          </view>
        </view>

        <view class="menu-group">
        <view v-for="item in visibleMenuItems" :key="item.key" class="menu-row" hover-class="menu-row--pressed" @tap="handleMenu(item)">
            <view class="menu-icon"><image :src="item.icon" mode="aspectFit" /></view>
            <view class="menu-copy">
              <text class="menu-title">{{ item.title }}</text>
              <text class="menu-note">{{ item.note }}</text>
            </view>
            <text v-if="item.value" class="menu-value">{{ item.value }}</text>
            <text v-if="item.arrow !== false" class="menu-arrow">›</text>
          </view>
        </view>

        <view v-if="isLoggedIn && featureEnabled('invitations')" class="share-row" hover-class="menu-row--pressed" @tap="inviteVisible = true">
          <view class="menu-icon"><image src="/static/xjy/user/users.png" mode="aspectFit" /></view>
          <view class="menu-copy">
            <text class="menu-title">{{ appConfig.inviteTitle }}</text>
            <text class="menu-note">邀请客户、同事或合作伙伴</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>

        <button v-if="isLoggedIn" class="logout-button" @tap="logout">退出登录</button>

        <view class="version-text">
          <text>{{ appConfig.platformName }} v{{ appConfig.versionName }}</text>
          <text>Power by {{ appConfig.poweredBy }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="inviteVisible" class="invite-mask" @tap="inviteVisible = false">
      <view class="invite-sheet" @tap.stop>
        <view class="invite-handle"></view>
        <view class="invite-head"><text>选择邀请类型</text><text @tap="inviteVisible = false">×</text></view>
        <button class="invite-option" open-type="share" data-invite-type="normal" @tap="prepareInvite('normal')">
          <view class="invite-icon customer"><text>客</text></view><view><text>普通用户或客户</text><text>加入平台并关联邀请人</text></view><text>›</text>
        </button>
        <button v-if="currentUser.TenantId" class="invite-option" open-type="share" data-invite-type="business" @tap="prepareInvite('business')">
          <view class="invite-icon business"><text>商</text></view><view><text>商家入驻</text><text>提交商家资料并进入审核</text></view><text>›</text>
        </button>
        <button v-if="currentUser.TenantId" class="invite-option" open-type="share" data-invite-type="Insider" @tap="prepareInvite('Insider')">
          <view class="invite-icon insider"><text>内</text></view><view><text>内部人员</text><text>注册后加入当前组织</text></view><text>›</text>
        </button>
      </view>
    </view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { getToken, getUser, removeToken, V8 } from '@/utils/request.js'
import { themeMixin } from '@/utils/theme.js'
import { getRoleProfile } from '@/platform/business.js'
import { openBusiness, openForm, scanDevice } from '@/platform/business-runtime.js'
import { loadSummarySnapshot, readSummarySnapshot } from '@/platform/preload.js'
import { hasFeature, getProfileRoute } from '@/platform/profile/index.js'
import appConfig from '@/config.js'
import { buildInviteSharePayload } from '@/utils/share.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appConfig,
      statusBarHeight: 0,
      isLoggedIn: false,
      currentUser: {},
      avatarUrl: '',
      inviteVisible: false,
      inviteType: 'normal',
      summaryLoading: false,
      summary: { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 },
      quickItems: [
        { key: 'afterSalesAdd', title: '我要报修', icon: '/static/xjy/user/my-baoxiu.png', feature: 'serviceTasks' },
        { key: 'scan', title: '扫一扫', icon: appConfig.cdnAssets.scan, feature: 'scan' },
        { key: 'leads', title: '我的线索', icon: '/static/xjy/user/my-xiansuo.png', feature: 'business' },
        { key: 'points', title: '我的积分', icon: '/static/xjy/user/jifen.png', feature: 'business' }
      ],
      menuItems: [
        { key: 'personalInfo', title: '个人资料', note: '姓名、头像与联系方式', icon: '/static/xjy/user/users.png' },
        { key: 'password', title: '修改密码', note: '当前密码或短信验证', icon: '/static/xjy/business/shenqing.png' },
        { key: 'reminders', title: '提醒管理', note: '客户跟进与待办提醒', icon: '/static/xjy/business/tixing.png' },
        { key: 'providers', title: '我的服务商', note: '服务团队与联系方式', icon: '/static/xjy/user/fws.png', feature: 'business' },
        { key: 'intentions', title: '购买意向', note: '产品与服务意向记录', icon: '/static/xjy/user/my-goumaiyixiang.png', feature: 'business' },
        { key: 'favorites', title: '我的收藏', note: '已收藏商品与方案', icon: '/static/xjy/user/my-shoucang.png', feature: 'mall' },
        { key: 'members', title: '成员管理', note: '组织成员与权限入口', icon: '/static/xjy/user/my-chengyuan.jpg', feature: 'business' },
        { key: 'servicePhone', title: '平台客服', note: '工作日 08:30 - 18:00', value: '400-888-5680', arrow: false, icon: '/static/xjy/user/kefu.png' }
      ]
    }
  },
  computed: {
    roleProfile() { return getRoleProfile(this.currentUser) },
    avatarChar() { return String(this.currentUser.Name || this.currentUser.Account || '集').charAt(0) },
    orgText() {
      const values = [this.currentUser.TenantName, this.currentUser.DeptName].filter(Boolean)
      return values.join(' · ')
    },
    summaries() {
      return [
        { key: 'orders', label: '我的订单', value: this.summary.orders },
        { key: 'devices', label: '我的设备', value: this.summary.devices },
        { key: 'serviceRecords', label: '服务记录', value: this.summary.services }
      ]
    },
    visibleQuickItems() {
      const available = this.quickItems.filter((item) => !item.feature || hasFeature(item.feature))
      if (!this.isLoggedIn || this.roleProfile.isAdmin) return available
      const allowed = this.roleProfile.isCustomer
        ? ['afterSalesAdd', 'scan', 'points']
        : this.roleProfile.isSales
          ? ['scan', 'leads', 'points']
          : ['scan']
      return available.filter((item) => allowed.includes(item.key))
    },
    visibleMenuItems() {
      const available = this.menuItems.filter((item) => !item.feature || hasFeature(item.feature))
      if (!this.isLoggedIn || this.roleProfile.isAdmin) return available
      const common = ['personalInfo', 'password', 'reminders', 'servicePhone']
      const roleKeys = this.roleProfile.isCustomer ? ['providers', 'intentions', 'favorites'] : []
      return available.filter((item) => [...common, ...roleKeys].includes(item.key))
    }
  },
  onLoad() {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    const summary = readSummarySnapshot()
    if (summary) this.summary = summary
  },
  onShow() {
    this.isLoggedIn = !!getToken()
    this.currentUser = getUser() || {}
    this.resolveAvatar()
    if (this.isLoggedIn) this.loadSummary()
  },
  methods: {
    featureEnabled(name) {
      return hasFeature(name)
    },
    handleAvatarError() { this.avatarUrl = '' },
    async resolveAvatar() {
      const source = this.currentUser.Avatar || this.currentUser.HeadImg || ''
      if (!source) { this.avatarUrl = ''; return }
      try { this.avatarUrl = await V8.resolveAvatarUrl(source) } catch (e) { this.avatarUrl = '' }
    },
    async loadSummary() {
      this.summaryLoading = true
      try { this.summary = await loadSummarySnapshot() } catch (e) {} finally { this.summaryLoading = false }
    },
    compactNumber(value) {
      const number = Number(value || 0)
      return number >= 10000 ? `${(number / 10000).toFixed(1)}万` : String(number)
    },
    open(key) { openBusiness(key) },
    handleQuick(item) {
      if (!this.isLoggedIn) { this.goLogin(); return }
      if (item.key === 'scan') scanDevice()
      else openBusiness(item.key)
    },
    handleMenu(item) {
      if (!this.isLoggedIn) { this.goLogin(); return }
      if (item.key === 'servicePhone') uni.makePhoneCall({ phoneNumber: item.value })
      else if (item.key === 'personalInfo') this.openProfile()
      else if (item.key === 'password') uni.navigateTo({ url: getProfileRoute('password', '/pages/native/password') })
      else if (item.key === 'reminders') uni.navigateTo({ url: getProfileRoute('reminders', '/pages/native/reminders') })
      else openBusiness(item.key)
    },
    openProfile() {
      if (!this.isLoggedIn) { this.goLogin(); return }
      if (!this.currentUser.Id) return
      openForm({
        table: 'Sys_User',
        rowId: this.currentUser.Id,
        mode: 'Edit',
        title: '个人资料',
        recordAdapter: 'current-user',
        fieldNames: ['Avatar', 'No', 'Account', 'Name', 'Email', 'Phone', 'Sex', 'Remark'],
        readonlyFieldNames: ['No', 'Account', 'Phone'],
        includeRelated: false
      })
    },
    prepareInvite(type) {
      this.inviteType = type || 'normal'
      setTimeout(() => { this.inviteVisible = false }, 300)
    },
    goLogin() { uni.navigateTo({ url: getProfileRoute('login', '/pages/login/index') }) },
    logout() {
      uni.showModal({
        title: '退出登录',
        content: '退出后将无法查看客户、设备和服务数据。',
        success: (result) => {
          if (!result.confirm) return
          removeToken()
          this.isLoggedIn = false
          this.currentUser = {}
          this.summary = { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }
          uni.switchTab({ url: '/pages/workspace/index' })
        }
      })
    }
  },
  onShareAppMessage(event) {
    const targetType = event && event.target && event.target.dataset ? event.target.dataset.inviteType : ''
    return buildInviteSharePayload(targetType || this.inviteType, this.currentUser)
  }
}
</script>

<style lang="scss" scoped>
.profile-page { height: 100vh; overflow: hidden; background: #f4f8fa; color: #18313d; }
.profile-hero { position: relative; min-height: 306rpx; overflow: hidden; background: #063b5c; color: #fff; }
.hero-water { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-shade { position: absolute; inset: 0; background: linear-gradient(105deg, rgba(3, 39, 61, 0.94) 0%, rgba(3, 57, 82, 0.76) 54%, rgba(6, 83, 105, 0.36) 100%); }
.hero-top { position: relative; z-index: 1; display: flex; align-items: center; height: 88rpx; padding: 0 calc(28rpx + var(--mci-capsule-right)) 0 28rpx; }
.hero-brand { color: #fff; font-size: 31rpx; font-weight: 700; }
.user-info { position: relative; z-index: 1; display: grid; grid-template-columns: 112rpx minmax(0, 1fr) 36rpx; align-items: center; padding: 16rpx 30rpx 42rpx; }
.avatar { display: flex; align-items: center; justify-content: center; width: 96rpx; height: 96rpx; border: 4rpx solid rgba(255, 255, 255, 0.7); border-radius: 50%; overflow: hidden; background: #e94b2c; color: #fff; font-size: 38rpx; font-weight: 700; box-shadow: 0 8rpx 24rpx rgba(3, 53, 82, 0.2); }
.avatar image { width: 100%; height: 100%; }
.user-copy { display: flex; flex-direction: column; min-width: 0; }
.user-name-row { display: flex; align-items: center; min-width: 0; }
.user-name { max-width: 320rpx; overflow: hidden; color: #fff !important; font-size: 32rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.role-tag { flex: 0 0 auto; margin-left: 12rpx; padding: 5rpx 10rpx; border: 1rpx solid rgba(255, 255, 255, 0.32); border-radius: 8rpx; background: rgba(255, 255, 255, 0.12); font-size: 19rpx; }
.user-org { margin-top: 9rpx; overflow: hidden; color: rgba(255, 255, 255, 0.76); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.user-arrow { color: rgba(255, 255, 255, 0.7); font-size: 40rpx; text-align: right; }
.profile-scroll { height: calc(100vh - 306rpx - var(--mci-safe-top)); }
.profile-content { padding: 0 24rpx calc(42rpx + var(--mci-safe-bottom)); }
.summary-panel { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: -24rpx; border: 1rpx solid #e1ebef; border-radius: 16rpx; background: #fff; box-shadow: 0 8rpx 24rpx rgba(18, 73, 98, 0.08); }
.summary-item { position: relative; display: flex; flex-direction: column; align-items: center; padding: 24rpx 8rpx; }
.summary-item + .summary-item::before { position: absolute; top: 24rpx; bottom: 24rpx; left: 0; width: 1rpx; background: #e8f0f3; content: ''; }
.summary-value { font-size: 35rpx; font-weight: 700; color: #0b86d4; }
.summary-skeleton { width: 62rpx; height: 34rpx; border-radius: 6rpx; background: linear-gradient(90deg, #e7eef1 25%, #f7fafb 45%, #e7eef1 65%); background-size: 300% 100%; animation: profileSummaryShimmer 1.2s ease-in-out infinite; }
@keyframes profileSummaryShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.summary-label { margin-top: 5rpx; color: #718994; font-size: 22rpx; }
.quick-panel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 20rpx; padding: 18rpx 8rpx; border: 1rpx solid #e1ebef; border-radius: 16rpx; background: #fff; }
.quick-item { display: flex; flex-direction: column; align-items: center; min-width: 0; padding: 12rpx 4rpx; transition: transform 150ms ease; }
.quick-item--pressed { transform: scale(0.93); }
.quick-item image { width: 56rpx; height: 56rpx; border-radius: 8rpx; }
.quick-item text { width: 100%; margin-top: 10rpx; overflow: hidden; color: #3b5965; font-size: 22rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.menu-group, .share-row { margin-top: 20rpx; border: 1rpx solid #e1ebef; border-radius: 16rpx; overflow: hidden; background: #fff; }
.menu-row, .share-row { box-sizing: border-box; display: grid; grid-template-columns: 66rpx minmax(0, 1fr) auto 34rpx; align-items: center; width: 100%; min-height: 104rpx; padding: 10rpx 22rpx; border-bottom: 1rpx solid #edf3f5; transition: background 150ms ease; }
.menu-row:last-child { border-bottom: none; }
.menu-row--pressed { background: #f2f7f9; }
.menu-icon { display: flex; align-items: center; justify-content: center; width: 54rpx; height: 54rpx; border-radius: 12rpx; background: #f0f6f8; }
.menu-icon image { width: 38rpx; height: 38rpx; border-radius: 6rpx; }
.menu-copy { display: flex; flex-direction: column; min-width: 0; text-align: left; }
.menu-title { color: #2d4b57; font-size: 25rpx; font-weight: 600; }
.menu-note { margin-top: 4rpx; overflow: hidden; color: #8b9fa7; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.menu-value { margin-left: 12rpx; color: #0b86d4; font-size: 22rpx; }
.menu-arrow { color: #a2b1b7; font-size: 34rpx; text-align: right; }
.share-row { grid-template-columns: 66rpx minmax(0, 1fr) 34rpx; margin-bottom: 0; line-height: normal; }
.share-row::after { border: none; }
.invite-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(7, 28, 37, .48); }
.invite-sheet { box-sizing: border-box; width: 100%; padding: 12rpx 24rpx calc(24rpx + var(--mci-safe-bottom)); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: inviteUp 200ms ease-out both; }
.invite-handle { width: 72rpx; height: 7rpx; margin: 0 auto 10rpx; border-radius: 4rpx; background: #d7e1e5; }
.invite-head { display: flex; align-items: center; justify-content: space-between; height: 76rpx; color: #193640; font-size: 29rpx; font-weight: 700; }
.invite-head text:last-child { padding: 8rpx; color: #718891; font-size: 40rpx; font-weight: 400; }
.invite-option { display: grid; grid-template-columns: 66rpx minmax(0, 1fr) 34rpx; align-items: center; width: 100%; min-height: 104rpx; margin: 0; padding: 10rpx 4rpx; border-bottom: 1rpx solid #edf3f5; background: #fff; text-align: left; line-height: normal; }
.invite-option::after { border: none; }
.invite-option > view:nth-child(2) { display: flex; flex-direction: column; min-width: 0; }
.invite-option > view:nth-child(2) text:first-child { color: #294752; font-size: 25rpx; font-weight: 650; }
.invite-option > view:nth-child(2) text:last-child { margin-top: 5rpx; color: #8598a0; font-size: 20rpx; }
.invite-option > text:last-child { color: #9aacb3; font-size: 34rpx; text-align: right; }
.invite-icon { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; border-radius: 7rpx; color: #fff; font-size: 22rpx; font-weight: 700; }
.invite-icon.customer { background: #0b86d4; }.invite-icon.business { background: #1d956d; }.invite-icon.insider { background: #7356bd; }
@keyframes inviteUp { from { transform: translateY(100%); } to { transform: none; } }
.logout-button { width: 100%; height: 82rpx; margin: 22rpx 0 0; border: 1rpx solid #f0d9d4; border-radius: 16rpx; background: #fff; color: #d8492d; font-size: 26rpx; line-height: 82rpx; }
.logout-button::after { border: none; }
.version-text { display: flex; flex-direction: column; align-items: center; padding: 30rpx 0 18rpx; color: #a2b0b6; font-size: 19rpx; line-height: 30rpx; }
@media (prefers-reduced-motion: reduce) { .invite-sheet { animation: none; } }
</style>
