import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { deviceActionSectionKey } from '../src/tenants/xjy/device-detail-actions.mjs'
import { createDeviceControlSession, deviceControlFields, deviceControlActions, DEVICE_CONTROL_OPERATIONS, newDeviceCommandId } from '../src/tenants/xjy/device-iot-control.mjs'

const descriptor = () => ({ Ready: true, Capabilities: { Operations: DEVICE_CONTROL_OPERATIONS.map(item => item.key) },
  FilterReset: { Ready: true, Filters: [{ Level: 2, Basis: 'server-basis', Used: 42, Threshold: 360, Enabled: 1 }] } })
const commandId = '12345678-1234-4123-8123-123456789abc'
const command = patch => ({ CommandId: commandId, Terminal: false, Success: null, Message: '等待设备确认', ...patch })
function fixture(handler = () => null, options = {}) {
  const calls = [], refreshed = []
  const session = createDeviceControlSession({ parentId: 'parent-id', menuId: 'menu-id', newId: () => commandId,
    canOperate: () => true, wait: async () => {}, attempts: 2,
    refreshSnapshot: () => refreshed.push(true),
    call: async (key, params) => {
      calls.push(params)
      const result = await handler(params)
      return result || { Code: 1, Data: params.Action === 'Inspect' ? descriptor() : params.Action === 'Status' ? { Command: command({ Terminal: true, Success: true }) } : command() }
    }, ...options })
  return { session, calls, refreshed }
}
const confirm = async () => true

test('设备资料动作固定完整定义中的资料分组，切换 IoT/售后 Tab 不会重定位', () => {
  const definition = { relatedGroups: [
    { key: 'basic', name: '设备信息', tabKey: 'base', fields: [{ Name: 'ShebeiBH' }] },
    { key: 'iot', name: '', tabKey: 'iot', fields: [{ Name: 'IoTControlFeedback' }] },
    { key: 'after-sales', name: '售后记录', tabKey: 'after-sales', fields: [] }
  ] }
  for (const active of ['base', 'iot', 'after-sales']) {
    const key = deviceActionSectionKey(definition)
    assert.deepEqual(definition.relatedGroups.filter(group => group.tabKey === active && group.key === key).map(group => group.key), active === 'base' ? ['basic'] : [])
  }
  assert.equal(deviceActionSectionKey({ groups: [{ key: 'renamed', name: '资料', fields: [{ Name: 'ShebeiBH' }] }] }), 'renamed')
  assert.equal(deviceActionSectionKey({ groups: [{ key: 'iot', fields: [{ Name: 'IoTControlFeedback' }] }] }), '')
})

test('按钮同时遵守字段角色/显隐、所属 Tab 与后端能力，不能执行任意后台 V8', () => {
  const fields = DEVICE_CONTROL_OPERATIONS.map((item, Sort) => ({ Name: item.field, Label: item.label, Sort, formTabKey: 'iot', Component: 'Button', AppVisible: 1 }))
  const definition = { fields }
  assert.equal(deviceControlFields(definition, {}, 'base').length, 0)
  const projected = deviceControlActions(deviceControlFields(definition, {}, 'iot'), { Capabilities: { Operations: ['power-on', 'filter-reset', 'arbitrary-code'] } })
  assert.deepEqual(projected.map(item => item.key), ['power-on', 'filter-reset'])
  for (const patch of [{ Visible: 0 }, { AppVisible: 0 }, { visible: false }, { IsDeleted: 1 }, { BindRole: '["revoked"]' }]) {
    const result = deviceControlFields({ fields: [{ ...fields[0], ...patch }] }, {}, 'iot')
    assert.equal(result.length, 0)
  }
})

test('确认后先准备再下发，只展示同一编号的设备确认；双击只提交一次', async () => {
  const { session, calls, refreshed } = fixture()
  await Promise.all([session.execute('power-on', { confirm }), session.execute('power-on', { confirm })])
  assert.deepEqual(calls.map(item => item.Action), ['Inspect', 'Prepare', 'Dispatch', 'Status', 'Inspect'])
  assert.ok(calls.every(item => item.ParentId === 'parent-id' && item._SysMenuId === 'menu-id'))
  assert.ok(calls.filter(item => item.CommandId).every(item => item.CommandId === commandId))
  assert.equal(session.state.command.Success, true)
  assert.equal(session.state.busy, false)
  assert.equal(refreshed.length, 1)
})

test('取消、离线、能力不支持或确认期间撤权均不会 Prepare/Dispatch', async () => {
  const cancelled = fixture()
  await cancelled.session.execute('power-on', { confirm: async () => false })
  assert.deepEqual(cancelled.calls.map(item => item.Action), ['Inspect'])
  for (const value of [{ ...descriptor(), Ready: false, Message: '设备离线' }, { ...descriptor(), Capabilities: { Operations: [] } }]) {
    const { session, calls } = fixture(() => ({ Code: 1, Data: value }))
    await session.execute('power-on', { confirm })
    assert.deepEqual(calls.map(item => item.Action), ['Inspect'])
    assert.ok(session.state.error)
  }
  let allowed = true
  const revoked = fixture(() => null, { canOperate: () => allowed })
  await revoked.session.execute('power-on', { confirm: async () => { allowed = false; return true } })
  assert.equal(revoked.calls.some(item => item.Action === 'Prepare'), false)
})

