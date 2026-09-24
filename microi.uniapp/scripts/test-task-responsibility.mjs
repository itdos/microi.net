import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildTaskScopeWhere, normalizeTaskScope } from '../src/tenants/xjy/task-responsibility.mjs'

const userId = 'service-user'
const todo = buildTaskScopeWhere('todo', userId)

test('我的待办仅映射服务和客服阶段', () => {
  assert.equal(todo.length, 4)
  assert.equal(todo[0].GroupStart, true)
  assert.deepEqual(todo[0].Value, [1, 2, 10])
  assert.equal(todo[1].Name, 'ShouhouRYID')
  assert.equal(todo[2].AndOr, 'OR')
  assert.equal(todo[2].Value, 11)
  assert.equal(todo[3].Name, 'HouxuFZRID')
  assert.equal(todo[3].GroupEnd, true)
})

test('我参与的和全部有权不会误当成当前待办', () => {
  assert.deepEqual(buildTaskScopeWhere('participated', userId).map((x) => x.Name), ['ShouhouRYID', 'HouxuFZRID'])
  assert.deepEqual(buildTaskScopeWhere('all', userId), [])
  assert.equal(buildTaskScopeWhere('todo', '')[0].Name, 'Id')
  assert.equal(normalizeTaskScope(undefined, true), 'todo')
  assert.equal(normalizeTaskScope(undefined, false), 'all')
  assert.equal(normalizeTaskScope(undefined, undefined), 'all')
})

const root = join(import.meta.dirname, '..', '..', 'Microi-V8-Engine', '集福鲤平台 (api.jifulii.com)', 'xjy.Product.Internal')
const eventSource = readFileSync(join(root, '表单引擎', '售后订单（Diy_ShouhouDD）', '表单V8事件', '后端表单提交前V8事件（SubmitBeforeServerV8）.js'), 'utf8')
const authorizeSource = readFileSync(join(root, '接口引擎', '未分类', '售后流程动作授权(shouhoudd_authorize_flow_action).js'), 'utf8')
const reassignSource = readFileSync(join(root, '接口引擎', '未分类', '售后客服阶段转交(shouhoudd_reassign_support).js'), 'utf8')
const resolveSource = readFileSync(join(root, '接口引擎', '未分类', '售后任务阶段负责人解析(shouhoudd_resolve_stage_owners).js'), 'utf8')

function runCreateEvent(form, rows) {
  const result = { FormSubmitAction: 'Add', Form: form, Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' }, DbTrans: {},
    FormEngine: { GetFormData({ FormEngineKey, Id }) {
      const row = rows[`${FormEngineKey}:${Id}`]
      return row ? { Code: 1, Data: row } : { Code: 2 }
    } } }
  const outcome = new Function('V8', eventSource)(result)
  return { outcome, form }
}

const tenant = 'tenant-a'
const service = { Id: 'service', Name: '售后甲', Phone: '111', State: 1, TenantId: tenant }
const supportRole = '[{"Id":"e757d4f5-e204-4039-9624-960bc3c60cbf","Name":"客服"}]'
const orderSupport = { Id: 'order-cs', Name: '订单客服', Phone: '222', State: 1, TenantId: tenant, RoleIds: supportRole }
const customerSupport = { Id: 'customer-cs', Name: '客户客服', Phone: '333', State: 1, TenantId: tenant, RoleIds: supportRole }
const rows = {
  'Diy_Dingdan:order': { Id: 'order', TenantId: tenant, ShouhouRYID: 'service', ZhaunshuKFID: 'order-cs' },
  'Diy_Kehu:customer': { Id: 'customer', TenantId: tenant, ShouhouRYID: 'service', ZhuanshuKFID: 'customer-cs' },
  'Sys_User:service': service,
  'Sys_User:order-cs': orderSupport,
  'Sys_User:customer-cs': customerSupport
}

test('新增任务按订单优先填充阶段责任人，服务人员与客服互不覆盖', () => {
  const { outcome, form } = runCreateEvent({ TenantId: tenant, DingdanID: 'order', KehuID: 'customer' }, rows)
  assert.equal(outcome, undefined)
  assert.equal(form.ShouhouRYID, 'service')
  assert.equal(form.HouxuFZRID, 'order-cs')
  assert.equal(form.HouxuFPLY, '合同订单专属客服')
})

test('失效的订单客服回退到客户客服；跨商家账号不得指派', () => {
  const fallback = { ...rows, 'Sys_User:order-cs': { ...orderSupport, State: 0 } }
  assert.equal(runCreateEvent({ TenantId: tenant, DingdanID: 'order', KehuID: 'customer' }, fallback).form.HouxuFZRID, 'customer-cs')
  const invalid = runCreateEvent({ TenantId: tenant, KehuID: 'customer', HouxuFZRID: 'foreign' }, {
    ...rows, 'Sys_User:foreign': { Id: 'foreign', State: 1, TenantId: 'tenant-b' }
  })
  assert.equal(invalid.outcome.Code, 0)
})

test('没有有效客服时保留待分配，不错误指给售后人员', () => {
  const missing = { ...rows }
  delete missing['Sys_User:order-cs']
  delete missing['Sys_User:customer-cs']
  const { form } = runCreateEvent({ TenantId: tenant, DingdanID: 'order', KehuID: 'customer' }, missing)
  assert.equal(form.ShouhouRYID, 'service')
  assert.equal(form.HouxuFZRID, undefined)
})

