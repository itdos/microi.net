import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileTemplate, parse } from '@vue/compiler-sfc'
import { canAddMenuRecord, canEditMenuRecord } from '../src/platform/menu-permission.js'
import {
  customerDeviceLookupCandidates,
  customerDeviceMatches,
  resolveCustomerDeviceReference
} from '../src/tenants/xjy/task-device-reference.mjs'
import { taskScanProcessAccess } from '../src/tenants/xjy/task-scan-permission.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('售后任务新增入口精确服从当前菜单新增权限', () => {
  const menuId = 'task-menu'
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Read' }] }] }), false)
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Add' }] }] }), true)
  assert.equal(canAddMenuRecord(menuId, { _RoleLimits: JSON.stringify([{ FkId: menuId, Permission: [{ Name: '新增' }] }]) }), true)
  assert.equal(canAddMenuRecord('other-menu', { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Add' }] }] }), false)
})

test('表单编辑入口精确服从当前菜单编辑权限', () => {
  const menuId = 'casebook-menu'
  assert.equal(canEditMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Read' }] }] }), false)
  assert.equal(canEditMenuRecord(menuId, { Level: 9998, _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Read' }] }] }), false, '非超级管理员的高等级角色不能绕过只读配置')
  assert.equal(canEditMenuRecord(menuId, { Level: 9998, _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Edit' }] }] }), true, '高等级普通角色仍按显式编辑授权放行')
  assert.equal(canEditMenuRecord(menuId, { Level: 9999, _RoleLimits: [] }), true, '平台超级管理员沿用全权规则')
  assert.equal(canEditMenuRecord(menuId, { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Edit' }] }] }), true)
  assert.equal(canEditMenuRecord(menuId, { _RoleLimits: JSON.stringify([{ FkId: menuId, Permission: [{ Name: '编辑' }] }]) }), true)
  assert.equal(canEditMenuRecord('other-menu', { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Edit' }] }] }), false)
})

test('售后任务完整表单入口按编辑权限显示，直达编辑页也必须复核权限', () => {
  const detail = fs.readFileSync(path.join(root, 'src/pages/task/detail.vue'), 'utf8')
  const feedback = fs.readFileSync(path.join(root, 'src/pages/native/task-feedback.vue'), 'utf8')
  const form = fs.readFileSync(path.join(root, 'src/pages/native-form/index.vue'), 'utf8')
  assert.match(detail, /v-if="task\.Id && canEditTaskRecord" class="nav-more"/)
  assert.match(detail, /canEditTaskRecord\(\)[\s\S]*?canEditMenuRecord\(this\.taskMenuId, this\.currentUser\)/)
  assert.match(detail, /openFullForm\(\)[\s\S]*?if \(!this\.canEditTaskRecord\)[\s\S]*?mode: 'Edit'/)
  assert.match(feedback, /openFullForm\(\)[\s\S]*?mode:'View'/)
  assert.match(form, /this\.mode === 'Edit' && this\.rowId && isFormEngineRecordAdapter\(this\.recordAdapter\)[\s\S]*?canEditMenuRecord\(this\.menuId, getUser\(\) \|\| \{\}\)/)
  assert.match(form, /async submit\(\)[\s\S]*?this\.mode === 'Edit'[\s\S]*?canEditMenuRecord\(this\.menuId, getUser\(\) \|\| \{\}\)/)
  for (const [name, source] of [['任务详情', detail], ['完成服务', feedback], ['原生表单', form]]) {
    const parsed = parse(source, { filename: `${name}.vue` })
    assert.deepEqual(parsed.errors, [], `${name} 单文件组件解析失败`)
    const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: `${name}.vue`, id: 'task-edit-permission' })
    assert.deepEqual(compiled.errors, [], `${name} 页面模板编译失败`)
  }
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

test('扫码处理设备只放行指定角色与任务所属商家', () => {
  const task = { TenantId: 'tenant-a' }
  assert.equal(taskScanProcessAccess(task, {
    Id: 'user-1',
    TenantId: 'tenant-a',
    RoleIds: JSON.stringify([{ Id: 'role-1', Name: '售后工程师' }])
  }).allowed, true)
  assert.equal(taskScanProcessAccess(task, {
    Id: 'user-2', TenantId: 'tenant-b', RoleName: '客服主管'
  }).allowed, false)
  assert.equal(taskScanProcessAccess(task, {
    Id: 'user-3', TenantId: 'tenant-a', RoleName: '销售主管'
  }).allowed, false)
  assert.equal(taskScanProcessAccess(task, {
    Id: 'manager', TenantId: 'tenant-a', RoleName: '杭州总经理'
  }).allowed, true)
  assert.equal(taskScanProcessAccess(task, {
    Id: 'admin', Level: 9999, RoleName: '超级管理员'
  }).allowed, true)
  assert.equal(taskScanProcessAccess({}, {
    Id: 'user-4', TenantId: 'tenant-a', RoleName: '总经理'
  }).allowed, false)
})
