import appConfig from '@/config.js'
import { V8, getToken, getUser } from '@/utils/request.js'
import { post } from '@/utils/request.js'
import { getBusinessEntry, getBusinessModule, getRoleProfile } from '@/platform/business.js'
import { cachedRequest } from '@/platform/cache.js'
import { formatRegionValue, formatStructuredValue } from '@/platform/display.js'
import tenantRuntime from '@/generated/tenant-runtime.js'

const TABLE_CACHE_KEY = 'microi_diy_table_ids_v2'
const MENU_CACHE_KEY = 'microi_mobile_menu_tree_v2'
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

export function statisticsFieldValue(dataAppend, fieldName, fallback = 0) {
  if (!fieldName) return fallback
  let source = dataAppend && dataAppend.StatisticsFields !== undefined
    ? dataAppend.StatisticsFields
    : dataAppend
  for (let index = 0; index < 2 && typeof source === 'string'; index += 1) {
    try {
      source = JSON.parse(source)
    } catch (error) {
      return fallback
    }
  }
  if (Array.isArray(source)) {
    const row = source.find((item) => {
      const name = item && (item.Name || item.name || item.Field || item.field || item.Key || item.key)
      return String(name || '').toLowerCase() === String(fieldName).toLowerCase()
    })
    if (!row) return fallback
    const value = row.Value ?? row.value ?? row.Sum ?? row.sum ?? row.Total ?? row.total
    return value === undefined || value === null || value === '' ? fallback : value
  }
  if (!source || typeof source !== 'object') return fallback
  const key = Object.keys(source).find((name) =>
    String(name).toLowerCase() === String(fieldName).toLowerCase()
  )
  const value = key ? source[key] : undefined
  return value === undefined || value === null || value === '' ? fallback : value
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
  const moduleEngineKey = String(
    moduleConfig.moduleEngineKey ||
    moduleConfig.ModuleEngineKey ||
    moduleConfig.table ||
    ''
  ).trim()
  if (!moduleEngineKey) throw new Error('业务模块未配置菜单标识')
  const payload = {
    ModuleEngineKey: moduleEngineKey,
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _Keyword: options.keyword || '',
    _OrderBy: options.orderBy || moduleConfig.defaultOrderBy || 'CreateTime',
    _OrderByType: options.orderType || moduleConfig.defaultOrderType || 'DESC',
    _Where: [...(moduleConfig.fixedWhere || []), ...(options.extraWhere || [])]
  }
  if (moduleConfig.menuId) payload._SysMenuId = moduleConfig.menuId
  if (options.tableChildAuth) payload._TableChildAuth = options.tableChildAuth
  if (options.status && moduleConfig.statusField) {
    payload._Where.push({ Name: moduleConfig.statusField, Type: '=', Value: options.status })
  }
  const range = buildPeriodRange(options.period, options.customRange)
  if (range) payload._SearchDateTime = { [moduleConfig.periodField || 'CreateTime']: range }
  const requestKey = [
    'module', currentIdentityKey(), moduleEngineKey, moduleConfig.menuId || '', moduleConfig.table,
    pageIndex, pageSize, options.keyword || '', options.status || '',
    options.period || 'all', options.orderBy || '', options.orderType || '',
    JSON.stringify(options.customRange || []), JSON.stringify(payload._Where),
    JSON.stringify(options.tableChildAuth || {})
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
  let cursor = 0
  const worker = async () => {
    while (cursor < periods.length) {
      const item = periods[cursor++]
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
  }
  await Promise.all(Array.from({ length: Math.min(3, periods.length) }, worker))
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
  if (!tenantRuntime || typeof tenantRuntime.loadHomeSummary !== 'function') {
    return { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }
  }
  return tenantRuntime.loadHomeSummary({
    user,
    getRoleProfile,
    getBusinessModule,
    loadModuleRows,
    callApiEngine
  }, options)
}

export async function resolveDiyTableId(tableName, refresh = false) {
  if (!tableName) return ''
  if (!tableIdCache) tableIdCache = readStorage(TABLE_CACHE_KEY, {})
  const cacheKey = String(tableName).toLowerCase()
  if (!refresh && tableIdCache[cacheKey]) return tableIdCache[cacheKey]

  const menus = flattenMenus(await loadMenuTree(refresh))
  const normalizedName = String(tableName).toLowerCase()
  const direct = menus.find((menu) =>
    String(menu.DiyTableName || menu.TableName || menu.DiyTable?.Name || menu._DiyTable?.Name || '').toLowerCase() === normalizedName
  )
  let id = direct ? String(direct.DiyTableId || '') : ''
  if (!id) {
    let cursor = 0
    const candidates = menus.filter((menu) => menu && menu.DiyTableId && menu.Id)
    let matched = ''
    const worker = async () => {
      while (!matched && cursor < candidates.length) {
        const menu = candidates[cursor++]
        try {
          const result = await V8.FormEngine.GetDiyTableModel({
            Name: menu.DiyTableId,
            _SysMenuId: menu.Id
          })
          const model = result && Number(result.Code) === 1 ? result.Data : null
          if (model && String(model.Name || '').toLowerCase() === normalizedName) {
            matched = String(model.Id || menu.DiyTableId || '')
          }
        } catch (error) {}
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, Math.max(1, candidates.length)) }, worker))
    id = matched
  }
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

export async function findMenu(aliases = [], tableName = '', refresh = false, menuId = '') {
  const menus = flattenMenus(await loadMenuTree(refresh))
  const names = aliases.map((item) => String(item).trim()).filter(Boolean)
  let result = menuId
    ? menus.find((menu) => String(menu.Id || '') === String(menuId))
    : null
  if (!result) result = menus.find((menu) => names.includes(String(menu.Name || '').trim()))
  if (!result && tableName) {
    const normalizedTableName = String(tableName).toLowerCase()
    result = menus.find((menu) =>
      String(menu.DiyTableName || menu.TableName || menu.DiyTable?.Name || menu._DiyTable?.Name || '').toLowerCase() === normalizedTableName
    )
  }
  if (!result && tableName) {
    const tableId = await resolveDiyTableId(tableName)
    result = menus.find((menu) => tableId && String(menu.DiyTableId || '') === tableId)
  }
  if (!result) {
    result = menus.find((menu) => names.some((name) => String(menu.Name || '').includes(name)))
  }
  return result || null
}

export async function openForm({ table, rowId = '', mode = 'View', title = '', menuId = '', moduleEngineKey = '', menuAliases = [], defaultValues = null, fieldNames = null, excludeFieldNames = null, readonlyFieldNames = null, includeRelated = true, stayAfterAdd = false, recordAdapter = 'form-engine', tableChildAuth = null }) {
  if (!requireLogin()) return
  if (!table) {
    uni.showToast({ title: '未配置业务表单', icon: 'none' })
    return
  }
  const normalizedRecordAdapter = String(recordAdapter || 'form-engine').trim().toLowerCase()
  let menu = menuId ? { Id: menuId } : null
  if (!menu && normalizedRecordAdapter === 'form-engine') {
    try {
      menu = await findMenu(menuAliases, table)
    } catch (error) {}
  }
  const params = [
    `table=${encodeURIComponent(table)}`,
    `id=${encodeURIComponent(rowId || '')}`,
    `mode=${encodeURIComponent(mode || (rowId ? 'View' : 'Add'))}`,
    `title=${encodeURIComponent(title || (mode === 'Add' ? '新增' : '详情'))}`,
    `recordAdapter=${encodeURIComponent(normalizedRecordAdapter)}`,
    `related=${includeRelated === false ? '0' : '1'}`,
    `stayAfterAdd=${stayAfterAdd === true ? '1' : '0'}`
  ]
  if (menu && menu.Id) params.push(`menuId=${encodeURIComponent(menu.Id)}`)
  if (moduleEngineKey) params.push(`moduleEngineKey=${encodeURIComponent(moduleEngineKey)}`)
  if (tableChildAuth) params.push(`tableChildAuth=${encodeURIComponent(JSON.stringify(tableChildAuth))}`)
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
  if (!tenantRuntime || typeof tenantRuntime.openBusiness !== 'function') {
    uni.showToast({ title: '当前应用未配置此业务入口', icon: 'none' })
    return null
  }
  return tenantRuntime.openBusiness({
    getBusinessEntry,
    getBusinessModule,
    openForm
  }, key)
}

export function parseDeviceId(scanResult) {
  const text = decodeURIComponent(String(scanResult || ''))
  const match = text.match(/[?&#](?:shebeiId|ShebeiId|id)=([^&#]+)/i)
  if (match) return decodeURIComponent(match[1])
  if (/^[0-9a-f-]{20,}$/i.test(text.trim())) return text.trim()
  return ''
}

export function scanDevice() {
  if (!tenantRuntime || typeof tenantRuntime.scanDevice !== 'function') {
    uni.showToast({ title: '当前应用未配置设备扫码场景', icon: 'none' })
    return
  }
  tenantRuntime.scanDevice({ appConfig, parseDeviceId, requireLogin })
}

export default {
  requireLogin,
  formatDateTime,
  formatMoney,
  formatRegion,
  formatFieldValue,
  statisticsFieldValue,
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
