<template>
  <view class="profile-page" :style="mciTokenStyle">
    <view class="profile-hero mci-safe-top">
      <view class="hero-shade"></view>
      <view class="hero-top">
        <view><text class="hero-brand">我的</text><text class="hero-context">{{ runtimeBranding.platformName }}</text></view>
      </view>
      <view class="user-info" role="button" tabindex="0" @tap="openProfile" @keydown.enter="openProfile">
        <view class="avatar">
          <image v-if="avatarUrl" :src="avatarUrl" mode="aspectFill" @error="handleAvatarError" />
          <text v-else>{{ avatarChar }}</text>
        </view>
        <view v-if="isLoggedIn" class="user-copy">
          <view class="user-name-row">
            <text class="user-name">{{ currentUser.Name || currentUser.Account }}</text>
            <text class="role-tag">{{ roleProfile.primaryRole }}</text>
          </view>
          <text class="user-org">{{ orgText || runtimeBranding.servicePlatformName }}</text>
        </view>
        <view v-else class="user-copy" @tap.stop="goLogin">
          <text class="user-name">登录 / 注册</text>
          <text class="user-org">登录后查看企业应用与个人设置</text>
        </view>
        <view class="user-arrow" aria-hidden="true" />
      </view>
      <view class="profile-horizon" aria-hidden="true" />
    </view>

    <scroll-view class="profile-scroll" scroll-y>
      <view class="profile-content">
        <view class="menu-group">
        <view v-for="item in visibleMenuItems" :key="item.key" class="menu-row" hover-class="menu-row--pressed" role="button" tabindex="0" @tap="handleMenu(item)" @keydown.enter="handleMenu(item)">
            <mci-symbol :name="item.icon" :size="54" />
            <view class="menu-copy">
              <text class="menu-title">{{ item.title }}</text>
              <text class="menu-note">{{ item.note }}</text>
            </view>
            <!-- zhy：关于入口在有新版时突出“可更新”，其余状态显示真实运行版本。 -->
            <text v-if="item.value" class="menu-value" :class="{ 'menu-value--update': item.updateReady }">{{ item.value }}</text>
            <view v-if="item.arrow !== false" class="menu-arrow" aria-hidden="true" />
          </view>
        </view>

        <view v-if="isLoggedIn && inviteEntryEnabled && featureEnabled('invitations')" class="share-row" hover-class="menu-row--pressed" role="button" tabindex="0" @tap="inviteVisible = true" @keyup.enter="inviteVisible = true" @keyup.space.prevent="inviteVisible = true">
          <mci-symbol name="invite" :size="54" />
          <view class="menu-copy">
            <text class="menu-title">{{ appConfig.inviteTitle }}</text>
            <text class="menu-note">邀请客户、同事或合作伙伴</text>
          </view>
          <view class="menu-arrow" aria-hidden="true" />
        </view>

        <button v-if="isLoggedIn" class="logout-button" @tap="logout">
          <view class="logout-button__icon" aria-hidden="true"><view /></view>
          <text>退出登录</text>
        </button>

        <!-- 版本信息收口到可点击的“关于应用”入口，避免页面底部重复展示调试式版本块。 -->
        <view class="mci-tabbar-spacer" aria-hidden="true" />
      </view>
    </scroll-view>

    <view v-if="inviteEntryEnabled && inviteVisible" class="invite-mask" @tap="inviteVisible = false">
      <view class="invite-sheet" @tap.stop>
        <view class="invite-handle"></view>
        <view class="invite-head"><text>选择邀请类型</text><view class="invite-close" role="button" tabindex="0" aria-label="关闭" @tap="inviteVisible = false" @keyup.enter="inviteVisible = false" @keyup.space.prevent="inviteVisible = false"><view class="mci-icon-close" aria-hidden="true" /></view></view>
        <button class="invite-option" open-type="share" data-invite-type="normal" @tap="prepareInvite('normal')">
          <mci-symbol name="customer" tone="plain" :size="54" /><view><text>普通用户或客户</text><text>加入平台并关联邀请人</text></view><view class="menu-arrow" aria-hidden="true" />
        </button>
        <button v-if="currentUser.TenantId" class="invite-option" open-type="share" data-invite-type="business" @tap="prepareInvite('business')">
          <mci-symbol name="business" tone="plain" :size="54" /><view><text>商家入驻</text><text>提交商家资料并进入审核</text></view><view class="menu-arrow" aria-hidden="true" />
        </button>
        <button v-if="currentUser.TenantId" class="invite-option" open-type="share" data-invite-type="Insider" @tap="prepareInvite('Insider')">
          <mci-symbol name="team" tone="plain" :size="54" /><view><text>内部人员</text><text>注册后加入当前组织</text></view><view class="menu-arrow" aria-hidden="true" />
        </button>
      </view>
    </view>
    <view v-if="themeSheetVisible" class="theme-mask" @tap="themeSheetVisible = false">
      <view class="theme-sheet" role="dialog" aria-modal="true" aria-label="选择颜色主题" @tap.stop>
        <view class="theme-sheet__handle" aria-hidden="true" />
        <view class="theme-sheet__head">
          <view>
            <text class="theme-sheet__title">颜色主题</text>
            <text class="theme-sheet__note">默认跟随 PC 端，移动端选择仅保存在当前企业</text>
          </view>
          <view class="theme-sheet__close" role="button" tabindex="0" aria-label="关闭主题选择" @tap="themeSheetVisible = false" @keyup.enter="themeSheetVisible = false" @keyup.space.prevent="themeSheetVisible = false">
            <view class="mci-icon-close" aria-hidden="true" />
          </view>
        </view>
        <view class="theme-grid" role="list" aria-label="可选颜色主题">
          <view
            v-for="option in themeOptions"
            :key="option.key"
            class="theme-option"
            :class="{ 'theme-option--active': option.key === currentThemeMode }"
            hover-class="theme-option--pressed"
            role="button"
            tabindex="0"
            :aria-label="`选择${option.label}`"
            @tap="selectTheme(option)"
            @keyup.enter="selectTheme(option)"
            @keyup.space.prevent="selectTheme(option)"
          >
            <view class="theme-option__swatch" :style="{ backgroundColor: option.color }">
              <view v-if="option.key === currentThemeMode" class="theme-option__check" aria-hidden="true" />
            </view>
            <text>{{ option.label }}</text>
          </view>
        </view>
      </view>
    </view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { getToken, getUser, removeToken, V8 } from '@/utils/request.js'
