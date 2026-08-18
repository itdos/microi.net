import { V8, getUser, post } from '@/utils/request.js'
import { PERIOD_OPTIONS, buildPeriodRange, callApiEngine, findMenu, formatFieldValue, formatRegion } from '@/platform/business-runtime.js'
import { cachedRequest, readPageState, removeCachePrefix, writePageState } from '@/platform/cache.js'

export const TASK_STATES = [
  { value: '', label: '全部', code: 0 },
  { value: '待接单', label: '待接单', code: 1 },
  { value: '待服务', label: '待服务', code: 2 },
  { value: '待商家验收', label: '待商家验收', code: 11 },
  { value: '待客户验收', label: '待客户验收', code: 12 },
  { value: '待评价', label: '待评价', code: 3 },
  { value: '暂停', label: '暂停', code: 10 },
  { value: '已结束', label: '已结束', code: 9 },
  { value: '已取消', label: '已取消', code: 5 }
]

export const TASK_PERIODS = PERIOD_OPTIONS

export const TASK_DATE_FIELDS = [
  { value: 'YujiSHSJ', label: '计划服务时间' },
  { value: 'YuyueSJ', label: '预约时间' },
  { value: 'JiedanSJ', label: '接单时间' },
  { value: 'ShangmenSJ', label: '上门时间' },
  { value: 'FinishTime', label: '完成时间' }
]

export const TASK_PHOTO_FIELDS = [
  { name: 'JieguoTP', label: '服务结果照片', max: 9 },
  { name: 'ZhengmianZP', label: '设备正面', max: 3 },
  { name: 'farZP', label: '设备远景', max: 3 },
  { name: 'LvxinZP', label: '滤芯照片', max: 9 },
  { name: 'GuanluZP', label: '管路照片', max: 6 },
  { name: 'MingpaiCSZP', label: '铭牌参数', max: 3 },
  { name: 'TiaoxingMZP', label: '条形码', max: 3 },
  { name: 'JixieBHZP', label: '机械编号', max: 3 },
  { name: 'XianchangZP', label: '现场环境', max: 6 }
]

const TASK_PERMISSION_ID = 'aab7df97-4009-4d9f-89f7-ed30e5eba3fb'
let taskMenuPromise = null

function taskIdentity() {
  const user = getUser() || {}
  return String(user.Id || user.Account || 'guest')
}

async function taskMenuId(refresh = false) {
  if (refresh) taskMenuPromise = null
  if (!taskMenuPromise) {
    taskMenuPromise = findMenu(['售后订单', '售后任务'], 'Diy_ShouhouDD', refresh)
      .then((menu) => menu && menu.Id || '')
      .catch(() => '')
  }
  return taskMenuPromise
}

export function hasTaskPermission(name, user = getUser() || {}) {
  if (Number(user.Level || 0) >= 999) return true
  const limits = Array.isArray(user._RoleLimits) ? user._RoleLimits : []
  const row = limits.find((item) => String(item.FkId || '') === TASK_PERMISSION_ID)
  return !!(row && String(row.Permission || '').includes(name))
}

function ensureSuccess(result, fallback = '操作失败') {
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || fallback)
  return result
}

function validCoordinatePair(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
}

export function normalizeTask(row = {}) {
  return {
    ...row,
    id: row.Id || '',
    no: row.ShouhouFWBH || row.DingdanBH || '',
    customer: formatFieldValue(row.KehuMC, '', { empty: '' }),
    contact: formatFieldValue(row.KehuLXRR || row.LianxiR, '', { empty: '' }),
    phone: row.KehuDH || row.LianxiDH || '',
    address: `${formatRegion(row.Chengshi)}${row.Dizhi || ''}`,
    type: formatFieldValue(row.Leixing || row.ShouhouLX || '售后服务', '', { empty: '' }),
    state: formatFieldValue(row.Zhuangtai, '', { empty: '' }),
    serviceUser: formatFieldValue(row.ShouhouRY, '', { empty: '' }),
    serviceUserId: row.ShouhouRYID || '',
    planTime: row.YujiSHSJ || '',
    appointmentTime: row.YuyueSJ || '',
    acceptedTime: row.JiedanSJ || '',
    visitTime: row.ShangmenSJ || '',
    finishTime: row.FinishTime || '',
    content: formatFieldValue(row.Neirong, '', { empty: '' }),
    result: formatFieldValue(row.Jieguo, '', { empty: '' })
  }
}

