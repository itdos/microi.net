import appConfig from '@/config.js'
import { V8, getToken, getUser } from '@/utils/request.js'
import { post } from '@/utils/request.js'
import { getBusinessEntry, getBusinessModule, getRoleProfile } from '@/platform/business.js'
import { cachedRequest, removeCachePrefix } from '@/platform/cache.js'
import { formatRegionValue, formatStructuredValue } from '@/platform/display.js'

const TABLE_CACHE_KEY = 'xjy_diy_table_ids_v1'
const MENU_CACHE_KEY = 'xjy_mobile_menu_tree_v1'
let tableIdCache = null
let menuTreeCache = null

function currentIdentityKey() {
  const user = getUser() || {}
  return String(user.Id || user.Account || 'guest')
}

export const PERIOD_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '本日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季' },
  { value: 'year', label: '本年' },
  { value: 'lastYear', label: '去年' },
  { value: 'custom', label: '自定义' }
]

function readStorage(key, fallback) {
  try {
    const value = uni.getStorageSync(key)
    if (!value) return fallback
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch (e) {
    return fallback
  }
}

function writeStorage(key, value) {
  try { uni.setStorageSync(key, JSON.stringify(value)) } catch (e) {}
}

export function requireLogin() {
  if (getToken()) return true
  uni.navigateTo({ url: '/pages/login/index' })
  return false
}

export function formatDateTime(value, dateOnly = false) {
  if (!value) return ''
  const text = String(value).replace('T', ' ')
  return dateOnly ? text.slice(0, 10) : text.slice(0, 16)
}

export function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value || '-'
  return `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatRegion(value) {
  return formatRegionValue(value)
}

export function formatFieldValue(value, format, options = {}) {
  const empty = options.empty === undefined ? '-' : options.empty
  if (value === null || value === undefined || value === '') return empty
  if (format === 'money') return formatMoney(value)
  if (format === 'datetime') return formatDateTime(value)
  if (format === 'date') return formatDateTime(value, true)
  if (format === 'region') return formatRegion(value)
  return formatStructuredValue(value, { ...options, empty })
}

export function buildPeriodRange(period, customRange = null) {
  if (!period || period === 'all') return null
  if (period === 'custom') return Array.isArray(customRange) && customRange.length === 2 ? customRange : null
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  const day = now.getDay() || 7
  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'week') {
    start.setDate(now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(now.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'quarter') {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    start.setMonth(quarterStart, 1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(quarterStart + 3, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'year') {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(11, 31)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'lastYear') {
    start.setFullYear(now.getFullYear() - 1, 0, 1)
    start.setHours(0, 0, 0, 0)
    end.setFullYear(now.getFullYear() - 1, 11, 31)
    end.setHours(23, 59, 59, 999)
  } else {
    return null
  }
  const format = (date) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
  return [format(start), format(end)]
}

export async function loadModuleRows(moduleConfig, options = {}) {
  const pageIndex = Number(options.pageIndex || 1)
  const pageSize = Number(options.pageSize || moduleConfig.pageSize || 15)
  const payload = {
    ModuleEngineKey: moduleConfig.table,
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _Keyword: options.keyword || '',
    _OrderBy: options.orderBy || moduleConfig.defaultOrderBy || 'CreateTime',
    _OrderByType: options.orderType || moduleConfig.defaultOrderType || 'DESC',
    _Where: [...(moduleConfig.fixedWhere || []), ...(options.extraWhere || [])]
  }
  if (options.status && moduleConfig.statusField) {
    payload._Where.push({ Name: moduleConfig.statusField, Type: '=', Value: options.status })
  }
  const range = buildPeriodRange(options.period, options.customRange)
  if (range) payload._SearchDateTime = { [moduleConfig.periodField || 'CreateTime']: range }
  const requestKey = [
    'module', currentIdentityKey(), moduleConfig.table, pageIndex, pageSize, options.keyword || '', options.status || '',
    options.period || 'all', options.orderBy || '', options.orderType || '',
    JSON.stringify(options.customRange || []), JSON.stringify(payload._Where)
  ].join(':')
  const cached = await cachedRequest(requestKey, () => post('/api/ModuleEngine/GetTableData', payload, true), {
    maxAge: Number(options.cacheAge ?? (pageIndex === 1 ? 45 * 1000 : 10 * 1000)),
    refresh: options.refresh === true,
    allowStale: true
  })
  const response = cached.data
  if (!response || response.Code !== 1) {
    throw new Error((response && response.Msg) || '业务数据加载失败')
  }
  return {
    rows: Array.isArray(response.Data) ? response.Data : [],
    count: Number(response.DataCount || 0),
    append: response.DataAppend || {},
    stale: cached.stale === true
  }
}

export async function loadModulePeriodCounts(moduleConfig, options = {}) {
  const periods = PERIOD_OPTIONS.filter((item) => item.value !== 'custom' || options.customRange)
  const counts = {}
  for (const item of periods) {
    try {
      const result = await loadModuleRows(moduleConfig, {
        ...options,
        pageIndex: 1,
        pageSize: 1,
        period: item.value,
        customRange: item.value === 'custom' ? options.customRange : null
      })
      counts[item.value] = Number(result.count || 0)
    } catch (error) {}
  }
  return counts
}

export async function callApiEngine(key, data = {}) {
  try {
    const direct = await V8.ApiEngine.Run(key, data, { checkCode: false })
    if (direct && direct.Code !== 0) return direct
  } catch (e) {}
  return V8.ApiEngine.RunLegacy(key, data, { checkCode: false })
}

export async function loadHomeSummary(options = {}) {
  const user = getUser() || {}
  const role = getRoleProfile(user)
  const summary = { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }

  if (!role.isInternal) {
    try {
      const result = await callApiEngine('my_some_count', {})
      const data = result && result.Data ? result.Data : result || {}
      summary.orders = Number(data.orderCount ?? 0)
      summary.devices = Number(data.ShebeiCount ?? 0)
      summary.services = Number(data.FuwuCount ?? 0)
    } catch (e) {}
    return summary
  }

  const pendingStates = ['待接单', '待服务', '待商家验收', '待客户验收', '待评价', '暂停']
  const taskWhere = [{ Name: 'Zhuangtai', Type: 'In', Value: pendingStates }]
  if (role.isService && !role.isAdmin && user.Id) {
    taskWhere.push({ Name: 'ShouhouRYID', Type: '=', Value: user.Id })
  }
  const common = { pageIndex: 1, pageSize: 1, refresh: options.refresh === true }
  const requests = [
    loadModuleRows(getBusinessModule('orders'), common),
    loadModuleRows(getBusinessModule('devices'), common),
    loadModuleRows(getBusinessModule('serviceRecords'), common),
    loadModuleRows(getBusinessModule('tasks'), { ...common, extraWhere: taskWhere }),
    loadModuleRows(getBusinessModule('customers'), common)
  ]
  const results = await Promise.allSettled(requests)
  const keys = ['orders', 'devices', 'services', 'tasks', 'customers']
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') summary[keys[index]] = Number(result.value.count || 0)
  })
  return summary
}

export async function resolveDiyTableId(tableName, refresh = false) {
  if (!tableName) return ''
  if (!tableIdCache) tableIdCache = readStorage(TABLE_CACHE_KEY, {})
  const cacheKey = String(tableName).toLowerCase()
  if (!refresh && tableIdCache[cacheKey]) return tableIdCache[cacheKey]

  const result = await V8.FormEngine.GetFormData('diy_table', {
    _Where: [{ Name: 'Name', Type: '=', Value: tableName }],
    _SelectFields: ['Id', 'Name']
  })
  const id = result && result.Code === 1 && result.Data ? result.Data.Id : ''
  if (id) {
    tableIdCache[cacheKey] = id
    writeStorage(TABLE_CACHE_KEY, tableIdCache)
  }
  return id
}

function flattenMenus(items, output = []) {
  if (!Array.isArray(items)) return output
  items.forEach((item) => {
    if (!item) return
    output.push(item)
    flattenMenus(item._Child || item.children, output)
  })
  return output
}

export async function loadMenuTree(refresh = false) {
  const identityKey = currentIdentityKey()
  const storageKey = `${MENU_CACHE_KEY}:${identityKey}`
  if (!refresh && menuTreeCache && menuTreeCache.identityKey === identityKey) return menuTreeCache.data
  if (!refresh) {
    const cached = readStorage(storageKey, null)
    if (cached && Array.isArray(cached.data) && Date.now() - Number(cached.time || 0) < 10 * 60 * 1000) {
      menuTreeCache = { identityKey, data: cached.data }
      return menuTreeCache.data
    }
  }
  const result = await post('/api/SysMenu/GetSysMenuStep', {
    OsClient: appConfig.osClient,
    TableName: 'Sys_Menu',
    _OrderBy: 'Sort',
    _OrderByType: 'ASC'
  }, true)
  const data = result && result.Code === 1 && Array.isArray(result.Data) ? result.Data : []
  menuTreeCache = { identityKey, data }
  writeStorage(storageKey, { time: Date.now(), data })
  return data
}

export async function findMenu(aliases = [], tableName = '') {
  const menus = flattenMenus(await loadMenuTree())
  const names = aliases.map((item) => String(item).trim()).filter(Boolean)
  let result = menus.find((menu) => names.includes(String(menu.Name || '').trim()))
  if (!result && tableName) {
    const tableId = await resolveDiyTableId(tableName)
    result = menus.find((menu) => tableId && String(menu.DiyTableId || '') === tableId)
  }
  if (!result) {
    result = menus.find((menu) => names.some((name) => String(menu.Name || '').includes(name)))
  }
  return result || null
}

export async function openForm({ table, rowId = '', mode = 'View', title = '', menuAliases = [], defaultValues = null, fieldNames = null, excludeFieldNames = null, readonlyFieldNames = null, includeRelated = true, stayAfterAdd = false }) {
  if (!requireLogin()) return
  if (!table) {
    uni.showToast({ title: '未配置业务表单', icon: 'none' })
    return
  }
  const params = [
    `table=${encodeURIComponent(table)}`,
    `id=${encodeURIComponent(rowId || '')}`,
    `mode=${encodeURIComponent(mode || (rowId ? 'View' : 'Add'))}`,
    `title=${encodeURIComponent(title || (mode === 'Add' ? '新增' : '详情'))}`,
    `related=${includeRelated === false ? '0' : '1'}`,
    `stayAfterAdd=${stayAfterAdd === true ? '1' : '0'}`
  ]
  if (defaultValues && Object.keys(defaultValues).length) params.push(`defaults=${encodeURIComponent(JSON.stringify(defaultValues))}`)
  if (fieldNames && fieldNames.length) params.push(`fields=${encodeURIComponent(JSON.stringify(fieldNames))}`)
  if (excludeFieldNames && excludeFieldNames.length) params.push(`excludeFields=${encodeURIComponent(JSON.stringify(excludeFieldNames))}`)
  if (readonlyFieldNames && readonlyFieldNames.length) params.push(`readonlyFields=${encodeURIComponent(JSON.stringify(readonlyFieldNames))}`)
  uni.navigateTo({ url: `/pages/native-form/index?${params.join('&')}` })
}

export async function openLowCodeMenu(moduleConfig) {
  if (!requireLogin()) return
  if (moduleConfig.table) {
    uni.navigateTo({ url: `/pages/business/list?key=${encodeURIComponent(moduleConfig.key || '')}` })
    return
  }
  uni.showToast({ title: `${moduleConfig.title || '该功能'}尚未配置数据表`, icon: 'none' })
}

export async function openBusiness(key) {
  const moduleConfig = getBusinessModule(key)
  const entry = getBusinessEntry(key)
  if (!moduleConfig) {
    uni.showToast({ title: '功能配置不存在', icon: 'none' })
    return
  }
  if (key === 'tasks' || moduleConfig.target === 'task-list') {
    uni.navigateTo({ url: '/pages/task/list' })
  } else if (moduleConfig.target === 'native-list') {
    uni.navigateTo({ url: `/pages/business/list?key=${encodeURIComponent(key)}` })
  } else if (moduleConfig.target === 'native-page') {
    uni.navigateTo({ url: moduleConfig.path })
  } else if (moduleConfig.target === 'form-add') {
    await openForm({
      table: moduleConfig.table,
      mode: 'Add',
      title: moduleConfig.title,
      menuAliases: moduleConfig.menuAliases
    })
  } else if (moduleConfig.table) {
    uni.navigateTo({ url: `/pages/business/list?key=${encodeURIComponent(key)}` })
  } else {
    uni.showToast({ title: '功能配置不完整', icon: 'none' })
  }
  return entry
}

export function parseDeviceId(scanResult) {
  const text = decodeURIComponent(String(scanResult || ''))
  const match = text.match(/[?&#](?:shebeiId|ShebeiId|id)=([^&#]+)/i)
  if (match) return decodeURIComponent(match[1])
  if (/^[0-9a-f-]{20,}$/i.test(text.trim())) return text.trim()
  return ''
}

export function scanDevice() {
  if (!requireLogin()) return
  uni.scanCode({
    onlyFromCamera: false,
    success: async (result) => {
      const deviceId = parseDeviceId(result.result)
      if (!deviceId) {
        uni.showModal({ title: '未识别设备', content: `二维码中没有有效的设备编号，请确认扫描的是${appConfig.appName || '平台'}设备码。`, showCancel: false })
        return
      }
      uni.navigateTo({ url: `/pages/task/scan?deviceId=${encodeURIComponent(deviceId)}` })
    },
    fail: (error) => {
      const message = error && error.errMsg && error.errMsg.includes('cancel') ? '' : '扫码失败，请重试'
      if (message) uni.showToast({ title: message, icon: 'none' })
    }
  })
}

export default {
  requireLogin,
  formatDateTime,
  formatMoney,
  formatRegion,
  formatFieldValue,
  buildPeriodRange,
  loadModuleRows,
  callApiEngine,
  loadHomeSummary,
  resolveDiyTableId,
  loadMenuTree,
  findMenu,
  openForm,
  openLowCodeMenu,
  openBusiness,
  parseDeviceId,
  scanDevice
}
