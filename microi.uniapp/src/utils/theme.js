/**
 * 主题色 + 多语言 统一 Mixin
 * 用法：
 *   import { themeMixin } from '@/utils/theme.js'
 *   export default { mixins: [themeMixin], ... }
 *   模板中：{{ t('common.confirm') }}  {{ themeColor }}  {{ themeGradient }}
 */

import { t as _t, getLang } from './i18n.js'

const STORAGE_KEY = 'microi_theme_color'
// MCI 设计系统主色（与 Microi.Client / microi.app 移动端 mci-color-primary 保持一致）
const DEFAULT_COLOR = '#6C2BD9'

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
      _currentLang: getLang()
    }
  },
  computed: {
    themeColor() { return this._themeColor },
    themeGradient() { return getThemeGradient(this._themeColor) },
    themeColorLight() { return getThemeLightBg(this._themeColor, 0.08) },
    themeColorLighter() { return getThemeLightBg(this._themeColor, 0.05) },
    /** MCI 设计系统 CSS 变量样式对象，绑定到页面根节点 <view :style="mciTokenStyle"> */
    mciTokenStyle() { return getMciTokenStyle(this._themeColor) }
  },
  methods: {
    t(key, params) {
      // 触碰 _currentLang 使 Vue 追踪响应式依赖
      void this._currentLang
      return _t(key, params)
    }
  },
  onShow() {
    // 每次页面显示时刷新主题色和语言
    this._themeColor = getTheme()
    this._currentLang = getLang()
    // H5 端同步 MCI 变量到 documentElement
    applyMciTokensH5(this._themeColor)
  }
}

export default { getTheme, setTheme, getThemeGradient, getThemeLightBg, getMciTokenStyle, applyMciTokensH5, themeMixin }