export function taskStateClass(state) {
  if (/结束|完成/.test(state || '')) return 'is-success'
  if (/取消|驳回|不通过/.test(state || '')) return 'is-danger'
  if (/待商家|待客户/.test(state || '')) return 'is-review'
  if (/待服务|预约/.test(state || '')) return 'is-progress'
  return 'is-pending'
}

function rangeWhere(field, range) {
  if (!field || !Array.isArray(range) || range.length !== 2) return []
  return [
    { Name: field, Type: '>=', Value: range[0] },
    { Name: field, Type: '<=', Value: range[1] }
  ]
}

export async function loadTasks(options = {}) {
  const user = getUser() || {}
  const pageIndex = Number(options.pageIndex || 1)
  const pageSize = Number(options.pageSize || 15)
  const range = buildPeriodRange(options.period || 'all', options.customRange)
  const where = [...rangeWhere(options.dateField || 'YujiSHSJ', range)]
  if (options.state) where.push({ Name: 'Zhuangtai', Type: 'Like', Value: options.state })
  if (options.type) where.push({ Name: 'Leixing', Type: '=', Value: options.type })
  if (options.city) where.push({ Name: 'Chengshi', Type: 'Like', Value: options.city })
  if (options.customerId) where.push({ Name: 'KehuID', Type: '=', Value: options.customerId })
  if (options.mineOnly && user.Id) where.push({ Name: 'ShouhouRYID', Type: '=', Value: user.Id })
  const payload = {
    ModuleEngineKey: 'Diy_ShouhouDD',
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _Keyword: options.keyword || '',
    _OrderBy: options.orderBy || options.dateField || 'YujiSHSJ',
    _OrderByType: options.orderType || 'ASC',
    _Where: where
  }
  const menuId = await taskMenuId(options.refresh === true)
  if (menuId) payload._SysMenuId = menuId
  const key = `task:list:${taskIdentity()}:${JSON.stringify(payload)}`
  const cached = await cachedRequest(key, () => post('/api/ModuleEngine/GetTableData', payload, true), {
    maxAge: pageIndex === 1 ? 30 * 1000 : 10 * 1000,
    refresh: options.refresh === true,
    allowStale: true
  })
  const result = ensureSuccess(cached.data, '任务加载失败')
  return {
    rows: (result.Data || []).map(normalizeTask),
    count: Number(result.DataCount || 0),
    append: result.DataAppend || {},
    stale: cached.stale === true
  }
}

function buildTaskStatisticsPayload(filters = {}) {
  const range = buildPeriodRange(filters.period || 'all', filters.customRange)
  const periodRanges = {}
  TASK_PERIODS.forEach((item) => {
    if (item.value === 'custom' && !filters.customRange) return
    periodRanges[item.value] = buildPeriodRange(
      item.value,
      item.value === 'custom' ? filters.customRange : null
    ) || []
  })
  const payload = {
    Id: (TASK_STATES.find((item) => item.value === filters.state) || {}).code || 0,
    KehuId: filters.customerId || '',
    city: filters.city || '',
    keyword: filters.keyword || '',
    isClicked: filters.mineOnly === true,
    selectedType: filters.type || '',
    periodDateField: filters.dateField || 'YujiSHSJ',
    PeriodRanges: periodRanges
  }
  TASK_DATE_FIELDS.forEach((item) => { payload[item.value] = [] })
  if (range) payload[filters.dateField || 'YujiSHSJ'] = range
  return payload
}

export async function loadTaskSummaryCounts(filters = {}) {
  try {
    const result = ensureSuccess(await callApiEngine('type-tongji', buildTaskStatisticsPayload(filters)), '任务统计加载失败')
    const typeCounts = {}
    ;(result.Data || []).forEach((item) => { typeCounts[item.Value || item.Name] = Number(item.count || item.Count || 0) })
    return {
      typeCounts,
      periodCounts: (result.DataAppend && result.DataAppend.PeriodCounts) || {}
    }
  } catch (error) {
    return { typeCounts: {}, periodCounts: {} }
  }
}

export async function loadTaskCounts(filters = {}) {
  const result = await loadTaskSummaryCounts(filters)
  return result.typeCounts
}

