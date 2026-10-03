function enabledFlag(value) {
  if (value === true || value === 1) return true
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === '1' || normalized === 'true'
}

/**
 * 与 Microi.Client 保持一致：AI 入口采用 DisableAiAssistant 负向开关。
 * 只有已经拿到有效 SysConfig 后才调用；网络失败仍由调用层失败即关闭。
 */
export function resolveAiAssistantEntryEnabled(sysConfig) {
  if (!sysConfig || typeof sysConfig !== 'object') return false
  return !enabledFlag(sysConfig.DisableAiAssistant)
}

export default { resolveAiAssistantEntryEnabled }
