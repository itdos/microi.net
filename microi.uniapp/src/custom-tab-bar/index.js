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
      this.refreshFromApp()
      this.measureSafeArea()
    }
  },

  pageLifetimes: {
    show() {
      this.refreshFromApp()
    }
  },

  methods: {
    refreshFromApp() {
      let appState = {}
      try {
        const app = getApp()
        appState = app && app.globalData ? app.globalData : {}
      } catch (error) {}

      const tabBar = appState.mciTabBar || {}
      const list = (Array.isArray(tabBar.list) ? tabBar.list : []).map((item) => ({
        pagePath: normalizeRoute(item.pagePath),
        text: item.text || '',
        iconPath: normalizeAssetPath(item.iconPath),
        selectedIconPath: normalizeAssetPath(item.selectedIconPath || item.iconPath)
      }))
      const route = getCurrentRoute()

      this.setData({
        list,
        selected: list.findIndex((item) => item.pagePath === route),
        color: tabBar.color || '#80909A',
        selectedColor: tabBar.selectedColor || '#E54625',
        backgroundColor: tabBar.backgroundColor || '#FFFFFF',
        aiAssistantEnabled: appState.mciAiAssistantEnabled === true
      })
    },

    applyExternalState(payload) {
      const state = payload && typeof payload === 'object' ? payload : {}
      const next = {}
      if (Array.isArray(state.list)) {
        next.list = state.list.map((item) => ({
          pagePath: normalizeRoute(item.pagePath),
          text: item.text || '',
          iconPath: normalizeAssetPath(item.iconPath),
          selectedIconPath: normalizeAssetPath(item.selectedIconPath || item.iconPath)
        }))
      }
      if (Number.isInteger(state.selected)) next.selected = state.selected
      if (typeof state.color === 'string') next.color = state.color
      if (typeof state.selectedColor === 'string') next.selectedColor = state.selectedColor
      if (typeof state.backgroundColor === 'string') next.backgroundColor = state.backgroundColor
      if (typeof state.aiAssistantEnabled === 'boolean') next.aiAssistantEnabled = state.aiAssistantEnabled
      this.setData(next)
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
      if (!Number.isInteger(index) || this.data.switching || index === this.data.selected) return
      const item = this.data.list[index]
      if (!item || !item.pagePath) return

      const previous = this.data.selected
      this.setData({ switching: true, selected: index })
      wx.switchTab({
        url: `/${item.pagePath}`,
        fail: (error) => {
          this.setData({ selected: previous })
          console.error('[MciBottomDock] switchTab failed:', error)
          wx.showToast({ title: '页面切换失败，请重试', icon: 'none' })
        },
        complete: () => {
          setTimeout(() => this.setData({ switching: false }), 280)
        }
      })
    }
  }
})
