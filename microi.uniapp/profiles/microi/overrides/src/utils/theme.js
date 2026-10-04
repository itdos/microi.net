/**
 * API 租户优先的运行时品牌与主题。
 *
 * Sys_Config 中存在的标题、Logo 与主题色优先生效；任一字段缺失或不合法时，
 * 仅该字段回退到 Microi吾码 Profile。移动端可按当前 API + OsClient 保存本机覆盖，
 * 并随时切回“跟随 PC”。
 */

import { t as _t, getLang } from './i18n.js'
import { getSafeAreaMetrics, getSafeAreaTokenStyle } from './safe-area.js'
import appConfig from '@/config.js'
import activeTabBar from '@/generated/active-tabbar.js'
import { resolveRuntimeBranding } from '@/platform/runtime-branding.mjs'
import {
  MOBILE_THEME_OPTIONS,
  getMobileThemeOption,
  mobileThemeStorageKey,
  normalizeMobileThemeMode,
  resolveMobileTheme
} from '@/platform/mobile-theme.mjs'

const PROFILE_THEME = appConfig.theme || {}
const FALLBACK_BRANDING = Object.freeze({
  appName: appConfig.appName || 'Microi吾码',
  platformName: appConfig.platformName || appConfig.appName || 'Microi吾码',
  servicePlatformName: appConfig.servicePlatformName || appConfig.platformName || appConfig.appName || 'Microi吾码',
  appSubTitle: appConfig.appSubTitle || '',
  workspaceSubTitle: appConfig.workspaceSubTitle || '',
  companyName: appConfig.companyName || '',
  logoUrl: appConfig.logoUrl || '/static/microi-blue-256.png',
  theme: {
    primary: PROFILE_THEME.primary || '#2563EB',
    primaryLight: PROFILE_THEME.primaryLight || '#5B8CFF',
    primaryDark: PROFILE_THEME.primaryDark || '#1749B6',
    brand: PROFILE_THEME.brand || '#2563EB'
  }
})
let runtimeSystemBranding = resolveRuntimeBranding({}, FALLBACK_BRANDING)
let runtimeBranding = { ...runtimeSystemBranding, theme: { ...runtimeSystemBranding.theme } }
const runtimeBrandingListeners = new Set()
const TAB_BAR_ROUTES = (activeTabBar.list || [])
  .map((item) => String(item.pagePath || '').replace(/^\/+/, '').split('?')[0])
  .filter(Boolean)

function isCurrentTabBarPage() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const current = pages && pages.length ? pages[pages.length - 1] : null
    return !!(current && current.route && TAB_BAR_ROUTES.includes(current.route))
  } catch (e) {
    return false
  }
}

function currentPageEntry() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    return pages && pages.length ? pages[pages.length - 1] : null
  } catch (e) {
    return null
  }
}

export function syncCustomTabBarSelection() {
  const current = currentPageEntry()
  const route = String(current && (current.route || current.$page?.route) || '').replace(/^\/+/, '').split('?')[0]
  const selected = TAB_BAR_ROUTES.indexOf(route)
  if (selected < 0) return

  try {
    const pageScope = current && (current.$vm?.$scope || current.$scope)
    const tabBar = current && typeof current.getTabBar === 'function'
      ? current.getTabBar()
      : (pageScope && typeof pageScope.getTabBar === 'function' ? pageScope.getTabBar() : null)
    if (tabBar && typeof tabBar.syncSelectedFromRoute === 'function') {
      tabBar.syncSelectedFromRoute()
    } else if (tabBar && typeof tabBar.setData === 'function') {
      tabBar.setData({ selected })
    }
  } catch (e) {}
}

function scheduleCustomTabBarSelectionSync() {
  ;[0, 50, 200, 600].forEach((delay) => {
    setTimeout(() => syncCustomTabBarSelection(), delay)
  })
}

