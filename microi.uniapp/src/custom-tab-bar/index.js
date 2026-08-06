const normalizeRoute = (value) => String(value || '').replace(/^\/+/, '').split('?')[0]

const normalizeAssetPath = (value) => {
  const assetPath = String(value || '')
  if (!assetPath || /^(?:https?:|data:|blob:|\/)/i.test(assetPath)) return assetPath
  return `/${assetPath}`
}

const getCurrentRoute = () => {
  try {
    const pages = getCurrentPages()
    const page = pages && pages.length ? pages[pages.length - 1] : null
    return normalizeRoute(page && page.route)
  } catch (error) {
    return ''
  }
}

const normalizeList = (list) => (Array.isArray(list) ? list : []).map((item) => ({
  pagePath: normalizeRoute(item.pagePath),
  text: item.text || '',
  iconPath: normalizeAssetPath(item.iconPath),
  selectedIconPath: normalizeAssetPath(item.selectedIconPath || item.iconPath)
}))

Component({
  data: {
    list: [],
    selected: -1,
    color: '#80909A',
    selectedColor: '#E54625',
    backgroundColor: '#FFFFFF',
    aiAssistantEnabled: false,
    safeTop: 0,
    safeRight: 0,
    safeBottom: 0,
    safeLeft: 0,
    switching: false
  },

  lifetimes: {
    attached() {
      this.routeSyncTimers = []
      this.refreshFromApp()
      this.scheduleRouteSync()
      this.measureSafeArea()
    },
    detached() {
      this.clearRouteSyncTimers()
    }
  },

  pageLifetimes: {
    show() {
      this.refreshFromApp()
      this.scheduleRouteSync()
    }
  },

  methods: {
    selectedIndexForRoute(list = this.data.list) {
      const route = getCurrentRoute()
      return list.findIndex((item) => item.pagePath === route)
    },

    syncSelectedFromRoute() {
      const selected = this.selectedIndexForRoute()
      if (selected !== this.data.selected) this.setData({ selected })
    },

    clearRouteSyncTimers() {
      ;(this.routeSyncTimers || []).forEach((timer) => clearTimeout(timer))
      this.routeSyncTimers = []
    },

    scheduleRouteSync() {
      this.clearRouteSyncTimers()
      ;[0, 32, 120].forEach((delay) => {
        const timer = setTimeout(() => this.syncSelectedFromRoute(), delay)
        this.routeSyncTimers.push(timer)
      })
    },

    refreshFromApp() {
      let appState = {}
      try {
        const app = getApp()
        appState = app && app.globalData ? app.globalData : {}
      } catch (error) {}

      const tabBar = appState.mciTabBar || {}
      const list = normalizeList(tabBar.list)
      this.setData({
        list,
        selected: this.selectedIndexForRoute(list),
        color: tabBar.color || '#80909A',
        selectedColor: tabBar.selectedColor || '#E54625',
        backgroundColor: tabBar.backgroundColor || '#FFFFFF',
        aiAssistantEnabled: appState.mciAiAssistantEnabled === true
      })
    },

    applyExternalState(payload) {
      const state = payload && typeof payload === 'object' ? payload : {}
      const next = {}
      const list = Array.isArray(state.list) ? normalizeList(state.list) : this.data.list
      if (Array.isArray(state.list)) next.list = list
      if (typeof state.color === 'string') next.color = state.color
      if (typeof state.selectedColor === 'string') next.selectedColor = state.selectedColor
      if (typeof state.backgroundColor === 'string') next.backgroundColor = state.backgroundColor
      if (typeof state.aiAssistantEnabled === 'boolean') next.aiAssistantEnabled = state.aiAssistantEnabled
      next.selected = this.selectedIndexForRoute(list)
      this.setData(next)
      this.scheduleRouteSync()
    },

    measureSafeArea() {
      let info = null
      try {
        info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
      } catch (error) {
        try {
          info = wx.getSystemInfoSync()
        } catch (fallbackError) {}
      }
      if (!info) return

      const insets = info.safeAreaInsets || {}
      const safeArea = info.safeArea || {}
      const windowWidth = Number(info.screenWidth || info.windowWidth || 0)
      const windowHeight = Number(info.screenHeight || info.windowHeight || 0)
      const safeRight = Number.isFinite(Number(insets.right))
        ? Number(insets.right)
        : Math.max(0, windowWidth - Number(safeArea.right || windowWidth))
      const safeBottom = Number.isFinite(Number(insets.bottom))
        ? Number(insets.bottom)
        : Math.max(0, windowHeight - Number(safeArea.bottom || windowHeight))
      const safeLeft = Number.isFinite(Number(insets.left))
        ? Number(insets.left)
        : Math.max(0, Number(safeArea.left || 0))
      const safeTop = Number.isFinite(Number(insets.top))
        ? Number(insets.top)
        : Math.max(0, Number(safeArea.top || 0))

      this.setData({ safeTop, safeRight, safeBottom, safeLeft })
    },

    switchTab(event) {
      const index = Number(event && event.currentTarget && event.currentTarget.dataset.index)
      if (!Number.isInteger(index) || this.data.switching) return
      const item = this.data.list[index]
      if (!item || !item.pagePath) return

      const currentIndex = this.selectedIndexForRoute()
      if (index === currentIndex) {
        if (this.data.selected !== currentIndex) this.setData({ selected: currentIndex })
        return
      }

      this.setData({ switching: true })
      wx.switchTab({
        url: `/${item.pagePath}`,
        success: () => this.scheduleRouteSync(),
        fail: (error) => {
          this.syncSelectedFromRoute()
          console.error('[MciBottomDock] switchTab failed:', error)
          wx.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => {
          this.setData({ switching: false })
          this.scheduleRouteSync()
        }
      })
    }
  }
})
