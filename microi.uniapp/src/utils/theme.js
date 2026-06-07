/**
 * 主题色 + 多语言 统一 Mixin
 * 用法：
 *   import { themeMixin } from '@/utils/theme.js'
 *   export default { mixins: [themeMixin], ... }
 *   模板中：{{ t('common.confirm') }}  {{ themeColor }}  {{ themeGradient }}
 */

import { t as _t, getLang } from './i18n.js'

const STORAGE_KEY = 'microi_theme_color'
const MODE_STORAGE_KEY = 'mci-theme'
// MCI 设计系统主色（与 Microi.Client / microi.app 移动端 mci-color-primary 保持一致）
const DEFAULT_COLOR = '#6C2BD9'
const DEFAULT_MODE = 'light'
const TAB_BAR_ROUTES = [
  'pages/mall/index',
  'pages/news/index',
  'pages/workspace/index',
  'pages/message/index',
  'pages/profile/index'
]

function getSystemTheme() {
  try {
    const baseInfo = uni.getAppBaseInfo ? uni.getAppBaseInfo() : null
    if (baseInfo && (baseInfo.theme === 'light' || baseInfo.theme === 'dark')) {
      return baseInfo.theme
    }
  } catch (e) {}

  try {
    const sysInfo = uni.getSystemInfoSync()
    if (sysInfo && (sysInfo.theme === 'light' || sysInfo.theme === 'dark')) {
      return sysInfo.theme
    }
  } catch (e) {}

  return DEFAULT_MODE
}

function isCurrentTabBarPage() {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const current = pages && pages.length ? pages[pages.length - 1] : null
    return !!(current && current.route && TAB_BAR_ROUTES.includes(current.route))
  } catch (e) {
    return false
  }
}

// 获取当前主题色
export function getTheme() {
  try {
    return uni.getStorageSync(STORAGE_KEY) || DEFAULT_COLOR
  } catch (e) {
    return DEFAULT_COLOR
  }
}

// 设置主题色
export function setTheme(color) {
  try { uni.setStorageSync(STORAGE_KEY, color) } catch (e) {}
  applyMciTheme(getThemeMode(), color)
}

