function finiteCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function normalizeTimes(value) {
  const rows = Array.isArray(value) ? value : []
  return rows.map((item) => String(item || '').trim().replace('T', ' ')).filter(Boolean)
}

function normalizeRecords(value) {
  const rows = Array.isArray(value) ? value : []
  return rows.map((item) => {
    if (!item || typeof item !== 'object') return null
    const id = String(item.Id ?? item.id ?? '').trim()
    const time = String(item.Time ?? item.time ?? item.DakaSJ ?? item.CreateTime ?? '').trim().replace('T', ' ')
    return time ? { id, time } : null
  }).filter(Boolean)
}

export function normalizeCheckinStatistics(result) {
  const payload = result && typeof result === 'object' && !Array.isArray(result) && result.Data !== undefined
    ? result.Data
    : result
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { count: finiteCount(payload), times: [], records: [] }
  }
  const apiRecords = normalizeRecords(payload.Records ?? payload.records ?? payload.SignRecords ?? payload.signRecords)
  const apiTimes = normalizeTimes(payload.Times ?? payload.times ?? payload.SignTimes ?? payload.signTimes)
  const records = apiRecords.length
    ? apiRecords
    : apiTimes.map((time) => ({ id: '', time }))
  const times = apiTimes.length ? apiTimes : records.map((item) => item.time)
  return {
    count: finiteCount(payload.Count ?? payload.count ?? payload.DataCount ?? payload.total ?? records.length),
    times,
    records
  }
}

export function checkinTimeLabel(value) {
  const text = String(value || '').trim().replace('T', ' ')
  const match = text.match(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?:$|\s)/)
  return match ? match[1] : text
}

export function checkinDetailFormOptions(record) {
  const rowId = String(record && (record.id ?? record.Id) || '').trim()
  if (!rowId) return null
  return {
    table: 'Diy_location',
    rowId,
    mode: 'View',
    title: '打卡详情',
    menuAliases: ['打卡记录', '拜访打卡', '打卡'],
    includeRelated: false
  }
}
