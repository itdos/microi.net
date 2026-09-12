const SUPPORTED_PERIODS = new Set([
  'all', 'today', 'week', 'month', 'quarter', 'year', 'lastYear', 'custom'
])

function decodeRouteValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try { return decodeURIComponent(text) } catch (error) { return text }
}

function normalizeDate(value) {
  const text = decodeRouteValue(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

// 统计入口必须以本次显式筛选为准，不能被目标列表之前保留的页面快照覆盖。
export function readListEntryPeriod(options = {}, fallbackPeriod = 'all') {
  const fallback = SUPPORTED_PERIODS.has(fallbackPeriod) ? fallbackPeriod : 'all'
  const requestedPeriod = decodeRouteValue(options.period)
  let period = SUPPORTED_PERIODS.has(requestedPeriod) ? requestedPeriod : fallback
  const customStart = normalizeDate(options.customStart)
  const customEnd = normalizeDate(options.customEnd)
  if (period === 'custom' && (!customStart || !customEnd || customStart > customEnd)) period = fallback
  return {
    period,
    customStart: period === 'custom' ? customStart : '',
    customEnd: period === 'custom' ? customEnd : '',
    forceFresh: decodeRouteValue(options.from) === 'performance-stats'
  }
}

