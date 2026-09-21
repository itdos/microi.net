import assert from 'node:assert/strict'
import { buildTaskTimeline, formatTaskLoadError } from '../src/tenants/xjy/task-detail-presentation.mjs'

const format = (value) => `fmt:${value}`

const pending = buildTaskTimeline({ state: '待评价', UpdateTime: 'wrong', PingjiaSJ: '' }, format)
assert.equal(pending[4].current, true)
assert.equal(pending[5].active, false)
assert.equal(pending[5].time, '')

const ended = buildTaskTimeline({ state: '已结束', UpdateTime: 'wrong', PingjiaSJ: '2026-09-04 12:00:00' }, format)
assert.equal(ended[5].current, true)
assert.equal(ended[5].time, 'fmt:2026-09-04 12:00:00')

const missingDetail = "NoExistData <br>表名：Diy_ShouhouDD<br>条件：WHERE A.`Id`='missing' AND A.`IsDeleted` <> 1"
const missingError = Object.assign(new Error(missingDetail), { code: 2 })
assert.equal(formatTaskLoadError(missingError), `该售后任务已不存在，可能已被删除或归档\n${missingDetail}`)

const permissionError = Object.assign(new Error('无权查看该任务'), { code: 0 })
assert.equal(formatTaskLoadError(permissionError), '无权查看该任务')

console.log('task detail presentation tests: 4/4')
