<template>
  <view
    v-if="isRuntimeDock"
    class="mci-bottom-dock"
    :class="aiAssistantEnabled ? 'mci-bottom-dock--with-ai' : 'mci-bottom-dock--without-ai'"
    aria-label="底部导航"
  >
    <view :key="`dock-${dockRevision}`" class="mci-bottom-dock__main">
      <view class="mci-bottom-dock__nav">
        <view
          v-for="(item, index) in tabItems"
          :key="item.pagePath"
          class="mci-bottom-dock__item"
          :class="{ 'mci-bottom-dock__item--active': activeIndex === index }"
          hover-class="mci-bottom-dock__item--pressed"
          :aria-label="item.text"
          role="button"
          tabindex="0"
          @tap="switchTab(item, index)"
          @keyup.enter="switchTab(item, index)"
          @keyup.space.prevent="switchTab(item, index)"
        >
          <view
            class="mci-bottom-dock__symbol"
            :class="`mci-bottom-dock__symbol--${item.symbol}`"
            aria-hidden="true"
          />
          <text class="mci-bottom-dock__label">{{ item.text }}</text>
        </view>
      </view>
      <view
        v-if="aiAssistantEnabled"
        class="mci-ai-launcher"
        hover-class="mci-ai-launcher--pressed"
        role="button"
        tabindex="0"
        aria-label="打开AI助手"
        @tap="openAssistant"
        @keyup.enter="openAssistant"
        @keyup.space.prevent="openAssistant"
      >
        <view class="mci-ai-launcher__ring" />
        <image
          class="mci-ai-launcher__robot"
          src="/static/mci/ai/assistant-robot.png"
          mode="aspectFit"
          aria-hidden="true"
        />
        <text class="mci-ai-launcher__label">AI</text>
      </view>
    </view>
  </view>

  <view
    v-if="isFallbackLauncher"
    class="mci-ai-launcher mci-ai-launcher--fallback"
    :style="fallbackStyle"
    hover-class="mci-ai-launcher--pressed"
    role="button"
    tabindex="0"
    aria-label="打开AI助手"
    @tap="openAssistant"
    @keyup.enter="openAssistant"
    @keyup.space.prevent="openAssistant"
  >
    <view class="mci-ai-launcher__ring" />
    <view class="mci-ai-launcher__glyph" aria-hidden="true"><view /></view>
    <text class="mci-ai-launcher__label">AI</text>
  </view>

  <view v-else-if="!isRuntimeDock" class="mci-ai-launcher-bridge" aria-hidden="true" />
</template>

<script>
import appConfig from '@/config.js'
import activeTabBar from '@/generated/active-tabbar.js'
import { getSafeAreaMetrics } from '@/utils/safe-area.js'
import { getAiAssistantEnabled, getMessageTabBarEnabled } from '@/utils/sysconfig.js'
import { syncAppNativeDock } from '@/platform/app-native-dock.mjs'

let runtimeTarget = 'other'
// #ifdef H5
runtimeTarget = 'h5'
// #endif
// #ifdef APP-PLUS
runtimeTarget = 'app-plus'
// #endif
// #ifdef MP-WEIXIN
runtimeTarget = 'mp-weixin'
// #endif

