const CHANGE_TYPE_META = Object.freeze({
  feature: { label: '新增', tone: 'feature' },
  new: { label: '新增', tone: 'feature' },
  improvement: { label: '优化', tone: 'improvement' },
  optimization: { label: '优化', tone: 'improvement' },
  optimize: { label: '优化', tone: 'improvement' },
  fix: { label: '修复', tone: 'fix' },
  bugfix: { label: '修复', tone: 'fix' },
  security: { label: '安全', tone: 'security' },
  breaking: { label: '重要变更', tone: 'breaking' },
  compatibility: { label: '兼容', tone: 'compatibility' },
  compatible: { label: '兼容', tone: 'compatibility' },
  '新增': { label: '新增', tone: 'feature' },
  '优化': { label: '优化', tone: 'improvement' },
  '修复': { label: '修复', tone: 'fix' },
  '安全': { label: '安全', tone: 'security' },
  '重要变更': { label: '重要变更', tone: 'breaking' },
  '兼容': { label: '兼容', tone: 'compatibility' }
})

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeCount(value, fallback) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.max(count, fallback) : fallback
}

export function getChangeTypeMeta(value) {
  const source = text(value)
  return CHANGE_TYPE_META[source] || CHANGE_TYPE_META[source.toLowerCase()] || {
    label: source || '更新',
    tone: 'default'
  }
}

export function normalizeChangeLogResponse(result) {
  const append = result && typeof result.DataAppend === 'object' && result.DataAppend
    ? result.DataAppend
    : {}
  const logs = (Array.isArray(append.ChangeLogs) ? append.ChangeLogs : []).map((row, index) => ({
    ...row,
    Id: text(row?.Id) || `change-log-${index}`,
    Version: text(row?.Version),
    Title: text(row?.Title),
    ChangeType: text(row?.ChangeType),
    Content: text(row?.Content),
    ReleaseTime: text(row?.ReleaseTime || row?.CreateTime),
    Sort: Number(row?.Sort || 0)
  }))
  const hasCapabilityFlag = Object.prototype.hasOwnProperty.call(append, 'ChangeLogAvailable')

  return {
    available: hasCapabilityFlag ? append.ChangeLogAvailable !== false : logs.length > 0,
    total: normalizeCount(append.ChangeLogCount, logs.length),
    logs
  }
}

export function formatChangeLogDate(value) {
  const source = text(value)
  if (!source) return '发布时间待补充'
  const matched = source.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/)
  if (!matched) return source
  const [, year, month, day, hour, minute] = matched
  const date = `${year}年${Number(month)}月${Number(day)}日`
  return hour === undefined ? date : `${date} · ${String(hour).padStart(2, '0')}:${minute}`
}

export function isSameAppVersion(left, right) {
  const normalize = value => text(value).replace(/^v/i, '').toLowerCase()
  const leftVersion = normalize(left)
  const rightVersion = normalize(right)
  return Boolean(leftVersion && rightVersion && leftVersion === rightVersion)
}
