import assert from 'node:assert/strict'
import {
  buildFallbackHomeMetrics,
  buildHomeTodoItems,
  buildScopedReminderStorageKey,
  formatHomeTodoTime
} from '../src/platform/home-todo.mjs'

const now = new Date(2026, 7, 31, 9, 0, 0).getTime()
const reminders = [
  { Id: 'pending-1', Title: '客户需求确认', CustomerName: '客户管理', RemindTime: '2026-08-31 10:00:00', Done: false },
  { Id: 'done-1', Title: '月度工作汇报', RemindTime: '2026-08-30 18:00:00', Done: true }
]
const notices = [{ Key: 'notice-1', Label: '项目启动会准备', Description: '项目管理', Tone: 'warning' }]

const rows = buildHomeTodoItems({ reminders, noticeActions: notices, nowValue: now, limit: 3 })
assert.equal(rows.length, 2)
assert.equal(rows[0].type, 'notice')
assert.equal(rows[1].title, '客户需求确认')
assert.equal(rows[1].timeLabel, '今天 10:00')
assert.equal(formatHomeTodoTime('2026-09-01 08:30:00', now), '明天 08:30')

const metrics = buildFallbackHomeMetrics({ reminders, noticeActions: notices })
assert.deepEqual(metrics.map((item) => item.label), ['待办事项', '进行中', '已完成', '完成率'])
assert.deepEqual(metrics.map((item) => item.value), [2, 1, 1, '50%'])

const firstScope = buildScopedReminderStorageKey({ profileId: 'microi', apiBase: 'https://api-a.example', osClient: 'tenant-a', identity: 'user-1' })
const secondTenant = buildScopedReminderStorageKey({ profileId: 'microi', apiBase: 'https://api-a.example', osClient: 'tenant-b', identity: 'user-1' })
const secondEndpoint = buildScopedReminderStorageKey({ profileId: 'microi', apiBase: 'https://api-b.example', osClient: 'tenant-a', identity: 'user-1' })
assert.notEqual(firstScope, secondTenant)
assert.notEqual(firstScope, secondEndpoint)
assert.match(firstScope, /^mci:microi:reminders:v2:/)

console.log('[home-todo] PASS: truthful metrics, todo rows, time labels and endpoint scope')
