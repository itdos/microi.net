import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { canAddMenuRecord } from '../src/platform/menu-permission.js'
import {
  customerDeviceLookupCandidates,
  customerDeviceMatches,
  resolveCustomerDeviceReference
} from '../src/tenants/xjy/task-device-reference.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('售后任务新增入口精确服从当前菜单新增权限', () => {
  const menuId = 'task-menu'
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Read' }] }] }), false)
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Add' }] }] }), true)
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: JSON.stringify([{ FkId: menuId, Permission: [{ Name: '新增' }] }]) }), true)
  assert.equal(canAddMenuRecord('other-menu', { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Add' }] }] }), false)
})

test('历史错误客户设备Id会回退到设备业务键', () => {
  const candidates = customerDeviceLookupCandidates({
    KehuSBID: 'stale-id',
    ShebeiBH: 'SB-001',
    DingdanID: 'order-1',
    KehuID: 'customer-1'
  })
  assert.equal(candidates[0].query.Id, 'stale-id')
  assert.deepEqual(candidates[1].query._Where.map((item) => item.Name), ['DingdanID', 'KehuID', 'ShebeiBH'])
  assert.deepEqual(candidates[2].query._Where, [{ Name: 'ShebeiBH', Type: '=', Value: 'SB-001' }])
  assert.equal(customerDeviceMatches({ ShebeiBH: 'SB-001' }, { ShebeiBH: 'SB-002' }), false)
  assert.equal(customerDeviceMatches({ ShebeiBH: 'SB-001' }, { ShebeiBH: 'SB-001' }), true)
})

test('客户设备解析遇到不存在的旧Id后使用设备编号找到真实记录', async () => {
  const requests = []
  const resolved = await resolveCustomerDeviceReference({ KehuSBID: 'stale-id', ShebeiBH: 'SB-001' }, async (query) => {
    requests.push(query)
    if (query.Id) return { Code: 2, Data: null, Msg: '不存在的数据' }
    return { Code: 1, Data: { Id: 'customer-device-1', ShebeiBH: 'SB-001' } }
  })
  assert.equal(resolved.Id, 'customer-device-1')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].Id, 'stale-id')
  assert.equal(requests[1]._Where[0].Value, 'SB-001')
})

test('售后任务页新增按钮和点击入口都有权限保护', () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/task/list.vue'), 'utf8')
  assert.match(source, /v-if="canAddTask" class="floating-add"/)
  assert.match(source, /if \(!this\.canAddTask\)[\s\S]*?当前账号没有新增权限/)
  assert.match(source, /menuId: this\.taskMenuId/)
})
