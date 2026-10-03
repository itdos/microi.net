export function isEnabledFlag(value) {
  if (value === true || value === 1) return true
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === '1' || normalized === 'true'
}

// 移动端入口使用负向开关：旧租户没有新增字段时保持原有入口可见。
export function isMessageTabBarVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableMessageTabBar)
}

export function isInviteEntryVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableInviteEntry)
}
