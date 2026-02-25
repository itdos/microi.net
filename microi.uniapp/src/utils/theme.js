/**
 * 主题色 + 多语言 统一 Mixin
 * 用法：
 *   import { themeMixin } from '@/utils/theme.js'
 *   export default { mixins: [themeMixin], ... }
 *   模板中：{{ t('common.confirm') }}  {{ themeColor }}  {{ themeGradient }}
 */

import { t as _t, getLang } from './i18n.js'

const STORAGE_KEY = 'microi_theme_color'
const DEFAULT_COLOR = '#4e6ef2'

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
  }
}

export default { getTheme, setTheme, getThemeGradient, getThemeLightBg, themeMixin }
