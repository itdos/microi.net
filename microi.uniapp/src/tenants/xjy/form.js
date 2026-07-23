import {
  normalizeChosenLocation,
  reverseGeocode
} from '@/platform/location.js'

const CUSTOMER_TABLE = 'diy_kehu'
const CUSTOMER_LOCATION_FIELDS = {
  region: 'Chengshi',
  address: 'XiangxiDZ',
  latitude: 'KehuDT_Lat',
  longitude: 'KehuDT_Lng'
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
      geocode = await reverseGeocode(source.longitude, source.latitude)
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

export function createState() {
  return {
    locating: false,
    locationInitialized: false,
    locationValues: {},
    personnelValues: {}
  }
}

export async function initialize(context) {
  if (!isCustomerAdd(context) || context.state.locationInitialized) return
  context.state.locationInitialized = true
  setTimeout(() => locateCustomer(context, false), 0)
}

export function getFieldActions(context, field) {
  if (!isCustomerAdd(context) || !field) return []
  const name = String(field.Name || '').toLowerCase()
  const label = String(field.Label || '').trim()
  if (name !== CUSTOMER_LOCATION_FIELDS.address.toLowerCase() && label !== '详细地址') return []
  return [{
    key: 'xjy-customer-location',
    label: context.state.locating ? '定位中…' : '重新定位',
    icon: '⌖',
    disabled: Boolean(context.state.locating)
  }]
}

export async function runFieldAction(context, field, action) {
  if (action && action.key === 'xjy-customer-location') {
    await locateCustomer(context, true)
    return { handled: true }
  }
  return { handled: false }
}

export async function handleFieldSelect(context, payload) {
  if (!isCustomerAdd(context) || !payload || payload.multiple) return { handled: false }
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

export async function beforeSubmit(context) {
  if (!isCustomerAdd(context)) return {}
  if (context.state.locating) throw new Error('正在获取位置，请稍候')
  return {
    ...context.state.locationValues,
    ...context.state.personnelValues
  }
}

export async function afterSubmit() {}

export function getBusyMessage(context) {
  return context.state && context.state.locating ? '正在获取位置，请稍候' : ''
}

export default {
  createState,
  initialize,
  getFieldActions,
  runFieldAction,
  handleFieldSelect,
  beforeSubmit,
  afterSubmit,
  getBusyMessage
}
