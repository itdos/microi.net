function text(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function safeScopePart(value, fallback) {
  return encodeURIComponent(text(value).toLowerCase() || fallback)
}

export function buildScopedReminderStorageKey(input = {}) {
  const profile = safeScopePart(input.profileId, 'default')
  const endpoint = safeScopePart(input.apiBase, 'no-endpoint')
  const osClient = safeScopePart(input.osClient, 'no-tenant')
  const identity = safeScopePart(input.identity, 'guest')
  return `mci:${profile}:reminders:v2:${endpoint}:${osClient}:${identity}`
}

function reminderTimestamp(value) {
  const source = text(value)
  const matched = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(source)
  if (matched) {
    return new Date(
      Number(matched[1]),
      Number(matched[2]) - 1,
      Number(matched[3]),
      Number(matched[4] || 0),
      Number(matched[5] || 0),
      Number(matched[6] || 0)
    ).getTime()
  }
  const fallback = new Date(source).getTime()
  return Number.isFinite(fallback) ? fallback : Number.POSITIVE_INFINITY
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatHomeTodoTime(value, nowValue = Date.now()) {
  const timestamp = reminderTimestamp(value)
  if (!Number.isFinite(timestamp)) return ''
  const now = Number(nowValue)
  const date = new Date(timestamp)
  if (timestamp < now) return '已超时'
  const offset = startOfDay(timestamp) - startOfDay(now)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (offset === 0) return `今天 ${time}`
  if (offset === 86400000) return `明天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function normalizeReminder(row, nowValue) {
  if (!row || row.Done || !text(row.Id) || !text(row.Title)) return null
  const timestamp = reminderTimestamp(row.RemindTime)
  return {
    key: `reminder:${text(row.Id)}`,
    type: 'reminder',
    title: text(row.Title),
    subtitle: text(row.CustomerName || row.Content) || '个人提醒',
    timeLabel: formatHomeTodoTime(row.RemindTime, nowValue),
    tone: timestamp < Number(nowValue) ? 'danger' : 'neutral',
    timestamp,
    reminder: row
  }
}

function normalizeNotice(action, index) {
  if (!action || !text(action.Key || action.Label)) return null
  return {
    key: `notice:${text(action.Key || index)}`,
    type: 'notice',
    title: text(action.Label) || '待处理事项',
    subtitle: text(action.Description || action.Desc) || '点击查看并处理',
    timeLabel: text(action.TimeLabel || action.DeadlineLabel),
    tone: text(action.Tone).toLowerCase() || 'primary',
    timestamp: Number.POSITIVE_INFINITY,
    action
  }
}

export function buildHomeTodoItems(input = {}) {
  const nowValue = Number(input.nowValue || Date.now())
  const reminders = (Array.isArray(input.reminders) ? input.reminders : [])
    .map((row) => normalizeReminder(row, nowValue))
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp)
  const notices = (Array.isArray(input.noticeActions) ? input.noticeActions : [])
    .map(normalizeNotice)
    .filter(Boolean)
  const limit = Math.max(1, Math.min(6, Number(input.limit || 3)))
  return [...notices, ...reminders].slice(0, limit)
}

export function buildFallbackHomeMetrics(input = {}) {
  const reminders = Array.isArray(input.reminders) ? input.reminders.filter((row) => row && row.Id) : []
  const notices = Array.isArray(input.noticeActions) ? input.noticeActions.filter(Boolean) : []
  const pending = reminders.filter((row) => !row.Done).length
  const completed = reminders.filter((row) => row.Done).length
  const loadingValue = input.loading ? '—' : null
  const completionRate = reminders.length ? `${Math.round((completed / reminders.length) * 100)}%` : '—'
  return [
    { key: 'pending', label: '待办事项', value: loadingValue ?? pending + notices.length },
    { key: 'processing', label: '进行中', value: loadingValue ?? notices.length },
    { key: 'completed', label: '已完成', value: loadingValue ?? completed },
    { key: 'completion-rate', label: '完成率', value: loadingValue ?? completionRate }
  ]
}

export default {
  buildFallbackHomeMetrics,
  buildHomeTodoItems,
  buildScopedReminderStorageKey,
  formatHomeTodoTime
}