export async function loadTaskStateCounts(filters = {}) {
  try {
    const range = buildPeriodRange(filters.period || 'all', filters.customRange)
    const payload = {
      KehuId: filters.customerId || '',
      city: filters.city || '',
      keyword: filters.keyword || '',
      type: filters.type || '',
      isClicked: filters.mineOnly === true
    }
    TASK_DATE_FIELDS.forEach((item) => { payload[item.value] = [] })
    if (range) payload[filters.dateField || 'YujiSHSJ'] = range
    const result = ensureSuccess(await callApiEngine('service_statusStatistics', payload), '任务状态统计加载失败')
    return result.Data || {}
  } catch (error) {
    return {}
  }
}

export async function loadTaskPeriodCounts(filters = {}) {
  const periods = TASK_PERIODS.filter((item) => item.value !== 'custom' || filters.customRange)
  const counts = {}
  for (const item of periods) {
    try {
      const result = await loadTasks({
        ...filters,
        pageIndex: 1,
        pageSize: 1,
        period: item.value,
        customRange: item.value === 'custom' ? filters.customRange : null
      })
      counts[item.value] = Number(result.count || 0)
    } catch (error) {}
  }
  return counts
}

export async function loadTask(id, refresh = false) {
  const menuId = await taskMenuId(refresh)
  const payload = { Id: id }
  if (menuId) payload._SysMenuId = menuId
  const cached = await cachedRequest(`task:detail:${taskIdentity()}:${id}`, () => V8.FormEngine.GetFormData('Diy_ShouhouDD', payload), {
    maxAge: 20 * 1000,
    refresh,
    allowStale: true
  })
  const result = ensureSuccess(cached.data, '任务不存在或无权查看')
  return { task: normalizeTask(result.Data), stale: cached.stale === true }
}

function normalizeTaskDevice(row = {}) {
  return {
    ...row,
    status: row.FuwuZT || '未完成',
    name: row.ShebeiMC || row.ShangpinMC || '售后设备',
    model: row.ShebeiXH || row.ShangpinXH || '',
    code: row.ShebeiBH || '',
    position: row.AnzhuangWZ || ''
  }
}

export async function loadTaskDevicesPage(taskId, options = {}) {
  const pageIndex = Math.max(1, Number(options.pageIndex || 1))
  const pageSize = Math.min(300, Math.max(1, Number(options.pageSize || 20)))
  const refresh = options.refresh === true
  const keyword = String(options.keyword || '').trim()
  const where = [{ Name: 'ShouhouDDID', Type: '=', Value: taskId }]
  if (keyword) {
    where.push(
      { GroupStart: true, Name: 'ShebeiMC', Type: 'Like', Value: keyword },
      { AndOr: 'OR', Name: 'ShangpinMC', Type: 'Like', Value: keyword },
      { AndOr: 'OR', Name: 'ShebeiXH', Type: 'Like', Value: keyword },
      { AndOr: 'OR', Name: 'ShangpinXH', Type: 'Like', Value: keyword },
      { AndOr: 'OR', Name: 'ShebeiBH', Type: 'Like', Value: keyword },
      { AndOr: 'OR', Name: 'AnzhuangWZ', Type: 'Like', Value: keyword, GroupEnd: true }
    )
  }
  const cacheKey = `task:devices:${taskIdentity()}:${taskId}:${pageIndex}:${pageSize}:${keyword}`
  const cached = await cachedRequest(cacheKey, () => V8.FormEngine.GetTableData('diy_shouhousp', {
    _Where: where,
    _OrderBys: { FuwuZTZ: 'DESC', CreateTime: 'ASC', Id: 'ASC' },
    _PageIndex: pageIndex,
    _PageSize: pageSize
  }), { maxAge: 20 * 1000, refresh, allowStale: true })
  const result = ensureSuccess(cached.data, '售后设备加载失败')
  const rows = (result.Data || []).map(normalizeTaskDevice)
  return { rows, count: Number(result.DataCount ?? rows.length), stale: cached.stale === true }
}

