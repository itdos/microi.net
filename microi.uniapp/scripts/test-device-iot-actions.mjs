import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { deviceIoTPolicy, deviceIoTWhere, saveDeviceIoTBinding, newIoTDeviceDefaults,
  isDeviceIoTSelector } from '../src/tenants/xjy/device-iot-actions.mjs'

const definition = { fields: [
  { Name: 'XuanzeIoT', BindRole: '["role-link"]', AppVisible: 1,
    config: { OpenTable: { SysMenuId: 'iot-menu' } } },
  { Name: 'JiechuIoT', BindRole: '["role-unlink"]', AppVisible: 1 },
  { Name: 'XinzengIoT', BindRole: '["role-create"]', AppVisible: 1 }
] }
const user = { _Roles: [{ Id: 'ROLE-LINK' }, { Id: 'role-unlink' }, { Id: 'role-create' }],
  _RoleLimits: [{ FkId: 'device-menu', Permission: [{ Name: 'Edit' }] },
    { FkId: 'iot-menu', Permission: [{ Name: 'Add' }] }] }
const context = { definition, user, menuId: 'device-menu', form: { Id: 'device-1', TenantId: 'tenant-1' } }

test('三个按钮分别读取平台角色，不用角色名称或硬编码管理员以外的放行', () => {
  assert.deepEqual(deviceIoTPolicy(context), { link: true, unlink: true, create: true })
  assert.deepEqual(deviceIoTPolicy({ ...context, user: { ...user, _Roles: [{ Id: 'role-unlink' }] } }),
    { link: false, unlink: true, create: false })
  assert.deepEqual(deviceIoTPolicy({ ...context, user: { ...user, _Roles: [{ Id: 'other', Name: '客服' }] } }),
    { link: false, unlink: false, create: false })
})
test('可见角色仍须设备编辑权限，新增还须目标菜单新增权限', () => {
  assert.deepEqual(deviceIoTPolicy({ ...context, user: { ...user, _RoleLimits: [] } }),
    { link: false, unlink: false, create: false })
  assert.equal(deviceIoTPolicy({ ...context, user: { ...user, _RoleLimits: user._RoleLimits.slice(0, 1) } }).create, false)
  assert.deepEqual(deviceIoTPolicy({ ...context, user: { _IsAdmin: true }, form: {} }),
    { link: false, unlink: false, create: false })
  assert.deepEqual(deviceIoTPolicy({ ...context, user: { _IsAdmin: true } }),
    { link: true, unlink: true, create: true })
})
test('缺失、隐藏、软删除字段失败关闭，改平台角色后重新计算', () => {
  assert.equal(deviceIoTPolicy({ ...context, definition: { fields: [] } }).link, false)
  for (const patch of [{ AppVisible: 0 }, { Visible: 0 }, { visible: false }, { IsDeleted: 1 }, { BindRole: '["revoked"]' }]) {
    const fields = definition.fields.map(field => field.Name === 'XuanzeIoT' ? { ...field, ...patch } : field)
    assert.equal(deviceIoTPolicy({ ...context, definition: { fields } }).link, false)
  }
})
test('选择器按设备所属商家及启用状态过滤，当前零状态不被错误放行', () => {
  assert.deepEqual(deviceIoTWhere(context.form, { TenantId: 'other' }), [
    { Name: 'Enabled', Type: '=', Value: 1 }, { Name: 'TenantId', Type: '=', Value: 'tenant-1' }
  ])
  assert.equal(isDeviceIoTSelector('Diy_KehuSB', { Name: 'XuanzeIoT' }), true)
  assert.equal(isDeviceIoTSelector('OtherTable', { Name: 'XuanzeIoT' }), false)
})
test('关联只提交 Id/关联字段，携带真实菜单并触发表单服务端事务事件', async () => {
  let payload
  await saveDeviceIoTBinding('link', context, { Id: 'iot-1', TenantId: 'forged', DeviceName: 'forged' },
    async (table, row) => { payload = { table, row }; return { Code: 1 } })
  assert.deepEqual(payload, { table: 'Diy_KehuSB', row: { Id: 'device-1', IoTDeviceId: 'iot-1',
    _SysMenuId: 'device-menu', _InvokeType: 'Client' } })
})
test('解除使用 null 清空而非删除物联网设备，取消/无权不会发更新', async () => {
  let calls = 0
  await saveDeviceIoTBinding('unlink', context, null, async (table, row) => {
    calls++; assert.equal(row.IoTDeviceId, null); assert.equal(row.IoTDeviceNames, ''); return { Code: 1 }
  })
  await assert.rejects(() => saveDeviceIoTBinding('link', { ...context, user: {} }, { Id: 'iot' }, () => { calls++ }), /操作权限/)
  await assert.rejects(() => saveDeviceIoTBinding('link', context, {}, () => { calls++ }), /请选择/)
  assert.equal(calls, 1)
})
test('服务端拒绝与网络失败原样保留，失败不会返回成功', async () => {
  await assert.rejects(() => saveDeviceIoTBinding('link', context, { Id: 'iot' }, async () =>
    ({ Code: 0, Msg: 'IoT设备已关联其他客户设备' })), /已关联其他/)
  await assert.rejects(() => saveDeviceIoTBinding('unlink', context, null, async () => { throw new Error('网络超时') }), /网络超时/)
})
test('新增从合同权威数据补齐商家与设备默认值，不提前关联', async () => {
  const defaults = await newIoTDeviceDefaults({ ShangpinMC: '饮水机', ShebeiXH: 'RO', AnzhuangWZ: '一楼',
    DingdanSPID: 'product', TenantId: 'stale' }, { TenantId: 'user-tenant' }, {
    loadOrderProduct: async id => { assert.equal(id, 'product'); return { Code: 1, Data: { DingdanID: 'order' } } },
    loadOrder: async id => { assert.equal(id, 'order'); return { Code: 1, Data: { TenantId: 'authoritative', TenantName: '商家' } } }
  })
  assert.deepEqual(defaults, { Enabled: 1, DeviceName: '饮水机', DeviceModel: 'RO', Location: '一楼',
    TenantId: 'authoritative', TenantName: '商家' })
  assert.equal(Object.hasOwn(defaults, 'KehuSBID'), false)
  await assert.rejects(() => newIoTDeviceDefaults({ DingdanID: 'missing' }, {}, {
    loadOrder: async () => ({ Code: 0, Msg: '无权读取合同' })
  }), /无权读取合同/)
})
test('详情使用原生管理组件，选择器支持定制触发及提交，不执行前端 V8', () => {
  const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  const page = read('../src/pages/business/detail.vue')
  const component = read('../src/tenants/xjy/components/device-iot-actions.vue')
  const selector = read('../src/components/mci-table-selector/mci-table-selector.vue')
  assert.match(page, /<XjyDeviceIoTActions/)
  assert.match(page, /!isDeviceIoTSelector\(this.moduleConfig.table, item.field\)/)
  assert.match(selector, /<slot name="trigger"/)
  assert.match(selector, /this.submitSelection \|\| submitOpenTableSelection/)
  assert.match(selector, /<teleport to="body">/)
  assert.match(selector, /:style="portalTokenStyle"/)
  assert.match(component, /uni.showModal/)
  assert.match(component, /height: 62rpx/)
  assert.match(component, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(component, /device-iot-actions__header|device-iot-action__hint|device-iot-action__arrow/)
  assert.doesNotMatch(component, /new Function|\beval\(/)
})
