import { CUSTOMER_CONTRACT_TOTALS_ENGINE } from './customer-contract-totals.mjs'

// 共用客户卡片的合同汇总口径；分页、权限与金额计算全部由后端处理。
export async function loadCustomerListSummary({ menuId, filters = {}, selectedStatus = '', validOnly = true, run } = {}) {
  if (!menuId || typeof run !== 'function') throw new Error('缺少客户统计授权上下文')
  const response = await run(CUSTOMER_CONTRACT_TOTALS_ENGINE, {
    Summary: true, SysMenuId: menuId,
    Filters: { ...filters, SelectedStatus: selectedStatus, ValidOnly: validOnly }
  })
  if (Number(response?.Code) !== 1) throw new Error(response?.Msg || '客户金额统计加载失败')
  const metrics = response.Data?.Metrics
  const statusCounts = response.Data?.StatusCounts
  const incomplete = response.Data?.IncompleteMetrics || {}
  const warnings = []
  if (!metrics || !statusCounts || !Number.isInteger(statusCounts.All) || statusCounts.All < 0) throw new Error('客户统计响应不完整')
  for (const key of ['rental', 'buyout', 'annualFilter']) {
    const label = { rental: '租赁', buyout: '买断', annualFilter: '换芯' }[key]
    if (metrics[key] !== null && Number.isInteger(incomplete[key]) && incomplete[key] > 0) {
      warnings.push(`${label}${incomplete[key]}项待核对，合计仅含已获取金额`)
    }
    if (metrics[key] === null && Number.isInteger(incomplete[key]) && incomplete[key] > 0) {
      warnings.push(`${label}${incomplete[key]}项金额待核对`)
      metrics[key] = '-'
      continue
    }
    if (metrics[key] === null || metrics[key] === undefined || metrics[key] === '' || !Number.isFinite(Number(metrics[key]))) throw new Error('客户金额统计响应不完整')
  }
  if (Object.values(statusCounts).some(value => !Number.isInteger(value) || value < 0)) throw new Error('客户状态统计响应不完整')
  return { metrics, statusCounts, warning: warnings.join('；') }
}
