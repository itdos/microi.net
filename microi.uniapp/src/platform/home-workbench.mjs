const DEFAULT_ICON = '/static/microi-blue-256.png'

const DEFAULT_HOME_ACTIONS = Object.freeze([
  {
    key: 'platform-scan',
    title: '扫一扫',
    subtitle: '识别业务二维码',
    icon: DEFAULT_ICON,
    accent: '#b66a12',
    nativeAction: 'scan',
    feature: 'scan'
  },
  {
    key: 'platform-workspace',
    title: '功能目录',
    subtitle: '全部授权应用',
    icon: '/static/tab-mall.png',
    accent: '#087da8',
    nativeAction: 'workspace'
  },
  {
    key: 'platform-dashboard',
    title: '数据看板',
    subtitle: '查看业务状态',
    icon: '/static/tab-workspace.png',
    accent: '#316ceb',
    nativeAction: 'dashboard'
  },
  {
    key: 'platform-messages',
    title: '消息中心',
    subtitle: '业务提醒与沟通',
    icon: '/static/tab-message.png',
    accent: '#167a58',
    nativeAction: 'messages',
    feature: 'messages'
  }
])

function text(value) {
  return String(value || '').trim()
}

function identity(item) {
  if (!item) return ''
  return text(item.menuId || item.key).toLowerCase()
}

export function buildDefaultHomeActions(features = {}) {
  return DEFAULT_HOME_ACTIONS
    .filter((item) => !item.feature || features[item.feature] === true)
    .slice(0, 4)
    .map((item) => ({ ...item }))
}

export function toRecentModuleRecord(module) {
  if (!module || !identity(module)) return null
  return {
    key: text(module.key),
    menuId: text(module.menuId),
    visitedAt: Date.now()
  }
}

export function rememberRecentModuleList(records, module, limit = 8) {
  const next = toRecentModuleRecord(module)
  if (!next) return Array.isArray(records) ? records.slice(0, limit) : []
  const nextId = identity(next)
  const rows = (Array.isArray(records) ? records : [])
    .filter((item) => identity(item) && identity(item) !== nextId)
  return [next, ...rows].slice(0, Math.max(1, Number(limit || 8)))
}

export function resolveRecentModules(records, authorizedModules, limit = 4) {
  const available = new Map()
  ;(Array.isArray(authorizedModules) ? authorizedModules : []).forEach((module) => {
    const ids = [module && module.menuId, module && module.key]
      .map((value) => text(value).toLowerCase())
      .filter(Boolean)
    ids.forEach((id) => {
      if (!available.has(id)) available.set(id, module)
    })
  })

  const seen = new Set()
  const result = []
  for (const record of Array.isArray(records) ? records : []) {
    const module = available.get(identity(record)) || available.get(text(record && record.key).toLowerCase())
    const moduleId = identity(module)
    if (!module || !moduleId || seen.has(moduleId)) continue
    seen.add(moduleId)
    result.push(module)
    if (result.length >= Math.max(1, Number(limit || 4))) break
  }
  return result
}

export default {
  buildDefaultHomeActions,
  toRecentModuleRecord,
  rememberRecentModuleList,
  resolveRecentModules
}
