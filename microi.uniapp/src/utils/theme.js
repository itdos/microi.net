/**
 * Profile 驱动的固定品牌主题。
 *
 * 每个交付 Profile 只有一套受控主题，不向最终用户暴露主题切换。页面只
 * 消费 MCI 令牌，客户品牌色由 Profile 统一注入。
 */

import { t as _t, getLang } from './i18n.js'
import { getSafeAreaMetrics, getSafeAreaTokenStyle } from './safe-area.js'
import appConfig from '@/config.js'

const PROFILE_THEME = appConfig.theme || {}
const WATER_PRIMARY = PROFILE_THEME.primary || '#087DA8'
const WATER_LIGHT = PROFILE_THEME.primaryLight || '#18A6B8'
const WATER_DARK = PROFILE_THEME.primaryDark || '#063B5C'
const BRAND_CORAL = PROFILE_THEME.brand || '#E54625'
const FIXED_GRADIENT = `linear-gradient(135deg, ${WATER_DARK} 0%, ${WATER_PRIMARY} 58%, ${WATER_LIGHT} 100%)`
const TAB_BAR_ROUTES = [
  'pages/workspace/index',
  'pages/mall/index',
  'pages/news/index',
  'pages/message/index',
  'pages/profile/index'
]

function isCurrentTabBarPage() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const current = pages && pages.length ? pages[pages.length - 1] : null
    return !!(current && current.route && TAB_BAR_ROUTES.includes(current.route))
  } catch (e) {
    return false
  }
}

function rgba(hex, opacity) {
  const source = String(hex || WATER_PRIMARY).replace('#', '')
  const r = parseInt(source.slice(0, 2), 16)
  const g = parseInt(source.slice(2, 4), 16)
  const b = parseInt(source.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function getTheme() {
  return WATER_PRIMARY
}

export function setTheme() {
  return WATER_PRIMARY
}

export function getThemeMode() {
  return 'light'
}

export function setThemeMode() {
  return 'light'
}

export function getThemeGradient() {
  return FIXED_GRADIENT
}

export function getThemeLightBg(color = WATER_PRIMARY, opacity = 0.08) {
  return rgba(color, opacity)
}

export function getMciTokenStyle() {
  return {
    '--mci-color-primary': WATER_PRIMARY,
    '--mci-color-primary-light': WATER_LIGHT,
    '--mci-color-primary-dark': WATER_DARK,
    '--mci-color-primary-glow': rgba(WATER_PRIMARY, 0.18),
    '--mci-color-brand': BRAND_CORAL,
    '--mci-border-glow': rgba(WATER_PRIMARY, 0.25),
    '--mci-shadow-button': `0 4px 14px ${rgba(WATER_PRIMARY, 0.20)}`,
    '--mci-shadow-button-hover': `0 8px 22px ${rgba(WATER_PRIMARY, 0.28)}`,
    '--mci-glow-primary': `0 0 24px ${rgba(WATER_PRIMARY, 0.18)}`,
    '--mci-gradient-primary': FIXED_GRADIENT,
    '--theme': WATER_PRIMARY,
    '--color-primary': WATER_PRIMARY
  }
}

export function getMciModeTokenStyle() {
  return {
    '--mci-bg-base': '#F3F7F9',
    '--mci-bg-elevated': '#FFFFFF',
    '--mci-bg-card': 'rgba(255, 255, 255, 0.96)',
    '--mci-bg-card-hover': '#FFFFFF',
    '--mci-text-primary': '#17313D',
    '--mci-text-secondary': 'rgba(23, 49, 61, 0.66)',
    '--mci-text-tertiary': 'rgba(23, 49, 61, 0.46)',
    '--mci-border-color': 'rgba(20, 65, 84, 0.10)',
    '--mci-border-color-hover': 'rgba(20, 65, 84, 0.18)'
  }
}

export function applyThemeMode() {
  // #ifdef H5
  try {
    document.documentElement.setAttribute('data-theme', 'light')
    if (document.body) document.body.setAttribute('data-theme', 'light')
  } catch (e) {}
  // #endif
}

export function applyTabBarTheme() {
  if (!isCurrentTabBarPage()) return
  try {
    const task = uni.setTabBarStyle({
      color: '#80909A',
      selectedColor: BRAND_CORAL,
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
  applyMciTheme()
}

export const themeMixin = {
  data() {
    return {
      _themeColor: WATER_PRIMARY,
      _themeMode: 'light',
      _currentLang: getLang(),
      _safeAreaMetrics: getSafeAreaMetrics()
    }
  },
  computed: {
    themeColor() { return WATER_PRIMARY },
    themeMode() { return 'light' },
    isDarkMode() { return false },
    themeGradient() { return FIXED_GRADIENT },
    themeColorLight() { return getThemeLightBg(WATER_PRIMARY, 0.08) },
    themeColorLighter() { return getThemeLightBg(WATER_PRIMARY, 0.05) },
    xjyAssets() { return appConfig.cdnAssets || {} },
    profileAssets() { return appConfig.cdnAssets || {} },
    mciTokenStyle() {
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
  }
}

export default {
  getTheme,
  setTheme,
  getThemeMode,
  setThemeMode,
  getThemeGradient,
  getThemeLightBg,
  getMciTokenStyle,
  getMciModeTokenStyle,
  applyThemeMode,
  applyTabBarTheme,
  applyMciTokensH5,
  applyMciTheme,
  initializeThemeSystem,
  themeMixin
}
