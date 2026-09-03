export function isEnabledFlag(value) {
  if (value === true || value === 1) return true
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === '1' || normalized === 'true'
}

// AI 助手使用负向开关：字段缺失或未明确开启关闭开关时，始终默认显示。
export function isAiAssistantVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableAiAssistant)
}

// 移动端入口同样使用负向开关：旧租户尚未升级字段时保持现有入口可见。
export function isMessageTabBarVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableMessageTabBar)
}

export function isInviteEntryVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableInviteEntry)
}
