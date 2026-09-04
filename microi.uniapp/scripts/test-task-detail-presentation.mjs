import assert from 'node:assert/strict'
import { buildTaskTimeline } from '../src/tenants/xjy/task-detail-presentation.mjs'

const format = (value) => `fmt:${value}`

const pending = buildTaskTimeline({ state: '待评价', UpdateTime: 'wrong', PingjiaSJ: '' }, format)
assert.equal(pending[4].current, true)
assert.equal(pending[5].active, false)
assert.equal(pending[5].time, '')

const ended = buildTaskTimeline({ state: '已结束', UpdateTime: 'wrong', PingjiaSJ: '2026-09-04 12:00:00' }, format)
assert.equal(ended[5].current, true)
assert.equal(ended[5].time, 'fmt:2026-09-04 12:00:00')

console.log('task detail presentation tests: 2/2')
