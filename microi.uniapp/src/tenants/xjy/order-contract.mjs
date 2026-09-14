export const ORDER_CONTRACT_ACTIVE = '未断约'
export const ORDER_CONTRACT_ENDED = '已断约'

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row && row[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function cloneValue(value) {
  return Array.isArray(value) ? [...value] : (value ?? '')
}

// 客户与订单使用不同的人员字段名；先生成语义值，再由表单扩展映射到真实订单字段。
export function orderCustomerSourceValues(row = {}, cleared = false) {
  if (cleared) {
    return Object.fromEntries([
      'customerId', 'customerName', 'contact', 'contactPhone', 'city', 'address',
      'owner', 'ownerId', 'ownerPhone', 'serviceAgent', 'serviceAgentId',
      'serviceAgentPhone', 'afterSales', 'afterSalesId', 'afterSalesPhone'
    ].map((key) => [key, '']))
  }
  return {
    customerId: firstValue(row, ['Id', 'ID', 'id', 'KehuID', 'KehuId']),
    customerName: firstValue(row, ['KehuMC', 'CustomerName', 'Name']),
    contact: firstValue(row, ['LianxiR']),
    contactPhone: firstValue(row, ['LianxiDH']),
    city: cloneValue(row.Chengshi),
    address: firstValue(row, ['XiangxiDZ']),
    owner: firstValue(row, ['FuzeR', 'YewuY']),
    ownerId: firstValue(row, ['FuzeRID', 'YewuYID']),
    ownerPhone: firstValue(row, ['FuzeRDH', 'YewuYDH']),
    serviceAgent: firstValue(row, ['ZhuanshuKF', 'ZhaunshuKF']),
    serviceAgentId: firstValue(row, ['ZhuanshuKFID', 'ZhaunshuKFID']),
    serviceAgentPhone: firstValue(row, ['ZhuanshuKFDH']),
    afterSales: firstValue(row, ['ShouhouRY']),
    afterSalesId: firstValue(row, ['ShouhouRYID']),
    afterSalesPhone: firstValue(row, ['ShouhouRYDH'])
  }
}

export function localDateText(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function normalizeContractDate(value) {
  if (value instanceof Date) return localDateText(value)
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

// 合同结束日当天仍有效，从次日开始进入“已断约”，与后端每日校准口径保持一致。
export function contractStateByEndDate(endDate, today = localDateText()) {
  const normalizedEndDate = normalizeContractDate(endDate)
  const normalizedToday = normalizeContractDate(today)
  return normalizedEndDate && normalizedToday && normalizedEndDate < normalizedToday
    ? ORDER_CONTRACT_ENDED
    : ORDER_CONTRACT_ACTIVE
}
