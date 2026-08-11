// zhy：版本比较保持为无运行时依赖的纯函数，便于构建脚本和小程序共同验证。
export function normalizeVersion(value) {
  const matched = String(value || '').trim().match(/\d+(?:\.\d+)*/)
  return matched ? matched[0] : ''
}

// zhy：按数字段比较版本，兼容 2.1、2.1.0 和带前后缀的版本文本。
export function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split('.').filter(Boolean).map(Number)
  const rightParts = normalizeVersion(right).split('.').filter(Boolean).map(Number)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (delta !== 0) return delta > 0 ? 1 : -1
  }
  return 0
}

// zhy：最低版本仅约束微信正式版，避免开发版和体验版因拿不到线上版本号被误拦截。
export function isVersionUnsupported({ currentVersion, minimumVersion, envVersion }) {
  if (String(envVersion || '').toLowerCase() !== 'release') return false
  if (!normalizeVersion(currentVersion) || !normalizeVersion(minimumVersion)) return false
  return compareVersions(currentVersion, minimumVersion) < 0
}
