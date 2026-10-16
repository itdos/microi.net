export const ORDER_CONTRACT_TOTALS_ENGINE = 'xjy-order-contract-totals'

export function orderContractTotalsSupported(table) {
  return String(table || '').trim().toLowerCase() === 'diy_dingdan'
}

// 统计只提交菜单与筛选；完整授权范围、日期和商品金额由服务端计算。
export async function loadOrderListSummary({ menuId, filters = {}, selectedStatus = '', validOnly = true, run } = {}) {
  if (!menuId || typeof run !== 'function') throw new Error('缺少订单统计授权上下文')
  const response = await run(ORDER_CONTRACT_TOTALS_ENGINE, {
    SysMenuId: menuId, Filters: { ...filters, SelectedStatus: selectedStatus, ValidOnly: validOnly }
  })
  if (Number(response?.Code) !== 1) throw new Error(response?.Msg || '订单金额统计加载失败')
  const metrics = response.Data?.Metrics
  const statusCounts = response.Data?.StatusCounts
  if (!metrics || !statusCounts || !Number.isInteger(statusCounts.All) || statusCounts.All < 0 ||
      Object.values(statusCounts).some(value => !Number.isInteger(value) || value < 0)) throw new Error('订单统计响应不完整')
  const warnings = []
  for (const [key, label] of Object.entries({ rental: '租赁', buyout: '买断', annualFilter: '换芯', sum: '订单金额' })) {
    if (metrics[key] === null || metrics[key] === undefined || metrics[key] === '' || !Number.isFinite(Number(metrics[key]))) throw new Error('订单金额统计响应不完整')
    const missing = response.Data?.IncompleteMetrics?.[key]
    if (Number.isInteger(missing) && missing > 0) warnings.push(`${label}${missing}项待核对，合计仅含已获取金额`)
  }
  return { metrics, statusCounts, warning: warnings.join('；') }
}
