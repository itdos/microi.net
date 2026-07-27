import {
  normalizeChosenLocation,
  reverseGeocode
} from '@/platform/location.js'
import {
  normalizeOptions
} from '@/platform/native-form.js'
import {
  V8,
  getUser
} from '@/utils/request.js'
import {
  calculateProposalCosts,
  isProposalCalculationField,
  proposalInheritedValues,
  proposalInitialValues
} from './proposal-calculation.js'

const CUSTOMER_TABLE = 'diy_kehu'
const CHECKIN_TABLE = 'diy_location'
// zhy：跟进记录及联系人表，用于新增跟进时按客户加载联系人。
const FOLLOWUP_TABLE = 'diy_genjinjl'
const CONTACT_TABLE = 'Diy_LianxiR'
// zhy：客户方案表及设备联动字段集中配置。
const PROPOSAL_TABLE = 'diy_kehufaxx'
const PROPOSAL_FIELDS = {
  deviceModel: 'ShebeiXH',
  deviceModelId: 'ShebeiXHID',
  deviceName: 'ShebeiMC',
  rentalPrice: 'ShebeiDJZL',
  buyoutPrice: 'ShebeiDJ',
  filterPrice: 'GenghuanLXJG',
  expectedCooperationDate: 'YujiHZSJ',
  bottledWaterPrice: 'TongzhuangSDJ',
  rentalDeviceCount: 'HezuoHYSSBSL',
  rentalTrialYears: 'ShisuanNS',
  buyoutDeviceCount: 'HezuoHYSSBSLMD',
  buyoutTrialYears: 'ShisuanNSMD'
}
const AMAP_REVERSE_GEOCODE_ENGINE = 'xjy-amap-regeo'
const CUSTOMER_LOCATION_FIELDS = {
  region: 'Chengshi',
  address: 'XiangxiDZ',
  latitude: 'KehuDT_Lat',
  longitude: 'KehuDT_Lng'
}
const CHECKIN_FIELDS = {
  address: 'DakaDD',
  time: 'DakaSJ',
  userName: 'DakaR'
}
// zhy：集中维护跟进表单联动字段，避免在初始化和客户切换逻辑中散落字段名。
const FOLLOWUP_FIELDS = {
  customerId: 'KehuID',
  customerName: 'KehuMC',
  contacts: 'BeibaiFR',
  user: 'BaifangR',
  time: 'GenjinSJ',
  effective: 'GuanjianJCR'
}
const CUSTOMER_PERSONNEL_LINKS = [
  {
    sourceNames: ['FuzeR'],
    sourceLabels: ['负责人'],
    phoneName: 'FuzeRDH',
    phoneLabel: '负责人电话',
    idName: 'FuzeRID'
  },
  {
    sourceNames: ['ZhuanshuKF', 'ZhaunshuKF'],
    sourceLabels: ['专属客服'],
    phoneName: 'ZhuanshuKFDH',
    phoneLabel: '专属客服电话'
  },
  {
    sourceNames: ['ShouhouRY'],
    sourceLabels: ['售后人员'],
    phoneName: 'ShouhouRYDH',
    phoneLabel: '售后人员电话',
    idName: 'ShouhouRYID'
  }
]
const PERSON_ID_KEYS = ['Id', 'ID', 'id', 'UserId', 'UserID', 'userId', 'Value', 'value']
const PERSON_PHONE_KEYS = [
  'Phone', 'phone', 'Mobile', 'mobile', 'MobilePhone', 'mobilePhone',
  'ShoujiH', 'Shouji', 'Tel', 'Telephone', 'LianxiDH', 'PhoneNumber'
]

function isCustomerAdd(context) {
  return String(context.tableName || '').toLowerCase() === CUSTOMER_TABLE &&
    context.mode === 'Add' && !context.rowId
}

function isCustomerForm(context) {
  return String(context.tableName || '').toLowerCase() === CUSTOMER_TABLE
}