import { getThemeLabel, getThemeMode, getThemeOptions, setThemeMode, themeMixin } from '@/utils/theme.js'
import { getRoleProfile } from '@/platform/business.js'
import { openForm } from '@/platform/business-runtime.js'
import { hasFeature, getProfileRoute } from '@/platform/profile/index.js'
import appConfig from '@/config.js'
import { buildInviteSharePayload } from '@/utils/share.js'
import { getInviteEntryEnabled } from '@/utils/sysconfig.js'
import { disconnectSignalR } from '@/utils/signalr.js'
import { reLaunchToLogin } from '@/platform/auth-entry.mjs'
import {
  getMiniProgramUpdateState,
  initializeMiniProgramUpdate,
  subscribeMiniProgramUpdate
} from '@/platform/mini-program-update.js'

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
      inviteEntryEnabled: true,
      themeSheetVisible: false,
      inviteType: 'normal',
      // zhy：我的页只订阅平台级状态，不自行创建或检查更新管理器。
      updateState: getMiniProgramUpdateState(),
      updateUnsubscribe: null,
      menuItems: [
        { key: 'personalInfo', title: '个人资料', note: '姓名、头像与联系方式', icon: 'profile' },
        { key: 'password', title: '修改密码', note: '更新当前企业账号密码', icon: 'password' },
        { key: 'reminders', title: '提醒管理', note: '管理移动端待办提醒', icon: 'reminders' },
        { key: 'platformConnection', title: '平台连接', note: 'API 地址与 OsClient', icon: 'connection', public: true, endpointEditor: true },
        { key: 'theme', title: '颜色主题', note: '默认跟随 PC，可在移动端重新选择', icon: 'settings', public: true },
        { key: 'about', title: '关于应用', note: '版本、服务协议与隐私政策', icon: 'info', public: true }
      ]
    }
  },
  computed: {
    currentThemeMode() {
      void this.mciThemeRevision
      return getThemeMode()
    },
    currentThemeLabel() {
      void this.mciThemeRevision
      return getThemeLabel()
    },
    themeOptions() {
      void this.mciThemeRevision
      return getThemeOptions()
    },
    roleProfile() { return getRoleProfile(this.currentUser) },
    avatarChar() { return String(this.currentUser.Name || this.currentUser.Account || '吾').charAt(0) },
    orgText() {
      const values = [this.currentUser.TenantName, this.currentUser.DeptName].filter(Boolean)
      return values.join(' · ')
    },
    visibleMenuItems() {
      // About 行根据全局更新状态实时显示版本或可更新提示。
      const available = this.menuItems
        .filter((item) => !item.feature || hasFeature(item.feature))
        .filter((item) => !item.endpointEditor || appConfig.runtimeEndpointEditorEnabled === true)
        .map((item) => {
          if (item.key === 'platformConnection') {
            return {
              ...item,
              note: `${String(appConfig.apiBase || '').replace(/^https?:\/\//, '')} · OsClient`,
              value: appConfig.osClient || ''
            }
          }
          if (item.key === 'theme') return { ...item, value: this.currentThemeLabel }
          if (item.key !== 'about') return item
          return {
            ...item,
            title: `关于${this.runtimeBranding.appName || '吾码'}`,
            note: this.updateState.message || '版本与更新',
            value: this.updateState.updateReady ? '可更新' : `v${this.updateState.version || appConfig.versionName}`,
            updateReady: this.updateState.updateReady
          }
        })
      if (!this.isLoggedIn || this.roleProfile.isAdmin) return available
      return available.filter((item) => ['personalInfo', 'password', 'reminders', 'platformConnection', 'theme', 'about'].includes(item.key))
    }
  },
  onLoad() {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    // zhy：进入我的页即可拿到 App 已完成的检查状态；兜底初始化不会重复注册监听。
    initializeMiniProgramUpdate({ promptOnReady: true })
    this.updateUnsubscribe = subscribeMiniProgramUpdate((nextState) => {
      this.updateState = nextState
    })
  },
  onShow() {
    uni.$emit('mci:tab-route', 'pages/profile/index')
    const token = getToken()
    const currentUser = getUser() || {}
    this.isLoggedIn = !!token && !!currentUser.Id
    this.currentUser = this.isLoggedIn ? currentUser : {}
    if (!this.isLoggedIn) {
      if (token) removeToken()
      reLaunchToLogin({ base: getProfileRoute('login', '/pages/login/index') })
      return
    }
    this.resolveAvatar()
    this.resolveInviteEntryVisibility()
  },
  onUnload() {
    // zhy：释放页面订阅，避免重复进入后残留监听。
    if (this.updateUnsubscribe) this.updateUnsubscribe()
    this.updateUnsubscribe = null
  },
  methods: {
    featureEnabled(name) {
      return hasFeature(name)
    },
    async resolveInviteEntryVisibility() {
      const enabled = await getInviteEntryEnabled()
      this.inviteEntryEnabled = enabled
      if (!enabled) this.inviteVisible = false
    },
    handleAvatarError() { this.avatarUrl = '' },
    async resolveAvatar() {
      const source = this.currentUser.Avatar || this.currentUser.HeadImg || ''
      if (!source) { this.avatarUrl = ''; return }
      try {
        this.avatarUrl = await V8.resolveAvatarUrl(source, {
          resourceKind: 'UserAvatar',
          resourceId: this.currentUser.Id
        })
      } catch (e) { this.avatarUrl = '' }
    },
    handleMenu(item) {
      // 关于应用无需登录，未登录用户也必须能够查看版本和更新状态。
      if (item.key === 'theme') {
        this.themeSheetVisible = true
        return
      }
      if (item.key === 'about') {
        uni.navigateTo({ url: getProfileRoute('about', '/pages/about/index') })
        return
      }
      if (item.key === 'platformConnection') {
        this.openPlatformConnection()
        return
      }
      if (!this.isLoggedIn) { this.goLogin(); return }
      if (item.key === 'servicePhone') uni.makePhoneCall({ phoneNumber: item.value })
      else if (item.key === 'personalInfo') this.openProfile()
      else if (item.key === 'password') uni.navigateTo({ url: getProfileRoute('password', '/pages/native/password') })
      else if (item.key === 'reminders') uni.navigateTo({ url: getProfileRoute('reminders', '/pages/native/reminders') })
    },
    selectTheme(option) {
      if (!option || !option.key) return
      setThemeMode(option.key)
      this.themeSheetVisible = false
      uni.showToast({
        title: option.key === 'system' ? '已跟随 PC 主题' : `已切换为${option.label}`,
        icon: 'none'
      })
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
        fieldNames: [
          'Avatar', // 个人资料页暂时隐藏头像，保留配置便于后续恢复。
          'No', 'Account', 'Name', 'Email', 'Phone', 'Sex', 'Remark'
        ],
        readonlyFieldNames: ['No', 'Account', 'Phone'],
        includeRelated: false
      })
    },
    prepareInvite(type) {
      this.inviteType = type || 'normal'
      setTimeout(() => { this.inviteVisible = false }, 300)
    },
    goLogin() { reLaunchToLogin({ base: getProfileRoute('login', '/pages/login/index') }) },
    openPlatformConnection() {
      if (appConfig.runtimeEndpointEditorEnabled !== true) return
      const loginRoute = getProfileRoute('login', '/pages/login/index')
      const openEditor = (logout = false) => reLaunchToLogin({ base: loginRoute, endpoint: true, logout })

      if (!this.isLoggedIn) {
        openEditor()
        return
      }

      uni.showModal({
        title: '切换平台连接',
        content: '切换 API 或 OsClient 需要先退出当前账号。应用连接新平台时会清除旧企业的会话与业务缓存，是否继续？',
        confirmText: '退出并切换',
        success: (result) => {
          if (!result.confirm) return
          disconnectSignalR()
          removeToken()
          this.isLoggedIn = false
          this.currentUser = {}
          openEditor(true)
        }
      })
    },
    logout() {
      uni.showModal({
        title: '退出登录',
        content: '退出后需要重新登录才能访问当前企业应用。',
        success: (result) => {
          if (!result.confirm) return
          disconnectSignalR()
          removeToken()
          this.isLoggedIn = false
          this.currentUser = {}
          reLaunchToLogin({ base: getProfileRoute('login', '/pages/login/index'), logout: true })
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
.avatar { display: flex; align-items: center; justify-content: center; width: 96rpx; height: 96rpx; border: 4rpx solid rgba(255, 255, 255, 0.7); border-radius: 50%; overflow: hidden; background: var(--mci-color-brand, #c43b20); color: #fff; font-size: 38rpx; font-weight: 700; box-shadow: 0 8rpx 24rpx rgba(3, 53, 82, 0.2); }
.avatar image { width: 100%; height: 100%; }
.user-copy { display: flex; flex-direction: column; min-width: 0; }
.user-name-row { display: flex; align-items: center; min-width: 0; }
.user-name { max-width: 320rpx; overflow: hidden; color: #fff !important; font-size: 32rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.role-tag { flex: 0 0 auto; margin-left: 12rpx; padding: 5rpx 10rpx; border: 1rpx solid rgba(255, 255, 255, 0.32); border-radius: 8rpx; background: rgba(255, 255, 255, 0.12); font-size: 19rpx; }
.user-org { margin-top: 9rpx; overflow: hidden; color: rgba(255, 255, 255, 0.76); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.user-arrow { color: rgba(255, 255, 255, 0.7); font-size: 40rpx; text-align: right; }
.profile-scroll { height: calc(100vh - 306rpx - var(--mci-safe-top)); }
.profile-content { padding: 0 24rpx 24rpx; }
.menu-group, .share-row { margin-top: 20rpx; border: 1rpx solid #e1ebef; border-radius: 16rpx; overflow: hidden; background: #fff; }
.menu-row, .share-row { box-sizing: border-box; display: grid; grid-template-columns: 66rpx minmax(0, 1fr) auto 34rpx; align-items: center; width: 100%; min-height: 104rpx; padding: 10rpx 22rpx; border-bottom: 1rpx solid #edf3f5; transition: background 150ms ease; }
.menu-row:last-child { border-bottom: none; }
.menu-row--pressed { background: #f2f7f9; }
.menu-icon { display: flex; align-items: center; justify-content: center; width: 54rpx; height: 54rpx; border-radius: 12rpx; background: #f0f6f8; }
.menu-icon text { color: #087da8; font-size: 23rpx; font-weight: 750; }
.menu-copy { display: flex; flex-direction: column; min-width: 0; text-align: left; }
.menu-title { color: #2d4b57; font-size: 25rpx; font-weight: 600; }
.menu-note { margin-top: 4rpx; overflow: hidden; color: #536b76; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.menu-value { margin-left: 12rpx; color: var(--mci-color-primary, #006b9f); font-size: 22rpx; }
/* zhy：新版已就绪时使用醒目的胶囊状态，但不改变整行布局。 */
.menu-value--update { padding: 5rpx 12rpx; border-radius: 999rpx; background: #fff0ed; color: #d8492d; font-weight: 700; }
.menu-arrow { color: #536b76; font-size: 34rpx; text-align: right; }
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
@media (prefers-reduced-motion: reduce) { .invite-sheet { animation: none; } }
</style>

<style lang="scss" scoped>
/* Light Field profile: identity deck + continuous settings rails. */
.profile-page { background: var(--mci-app-canvas, #f4f6f5); color: var(--mci-text-primary, #17313d); }
.profile-hero { min-height: 330rpx; overflow: hidden; background: var(--mci-gradient-primary); }
.hero-water { display: none; }
.hero-shade { background: linear-gradient(118deg, rgba(2, 29, 48, .30), rgba(255,255,255,.02) 68%); }
.hero-top { height: 92rpx; padding: 0 calc(32rpx + var(--mci-capsule-right)) 0 32rpx; }
.hero-top > view { min-width: 0; display: flex; align-items: baseline; gap: 14rpx; }
.hero-brand { color: var(--mci-text-on-primary, #fff); font-size: 34rpx; font-weight: 720; letter-spacing: -.02em; }
.hero-context { overflow: hidden; color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.user-info { grid-template-columns: 104rpx minmax(0, 1fr) 44rpx; min-height: 154rpx; padding: 16rpx 34rpx 46rpx; }
.avatar { width: 86rpx; height: 86rpx; border: 3rpx solid rgba(255,255,255,.62); background: var(--mci-color-brand, #e54625); box-shadow: none; }
.user-name { color: var(--mci-text-on-primary, #fff) !important; font-size: 34rpx; font-weight: 720; letter-spacing: -.01em; }
.role-tag { padding: 5rpx 11rpx; border-color: var(--mci-border-on-primary, rgba(255,255,255,.2)); border-radius: 999rpx; color: var(--mci-text-on-primary, #fff); background: var(--mci-surface-on-primary, rgba(255,255,255,.1)); font-size: 20rpx; }
.user-org { color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 23rpx; }
.user-arrow, .menu-arrow { width: 16rpx; height: 16rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; color: var(--mci-text-tertiary, rgba(23,49,61,.46)); transform: rotate(45deg); }
.user-arrow { justify-self: end; color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); }
.profile-horizon { position: absolute; right: -12%; bottom: -88rpx; left: -12%; height: 126rpx; border-radius: 50% 50% 0 0; background: var(--mci-home-horizon, #fff1e4); }
.profile-scroll { height: calc(100vh - 330rpx - var(--mci-safe-top)); }
.profile-content { position: relative; z-index: 2; padding: 0 24rpx 24rpx; }
.menu-group, .share-row { margin-top: 24rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); }
.menu-row, .share-row { grid-template-columns: 72rpx minmax(0, 1fr) auto 28rpx; min-height: 112rpx; padding: 12rpx 24rpx; border-bottom-color: var(--mci-divider, rgba(20,65,84,.1)); }
.share-row { grid-template-columns: 72rpx minmax(0, 1fr) 28rpx; }
.menu-row--pressed { background: var(--mci-app-surface-soft, #eef3f2); }
.menu-icon { display: none; }
.menu-title { color: var(--mci-text-primary, #17313d); font-size: 27rpx; font-weight: 650; }
.menu-note { margin-top: 5rpx; color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 21rpx; }
.menu-value { color: var(--mci-color-primary, #087da8); font-size: 21rpx; }
.menu-value--update { background: var(--mci-color-danger-soft, #f8e8e5); color: var(--mci-color-danger, #c74a3a); }
.logout-button { height: 88rpx; margin-top: 28rpx; border-color: rgba(199,74,58,.16); border-radius: 24rpx; background: var(--mci-color-danger-soft, #f8e8e5); color: var(--mci-color-danger, #c74a3a); font-size: 26rpx; line-height: 88rpx; }
.invite-mask { background: rgba(7,28,37,.46); }
.invite-sheet { padding: 16rpx 28rpx calc(30rpx + var(--mci-safe-bottom)); border-radius: 32rpx 32rpx 0 0; background: var(--mci-app-surface, #fefffe); }
.invite-head { min-height: 88rpx; color: var(--mci-text-primary, #17313d); }
.invite-head text:last-child { min-width: 64rpx; min-height: 64rpx; color: var(--mci-text-secondary, rgba(23,49,61,.66)); text-align: center; }
.invite-close { min-width: 88rpx; min-height: 88rpx; margin-right: -22rpx; display: flex; align-items: center; justify-content: center; color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.invite-option { grid-template-columns: 72rpx minmax(0, 1fr) 28rpx; min-height: 112rpx; border-bottom-color: var(--mci-divider, rgba(20,65,84,.1)); background: transparent; }
.invite-option > view:nth-child(2) text:first-child { color: var(--mci-text-primary, #17313d); font-size: 26rpx; }
.invite-option > view:nth-child(2) text:last-child { color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 21rpx; }
.invite-icon { display: none; }
.theme-mask { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: flex-end; background: rgba(7,28,37,.46); }
.theme-sheet { width: 100%; padding: 16rpx 28rpx calc(30rpx + var(--mci-safe-bottom)); box-sizing: border-box; border-radius: 32rpx 32rpx 0 0; background: var(--mci-app-surface, #fff); box-shadow: 0 -18rpx 46rpx rgba(15,23,42,.16); }
.theme-sheet__handle { width: 72rpx; height: 7rpx; margin: 0 auto 12rpx; border-radius: 999rpx; background: var(--mci-border-color-hover, #cbd5e1); }
.theme-sheet__head { min-height: 94rpx; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.theme-sheet__head > view:first-child { min-width: 0; display: flex; flex-direction: column; }
.theme-sheet__title { color: var(--mci-text-primary, #111827); font-size: 32rpx; line-height: 42rpx; font-weight: 720; }
.theme-sheet__note { margin-top: 5rpx; color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 32rpx; }
.theme-sheet__close { width: 88rpx; height: 88rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--mci-text-secondary, #667280); }
.theme-grid { padding: 18rpx 0 10rpx; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18rpx 12rpx; }
.theme-option { min-width: 0; min-height: 112rpx; padding: 10rpx 6rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9rpx; box-sizing: border-box; border: 2rpx solid transparent; border-radius: 18rpx; color: var(--mci-text-secondary, #667280); transition: transform .15s ease, border-color .15s ease, background-color .15s ease; }
.theme-option--active { border-color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-faint, rgba(37,99,235,.045)); color: var(--mci-text-primary, #111827); }
.theme-option--pressed { transform: scale(.95); background: var(--mci-app-surface-soft, #f1f5f9); }
.theme-option__swatch { position: relative; width: 54rpx; height: 54rpx; border: 3rpx solid rgba(255,255,255,.96); border-radius: 50%; box-shadow: 0 0 0 2rpx var(--mci-border-color, #e5e7eb), 0 6rpx 14rpx rgba(15,23,42,.12); }
.theme-option__check { position: absolute; top: 13rpx; left: 15rpx; width: 20rpx; height: 11rpx; border-bottom: 4rpx solid #fff; border-left: 4rpx solid #fff; filter: drop-shadow(0 1rpx 2rpx rgba(0,0,0,.35)); transform: rotate(-45deg); }
.theme-option > text { max-width: 100%; overflow: hidden; font-size: 21rpx; line-height: 28rpx; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .menu-row { transition: none; } }
</style>

<style lang="scss" scoped src="./profile-signal.scss"></style>
