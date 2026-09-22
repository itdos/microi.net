import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeDialogHeader } from '../src/views/micro-app/dialog-header-contract.js'

test('微服务弹窗标题只接受有限纯文本标签和动作标识', () => {
  const header = normalizeDialogHeader({
    title: '<b>加工任务单</b>',
    tags: [{ text: '已通过', tone: 'success' }, { text: '', tone: 'danger' }],
    actions: [{ id: 'save-draft', text: '保存草稿', tone: 'primary' }, { id: '<script>', text: '危险' }],
  })
  assert.equal(header.title, '<b>加工任务单</b>')
  assert.deepEqual(header.tags, [{ text: '已通过', tone: 'success' }])
  assert.deepEqual(header.actions, [{ id: 'save-draft', text: '保存草稿', tone: 'primary', disabled: false }])
})

test('未知动作颜色和超长文本自动降级且不携带函数', () => {
  const header = normalizeDialogHeader({ Actions: [{ Id: 'approve', Name: '审'.repeat(80), Tone: 'javascript:evil', OnClick() {} }] })
  assert.equal(header.actions[0].text.length, 50)
  assert.equal(header.actions[0].tone, 'default')
  assert.equal('OnClick' in header.actions[0], false)
})
