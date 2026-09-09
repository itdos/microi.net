import assert from 'node:assert/strict'
import test from 'node:test'

import { leadFollowupDefaultValues } from '../src/tenants/xjy/lead-followup-defaults.mjs'

test('新增线索跟进自动填入当前时间和登录人员', () => {
  assert.deepEqual(leadFollowupDefaultValues({
    mode: 'Add',
    form: {},
    currentTime: '2026-09-09 09:26',
    currentUser: { Id: 'user-1', Name: '艾瑞斯', Account: 'cs' }
  }), {
    GenjinSJ: '2026-09-09 09:26',
    GenjinR: [{ Id: 'user-1', Name: '艾瑞斯' }]
  })
})

test('人员缺少姓名时使用当前登录账号', () => {
  assert.deepEqual(leadFollowupDefaultValues({
    mode: 'Add',
    form: {},
    currentTime: '2026-09-09 09:26',
    currentUser: { Id: 'user-2', Account: 'sales01' }
  }), {
    GenjinSJ: '2026-09-09 09:26',
    GenjinR: [{ Id: 'user-2', Name: 'sales01' }]
  })
})

test('新增线索跟进保留入口显式传入的时间和人员', () => {
  assert.deepEqual(leadFollowupDefaultValues({
    mode: 'Add',
    form: {
      GenjinSJ: '2026-09-10 10:30',
      GenjinR: [{ Id: 'user-9', Name: '指定人员' }]
    },
    currentTime: '2026-09-09 09:26',
    currentUser: { Id: 'user-1', Name: '艾瑞斯' }
  }), {})
})

test('编辑线索跟进不回填新增默认值', () => {
  assert.deepEqual(leadFollowupDefaultValues({
    mode: 'Edit',
    rowId: 'followup-1',
    form: {},
    currentTime: '2026-09-09 09:26',
    currentUser: { Id: 'user-1', Name: '艾瑞斯' }
  }), {})
})
