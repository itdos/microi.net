import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { compileTemplate, parse } from '@vue/compiler-sfc'

const engineDir = new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/', import.meta.url)
const readEngine = (name) => fs.readFileSync(new URL(name, engineDir), 'utf8')
const authorize = new Function('V8', readEngine('售后流程动作授权(shouhoudd_authorize_flow_action).js'))
const followUp = new Function('V8', readEngine('售后追加评价(shouhoudd_follow_up).js'))
const legacyAcceptance = new Function('V8', readEngine('验收售后任务(shouhou_yanshou).js'))
const beforeSubmit = new Function('V8', fs.readFileSync(new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/表单引擎/售后订单（Diy_ShouhouDD）/表单V8事件/后端表单提交前V8事件（SubmitBeforeServerV8）.js', import.meta.url), 'utf8'))
const permissionIds = {
  merchantPass: '56b9d9f5-667d-45d4-a4d4-17d9bf541172',
  merchantReject: '7e9589d9-e7b3-4870-a4d9-a614a48bfee9',
  customerPass: '2860d95a-37d1-4069-8eea-4e27b44ac313',
  customerReject: '37eae95b-7dc1-46d1-a765-3b8ee6c8bc0b',
  evaluate: '0c2cae82-29e9-4dbf-97c1-9ef6e9de0239',
  followUp: 'cfc00d1c-3b37-4e11-98c7-e739d2cd81f2'
}

test('追加评价页面模板可编译，提交走受权接口', () => {
  const filename = new URL('../src/pages/native/task-follow-up.vue', import.meta.url)
  const source = fs.readFileSync(filename, 'utf8')
  const parsed = parse(source, { filename: filename.pathname })
  assert.deepEqual(parsed.errors, [])
  const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: filename.pathname, id: 'task-follow-up-permission' })
  assert.deepEqual(compiled.errors, [])
  assert.match(source, /loadTaskFlowCapabilities\(this\.id, true\)/)
  assert.match(source, /callApiEngine\('shouhoudd_follow_up'/)
  assert.doesNotMatch(source, /UptFormData\(/)
})

function runAuthorization({ action = 'customerPass', account = 'staff', linked = 'customer-a,customer-b', rolePermissions = [],
  roleId = 'role-support', userTenant = 'tenant-1', taskPatch = {}, roleRules = null } = {}) {
  const task = {
    Id: 'task-1', KehuID: 'customer-1', TenantId: 'tenant-1', HouxuFZRID: 'staff-1', LeixingZ: 1,
    ZhuangtaiZ: action.startsWith('merchant') ? 11 : action === 'evaluate' ? 3 : 9,
    Zhuangtai: action.startsWith('merchant') ? '待客服验收' : action === 'evaluate' ? '待评价' : '已结束',
    KehuYSZT: '', Pingjia: action === 'followUp' ? 5 : '', ZhuipingNR: '', ZhuipingT: '[]'
  }
  Object.assign(task, taskPatch)
  const user = { Id: 'staff-1', Account: account, Name: '操作人', State: 1, TenantId: userTenant, RoleIds: roleId, Level: 1 }
  const v8 = {
    Param: { TaskId: task.Id, ActionKey: action, OperatorUserId: user.Id }, CurrentUser: { Id: user.Id }, DbTrans: {},
    FormEngine: {
      GetFormData: ({ FormEngineKey }) => {
        if (FormEngineKey === 'Diy_ShouhouDD') return { Code: 1, Data: task }
        if (FormEngineKey === 'Sys_User') return { Code: 1, Data: user }
        if (FormEngineKey === 'Diy_Kehu') return { Code: 1, Data: { Id: 'customer-1', KehuGLZH: linked } }
        if (FormEngineKey === 'Diy_ShouhouTypePolicy') return { Code: 2 }
        throw new Error(`unexpected table ${FormEngineKey}`)
      },
      GetTableData: ({ FormEngineKey }) => {
        if (FormEngineKey === 'sys_rolelimit') return { Code: 1, Data: [{ RoleId: roleId, Permission: JSON.stringify(rolePermissions) }] }
        if (FormEngineKey === 'Diy_ShouhouFlowRule') return { Code: 1, Data: roleRules || [{ Id: 'rule-1', RoleId: roleId, ScopeMode: 'AssignedPostServiceUser' }] }
        throw new Error(`unexpected list ${FormEngineKey}`)
      }
    }
  }
  return authorize(v8)
}

test('六项权限分别校验；旧同名按钮不能冒充新权限', () => {
  for (const action of Object.keys(permissionIds)) {
    const baseline = runAuthorization({ action, rolePermissions: ['Read', '用户评价', '商家验收通过'] })
    assert.equal(baseline.Code, 0, action)
    const allowed = runAuthorization({ action, rolePermissions: ['Read', permissionIds[action]] })
    assert.equal(allowed.Code, 1, action)
    for (const other of Object.keys(permissionIds).filter((key) => key !== action)) {
      assert.equal(runAuthorization({ action, rolePermissions: ['Read', permissionIds[other]] }).Code, 0, `${other} must not grant ${action}`)
    }
  }
})

test('两个关联客户账号本人可操作，不依赖后台角色菜单', () => {
  assert.equal(runAuthorization({ account: 'customer-a', rolePermissions: [] }).Data.OperatorMode, 'Customer')
  assert.equal(runAuthorization({ account: 'customer-b', action: 'followUp', rolePermissions: [] }).Data.OperatorMode, 'Customer')
  assert.equal(runAuthorization({ account: 'customer', rolePermissions: [] }).Code, 0)
})

test('员工代办必须同商家、菜单读取与独立按钮权限', () => {
  assert.equal(runAuthorization({ rolePermissions: ['Read', permissionIds.customerPass] }).Data.OperatorMode, 'Proxy')
  assert.equal(runAuthorization({ userTenant: 'another-tenant', rolePermissions: ['Read', permissionIds.customerPass] }).Code, 0)
  assert.equal(runAuthorization({ rolePermissions: [permissionIds.customerPass] }).Code, 0)
  assert.equal(runAuthorization({ rolePermissions: ['Read', permissionIds.customerPass], taskPatch: { KehuYSZT: '通过' } }).Code, 0)
})

test('商家验收除按钮权限还校验阶段责任人作用域', () => {
  assert.equal(runAuthorization({ action: 'merchantPass', rolePermissions: ['Read', permissionIds.merchantPass] }).Code, 1)
  assert.equal(runAuthorization({ action: 'merchantPass', rolePermissions: ['Read', permissionIds.merchantPass], taskPatch: { HouxuFZRID: 'other' } }).Code, 0)
  assert.equal(runAuthorization({ action: 'merchantPass', rolePermissions: ['Read', permissionIds.merchantPass], taskPatch: { ZhuangtaiZ: 2, Zhuangtai: '待服务' } }).Code, 0)
})

test('追加评价要求已结案、已首评且未追加', () => {
  const permission = ['Read', permissionIds.followUp]
  assert.equal(runAuthorization({ action: 'followUp', rolePermissions: permission, taskPatch: { Pingjia: '' } }).Code, 0)
  assert.equal(runAuthorization({ action: 'followUp', rolePermissions: permission, taskPatch: { ZhuipingNR: '已有追加' } }).Code, 0)
  assert.equal(runAuthorization({ action: 'followUp', rolePermissions: permission, taskPatch: { ZhuangtaiZ: 3, Zhuangtai: '待评价' } }).Code, 0)
})

test('追加评价提交在服务端再次授权，失败不写任务和日志', () => {
  let writes = 0
  const v8 = {
    Param: { Id: 'task-1', ZhuipingNR: '补充意见', ZhuipingT: '[]' }, CurrentUser: { Id: 'staff-1' }, DbTrans: {},
    ApiEngine: { Run: () => ({ Code: 0, Msg: '未授权' }) },
    FormEngine: { UptFormData: () => { writes++; return { Code: 1 } }, AddFormData: () => { writes++; return { Code: 1 } } }
  }
  assert.equal(followUp(v8).Code, 0)
  assert.equal(writes, 0)
  v8.ApiEngine.Run = () => ({ Code: 1, Data: { Task: { Id: 'task-1', Pingjia: 5, Zhuangtai: '已结束' }, Operator: { Id: 'staff-1', Name: '客服' }, OperatorMode: 'Proxy' } })
  assert.equal(followUp(v8).Code, 1)
  assert.equal(writes, 2)
})

test('平台旧验收按钮也走统一权限接口，拒绝后不直接改任务', () => {
  let writes = 0
  const v8 = {
    Param: { Id: 'task-1', type: 1 }, DbTrans: {},
    ApiEngine: { Run: (key) => { assert.equal(key, 'task_acceptance'); return { Code: 0, Msg: '当前角色未授权' } } },
    FormEngine: { UptFormData: () => { writes++; return { Code: 1 } } }
  }
  assert.equal(legacyAcceptance(v8).Code, 0)
  assert.equal(writes, 0)
})

test('普通表单编辑不能绕过验收、评价和追加评价权限', () => {
  for (const field of ['ShangjiaYSZT', 'KehuYSZT', 'Pingjia', 'ZhuipingNR']) {
    assert.equal(beforeSubmit({ FormSubmitAction: 'Upt', Form: { [field]: '伪造' }, OldForm: { [field]: '' } }).Code, 0, field)
  }
  assert.equal(beforeSubmit({ FormSubmitAction: 'Upt', Form: { KehuYSZT: '通过', Remark: '正常备注' }, OldForm: { KehuYSZT: '通过', Remark: '' } }), undefined)
})
