<template>
  <!--
    THESIS: 用一套蓝白原生管理界面，让真实工作状态与下一步操作一眼可见。
    OWN-WORLD: 租户主色概览板、紧凑业务列表、四列应用启动器、贴底原生导航。
    STORY: 企业与身份 → 工作概览 → 常用应用 → 待办或继续处理。
    FIRST VIEWPORT: 工作台标题、问候、数据看板、常用应用与我的待办首行。
    FORM: 明亮中性画布、白色表面、12–16px 圆角、单一克制阴影、真实语义色。
  -->
  <view class="native-home" :style="mciTokenStyle">
    <scroll-view class="native-home__scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="refreshAll">
      <view class="native-home__masthead mci-safe-top">
        <image v-if="heroBackground" class="native-home__masthead-image" :src="heroBackground" mode="aspectFill" aria-hidden="true" />
        <view class="native-home__masthead-shade" aria-hidden="true" />
        <view class="native-home__topbar">
          <text class="native-home__page-title" role="heading" aria-level="1">工作台</text>
          <view class="native-home__top-actions">
            <view class="native-home__icon-button" hover-class="native-home__icon-button--pressed" role="button" tabindex="0" aria-label="查找应用与功能" @tap="goWorkspace" @keyup.enter="goWorkspace" @keyup.space.prevent="goWorkspace">
              <view class="native-home__search-symbol" aria-hidden="true" />
            </view>
            <view v-if="featureEnabled('scan')" class="native-home__icon-button" hover-class="native-home__icon-button--pressed" role="button" tabindex="0" aria-label="扫一扫" @tap="handleScan" @keyup.enter="handleScan" @keyup.space.prevent="handleScan">
              <view class="native-home__scan-top-symbol" aria-hidden="true"><view /></view>
            </view>
            <view v-else-if="featureEnabled('messages')" class="native-home__icon-button" hover-class="native-home__icon-button--pressed" role="button" tabindex="0" aria-label="打开消息中心" @tap="goMessages" @keyup.enter="goMessages" @keyup.space.prevent="goMessages">
              <view class="native-home__message-symbol" aria-hidden="true" />
            </view>
          </view>
        </view>

        <view class="native-home__welcome">
          <view class="native-home__welcome-copy">
            <text class="native-home__welcome-title" role="heading" aria-level="1">{{ welcomeText }}</text>
            <text class="native-home__identity">欢迎使用 {{ heroTitle }}</text>
          </view>
          <view v-if="!isLoggedIn" class="native-home__login" hover-class="native-home__login--pressed" role="button" tabindex="0" @tap="goLogin" @keyup.enter="goLogin" @keyup.space.prevent="goLogin">
            <view class="native-home__login-icon" aria-hidden="true"><view /></view>
            <text>登录</text>
          </view>
        </view>
      </view>

      <view id="home-main" class="native-home__content" role="main" :aria-busy="loading">
        <view v-if="!isLoggedIn" class="native-home__auth-wrap">
          <mci-auth-prompt title="登录后进入企业作业台" desc="功能、表单和数据严格按当前账号权限加载" action-text="立即登录" @action="goLogin" />
        </view>

        <template v-else>
          <view v-if="overviewMetrics.length" class="native-home__metric-strip" hover-class="native-home__metric-strip--pressed" role="button" tabindex="0" aria-label="打开数据看板" @tap="goDashboard" @keyup.enter="goDashboard" @keyup.space.prevent="goDashboard">
            <view class="native-home__overview-head">
              <text>{{ overviewTitle }}</text>
              <view class="native-home__overview-period"><text>{{ overviewPeriod }}</text><view class="native-home__overview-arrow" aria-hidden="true" /></view>
            </view>
            <view class="native-home__metrics">
              <view v-for="metric in overviewMetrics" :key="metric.key" class="native-home__metric">
                <view v-if="loading" class="native-home__metric-skeleton" />
                <text v-else class="native-home__metric-value">{{ metric.value }}</text>
                <text class="native-home__metric-label">{{ metric.label }}</text>
              </view>
            </view>
          </view>

          <view class="native-home__section native-home__apps-panel">
            <view class="native-home__section-heading">
              <view>
                <text class="native-home__section-title" role="heading" aria-level="2">常用应用</text>
                <text class="native-home__section-subtitle">{{ recentModules.length ? '最近使用优先，并按当前权限补充' : '从当前账号授权应用中推荐' }}</text>
              </view>
              <view class="native-home__section-action" hover-class="native-home__section-action--pressed" role="button" tabindex="0" aria-label="打开全部应用" @tap="goWorkspace" @keyup.enter="goWorkspace" @keyup.space.prevent="goWorkspace"><text>全部</text><view class="native-home__row-arrow" aria-hidden="true" /></view>
            </view>
            <view v-if="loading && !homeLaunchItems.length" class="native-home__app-grid" aria-hidden="true">
              <view v-for="index in 4" :key="index" class="native-home__app-skeleton"><view /><view /></view>
            </view>
            <view v-else-if="homeLaunchItems.length" class="native-home__app-grid">
              <view v-for="item in homeLaunchItems" :key="item.menuId || item.key" class="native-home__app" hover-class="native-home__app--pressed" role="button" tabindex="0" @tap="openRuntimeModule(item)" @keyup.enter="openRuntimeModule(item)" @keyup.space.prevent="openRuntimeModule(item)">
                <view v-if="hasUsableIcon(item.icon)" class="native-home__app-icon"><image :src="actionIcon(item.icon)" mode="aspectFit" aria-hidden="true" /></view>
                <mci-symbol v-else :name="semanticIcon(item)" :size="70" />
                <text>{{ item.title }}</text>
              </view>
            </view>
            <view v-else class="native-home__apps-empty">
              <mci-symbol name="app" tone="plain" :size="52" />
              <view><text>暂无可用应用</text><text>请联系管理员检查菜单与角色权限</text></view>
            </view>
          </view>

          <view class="native-home__section native-home__todo-panel">
            <view class="native-home__section-heading">
              <view>
                <text class="native-home__section-title" role="heading" aria-level="2">我的待办</text>
                <text class="native-home__section-subtitle">{{ todoSubtitle }}</text>
              </view>
              <text v-if="todoTotal" class="native-home__count-badge">{{ todoTotal }}</text>
            </view>
            <view v-if="homeTodoItems.length" class="native-home__todo-list">
              <view v-for="item in homeTodoItems" :key="item.key" class="native-home__todo" hover-class="native-home__todo--pressed" role="button" tabindex="0" @tap="openHomeTodo(item)" @keyup.enter="openHomeTodo(item)" @keyup.space.prevent="openHomeTodo(item)">
                <mci-symbol :name="item.type === 'reminder' ? 'reminders' : semanticIcon(item)" tone="plain" :size="42" />
                <view class="native-home__todo-copy"><text>{{ item.title }}</text><text>{{ item.subtitle }}</text></view>
                <text v-if="item.timeLabel" class="native-home__todo-time" :class="{ 'native-home__todo-time--danger': item.tone === 'danger' }">{{ item.timeLabel }}</text>
                <view v-else class="native-home__row-arrow" aria-hidden="true" />
              </view>
            </view>
            <view v-else class="native-home__todo-empty" hover-class="native-home__todo-empty--pressed" role="button" tabindex="0" @tap="goReminders" @keyup.enter="goReminders" @keyup.space.prevent="goReminders">
              <mci-symbol name="reminders" tone="plain" :size="44" />
              <view><text>当前没有待办事项</text><text>可在提醒管理中创建个人待办</text></view>
              <view class="native-home__row-arrow" aria-hidden="true" />
            </view>
            <view class="native-home__todo-footer" hover-class="native-home__todo-footer--pressed" role="button" tabindex="0" @tap="goReminders" @keyup.enter="goReminders" @keyup.space.prevent="goReminders">
              <text>{{ reminders.length ? `查看全部（${reminders.length}）` : '提醒管理' }}</text><view class="native-home__row-arrow" aria-hidden="true" />
            </view>
          </view>
        </template>
        <view class="mci-tabbar-spacer" aria-hidden="true" />
      </view>
    </scroll-view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import appConfig from '@/config.js'
