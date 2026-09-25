import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parse, compileTemplate } from '@vue/compiler-sfc'

const engineDir = new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/', import.meta.url)
const readEngine = (name) => fs.readFileSync(new URL(name, engineDir), 'utf8')
const executeAcceptance = new Function('V8', readEngine('移动端-任务验收功能(task_acceptance).js'))
const executeAuthorization = new Function('V8', readEngine('售后流程动作授权(shouhoudd_authorize_flow_action).js'))
const executeFinish = new Function('V8', readEngine('售后服务订单服务完成(shouhoudd_finish).js'))
const executeEvaluation = new Function('V8', readEngine('售后服务订单评价(shouhoudd_pingjia).js'))

const enabledPolicy = (patch = {}) => ({ Code: 1, Data: {
  Enabled: 1, NeedMerchantAcceptance: 1, NeedCustomerAcceptance: 1,
  NeedEvaluation: 1, AllowTaskOverride: 1, ...patch
} })

test('小程序任务详情 Vue 模板可编译', () => {
  const filename = new URL('../src/pages/task/detail.vue', import.meta.url)
  const parsed = parse(fs.readFileSync(filename, 'utf8'), { filename: filename.pathname })
  assert.deepEqual(parsed.errors, [])
  const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: filename.pathname, id: 'task-detail-policy' })
  assert.deepEqual(compiled.errors, [])
})

function runFinish(policy, taskPatch = {}) {
  const task = {
    Id: 'task-1', LeixingZ: 7, ZhuangtaiZ: 2, Zhuangtai: '待服务',
    PolicyOverrideEnabled: 0, MerchantAcceptanceOverride: 1,
    CustomerAcceptanceOverride: 1, EvaluationOverride: 1, ...taskPatch
  }
  let updated
  const v8 = {
    Param: { Id: task.Id }, DbTrans: { Commit() {}, Rollback() {} },
    Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' },
    Db: { FromSql: () => ({ AddInParameter() { return this }, First: () => null }) },
    FormEngine: {
      GetFormData: (query) => {
        if (query.FormEngineKey === 'Diy_ShouhouDD') return { Code: 1, Data: task }
        if (query.FormEngineKey === 'Diy_ShouhouTypePolicy') return policy
        throw new Error(`unexpected table ${query.FormEngineKey}`)
      },
      UptFormData: (table, value) => { if (table === 'Diy_ShouhouDD') updated = value; return { Code: 1 } },
      AddFormData: () => ({ Code: 1 })
    }
  }
  executeFinish(v8)
  return { result: v8.Result, updated }
}

test('服务完成按四项类型策略进入商家验收、评价或结束', () => {
  assert.equal(runFinish(enabledPolicy()).updated.ZhuangtaiZ, 11)
  assert.equal(runFinish(enabledPolicy({ NeedMerchantAcceptance: 0 })).updated.ZhuangtaiZ, 3)
  assert.equal(runFinish(enabledPolicy({ NeedMerchantAcceptance: 0, NeedEvaluation: 0 })).updated.ZhuangtaiZ, 9)
  assert.equal(runFinish({ Code: 2 }).updated.ZhuangtaiZ, 11)
})

test('允许时单任务覆盖优先于类型策略，禁止时忽略覆盖', () => {
  const task = { PolicyOverrideEnabled: 1, MerchantAcceptanceOverride: 0, CustomerAcceptanceOverride: 0, EvaluationOverride: 0 }
  assert.equal(runFinish(enabledPolicy(), task).updated.ZhuangtaiZ, 9)
  assert.equal(runFinish(enabledPolicy({ AllowTaskOverride: 0 }), task).updated.ZhuangtaiZ, 11)
})