function isCheckinAdd(context) {
  return String(context.tableName || '').toLowerCase() === CHECKIN_TABLE &&
    context.mode === 'Add' && !context.rowId
}

function isFollowupAdd(context) {
  return String(context.tableName || '').toLowerCase() === FOLLOWUP_TABLE &&
    context.mode === 'Add' && !context.rowId
}

function isProposalForm(context) {
  return String(context.tableName || '').toLowerCase() === PROPOSAL_TABLE
}

function isProposalAdd(context) {
  return isProposalForm(context) && context.mode === 'Add' && !context.rowId
}

function fieldName(context, expectedName, expectedLabel = '') {
  const definition = context.definition || {}
  const fields = definition.layoutFields || definition.fields || []
  const expected = String(expectedName || '').toLowerCase()
  const field = fields.find((item) => String(item.Name || '').toLowerCase() === expected) ||
    (expectedLabel
      ? fields.find((item) => String(item.Label || '').trim() === expectedLabel)
      : null)
  return field && field.Name ? field.Name : expectedName
}

function findField(context, expectedName, expectedLabel = '') {
  const definition = context.definition || {}
  const groupedFields = (definition.groups || []).reduce(
    (result, group) => result.concat(group.fields || []),
    []
  )
  const fields = groupedFields.concat(definition.fields || [], definition.layoutFields || [])
  const expected = String(expectedName || '').toLowerCase()
  return fields.find((item) => String(item.Name || '').toLowerCase() === expected) ||
    (expectedLabel
      ? fields.find((item) => String(item.Label || '').trim() === expectedLabel)
      : null)
}

function findFieldCopies(context, expectedName, expectedLabel = '') {
  // zhy：ViewSchema 可能复制字段对象，需要同步更新分组、可见字段和完整字段中的所有副本。
  const definition = context.definition || {}
  const groupedFields = (definition.groups || []).reduce(
    (result, group) => result.concat(group.fields || []),
    []
  )
  const candidates = groupedFields.concat(definition.fields || [], definition.layoutFields || [])
  const expected = String(expectedName || '').toLowerCase()
  const matches = candidates.filter((item) =>
    String(item && item.Name || '').toLowerCase() === expected ||
    (expectedLabel && String(item && item.Label || '').trim() === expectedLabel)
  )
  return matches.filter((field, index) => matches.indexOf(field) === index)
}

function personValue(row, keys) {
  if (!row || typeof row !== 'object') return ''
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ''
}

function personnelLink(field) {
  const name = String(field && field.Name || '').toLowerCase()
  const label = String(field && field.Label || '').trim()
  return CUSTOMER_PERSONNEL_LINKS.find((link) =>
    link.sourceNames.some((item) => String(item).toLowerCase() === name) ||
    link.sourceLabels.includes(label)
  )
}

function selectedPersonId(payload, row) {
  const direct = personValue(row, PERSON_ID_KEYS)
  if (direct !== '') return direct
  const field = payload && payload.field || {}
  const config = field.config || {}
  const saveField = String(config.SelectSaveField || '')
  if (/id$/i.test(saveField) && payload.value !== undefined && payload.value !== null) {
    return payload.value
  }
  return ''
}

function requestCurrentLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: resolve,
      fail: reject
    })
  })
}

function requestChosenLocation() {
  return new Promise((resolve, reject) => {
    uni.chooseLocation({ success: resolve, fail: reject })
  })
}

function currentTimestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function currentDate() {
  return currentTimestamp().slice(0, 10)
}

function isEmptyFormValue(value) {
  return value === undefined || value === null || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === '[]')
}

function proposalDefaults(context) {
  // zhy：只填充空值，保留路由参数或业务侧已传入的客户方案默认值。
  const defaults = {
    [fieldName(context, PROPOSAL_FIELDS.expectedCooperationDate, '预计合作时间')]: currentDate(),
    ...proposalInitialValues(context.form)
  }
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) => isEmptyFormValue(context.form[name]))
  )
}

