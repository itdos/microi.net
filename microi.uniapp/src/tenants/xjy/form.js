import {
  normalizeChosenLocation,
  reverseGeocode
} from '@/platform/location.js'
import {
  normalizeOptions,
  parseJson
} from '@/platform/native-form.js'
import { normalizeUploadItems } from '@/platform/display.js'
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
import {
  CUSTOMER_FOLLOW_FIELDS,
  customerFollowScopeValues
} from './customer-follow-scope.mjs'
import {
  calculateOrderProductCooperation,
  orderProductNumberValue
} from './order-product-cooperation.mjs'
import {
  orderSummarySubmitValues,
  orderSummaryValues
} from './order-summary.mjs'

const CUSTOMER_TABLE = 'diy_kehu'
// zhy：合同订单在所有移动端入口共用同一表单钩子，避免“我的订单”和客户订单 Tab 行为不一致。
const ORDER_TABLE = 'diy_dingdan'
const ORDER_PRODUCT_TABLE = 'diy_dingdansp'
const PRODUCT_TABLE = 'diy_shangpin'
const ORDER_PRODUCT_CONSUMABLE_TABLE = 'diy_dingdansphc'
const ORDER_RENEWAL_TYPE = '老客户续签订单'
const INSTALLATION_POSITION_TABLE = 'diy_shebeiwz'
const INSTALLATION_POSITION_CODE_FIELD = 'ShangpinBH'
const INSTALLATION_POSITION_CODE_ENGINE = 'create_unique_value'
const CUSTOMER_ADDRESS_TABLE = 'diy_kehudz'
const CHECKIN_TABLE = 'diy_location'
// zhy：跟进记录及联系人表，用于新增跟进时按客户加载联系人。
const FOLLOWUP_TABLE = 'diy_genjinjl'
const CONTACT_TABLE = 'Diy_LianxiR'
const CUSTOMER_CARE_TABLE = 'diy_kehuguanhuai'
// zhy：客户方案表及设备联动字段集中配置。
const PROPOSAL_TABLE = 'diy_kehufaxx'
const PROPOSAL_FIELDS = {
  deviceModel: 'ShebeiXH',
  deviceModelId: 'ShebeiXHID',
  deviceName: 'ShebeiMC',
  rentalPrice: 'ShebeiDJZL',
  buyoutPrice: 'ShebeiDJ',
  filterPrice: 'GenghuanLXJG',
  installationPositionCount: 'ChangsuoDWSL',
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
const CUSTOMER_CARE_FIELDS = {
  customerId: 'KehuID',
  customerName: 'KehuMC',
  contact: 'LianxiR',
  contactId: 'LianxiRID',
  quantity: 'Shuliang',
  unitPrice: 'Danjia',
  totalPrice: 'Zongjia'
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
// zhy：集中维护订单客户、负责人、安装人及新增默认值字段，包含需要随表单提交的隐藏 Id。
const ORDER_FIELDS = {
  customerId: 'KehuID',
  customerName: 'KehuMC',
  owner: 'YewuY',
  ownerId: 'YewuYID',
  ownerPhone: 'YewuYDH',
  orderType: 'XinLDD',
  orderDate: 'XiadanRQ',
  renewalOrderNumber: 'XQDingdanBH',
  renewalState: 'DingdanSFXQ',
  contractAttachment: 'HetongFJ',
  contractUploadState: 'IsDingdanHT',
  contractState: 'HetongZT',
  installer: 'AnzhuangR',
  installerId: 'AnzhuangRID',
  installerPhone: 'AnzhuangRDH'
}
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

// zhy：按表名识别订单表单；联动同时适用于新增和编辑，默认值仅适用于新增。
function isOrderForm(context) {
  return String(context.tableName || '').toLowerCase() === ORDER_TABLE
}

function isOrderAdd(context) {
  return isOrderForm(context) && context.mode === 'Add' && !context.rowId
}

function isOrderProductForm(context) {
  return String(context.tableName || '').toLowerCase() === ORDER_PRODUCT_TABLE
}

function isInstallationPositionAdd(context) {
  return String(context.tableName || '').toLowerCase() === INSTALLATION_POSITION_TABLE &&
    context.mode === 'Add' && !context.rowId
}

function installationPositionCodeField(context) {
  // 线上历史表可能使用 ShangpinBH 或 ShebeiBH，以当前元数据中“设备编号”的真实字段为准。
  const labelledField = findField(context, '__device_number__', '设备编号')
  return labelledField && labelledField.Name
    ? labelledField.Name
    : fieldName(context, INSTALLATION_POSITION_CODE_FIELD)
}

function isCustomerAddressForm(context) {
  return String(context.tableName || '').toLowerCase() === CUSTOMER_ADDRESS_TABLE
}

function isCustomerAddressAdd(context) {
  return isCustomerAddressForm(context) && context.mode === 'Add' && !context.rowId
}

function isCheckinAdd(context) {
  return String(context.tableName || '').toLowerCase() === CHECKIN_TABLE &&
    context.mode === 'Add' && !context.rowId
}

function isFollowupAdd(context) {
  return isFollowupForm(context) && context.mode === 'Add' && !context.rowId
}

function isFollowupForm(context) {
  if (String(context.tableName || '').toLowerCase() === FOLLOWUP_TABLE) return true
  // zhy：项目合伙人跟进记录与普通跟进记录使用同一组核心字段，
  // 不依赖租户动态表名，按字段结构复用当前用户、当天日期及客户联系人联动。
  return [
    FOLLOWUP_FIELDS.customerName,
    FOLLOWUP_FIELDS.contacts,
    FOLLOWUP_FIELDS.user,
    FOLLOWUP_FIELDS.time
  ].every((name) => Boolean(findField(context, name)))
}

function isCustomerCareForm(context) {
  return String(context.tableName || '').toLowerCase() === CUSTOMER_CARE_TABLE
}

function isProposalForm(context) {
  return String(context.tableName || '').toLowerCase() === PROPOSAL_TABLE
}

function isProposalAdd(context) {
  return isProposalForm(context) && context.mode === 'Add' && !context.rowId
}

function isProposalInstallationChild(field = {}) {
  const config = field.config || {}
  const title = [
    field.Label,
    field.Name,
    config.TableChildSysMenuName,
    config.TableChild?.Title
  ].filter(Boolean).join(' ')
  return /安装点位|安装位置/.test(title)
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

function isCustomerOwnerField(field) {
  const name = String(field && field.Name || '').toLowerCase()
  const label = String(field && field.Label || '').trim()
  return name === CUSTOMER_FOLLOW_FIELDS.owner.toLowerCase() || label === '负责人'
}

function applyCustomerFollowScope(context, overrides = {}) {
  const values = customerFollowScopeValues({
    ...context.form,
    ...overrides
  })
  context.patchForm(values)
  context.state.customerFollowScopeValues = values
  return values
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

function selectedRow(payload = {}) {
  // zhy：兼容原生选择控件直接返回 raw，以及 option.raw 两种单选事件结构。
  return payload.raw && typeof payload.raw === 'object'
    ? payload.raw
    : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
      ? payload.option.raw
      : {}
}

function orderFieldName(context, key, label = '') {
  return fieldName(context, ORDER_FIELDS[key], label)
}

function orderCustomerValues(context, row = {}, cleared = false) {
  // zhy：客户表保存 FuzeR 系列字段，订单表保存 YewuY 系列字段，在此统一完成字段映射。
  const values = {
    [orderFieldName(context, 'customerId', '客户Id')]: cleared
      ? ''
      : personValue(row, ['Id', 'ID', 'id', 'KehuID', 'KehuId']),
    [orderFieldName(context, 'owner', '负责人')]: cleared
      ? ''
      : personValue(row, ['FuzeR', 'YewuY']),
    [orderFieldName(context, 'ownerId', '负责人ID')]: cleared
      ? ''
      : personValue(row, ['FuzeRID', 'YewuYID']),
    [orderFieldName(context, 'ownerPhone', '负责人电话')]: cleared
      ? ''
      : personValue(row, ['FuzeRDH', 'YewuYDH'])
  }
  return values
}

function applyOrderValues(context, values = {}) {
  // zhy：同时更新页面和提交态，确保不可见的负责人/安装人 Id 也能正常落库。
  context.patchForm(values)
  context.state.orderValues = {
    ...(context.state.orderValues || {}),
    ...values
  }
  return values
}

async function initializeOrder(context) {
  // zhy：仅为空字段设置新增默认值，保留路由或业务侧已经传入的订单数据。
  const defaults = {
    [orderFieldName(context, 'orderType', '订单类型')]: '老客户新增订单',
    [orderFieldName(context, 'orderDate', '下单日期')]: currentDate(),
    [orderFieldName(context, 'contractState', '合同状态')]: '未断约',
    [orderFieldName(context, 'renewalState', '订单是否续签')]: '未续签'
  }
  const emptyDefaults = Object.fromEntries(
    Object.entries(defaults).filter(([name]) => isEmptyFormValue(context.form[name]))
  )
  applyOrderValues(context, emptyDefaults)

  // 从客户/合作客户的订单 Tab 进入时只有客户 Id、名称，没有触发客户选择事件。
  // 新增页仅在负责人信息仍为空时补查一次客户，避免覆盖路由明确传入的值。
  const customerId = context.form[orderFieldName(context, 'customerId', '客户Id')]
  const owner = context.form[orderFieldName(context, 'owner', '负责人')]
  const ownerPhone = context.form[orderFieldName(context, 'ownerPhone', '负责人电话')]
  if (!customerId || (!isEmptyFormValue(owner) && !isEmptyFormValue(ownerPhone))) return
  try {
    const result = await V8.FormEngine.GetFormData(CUSTOMER_TABLE, {
      Id: customerId,
      _SelectFields: ['Id', 'KehuMC', 'FuzeR', 'FuzeRID', 'FuzeRDH']
    })
    if (result && Number(result.Code) === 1 && result.Data) {
      applyOrderValues(context, orderCustomerValues(context, result.Data))
    }
  } catch (error) {
    // 客户联动属于便捷回填，读取失败不阻断订单新增，用户仍可手动选择客户或负责人。
  }
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

function cooperationOptionKey(field, value) {
  const option = Array.isArray(field && field.options)
    ? field.options.find((item) => String(item && item.value) === String(value))
    : null
  const raw = option && option.raw && typeof option.raw === 'object' ? option.raw : {}
  return raw.Key ?? raw.key ?? ''
}

async function orderProductFilterPrice(context, product) {
  const orderProductId = context.rowId || context.form.Id
  if (!orderProductId) return orderProductNumberValue(product.GenghuanLXJG)
  const result = await V8.FormEngine.GetTableData(ORDER_PRODUCT_CONSUMABLE_TABLE, {
    _Where: [['DingdanSPID', '=', orderProductId]],
    _SelectFields: ['YouhuiHLXZJ'],
    _PageIndex: 1,
    _PageSize: 1000
  })
  // PC 字段事件查询成功时使用耗材明细合计，失败时才回退商品滤芯价。
  if (!result || Number(result.Code) !== 1) return orderProductNumberValue(product.GenghuanLXJG)
  return (Array.isArray(result.Data) ? result.Data : []).reduce(
    (sum, item) => sum + orderProductNumberValue(item && item.YouhuiHLXZJ),
    0
  )
}

async function updateOrderProductCooperation(context, payload) {
  const cooperation = String(payload.value || '')
  const cooperationKey = cooperationOptionKey(payload.field, cooperation)
  const productId = context.form.ShangpinID
  const requestId = Number(context.state.orderProductCooperationRequestId || 0) + 1
  context.state.orderProductCooperationRequestId = requestId

  // 与 PC 一致先更新隐藏合作方式值，接口异常时也不残留上一方式。
  context.patchForm({ HezuoFSZ: cooperationKey })
  if (!cooperation || !productId) return { handled: true }

  try {
    const productResult = await V8.FormEngine.GetFormData(PRODUCT_TABLE, {
      Id: productId,
      _SelectFields: ['Id', 'Yuanjia', 'Xianjia', 'ZulinYJ', 'ZulinXJ', 'GenghuanLXJG']
    })
    if (!productResult || Number(productResult.Code) !== 1 || !productResult.Data) {
      throw new Error(productResult && productResult.Msg || '商品价格读取失败')
    }
    const filterActualUnitPrice = await orderProductFilterPrice(context, productResult.Data)
    // 快速连续切换时只允许最后一次请求更新价格。
    if (context.state.orderProductCooperationRequestId !== requestId ||
      String(context.form.HezuoFS || '') !== cooperation) {
      return { handled: true }
    }
    context.patchForm(calculateOrderProductCooperation({
      cooperation,
      cooperationKey,
      form: context.form,
      product: productResult.Data,
      filterActualUnitPrice
    }))
  } catch (error) {
    if (context.state.orderProductCooperationRequestId === requestId) {
      uni.showToast({
        title: error.message || error.Msg || '合作方式价格联动失败',
        icon: 'none'
      })
    }
  }
  return { handled: true }
}

async function loadOrderSummaryValues(orderId) {
  const id = String(orderId || '').trim()
  if (!id) return orderSummaryValues([], [])
  const productResult = await V8.FormEngine.GetTableData(ORDER_PRODUCT_TABLE, {
    _Where: [{ Name: 'DingdanID', Type: '=', Value: id }],
    _OrderBy: 'CreateTime',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 1000
  })
  if (!productResult || Number(productResult.Code) !== 1) {
    throw new Error(productResult && productResult.Msg || '订单商品读取失败')
  }
  const products = Array.isArray(productResult.Data) ? productResult.Data : []
  const productIds = products.map((item) => item && item.Id).filter(Boolean)
  if (!productIds.length) return orderSummaryValues(products, [])
  const positionResult = await V8.FormEngine.GetTableData(INSTALLATION_POSITION_TABLE, {
    _Where: [{ Name: 'DingdanSPID', Type: 'In', Value: productIds }],
    _OrderBy: 'Paixu',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 5000
  })
  if (!positionResult || Number(positionResult.Code) !== 1) {
    throw new Error(positionResult && positionResult.Msg || '设备安装位置读取失败')
  }
  return orderSummaryValues(
    products,
    Array.isArray(positionResult.Data) ? positionResult.Data : []
  )
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
    SelectSaveField: ''
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

function setCustomerCareContactOptions(field, rows) {
  if (!field) return
  const data = Array.isArray(rows) ? rows : []
  field.component = 'MultipleSelect'
  field.Component = 'MultipleSelect'
  field.config = {
    ...(field.config || {}),
    DataSource: 'Data',
    Sql: '',
    DataSourceSqlRemote: false,
    SelectLabel: 'Xingming',
    SelectSaveField: ''
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

function customerCareTotalValues(context, overrides = {}) {
  const quantityName = fieldName(context, CUSTOMER_CARE_FIELDS.quantity, '数量')
  const unitPriceName = fieldName(context, CUSTOMER_CARE_FIELDS.unitPrice, '单价')
  const totalPriceName = fieldName(context, CUSTOMER_CARE_FIELDS.totalPrice, '总价')
  const source = {
    ...context.form,
    ...overrides
  }
  const numberValue = (value) => {
    const result = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(result) ? result : 0
  }
  const total = Math.round(numberValue(source[quantityName]) * numberValue(source[unitPriceName]) * 100) / 100
  return { [totalPriceName]: total }
}

async function loadCustomerCareContacts(context) {
  const contactFields = findFieldCopies(context, CUSTOMER_CARE_FIELDS.contact, '客户联系人')
  const contactField = contactFields[0]
  if (!contactField) return
  const customerIdName = fieldName(context, CUSTOMER_CARE_FIELDS.customerId, '客户Id')
  const contactIdName = fieldName(context, CUSTOMER_CARE_FIELDS.contactId, '客户联系人Id')
  const contactName = fieldName(context, CUSTOMER_CARE_FIELDS.contact, '客户联系人')
  const customerId = String(context.form[customerIdName] || '').trim()
  if (!customerId) {
    contactFields.forEach((field) => setCustomerCareContactOptions(field, []))
    return
  }

  contactFields.forEach((field) => {
    field.optionsLoading = true
    field.optionError = ''
  })
  try {
    const result = await V8.FormEngine.GetTableData(CONTACT_TABLE, {
      _Where: [['KehuID', '=', customerId]],
      _SelectFields: ['Id', 'Xingming', 'ShoujiH', 'Zhiwu', 'Bumen', 'GuanjianJCR', 'KehuID'],
      _OrderBy: 'CreateTime',
      _OrderByType: 'ASC',
      _PageIndex: 1,
      _PageSize: 500
    })
    if (!result || Number(result.Code) !== 1) {
      throw new Error((result && result.Msg) || '客户联系人加载失败')
    }
    const rows = Array.isArray(result.Data) ? result.Data : []
    contactFields.forEach((field) => setCustomerCareContactOptions(field, rows))
    const selectedId = String(context.form[contactIdName] || '').trim()
    const parsedSelection = parseJson(context.form[contactName], context.form[contactName])
    const currentSelection = Array.isArray(parsedSelection)
      ? parsedSelection
      : parsedSelection
        ? [parsedSelection]
        : []
    const selectedIds = new Set(currentSelection.map((item) =>
      String(item && typeof item === 'object' ? personValue(item, ['Id', 'ID', 'id']) : item || '')
    ).filter(Boolean))
    const selectedNames = new Set(currentSelection.map((item) =>
      String(item && typeof item === 'object'
        ? personValue(item, ['Xingming', 'Name', 'name'])
        : item || '')
    ).filter(Boolean))
    const selectedRows = rows.filter((row) =>
      (selectedId && String(row.Id || '') === selectedId) ||
      selectedIds.has(String(row.Id || '')) ||
      selectedNames.has(String(row.Xingming || ''))
    )
    if (selectedRows.length) {
      context.patchForm({
        [contactIdName]: selectedRows[0].Id || '',
        [contactName]: selectedRows
      })
    }
  } catch (error) {
    contactFields.forEach((field) => {
      setCustomerCareContactOptions(field, [])
      field.optionError = error.message || error.Msg || '客户联系人加载失败'
    })
    uni.showToast({ title: contactField.optionError, icon: 'none' })
  } finally {
    contactFields.forEach((field) => {
      field.optionsLoading = false
    })
  }
}

function contactSubmitValue(value, rows) {
  const source = value && typeof value === 'object' ? value : {}
  const id = String(personValue(source, ['Id', 'ID', 'id']) || value || '').trim()
  const matched = (Array.isArray(rows) ? rows : []).find((row) =>
    String(personValue(row, ['Id', 'ID', 'id'])) === id
  )
  if (matched && typeof matched === 'object') return { ...matched }
  return id ? { ...source, Id: id } : null
}

function normalizeFollowupContactSelection(context, rows, requireNames = false) {
  const contactName = fieldName(context, FOLLOWUP_FIELDS.contacts, '联系人')
  const parsed = parseJson(context.form[contactName], context.form[contactName])
  const values = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
  const normalized = values.map((value) => contactSubmitValue(value, rows)).filter(Boolean)
  if (requireNames && normalized.some((value) => !value.Xingming)) {
    throw new Error('联系人信息不完整，请重新选择联系人')
  }
  if (normalized.length) context.patchForm({ [contactName]: normalized })
}

function selectedCustomer(context, payload = {}) {
  if (payload.cleared) return { id: '', name: '' }
  const row = payload.raw && typeof payload.raw === 'object'
    ? payload.raw
    : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
      ? payload.option.raw
      : {}
  const fromSelection = Boolean(payload.field)
  const customerIdName = fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')
  const customerNameField = fieldName(context, FOLLOWUP_FIELDS.customerName, '客户名称')
  return {
    id: personValue(row, ['Id', 'ID', 'id', 'KehuID', 'KehuId', 'CustomerId', 'CustomerID']) ||
      (fromSelection ? '' : context.form[customerIdName] || context.state.followupCustomerId || ''),
    name: personValue(row, ['KehuMC', 'Name', 'name', 'CustomerName']) ||
      payload.value || (fromSelection ? '' : context.form[customerNameField] || context.state.followupCustomerName || '')
  }
}

async function resolveFollowupCustomer(context, requireUnique = false) {
  const current = selectedCustomer(context)
  const normalizedId = String(current.id || '').trim()
  const normalizedName = String(current.name || '').trim()
  if (normalizedId) return { id: normalizedId, name: normalizedName }
  if (!normalizedName) {
    if (requireUnique) throw new Error('请选择客户')
    return { id: '', name: '' }
  }

  const result = await V8.FormEngine.GetTableData(CUSTOMER_TABLE, {
    _Where: [['KehuMC', '=', normalizedName]],
    _SelectFields: ['Id', 'KehuMC'],
    _PageIndex: 1,
    _PageSize: 2
  })
  if (!result || Number(result.Code) !== 1) {
    if (requireUnique) throw new Error((result && result.Msg) || '客户关联信息加载失败')
    return { id: '', name: normalizedName }
  }
  const rows = Array.isArray(result.Data) ? result.Data : []
  if (rows.length !== 1) {
    if (requireUnique) {
      throw new Error(rows.length > 1 ? '存在同名客户，请重新选择客户' : '未找到所选客户，请重新选择')
    }
    return { id: '', name: normalizedName }
  }
  return {
    id: String(personValue(rows[0], ['Id', 'ID', 'id']) || '').trim(),
    name: String(personValue(rows[0], ['KehuMC', 'Name', 'name']) || normalizedName).trim()
  }
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
    // zhy：联系人按平台对象数组契约保存数据源返回的完整行；兼容历史纯 Id 数组。
    normalizeFollowupContactSelection(context, rows)
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
  if (!String((context.defaultValues || {})[timeName] || '').trim()) {
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
  const editableLocationForm = (isCustomerForm(context) || isCustomerAddressForm(context)) &&
    ['Add', 'Edit'].includes(context.mode)
  if (!editableLocationForm || context.state.locating) return
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

// 对齐 PC 端安装位置 InFormV8：设备编号统一由接口引擎生成，客户端不自行拼号。
async function initializeInstallationPositionCode(context) {
  if (!isInstallationPositionAdd(context) || context.state.installationCodeInitializing) return

  const codeField = installationPositionCodeField(context)
  context.state.installationCodeField = codeField
  if (context.state.installationCodeInitialized) {
    if (context.state.installationCodeValue) {
      context.patchForm({ [codeField]: context.state.installationCodeValue })
    }
    return
  }

  context.state.installationCodeInitializing = true
  try {
    let result
    try {
      result = await V8.ApiEngine.Run(INSTALLATION_POSITION_CODE_ENGINE, { Batch: 1 })
    } catch (error) {
      result = await V8.ApiEngine.RunLegacy(INSTALLATION_POSITION_CODE_ENGINE, { Batch: 1 })
    }
    if (result && Number(result.Code) === 0) {
      result = await V8.ApiEngine.RunLegacy(INSTALLATION_POSITION_CODE_ENGINE, { Batch: 1 })
    }

    const generatedCode = result && result.Data !== undefined && result.Data !== null
      ? String(result.Data).trim()
      : ''
    if (!result || Number(result.Code) !== 1 || !generatedCode || generatedCode === '[object Object]') {
      throw new Error(result && result.Msg || '设备编号生成失败请重试！')
    }

    context.state.installationCodeValue = generatedCode
    context.state.installationCodeInitialized = true
    context.patchForm({ [codeField]: generatedCode })
    findFieldCopies(context, codeField).forEach((field) => {
      field.editable = false
      field.Readonly = true
    })
  } catch (error) {
    uni.showToast({
      title: error.message || error.Msg || '设备编号生成失败请重试！',
      icon: 'none'
    })
  } finally {
    context.state.installationCodeInitializing = false
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
    followupCustomerId: '',
    followupCustomerName: '',
    proposalInitialized: false,
    customerFollowScopeValues: {},
    orderInitialized: false,
    orderValues: {},
    orderSummaryValues: null,
    orderProductCooperationRequestId: 0,
    installationCodeInitialized: false,
    installationCodeInitializing: false,
    installationCodeField: '',
    installationCodeValue: ''
  }
}

export async function initialize(context) {
  await initializeInstallationPositionCode(context)
  // zhy：所有入口进入订单新增页时统一初始化，避免各页面分别维护相同逻辑。
  if (isOrderAdd(context) && !context.state.orderInitialized) {
    context.state.orderInitialized = true
    await initializeOrder(context)
  }
  if (isOrderForm(context)) await refreshDerivedValues(context)
  if (isProposalAdd(context) &&
    isEmptyFormValue(context.form[fieldName(context, PROPOSAL_FIELDS.installationPositionCount, '场所点位数量')])) {
    context.patchForm({
      [fieldName(context, PROPOSAL_FIELDS.installationPositionCount, '场所点位数量')]: 0
    })
  }
  if (isCustomerForm(context) && ['Add', 'Edit'].includes(context.mode)) {
    // zhy：新增、编辑客户统一按负责人归一跟进状态，兼容历史记录状态为空的情况。
    applyCustomerFollowScope(context)
  }
  if ((isCustomerAdd(context) || isCustomerAddressAdd(context)) &&
    !context.state.locationInitialized) {
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
  if (isFollowupForm(context)) {
    // zhy：新增时初始化默认值；新增、编辑和详情都加载联系人选项，避免详情直接显示联系人 Id。
    if (isFollowupAdd(context) && !context.state.followupInitialized) {
      context.state.followupInitialized = true
      initializeFollowup(context)
    }
    const customer = await resolveFollowupCustomer(context)
    context.state.followupCustomerId = customer.id
    context.state.followupCustomerName = customer.name
    if (customer.id) {
      context.patchForm({
        [fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')]: customer.id
      })
    }
    await loadFollowupContacts(context, customer.id)
  }
  if (isCustomerCareForm(context)) {
    context.patchForm(customerCareTotalValues(context))
    await loadCustomerCareContacts(context)
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

// zhy：客户方案的场所点位数量始终取安装点位子表接口返回的完整总数，空子表显示 0。
export async function handleRelatedCount(context, payload = {}) {
  if (!isProposalForm(context) || payload.filtered || !isProposalInstallationChild(payload.field)) return
  const count = Number(payload.count)
  const field = fieldName(context, PROPOSAL_FIELDS.installationPositionCount, '场所点位数量')
  const value = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (Number(context.form[field] || 0) === value) return
  // zhy：已保存方案的子表发生变化后直接持久化派生数量；写入固定值可安全重试且不会新增主表。
  if (context.rowId) {
    const result = await V8.FormEngine.UptFormData(PROPOSAL_TABLE, {
      Id: context.rowId,
      [field]: value,
      _InvokeType: 'Client'
    })
    if (!result || Number(result.Code) !== 1) {
      throw new Error((result && result.Msg) || '场所点位数量同步失败')
    }
  }
  context.patchForm({ [field]: value })
}

export function getPresentation(context) {
  if (isCheckinAdd(context)) {
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
  if (isCustomerAddressForm(context)) {
    const latitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.latitude)
    const longitudeName = fieldName(context, CUSTOMER_LOCATION_FIELDS.longitude)
    const addressName = fieldName(context, CUSTOMER_LOCATION_FIELDS.address, '详细地址')
    const editable = context.mode !== 'View'
    return {
      location: {
        title: '地址定位',
        actionKey: editable ? 'xjy-customer-address-location' : '',
        actionLabel: context.state.locating ? '定位中…' : '重新定位',
        locating: Boolean(context.state.locating),
        latitude: Number(context.form[latitudeName] || 0),
        longitude: Number(context.form[longitudeName] || 0),
        address: String(context.form[addressName] || ''),
        emptyText: editable ? '点击选择地址位置' : '该地址暂未保存坐标'
      }
    }
  }
  return {}
}

export async function runPresentationAction(context, action) {
  if (action && action.key === 'xjy-checkin-location') {
    await locateCheckin(context, true)
    return { handled: true }
  }
  if (action && action.key === 'xjy-customer-address-location') {
    await locateCustomer(context, true)
    return { handled: true }
  }
  return { handled: false }
}

export function getFieldPresentation(context, field) {
  if (isOrderForm(context) && field &&
    String(field.Name || '').toLowerCase() === ORDER_FIELDS.renewalOrderNumber.toLowerCase()) {
    return {
      visible: String(context.form[orderFieldName(context, 'orderType', '订单类型')] || '') === ORDER_RENEWAL_TYPE
    }
  }
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

export function getRelatedPresentation(context, field) {
  if (!isCustomerForm(context) || !field || !field.layoutGroupKey) return {}
  const config = field.config || {}
  const title = [
    field.Label,
    field.Name,
    config.TableChildSysMenuName,
    config.TableChild?.Title
  ].filter(Boolean).join(' ')
  if (!/客户地址/.test(title)) return {}
  return {
    embedInLayoutGroup: true,
    displayMode: 'preview',
    previewLimit: 2
  }
}

export function getFieldActions(context, field) {
  if (!field) return []
  const name = String(field.Name || '').toLowerCase()
  const label = String(field.Label || '').trim()
  if (isCustomerForm(context) && ['Add', 'Edit'].includes(context.mode) &&
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
  // zhy：订单客户、负责人和安装人的选择联动统一在表单层处理，新增、编辑及不同入口均生效。
  if (isOrderForm(context) && payload && !payload.multiple) {
    const selectedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    const row = selectedRow(payload)
    if (selectedFieldName === ORDER_FIELDS.customerName.toLowerCase()) {
      const updates = orderCustomerValues(context, row, payload.cleared)
      updates[orderFieldName(context, 'customerName', '客户名称')] = payload.cleared
        ? ''
        : personValue(row, ['KehuMC', 'CustomerName', 'Name']) || payload.value || ''
      applyOrderValues(context, updates)
      return { handled: true }
    }
    if (selectedFieldName === ORDER_FIELDS.renewalOrderNumber.toLowerCase()) {
      // 平台保存订单编号文本而不是订单 Id，后续续签事件会按 DingdanBH 回查原订单。
      applyOrderValues(context, {
        [orderFieldName(context, 'renewalOrderNumber', '续签订单编号')]: payload.cleared
          ? ''
          : personValue(row, ['DingdanBH']) || payload.value || ''
      })
      return { handled: true }
    }
    const personnel = [
      {
        source: ORDER_FIELDS.owner,
        id: 'ownerId',
        phone: 'ownerPhone',
        idLabel: '负责人ID',
        phoneLabel: '负责人电话'
      },
      {
        source: ORDER_FIELDS.installer,
        id: 'installerId',
        phone: 'installerPhone',
        idLabel: '安装人Id',
        phoneLabel: '安装人电话'
      }
    ].find((item) => selectedFieldName === item.source.toLowerCase())
    if (personnel) {
      // zhy：人员选择器返回 sys_user 原始行，从中提取 Id、Phone 并同步到订单关联字段。
      applyOrderValues(context, {
        [orderFieldName(context, personnel.id, personnel.idLabel)]: payload.cleared
          ? ''
          : selectedPersonId(payload, row),
        [orderFieldName(context, personnel.phone, personnel.phoneLabel)]: payload.cleared
          ? ''
          : personValue(row, PERSON_PHONE_KEYS)
      })
      return { handled: true }
    }
  }
  if (isCustomerCareForm(context) && payload) {
    const selectedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    if (selectedFieldName === CUSTOMER_CARE_FIELDS.contact.toLowerCase()) {
      const rows = payload.multiple
        ? (Array.isArray(payload.raw) ? payload.raw : [])
        : payload.raw && typeof payload.raw === 'object'
          ? [payload.raw]
          : payload.option && payload.option.raw && typeof payload.option.raw === 'object'
            ? [payload.option.raw]
            : []
      context.patchForm({
        [fieldName(context, CUSTOMER_CARE_FIELDS.contactId, '客户联系人Id')]: payload.cleared
          ? ''
          : personValue(rows[0], ['Id', 'ID', 'id']),
        [fieldName(context, CUSTOMER_CARE_FIELDS.contact, '客户联系人')]: payload.cleared
          ? []
          : rows
      })
      return { handled: true }
    }
  }
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
  if (isFollowupForm(context) && payload && !payload.multiple) {
    // zhy：用户切换客户后同步客户 Id，清空旧联系人并重新加载该客户的联系人。
    const selectedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    if (selectedFieldName === FOLLOWUP_FIELDS.customerName.toLowerCase()) {
      let customer = selectedCustomer(context, payload)
      const customerIdName = fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')
      const customerNameField = fieldName(context, FOLLOWUP_FIELDS.customerName, '客户名称')
      context.state.followupCustomerId = String(customer.id || '').trim()
      context.state.followupCustomerName = String(customer.name || '').trim()
      context.patchForm({
        [customerIdName]: context.state.followupCustomerId,
        [customerNameField]: context.state.followupCustomerName
      })
      if (!context.state.followupCustomerId && context.state.followupCustomerName) {
        customer = await resolveFollowupCustomer(context)
        context.state.followupCustomerId = customer.id
        context.state.followupCustomerName = customer.name
        context.patchForm({
          [customerIdName]: customer.id,
          [customerNameField]: customer.name
        })
      }
      await loadFollowupContacts(context, context.state.followupCustomerId, true)
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

  if (link.idName && payload.cleared) {
    const idName = fieldName(context, link.idName)
    updates[idName] = ''
    submitValues[idName] = ''
  } else if (link.idName && personId !== '') {
    const idName = fieldName(context, link.idName)
    updates[idName] = personId
    submitValues[idName] = personId
  }

  if (isCustomerOwnerField(payload.field)) {
    Object.assign(updates, customerFollowScopeValues({
      ...context.form,
      ...updates,
      [CUSTOMER_FOLLOW_FIELDS.owner]: payload.cleared ? '' : payload.value
    }))
  }

  context.patchForm(updates)
  context.state.personnelValues = {
    ...(context.state.personnelValues || {}),
    ...submitValues
  }
  if (isCustomerOwnerField(payload.field)) {
    context.state.customerFollowScopeValues = customerFollowScopeValues({
      ...context.form,
      ...updates
    })
  }
  return { handled: true }
}

export async function handleFieldChange(context, payload) {
  if (isOrderProductForm(context) && payload &&
    String(payload.field && payload.field.Name || '').toLowerCase() === 'hezuofs') {
    return updateOrderProductCooperation(context, payload)
  }
  // 非续签订单必须清空历史续签编号，与平台订单类型字段事件保持一致。
  if (isOrderForm(context) && payload &&
    String(payload.field && payload.field.Name || '').toLowerCase() === ORDER_FIELDS.orderType.toLowerCase()) {
    if (String(payload.value || '') !== ORDER_RENEWAL_TYPE) {
      applyOrderValues(context, {
        [orderFieldName(context, 'renewalOrderNumber', '续签订单编号')]: ''
      })
    }
    return { handled: true }
  }
  // zhy：用户清空客户或人员时同步清空对应 Id、电话，避免提交残留的旧关联数据。
  if (isOrderForm(context) && payload && isEmptyFormValue(payload.value)) {
    const changedFieldName = String(payload.field && payload.field.Name || '').toLowerCase()
    if (changedFieldName === ORDER_FIELDS.customerName.toLowerCase()) {
      applyOrderValues(context, orderCustomerValues(context, {}, true))
      return { handled: true }
    }
    if (changedFieldName === ORDER_FIELDS.owner.toLowerCase()) {
      applyOrderValues(context, {
        [orderFieldName(context, 'ownerId', '负责人ID')]: '',
        [orderFieldName(context, 'ownerPhone', '负责人电话')]: ''
      })
      return { handled: true }
    }
    if (changedFieldName === ORDER_FIELDS.installer.toLowerCase()) {
      applyOrderValues(context, {
        [orderFieldName(context, 'installerId', '安装人Id')]: '',
        [orderFieldName(context, 'installerPhone', '安装人电话')]: ''
      })
      return { handled: true }
    }
  }
  if (isCustomerCareForm(context) && payload) {
    const fieldNameValue = String(payload.field && payload.field.Name || '').toLowerCase()
    if ([
      CUSTOMER_CARE_FIELDS.quantity.toLowerCase(),
      CUSTOMER_CARE_FIELDS.unitPrice.toLowerCase()
    ].includes(fieldNameValue)) {
      context.patchForm(customerCareTotalValues(context, {
        [payload.field.Name]: payload.value
      }))
      return { handled: true }
    }
  }
  if (isCustomerForm(context) && payload && isCustomerOwnerField(payload.field)) {
    const ownerName = fieldName(context, CUSTOMER_FOLLOW_FIELDS.owner, '负责人')
    const ownerIdName = fieldName(context, CUSTOMER_FOLLOW_FIELDS.ownerId)
    const ownerPhoneName = fieldName(context, CUSTOMER_FOLLOW_FIELDS.ownerPhone, '负责人电话')
    const ownerCleared = isEmptyFormValue(payload.value)
    const personnelValues = ownerCleared
      ? {
          [ownerIdName]: '',
          [ownerPhoneName]: ''
        }
      : {}
    context.state.personnelValues = {
      ...(context.state.personnelValues || {}),
      ...personnelValues
    }
    applyCustomerFollowScope(context, {
      ...personnelValues,
      [ownerName]: payload.value
    })
    return { handled: true }
  }
  if (!isProposalForm(context) || !payload ||
    !isProposalCalculationField(payload.field && payload.field.Name)) {
    return { handled: false }
  }
  // zhy：普通输入、开关及选项变化统一重算，避免只在设备型号下拉时更新成本。
  context.patchForm(calculateProposalCosts(context.form))
  return { handled: true }
}

export async function beforeSubmit(context) {
  if (isInstallationPositionAdd(context)) {
    const codeField = context.state.installationCodeField ||
      installationPositionCodeField(context)
    const codeValue = context.state.installationCodeValue || context.form[codeField]
    if (isEmptyFormValue(codeValue)) throw new Error('设备编号尚未生成，请重新进入页面后重试')
    // 只读字段不进入通用 editable 字段集合，必须作为受控额外值显式提交。
    return { [codeField]: codeValue }
  }
  // zhy：提交前补入隐藏关联字段，并为新增订单兜底默认值；编辑订单不覆盖历史值。
  if (isOrderForm(context)) {
    const values = { ...(context.state.orderValues || {}) }
    if (context.state.orderSummaryValues) {
      Object.assign(values, orderSummarySubmitValues(context.state.orderSummaryValues))
    }
    // 合同附件的上传状态是派生数据；小程序不会执行 PC 字段 V8，保存时按最终附件值统一回写。
    const attachmentName = orderFieldName(context, 'contractAttachment', '合同附件')
    const uploadStateName = orderFieldName(context, 'contractUploadState', '合同是否上传')
    values[uploadStateName] = normalizeUploadItems(context.form[attachmentName]).length
      ? '已上传'
      : '未上传'
    if (isOrderAdd(context)) {
      const defaults = {
        [orderFieldName(context, 'orderType', '订单类型')]: '老客户新增订单',
        [orderFieldName(context, 'orderDate', '下单日期')]: currentDate(),
        [orderFieldName(context, 'contractState', '合同状态')]: '未断约',
        [orderFieldName(context, 'renewalState', '订单是否续签')]: '未续签'
      }
      Object.entries(defaults).forEach(([name, value]) => {
        if (isEmptyFormValue(context.form[name]) && isEmptyFormValue(values[name])) values[name] = value
      })
    }
    if (String(context.form[orderFieldName(context, 'orderType', '订单类型')] || '') !== ORDER_RENEWAL_TYPE) {
      values[orderFieldName(context, 'renewalOrderNumber', '续签订单编号')] = ''
    }
    return values
  }
  if (context.state.locating) throw new Error('正在获取位置，请稍候')
  if (isCustomerForm(context)) {
    // zhy：隐藏状态字段也必须提交，最终负责人为空时写公海/2，否则写私有/1。
    const personnelValues = context.state.personnelValues || {}
    const followScopeValues = customerFollowScopeValues({
      ...context.form,
      ...personnelValues
    })
    return {
      ...(isCustomerAdd(context) ? context.state.locationValues : {}),
      ...personnelValues,
      ...followScopeValues
    }
  }
  if (isCustomerAddressForm(context)) {
    return {
      ...(context.state.locationValues || {})
    }
  }
  if (isCustomerCareForm(context)) {
    return customerCareTotalValues(context)
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
  if (isFollowupForm(context)) {
    // zhy：KehuID 是隐藏字段，不会进入通用 visible fields 保存列表，提交前必须显式补入。
    const contactField = findField(context, FOLLOWUP_FIELDS.contacts, '联系人')
    const contactRows = contactField && Array.isArray(contactField.options)
      ? contactField.options.map((option) => option.raw).filter(Boolean)
      : []
    normalizeFollowupContactSelection(context, contactRows, true)
    const customer = await resolveFollowupCustomer(context, true)
    const customerIdName = fieldName(context, FOLLOWUP_FIELDS.customerId, '客户Id')
    const customerNameField = fieldName(context, FOLLOWUP_FIELDS.customerName, '客户名称')
    const customerTransferName = fieldName(context, 'KehuMCCD', '客户名称（传递）')
    context.state.followupCustomerId = customer.id
    context.state.followupCustomerName = customer.name
    return {
      [customerIdName]: customer.id,
      [customerNameField]: customer.name,
      [customerTransferName]: customer.name
    }
  }
  if (isProposalForm(context)) {
    // zhy：保存前再次按最终表单值计算，确保落库金额与页面输入一致。
    return calculateProposalCosts(context.form)
  }
  return {}
}

export async function refreshDerivedValues(context) {
  if (!isOrderForm(context)) return {}
  const orderId = context.rowId || context.form.Id || context.defaultValues?.Id || ''
  const values = await loadOrderSummaryValues(orderId)
  context.state.orderSummaryValues = values
  context.patchForm(values)
  return values
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
  getRelatedPresentation,
  getFieldActions,
  runFieldAction,
  handleFieldChange,
  handleFieldSelect,
  handleRelatedCount,
  refreshDerivedValues,
  beforeSubmit,
  afterSubmit,
  getBusyMessage,
  dispose
}
