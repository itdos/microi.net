import assert from 'node:assert/strict'
import { buildTaskTimeline, formatTaskLoadError } from '../src/tenants/xjy/task-detail-presentation.mjs'

const format = (value) => `fmt:${value}`

const pending = buildTaskTimeline({ state: '待评价', UpdateTime: 'wrong', PingjiaSJ: '' }, format)
assert.equal(pending[4].current, true)
assert.equal(pending[3].time, '可随时验收')
assert.equal(pending[5].active, false)
assert.equal(pending[5].time, '')

const ended = buildTaskTimeline({ state: '已结束', UpdateTime: 'wrong', PingjiaSJ: '2026-09-04 12:00:00' }, format)
assert.equal(ended[5].current, true)
assert.equal(ended[5].time, 'fmt:2026-09-04 12:00:00')

const disabledSteps = buildTaskTimeline(
  { state: '已结束', finishTime: '2026-09-05 10:00:00' },
  format,
  { customerAcceptanceEnabled: false, evaluationEnabled: false }
)
assert.equal(disabledSteps[3].active, false)
assert.equal(disabledSteps[3].time, '不适用')
assert.equal(disabledSteps[4].time, '不适用')
assert.equal(disabledSteps[5].time, 'fmt:2026-09-05 10:00:00')

const lateAcceptance = buildTaskTimeline({ state: '已结束', KehuYSSJ: '2026-09-06 11:00:00' }, format)
assert.equal(lateAcceptance[3].active, true)
assert.equal(lateAcceptance[3].time, 'fmt:2026-09-06 11:00:00')
assert.equal(lateAcceptance[5].time, 'fmt:2026-09-06 11:00:00')

const noMerchant = buildTaskTimeline(
  { state: '待评价', finishTime: '2026-09-07 09:00:00' },
  format,
  { merchantAcceptanceEnabled: false }
)
assert.equal(noMerchant[2].time, '不适用')
assert.equal(noMerchant[4].time, 'fmt:2026-09-07 09:00:00')

const missingDetail = "NoExistData <br>表名：Diy_ShouhouDD<br>条件：WHERE A.`Id`='missing' AND A.`IsDeleted` <> 1"
const missingError = Object.assign(new Error(missingDetail), { code: 2 })
assert.equal(formatTaskLoadError(missingError), `该售后任务已不存在，可能已被删除或归档\n${missingDetail}`)

const permissionError = Object.assign(new Error('无权查看该任务'), { code: 0 })
assert.equal(formatTaskLoadError(permissionError), '无权查看该任务')

console.log('task detail presentation tests: 10/10')