async function latestProposalValues(context) {
  const customerId = context.form[fieldName(context, 'KehuID', '客户Id')]
  if (!customerId) return { Paixu: 0 }
  try {
    const result = await V8.FormEngine.GetTableData(PROPOSAL_TABLE, {
      _Where: [['KehuID', '=', customerId]],
      _OrderBy: 'Paixu',
      _OrderByType: 'DESC',
      _PageIndex: 1,
      _PageSize: 1
    })
    const source = result && Number(result.Code) === 1 &&
      Array.isArray(result.Data) && result.Data.length
      ? result.Data[0]
      : null
    return source ? proposalInheritedValues(source) : { Paixu: 0 }
  } catch (error) {
    // zhy：继承上一方案是便捷能力，查询失败不阻断用户新建方案。
    return { Paixu: 0 }
  }
}

function currentUserOption() {
  // zhy：新增打卡和跟进统一优先使用当前登录用户的 Name。
  const currentUser = getUser() || {}
  const name = String(currentUser.Name || currentUser.Account || '').trim()
  return name
    ? {
        Id: currentUser.Id || '',
        Name: name
      }
    : null
}

function setLocalFieldOptions(field, rows) {
  // zhy：联系人选项在小程序端由客户联动产生，切换为本地数据源供下拉组件直接使用。
  if (!field) return
  const data = Array.isArray(rows) ? rows : []
  field.config = {
    ...(field.config || {}),
    DataSource: 'Data',
    Sql: '',
    DataSourceSqlRemote: false,
    SelectLabel: 'Xingming',
    SelectSaveField: 'Id'
  }
  field.Config = JSON.stringify(field.config)
  field.Data = data
  field.options = normalizeOptions({
    ...field,
    Data: data,
    Config: field.config
  })
  field.optionsRemote = false
  field.optionsLoading = false
  field.optionError = ''
}

async function loadFollowupContacts(context, customerId, clearSelection = false) {
  // zhy：按 KehuID 分页读取该客户绑定的全部联系人，并同步刷新联系人下拉选项。
  const contactFields = findFieldCopies(context, FOLLOWUP_FIELDS.contacts, '联系人')
  const contactField = contactFields[0]
  if (!contactField) return
  const normalizedCustomerId = String(customerId || '').trim()
  if (clearSelection) context.patchForm({ [contactField.Name]: [] })
  if (!normalizedCustomerId) {
    contactFields.forEach((field) => setLocalFieldOptions(field, []))
    return
  }

  contactFields.forEach((field) => {
    field.optionsLoading = true
    field.optionError = ''
  })
  try {
    const rows = []
    const pageSize = 200
    for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
      const result = await V8.FormEngine.GetTableData(CONTACT_TABLE, {
        _Where: [['KehuID', '=', normalizedCustomerId]],
        _SelectFields: [
          'Id',
          'Xingming',
          'ShoujiH',
          'Zhiwu',
          'Bumen',
          'GuanjianJCR',
          'KehuID'
        ],
        _OrderBy: 'CreateTime',
        _OrderByType: 'ASC',
        _PageIndex: pageIndex,
        _PageSize: pageSize
      })
      if (!result || Number(result.Code) !== 1) {
        throw new Error((result && result.Msg) || '联系人加载失败')
      }
      const pageRows = Array.isArray(result.Data) ? result.Data : []
      rows.push(...pageRows)
      const total = Number(result.DataCount || result.Total || result.Count || 0)
      if (pageRows.length < pageSize || (total > 0 && rows.length >= total)) break
    }
    contactFields.forEach((field) => setLocalFieldOptions(field, rows))
  } catch (error) {
    contactFields.forEach((field) => {
      setLocalFieldOptions(field, [])
      field.optionError = error.message || error.Msg || '联系人加载失败'
    })
    uni.showToast({
      title: contactField.optionError,
      icon: 'none'
    })
  } finally {
    contactFields.forEach((field) => {
      field.optionsLoading = false
    })
  }
}