function runAcceptance({ type = 1, state = 11, policy = enabledPolicy(), taskPatch = {} } = {}) {
  const task = {
    Id: 'task-1', ShouhouFWBH: 'SH001', TenantId: 'tenant-1', TenantName: '测试商家',
    KehuID: 'customer-1', LeixingZ: 7, ZhuangtaiZ: state,
    Zhuangtai: state === 11 ? '待客服验收' : state === 9 ? '已结束' : state === 12 ? '待客户验收' : '待评价',
    PolicyOverrideEnabled: 0, MerchantAcceptanceOverride: 1,
    CustomerAcceptanceOverride: 1, EvaluationOverride: 1, ...taskPatch
  }
  const updates = []
  const added = []
  let notified = false
  const v8 = {
    Param: { Id: task.Id, type, ShangjiaYSYJ: '需返工', KehuYSYJ: '客户要求返工' },
    CurrentUser: { Id: 'user-1', RoleName: '客服' }, DbTrans: {},
    Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' },
    Method: { NewGuid: () => 'rework-1' },
    ApiEngine: { Run: (key, params) => {
      if (key === 'msg_event') { notified = true; return { Code: 1, Data: { Sent: 1 } } }
      return { Code: 1, Data: { Task: task, ActionName: params.ActionKey, Operator: { Id: 'user-1', Name: '测试客户' } } }
    } },
    FormEngine: {
      GetFormData: (query) => {
        if (query.FormEngineKey === 'Diy_ShouhouTypePolicy') return policy
        if (query.FormEngineKey === 'Sys_User') return { Code: 1, Data: { Id: 'user-1', State: 1, RoleIds: '客服', TenantId: 'tenant-1' } }
        if (query.FormEngineKey === 'Diy_ShouhouDD' && query._Where) return { Code: 2 }
        if (query.FormEngineKey === 'Diy_ShouhouDD') return { Code: 1, Data: task }
        throw new Error(`unexpected table ${query.FormEngineKey}`)
      },
      GetTableData: ({ FormEngineKey }) => FormEngineKey === 'diy_shouhousp' ? { Code: 1, Data: [], DataCount: 0 } : { Code: 0 },
      UptFormData: (value) => { updates.push(value._RowModel); return { Code: 1 } },
      AddFormData: (value) => { added.push(value); return { Code: 1 } }
    }
  }
  return { result: executeAcceptance(v8), updates, added, notified }
}

test('商家验收不等待客户验收，按评价策略进入待评价或结束', () => {
  assert.equal(runAcceptance().updates[0].ZhuangtaiZ, 3)
  assert.equal(runAcceptance({ policy: enabledPolicy({ NeedCustomerAcceptance: 0, NeedEvaluation: 0 }) }).updates[0].ZhuangtaiZ, 9)
})

test('客户未结案不通过退回原任务，已结案不通过创建关联返工任务并通知客服', () => {
  const pending = runAcceptance({ type: 4, state: 3 })
  assert.equal(pending.result.Code, 1)
  assert.equal(pending.updates[0].ZhuangtaiZ, 2)
  assert.equal(pending.notified, true)
  const ended = runAcceptance({ type: 4, state: 9 })
  assert.equal(ended.result.Data.ReworkTaskId, 'rework-1')
  const rework = ended.added.find((item) => item.FormEngineKey === 'Diy_ShouhouDD')._RowModel
  assert.equal(rework.ReworkSourceTaskId, 'task-1')
  assert.equal(rework.ZhuangtaiZ, 2)
  assert.equal(rework.Zhuangtai, '待服务')
  assert.equal(ended.notified, true)
})

