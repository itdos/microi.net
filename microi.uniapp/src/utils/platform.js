/**
 * 跨平台适配工具模块
 * ========================================
 * 统一处理微信、支付宝、飞书、抖音、小红书、App 等多平台差异
 * ========================================
 */

/**
 * 平台枚举
 */
export const PLATFORMS = {
  WEIXIN: 'mp-weixin',
  ALIPAY: 'mp-alipay',
  LARK: 'mp-lark',
  TOUTIAO: 'mp-toutiao',
  XHS: 'mp-xhs',
  APP: 'app-plus',
  H5: 'h5',
  UNKNOWN: 'unknown',
}

/**
 * 获取当前运行平台标识（编译期 + 运行期二次确认）
 * @returns {string} 平台标识，如 'mp-weixin', 'mp-alipay', 'mp-lark', 'mp-toutiao', 'mp-xhs', 'app-plus', 'h5'
 */
export function getPlatform() {
  // #ifdef MP-WEIXIN
  return PLATFORMS.WEIXIN
  // #endif
  // #ifdef MP-ALIPAY
  return PLATFORMS.ALIPAY
  // #endif
  // #ifdef MP-LARK
  return PLATFORMS.LARK
  // #endif
  // #ifdef MP-TOUTIAO
  return PLATFORMS.TOUTIAO
  // #endif
  // #ifdef MP-XHS
  return PLATFORMS.XHS
  // #endif
  // #ifdef APP-PLUS
  return PLATFORMS.APP
  // #endif
  // #ifdef H5
  return PLATFORMS.H5
  // #endif
  return PLATFORMS.UNKNOWN
}

/**
 * 判断当前是否为小程序平台（任何小程序）
 */
export function isMiniProgram() {
  const p = getPlatform()
  return p.startsWith('mp-')
}

/**
 * 获取平台对应的 uni.login provider
 * - 微信: 'weixin'
 * - 支付宝: 'alipay'
 * - 抖音: 'toutiao'
 * - 飞书: 'lark'
 * - QQ: 'qq'
 * - App: 运行时按需指定
 * @returns {string|null} provider 名称，不支持授权登录的平台返回 null
 */
export function getLoginProvider() {
  // #ifdef MP-WEIXIN
  return 'weixin'
  // #endif
  // #ifdef MP-ALIPAY
  return 'alipay'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'toutiao'
  // #endif
  // #ifdef MP-LARK
  return 'lark'
  // #endif
  // #ifdef MP-XHS
  return null // 小红书暂无小程序授权登录 provider
  // #endif
  // #ifdef APP-PLUS
  return null // App 端使用账号密码或 OAuth
  // #endif
  // #ifdef H5
  return null
  // #endif
  return null
}

/**
 * 获取平台对应的后端授权登录 API 路径
 * @param {object} config - appConfig 配置对象
 * @returns {string} API 路径
 */
export function getAuthLoginApi(config) {
  // #ifdef MP-WEIXIN
  return config.platformLoginApis?.weixin || '/apiengine/wx-miniprogram-login-reg-bind'
  // #endif
  // #ifdef MP-ALIPAY
  return config.platformLoginApis?.alipay || '/apiengine/alipay-miniprogram-login-reg-bind'
  // #endif
  // #ifdef MP-TOUTIAO
  return config.platformLoginApis?.toutiao || '/apiengine/tt-miniprogram-login-reg-bind'
  // #endif
  // #ifdef MP-LARK
  return config.platformLoginApis?.lark || '/apiengine/lark-miniprogram-login-reg-bind'
  // #endif
  // #ifdef MP-XHS
  return config.platformLoginApis?.xhs || '/apiengine/xhs-miniprogram-login-reg-bind'
  // #endif
  return config.wxLoginApi || '/apiengine/wx-miniprogram-login-reg-bind'
}

/**
 * 获取 source 参数值（用于 webview URL 区分来源平台）
 * @returns {string} 如 'wx-miniprogram', 'alipay-miniprogram', 'app'
 */