const normalizeRoute = (value) => String(value || '').replace(/^\/+/, '').split('?')[0]
const TAB_ROUTE_EVENT = 'mci:tab-route'
const MESSAGE_TAB_ROUTE = 'pages/message/index'
const symbolForRoute = (value) => {
  const route = normalizeRoute(value)
  if (route === 'pages/workspace/index') return 'workspace'
  if (route === 'pages/message/index') return 'message'
  if (route === 'pages/profile/index') return 'profile'
  return 'home'
}
const normalizeAssetPath = (value) => {
  const path = String(value || '')
  if (!path || /^(?:https?:|data:|blob:|\/)/i.test(path)) return path
  return `/${path}`
}
export default {
  name: 'MciAiLauncher',
  data() {
    return {
      activeIndex: -1,
      dockRevision: 0,
      nativeDockReady: false,
      opening: false,
      switching: false,
      aiAssistantEnabled: false,
      messageTabBarEnabled: true,
      assistantVisibilityResolved: false,
      safeTop: 0,
      safeHeaderHeight: 44,
      safeLeft: 0,
      safeRight: 0,
      safeBottom: 0,
      windowWidth: 0,
      windowHeight: 0,
      resizeHandler: null
    }
  },
  computed: {
    allTabItems() {
      return (activeTabBar.list || []).map((item) => ({
        ...item,
        pagePath: normalizeRoute(item.pagePath),
        symbol: symbolForRoute(item.pagePath),
        iconPath: normalizeAssetPath(item.iconPath),
        selectedIconPath: normalizeAssetPath(item.selectedIconPath || item.iconPath)
      }))
    },
    tabItems() {
      return this.allTabItems.filter((item) => this.messageTabBarEnabled || item.pagePath !== MESSAGE_TAB_ROUTE)
    },
    isTabBarPage() {
      return this.activeIndex >= 0 || this.allTabItems.some((item) => item.pagePath === this.currentRoute())
    },
    isRuntimeDock() {
      const webDock = runtimeTarget === 'h5'
      const appFallbackDock = runtimeTarget === 'app-plus' && !this.nativeDockReady
      return activeTabBar.custom === true && (webDock || appFallbackDock) && this.isTabBarPage
    },
    isFallbackLauncher() {
      return this.aiAssistantEnabled && this.isTabBarPage && !['mp-weixin', 'app-plus'].includes(runtimeTarget) && !this.isRuntimeDock
    },
    fallbackStyle() {
      return {
        right: `calc(18rpx + ${this.safeRight}px)`,
        bottom: `calc(8rpx + ${this.safeBottom}px)`
      }
    }
  },
  mounted() {
    this.routeSyncTimers = []
    this.routeEventHandler = (route) => this.applyActiveRoute(route)
    this.resizeHandler = () => this.refreshSafeArea()
    try {
      if (typeof uni.$on === 'function') uni.$on(TAB_ROUTE_EVENT, this.routeEventHandler)
    } catch (error) {}
    try {
      if (typeof uni.onWindowResize === 'function') uni.onWindowResize(this.resizeHandler)
    } catch (error) {}
    this.activate()
  },
  activated() {
    this.activate()
  },
  deactivated() {
    this.releaseH5Dock()
  },
  beforeUnmount() {
    this.clearRouteSyncTimers()
    this.releaseH5Dock()
    try {
      if (this.routeEventHandler && typeof uni.$off === 'function') {
        uni.$off(TAB_ROUTE_EVENT, this.routeEventHandler)
      }
    } catch (error) {}
    try {
      if (this.resizeHandler && typeof uni.offWindowResize === 'function') {
        uni.offWindowResize(this.resizeHandler)
      }
    } catch (error) {}
  },
  methods: {
    activate() {
      // App 首次进入时系统 tabBar 仍占用视口。如果此时先创建 NativeObj.View，
      // windowHeight 会沿用隐藏前的旧值，底部导航下方就会留下一个 tabBar 高度的空白。
      // 先识别路由并隐藏系统 tabBar，再读取安全区和创建原生 Dock。
      this.syncActiveRoute(false)
      const appTabPage = runtimeTarget === 'app-plus' && this.isTabBarPage
      if (this.isRuntimeDock || appTabPage) this.activateRuntimeDock()
      else if (runtimeTarget === 'h5') this.releaseH5Dock()
      this.refreshSafeArea()
      this.scheduleActiveRouteSync()
      this.syncWeixinTabBar()
      this.resolveAssistantVisibility()
    },
    refreshSafeArea() {
      const metrics = getSafeAreaMetrics()
      this.safeTop = Number(metrics && metrics.top) || 0
      this.safeHeaderHeight = Number(metrics && metrics.headerHeight) || this.safeTop + 44
      this.safeLeft = Number(metrics && metrics.left) || 0
      this.safeRight = Number(metrics && metrics.right) || 0
      this.safeBottom = Number(metrics && metrics.bottom) || 0
      this.windowWidth = Number(metrics && metrics.windowWidth) || 375
      this.windowHeight = Number(metrics && metrics.windowHeight) || 667
      this.syncNativeDock()
    },
    currentRoute() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages && pages.length ? pages[pages.length - 1] : null
        return normalizeRoute(page && (page.route || page.$page?.route || page.$page?.fullPath))
      } catch (error) {
        return ''
      }
    },
    syncActiveRoute(syncDock = true) {
      const route = this.currentRoute()
      this.activeIndex = this.tabItems.findIndex((item) => item.pagePath === route)
      if (syncDock) this.syncNativeDock()
    },
    applyActiveRoute(route) {
      const normalized = normalizeRoute(route)
      const index = this.tabItems.findIndex((item) => item.pagePath === normalized)
      if (index >= 0) {
        this.activeIndex = index
        this.refreshDockPaint()
        this.syncNativeDock()
      }
    },
    refreshDockPaint() {
      this.dockRevision = (this.dockRevision + 1) % 100000
    },
    clearRouteSyncTimers() {
      ;(this.routeSyncTimers || []).forEach((timer) => clearTimeout(timer))
      this.routeSyncTimers = []
    },
    scheduleActiveRouteSync(expectedRoute = '') {
      this.clearRouteSyncTimers()
      const expected = normalizeRoute(expectedRoute)
      ;[0, 32, 120, 360, 900].forEach((delay) => {
        this.routeSyncTimers.push(setTimeout(() => {
          // zhy：App Plus 切 Tab 时 getCurrentPages 可能短暂返回旧页；旧路由不能覆盖刚点击的高亮。
          if (expected && this.currentRoute() !== expected) return
          // hideTabBar 在 App Plus 中会异步改变 windowHeight。每轮路由校准都
          // 重新读取安全区，确保冷启动和横竖屏切换后的原生 Dock 紧贴屏幕底部。
          if (runtimeTarget === 'app-plus') {
            this.syncActiveRoute(false)
            this.refreshSafeArea()
          } else {
            this.syncActiveRoute()
          }
          this.refreshDockPaint()
        }, delay))
      })
    },
    activateRuntimeDock() {
      try {
        const task = uni.hideTabBar({
          animation: false,
          complete: () => this.refreshSafeArea()
        })
        if (task && typeof task.catch === 'function') task.catch(() => {})
      } catch (error) {}
      if (typeof document === 'undefined') return
      ;[document.documentElement, document.body].forEach((element) => {
        if (element) element.setAttribute('data-mci-custom-tabbar', 'true')
      })
    },
    releaseH5Dock() {
      if (runtimeTarget !== 'h5' || typeof document === 'undefined') return
      setTimeout(() => {
        const route = this.currentRoute()
        const stillOnTab = this.allTabItems.some((item) => item.pagePath === route)
        if (stillOnTab) return
        ;[document.documentElement, document.body].forEach((element) => {
          if (element) element.removeAttribute('data-mci-custom-tabbar')
        })
      }, 0)
    },
    async resolveAssistantVisibility() {
      const profileEnabled = appConfig.features && appConfig.features.ai === true
      const [enabled, messageTabBarEnabled] = await Promise.all([
        profileEnabled ? getAiAssistantEnabled() : false,
        getMessageTabBarEnabled()
      ])
      this.aiAssistantEnabled = enabled
      this.messageTabBarEnabled = messageTabBarEnabled
      this.assistantVisibilityResolved = true
      this.syncActiveRoute(false)
      this.$nextTick(() => this.refreshDockPaint())
      this.$nextTick(() => this.refreshSafeArea())
      this.updateGlobalEntryState(enabled, messageTabBarEnabled)
      this.syncWeixinTabBar()
    },
    updateGlobalEntryState(enabled, messageTabBarEnabled) {
      try {
        const app = typeof getApp === 'function' ? getApp() : null
        if (app && app.globalData) {
          app.globalData.mciAiAssistantEnabled = Boolean(enabled)
          app.globalData.mciMessageTabBarEnabled = Boolean(messageTabBarEnabled)
        }
      } catch (error) {}
    },
    syncNativeDock() {
      if (runtimeTarget !== 'app-plus') return
      const ready = syncAppNativeDock({
        visible: this.isTabBarPage,
        items: this.tabItems,
        activeIndex: this.activeIndex,
        aiEnabled: this.aiAssistantEnabled,
        aiResolved: this.assistantVisibilityResolved,
        safeBottom: this.safeBottom,
        windowWidth: this.windowWidth,
        windowHeight: this.windowHeight,
        primaryColor: '#2563EB'
      })
      if (this.nativeDockReady !== ready) this.nativeDockReady = ready
    },
    syncWeixinTabBar() {
      if (runtimeTarget !== 'mp-weixin') return
      this.syncActiveRoute()
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages && pages.length ? pages[pages.length - 1] : null
        const tabBar = page && typeof page.getTabBar === 'function' ? page.getTabBar() : null
        if (!tabBar || typeof tabBar.setData !== 'function') return
        const state = {
          list: this.allTabItems,
          color: activeTabBar.color,
          selectedColor: activeTabBar.selectedColor,
          backgroundColor: activeTabBar.backgroundColor,
          aiAssistantEnabled: this.aiAssistantEnabled,
          messageTabBarEnabled: this.messageTabBarEnabled
        }
        if (typeof tabBar.applyExternalState === 'function') tabBar.applyExternalState(state)
        else tabBar.setData(state)
      } catch (error) {}
    },
    switchTab(item, index) {
      if (this.switching || index === this.activeIndex) return
      const previousIndex = this.activeIndex
      this.switching = true
      this.activeIndex = index
      try {
        if (typeof uni.$emit === 'function') uni.$emit(TAB_ROUTE_EVENT, item.pagePath)
      } catch (error) {}
      uni.switchTab({
        url: `/${item.pagePath}`,
        success: () => this.scheduleActiveRouteSync(item.pagePath),
        fail: (error) => {
          this.activeIndex = previousIndex
          this.syncActiveRoute()
          console.error('[MciBottomDock] switchTab failed:', error)
          uni.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => {
          this.switching = false
          this.scheduleActiveRouteSync(item.pagePath)
        }
      })
    },
    openAssistant() {
      if (this.opening) return
      this.opening = true
      uni.navigateTo({
        url: '/pages/ai/index',
        fail: (error) => {
          console.error('[MciAiLauncher] navigate failed:', error)
          uni.showToast({ title: '服务助手打开失败，请重试', icon: 'none' })
        },
        complete: () => {
          setTimeout(() => { this.opening = false }, 280)
        }
      })
    }
  }
}
</script>

