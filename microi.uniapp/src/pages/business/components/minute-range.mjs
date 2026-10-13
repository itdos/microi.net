import { queryMonthValue } from '../../../platform/configured-read-api.mjs'

export function queryMonthDateBounds(value) {
  const month = queryMonthValue(value)
  const prefix = `${month.slice(0, 4)}-${month.slice(4)}`
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(4)), 0)).getUTCDate()
  return { first: `${prefix}-01`, last: `${prefix}-${last}` }
}

// 使用UTC只做日历运算，发送服务器本地时间字符串，避免手机时区改变所选分钟。
export function minuteRangeWhere(field, month, draft = {}) {
  const prefix = queryMonthDateBounds(month).first.slice(0, 7)
  const read = (key, label) => {
    const date = String(draft[`${key}Date`] || '')
    const time = String(draft[`${key}Time`] || '')
    if (!date && !time) return null
    if (!date || !time) throw new Error(`请选择完整的${label}日期和时间`)
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('时间格式无效')
    if (date.slice(0, 7) !== prefix) throw new Error('开始和结束时间须在所选月份内')
    const [year, mon, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const stamp = Date.UTC(year, mon - 1, day, hour, minute)
    if (new Date(stamp).getUTCDate() !== day) throw new Error('日期无效')
    return { stamp, text: `${date} ${time}:00` }
  }
  const start = read('start', '开始'), end = read('end', '结束')
  if (start && end && start.stamp > end.stamp) throw new Error('开始时间不能晚于结束时间')
  const where = []
  if (start) where.push({ Name: field, Type: '>=', Value: start.text })
  if (end) {
    // 结束分钟完整包含，跨小时、月底和年底由日历运算自动进位。
    const next = new Date(end.stamp + 60000).toISOString().slice(0, 19).replace('T', ' ')
    where.push({ Name: field, Type: '<', Value: next })
  }
  return where
}