function rgba(hex, opacity) {
  const source = String(hex || runtimeBranding.theme.primary).replace('#', '')
  const r = parseInt(source.slice(0, 2), 16)
  const g = parseInt(source.slice(2, 4), 16)
  const b = parseInt(source.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function getTheme() {
  return runtimeBranding.theme.primary
}

function currentThemeStorageKey() {
  return mobileThemeStorageKey({
    profileId: appConfig.profileId,
    apiBase: appConfig.apiBase,
    osClient: appConfig.osClient
  })
}

export function getThemeMode() {
  try {
    const stored = uni.getStorageSync(currentThemeStorageKey())
    return normalizeMobileThemeMode(stored && typeof stored === 'object' ? stored.mode : stored)
  } catch (error) {
    return 'system'
  }
}

export function getThemeOptions() {
  return MOBILE_THEME_OPTIONS.map((item) => ({
    ...item,
    color: item.key === 'system' ? runtimeSystemBranding.theme.primary : item.color
  }))
}

export function getThemeLabel() {
  return getMobileThemeOption(getThemeMode()).label
}

export function getSystemTheme() {
  return { ...runtimeSystemBranding.theme }
}

export function setThemeMode(mode) {
  const normalizedMode = normalizeMobileThemeMode(mode)
  try {
    uni.setStorageSync(currentThemeStorageKey(), {
      version: 1,
      mode: normalizedMode,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {}
  return publishRuntimeBranding(runtimeSystemBranding)
}

export function setTheme(mode) {
  return setThemeMode(mode)
}

export function getThemeGradient() {
  const theme = runtimeBranding.theme
  return `linear-gradient(135deg, ${theme.primaryDark} 0%, ${theme.primary} 58%, ${theme.primaryLight} 100%)`
}

export function getThemeLightBg(color = runtimeBranding.theme.primary, opacity = 0.08) {
  return rgba(color, opacity)
}

export function getMciTokenStyle() {
  const theme = runtimeBranding.theme
  return {
    '--mci-color-primary': theme.primary,
    '--mci-color-primary-light': theme.primaryLight,
    '--mci-color-primary-dark': theme.primaryDark,
    '--mci-color-primary-glow': rgba(theme.primary, 0.18),
    '--mci-color-primary-soft': rgba(theme.primary, 0.09),
    '--mci-color-primary-faint': rgba(theme.primary, 0.045),
    '--mci-color-brand': theme.brand,
    '--mci-color-brand-glow': rgba(theme.brand, 0.30),
    '--mci-color-brand-soft': rgba(theme.brand, 0.08),
    '--mci-border-glow': rgba(theme.primary, 0.25),
    '--mci-shadow-button': `0 4px 14px ${rgba(theme.primary, 0.20)}`,
    '--mci-shadow-button-hover': `0 8px 22px ${rgba(theme.primary, 0.28)}`,
    '--mci-glow-primary': `0 0 24px ${rgba(theme.primary, 0.18)}`,
    '--mci-gradient-primary': getThemeGradient(),
    '--mci-hero-shade': `linear-gradient(120deg, ${rgba(theme.primaryDark, 0.28)} 0%, ${rgba(theme.primary, 0.08)} 58%, ${rgba(theme.primaryLight, 0.02)} 100%)`,
    '--theme': theme.primary,
    '--color-primary': theme.primary
  }
}

export function getMciModeTokenStyle() {
  return {
    '--mci-bg-base': '#F8FAFC',
    '--mci-bg-elevated': '#FFFFFF',
    '--mci-bg-soft': '#F1F5F9',
    '--mci-app-canvas': '#F8FAFC',
    '--mci-app-canvas-warm': '#F8FAFC',
    '--mci-app-surface': '#FFFFFF',
    '--mci-app-surface-soft': '#F1F5F9',
    '--mci-app-surface-muted': '#E8EEF6',
    '--mci-home-canvas': '#F8FAFC',
    '--mci-home-surface': '#FFFFFF',
    '--mci-home-horizon': '#F8FAFC',
    '--mci-bg-card': '#FFFFFF',
    '--mci-bg-card-hover': '#FFFFFF',
    '--mci-text-primary': '#111827',
    '--mci-text-secondary': '#667280',
    '--mci-text-tertiary': '#9CA3AF',
    '--mci-ops-header': '#FFFFFF',
    '--mci-text-on-primary': '#FFFFFF',
    '--mci-text-on-primary-soft': 'rgba(255, 255, 255, 0.76)',
    '--mci-text-on-primary-muted': 'rgba(255, 255, 255, 0.58)',
    '--mci-surface-on-primary': 'rgba(255, 255, 255, 0.10)',
    '--mci-surface-on-primary-strong': 'rgba(255, 255, 255, 0.16)',
    '--mci-border-on-primary': 'rgba(255, 255, 255, 0.20)',
    '--mci-border-color': '#E5E7EB',
    '--mci-border-color-hover': '#CBD5E1',
    '--mci-divider': '#E5E7EB',
    '--mci-focus-ring': 'rgba(37, 99, 235, 0.34)',
    '--mci-color-success': '#10B981',
    '--mci-color-warning': '#F59E0B',
    '--mci-color-danger': '#EF4444',
    '--mci-color-info': '#2563EB',
    '--mci-color-success-soft': '#ECFDF5',
    '--mci-color-warning-soft': '#FFFBEB',
    '--mci-color-danger-soft': '#FEF2F2',
    '--mci-color-info-soft': '#EFF6FF',
    '--mci-shadow-card': '0 4px 18px rgba(15, 23, 42, 0.055)',
    '--mci-shadow-nav': '0 1px 0 rgba(15, 23, 42, 0.08)',
    '--mci-shadow-deck': '0 10px 28px rgba(37, 99, 235, 0.18)',
    '--mci-shadow-dock': '0 -8px 24px rgba(15, 23, 42, 0.07)',
    '--mci-shadow-contact': '0 6px 20px rgba(15, 23, 42, 0.06)',
    '--mci-radius-control': '12px',
    '--mci-radius-surface': '14px',
    '--mci-radius-deck': '16px'
  }
}

function resolveRuntimeLogo(value) {
  let source = String(value || '').trim()
  if (!source) return ''
  if (source.startsWith('{')) {
    try {
      const parsed = JSON.parse(source)
      source = String(parsed.Path || parsed.path || '').trim()
    } catch (error) {
      return ''
    }
  }
  if (!source) return ''
  if (/^https:\/\//i.test(source) || source.startsWith('data:image/')) return source
  if (/^http:\/\//i.test(source)) return ''
  if (source.startsWith('.')) return source
  const fileServer = String(appConfig.fileServer || appConfig.apiBase || '').replace(/\/+$/, '')
  return fileServer ? `${fileServer}/${source.replace(/^\/+/, '')}` : ''
}

function publishRuntimeBranding(nextSystemBranding) {
  runtimeSystemBranding = {
    ...nextSystemBranding,
    theme: { ...nextSystemBranding.theme }
  }
  runtimeBranding = {
    ...runtimeSystemBranding,
    theme: resolveMobileTheme(runtimeSystemBranding.theme, getThemeMode())
  }
  appConfig.appName = runtimeBranding.appName
  appConfig.platformName = runtimeBranding.platformName
  appConfig.servicePlatformName = runtimeBranding.servicePlatformName
  appConfig.appSubTitle = runtimeBranding.appSubTitle
  appConfig.workspaceSubTitle = runtimeBranding.workspaceSubTitle
  appConfig.companyName = runtimeBranding.companyName
  appConfig.logoUrl = runtimeBranding.logoUrl
  appConfig.theme = { ...runtimeBranding.theme }
  applyMciTheme()
  runtimeBrandingListeners.forEach((listener) => {
    try { listener(getRuntimeBranding()) } catch (error) {}
  })
  return getRuntimeBranding()
}

export function getRuntimeBranding() {
  return {
    ...runtimeBranding,
    theme: { ...runtimeBranding.theme }
  }
}

export function applyRuntimeBranding(sysConfig = {}) {
  const model = appConfig.tenantBranding === false ? {} : sysConfig
  return publishRuntimeBranding(resolveRuntimeBranding(model, FALLBACK_BRANDING, {
    resolveLogo: resolveRuntimeLogo
  }))
}

export function resetRuntimeBranding() {
  return publishRuntimeBranding(resolveRuntimeBranding({}, FALLBACK_BRANDING))
}

export function subscribeRuntimeBranding(listener) {
  if (typeof listener !== 'function') return () => {}
  runtimeBrandingListeners.add(listener)
  return () => runtimeBrandingListeners.delete(listener)
}

export function applyThemeMode() {
  // #ifdef H5
  try {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('data-mci-theme', getThemeMode())
    if (document.body) document.body.setAttribute('data-theme', 'light')
    if (document.body) document.body.setAttribute('data-mci-theme', getThemeMode())
  } catch (e) {}
  // #endif
}

export function applyTabBarTheme() {
  if (!isCurrentTabBarPage()) return
  const selectedColor = runtimeBranding.theme.primary
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    if (app && app.globalData) {
      app.globalData.mciTabBar = {
        ...(app.globalData.mciTabBar || activeTabBar),
        selectedColor
      }
    }
    const current = currentPageEntry()
    const pageScope = current && (current.$vm?.$scope || current.$scope)
    const customTabBar = current && typeof current.getTabBar === 'function'
      ? current.getTabBar()
      : (pageScope && typeof pageScope.getTabBar === 'function' ? pageScope.getTabBar() : null)
    if (customTabBar && typeof customTabBar.setData === 'function') customTabBar.setData({ selectedColor })
    const task = uni.setTabBarStyle({
      color: '#80909A',
      selectedColor,
      backgroundColor: '#FFFFFF',
      borderStyle: 'black',
      fail: () => {}
    })
    if (task && typeof task.catch === 'function') task.catch(() => {})
  } catch (e) {}
}

export function applyMciTokensH5() {
  // #ifdef H5
  try {
    const root = document.documentElement
    const tokens = {
      ...getMciTokenStyle(),
      ...getMciModeTokenStyle(),
      ...getSafeAreaTokenStyle(getSafeAreaMetrics())
    }
    Object.keys(tokens).forEach((key) => root.style.setProperty(key, tokens[key]))
  } catch (e) {}
  // #endif
}

export function applyMciTheme() {
  applyThemeMode()
  applyMciTokensH5()
  applyTabBarTheme()
}

export function initializeThemeSystem() {
  publishRuntimeBranding(runtimeSystemBranding)
}

export const themeMixin = {
  data() {
    return {
      mciThemeRevision: 0,
      mciThemeUnsubscribe: null,
      _currentLang: getLang(),
      _safeAreaMetrics: getSafeAreaMetrics()
    }
  },
  computed: {
    runtimeBranding() {
      void this.mciThemeRevision
      return getRuntimeBranding()
    },
    themeColor() {
      void this.mciThemeRevision
      return getTheme()
    },
    themeMode() {
      void this.mciThemeRevision
      return getThemeMode()
    },
    isDarkMode() { return false },
    themeGradient() {
      void this.mciThemeRevision
      return getThemeGradient()
    },
    themeColorLight() {
      void this.mciThemeRevision
      return getThemeLightBg(getTheme(), 0.08)
    },
    themeColorLighter() {
      void this.mciThemeRevision
      return getThemeLightBg(getTheme(), 0.05)
    },
    profileAssets() { return appConfig.cdnAssets || {} },
    mciTokenStyle() {
      void this.mciThemeRevision
      return {
        ...getMciTokenStyle(),
        ...getMciModeTokenStyle(),
        ...getSafeAreaTokenStyle(this._safeAreaMetrics)
      }
    },
    safeTopStyle() {
      return {
        paddingTop: `${(this._safeAreaMetrics && this._safeAreaMetrics.statusBarHeight) || 0}px`
      }
    }
  },
  created() {
    this.mciThemeUnsubscribe = subscribeRuntimeBranding(() => {
      this.mciThemeRevision += 1
    })
  },
  beforeUnmount() {
    if (this.mciThemeUnsubscribe) this.mciThemeUnsubscribe()
    this.mciThemeUnsubscribe = null
  },
  methods: {
    t(key, params) {
      void this._currentLang
      return _t(key, params)
    },
    refreshSafeArea() {
      this._safeAreaMetrics = getSafeAreaMetrics()
      if (
        this.$data &&
        Object.prototype.hasOwnProperty.call(this.$data, 'statusBarHeight')
      ) {
        this.statusBarHeight = this._safeAreaMetrics.statusBarHeight || 0
      }
    }
  },
  onLoad() {
    this.refreshSafeArea()
  },
  onShow() {
    this._currentLang = getLang()
    this.refreshSafeArea()
    applyMciTheme()
    scheduleCustomTabBarSelectionSync()
  }
}

export default {
  getTheme,
  setTheme,
  getThemeMode,
  setThemeMode,
  getThemeOptions,
  getThemeLabel,
  getSystemTheme,
  getThemeGradient,
  getThemeLightBg,
  getMciTokenStyle,
  getMciModeTokenStyle,
  getRuntimeBranding,
  applyRuntimeBranding,
  resetRuntimeBranding,
  subscribeRuntimeBranding,
  applyThemeMode,
  applyTabBarTheme,
  applyMciTokensH5,
  applyMciTheme,
  syncCustomTabBarSelection,
  initializeThemeSystem,
  themeMixin
}