import MciAuthPrompt from '@/components/mci-auth-prompt/mci-auth-prompt.vue'
import MciSymbol from '@/components/mci-symbol/mci-symbol.vue'
import { getToken, getUser, removeToken } from '@/utils/request.js'
import { getAiAssistantEnabled, getSysConfig } from '@/utils/sysconfig.js'
import { themeMixin } from '@/utils/theme.js'
import { getRoleProfile } from '@/platform/business.js'
import { openBusiness, scanDevice } from '@/platform/business-runtime.js'
import { loadAccessibleModuleGroups } from '@/platform/module-registry.js'
import { loadSummarySnapshot, readSummarySnapshot, warmPrimaryTabs } from '@/platform/preload.js'
import { hasFeature, getProfileRoute } from '@/platform/profile/index.js'
import { captureInvitation } from '@/platform/invitation.js'
import { loadHomeViewManifest, compileHomeConfig } from '@/platform/view-manifest.js'
import { loadViewMetricValues } from '@/platform/view-metrics.js'
import { executeViewAction } from '@/platform/view-actions.js'
import { publicAssetUrl } from '@/platform/display.js'
import { buildDefaultHomeActions } from '@/platform/home-workbench.mjs'
import { buildFallbackHomeMetrics, buildHomeTodoItems } from '@/platform/home-todo.mjs'
import { readRecentModules, rememberRecentModule } from '@/platform/home-recent.js'
import { openModuleEntry } from '@/platform/module-navigation.mjs'
import { resolveSemanticIcon } from '@/platform/semantic-icon.mjs'
import { loadReminders } from '@/platform/reminders.js'
import shareMixin from '@/utils/share.js'
import { reLaunchToLogin } from '@/platform/auth-entry.mjs'

