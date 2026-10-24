import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import paths from '../scripts/lib/workspace-paths.js'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const source = readFileSync(paths.findSyncedXjyEngine(projectRoot, 'dingdan_shenpi'), 'utf8')

// 执行完整审批脚本并捕获实际批量写入参数；数据库和下游引擎使用内存替身，不审批真实订单。
function approve(patch = {}, currentUser = { Id: 'approver', Name: '审批人' }) {
  const order = { Id: 'order', KehuID: 'customer', KehuMC: '客户', TenantId: 'merchant',
    DingdanBH: 'ORDER-1', DingdanZTZ: 1, ShifouXYAZ: true, LianxiR: '订单联系人',
    LianxiDH: 'order-phone', AnzhuangR: '安装人员', AnzhuangRID: 'installer',
    AnzhuangSJ: '2026-10-24 00:00', ...patch }
  const batches = []
  const positions = [{ Id: 'position', DingdanSPID: 'product', ShangpinBH: 'DEVICE-1' }]
  const transaction = { FromSql: (sql) => ({ AddInParameter() { return this },
    First: () => order, ToArray: () => sql.includes('FROM diy_shebeiwz') ? positions : [] }) }
  const V8 = { CurrentUser: currentUser, Param: { Id: order.Id, KehuLXRR: '客户端伪造联系人' }, DbTrans: transaction,
    FormEngine: {
      GetFormData: (query) => {
        const table = String(query.FormEngineKey || query.TableName).toLowerCase()
        return { Code: 1, Data: table === 'diy_kehu' ? { Id: 'customer', LianxiR: '客户当前联系人' } : order, DataCount: 1 }
      },
      GetTableData: (query) => {
        const table = String(query.FormEngineKey || query.ModuleEngineKey).toLowerCase()
        return { Code: 1, Data: table === 'diy_dingdansp'
          ? [{ Id: 'product', HezuoFS: '买断', ShangpinLXZ: 1, Shuliang: 1 }]
          : table === 'diy_shebeiwz' ? positions : [] }
      },
      AddFormDataBatch: (rows, trans) => { assert.equal(trans, transaction); batches.push(...rows); return { Code: 1 } },
      AddFormData: () => ({ Code: 1 }), UptFormData: () => ({ Code: 1 }), UptFormDataByWhere: () => ({ Code: 1 })
    },
    ApiEngine: { Run: (key, params, trans) => {
      assert.equal(trans, transaction)
      return { Code: 1, Data: key === 'xjy-order-status-policy' ? { DingdanZT: '进行中', DingdanZTZ: 2 }
        : key === 'shouhoudd_resolve_stage_owners' ? { HouxuFZRID: 'support-user' } : {} }
    } }
  }
  let n = 0
  const result = vm.runInNewContext(`(function(){${source}\n})()`, { V8,
    System: { Guid: { NewGuid: () => `generated-${++n}` } }, DateNow: () => '2026-10-23 15:00:00' })
  return { result: result || V8.Result, tasks: batches.filter((r) => r.FormEngineKey === 'Diy_ShouhouDD').map((r) => r._RowModel), batches }
}

test('安装任务真实联系人字段读取订单 LianxiR，并保留电话、安装人与后续客服', () => {
  const r = approve({ KehuLXRR: '旧错误属性' })
  assert.equal(r.result.Code, 1)
  assert.equal(r.tasks.length, 1)
  const task = r.tasks[0]
  assert.equal(task.KehuLXRR, '订单联系人')
  assert.equal(task.KehuDH, 'order-phone')
  assert.equal(task.ShouhouRYID, 'installer')
  assert.equal(task.HouxuFZRID, 'support-user')
  assert.equal(task.ShifouZQXSH, 0)
  assert.equal(task.Leixing, '安装')
  assert.equal(task.DingdanID, 'order')
  assert.equal('KehuLXR' in task, false)
})
test('缺少订单联系人时保存空值，不写 undefined 或信任客户端伪造值', () => {
  for (const LianxiR of [null, undefined, '']) assert.equal(approve({ LianxiR }).tasks[0].KehuLXRR, '')
})
test('不需要安装时不生成安装任务，拒绝重复审批和未登录调用', () => {
  assert.equal(approve({ ShifouXYAZ: false }).tasks.length, 0)
  for (const state of [2, 3, 7]) {
    const r = approve({ DingdanZTZ: state })
    assert.equal(r.result.Code, 0)
    assert.equal(r.batches.length, 0)
  }
  assert.equal(approve({}, null).result.Code, 0)
})
