export const defaultPeriod = 'month'

export const periodOptions = [
  { label: '本日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本季', value: 'quarter' },
  { label: '本年', value: 'year' },
  { label: '去年', value: 'lastYear' }
]

const pad = value => `${value}`.padStart(2, '0')

export const formatDate = date => {
  const current = new Date(date)
  return `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
}

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const endOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const resolvePeriodRange = (period = defaultPeriod, baseDate = new Date()) => {
  const now = startOfDay(baseDate)
  let start = now
  let end = endOfDay(now)

  if (period === 'week') {
    const weekDay = now.getDay() || 7
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekDay + 1)
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else if (period === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    start = new Date(now.getFullYear(), quarterStartMonth, 1)
    end = new Date(now.getFullYear(), quarterStartMonth + 3, 0)
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1)
    end = new Date(now.getFullYear(), 11, 31)
  } else if (period === 'lastYear') {
    start = new Date(now.getFullYear() - 1, 0, 1)
    end = new Date(now.getFullYear() - 1, 11, 31)
  }

  return {
    period,
    start: formatDate(start),
    end: formatDate(end)
  }
}

export const normalizeDateRange = range => {
  if (!Array.isArray(range) || range.length < 2 || !range[0] || !range[1]) {
    return []
  }
  return [formatDate(range[0]), formatDate(range[1])]
}
