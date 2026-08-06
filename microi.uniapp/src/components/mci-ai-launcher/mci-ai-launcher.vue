<template>
  <view
    v-if="isH5Dock"
    class="mci-bottom-dock mci-bottom-dock--without-ai"
    aria-label="底部导航"
  >
    <view class="mci-bottom-dock__nav">
      <view
        v-for="(item, index) in tabItems"
        :key="item.pagePath"
        class="mci-bottom-dock__item"
        :class="{ 'mci-bottom-dock__item--active': activeIndex === index }"
        hover-class="mci-bottom-dock__item--pressed"
        :aria-label="item.text"
        role="button"
        @tap="switchTab(item, index)"
      >
        <image
          class="mci-bottom-dock__icon"
          :src="activeIndex === index ? item.selectedIconPath : item.iconPath"
          mode="aspectFit"
        />
        <text class="mci-bottom-dock__label">{{ item.text }}</text>
      </view>
    </view>

  </view>

  <view
    v-if="isFallbackLauncher"
    class="mci-ai-launcher mci-ai-launcher--fallback"
    :style="fallbackStyle"
    hover-class="mci-ai-launcher--pressed"
    role="button"
    aria-label="打开AI助手"
    @touchstart="handleDragStart"
    @touchmove="handleDragMove"
    @touchend="handleDragEnd"
    @touchcancel="handleDragCancel"
    @tap="handleLauncherTap"
  >
    <view class="mci-ai-launcher__ring" />
    <image class="mci-ai-launcher__robot" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
    <text class="mci-ai-launcher__label">AI</text>
  </view>

  <view v-else-if="!isH5Dock" class="mci-ai-launcher-bridge" aria-hidden="true" />
</template>

<script>
import appConfig from '@/config.js'
import activeTabBar from '@/generated/active-tabbar.js'
import { getSafeAreaMetrics } from '@/utils/safe-area.js'
import { getAiAssistantEnabled } from '@/utils/sysconfig.js'

let runtimeTarget = 'other'
// #ifdef H5
runtimeTarget = 'h5'
// #endif
// #ifdef MP-WEIXIN
runtimeTarget = 'mp-weixin'
// #endif

const normalizeRoute = (value) => String(value || '').replace(/^\/+/, '').split('?')[0]
const normalizeAssetPath = (value) => {
  const path = String(value || '')
  if (!path || /^(?:https?:|data:|blob:|\/)/i.test(path)) return path
  return `/${path}`
}
const DRAG_THRESHOLD = 8
const EDGE_MARGIN = 12
const ACTION_SAFE_HEIGHT = 190
const POSITION_STORAGE_VERSION = 1

