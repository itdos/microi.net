export const TASK_POST_SERVICE_ACTIONS = Object.freeze([
  'merchantPass',
  'merchantReject',
  'customerPass',
  'customerReject',
  'evaluate'
])

const ACTION_SET = new Set(TASK_POST_SERVICE_ACTIONS)

export function normalizeTaskFlowCapabilities(result) {
  if (!result || Number(result.Code) !== 1) return []
  const data = result.Data || {}
  const actions = Array.isArray(data.Actions) ? data.Actions : []
  return [...new Set(actions.map((item) => String(item || '').trim()).filter((item) => ACTION_SET.has(item)))]
}

export function hasTaskFlowCapability(capabilities, action) {
  return Array.isArray(capabilities) && capabilities.includes(action)
}
