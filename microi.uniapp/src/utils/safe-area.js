import { getMenuButtonRect, getPlatform } from './platform.js'

const EMPTY_METRICS = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  statusBarHeight: 0,
  navHeight: 44,
  headerHeight: 44,
  navLeftWidth: 52,
  navSideWidth: 52,
  capsuleRight: 0,
  capsuleTop: 0,
  capsuleHeight: 0,
  windowWidth: 0,
  windowHeight: 0
}

let lastValidCapsule = null

function normalizeCapsule(rect, windowWidth, statusBarHeight) {
  if (!rect || !windowWidth) return { capsuleRight: 0, capsuleTop: 0, capsuleHeight: 0 }
  const width = positiveNumber(rect.width) || Math.max(0, Number(rect.right) - Number(rect.left))
  const height = positiveNumber(rect.height)
  const top = positiveNumber(rect.top)
  const edgeGap = windowWidth - Number(rect.right)
  // left 在启动/恢复时可能与当前窗口坐标不同步，横向占位以实际宽度和右边缘为准。
  const valid = width > 0 && width <= Math.min(144, windowWidth / 2) && height > 0 && height <= 64 &&
    Number.isFinite(edgeGap) && edgeGap >= 0 && edgeGap <= 32 && top >= statusBarHeight && top - statusBarHeight <= 32
  if (valid) {
    lastValidCapsule = { windowWidth, statusBarHeight, capsuleRight: width + edgeGap + 8, capsuleTop: top, capsuleHeight: height }
    return lastValidCapsule
  }
  // 只复用当前窗口测量；异常值不能变成大块 padding，也不能污染方向切换后的布局。
  if (lastValidCapsule?.windowWidth === windowWidth && lastValidCapsule.statusBarHeight === statusBarHeight) return lastValidCapsule
  return { capsuleRight: 104, capsuleTop: statusBarHeight + 4, capsuleHeight: 32 }
}

function readWindowInfo() {
  try {
    if (uni.getWindowInfo) return uni.getWindowInfo() || {}
  } catch (e) {}

  try {
    if (uni.getSystemInfoSync) return uni.getSystemInfoSync() || {}
  } catch (e) {}

  return {}
}

function getVisualTestMetrics() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__XJY_VISUAL_SAFE_AREA__) {
      return globalThis.__XJY_VISUAL_SAFE_AREA__
    }
  } catch (e) {}

  // H5 自动化截图通过查询参数注入刘海、胶囊与 Home Indicator 尺寸。
  try {
    if (typeof location !== 'undefined') {
      const params = new URLSearchParams(location.search)
      if (params.get('visualSafe') === '1') {
        return {
          top: Number(params.get('safeTop') || 0),
          bottom: Number(params.get('safeBottom') || 0),
          left: Number(params.get('safeLeft') || 0),
          right: Number(params.get('safeRight') || 0),
          statusBarHeight: Number(params.get('statusBarHeight') || params.get('safeTop') || 0),
          navHeight: Number(params.get('navHeight') || 44),
          capsuleRight: Number(params.get('capsuleRight') || 0),
          capsuleTop: Number(params.get('capsuleTop') || 0),
          capsuleHeight: Number(params.get('capsuleHeight') || 0),
          windowWidth: Number(params.get('windowWidth') || 0),
          windowHeight: Number(params.get('windowHeight') || 0)
        }
      }
    }
  } catch (e) {}
  return null
}

function positiveNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function getSafeAreaMetrics() {
  const injected = getVisualTestMetrics()
  const info = injected || readWindowInfo()
  const insets = info.safeAreaInsets || {}
  const safeArea = info.safeArea || {}
  const windowWidth = positiveNumber(info.windowWidth || info.screenWidth)
  const windowHeight = positiveNumber(info.windowHeight || info.screenHeight)

  const statusBarHeight = positiveNumber(
    info.statusBarHeight ||
    info.top ||
    insets.top ||
    safeArea.top
  )
  const top = Math.max(statusBarHeight, positiveNumber(info.top || insets.top || safeArea.top))
  const bottom = positiveNumber(
    info.bottom ||
    insets.bottom ||
    (safeArea.bottom && windowHeight ? windowHeight - safeArea.bottom : 0)
  )
  const left = positiveNumber(
    info.left ||
    insets.left ||
    safeArea.left
  )
  const right = positiveNumber(
    info.right ||
    insets.right ||
    (safeArea.right && windowWidth ? windowWidth - safeArea.right : 0)
  )

  const menuRect = injected
    ? positiveNumber(info.capsuleRight) ? {
        top: positiveNumber(info.capsuleTop),
        height: positiveNumber(info.capsuleHeight),
        width: Math.max(0, positiveNumber(info.capsuleRight) - 16),
        right: windowWidth - 8,
        left: windowWidth - positiveNumber(info.capsuleRight) + 8
      } : null
    : getMenuButtonRect() || (getPlatform() === 'mp-weixin' ? {} : null)
  const { capsuleTop, capsuleHeight, capsuleRight } = normalizeCapsule(menuRect, windowWidth, statusBarHeight)
  const capsuleGap = capsuleTop > statusBarHeight ? capsuleTop - statusBarHeight : 0
  const navHeight = Math.max(
    44,
    positiveNumber(info.navHeight),
    capsuleHeight ? capsuleHeight + Math.max(8, capsuleGap * 2) : 0
  )
  // Centered custom titles need room for both the capsule and a native action.
  // Reserving only the capsule's right-side footprint still lets the last
  // action sit underneath it on narrow devices.
  const navSideWidth = Math.max(52, capsuleRight ? capsuleRight + 44 : 0)

  return {
    ...EMPTY_METRICS,
    top,
    bottom,
    left,
    right,
    statusBarHeight,
    navHeight,
    headerHeight: statusBarHeight + navHeight,
    navLeftWidth: 52,
    navSideWidth,
    capsuleRight,
    capsuleTop,
    capsuleHeight,
    windowWidth,
    windowHeight
  }
}

function insetValue(name, value) {
  return value > 0 ? `${value}px` : `env(safe-area-inset-${name}, 0px)`
}

export function getSafeAreaTokenStyle(metrics) {
  const safe = metrics || getSafeAreaMetrics()
  return {
    '--mci-safe-top': insetValue('top', safe.top),
    '--mci-safe-bottom': insetValue('bottom', safe.bottom),
    '--mci-safe-left': insetValue('left', safe.left),
    '--mci-safe-right': insetValue('right', safe.right),
    '--mci-status-bar-height': `${safe.statusBarHeight || 0}px`,
    '--mci-nav-height': `${safe.navHeight || 44}px`,
    '--mci-header-height': `${safe.headerHeight || ((safe.statusBarHeight || 0) + (safe.navHeight || 44))}px`,
    '--mci-nav-left-width': `${safe.navLeftWidth || 52}px`,
    '--mci-nav-side-width': `${safe.navSideWidth || 52}px`,
    '--mci-capsule-right': `${safe.capsuleRight || 0}px`,
    '--mci-capsule-top': `${safe.capsuleTop || 0}px`,
    '--mci-capsule-height': `${safe.capsuleHeight || 0}px`
  }
}

export default {
  getSafeAreaMetrics,
  getSafeAreaTokenStyle
}