// 获取当前主题模式（light / dark）
export function getThemeMode() {
  try {
    const saved = uni.getStorageSync(MODE_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch (e) {}

  return getSystemTheme()
}

// 设置主题模式
export function setThemeMode(mode) {
  const next = mode === 'dark' ? 'dark' : 'light'
  try { uni.setStorageSync(MODE_STORAGE_KEY, next) } catch (e) {}
  applyThemeMode(next)
  applyTabBarTheme(next, getTheme())
}

/**
 * 将 hex 颜色调亮（用于渐变终点）
 * @param {string} hex
 * @param {number} amount  0~100
 */
function lightenColor(hex, amount = 30) {
  hex = hex.replace('#', '')
  let r = parseInt(hex.substr(0, 2), 16)
  let g = parseInt(hex.substr(2, 2), 16)
  let b = parseInt(hex.substr(4, 2), 16)
  r = Math.min(255, r + amount)
  g = Math.min(255, g + amount)
  b = Math.min(255, b + amount)
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成主题色渐变 (135deg)
 * @param {string} color  主题色 hex
 */
export function getThemeGradient(color) {
  const c = color || getTheme()
  const light = lightenColor(c, 40)
  return `linear-gradient(135deg, ${c} 0%, ${light} 100%)`
}

/**
 * 生成浅版背景色 (用于 icon 背景等)
 * @param {string} color  主题色 hex
 * @param {number} opacity  0~1
 */
export function getThemeLightBg(color, opacity = 0.08) {
  const c = color || getTheme()
  const hex = c.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * 将 hex 颜色调暗
 */
function darkenColor(hex, amount = 30) {
  hex = hex.replace('#', '')
  let r = parseInt(hex.substr(0, 2), 16)
  let g = parseInt(hex.substr(2, 2), 16)
  let b = parseInt(hex.substr(4, 2), 16)
  r = Math.max(0, r - amount)
  g = Math.max(0, g - amount)
  b = Math.max(0, b - amount)
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

/**
 * 构建 MCI 设计系统 CSS 变量样式对象
 * 用法：模板根节点 <view :style="mciTokenStyle">
 * 与 Microi.Client/src/utils/theme-color.js 的 setThemeColor 保持一致
 */
export function getMciTokenStyle(color) {
  const c = color || getTheme()
  const light = lightenColor(c, 30)
  const dark = darkenColor(c, 30)
  const glow = getThemeLightBg(c, 0.20)
  const borderGlow = getThemeLightBg(c, 0.32)
  const shadowSoft = getThemeLightBg(c, 0.20)
  const shadowHover = getThemeLightBg(c, 0.32)
  return {
    '--mci-color-primary': c,
    '--mci-color-primary-light': light,
    '--mci-color-primary-dark': dark,
    '--mci-color-primary-glow': glow,
    '--mci-border-glow': borderGlow,
    '--mci-shadow-button': `0 4px 14px ${shadowSoft}`,
    '--mci-shadow-button-hover': `0 8px 22px ${shadowHover}`,
    '--mci-glow-primary': `0 0 24px ${glow}`,
    '--mci-gradient-primary': `linear-gradient(135deg, ${c} 0%, #2196F3 100%)`,
    /* 兼容旧主题变量 */
    '--theme': c,
    '--color-primary': c
  }
}

/**
 * 构建浅色 / 深色语义变量（让页面即便未使用 page[data-theme] 也能切换）
 */
export function getMciModeTokenStyle(mode) {
  const isDark = mode === 'dark'
  return isDark
    ? {
        '--mci-bg-base': '#0A0A0F',
        '--mci-bg-elevated': '#121218',
        '--mci-bg-card': 'rgba(255, 255, 255, 0.04)',
        '--mci-bg-card-hover': 'rgba(255, 255, 255, 0.08)',
        '--mci-text-primary': '#FFFFFF',
        '--mci-text-secondary': 'rgba(255, 255, 255, 0.62)',
        '--mci-text-tertiary': 'rgba(255, 255, 255, 0.42)',
        '--mci-border-color': 'rgba(255, 255, 255, 0.10)',
        '--mci-border-color-hover': 'rgba(255, 255, 255, 0.18)'
      }
    : {
        '--mci-bg-base': '#F5F5FA',
        '--mci-bg-elevated': '#FFFFFF',
        '--mci-bg-card': 'rgba(255, 255, 255, 0.92)',
        '--mci-bg-card-hover': 'rgba(255, 255, 255, 0.98)',
        '--mci-text-primary': '#1A1A2E',
        '--mci-text-secondary': 'rgba(26, 26, 46, 0.65)',
        '--mci-text-tertiary': 'rgba(26, 26, 46, 0.45)',
        '--mci-border-color': 'rgba(15, 18, 30, 0.08)',
        '--mci-border-color-hover': 'rgba(15, 18, 30, 0.16)'
      }
}

/**
 * 应用主题模式（H5 + 运行时）
 */
export function applyThemeMode(mode) {
  const next = mode === 'dark' ? 'dark' : 'light'
  // #ifdef H5
  try {
    const root = document.documentElement
    root.setAttribute('data-theme', next)
    if (document.body) document.body.setAttribute('data-theme', next)
  } catch (e) {}
  // #endif
}

/**
 * 同步 tabBar 配色（小程序 / App）
 */
export function applyTabBarTheme(mode, color) {
  if (!isCurrentTabBarPage()) return
  const isDark = mode === 'dark'
  const selected = color || getTheme()
  try {
    const task = uni.setTabBarStyle({
      color: isDark ? 'rgba(255,255,255,0.58)' : '#888A9A',
      selectedColor: selected,
      backgroundColor: isDark ? '#121218' : '#FFFFFF',
      borderStyle: isDark ? 'white' : 'black',
      fail: () => {}
    })
    if (task && typeof task.catch === 'function') task.catch(() => {})
  } catch (e) {}
}

/**
 * 一次性应用主题系统（模式 + 颜色 + tabBar）
 */
export function applyMciTheme(mode, color) {
  const nextMode = mode === 'dark' ? 'dark' : 'light'
  const nextColor = color || getTheme()
  applyThemeMode(nextMode)
  applyMciTokensH5(nextColor)
  applyTabBarTheme(nextMode, nextColor)
}

/**
 * 应用初始化（App 启动时调用）
 */
export function initializeThemeSystem() {
  applyMciTheme(getThemeMode(), getTheme())
}

/**
 * H5 环境下，把 MCI 变量写到 documentElement，便于全局样式生效
 */
export function applyMciTokensH5(color) {
  // #ifdef H5
  try {
    const tokens = getMciTokenStyle(color)
    const root = document.documentElement
    Object.keys(tokens).forEach(k => root.style.setProperty(k, tokens[k]))
  } catch (e) {}
  // #endif
}

/**
 * Vue Options API Mixin — 注入主题相关 computed
 * 页面 mixins: [themeMixin] 即可使用
 */
export const themeMixin = {
  data() {
    return {
      _themeColor: getTheme(),
      _themeMode: getThemeMode(),
      _currentLang: getLang()
    }
  },
  computed: {
    themeColor() { return this._themeColor },
    themeMode() { return this._themeMode },
    isDarkMode() { return this._themeMode === 'dark' },
    themeGradient() { return getThemeGradient(this._themeColor) },
    themeColorLight() { return getThemeLightBg(this._themeColor, 0.08) },
    themeColorLighter() { return getThemeLightBg(this._themeColor, 0.05) },
    /** MCI 设计系统 CSS 变量样式对象，绑定到页面根节点 <view :style="mciTokenStyle"> */
    mciTokenStyle() {
      return {
        ...getMciTokenStyle(this._themeColor),
        ...getMciModeTokenStyle(this._themeMode)
      }
    }
  },
  methods: {
    t(key, params) {
      // 触碰 _currentLang 使 Vue 追踪响应式依赖
      void this._currentLang
      return _t(key, params)
    },
    switchThemeMode(mode) {
      const next = mode === 'dark' ? 'dark' : 'light'
      this._themeMode = next
      setThemeMode(next)
    },
    toggleThemeMode() {
      const next = this._themeMode === 'dark' ? 'light' : 'dark'
      this.switchThemeMode(next)
    }
  },
  onShow() {
    // 每次页面显示时刷新主题色和语言
    this._themeColor = getTheme()
    this._themeMode = getThemeMode()
    this._currentLang = getLang()
    // 同步主题系统（模式 + 颜色 + tabBar）
    applyMciTheme(this._themeMode, this._themeColor)
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
