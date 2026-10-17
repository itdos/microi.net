// 续签继续使用合同表单及服务端受控草稿；此处只维护移动端交互，不推断真实设备绑定。
export const ORDER_RENEWAL_TYPE = '老客户续签订单'
export const ORDER_DRAFT_ENGINE = 'xjy-order-draft'
export const ORDER_RENEWAL_ENGINE = 'xjy-order-renewal'

const text = value => String(value ?? '').trim()
const tableName = context => text(context.tableName).toLowerCase()
const sourceFields = new Set(['kehumc', 'kehuid', 'xqdingdanid', 'xqdingdanbh', 'xinldd'])
const serviceDates = new Set(['fuwukssj', 'fuwujssj', 'hetongkssj', 'hetongjssj', 'renewaltermmonths'])
const reusedPositionFields = [
  'DingdanSPID', 'ShangpinID', 'ShangpinXH', 'ShangpinBH', 'DeviceUseType',
  'ReuseKehuSBID', 'SourcePositionID', 'IoTDeviceId', 'IoTDeviceNames'
]
const reusedPositionReadonly = new Set(reusedPositionFields.map(name => name.toLowerCase()))
const iotPositionActions = new Set(['xuanzeiot', 'xinzengiot', 'jiechuiot'])

export function isRenewalOrder(form = {}) {
  return text(form.XinLDD) === ORDER_RENEWAL_TYPE || Boolean(text(form.XQDingdanID))
}

export function isInitializedRenewalOrder(form = {}) {
  return isRenewalOrder(form) && Number(form.RenewalInitialized) === 1
}

export function isReusedInstallationPosition(form = {}) {
  return Boolean(text(form.ReuseKehuSBID)) || text(form.DeviceUseType) === 'Reuse'
}

function validDay(value) {
  const day = text(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : ''
}

// 与服务端相同：按日历月夹紧月末，再减一天；不把一年当作固定 365 天。
export function renewalDateValues(form = {}) {
  if (!isRenewalOrder(form) || text(form.RenewalTermMonths) === '') return {}
  const months = Number(form.RenewalTermMonths)
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('续约月数须为 1 至 120 的整数')
  }
  const start = validDay(form.FuwuKSSJ)
  if (!start) return {}
  const date = new Date(`${start}T00:00:00Z`)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  date.setUTCDate(date.getUTCDate() - 1)
  const end = date.toISOString().slice(0, 10)
  const values = { FuwuJSSJ: end }
  // 用户明确设置了不同合同起点时，保留独立合同区间供其自行微调。
  if (validDay(form.HetongKSSJ) === start) values.HetongJSSJ = end
  return values
}

// 买断设备沿用时，仅服务模式不再次销售硬件；滤芯服务单价仍可修改。
export function renewalProductPriceValues(form = {}) {
  if (!text(form.RenewalSourceSPID) || text(form.RenewalChargeMode) !== 'Service') return {}
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
  return {
    ShebeiSJDJ: 0, Zongjia: 0, ShijiJG: 0, ShebeiYHFD: 0,
    LvxinZJ: Number((number(form.LvxinSJDJ) * number(form.Shuliang)).toFixed(2))
  }
}

// 只限制来源与真实设备身份，日期、联系人、点位说明、滤芯服务费用继续沿用普通订单表单。
export function renewalFieldPresentation(context = {}, fieldName = '') {
  const name = text(fieldName).toLowerCase()
  const form = context.form || {}
  if (tableName(context) === 'diy_dingdan') {
    if (name === 'renewaltermmonths') {
      return { visible: isRenewalOrder(form), ...(isInitializedRenewalOrder(form) && context.mode !== 'Add' && Number(form.DingdanZTZ) !== 1 ? { readonly: true } : {}) }
    }
    if (name === 'xqdingdanbh') {
      return { visible: isRenewalOrder(form), ...(isInitializedRenewalOrder(form) ? { readonly: true } : {}) }
    }
    if (isInitializedRenewalOrder(form) && sourceFields.has(name)) return { readonly: true }
    if (isInitializedRenewalOrder(form) && context.mode !== 'Add' && Number(form.DingdanZTZ) !== 1 && serviceDates.has(name)) {
      return { readonly: true }
    }
  }
  if (tableName(context) === 'diy_dingdansp') {
    const inherited = Boolean(text(form.RenewalSourceSPID))
    if (name === 'renewalchargemode') return { visible: inherited }
    if (inherited && ['shangpinid', 'shangpinmc', 'shebeibh'].includes(name)) return { readonly: true }
    if (inherited && text(form.RenewalChargeMode) === 'Service') {
      if (name === 'shebeisjdj') return { readonly: true }
      if (name === 'lvxinsjdj') return { readonly: false }
    }
  }
  if (tableName(context) === 'diy_shebeiwz' && isReusedInstallationPosition(form)) {
    if (iotPositionActions.has(name)) return { visible: false }
    if (name === 'yulansbxq') return { visible: true }
    if (reusedPositionReadonly.has(name)) return { readonly: true }
  }
  return {}
}