export function getSourceTag() {
  // #ifdef MP-WEIXIN
  return 'wx-miniprogram'
  // #endif
  // #ifdef MP-ALIPAY
  return 'alipay-miniprogram'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'tt-miniprogram'
  // #endif
  // #ifdef MP-LARK
  return 'lark-miniprogram'
  // #endif
  // #ifdef MP-XHS
  return 'xhs-miniprogram'
  // #endif
  // #ifdef APP-PLUS
  return 'app'
  // #endif
  // #ifdef H5
  return 'h5'
  // #endif
  return 'miniprogram'
}

/**
 * 获取 _ClientType 参数值（用于后端区分客户端类型）
 * @returns {string} 如 'WxMiniProgram', 'AlipayMiniProgram', 'App'
 */
export function getClientType() {
  // #ifdef MP-WEIXIN
  return 'WxMiniProgram'
  // #endif
  // #ifdef MP-ALIPAY
  return 'AlipayMiniProgram'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'TtMiniProgram'
  // #endif
  // #ifdef MP-LARK
  return 'LarkMiniProgram'
  // #endif
  // #ifdef MP-XHS
  return 'XhsMiniProgram'
  // #endif
  // #ifdef APP-PLUS
  return 'App'
  // #endif
  // #ifdef H5
  return 'H5'
  // #endif
  return 'MiniProgram'
}

/**
 * 获取平台中文显示名称（用于 UI 文案动态替换）
 * @returns {string} 如 '微信', '支付宝', '飞书', '抖音'
 */
export function getPlatformName() {
  // #ifdef MP-WEIXIN
  return '微信'
  // #endif
  // #ifdef MP-ALIPAY
  return '支付宝'
  // #endif
  // #ifdef MP-TOUTIAO
  return '抖音'
  // #endif
  // #ifdef MP-LARK
  return '飞书'
  // #endif
  // #ifdef MP-XHS
  return '小红书'
  // #endif
  // #ifdef APP-PLUS
  return 'App'
  // #endif
  // #ifdef H5
  return 'H5'
  // #endif
  return '小程序'
}

/**
 * 获取平台英文显示名称
 * @returns {string}
 */
export function getPlatformNameEn() {
  // #ifdef MP-WEIXIN
  return 'WeChat'
  // #endif
  // #ifdef MP-ALIPAY
  return 'Alipay'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'Douyin'
  // #endif
  // #ifdef MP-LARK
  return 'Lark'
  // #endif
  // #ifdef MP-XHS
  return 'Xiaohongshu'
  // #endif
  // #ifdef APP-PLUS
  return 'App'
  // #endif
  // #ifdef H5
  return 'H5'
  // #endif
  return 'Mini Program'
}

/**
 * 是否支持小程序授权登录（非账号密码方式）
 * 小红书小程序、App、H5 暂不支持一键授权登录
 * @returns {boolean}
 */
export function supportsAuthLogin() {
  return getLoginProvider() !== null
}

/**
 * 获取胶囊按钮信息（跨平台兼容）
 * 微信、支付宝、抖音等小程序均有胶囊按钮，但 API 不同
 * @returns {{ left: number, top: number, width: number, height: number, right: number, bottom: number } | null}
 */
export function getMenuButtonRect() {
  try {
    // uni-app 从 3.x 起提供了跨平台的 uni.getMenuButtonBoundingClientRect
    // 但部分平台可能不支持，需 try-catch
    // #ifdef MP-WEIXIN
    return wx.getMenuButtonBoundingClientRect()
    // #endif
    // #ifdef MP-ALIPAY
    if (my && my.getMenuButtonBoundingClientRect) {
      return my.getMenuButtonBoundingClientRect()
    }
    return null
    // #endif
    // #ifdef MP-TOUTIAO
    if (tt && tt.getMenuButtonBoundingClientRect) {
      return tt.getMenuButtonBoundingClientRect()
    }
    return null
    // #endif
    // #ifdef MP-LARK
    if (tt && tt.getMenuButtonBoundingClientRect) {
      // 飞书小程序底层同抖音
      return tt.getMenuButtonBoundingClientRect()
    }
    return null
    // #endif
    // 其他平台无胶囊
    return null
  } catch (e) {
    return null
  }
}

export default {
  PLATFORMS,
  getPlatform,
  isMiniProgram,
  getLoginProvider,
  getAuthLoginApi,
  getSourceTag,
  getClientType,
  getPlatformName,
  getPlatformNameEn,
  supportsAuthLogin,
  getMenuButtonRect,
}
