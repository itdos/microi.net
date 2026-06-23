export const periodLabelMap = {
  today: '本日',
  week: '本周',
  month: '本月',
  quarter: '本季',
  year: '本年',
  lastYear: '去年',
  custom: '自定义',
}

const periodTitlePattern = /^(今日|今天|本日|本周|本月|本季|本年|去年)/
const monthTitlePattern = /^月(?=\S)/

export const getPeriodLabel = period => periodLabelMap[period] || periodLabelMap.month

export const getDataJsonPeriod = dataJson => {
  const searchData = Array.isArray(dataJson?.searchData) ? dataJson.searchData : []
  const periodItem = searchData.find(item => item?.prop === 'period' || item?.prop === '_period')
  return periodItem?.value || 'month'
}

export const formatPeriodTitle = (title, period = 'month') => {
  if (typeof title !== 'string') return title
  const text = title.trim()
  if (!text) return title
  const label = getPeriodLabel(period)

  if (periodTitlePattern.test(text)) {
    return text.replace(periodTitlePattern, label)
  }

  if (monthTitlePattern.test(text)) {
    return text.replace(monthTitlePattern, label)
  }

  return title
}