function initializeFollowup(context) {
  // zhy：新增跟进默认填充当前用户、当天日期，并将“是否有效拜访”设为开启。
  const user = currentUserOption()
  const updates = {}
  const userName = fieldName(context, FOLLOWUP_FIELDS.user, '跟进人')
  const timeName = fieldName(context, FOLLOWUP_FIELDS.time, '跟进时间')
  const effectiveName = fieldName(context, FOLLOWUP_FIELDS.effective, '是否有效拜访')

  if (user) updates[userName] = [user]
  if (!Object.prototype.hasOwnProperty.call(context.defaultValues || {}, timeName)) {
    updates[timeName] = currentDate()
  }
  if (!Object.prototype.hasOwnProperty.call(context.defaultValues || {}, effectiveName)) {
    updates[effectiveName] = true
  }
  context.patchForm(updates)
}

function applyCustomerLocation(context, location) {
  const latitude = Number(location && location.latitude)
  const longitude = Number(location && location.longitude)
  const updates = {}
  const submitValues = {}
  const regionName = fieldName(context, CUSTOMER_LOCATION_FIELDS.region, '城市')
  const addressName = fieldName(context, CUSTOMER_LOCATION_FIELDS.address, '详细地址')
  const latitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.latitude)
  const longitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.longitude)

  if (Array.isArray(location.region) && location.region.length) {
    const regionValue = JSON.stringify(location.region)
    updates[regionName] = regionValue
    submitValues[regionName] = regionValue
  }
  if (location.address) {
    updates[addressName] = location.address
    submitValues[addressName] = location.address
  }
  if (Number.isFinite(latitude)) {
    updates[latitudeName] = latitude
    submitValues[latitudeName] = latitude
  }
  if (Number.isFinite(longitude)) {
    updates[longitudeName] = longitude
    submitValues[longitudeName] = longitude
  }

  context.patchForm(updates)
  context.state.locationValues = {
    ...(context.state.locationValues || {}),
    ...submitValues
  }
}

async function locateCustomer(context, chooseFromMap) {
  if (!isCustomerAdd(context) || context.state.locating) return
  context.state.locating = true
  try {
    const source = chooseFromMap
      ? await requestChosenLocation()
      : await requestCurrentLocation()
    let geocode = null
    try {
      geocode = await reverseGeocode(source.longitude, source.latitude, {
        apiEngineKey: AMAP_REVERSE_GEOCODE_ENGINE
      })
    } catch (error) {
      // 地图选点已经包含地址时，逆地理编码失败不阻断保存。
    }
    const location = normalizeChosenLocation(source, geocode)
    applyCustomerLocation(context, location)
    if (chooseFromMap) {
      uni.showToast({ title: '位置已更新', icon: 'success' })
    } else if (!location.address || !location.region.length) {
      uni.showToast({ title: '已获取坐标，地址解析失败', icon: 'none' })
    }
  } catch (error) {
    const message = String(error && error.errMsg || error && error.message || '')
    if (!/cancel/i.test(message)) {
      uni.showToast({
        title: chooseFromMap ? '位置选择失败' : '自动定位失败，请点击重新定位',
        icon: 'none'
      })
    }
  } finally {
    context.state.locating = false
  }
}

function applyCheckinTime(context) {
  const timeName = fieldName(context, CHECKIN_FIELDS.time, '打卡时间')
  const value = context.state.currentTime || currentTimestamp()
  context.patchForm({ [timeName]: value })
  context.state.checkinValues = {
    ...(context.state.checkinValues || {}),
    [timeName]: value
  }
}

function applyCheckinLocation(context, location) {
  const addressName = fieldName(context, CHECKIN_FIELDS.address, '签到地点')
  context.patchForm({ [addressName]: location.address })
  context.state.checkinLocation = location
  context.state.checkinValues = {
    ...(context.state.checkinValues || {}),
    [addressName]: location.address
  }
}

