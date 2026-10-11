import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/表单引擎/售后订单（Diy_ShouhouDD）/表单V8事件/后端表单提交前V8事件（SubmitBeforeServerV8）.js', import.meta.url), 'utf8')
const submitBefore = new Function('V8', source)

test('普通售后任务新增不占用返工来源唯一索引', () => {
  for (const sourceId of [undefined, '', '伪造来源任务']) {
    const form = { TenantId: 'tenant-a', ReworkSourceTaskId: sourceId }
    const result = submitBefore({ FormSubmitAction: 'Add', Form: form })
    assert.equal(result, undefined)
    assert.equal(form.ReworkSourceTaskId, null)
  }
})

test('普通编辑保留既有返工关联，并把历史空值规范为 NULL', () => {
  for (const [oldValue, expected] of [['', null], [null, null], ['source-task', 'source-task']]) {
    const form = { ReworkSourceTaskId: '伪造来源任务' }
    const result = submitBefore({ FormSubmitAction: 'Upt', Form: form, OldForm: { ReworkSourceTaskId: oldValue } })
    assert.equal(result, undefined)
    assert.equal(form.ReworkSourceTaskId, expected)
  }
})
