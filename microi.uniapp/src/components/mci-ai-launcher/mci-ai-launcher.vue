<template>
  <view
    v-if="isH5Dock"
    class="mci-bottom-dock"
    :class="{ 'mci-bottom-dock--without-ai': !aiAssistantEnabled }"
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

    <view
      v-if="aiAssistantEnabled"
      class="mci-ai-launcher mci-bottom-dock__ai-slot"
      hover-class="mci-ai-launcher--pressed"
      role="button"
      aria-label="打开AI助手"
      @tap="openAssistant"
    >
      <view class="mci-ai-launcher__ring" />
      <image class="mci-ai-launcher__robot" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
      <text class="mci-ai-launcher__label">AI</text>
    </view>
  </view>

  <view
    v-else-if="isFallbackLauncher"
    class="mci-ai-launcher mci-ai-launcher--fallback"
    :style="fallbackStyle"
    hover-class="mci-ai-launcher--pressed"
    role="button"
    aria-label="打开AI助手"
    @tap="openAssistant"
  >
    <view class="mci-ai-launcher__ring" />
    <image class="mci-ai-launcher__robot" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
    <text class="mci-ai-launcher__label">AI</text>
  </view>

  <view v-else class="mci-ai-launcher-bridge" aria-hidden="true" />
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

export default {
  name: 'MciAiLauncher',
  data() {
    return {
      activeIndex: -1,
      opening: false,
      switching: false,
      aiAssistantEnabled: false,
      safeRight: 0,
      safeBottom: 0
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
      return runtimeTarget === 'h5' && this.isTabBarPage
    },
    isFallbackLauncher() {
      const runtimeUsesNativeDock = runtimeTarget === 'h5' || runtimeTarget === 'mp-weixin'
      return this.aiAssistantEnabled && (!this.isTabBarPage || !runtimeUsesNativeDock)
    },
    fallbackStyle() {
      return {
        right: `calc(18rpx + ${this.safeRight}px)`,
        bottom: `calc(160rpx + ${this.safeBottom}px)`
      }
    }
  },
  mounted() {
    this.activate()
  },
  activated() {
    this.activate()
  },
  deactivated() {
    this.releaseH5Dock()
  },
  beforeUnmount() {
    this.releaseH5Dock()
  },
  methods: {
    activate() {
      this.syncActiveRoute()
      this.refreshSafeArea()
      if (this.isH5Dock) this.activateH5Dock()
      else if (runtimeTarget === 'h5') this.releaseH5Dock()
      this.syncWeixinTabBar()
      this.resolveAssistantVisibility()
    },
    refreshSafeArea() {
      const metrics = getSafeAreaMetrics()
      this.safeRight = Number(metrics && metrics.right) || 0
      this.safeBottom = Number(metrics && metrics.bottom) || 0
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
        tabBar.setData({
          list: this.tabItems,
          selected: this.activeIndex,
          color: activeTabBar.color,
          selectedColor: activeTabBar.selectedColor,
          backgroundColor: activeTabBar.backgroundColor,
          aiAssistantEnabled: this.aiAssistantEnabled
        })
      } catch (error) {}
    },
    switchTab(item, index) {
      if (this.switching || index === this.activeIndex) return
      const previous = this.activeIndex
      this.switching = true
      this.activeIndex = index
      uni.switchTab({
        url: `/${item.pagePath}`,
        fail: (error) => {
          this.activeIndex = previous
          console.error('[MciBottomDock] switchTab failed:', error)
          uni.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => {
          setTimeout(() => { this.switching = false }, 280)
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