test('服务端批量新增入口使用同样的订单优先责任人解析', () => {
  const result = new Function('V8', resolveSource)({ Param: { Row: { TenantId: tenant, DingdanID: 'order', KehuID: 'customer' } },
    DbTrans: {}, Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' },
    FormEngine: { GetFormData: ({ FormEngineKey, Id }) => {
      const row = rows[`${FormEngineKey}:${Id}`]
      return row ? { Code: 1, Data: row } : { Code: 2 }
    } } })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.ShouhouRYID, 'service')
  assert.equal(result.Data.HouxuFZRID, 'order-cs')
  assert.equal(result.Data.HouxuFPLY, '合同订单专属客服')
  for (const filename of ['PC端_订单审批(dingdan_shenpi).js', '移动端-申请售后(shenqing_shouhou).js', '客户生成周期任务(kehu_dingqirw).js']) {
    assert.match(readFileSync(join(root, '接口引擎', '未分类', filename), 'utf8'), /shouhoudd_resolve_stage_owners/)
  }
})

function authorize(user, taskPatch = {}) {
  const task = { Id: 'task', TenantId: tenant, ZhuangtaiZ: 11, Zhuangtai: '待客服验收',
    ShouhouRYID: 'service', HouxuFZRID: 'order-cs', ...taskPatch }
  const rules = [
    { Id: 'rule-cs', RuleKey: 'cs', RoleId: 'e757d4f5-e204-4039-9624-960bc3c60cbf', ScopeMode: 'AssignedPostServiceUser' },
    { Id: 'rule-supervisor', RuleKey: 'supervisor', RoleId: '1c4283aa-68c4-4680-a066-f931f593435e', ScopeMode: 'TaskTenant' }
  ]
  return new Function('V8', authorizeSource)({ Param: { Id: task.Id, ActionKey: 'merchantPass' },
    CurrentUser: { Id: user.Id }, DbTrans: {},
    FormEngine: {
      GetFormData: ({ FormEngineKey }) => ({ Code: 1, Data: FormEngineKey === 'Sys_User' ? user : task }),
      GetTableData: ({ FormEngineKey }) => FormEngineKey === 'sys_rolelimit'
        ? { Code: 1, Data: [{ RoleId: String(user.RoleIds).includes('1c4283aa-68c4-4680-a066-f931f593435e')
          ? '1c4283aa-68c4-4680-a066-f931f593435e' : 'e757d4f5-e204-4039-9624-960bc3c60cbf',
          Permission: '["Read","56b9d9f5-667d-45d4-a4d4-17d9bf541172"]' }] }
        : { Code: 1, Data: rules }
    } })
}

test('只有当前后续客服、同商家主管有客服验收权限', () => {
  const cs = { Id: 'order-cs', Account: 'cs', State: 1, TenantId: tenant, RoleIds: supportRole }
  assert.equal(authorize(cs).Code, 1)
  assert.equal(authorize({ ...cs, Id: 'service' }).Code, 0)
  assert.equal(authorize({ ...cs, TenantId: 'tenant-b' }).Code, 0)
  const supervisor = { ...cs, Id: 'supervisor', RoleIds: '[{"Id":"1c4283aa-68c4-4680-a066-f931f593435e"}]' }
  assert.equal(authorize(supervisor).Code, 1)
  assert.equal(authorize(supervisor, { TenantId: 'tenant-b' }).Code, 0)
})

test('主管转交客服记录日志并通知；跨商家转交被拒绝', () => {
  const manager = { Id: 'manager', Name: '主管', State: 1, TenantId: tenant,
    RoleIds: '[{"Id":"1c4283aa-68c4-4680-a066-f931f593435e"}]' }
  const task = { Id: 'task', TenantId: tenant, ZhuangtaiZ: 11, Zhuangtai: '待客服验收', HouxuFZRID: 'old-cs' }
  const next = { ...customerSupport, Id: 'new-cs' }
  const updates = []
  const logs = []
  const notices = []
  const run = (operator) => new Function('V8', reassignSource)({
    Param: { Id: task.Id, HouxuFZRID: next.Id, Reason: '原客服请假' }, CurrentUser: { Id: operator.Id }, DbTrans: {},
    Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' },
    FormEngine: {
      GetFormData: ({ FormEngineKey, Id }) => ({ Code: 1, Data: FormEngineKey === 'Diy_ShouhouDD' ? task : Id === next.Id ? next : operator }),
      UptFormData: (value) => { updates.push(value); return { Code: 1 } },
      AddFormData: (value) => { logs.push(value); return { Code: 1 } }
    },
    ApiEngine: { Run: (key, value) => { notices.push([key, value]); return { Code: 1 } } }
  })
  assert.equal(run(manager).Code, 1)
  assert.equal(updates[0]._RowModel.HouxuFZRID, next.Id)
  assert.equal(logs[0].ActionKey, 'supportReassign')
  assert.equal(notices[0][1].ReceiverUserIds[0], next.Id)
  assert.equal(run({ ...manager, TenantId: 'tenant-b' }).Code, 0)
  assert.equal(updates.length, 1)
})
