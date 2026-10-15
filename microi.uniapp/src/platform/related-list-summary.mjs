export function formatRelatedSummaryMoney(value) {
  const number = Number(value)
  const absolute = Math.abs(number)
  if (absolute >= 100000000) return `¥${(number / 100000000).toFixed(2).replace(/\.00$/, '')}亿`
  if (absolute >= 10000) return `¥${(number / 10000).toFixed(2).replace(/\.00$/, '')}万`
  return `¥${number.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

// 关联统计与列表共用父记录、筛选和授权链；状态单独传递，保留其它状态角标。
export async function loadRelatedListSummary({ config, menuId, filters, tableChildAuth, selectedStatus = '', validOnly = true, run }) {
  if (!config?.relatedSummary?.apiEngineKey || (!menuId && !tableChildAuth)) throw new Error('缺少关联统计授权上下文')
  const response = await run(config.relatedSummary.apiEngineKey, {
    SysMenuId: menuId || '',
    ...(tableChildAuth ? { _TableChildAuth: tableChildAuth } : {}),
    Filters: { ...filters, SelectedStatus: selectedStatus, ValidOnly: validOnly }
  })
  if (Number(response?.Code) !== 1) throw new Error(response?.Msg || '关联统计加载失败')
  const { Metrics: metrics, StatusCounts: statusCounts, IncompleteMetrics: incomplete = {} } = response.Data || {}
  if (!metrics || !statusCounts || !Number.isInteger(statusCounts.All) || statusCounts.All < 0 ||
      Object.values(statusCounts).some(value => !Number.isInteger(value) || value < 0)) throw new Error('关联统计响应不完整')
  const warnings = []
  for (const metric of config.relatedMetrics || []) {
    const value = metrics[metric.key]
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) throw new Error('关联金额响应不完整')
    if (Number.isInteger(incomplete[metric.key]) && incomplete[metric.key] > 0) warnings.push(`${metric.label}${incomplete[metric.key]}项待核对，合计仅含已获取金额`)
  }
  return { metrics, statusCounts, warning: warnings.join('；') }
}