export async function loadTaskDeviceSummary(taskId, refresh = false) {
  const cacheKey = `task:device-summary:${taskIdentity()}:${taskId}`
  const cached = await cachedRequest(cacheKey, () => V8.FormEngine.GetTableData('diy_shouhousp', {
    _Where: [
      { Name: 'ShouhouDDID', Type: '=', Value: taskId },
      { Name: 'FuwuZTZ', Type: '=', Value: '1' }
    ],
    _SelectFields: ['Id'],
    _PageIndex: 1,
    _PageSize: 1
  }), { maxAge: 20 * 1000, refresh, allowStale: true })
  const result = ensureSuccess(cached.data, '任务设备统计加载失败')
  return { completed: Number(result.DataCount ?? (result.Data || []).length), stale: cached.stale === true }
}

export async function loadTaskDevices(taskId, refresh = false) {
  const result = await loadTaskDevicesPage(taskId, { pageIndex: 1, pageSize: 300, refresh })
  return result.rows
}

export async function loadAllTaskDevices(taskId, refresh = false) {
  const rows = []
  let pageIndex = 1
  let count = 0
  do {
    const page = await loadTaskDevicesPage(taskId, { pageIndex, pageSize: 300, refresh })
    rows.push(...page.rows)
    count = page.count
    if (!page.rows.length) break
    pageIndex += 1
  } while (rows.length < count)
  return rows
}

export async function loadTaskDeviceDetail(id) {
  let taskDevice
  try {
    const result = ensureSuccess(await callApiEngine('shouhou_equipmentDetail', { Id: id }), '设备详情加载失败')
    taskDevice = result.Data || {}
  } catch (error) {
    const result = ensureSuccess(await V8.FormEngine.GetFormData('diy_shouhousp', { Id: id }), '设备详情加载失败')
    taskDevice = result.Data || {}
  }

  // 客户设备是任务设备坐标的权威来源；历史设备无坐标时再回退到客户默认位置。
  const customerDeviceId = String(taskDevice.KehuSBID || '').trim()
  let customerDevice = null
  if (customerDeviceId) {
    try {
      const result = await V8.FormEngine.GetFormData('Diy_KehuSB', {
        Id: customerDeviceId,
        _SelectFields: ['Id', 'KehuID', 'DingdanSPID', 'ShebeiBH', 'AnzhuangWZ', 'KehuSB_Lat', 'KehuSB_Lng']
      })
      if (result && Number(result.Code) === 1 && result.Data) customerDevice = result.Data
    } catch (error) {
      // 坐标增强读取失败时仍展示售后设备详情，避免非关键数据阻断现场处理。
    }
  }

  const merged = {
    ...taskDevice,
    KehuID: taskDevice.KehuID || (customerDevice && customerDevice.KehuID) || '',
    DingdanSPID: taskDevice.DingdanSPID || (customerDevice && customerDevice.DingdanSPID) || '',
    ShebeiBH: taskDevice.ShebeiBH || (customerDevice && customerDevice.ShebeiBH) || '',
    AnzhuangWZ: taskDevice.AnzhuangWZ || (customerDevice && customerDevice.AnzhuangWZ) || ''
  }
  if (customerDevice && validCoordinatePair(customerDevice.KehuSB_Lat, customerDevice.KehuSB_Lng)) {
    merged.KehuSB_Lat = customerDevice.KehuSB_Lat
    merged.KehuSB_Lng = customerDevice.KehuSB_Lng
    return merged
  }

  const customerId = String(merged.KehuID || '').trim()
  if (!customerId) return merged
  try {
    const customerResult = await V8.FormEngine.GetFormData('Diy_Kehu', {
      Id: customerId,
      _SelectFields: ['Id', 'KehuDT_Lat', 'KehuDT_Lng']
    })
    const customer = customerResult && Number(customerResult.Code) === 1 ? customerResult.Data : null
    if (customer && validCoordinatePair(customer.KehuDT_Lat, customer.KehuDT_Lng)) {
      merged.KehuSB_Lat = customer.KehuDT_Lat
      merged.KehuSB_Lng = customer.KehuDT_Lng
    }
  } catch (error) {
    // 客户默认坐标同样是兜底能力，失败时返回原任务设备数据。
  }
  return merged
}

export async function loadTaskEquipmentPackage(taskDeviceId) {
  const result = await callApiEngine('task_equipment', { Id: taskDeviceId })
  if (!result || Number(result.Code) === 0) throw new Error((result && result.Msg) || '设备耗材加载失败')
  return result.Data || result
}