const EMPTY_SUMMARY = Object.freeze({ orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 })

export default {
  name: 'NativeHomePage',
  components: { MciAuthPrompt, MciSymbol },
  mixins: [themeMixin, shareMixin],
  data() {
    return {
      appConfig,
      isLoggedIn: false,
      currentUser: {},
      runtimeBusinessGroups: [],
      recentModules: [],
      homeManifest: null,
      homeConfig: null,
      metricValues: {},
      reminders: [],
      aiAssistantEnabled: false,
      summary: { ...EMPTY_SUMMARY },
      loading: false,
      refreshing: false,
      requestId: 0
    }
  },
  computed: {
    roleProfile() { return getRoleProfile(this.currentUser) },
    heroTitle() { return this.homeConfig?.hero?.title || this.runtimeBranding.platformName },
    heroSubtitle() { return this.homeConfig?.hero?.subtitle || this.runtimeBranding.workspaceSubTitle },
    heroIcon() { return this.actionIcon(this.homeConfig?.hero?.icon || this.runtimeBranding.logoUrl) },
    heroBackground() {
      const configured = this.homeConfig?.hero?.background
      return configured ? publicAssetUrl(configured) : this.profileAssets.waterHero
    },
    welcomeText() {
      if (!this.isLoggedIn) return appConfig.guestWelcomeText
      const name = this.currentUser.Name || this.currentUser.Account || '您好'
      const hour = new Date().getHours()
      const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
      return `${greeting}，${name}`
    },
    welcomeIdentity() {
      if (!this.isLoggedIn) return appConfig.workspaceSubTitle
      return this.roleProfile.identityText || this.roleProfile.roleText
    },
    todayText() {
      const now = new Date()
      try {
        return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(now)
      } catch (error) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
      }
    },
    runtimeModules() { return this.runtimeBusinessGroups.flatMap((group) => group.items || []) },
    workspacePreviewGroups() { return this.runtimeBusinessGroups.filter((group) => group.items?.length).slice(0, 4) },
    homeLaunchItems() {
      const recentKeys = new Set(this.recentModules.map((item) => item.menuId || item.key).filter(Boolean))
      const authorizedFallback = this.runtimeModules.filter((item) => !recentKeys.has(item.menuId || item.key))
      return [...this.recentModules, ...authorizedFallback].slice(0, 8)
    },
    quickBlock() { return this.findBlock('ActionGrid') || {} },
    metricBlock() { return this.findBlock('MetricStrip') || {} },
    configuredQuickActions() {
      if (this.quickBlock.actions?.length) return this.quickBlock.actions
      return this.homeConfig?.actions || []
    },
    usesDefaultHomeActions() { return !this.configuredQuickActions.length },
    workspaceHint() {
      if (this.loading && !this.runtimeModules.length) return '正在读取当前账号权限…'
      if (this.runtimeModules.length) return `${this.runtimeModules.length} 个授权应用可用`
      return '应用将按当前账号权限显示'
    },
    workspaceStatus() {
      if (this.loading && !this.runtimeModules.length) return '正在同步工作空间'
      if (this.runtimeModules.length) {
        return `${this.runtimeModules.length} 个应用 · ${this.runtimeBusinessGroups.length} 个分组 · 按账号权限加载`
      }
      return '工作空间按当前账号权限加载'
    },
    highlightBlock() { return this.findBlock('ModuleHighlights') || {} },
    noticeBlock() { return this.findBlock('NoticeList') || {} },
    promiseBlock() { return this.findBlock('ServicePromise') || {} },
    quickItems() {
      const actions = this.configuredQuickActions
      if (actions.length) {
        return actions.slice(0, this.quickBlock.limit || 8).map((action) => ({
          key: action.Key,
          title: action.Label,
          subtitle: action.Description || action.Desc || '',
          icon: this.actionIcon(action.Icon),
          accent: this.actionAccent(action.Tone),
          action
        }))
      }
      return buildDefaultHomeActions(appConfig.features || {})
    },
    secondaryQuickItems() {
      return this.quickItems.filter((item) => item.nativeAction !== 'workspace').slice(0, 4)
    },
    showHighlights() { return Boolean(this.highlightBlock.key) },
    highlightGroups() {
      const limit = this.highlightBlock.limit || 3
      return this.runtimeBusinessGroups.slice(0, limit)
    },
    noticeActions() { return (this.noticeBlock.actions || []).slice(0, this.noticeBlock.limit || 6) },
    homeTodoItems() {
      return buildHomeTodoItems({ reminders: this.reminders, noticeActions: this.noticeActions, limit: 3 })
    },
    todoTotal() {
      return this.reminders.filter((row) => !row.Done).length + this.noticeActions.length
    },
    todoSubtitle() {
      if (this.loading) return '正在同步当前账号的待处理事项'
      if (this.todoTotal) return '优先展示租户待办和个人提醒'
      return '当前账号暂无待处理事项'
    },
    overviewTitle() { return this.metricBlock.title || '数据看板' },
    overviewPeriod() {
      if (this.loading) return '同步中'
      return this.metricBlock.subtitle || (this.homeMetrics.length ? '实时' : '当前')
    },
    showPromise() { return Boolean(this.promiseBlock.key) },
    configuredMetrics() {
      const blockMetrics = (this.homeConfig?.blocks || [])
        .filter((block) => block.type === 'MetricStrip')
        .flatMap((block) => block.metrics || [])
      return [...(this.homeConfig?.metrics || []), ...blockMetrics].slice(0, 4)
    },
    homeMetrics() {
      if (!this.configuredMetrics.length) return []
      return this.configuredMetrics.map((metric) => {
        const key = metric.key || metric.field || metric.apiEngineKey
        const remote = String(metric.source || '').toLowerCase() === 'apiengine'
        const raw = remote ? this.metricValues[key] : this.localMetricValue(metric.field)
        return {
          key,
          label: metric.label || metric.field || '统计',
          value: raw === undefined || raw === null || raw === '' ? '-' : `${this.compactNumber(raw)}${metric.suffix || ''}`
        }
      })
    },
    overviewMetrics() {
      if (this.homeMetrics.length) return this.homeMetrics
      return buildFallbackHomeMetrics({
        reminders: this.reminders,
        noticeActions: this.noticeActions,
        loading: this.loading
      })
    }
  },
  onLoad(options) {
    captureInvitation(options || {})
    this.loadBrand()
    const snapshot = readSummarySnapshot()
    if (snapshot) this.summary = snapshot
    warmPrimaryTabs(80)
  },
  onShow() {
    uni.$emit('mci:tab-route', 'pages/home/index')
    const token = getToken()
    const user = getUser() || {}
    this.isLoggedIn = !!token && !!user.Id
    this.currentUser = this.isLoggedIn ? user : {}
    this.reminders = this.isLoggedIn ? loadReminders() : []
    if (!this.isLoggedIn) {
      if (token) removeToken()
      this.requestId += 1
      this.runtimeBusinessGroups = []
      this.recentModules = []
      this.homeManifest = null
      this.homeConfig = null
      this.metricValues = {}
      this.reminders = []
      this.aiAssistantEnabled = false
      this.summary = { ...EMPTY_SUMMARY }
      this.loading = false
      reLaunchToLogin()
      return
    }
    this.resolveAiEntry()
    this.loadHomeData()
  },
  methods: {
    featureEnabled(name) { return hasFeature(name) },
    hasUsableIcon(value) {
      const source = String(value || '').trim()
      return /^(?:https?:|data:|\/|static\/)/i.test(source) && !/microi-blue-256/i.test(source)
    },
    semanticIcon(source) { return resolveSemanticIcon(source) },
    findBlock(type) { return (this.homeConfig?.blocks || []).find((block) => block.type === type) || null },
    actionIcon(value) {
      const source = String(value || '').trim()
      if (!source || !/^(?:https?:|data:|\/|static\/)/i.test(source)) return '/static/microi-blue-256.png'
      return publicAssetUrl(source)
    },
    actionAccent(tone) {
      const tones = { danger: '#d9472b', success: '#1f9d72', warning: '#d28619', info: '#087da8' }
      return tones[String(tone || '').toLowerCase()] || '#087da8'
    },
    localMetricValue(field) {
      const key = String(field || '').toLowerCase()
      if (['modulecount', 'modules', 'applications'].includes(key)) return this.runtimeModules.length
      if (['groupcount', 'groups'].includes(key)) return this.runtimeBusinessGroups.length
      const summaryKey = Object.keys(this.summary).find((name) => name.toLowerCase() === key)
      return summaryKey ? this.summary[summaryKey] : '-'
    },
    compactNumber(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return String(value ?? '-')
      try {
        return new Intl.NumberFormat('zh-CN', {
          notation: number >= 10000 ? 'compact' : 'standard',
          maximumFractionDigits: 1
        }).format(number)
      } catch (error) {
        if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`
        return String(number)
      }
    },
    async loadBrand() {
      try { await getSysConfig() } catch (error) {}
    },
    async resolveAiEntry(refresh = false) {
      this.aiAssistantEnabled = await getAiAssistantEnabled({ refresh })
    },
    async loadHomeData(refresh = false) {
      if (this.loading && !refresh) return
      const requestId = ++this.requestId
      this.loading = true
      try {
        const [groups, manifest, summary] = await Promise.all([
          loadAccessibleModuleGroups(refresh),
          loadHomeViewManifest({ refresh, user: this.currentUser }),
          this.featureEnabled('business') ? loadSummarySnapshot({ refresh }) : Promise.resolve({ ...EMPTY_SUMMARY })
        ])
        if (requestId !== this.requestId) return
        this.runtimeBusinessGroups = groups
        this.recentModules = readRecentModules(this.runtimeModules, 4)
        this.homeManifest = manifest
        this.homeConfig = manifest ? compileHomeConfig(manifest) : null
        this.summary = summary
        this.reminders = loadReminders()
        this.metricValues = this.homeConfig
          ? await loadViewMetricValues(this.configuredMetrics, {
              user: this.currentUser,
              menu: manifest.Module || {},
              form: {}
            })
          : {}
      } catch (error) {
        if (requestId === this.requestId) {
          console.warn('[Microi Home] 首页数据加载失败:', error && (error.message || error))
          if (!this.runtimeBusinessGroups.length) uni.showToast({ title: '首页加载失败，下拉可重试', icon: 'none' })
        }
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    openQuickItem(item) {
      if (item.action) this.runSchemaAction(item.action)
      else if (item.module) this.openRuntimeModule(item.module)
      else if (item.nativeAction) this.runNativeAction(item.nativeAction)
    },
    runNativeAction(action) {
      const handlers = {
        workspace: this.goWorkspace,
        dashboard: this.goDashboard,
        messages: this.goMessages,
        profile: this.goProfile,
        scan: this.handleScan
      }
      const handler = handlers[action]
      if (handler) handler.call(this)
    },
    openRuntimeModule(item) {
      if (!item) return
      rememberRecentModule(item)
      this.recentModules = readRecentModules(this.runtimeModules, 4)
      if (openModuleEntry(item)) return
      openBusiness(item.key)
    },
    async runSchemaAction(action) {
      await executeViewAction(action, {
        user: this.currentUser,
        menu: this.homeManifest?.Module || {},
        refresh: () => this.loadHomeData(true)
      })
    },
    openHomeTodo(item) {
      if (item?.type === 'notice' && item.action) return this.runSchemaAction(item.action)
      this.goReminders()
    },
    handleScan() { scanDevice() },
    goMessages() { uni.switchTab({ url: getProfileRoute('messages', '/pages/message/index') }) },
    goDashboard() { uni.navigateTo({ url: getProfileRoute('dashboard', '/pages/dashboard/index') }) },
    goReminders() { uni.navigateTo({ url: getProfileRoute('reminders', '/pages/native/reminders') }) },
    goWorkspace() { uni.switchTab({ url: getProfileRoute('workspace', '/pages/workspace/index') }) },
    openWorkspaceGroup(group) {
      const app = typeof getApp === 'function' ? getApp() : null
      if (app && app.globalData) app.globalData.mciWorkspaceGroupHint = String(group?.key || '')
      this.goWorkspace()
    },
    goProfile() { uni.switchTab({ url: getProfileRoute('profile', '/pages/profile/index') }) },
    goLogin() { uni.navigateTo({ url: getProfileRoute('login', '/pages/login/index') }) },
    async refreshAll() {
      this.refreshing = true
      try {
        await Promise.all([
          this.loadBrand(),
          this.isLoggedIn ? this.loadHomeData(true) : Promise.resolve(),
          this.isLoggedIn ? this.resolveAiEntry(true) : Promise.resolve()
        ])
      } finally {
        this.refreshing = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
/* Legacy home rules intentionally retired. The active Microi Blue Suite system lives in home-command.scss.
.native-home { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--mci-text-primary, #18313d); background: var(--mci-bg-base, #f4f8fa); }
.native-home__hero { position: relative; z-index: 2; min-height: 396rpx; overflow: hidden; color: #fff; background: var(--mci-color-primary-dark, #063b5c); }
.native-home__hero--compact { min-height: 300rpx; }
.native-home__hero-image, .native-home__hero-shade { position: absolute; inset: 0; width: 100%; height: 100%; }
.native-home__hero-image { pointer-events: none; }
.native-home__hero-shade { background: linear-gradient(110deg, rgba(2,34,54,.97), rgba(3,64,88,.78) 58%, rgba(8,125,168,.38)); pointer-events: none; }
.native-home__topbar, .native-home__welcome, .native-home__metrics { position: relative; z-index: 2; }
.native-home__topbar { min-height: 104rpx; padding: 10rpx calc(28rpx + var(--mci-capsule-right)) 0 28rpx; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; }
.native-home__brand { min-width: 0; display: flex; align-items: center; }
.native-home__logo { flex: none; width: 72rpx; height: 72rpx; border: 3rpx solid rgba(255,255,255,.72); border-radius: 17rpx; background: #fff; box-shadow: 0 7rpx 20rpx rgba(2,30,50,.22); }
.native-home__brand-copy { min-width: 0; margin-left: 16rpx; display: flex; flex-direction: column; }
.native-home__brand-name { max-width: 380rpx; overflow: hidden; color: #fff; font-size: 34rpx; line-height: 42rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.native-home__brand-note { max-width: 390rpx; margin-top: 2rpx; overflow: hidden; color: rgba(255,255,255,.74); font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.native-home__top-actions { display: flex; gap: 12rpx; }
.native-home__icon-button { width: 62rpx; height: 62rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid rgba(255,255,255,.28); border-radius: 18rpx; background: rgba(255,255,255,.13); transition: transform .15s ease; }
.native-home__icon-button image { width: 34rpx; height: 34rpx; }
.native-home__icon-button--pressed { transform: scale(.92); }
.native-home__welcome { padding: 22rpx 32rpx 16rpx; display: flex; align-items: center; justify-content: space-between; }
.native-home__welcome-copy { min-width: 0; display: flex; flex-direction: column; }
.native-home__welcome-title { overflow: hidden; font-size: 32rpx; line-height: 44rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.native-home__identity, .native-home__date { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-home__identity { margin-top: 6rpx; color: rgba(255,255,255,.76); font-size: 23rpx; }
.native-home__date { margin-top: 3rpx; color: rgba(255,255,255,.58); font-size: 21rpx; }
.native-home__login { min-width: 116rpx; min-height: 68rpx; padding: 0 24rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx; box-sizing: border-box; border: 1rpx solid rgba(255,255,255,.46); border-radius: 18rpx; font-size: 25rpx; transition: transform .15s ease; }
.native-home__login--pressed { transform: scale(.95); background: rgba(255,255,255,.1); }
.native-home__login-icon { position: relative; width: 23rpx; height: 24rpx; box-sizing: border-box; border: 2rpx solid currentColor; border-radius: 4rpx; }
.native-home__login-icon view { position: absolute; top: 9rpx; left: -7rpx; width: 17rpx; height: 2rpx; border-radius: 2rpx; background: currentColor; }
.native-home__login-icon view::after { position: absolute; top: -4rpx; right: -1rpx; width: 7rpx; height: 7rpx; border-top: 2rpx solid currentColor; border-right: 2rpx solid currentColor; transform: rotate(45deg); content: ''; }
.native-home__metrics { margin: 12rpx 24rpx 24rpx; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1rpx solid rgba(255,255,255,.2); border-radius: 18rpx; background: rgba(3,48,72,.22); backdrop-filter: blur(12rpx); }
.native-home__metric { position: relative; min-width: 0; padding: 18rpx 7rpx; display: flex; flex-direction: column; align-items: center; }
.native-home__metric + .native-home__metric::before { position: absolute; top: 20rpx; bottom: 20rpx; left: 0; width: 1rpx; background: rgba(255,255,255,.17); content: ''; }
.native-home__metric-value { max-width: 100%; overflow: hidden; font-size: 31rpx; line-height: 40rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.native-home__metric-label { max-width: 100%; margin-top: 4rpx; overflow: hidden; color: rgba(255,255,255,.72); font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.native-home__metric-skeleton { width: 66rpx; height: 34rpx; margin: 3rpx 0; border-radius: 7rpx; background: linear-gradient(90deg, rgba(255,255,255,.12), rgba(255,255,255,.38), rgba(255,255,255,.12)); background-size: 250% 100%; animation: nativeHomeShimmer 1.2s ease-in-out infinite; }
.native-home__scroll { flex: 1; min-height: 0; }
.native-home__content { min-height: 100%; padding: 28rpx 24rpx 24rpx; box-sizing: border-box; }
.native-home__auth-wrap { min-height: 620rpx; display: flex; }
.native-home__dashboard { min-height: 118rpx; margin-bottom: 26rpx; padding: 18rpx 22rpx; display: grid; grid-template-columns: 74rpx minmax(0, 1fr) 28rpx; align-items: center; gap: 18rpx; border: 1rpx solid rgba(8,125,168,.18); border-radius: 20rpx; background: linear-gradient(115deg, rgba(8,125,168,.1), rgba(24,166,184,.055)); box-sizing: border-box; box-shadow: 0 7rpx 20rpx rgba(17,74,101,.05); transition: transform .15s ease, opacity .15s ease; }
.native-home__dashboard--pressed { opacity: .7; transform: scale(.985); }
.native-home__dashboard-icon { width: 74rpx; height: 74rpx; padding: 15rpx 12rpx; display: flex; align-items: flex-end; justify-content: space-between; border-radius: 18rpx; color: #fff; background: linear-gradient(135deg, var(--mci-color-primary, #087da8), var(--mci-color-primary-light, #18a6b8)); box-sizing: border-box; }
.native-home__dashboard-icon view { width: 9rpx; border-radius: 5rpx 5rpx 1rpx 1rpx; background: currentColor; }
.native-home__dashboard-copy { min-width: 0; display: flex; flex-direction: column; }
.native-home__dashboard-copy text:first-child { font-size: 27rpx; font-weight: 720; }
.native-home__dashboard-copy text:last-child { margin-top: 5rpx; overflow: hidden; color: var(--mci-text-secondary, #718891); font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.native-home__dashboard-arrow { width: 16rpx; height: 16rpx; border-top: 3rpx solid var(--mci-color-primary, #087da8); border-right: 3rpx solid var(--mci-color-primary, #087da8); transform: rotate(45deg); }
.native-home__section { margin-bottom: 28rpx; }
.native-home__section--plain { padding: 24rpx 18rpx 18rpx; border: 1rpx solid var(--mci-border-color, #e2eaed); border-radius: 22rpx; background: var(--mci-bg-elevated, #fff); box-shadow: 0 8rpx 25rpx rgba(17,74,101,.055); }
.native-home__section-heading { margin: 0 4rpx 16rpx; display: flex; align-items: center; justify-content: space-between; }
.native-home__section-heading > view:first-child { min-width: 0; display: flex; flex-direction: column; }
.native-home__section-title { font-size: 30rpx; line-height: 40rpx; font-weight: 700; }
.native-home__section-subtitle { margin-top: 3rpx; color: var(--mci-text-secondary, #75909c); font-size: 21rpx; }
.native-home__section-action { min-height: 88rpx; margin: -12rpx -6rpx -12rpx 0; padding: 0 10rpx 0 22rpx; display: flex; align-items: center; color: var(--mci-color-primary, #087da8); font-size: 24rpx; }
.native-home__section-action--pressed { opacity: .6; }
.native-home__quick-grid { padding: 16rpx 8rpx 12rpx; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1rpx solid var(--mci-border-color, #e5eef2); border-radius: 20rpx; background: var(--mci-bg-elevated, #fff); box-shadow: 0 8rpx 24rpx rgba(17,74,101,.06); }
.native-home__quick-item { min-width: 0; min-height: 142rpx; padding: 12rpx 4rpx; display: flex; flex-direction: column; align-items: center; transition: transform .15s ease, opacity .15s ease; }
.native-home__quick-item--pressed { opacity: .68; transform: scale(.94); }
.native-home__quick-icon { width: 76rpx; height: 76rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; }
.native-home__quick-icon image { width: 49rpx; height: 49rpx; }
.native-home__quick-title { width: 100%; margin-top: 10rpx; overflow: hidden; color: var(--mci-text-primary, #284652); font-size: 23rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.native-home__recent-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.native-home__recent { min-width: 0; min-height: 102rpx; padding: 14rpx 14rpx; display: grid; grid-template-columns: 60rpx minmax(0, 1fr) 22rpx; align-items: center; gap: 12rpx; box-sizing: border-box; border: 1rpx solid var(--mci-border-color, #e4ecef); border-radius: 17rpx; background: var(--mci-bg-soft, #f7fafb); transition: transform .15s ease, background-color .15s ease; }
.native-home__recent--pressed { transform: scale(.975); background: rgba(8,125,168,.075); }
.native-home__recent-icon { width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.native-home__recent-icon image { width: 42rpx; height: 42rpx; }
.native-home__recent-copy { min-width: 0; display: flex; flex-direction: column; }
.native-home__recent-title, .native-home__recent-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-home__recent-title { color: var(--mci-text-primary, #284652); font-size: 23rpx; font-weight: 650; }
.native-home__recent-desc { margin-top: 4rpx; color: var(--mci-text-tertiary, #8398a1); font-size: 18rpx; }
.native-home__recent-arrow { width: 12rpx; height: 12rpx; border-top: 2rpx solid var(--mci-text-tertiary, #91a3aa); border-right: 2rpx solid var(--mci-text-tertiary, #91a3aa); transform: rotate(45deg); }
.native-home__recent-empty { min-height: 138rpx; padding: 20rpx 12rpx; display: grid; grid-template-columns: 70rpx minmax(0, 1fr) auto; align-items: center; gap: 16rpx; box-sizing: border-box; border: 1rpx dashed var(--mci-border-color, #dce8ed); border-radius: 18rpx; background: var(--mci-bg-soft, #f7fafb); }
.native-home__recent-empty-icon { width: 70rpx; height: 70rpx; padding: 14rpx; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6rpx; box-sizing: border-box; border-radius: 18rpx; color: var(--mci-color-primary, #087da8); background: rgba(8,125,168,.09); }
.native-home__recent-empty-icon view { border: 2rpx solid currentColor; border-radius: 4rpx; }
.native-home__recent-empty-copy { min-width: 0; display: flex; flex-direction: column; }
.native-home__recent-empty-copy text:first-child { color: var(--mci-text-primary, #284652); font-size: 23rpx; font-weight: 650; }
.native-home__recent-empty-copy text:last-child { margin-top: 5rpx; color: var(--mci-text-secondary, #7a9099); font-size: 18rpx; line-height: 27rpx; }
.native-home__recent-empty-action { min-width: 132rpx; min-height: 88rpx; padding: 0 16rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 16rpx; color: var(--mci-color-primary, #087da8); font-size: 21rpx; font-weight: 650; }
.native-home__recent-empty-action--pressed { background: rgba(8,125,168,.09); }
.native-home__highlight-list { display: flex; flex-direction: column; gap: 16rpx; }
.native-home__highlight { border: 1rpx solid var(--mci-border-color, #e4ecef); border-radius: 18rpx; overflow: hidden; animation: nativeHomeIn .38s ease both; }
.native-home__highlight-heading { min-height: 82rpx; padding: 0 18rpx; display: flex; align-items: center; background: var(--mci-bg-soft, #f7fafb); }
.native-home__highlight-mark { flex: none; width: 8rpx; height: 42rpx; margin-right: 14rpx; border-radius: 5rpx; }
.native-home__highlight-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.native-home__highlight-title { overflow: hidden; font-size: 26rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.native-home__highlight-count { margin-top: 2rpx; color: var(--mci-text-secondary, #76909b); font-size: 19rpx; }
.native-home__highlight-arrow { color: var(--mci-text-tertiary, #9aadb5); font-size: 38rpx; }
.native-home__highlight-apps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.native-home__highlight-app { min-width: 0; min-height: 124rpx; padding: 17rpx 5rpx 14rpx; display: flex; flex-direction: column; align-items: center; transition: background-color .15s ease, transform .15s ease; }
.native-home__highlight-app--pressed { transform: scale(.95); background: rgba(8,125,168,.055); }
.native-home__highlight-app image { width: 54rpx; height: 54rpx; }
.native-home__highlight-app text { width: 100%; margin-top: 8rpx; overflow: hidden; font-size: 21rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.native-home__notice-list { display: flex; flex-direction: column; }
.native-home__notice { min-height: 84rpx; display: grid; grid-template-columns: 46rpx minmax(0, 1fr) 30rpx; align-items: center; gap: 14rpx; border-top: 1rpx solid var(--mci-border-color, #e8eef0); transition: background-color .15s ease; }
.native-home__notice:first-child { border-top: 0; }
.native-home__notice--pressed { background: rgba(8,125,168,.055); }
.native-home__notice image { width: 38rpx; height: 38rpx; }
.native-home__notice text:nth-child(2) { font-size: 25rpx; }
.native-home__notice text:last-child { color: var(--mci-text-tertiary, #9aadb5); font-size: 35rpx; }
.native-home__promise { margin: 38rpx 8rpx 0; padding: 28rpx 24rpx; display: flex; flex-direction: column; align-items: center; border-top: 1rpx solid var(--mci-border-color, #dce8ed); }
.native-home__promise-line { width: 100rpx; height: 5rpx; border-radius: 3rpx; background: linear-gradient(90deg, var(--mci-color-brand, #e94b2c), var(--mci-color-primary, #087da8), #1f9d72); }
.native-home__promise-title { margin-top: 16rpx; color: var(--mci-text-primary, #365866); font-size: 25rpx; font-weight: 650; }
.native-home__promise-text { margin-top: 8rpx; color: var(--mci-text-secondary, #536b76); font-size: 20rpx; line-height: 32rpx; text-align: center; }
@keyframes nativeHomeShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes nativeHomeIn { from { opacity: 0; transform: translateY(14rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .native-home__metric-skeleton, .native-home__highlight { animation: none; }
  .native-home__icon-button, .native-home__login, .native-home__quick-item, .native-home__recent, .native-home__highlight-app { transition: none; }
}

*/
</style>

<style lang="scss" scoped src="./home-command.scss"></style>
