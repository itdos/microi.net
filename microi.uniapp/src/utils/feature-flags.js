export function isEnabledFlag(value) {
  if (value === true || value === 1) return true
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === '1' || normalized === 'true'
}

// AI 助手使用负向开关：字段缺失或未明确开启关闭开关时，始终默认显示。
export function isAiAssistantVisible(sysConfig) {
  return !isEnabledFlag(sysConfig && sysConfig.DisableAiAssistant)
}