export async function loadServiceUsers(keyword = '') {
  const where = [{ Name: 'State', Type: '=', Value: 1 }]
  const result = ensureSuccess(await V8.FormEngine.GetTableData('Sys_User', {
    _Keyword: keyword || '',
    _Where: where,
    _SelectFields: ['Id', 'Name', 'Account', 'Phone', 'DeptName', 'RoleName'],
    _OrderBy: 'Name',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 100
  }), '服务人员加载失败')
  return result.Data || []
}

export async function updateTask(id, values) {
  const payload = { Id: id, ...values, _InvokeType: 'Client' }
  const menuId = await taskMenuId()
  if (menuId) payload._SysMenuId = menuId
  ensureSuccess(await V8.FormEngine.UptFormData('Diy_ShouhouDD', payload), '任务更新失败')
  invalidateTask(id)
}

export async function runTaskAction(action, task, values = {}) {
  const user = getUser() || {}
  const id = task.Id || task.id
  const actions = {
    assign: ['shouhoudd_zhipai', { Id: id, ...values }],
    claim: ['shouhoudd_lingqu', {
      Id: id,
      ShouhouRYID: user.Id,
      ShouhouRY: user.Name || user.Account || '',
      ShouhouRYDH: user.Phone || user.Mobile || ''
    }],
    cancel: ['shouhoudd_chexiao', { Id: id, ShouhouRYID: user.Id }],
    finish: ['shouhoudd_finish', { Id: id, ...values }],
    merchantPass: ['task_acceptance', { Id: id, ShangjiaYSZT: '通过', type: 1 }],
    merchantReject: ['task_acceptance', { Id: id, ShangjiaYSZT: '不通过', ShangjiaYSYJ: values.reason || '', type: 3 }],
    customerPass: ['task_acceptance', { Id: id, KehuYSZT: '通过', type: 2 }],
    customerReject: ['task_acceptance', { Id: id, KehuYSZT: '不通过', KehuYSYJ: values.reason || '', type: 4 }]
  }
  const item = actions[action]
  if (!item) throw new Error('不支持的任务操作')
  const result = ensureSuccess(await callApiEngine(item[0], item[1]), '任务操作失败')
  invalidateTask(id)
  return result
}