export function renewalPositionSubmitValues(form = {}) {
  if (!isReusedInstallationPosition(form)) return {}
  // 隐藏/只读的来源字段不由通用 editable 集合收集；最终真实性仍由服务端回读校验。
  return Object.fromEntries(reusedPositionFields.filter(name => form[name] !== undefined).map(name => [name, form[name]]))
}

function successful(result, message) {
  if (Number(result?.Code) !== 1) throw new Error(result?.Msg || message)
  return result
}

// 每个表单页面独享实例。Begin/Initialize 重入共用请求，不能因刷新覆盖已修改资料。
export function createOrderDraftLifecycle({ run } = {}) {
  if (typeof run !== 'function') throw new Error('订单草稿接口未配置')
  const entries = new Map()
  const entryFor = orderId => {
    const id = text(orderId)
    if (!/^[A-Za-z0-9-]{20,50}$/.test(id)) throw new Error('订单Id无效，请重新打开新增表单')
    if (!entries.has(id)) entries.set(id, { id, begun: false, attempted: false, closed: false, closing: false, committed: false, customer: '', source: '', result: null, pending: null, initializing: null, cancelling: null })
    return entries.get(id)
  }

  const begin = async ({ orderId, customerId = '' } = {}) => {
    const entry = entryFor(orderId)
    if (entry.closed || entry.closing || entry.committed) throw new Error('订单草稿已关闭，请重新新增订单')
    if (entry.pending) {
      await entry.pending
      return begin({ orderId, customerId })
    }
    if (entry.begun && entry.customer === text(customerId)) return entry.result
    entry.attempted = true
    entry.pending = (async () => {
      const result = successful(await run(ORDER_DRAFT_ENGINE, {
        Action: entry.begun ? 'Touch' : 'Begin', DingdanID: entry.id, KehuID: text(customerId)
      }), '订单草稿登记失败')
      if (text(result.Data?.Status) !== 'Active') throw new Error('订单草稿已关闭，请重新新增订单')
      entry.begun = true
      entry.customer = text(customerId)
      entry.result = result
      return result
    })()
    try { return await entry.pending } finally { entry.pending = null }
  }

  const initialize = async ({ orderId, customerId = '', sourceOrderId } = {}) => {
    const entry = entryFor(orderId)
    const source = text(sourceOrderId)
    if (entry.closed || entry.closing || entry.committed) throw new Error('订单草稿已关闭，请重新新增订单')
    if (!source || source === entry.id) throw new Error('请选择有效的原订单')
    if (entry.source && entry.source !== source) throw new Error('已初始化的续签订单不能更换原订单，请关闭后重新新增')
    if (entry.initializing) {
      await entry.initializing
      return initialize({ orderId, customerId, sourceOrderId })
    }
    if (entry.source) return { result: entry.initializedResult, defaults: {}, applyDefaults: false }
    entry.initializing = (async () => {
      await begin({ orderId, customerId })
      const result = successful(await run(ORDER_RENEWAL_ENGINE, {
        Action: 'Initialize', SourceOrderId: source, DingdanID: entry.id
      }), '续签订单初始化失败')
      entry.source = source
      entry.initializedResult = result
      return { result, defaults: result.Data?.Defaults || {}, applyDefaults: result.Data?.AlreadyInitialized !== true }
    })()
    try { return await entry.initializing } finally { entry.initializing = null }
  }

  const touch = async ({ orderId, customerId = '' } = {}) => {
    const entry = entryFor(orderId)
    if (entry.closed || entry.closing || entry.committed) return null
    await begin({ orderId, customerId })
    const result = successful(await run(ORDER_DRAFT_ENGINE, { Action: 'Touch', DingdanID: entry.id, KehuID: text(customerId) }), '订单草稿续期失败')
    if (text(result.Data?.Status) !== 'Active') throw new Error('订单草稿已失效，请重新新增订单')
    entry.result = result
    return result
  }

  const cancel = async orderId => {
    const entry = entryFor(orderId)
    if (entry.closed || entry.committed || !entry.attempted) return null
    if (entry.cancelling) return entry.cancelling
    entry.closing = true
    entry.cancelling = (async () => {
      // 退出时等待正在进行的初始化完成，避免 Cancel 先关闭草稿而初始化随后又写明细。
      try { await entry.initializing; await entry.pending } catch (_) { /* 失败请求仍可能已在服务端登记，继续取消。 */ }
      if (entry.committed) return null
      const result = successful(await run(ORDER_DRAFT_ENGINE, { Action: 'Cancel', DingdanID: entry.id }), '订单草稿取消失败')
      entry.closed = true
      return result
    })()
    try { return await entry.cancelling } finally { entry.cancelling = null; entry.closing = false }
  }

  // 原生订单 After 已在同一事务 Commit；客户端只记成功，绝不再创建第二次事务确认。
  const committed = orderId => { entryFor(orderId).committed = true }
  return { begin, initialize, touch, cancel, committed }
}
