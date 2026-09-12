const BUSINESS_MODULE_KEYS = Object.freeze([
  'customers',
  'orders',
  'visits',
  'opportunities',
  'devices'
])

const PERSONAL_FILTER_BY_MODULE = Object.freeze({
  customers: { field: 'FuzeRID', userField: 'Id', operation: '=' },
  // BaifangR 是多选长文本，历史数据同时存在纯姓名和 JSON/多选序列，必须按成员包含查询。
  visits: { field: 'BaifangR', userField: 'Name', operation: 'Like' },
  opportunities: { field: 'FuzeRID', userField: 'Id', operation: '=' }
})

function currentUserId(user = {}) {
  return String(user.Id || '').trim()
}

function currentUserName(user = {}) {
  return String(user.Name || user.Account || '').trim()
}

function appendQuery(params, key, value) {
  if (value === undefined || value === null || value === '') return
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
}

function appendPeriodQuery(params, filters = {}) {
  appendQuery(params, 'from', 'performance-stats')
  appendQuery(params, 'period', filters.period || 'month')
  if (filters.period === 'custom') {
    appendQuery(params, 'customStart', filters.customStart)
    appendQuery(params, 'customEnd', filters.customEnd)
  }
}

export function requirePerformanceUserId(user = {}) {
  const userId = currentUserId(user)
  if (!userId) throw new Error('当前账号信息不完整，请重新登录')
  return userId
}

function requirePerformanceUserName(user = {}) {
  const userName = currentUserName(user)
  if (!userName) throw new Error('当前账号姓名信息不完整，请重新登录')
  return userName
}

function getPersonalFilter(moduleKey, user = {}) {
  const filter = PERSONAL_FILTER_BY_MODULE[moduleKey]
  if (!filter) return null
  return {
    Name: filter.field,
    Type: filter.operation,
    Value: filter.userField === 'Name'
      ? requirePerformanceUserName(user)
      : requirePerformanceUserId(user)
  }
}

// 客户、商机按负责人，跟进记录按跟进人；其它指标沿用账号有权查看的数据范围。
export function buildPerformanceModuleOptions(moduleKey, user, common = {}) {
  if (!BUSINESS_MODULE_KEYS.includes(moduleKey)) {
    throw new Error(`未配置业绩统计模块：${moduleKey}`)
  }
  const personalFilter = getPersonalFilter(moduleKey, user)
  if (!personalFilter) return { ...common }
  return {
    ...common,
    extraWhere: [
      ...(Array.isArray(common.extraWhere) ? common.extraWhere : []),
      personalFilter
    ]
  }
}

export function buildPerformanceTaskOptions(_user, common = {}) {
  return { ...common, dateField: 'YujiSHSJ', mineOnly: false }
}

export function buildPerformanceMetricRoute(moduleKey, user, filters = {}, state = '') {
  const params = []
  if (moduleKey === 'tasks') {
    appendQuery(params, 'scope', 'all')
    appendQuery(params, 'dateField', 'YujiSHSJ')
    appendQuery(params, 'state', state)
    appendPeriodQuery(params, filters)
    return `/pages/task/list?${params.join('&')}`
  }

  if (!BUSINESS_MODULE_KEYS.includes(moduleKey)) {
    throw new Error(`未配置业绩统计跳转：${moduleKey}`)
  }
  appendQuery(params, 'key', moduleKey)
  const personalFilter = getPersonalFilter(moduleKey, user)
  if (personalFilter) {
    appendQuery(params, 'whereField', personalFilter.Name)
    appendQuery(params, 'whereType', personalFilter.Type)
    appendQuery(params, 'whereValue', personalFilter.Value)
  }
  appendPeriodQuery(params, filters)
  return `/pages/business/list?${params.join('&')}`
}

export { PERSONAL_FILTER_BY_MODULE }