async function locateCheckin(context, chooseFromMap) {
  if (!isCheckinAdd(context) || context.state.locating) return
  context.state.locating = true
  try {
    const source = chooseFromMap
      ? await requestChosenLocation()
      : await requestCurrentLocation()
    let geocode = null
    try {
      geocode = await reverseGeocode(source.longitude, source.latitude, {
        apiEngineKey: AMAP_REVERSE_GEOCODE_ENGINE
      })
    } catch (error) {
      // 地图选点自带地址时仍可继续；自动定位会在下方校验地址。
    }
    const location = normalizeChosenLocation(source, geocode)
    if (!location.address) throw new Error('当前坐标的详细地址解析失败')
    applyCheckinLocation(context, location)
    if (chooseFromMap) uni.showToast({ title: '签到地点已更新', icon: 'success' })
  } catch (error) {
    const message = String(error && error.errMsg || error && error.message || '')
    if (!/cancel/i.test(message)) {
      uni.showToast({
        title: chooseFromMap ? '位置选择失败' : '自动定位失败，请点击重新定位',
        icon: 'none'
      })
    }
  } finally {
    context.state.locating = false
  }
}

export function createState() {
  return {
    locating: false,
    locationInitialized: false,
    locationValues: {},
    personnelValues: {},
    checkinInitialized: false,
    checkinValues: {},
    checkinLocation: {
      latitude: 0,
      longitude: 0,
      address: ''
    },
    currentTime: '',
    followupInitialized: false,
    proposalInitialized: false
  }
}

export async function initialize(context) {
  if (isCustomerAdd(context) && !context.state.locationInitialized) {
    context.state.locationInitialized = true
    setTimeout(() => locateCustomer(context, false), 0)
  }
  if (isCheckinAdd(context) && !context.state.checkinInitialized) {
    context.state.checkinInitialized = true
    context.state.currentTime = currentTimestamp()
    applyCheckinTime(context)
    // zhy：新增打卡记录时自动将当前登录用户 Name 填入打卡人。
    const user = currentUserOption()
    if (user) {
      const userName = fieldName(context, CHECKIN_FIELDS.userName, '打卡人')
      context.patchForm({ [userName]: user.Name })
      context.state.checkinValues = {
        ...(context.state.checkinValues || {}),
        [userName]: user.Name
      }
    }
    setTimeout(() => locateCheckin(context, false), 0)
  }
  if (isFollowupAdd(context) && !context.state.followupInitialized) {
    // zhy：新增跟进记录时初始化默认值，并加载当前客户绑定的联系人。
    context.state.followupInitialized = true
    initializeFollowup(context)
    await loadFollowupContacts(
      context,
      context.form[fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')]
    )
  }
  if (isProposalAdd(context) && !context.state.proposalInitialized) {
    // zhy：新增客户方案时补齐 PC 默认值、继承上一方案并生成合作前/后成本。
    context.state.proposalInitialized = true
    const inherited = await latestProposalValues(context)
    const inheritedForm = {
      ...context.form,
      ...inherited
    }
    // zhy：上一方案的空字段不应覆盖新增默认值，已有有效值则继续保留。
    const defaults = proposalDefaults({
      ...context,
      form: inheritedForm
    })
    const initialForm = {
      ...inheritedForm,
      ...defaults
    }
    context.patchForm({
      ...inherited,
      ...defaults,
      ...calculateProposalCosts(initialForm)
    })
  }
}

export function getPresentation(context) {
  if (!isCheckinAdd(context)) return {}
  const location = context.state.checkinLocation || {}
  return {
    location: {
      title: '现场位置',
      actionKey: 'xjy-checkin-location',
      actionLabel: context.state.locating ? '定位中…' : '重新定位',
      locating: Boolean(context.state.locating),
      latitude: Number(location.latitude || 0),
      longitude: Number(location.longitude || 0),
      address: String(location.address || ''),
      emptyText: '点击获取当前位置'
    }
  }
}

export async function runPresentationAction(context, action) {
  if (action && action.key === 'xjy-checkin-location') {
    await locateCheckin(context, true)
    return { handled: true }
  }
  return { handled: false }
}

export function getFieldPresentation(context, field) {
  if (isProposalForm(context) && field &&
    String(field.Name || '').toLowerCase() === PROPOSAL_FIELDS.bottledWaterPrice.toLowerCase()) {
    return {
      // zhy：与 PC 表单一致，仅桶装水方案显示桶装水单价。
      visible: String(context.form.DangqianYSFS || '') === '桶装水'
    }
  }
  if (!isCustomerForm(context) || !field) return {}
  const label = String(field.Label || '').trim()
  const component = String(field.component || field.Component || '').toLowerCase()
  if (label !== '客户地图' && !['map', 'maparea'].includes(component)) return {}

  const latitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.latitude)
  const longitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.longitude)
  const addressName = fieldName(context, CUSTOMER_LOCATION_FIELDS.address, '详细地址')
  const latitude = Number(context.form[latitudeName])
  const longitude = Number(context.form[longitudeName])
  const hasCoordinates = Number.isFinite(latitude) && latitude !== 0 &&
    Number.isFinite(longitude) && longitude !== 0

  return {
    type: 'map',
    latitude: hasCoordinates ? latitude : 0,
    longitude: hasCoordinates ? longitude : 0,
    address: String(context.form[addressName] || ''),
    emptyText: context.mode === 'Add' ? '正在获取客户位置…' : '该客户暂未保存位置信息'
  }
}

