const pad = (value) => String(value).padStart(2, '0')

export function dateFilterSpec(type = 'date') {
  const key = String(type || 'date').toLowerCase()
  if (['year', 'years'].includes(key)) return { precision: 'year', dateFields: 'year', timeColumns: 0 }
  if (['month', 'months'].includes(key)) return { precision: 'month', dateFields: 'month', timeColumns: 0 }
  if (['hh:mm', 'hh:mm:ss'].includes(key)) return { precision: key.endsWith(':ss') ? 'second' : 'minute', dateFields: '', timeColumns: key.endsWith(':ss') ? 3 : 2 }
  if (key.startsWith('datetime')) return { precision: key === 'datetime_hh' ? 'hour' : key === 'datetime_hhmm' ? 'minute' : 'second', dateFields: 'day', timeColumns: key === 'datetime_hh' ? 1 : key === 'datetime_hhmm' ? 2 : 3 }
  return { precision: 'day', dateFields: 'day', timeColumns: 0 }
}

function parseBoundary(value, spec) {
  const parts = String(value).replace('T', ' ').split(' ')
  const date = spec.dateFields ? parts[0].split('-').map(Number) : [2000, 1, 1]
  const clock = spec.timeColumns ? String(spec.dateFields ? parts[1] || '' : parts[0]).split(':') : []
  const expected = spec.dateFields === 'year' ? 1 : spec.dateFields === 'month' ? 2 : 3
  if ((spec.dateFields && date.length !== expected) || clock.length !== spec.timeColumns || clock.some((part) => !/^\d{2}$/.test(part))) throw new Error('请按配置补全日期时间')
  const [year, month = 1, day = 1] = date
  const [hour = 0, minute = 0, second = 0] = clock.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (!Number.isFinite(parsed.getTime()) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw new Error('日期时间无效')
  return parsed
}

function formatBoundary(date, spec, physicalDate) {
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(pad)
  if (!spec.dateFields) return time.slice(0, spec.timeColumns).join(':')
  if (physicalDate) return `${day} ${time.join(':')}`
  if (spec.precision === 'year') return day.slice(0, 4)
  if (spec.precision === 'month') return day.slice(0, 7)
  return spec.timeColumns ? `${day} ${time.slice(0, spec.timeColumns).join(':')}` : day
}

export function dateFilterBounds(field, value) {
  const spec = field.date || dateFilterSpec()
  const physicalDate = /^(date|datetime|timestamp)(\W|$)/i.test(field.columnType || '')
  const start = value.start ? parseBoundary(value.start, spec) : null
  const end = value.end ? parseBoundary(value.end, spec) : null
  if (start && end && start > end) throw new Error('开始不能晚于结束')
  const result = []
  if (start) result.push({ Type: '>=', Value: formatBoundary(start, spec, physicalDate) })
  if (end) {
    // 结束值覆盖整个已选精度，使用下一单位的开区间，包含秒的小数部分。
    if (spec.precision === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1)
    else if (spec.precision === 'month') end.setUTCMonth(end.getUTCMonth() + 1)
    else end.setTime(end.getTime() + ({ day: 86400000, hour: 3600000, minute: 60000, second: 1000 }[spec.precision]))
    if (!spec.dateFields && end.getUTCDate() !== 1) result.push({ Type: '<', Value: spec.timeColumns === 3 ? '24:00:00' : '24:00' })
    else result.push({ Type: '<', Value: formatBoundary(end, spec, physicalDate) })
  }
  return result
}