export async function saveTaskDevice(id, taskType, values, device = {}) {
  const {
    KehuSB_Lat: latitude,
    KehuSB_Lng: longitude,
    _LocationUpdated: locationUpdated,
    ...taskValues
  } = values || {}

  // 先更新客户设备档案，再完成任务设备；失败时不会留下“任务已完成但坐标未保存”的状态。
  const customerDeviceId = String(device.KehuSBID || taskValues.KehuSBID || '').trim()
  if (customerDeviceId) {
    const customerDeviceValues = {
      Id: customerDeviceId,
      AnzhuangWZ: taskValues.AnzhuangWZ || '',
      _InvokeType: 'Client'
    }
    if (validCoordinatePair(latitude, longitude)) {
      customerDeviceValues.KehuSB_Lat = Number(latitude)
      customerDeviceValues.KehuSB_Lng = Number(longitude)
    }
    if (locationUpdated && taskValues.AnzhuangWZ) {
      customerDeviceValues.KehuSB = JSON.stringify({
        Name: String(taskValues.AnzhuangWZ).trim(),
        Detail: ''
      })
    }
    ensureSuccess(
      await V8.FormEngine.UptFormData('Diy_KehuSB', customerDeviceValues),
      '客户设备安装位置保存失败'
    )
  }

  // 任务设备的安装位置也必须回写订单商品安装位置子表，确保 PC 与小程序看到同一份点位数据。
  const deviceNumber = String(device.ShebeiBH || device.ShangpinBH || taskValues.ShebeiBH || taskValues.ShangpinBH || '').trim()
  const orderProductId = String(device.DingdanSPID || taskValues.DingdanSPID || '').trim()
  if (deviceNumber) {
    const installationWhere = [{ Name: 'ShangpinBH', Type: '=', Value: deviceNumber }]
    if (orderProductId) installationWhere.unshift({ Name: 'DingdanSPID', Type: '=', Value: orderProductId })
    const installationResult = await V8.FormEngine.GetFormData('diy_shebeiwz', {
      _Where: installationWhere,
      _SelectFields: ['Id']
    })
    if (installationResult && Number(installationResult.Code) === 1 && installationResult.Data && installationResult.Data.Id) {
      const installationValues = {
        Id: installationResult.Data.Id,
        AnzhuangWZ: taskValues.AnzhuangWZ || '',
        _InvokeType: 'Client'
      }
      if (validCoordinatePair(latitude, longitude)) {
        installationValues.AnzhuangWZ_Lat = Number(latitude)
        installationValues.AnzhuangWZ_Lng = Number(longitude)
      }
      ensureSuccess(
        await V8.FormEngine.UptFormData('diy_shebeiwz', installationValues),
        '订单商品安装位置同步失败'
      )
    } else if (installationResult && ![1, 2].includes(Number(installationResult.Code))) {
      ensureSuccess(installationResult, '订单商品安装位置查询失败')
    }
  }

  const payload = { Id: id, ...taskValues, FuwuZT: '已完成', FuwuZTZ: 1, _InvokeType: 'Client' }
  ensureSuccess(await V8.FormEngine.UptFormData('diy_shouhousp', payload), '设备处理结果保存失败')
  const syncResult = await callApiEngine('DevicePic', {
    JieguoZP: taskValues.JieguoTP || '',
    ShebeiBH: device.ShebeiBH || taskValues.ShebeiBH || '',
    DingdanID: device.DingdanID || taskValues.DingdanID || ''
  })
  if (syncResult && Number(syncResult.Code) === 0) throw new Error(syncResult.Msg || '设备结果照片同步失败')
  if (/安装/.test(taskType || '')) {
    const installResult = await callApiEngine('Synchronize_photos', {
      Id: device.ShebeiBH || taskValues.ShebeiBH || '',
      ZhengmianZP: taskValues.ZhengmianZP || '',
      LvxinZP: taskValues.LvxinZP || '',
      GuanluZP: taskValues.GuanluZP || '',
      MingpaiCSZP: taskValues.MingpaiCSZP || '',
      TiaoxingMZP: taskValues.TiaoxingMZP || '',
      JixieBHZP: taskValues.JixieBHZP || '',
      farZP: taskValues.farZP || ''
    })
    if (installResult && Number(installResult.Code) === 0) throw new Error(installResult.Msg || '安装照片同步失败')
  }
  removeCachePrefix('task:')
  return syncResult
}

export async function addTaskDevices(taskId, devices) {
  const rows = (devices || []).map((item) => ({
    ...item,
    Id: item.Id,
    ShebeiID: item.ShebeiID || item.Id,
    KehuSBID: item.KehuSBID || item.Id
  }))
  const result = ensureSuccess(await callApiEngine('add_shouhoudd_shebei', { ShouhouDDID: taskId, KehuSBList: rows }), '设备添加失败')
  invalidateTask(taskId)
  return result
}

export function invalidateTask(id = '') {
  removeCachePrefix('task:')
  removeCachePrefix('module:Diy_ShouhouDD')
  if (id) removeCachePrefix(`task:detail:${id}`)
  uni.$emit('xjy:task-changed', { id })
}

export function readTaskDraft(id) {
  return readPageState(`task-draft:${id}`, {})
}

export function writeTaskDraft(id, value) {
  return writePageState(`task-draft:${id}`, { ...value, savedAt: Date.now() })
}

export function removeTaskDraft(id) {
  try { uni.removeStorageSync(`xjy_native_cache_v2:page:task-draft:${id}`) } catch (error) {}
}

export default {
  TASK_STATES,
  TASK_PERIODS,
  TASK_DATE_FIELDS,
  TASK_PHOTO_FIELDS,
  hasTaskPermission,
  normalizeTask,
  taskStateClass,
  loadTasks,
  loadTaskSummaryCounts,
  loadTaskCounts,
  loadTaskStateCounts,
  loadTask,
  loadTaskDevices,
  loadTaskDevicesPage,
  loadTaskDeviceSummary,
  loadAllTaskDevices,
  loadTaskDeviceDetail,
  loadTaskEquipmentPackage,
  loadServiceUsers,
  updateTask,
  runTaskAction,
  saveTaskDevice,
  addTaskDevices,
  readTaskDraft,
  writeTaskDraft,
  removeTaskDraft
}