test('滤芯需手动选级别并确认，只传后端给的 Basis；回执待复核不显示成功', async () => {
  const { session, calls, refreshed } = fixture(params => params.Action === 'Status'
    ? { Code: 1, Data: { Command: command({ Terminal: true, ReceiptConfirmed: true, Success: null, Verification: { Verified: false } }) } } : null)
  await session.execute('filter-reset', { selectFilter: async rows => rows[0], confirm: async row => row.Level === 2 })
  const prepared = calls.find(item => item.Action === 'Prepare')
  assert.deepEqual(prepared, { ParentId: 'parent-id', _SysMenuId: 'menu-id', Action: 'Prepare', Operation: 'filter-reset', CommandId: commandId, FilterLevel: 2, ResetBasis: 'server-basis' })
  assert.equal(session.state.command.Success, null)
  assert.equal(refreshed.length, 1)
  const cancelled = fixture()
  await cancelled.session.execute('filter-reset', { selectFilter: async () => null, confirm })
  assert.equal(cancelled.calls.some(item => item.Action === 'Prepare'), false)
})

test('下发超时只查询原编号，未知状态阻止新指令；手动查询不补发', async () => {
  const { session, calls } = fixture(params => {
    if (params.Action === 'Dispatch') throw new Error('连接超时')
    if (params.Action === 'Status') return { Code: 1, Data: { Command: command() } }
    return null
  })
  await session.execute('power-on', { confirm })
  const before = calls.length
  await session.execute('power-off', { confirm })
  assert.equal(calls.length, before)
  assert.equal(session.state.uncertainId, commandId)
  await session.status()
  assert.equal(calls.filter(item => item.Action === 'Dispatch').length, 1)
  assert.equal(calls.filter(item => item.Action === 'Prepare').length, 1)
  assert.ok(calls.filter(item => item.Action === 'Status').every(item => item.CommandId === commandId))
  assert.match(session.state.message, /等待设备确认/)
})

test('准备响应丢失或编号不匹配，不继续下发也不换号重试', async () => {
  for (const result of [() => { throw new Error('响应丢失') }, () => ({ Code: 1, Data: command({ CommandId: 'other-command' }) })]) {
    const { session, calls } = fixture(params => params.Action === 'Prepare' ? result() : null)
    await session.execute('power-on', { confirm })
    assert.equal(calls.some(item => item.Action === 'Dispatch'), false)
    assert.equal(session.state.uncertainId, commandId)
    assert.match(session.state.error, /原指令编号/)
  }
})

test('切换 Tab/记录后处置实例，迟到的 Prepare 响应不会继续下发', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { session, calls } = fixture(async params => { if (params.Action === 'Prepare') { await gate; return { Code: 1, Data: command() } } })
  const pending = session.execute('power-on', { confirm })
  while (!calls.some(item => item.Action === 'Prepare')) await new Promise(resolve => setImmediate(resolve))
  session.dispose()
  release()
  await pending
  assert.equal(calls.some(item => item.Action === 'Dispatch'), false)
})

test('错误的最近指令不能冒充本次结果，查询失败关闭旧能力', async () => {
  const { session, calls } = fixture(params => params.Action === 'Status'
    ? { Code: 1, Data: { Command: command({ CommandId: 'other', Terminal: true, Success: true }) } } : null)
  await session.execute('power-on', { confirm })
  assert.equal(session.state.command.Success, null)
  assert.equal(session.state.uncertainId, commandId)
  assert.equal(calls.filter(item => item.Action === 'Dispatch').length, 1)
  let fail = false
  const errors = fixture(() => fail ? { Code: 0, Msg: '权限已撤销' } : null)
  await errors.session.inspect()
  fail = true
  await errors.session.inspect()
  assert.equal(errors.session.state.descriptor, null)
  assert.equal(errors.session.state.error, '权限已撤销')
})

test('小程序编号格式兼容现有后端，控制卡片含双列、展开、触摸区与反馈', () => {
  assert.match(newDeviceCommandId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  const component = fs.readFileSync(new URL('../src/tenants/xjy/components/device-iot-controls.vue', import.meta.url), 'utf8')
  assert.match(component, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(component, /更多控制/)
  assert.match(component, /min-height: 46px/)
  assert.match(component, /state.command\?\.Success === true/)
  assert.match(component, /beforeUnmount\(\).*dispose/)
  assert.doesNotMatch(component, /\beval\(|new Function|V8Code/)
})