export default {
  name: 'MciAiLauncher',
  data() {
    return {
      activeIndex: -1,
      opening: false,
      switching: false,
      aiAssistantEnabled: false,
      safeTop: 0,
      safeHeaderHeight: 44,
      safeLeft: 0,
      safeRight: 0,
      safeBottom: 0,
      windowWidth: 0,
      windowHeight: 0,
      launcherX: null,
      launcherY: null,
      dragState: null,
      dragging: false,
      suppressTap: false,
      resizeHandler: null
    }
  },
  computed: {
    tabItems() {
      return (activeTabBar.list || []).map((item) => ({
        ...item,
        pagePath: normalizeRoute(item.pagePath),
        iconPath: normalizeAssetPath(item.iconPath),
        selectedIconPath: normalizeAssetPath(item.selectedIconPath || item.iconPath)
      }))
    },
    isTabBarPage() {
      return this.activeIndex >= 0
    },
    isH5Dock() {
      return activeTabBar.custom === true && runtimeTarget === 'h5' && this.isTabBarPage
    },
    isFallbackLauncher() {
      return this.aiAssistantEnabled
    },
    fallbackStyle() {
      if (Number.isFinite(this.launcherX) && Number.isFinite(this.launcherY)) {
        return {
          left: `${this.launcherX}px`,
          top: `${this.launcherY}px`,
          right: 'auto',
          bottom: 'auto'
        }
      }
      return {
        right: `calc(18rpx + ${this.safeRight}px)`,
        bottom: `calc(160rpx + ${this.safeBottom}px)`
      }
    }
  },
  mounted() {
    this.routeSyncTimers = []
    this.activate()
    this.resizeHandler = () => this.refreshSafeArea()
    try {
      if (typeof uni.onWindowResize === 'function') uni.onWindowResize(this.resizeHandler)
    } catch (error) {}
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
      if (this.resizeHandler && typeof uni.offWindowResize === 'function') {
        uni.offWindowResize(this.resizeHandler)
      }
    } catch (error) {}
  },
  methods: {
    activate() {
      this.syncActiveRoute()
      this.scheduleActiveRouteSync()
      this.refreshSafeArea()
      if (this.isH5Dock) this.activateH5Dock()
      else if (runtimeTarget === 'h5') this.releaseH5Dock()
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
      this.ensureLauncherPosition()
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
    syncActiveRoute() {
      const route = this.currentRoute()
      this.activeIndex = this.tabItems.findIndex((item) => item.pagePath === route)
    },
    clearRouteSyncTimers() {
      ;(this.routeSyncTimers || []).forEach((timer) => clearTimeout(timer))
      this.routeSyncTimers = []
    },
    scheduleActiveRouteSync() {
      this.clearRouteSyncTimers()
      ;[0, 32, 120].forEach((delay) => {
        this.routeSyncTimers.push(setTimeout(() => this.syncActiveRoute(), delay))
      })
    },
    activateH5Dock() {
      try {
        const task = uni.hideTabBar({ animation: false })
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
        const stillOnTab = this.tabItems.some((item) => item.pagePath === route)
        if (stillOnTab) return
        ;[document.documentElement, document.body].forEach((element) => {
          if (element) element.removeAttribute('data-mci-custom-tabbar')
        })
      }, 0)
    },
    async resolveAssistantVisibility() {
      const profileEnabled = appConfig.features && appConfig.features.ai === true
      const enabled = profileEnabled ? await getAiAssistantEnabled() : false
      this.aiAssistantEnabled = enabled
      this.updateGlobalAiState(enabled)
      this.syncWeixinTabBar()
      if (enabled) this.$nextTick(() => this.ensureLauncherPosition())
    },
    updateGlobalAiState(enabled) {
      try {
        const app = typeof getApp === 'function' ? getApp() : null
        if (app && app.globalData) app.globalData.mciAiAssistantEnabled = Boolean(enabled)
      } catch (error) {}
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
          list: this.tabItems,
          color: activeTabBar.color,
          selectedColor: activeTabBar.selectedColor,
          backgroundColor: activeTabBar.backgroundColor,
          aiAssistantEnabled: this.aiAssistantEnabled
        }
        if (typeof tabBar.applyExternalState === 'function') tabBar.applyExternalState(state)
        else tabBar.setData(state)
      } catch (error) {}
    },
    launcherStorageKey() {
      return `mci:ai-launcher-position:${appConfig.osClient || 'default'}`
    },
    launcherSize() {
      return Math.max(44, (this.windowWidth || 375) * 112 / 750)
    },
    launcherBounds() {
      const size = this.launcherSize()
      const bottomReserve = this.isTabBarPage ? 76 : 18
      const minX = this.safeLeft + EDGE_MARGIN
      const maxX = Math.max(minX, this.windowWidth - this.safeRight - size - EDGE_MARGIN)
      const minY = Math.max(this.safeTop, this.safeHeaderHeight) + EDGE_MARGIN
      const maxY = Math.max(
        minY,
        this.windowHeight - this.safeBottom - size - bottomReserve
      )
      return { size, minX, maxX, minY, maxY }
    },
    clampLauncherPosition(x, y) {
      const bounds = this.launcherBounds()
      return {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, Number(x) || 0)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, Number(y) || 0))
      }
    },
    routeHasBottomAction() {
      return /^(?:pages\/business\/(?:list|detail)|pages\/task\/list|pages\/native-form\/index|pages\/module\/detail)$/
        .test(this.currentRoute())
    },
    avoidBottomAction(position) {
      const bounds = this.launcherBounds()
      const rightSide = position.x >= bounds.maxX - 2
      if (!rightSide || !this.routeHasBottomAction()) return position
      const reservedTop = this.windowHeight - this.safeBottom - ACTION_SAFE_HEIGHT
      if (position.y + bounds.size <= reservedTop) return position
      return this.clampLauncherPosition(position.x, reservedTop - bounds.size - EDGE_MARGIN)
    },
    defaultLauncherPosition() {
      const bounds = this.launcherBounds()
      const bottomReserve = this.isTabBarPage ? 80 : 92
      const position = this.clampLauncherPosition(
        bounds.maxX,
        this.windowHeight - this.safeBottom - bounds.size - bottomReserve
      )
      return this.avoidBottomAction(position)
    },
    readLauncherPosition() {
      try {
        const stored = uni.getStorageSync(this.launcherStorageKey())
        if (!stored || Number(stored.version) !== POSITION_STORAGE_VERSION) return null
        if (!Number.isFinite(Number(stored.x)) || !Number.isFinite(Number(stored.y))) return null
        return this.avoidBottomAction(this.clampLauncherPosition(stored.x, stored.y))
      } catch (error) {
        return null
      }
    },
    persistLauncherPosition() {
      try {
        uni.setStorageSync(this.launcherStorageKey(), {
          version: POSITION_STORAGE_VERSION,
          x: this.launcherX,
          y: this.launcherY
        })
      } catch (error) {}
    },
    ensureLauncherPosition() {
      if (!this.windowWidth || !this.windowHeight) return
      const current = Number.isFinite(this.launcherX) && Number.isFinite(this.launcherY)
        ? this.avoidBottomAction(this.clampLauncherPosition(this.launcherX, this.launcherY))
        : (this.readLauncherPosition() || this.defaultLauncherPosition())
      this.launcherX = current.x
      this.launcherY = current.y
    },
    touchPoint(event, changed = false) {
      const source = changed ? event?.changedTouches : event?.touches
      const touch = source && source.length ? source[0] : null
      if (!touch) return null
      const x = Number(touch.clientX ?? touch.pageX)
      const y = Number(touch.clientY ?? touch.pageY)
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    },
    handleDragStart(event) {
      const point = this.touchPoint(event)
      if (!point) return
      this.ensureLauncherPosition()
      this.dragState = {
        startX: point.x,
        startY: point.y,
        originX: this.launcherX,
        originY: this.launcherY,
        moved: false
      }
      this.dragging = false
    },
    handleDragMove(event) {
      if (!this.dragState) return
      const point = this.touchPoint(event)
      if (!point) return
      const deltaX = point.x - this.dragState.startX
      const deltaY = point.y - this.dragState.startY
      if (!this.dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return
      this.dragState.moved = true
      this.dragging = true
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      const position = this.clampLauncherPosition(
        this.dragState.originX + deltaX,
        this.dragState.originY + deltaY
      )
      this.launcherX = position.x
      this.launcherY = position.y
    },
    handleDragEnd() {
      const touched = Boolean(this.dragState)
      const moved = Boolean(this.dragState && this.dragState.moved)
      this.dragState = null
      this.dragging = false
      if (!touched) return
      this.suppressNextTap()
      if (!moved) {
        this.openAssistant()
        return
      }
      const bounds = this.launcherBounds()
      const sideX = this.launcherX + bounds.size / 2 <= this.windowWidth / 2
        ? bounds.minX
        : bounds.maxX
      const position = this.avoidBottomAction(
        this.clampLauncherPosition(sideX, this.launcherY)
      )
      this.launcherX = position.x
      this.launcherY = position.y
      this.persistLauncherPosition()
    },
    handleDragCancel() {
      this.dragState = null
      this.dragging = false
      this.suppressNextTap()
    },
    suppressNextTap() {
      this.suppressTap = true
      setTimeout(() => { this.suppressTap = false }, 180)
    },
    handleLauncherTap() {
      if (this.suppressTap || this.dragging) return
      this.openAssistant()
    },
    switchTab(item, index) {
      if (this.switching || index === this.activeIndex) return
      this.switching = true
      uni.switchTab({
        url: `/${item.pagePath}`,
        success: () => this.scheduleActiveRouteSync(),
        fail: (error) => {
          this.syncActiveRoute()
          console.error('[MciBottomDock] switchTab failed:', error)
          uni.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => {
          this.switching = false
          this.scheduleActiveRouteSync()
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
  color: var(--mci-text-tertiary, #80909a);
  transition: transform 150ms ease, color 150ms ease, background-color 150ms ease;
}
.mci-bottom-dock__item--active { color: var(--mci-color-brand, #e54625); }
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
.mci-ai-launcher__robot { position: relative; z-index: 1; width: 76rpx; height: 76rpx; margin-top: -7rpx; pointer-events: none; }
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
  bottom: calc(160rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));
  z-index: 980;
  touch-action: none;
  user-select: none;
  will-change: left, top, transform;
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
</style>

<style>
html[data-mci-custom-tabbar="true"] .uni-tabbar,
body[data-mci-custom-tabbar="true"] .uni-tabbar {
  display: none !important;
}
html[data-mci-custom-tabbar="true"] uni-page-wrapper,
body[data-mci-custom-tabbar="true"] uni-page-wrapper {
  height: calc(100% - 64px - env(safe-area-inset-bottom, 0px)) !important;
}
html[data-mci-custom-tabbar="true"] uni-page-wrapper::after,
body[data-mci-custom-tabbar="true"] uni-page-wrapper::after {
  display: block;
  width: 100%;
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  content: '';
}
</style>