export function getFieldActions(context, field) {
  if (!field) return []
  const name = String(field.Name || '').toLowerCase()
  const label = String(field.Label || '').trim()
  if (isCustomerAdd(context) &&
    (name === CUSTOMER_LOCATION_FIELDS.address.toLowerCase() || label === '详细地址')) {
    return [{
      key: 'xjy-customer-location',
      label: context.state.locating ? '定位中…' : '重新定位',
      icon: '⌖',
      disabled: Boolean(context.state.locating)
    }]
  }
  return []
}

export async function runFieldAction(context, field, action) {
  if (action && action.key === 'xjy-customer-location') {
    await locateCustomer(context, true)
    return { handled: true }
  }
  return { handled: false }
}

export async function handleFieldSelect(context, payload) {
  if (isProposalForm(context) && payload && !payload.multiple) {
    const selectedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    if (selectedFieldName === PROPOSAL_FIELDS.deviceModel.toLowerCase()) {
      const row = payload.raw && typeof payload.raw === 'object'
        ? payload.raw
        : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
          ? payload.option.raw
          : {}
      // zhy：移动端选择设备型号后复用 PC 表单的设备名称、价格及型号 Id 联动映射。
      const updates = {
        [fieldName(context, PROPOSAL_FIELDS.deviceModelId, '设备型号Id')]: personValue(row, ['Id', 'ID', 'id']),
        [fieldName(context, PROPOSAL_FIELDS.deviceName, '设备名称')]: personValue(row, ['ShangpinMC']),
        [fieldName(context, PROPOSAL_FIELDS.rentalPrice, '设备单价（租赁）')]: personValue(row, ['ZulinXJ']),
        [fieldName(context, PROPOSAL_FIELDS.buyoutPrice, '设备单价（买断）')]: personValue(row, ['Xianjia']),
        [fieldName(context, PROPOSAL_FIELDS.filterPrice, '更换滤芯价格')]: personValue(row, ['GenghuanLXJG'])
      }
      context.patchForm({
        ...updates,
        ...calculateProposalCosts({
          ...context.form,
          ...updates
        })
      })
      return { handled: true }
    }
  }
  if (isFollowupAdd(context) && payload && !payload.multiple) {
    // zhy：用户切换客户后同步客户 Id，清空旧联系人并重新加载该客户的联系人。
    const selectedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    if (selectedFieldName === FOLLOWUP_FIELDS.customerName.toLowerCase()) {
      const row = payload.raw && typeof payload.raw === 'object'
        ? payload.raw
        : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
          ? payload.option.raw
          : {}
      const customerId = personValue(row, ['Id', 'ID', 'id'])
      const customerName = personValue(row, ['KehuMC', 'Name', 'name'])
      const customerIdName = fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')
      const customerNameField = fieldName(context, FOLLOWUP_FIELDS.customerName, '客户名称')
      context.patchForm({
        [customerIdName]: customerId,
        [customerNameField]: customerName || payload.value || ''
      })
      await loadFollowupContacts(context, customerId, true)
      return { handled: true }
    }
  }
  // zhy：客户新增和详情编辑都要在选中服务人员后同步带出对应电话。
  if (!isCustomerForm(context) || !payload || payload.multiple) return { handled: false }
  const link = personnelLink(payload.field)
  if (!link) return { handled: false }
  const row = payload.raw && typeof payload.raw === 'object'
    ? payload.raw
    : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
      ? payload.option.raw
      : {}
  const phone = personValue(row, PERSON_PHONE_KEYS)
  const personId = selectedPersonId(payload, row)
  const phoneName = fieldName(context, link.phoneName, link.phoneLabel)
  const updates = { [phoneName]: phone }
  const submitValues = { [phoneName]: phone }

  if (link.idName && personId !== '') {
    const idName = fieldName(context, link.idName)
    updates[idName] = personId
    submitValues[idName] = personId
  }

  context.patchForm(updates)
  context.state.personnelValues = {
    ...(context.state.personnelValues || {}),
    ...submitValues
  }
  return { handled: true }
}

