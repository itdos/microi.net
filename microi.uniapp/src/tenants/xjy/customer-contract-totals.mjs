export const CUSTOMER_CONTRACT_TOTALS_ENGINE = 'xjy-customer-contract-totals'
export const CUSTOMER_CONTRACT_TOTALS_ROW_KEY = '__xjyContractTotals'
const TOTAL_PATHS = [['Rental', 'Current'], ['Rental', 'All'], ['Buyout', 'All'], ['AnnualFilter', 'Current'], ['AnnualFilter', 'All']]

export function customerContractTotalsSupported(table) {
  return String(table || '').trim().toLowerCase() === 'diy_kehu'
}

// 空值不是零价；金额由服务端统一归类和汇总，客户端只校验并展示返回值。
function amountValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null
}

export function formatCustomerContractMoney(value) {
  const amount = amountValue(value)
  if (amount === null) return '未获取'
  const [integer, fraction] = amount.toFixed(2).split('.')
  return `¥${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
}

export function buildCustomerContractGroups(state = {}) {
  const values = state?.values || {}
  return [
    { key: 'rental', title: '租赁总价', items: [
      { key: 'current', label: '当前有效合同期内', value: formatCustomerContractMoney(values.Rental?.Current) },
      { key: 'all', label: '所有合同', value: formatCustomerContractMoney(values.Rental?.All) }
    ] },
    { key: 'buyout', title: '买断总价', items: [
      { key: 'all', label: '所有合同', value: formatCustomerContractMoney(values.Buyout?.All) }
    ] },
    { key: 'annual-filter', title: '包年换芯总价', items: [
      { key: 'current', label: '当前有效合同期内', value: formatCustomerContractMoney(values.AnnualFilter?.Current) },
      { key: 'all', label: '所有合同', value: formatCustomerContractMoney(values.AnnualFilter?.All) }
    ] }
  ]
}

function normalizedCustomerIds(ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(value => String(value || '').trim()).filter(Boolean))]
  if (unique.length > 50) throw new Error('单次合同金额查询不能超过50个客户')
  if (unique.some(id => id.length > 128)) throw new Error('客户编号不合法')
  return unique
}

function unavailable(message) {
  return { status: 'unavailable', message: String(message || '合同金额暂未获取'), values: {} }
}

// 一页客户只调用一次聚合接口，真实客户菜单交给后端校验；不逐客户读取订单或商品。
export async function loadCustomerContractTotals({ customerIds = [], customerMenuId = '', run } = {}) {
  const ids = normalizedCustomerIds(customerIds)
  if (!ids.length) return {}
  if (!String(customerMenuId || '').trim()) throw new Error('缺少客户菜单授权上下文')
  if (typeof run !== 'function') throw new Error('合同金额查询不可用')
  const result = await run(CUSTOMER_CONTRACT_TOTALS_ENGINE, {
    CustomerIds: ids,
    CustomerSysMenuId: String(customerMenuId).trim()
  })
  if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '合同金额加载失败')
  const customers = result.Data?.Customers
  if (!customers || typeof customers !== 'object' || Array.isArray(customers)) throw new Error('合同金额响应不完整')
  return Object.fromEntries(ids.map(id => {
    if (!Object.prototype.hasOwnProperty.call(customers, id) || !customers[id] || typeof customers[id] !== 'object') {
      return [id, unavailable('当前客户的合同金额暂未获取')]
    }
    const source = customers[id]
    const values = {}
    let complete = true
    for (const [type, scope] of TOTAL_PATHS) {
      values[type] ||= {}
      values[type][scope] = amountValue(source[type]?.[scope])
      if (values[type][scope] === null) complete = false
    }
    return [id, {
      status: complete ? 'ready' : 'partial',
      values,
      message: complete ? '' : '部分合同金额未获取',
      asOf: String(result.Data.AsOf || ''),
      scope: String(result.Data.Scope || ''),
      explanation: String(result.Data.CurrentDefinition || '')
    }]
  }))
}

// 派生金额只挂在本页副本上，避免写入SDK查询缓存、表单业务字段或其它租户页面。
export async function hydrateCustomerContractTotals(rows = [], options = {}) {
  if (!customerContractTotalsSupported(options.table) || !rows.length) return rows
  let totals
  try {
    totals = await loadCustomerContractTotals({ ...options, customerIds: rows.map(row => row.Id) })
  } catch (error) {
    const state = unavailable(error?.message || error?.Msg)
    return rows.map(row => ({ ...row, [CUSTOMER_CONTRACT_TOTALS_ROW_KEY]: { ...state } }))
  }
  return rows.map(row => ({
    ...row,
    [CUSTOMER_CONTRACT_TOTALS_ROW_KEY]: totals[String(row.Id || '').trim()] || unavailable('缺少客户编号，合同金额暂未获取')
  }))
}
