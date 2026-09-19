import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/pages/business/utils/xjy-row-actions.js', import.meta.url), 'utf8')
// 执行实际页面共用的权限函数，隔离网络 SDK，避免测试触碰真实订单。
const context = vm.createContext({})
vm.runInContext(source.slice(source.indexOf('const MENU_IDS'),
  source.indexOf('export function canViewOrderDevice')).replace(/export /g, ''), context)
const menuId = 'fc56123e-cfa1-4690-a6a4-929f202a817b'
const buttonIds = ['8dc40e8e-9ab5-49f9-b3bd-de525bd9e056', '3107624f-58a2-441d-878b-99b9637c00c0']
const pending = { DingdanZT: '待审批', DingdanZTZ: 1, TenantId: 'merchant-a' }
const user = (permission, fkId = menuId) => ({
  Level: 1, TenantId: 'merchant-a', _RoleLimits: [{ FkId: fkId, Permission: permission }]
})

test('销售撤销按钮 Id 后，残留审批名称不能显示审核入口', () => {
  assert.equal(context.canApproveOrder(pending, user(['Read', '复制', '审批', 'Add', 'Del', 'Edit'])), false)
  assert.equal(context.canApproveOrder(pending, user(['作废审批', '审批通过', '审批不通过'])), false)
})

test('真实行/表单审批按钮 Id 授权兼容数组及 JSON 格式', () => {
  for (const id of buttonIds) {
    assert.equal(context.canApproveOrder(pending, user([id])), true)
    assert.equal(context.canApproveOrder(pending, user(JSON.stringify([id]))), true)
    const serialized = { ...user([id]), _RoleLimits: JSON.stringify(user([id])._RoleLimits) }
    assert.equal(context.canApproveOrder(pending, serialized), true)
  }
})

test('其它菜单、不同商家和非待审批订单不能借用审核授权', () => {
  for (const id of buttonIds) {
    assert.equal(context.canApproveOrder(pending, user([id], 'other-menu')), false)
    assert.equal(context.canApproveOrder({ ...pending, TenantId: 'merchant-b' }, user([id])), false)
    for (const [state, code] of [['已审批', 2], ['待审批作废', 5], ['已驳回', 6]]) {
      assert.equal(context.canApproveOrder({ ...pending, DingdanZT: state, DingdanZTZ: code }, user([id])), false)
    }
  }
})

test('缺失或无效的权限数据不显示审核入口', () => {
  assert.equal(context.canApproveOrder(pending, user('invalid-json')), false)
  assert.equal(context.canApproveOrder(pending, { Level: 1 }), false)
  assert.equal(context.canApproveOrder(pending, { Level: 1, _RoleLimits: 'invalid-json' }), false)
})

test('平台管理员保留待审批订单入口，已审批订单仍隐藏', () => {
  assert.equal(context.canApproveOrder(pending, { Level: 9999 }), true)
  assert.equal(context.canApproveOrder({ DingdanZT: '已审批', DingdanZTZ: 2 }, { Level: 9999 }), false)
})