export function handleFieldChange(context, payload) {
  if (!isProposalForm(context) || !payload ||
    !isProposalCalculationField(payload.field && payload.field.Name)) {
    return { handled: false }
  }
  // zhy：普通输入、开关及选项变化统一重算，避免只在设备型号下拉时更新成本。
  context.patchForm(calculateProposalCosts(context.form))
  return { handled: true }
}

export async function beforeSubmit(context) {
  if (context.state.locating) throw new Error('正在获取位置，请稍候')
  if (isCustomerForm(context)) {
    return {
      ...(isCustomerAdd(context) ? context.state.locationValues : {}),
      ...context.state.personnelValues
    }
  }
  if (isCheckinAdd(context)) {
    // zhy：提交打卡记录时再次兜底打卡人，确保保存当前登录用户 Name。
    const addressName = fieldName(context, CHECKIN_FIELDS.address, '签到地点')
    const timeName = fieldName(context, CHECKIN_FIELDS.time, '打卡时间')
    const userName = fieldName(context, CHECKIN_FIELDS.userName, '打卡人')
    const user = currentUserOption()
    return {
      ...context.state.checkinValues,
      [addressName]: context.form[addressName] || context.state.checkinLocation.address || '',
      [timeName]: context.form[timeName] || context.state.currentTime || currentTimestamp(),
      [userName]: context.form[userName] || (user && user.Name) || ''
    }
  }
  if (isProposalForm(context)) {
    // zhy：保存前再次按最终表单值计算，确保落库金额与页面输入一致。
    return calculateProposalCosts(context.form)
  }
  return {}
}

export async function afterSubmit(context) {
  if (String(context.tableName || '').toLowerCase() === CHECKIN_TABLE && context.wasAdd) {
    dispose(context)
  }
}

export function getBusyMessage(context) {
  return context.state && context.state.locating ? '正在获取位置，请稍候' : ''
}

export function dispose(context) {
  // 当前租户表单扩展没有需要在页面卸载时清理的长驻任务。
}

export default {
  createState,
  initialize,
  getPresentation,
  runPresentationAction,
  getFieldPresentation,
  getFieldActions,
  runFieldAction,
  handleFieldChange,
  handleFieldSelect,
  beforeSubmit,
  afterSubmit,
  getBusyMessage,
  dispose
}