function runAuthorization({ actionKey = 'customerPass', account = '13800000002', linked = '13800000001,13800000002', taskPatch = {}, policy = enabledPolicy() } = {}) {
  const task = {
    Id: 'task-1', KehuID: 'customer-1', LeixingZ: 1,
    ZhuangtaiZ: actionKey === 'evaluate' ? 3 : 9, Zhuangtai: actionKey === 'evaluate' ? '待评价' : '已结束',
    KehuYSZT: '', Pingjia: '', PolicyOverrideEnabled: 0,
    CustomerAcceptanceOverride: 1, EvaluationOverride: 1, ...taskPatch
  }
  const v8 = {
    Param: { TaskId: task.Id, ActionKey: actionKey, OperatorUserId: 'customer-user' },
    CurrentUser: { Id: 'customer-user' }, DbTrans: {},
    FormEngine: { GetFormData: ({ FormEngineKey }) => {
      if (FormEngineKey === 'Diy_ShouhouDD') return { Code: 1, Data: task }
      if (FormEngineKey === 'Sys_User') return { Code: 1, Data: { Id: 'customer-user', Name: '客户', Account: account, Phone: '', State: 1 } }
      if (FormEngineKey === 'Diy_ShouhouTypePolicy') return policy
      if (FormEngineKey === 'Diy_Kehu') return { Code: 1, Data: { Id: 'customer-1', KehuGLZH: linked } }
      throw new Error(`unexpected table ${FormEngineKey}`)
    } }
  }
  return executeAuthorization(v8)
}

test('多个关联客户账号均可验收和评价，非关联及子串账号被拒绝', () => {
  assert.equal(runAuthorization().Code, 1)
  assert.equal(runAuthorization({ actionKey: 'evaluate' }).Code, 1)
  assert.equal(runAuthorization({ account: '1380000000' }).Code, 0)
  assert.equal(runAuthorization({ account: '13900000000' }).Code, 0)
})

test('关闭客户验收后拒绝验收；已进入待评价的存量任务仍可完成评价', () => {
  assert.equal(runAuthorization({ policy: enabledPolicy({ NeedCustomerAcceptance: 0 }) }).Code, 0)
  assert.equal(runAuthorization({ actionKey: 'evaluate', policy: enabledPolicy({ NeedEvaluation: 0 }) }).Code, 1)
})

test('商家平均分排除有效策略不提供客户验收的任务，并尊重单任务覆盖', () => {
  let tenantScore
  const task = { Id: 'task-1', TenantId: 'tenant-1', ZhuangtaiZ: 3, Zhuangtai: '待评价', LeixingZ: 1 }
  const v8 = {
    Param: { Id: task.Id, Pingjia: 5, ShebeiPJ: 5, RenyuanPJ: 5 },
    CurrentUser: { Id: 'customer-user' }, DbTrans: {},
    Action: { GetDateTimeNow: () => '2026-09-23 12:00:00' },
    ApiEngine: { Run: () => ({ Code: 1, Data: { Task: task, Operator: { Id: 'customer-user' }, RoleIds: [] } }) },
    FormEngine: {
      GetFormData: () => ({ Code: 1, Data: { Id: 'customer-user', Name: '客户', State: 1 } }),
      GetTableData: ({ FormEngineKey }) => FormEngineKey === 'Diy_ShouhouTypePolicy'
        ? { Code: 1, Data: [{ TypeKey: '7', NeedCustomerAcceptance: 0, AllowTaskOverride: 1 }], DataCount: 1 }
        : { Code: 1, Data: [
          { LeixingZ: 7, Pingjia: 1, ShebeiPJ: 1, RenyuanPJ: 1 },
          { LeixingZ: 7, PolicyOverrideEnabled: 1, CustomerAcceptanceOverride: 1, Pingjia: 1, ShebeiPJ: 1, RenyuanPJ: 1 },
          { LeixingZ: 1, Pingjia: 5, ShebeiPJ: 5, RenyuanPJ: 5 },
          { LeixingZ: 4, Pingjia: null, ShebeiPJ: null, RenyuanPJ: null }
        ], DataCount: 4 },
      UptFormData: ({ FormEngineKey, _RowModel }) => { if (FormEngineKey === 'Diy_Tenant') tenantScore = _RowModel.ShangjiaPF; return { Code: 1 } },
      AddFormData: () => ({ Code: 1 })
    }
  }
  assert.equal(executeEvaluation(v8).Code, 1)
  assert.equal(tenantScore, '2')
})