<style scoped>
.mci-bottom-dock {
  position: fixed;
  right: max(16rpx, var(--mci-safe-right, 0px));
  bottom: 0;
  left: max(16rpx, var(--mci-safe-left, 0px));
  z-index: 980;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112rpx;
  gap: 16rpx;
  align-items: center;
  padding: 8rpx 0 max(8rpx, var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));
  box-sizing: border-box;
  pointer-events: none;
}
.mci-bottom-dock--without-ai { grid-template-columns: minmax(0, 1fr); }
.mci-bottom-dock__nav {
  min-width: 0;
  height: 112rpx;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1rpx solid var(--mci-border-color, rgba(15, 18, 30, .1));
  border-radius: 58rpx;
  background: var(--mci-bg-elevated, #fff);
  box-shadow: 0 8rpx 30rpx rgba(15, 49, 66, .13);
  pointer-events: auto;
}
.mci-bottom-dock__item {
  flex: 1;
  min-width: 0;
  min-height: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rpx;
  color: #536b76;
  transition: transform 150ms ease, color 150ms ease, background-color 150ms ease;
}
.mci-bottom-dock__item--active { color: var(--mci-color-brand, #c43b20); }
.mci-bottom-dock__item--pressed { transform: scale(.92); background: rgba(8, 125, 168, .06); }
.mci-bottom-dock__icon { width: 42rpx; height: 42rpx; flex: none; }
.mci-bottom-dock__label { max-width: 100%; font-size: 20rpx; line-height: 25rpx; font-weight: 600; white-space: nowrap; }
.mci-ai-launcher {
  position: relative;
  width: 112rpx;
  height: 112rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  border: 1rpx solid rgba(8, 125, 168, .26);
  border-radius: 50%;
  background: var(--mci-bg-elevated, #fff);
  box-shadow: 0 8rpx 30rpx rgba(15, 49, 66, .16);
  transform: translateZ(0);
  transition: transform 150ms ease, box-shadow 150ms ease;
  pointer-events: auto;
}
.mci-ai-launcher--pressed { transform: scale(.93) translateZ(0); box-shadow: 0 4rpx 16rpx rgba(15, 49, 66, .14); }
.mci-ai-launcher__ring {
  position: absolute;
  inset: 5rpx;
  border: 2rpx solid rgba(24, 166, 184, .22);
  border-radius: 50%;
  pointer-events: none;
  animation: mciAiSlotPulse 2.8s ease-in-out infinite;
}
.mci-ai-launcher__glyph {
  position: relative;
  z-index: 1;
  width: 62rpx;
  height: 50rpx;
  margin-top: -6rpx;
  box-sizing: border-box;
  border: 4rpx solid var(--mci-color-primary, #2563eb);
  border-radius: 14rpx;
  color: var(--mci-color-primary, #2563eb);
  pointer-events: none;
}
.mci-ai-launcher__glyph::before {
  position: absolute;
  top: 17rpx;
  left: 13rpx;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 22rpx 0 0 currentColor;
  content: '';
}
.mci-ai-launcher__glyph::after {
  position: absolute;
  top: -13rpx;
  left: 50%;
  width: 4rpx;
  height: 10rpx;
  border-radius: 4rpx 4rpx 0 0;
  background: currentColor;
  transform: translateX(-50%);
  content: '';
}
.mci-ai-launcher__glyph > view {
  position: absolute;
  right: 15rpx;
  bottom: 8rpx;
  left: 15rpx;
  height: 3rpx;
  border-radius: 3rpx;
  background: currentColor;
}
.mci-ai-launcher__label {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 5rpx;
  left: 0;
  color: var(--mci-color-primary, #087da8);
  font-size: 18rpx;
  line-height: 22rpx;
  font-weight: 800;
  text-align: center;
  pointer-events: none;
}
.mci-ai-launcher--fallback {
  position: fixed;
  right: max(18rpx, var(--mci-safe-right, 0px));
  bottom: calc(8rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));
  z-index: 980;
  user-select: none;
}
.mci-ai-launcher-bridge { position: fixed; width: 0; height: 0; overflow: hidden; pointer-events: none; }
@keyframes mciAiSlotPulse { 0%, 100% { transform: scale(.96); opacity: .45; } 50% { transform: scale(1); opacity: .9; } }
@media (prefers-reduced-motion: reduce) {
  .mci-bottom-dock__item,
  .mci-ai-launcher { transition: none; }
  .mci-ai-launcher__ring { animation: none; }
}
@media screen and (min-width: 768px) {
  .mci-bottom-dock {
    right: auto;
    left: 50%;
    width: min(430px, 100vw);
    padding-right: 10px;
    padding-left: 10px;
    transform: translateX(-50%);
  }
}

/* Reference dock layer: a four-item pill and a separate AI orb. */
.mci-bottom-dock {
  right: max(0px, var(--mci-safe-right, 0px));
  left: max(0px, var(--mci-safe-left, 0px));
  display: block;
  grid-template-columns: none;
  gap: 0;
  padding: 12rpx 24rpx max(12rpx, var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));
  border-top: 1rpx solid rgba(216, 226, 238, .82);
  background: rgba(241, 246, 251, .97);
  box-shadow: 0 -14rpx 36rpx rgba(64, 86, 116, .08);
}
.mci-bottom-dock__main {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112rpx;
  gap: 18rpx;
  align-items: center;
}
.mci-bottom-dock--without-ai .mci-bottom-dock__main { grid-template-columns: minmax(0, 1fr); }
.mci-bottom-dock__nav {
  height: 108rpx;
  overflow: hidden;
  border: 1rpx solid rgba(215, 224, 235, .9);
  border-radius: 58rpx;
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 10rpx 28rpx rgba(43, 64, 92, .13);
}
.mci-bottom-dock__item { position: relative; min-height: 96rpx; gap: 4rpx; color: #667991; }
.mci-bottom-dock__item--active { color: var(--mci-color-primary,#2563eb); }
.mci-bottom-dock__item--pressed { transform: scale(.93); background: rgba(37, 99, 235, .055); }
.mci-bottom-dock__icon { width: 42rpx; height: 42rpx; }
.mci-bottom-dock__symbol {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  flex: none;
  box-sizing: border-box;
  color: inherit;
  pointer-events: none;
}
.mci-bottom-dock__symbol--home::before {
  position: absolute;
  top: 9rpx;
  left: 7rpx;
  width: 28rpx;
  height: 26rpx;
  border-radius: 3rpx 3rpx 5rpx 5rpx;
  background: currentColor;
  content: '';
}
.mci-bottom-dock__symbol--home::after {
  position: absolute;
  top: 3rpx;
  left: 8rpx;
  width: 26rpx;
  height: 26rpx;
  border-radius: 3rpx;
  background: currentColor;
  box-shadow: 10rpx 18rpx 0 -5rpx var(--mci-bg-elevated, #fff);
  transform: rotate(45deg);
  content: '';
}
.mci-bottom-dock__symbol--workspace::before {
  position: absolute;
  top: 6rpx;
  left: 6rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 1rpx;
  background: currentColor;
  box-shadow: 11rpx 0 0 currentColor, 22rpx 0 0 currentColor,
    0 11rpx 0 currentColor, 11rpx 11rpx 0 currentColor, 22rpx 11rpx 0 currentColor,
    0 22rpx 0 currentColor, 11rpx 22rpx 0 currentColor, 22rpx 22rpx 0 currentColor;
  content: '';
}
.mci-bottom-dock__symbol--message {
  top: 3rpx;
  height: 32rpx;
  border: 3rpx solid currentColor;
  border-radius: 13rpx;
}
.mci-bottom-dock__symbol--message::before {
  position: absolute;
  top: 12rpx;
  left: 9rpx;
  width: 4rpx;
  height: 4rpx;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 8rpx 0 0 currentColor, 16rpx 0 0 currentColor;
  content: '';
}
.mci-bottom-dock__symbol--message::after {
  position: absolute;
  bottom: -7rpx;
  left: 8rpx;
  width: 10rpx;
  height: 10rpx;
  border-bottom: 3rpx solid currentColor;
  border-left: 3rpx solid currentColor;
  background: var(--mci-bg-elevated, #fff);
  transform: skewY(-34deg);
  content: '';
}
.mci-bottom-dock__symbol--profile::before {
  position: absolute;
  top: 2rpx;
  left: 14rpx;
  width: 14rpx;
  height: 14rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
  content: '';
}
.mci-bottom-dock__symbol--profile::after {
  position: absolute;
  bottom: 1rpx;
  left: 6rpx;
  width: 30rpx;
  height: 18rpx;
  border: 3rpx solid currentColor;
  border-bottom: 0;
  border-radius: 18rpx 18rpx 0 0;
  content: '';
}
.mci-bottom-dock__label { font-size: 22rpx; line-height: 28rpx; font-weight: 560; }
.mci-bottom-dock__item--active .mci-bottom-dock__label { font-weight: 680; }
.mci-ai-launcher {
  width: 112rpx;
  height: 112rpx;
  min-width: 96rpx;
  min-height: 96rpx;
  overflow: hidden;
  border: 5rpx solid rgba(255, 255, 255, .98);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 2rpx #d9e6f3, 0 10rpx 28rpx rgba(43, 64, 92, .15);
}
.mci-ai-launcher__ring { inset: 3rpx; display: block; border: 2rpx solid rgba(63, 153, 234, .15); animation: none; }
.mci-ai-launcher__robot { width: 86rpx; height: 86rpx; margin-top: -7rpx; pointer-events: none; }
.mci-ai-launcher__label { right: 0; bottom: 2rpx; left: 0; color: var(--mci-color-primary,#2563eb); font-size: 22rpx; line-height: 26rpx; font-weight: 760; }
.mci-ai-launcher--pressed { transform: scale(.93); background: #f7faff; box-shadow: 0 0 0 2rpx #d9e6f3, 0 5rpx 16rpx rgba(43,64,92,.13); }
@media screen and (min-width: 768px) {
  .mci-bottom-dock { padding-right: 12px; padding-left: 12px; }
}

</style>

<style>
html[data-mci-custom-tabbar="true"] .uni-tabbar,
body[data-mci-custom-tabbar="true"] .uni-tabbar {
  display: none !important;
}
html[data-mci-custom-tabbar="true"] uni-page-wrapper,
body[data-mci-custom-tabbar="true"] uni-page-wrapper {
  height: calc(100% - 76px - env(safe-area-inset-bottom, 0px)) !important;
}
html[data-mci-custom-tabbar="true"] uni-page-wrapper::after,
body[data-mci-custom-tabbar="true"] uni-page-wrapper::after {
  display: block;
  width: 100%;
  height: calc(76px + env(safe-area-inset-bottom, 0px));
  content: '';
}
</style>
