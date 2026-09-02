import assert from 'node:assert/strict'
import test from 'node:test'

import { followupApprovalDefaultValues } from '../src/tenants/xjy/followup-approval-defaults.mjs'

test('新增跟进记录补齐待审批状态和值', () => {
  assert.deepEqual(followupApprovalDefaultValues({ mode: 'Add', form: {} }), {
    ShenpiZT: '待审批',
    ShenpiZTZ: 2
  })
})

test('新增跟进记录保留入口显式传入的审批值', () => {
  assert.deepEqual(followupApprovalDefaultValues({
    mode: 'Add',
    form: { ShenpiZT: '已审批', ShenpiZTZ: 3 }
  }), {
    ShenpiZT: '已审批',
    ShenpiZTZ: 3
  })
})

test('编辑或已有记录不回填新增默认值', () => {
  assert.deepEqual(followupApprovalDefaultValues({ mode: 'Edit', form: {} }), {})
  assert.deepEqual(followupApprovalDefaultValues({ mode: 'Add', rowId: 'saved-id', form: {} }), {})
})

