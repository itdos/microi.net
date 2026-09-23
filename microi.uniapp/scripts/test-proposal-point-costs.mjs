import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {
  calculateCurrentProposalCosts, calculateInstallationPointCosts,
  aggregateInstallationPointCosts, proposalCostYears, validateProposalCostInputs
} from '../src/tenants/xjy/proposal-cost-model.mjs'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 测试使用隔离生成物，既不依赖未提交的租户同步目录，也不覆盖已回读的线上版本。
const engineRoot = path.resolve(project, '../.tmp/proposal-point-costs-tests', String(process.pid))
execFileSync(process.execPath, [path.join(project, 'scripts/build-proposal-cost-resources.mjs'), '--output-root', engineRoot])
const points = [
  { Id: 'a', AnzhuangdianweiId: 'plan', ShebeiSL: 2, Renshu: 100, ShebeiDJZL: 1200, ShebeiDJ: 6000, GenghuanLXJG: 300 },
  { Id: 'b', AnzhuangdianweiId: 'plan', ShebeiSL: 3, Renshu: 60, ShebeiDJZL: 900, ShebeiDJ: 5000, GenghuanLXJG: 200 }
]

test('PC 点位行内保存及详情返回均通过低代码事件刷新主表比价信息', () => {
  const parent = fs.readFileSync(path.join(engineRoot, '表单引擎/需求方案（diy_kehufaxx）/表单V8事件/前端表单进入V8事件（InFormV8）.js'), 'utf8')
  const child = fs.readFileSync(path.join(engineRoot, '表单引擎/需求方案安装点位（diy_anzhuang_dw）/表单V8事件/前端表单提交后V8事件（OutFormV8）.js'), 'utf8')
  assert.match(parent, /window\.RefreshProposalAfterPointSaved/)
  assert.match(parent, /GetFormData\('diy_anzhuang_dw'/)
  assert.match(parent, /await V8\.RefreshProposalPointCosts\(\)/)
  assert.match(child, /await window\.CalcHezuohou\(\)/)
  assert.ok(child.indexOf('window.CalcHezuohou') < child.indexOf('V8.ParentV8'))

  const patches = JSON.parse(fs.readFileSync(path.join(project, 'resources/xjy/proposal-costs/field-patches.json'), 'utf8'))
  const childPatch = patches.find(item => item.tableId === '01KWGB9WD5AEQX19GQ1NP442TT')
  const targetIds = [
    '01KZWWHD2YBK4AYVAV9DWWZ4FG', '01KWH02DKG5QXSPDYZBN6KAR69',
    '01KZWWHDFDGEWFZJD5CEYVNTBE', '01KZWWHE7EQMWMWE61CB2W0CCW',
    '01KZWWHEBJENBC798EGC956ZMD', '01KZWWHEFMQVBVN8SNY9YDQMKS'
  ]
  const fields = childPatch.fieldList.filter(field => targetIds.includes(field.id))
  assert.equal(fields.length, targetIds.length)
  for (const field of fields) {
    assert.match(field.v8Code, /window\.RefreshProposalAfterPointSaved\(V8,/)
    assert.equal(JSON.parse(field.config).V8Code, field.v8Code)
  }
})

test('PC 行内编辑等待点位事务提交后才刷新，详情退出优先刷新当前主表实例', async () => {
  const parentSource = fs.readFileSync(path.join(engineRoot, '表单引擎/需求方案（diy_kehufaxx）/表单V8事件/前端表单进入V8事件（InFormV8）.js'), 'utf8')
  const scheduled = []
  let parentRefreshes = 0
  const form = { Id: 'plan', Renshu: 10, DangqianYSFS: '直饮机', DangqianYSSBSL: 1, HesuanNS: 5 }
  const window = {}
  const context = {
    window,
    setTimeout(callback) { scheduled.push(callback) },
    V8: {
      LoadMode: 'Run', FormMode: 'Edit', Form: form,
      FormSet(name, value) { form[name] = value }, FieldSet() {}, Tips() {},
      ApiEngine: { async Run() { parentRefreshes++; return { Code: 1, Data: [{ CostFields: { HezuoHYSZCBAll: parentRefreshes } }] } } },
      FormEngine: {}
    }
  }
  await new vm.Script(`(async function(){${parentSource}\n})()`).runInNewContext(context)
  assert.equal(parentRefreshes, 1)

  let pointReads = 0
  const pointV8 = {
    Form: { Id: 'point', Renshu: 20 },
    FormEngine: { async GetFormData() {
      pointReads++
      return { Code: 1, Data: { Id: 'point', Renshu: pointReads === 1 ? 10 : 20 } }
    } }
  }
  window.RefreshProposalAfterPointSaved(pointV8, { Renshu: 20 })
  while (scheduled.length) await scheduled.shift()()
  assert.equal(pointReads, 2)
  assert.equal(parentRefreshes, 2)
  assert.equal(form.HezuoHYSZCBAll, 2)

  const childSource = fs.readFileSync(path.join(engineRoot, '表单引擎/需求方案安装点位（diy_anzhuang_dw）/表单V8事件/前端表单提交后V8事件（OutFormV8）.js'), 'utf8')
  let currentParentRefreshes = 0
  let legacyParentRefreshes = 0
  await new vm.Script(`(async function(){${childSource}\n})()`).runInNewContext({
    window: { async CalcHezuohou() { currentParentRefreshes++ } },
    V8: { LoadMode: 'Run', ParentV8: { Form: {}, async RefreshProposalPointCosts() { legacyParentRefreshes++ } } }
  })
  assert.equal(currentParentRefreshes, 1)
  assert.equal(legacyParentRefreshes, 0)
})

test('不同型号、数量按点位计费，人数和租金不重复乘数量', () => {
  const first = calculateInstallationPointCosts(points[0], 5)
  assert.equal(first.HezuoHYDCB, 1500)
  assert.equal(first.HezuoHFWCB, 2400)
  assert.equal(first.HezuoHYSZCBAll, 5640)
  assert.equal(first.HezuoHYSZCB, 2820)
  const summary = aggregateInstallationPointCosts(points, 5)
  assert.equal(summary.HezuoHYSSBSL, 5)
  assert.equal(summary.HezuoHYSZCBAll, 10284)
  assert.equal(summary.DuonianLJCBAfter, 51420)
  assert.equal(summary.ShebeiMDCBDT, 27000)
  assert.equal(summary.DuonianLJCBMD, 58920)
  assert.equal(summary.ShisuanNS, 5)
  assert.equal(summary.ShisuanNSMD, 5)
})

test('修改试算年数后买断购置款仍只计一次，所有点位使用同一年数', () => {
  const summary = aggregateInstallationPointCosts(points, 7)
  assert.equal(summary.DuonianLJCBMD, 27000 + (5184 + 1200) * 7)
  assert.equal(summary.DuonianLJCBAfter, 10284 * 7)
  assert.equal(summary.ShisuanNS, 7)
  assert.equal(proposalCostYears({ HesuanNS: 7, ShisuanNS: 3, ShisuanNSMD: 9 }), 7)
})

test('删除、空点位及超过一页点位都完整汇总', () => {
  assert.equal(aggregateInstallationPointCosts([points[0], { ...points[1], IsDeleted: 1 }], 5).HezuoHYSSBSL, 2)
  const empty = aggregateInstallationPointCosts([], 5)
  assert.equal(empty.DuonianLJCBMD, 0)
  assert.equal(empty.ChangsuoDWSL, 0)
  assert.equal(empty.ShisuanNS, 5)
  const many = aggregateInstallationPointCosts(Array.from({ length: 1001 }, () => points[0]), 5)
  assert.equal(many.ChangsuoDWSL, 1001)
  assert.equal(many.HezuoHYSZCBAll, 5640 * 1001)
})

test('部分点位缺价时逐字段累加已有金额，全部缺价与有效零价分开', () => {
  const missing = aggregateInstallationPointCosts([points[0], { ...points[1], ShebeiDJZL: null }], 5)
  assert.equal(missing.DuonianLJCBAfter, 28200)
  assert.equal(missing.HezuoHFWCB, 2400)
  assert.equal(missing.HezuoHYSZCBAll, 5640)
  assert.equal(missing.DuonianLJCBMD, 58920)
  assert.equal(calculateInstallationPointCosts({ ShebeiSL: 1, Renshu: 0, ShebeiDJZL: 0, ShebeiDJ: 0 }, 5).DuonianLJCBAfter, 0)
  const allMissing = aggregateInstallationPointCosts([{ ShebeiSL: 1 }], 5)
  assert.equal(allMissing.DuonianLJCBAfter, null)
  assert.equal(allMissing.ShebeiMDCBDT, null)
  const mixed = aggregateInstallationPointCosts([{ ShebeiSL: 1, ShebeiDJZL: 0, ShebeiDJ: 0 }, { ShebeiSL: 1 }], 5)
  assert.equal(mixed.DuonianLJCBAfter, 0)
  assert.equal(mixed.ShebeiMDCBDT, 0)
})

test('截图场景：空报价旧点位不抵消 FY-150K 点位金额，顺序不影响结果', () => {
  const quoted = { ShebeiSL: 1, Renshu: null, ShebeiDJZL: 5500, ShebeiDJ: 15500, GenghuanLXJG: 1940 }
  const empty = { ShebeiSL: null, Renshu: null, ShebeiDJZL: null, ShebeiDJ: null, GenghuanLXJG: null }
  const result = aggregateInstallationPointCosts([quoted, empty], 5)
  assert.equal(result.HezuoHFWCB, 5500)
  assert.equal(result.HezuoHYSZCBAll, 5500)
  assert.equal(result.DuonianLJCBAfter, 27500)
  assert.equal(result.ShebeiMDCBDT, 15500)
  assert.equal(result.HezuoHFWCBMD, 1940)
  assert.equal(result.HezuoHYSZCBAllMD, 1940)
  assert.equal(result.DuonianLJCBMD, 25200)
  assert.equal(result.ShisuanNS, 5)
  assert.equal(result.HezuoHYSSBSL, 2)
  assert.deepEqual(aggregateInstallationPointCosts([empty, quoted], 5), result)
})

test('合作前公式保持主表原口径，合作后汇总没有任何当前成本字段', () => {
  const form = { Renshu: 100, DangqianYSFS: '老式开水机（无过滤）', DangqianYSSBSL: 2, HesuanNS: 5 }
  const current = calculateCurrentProposalCosts(form)
  assert.equal(current.DangqianYDCB, 9000)
  assert.equal(current.DangqianFWCB, 1000)
  assert.equal(current.DangqianYSZCBAll, 19480)
  assert.equal(current.DuonianLJCB, 97400)
  assert.equal(calculateCurrentProposalCosts({ ...form, DangqianYSFS: '桶装水', TongzhuangSDJ: 10 }).DangqianYSZCBAll, 46000)
  assert.ok(Object.keys(aggregateInstallationPointCosts(points, 5)).every(key => !key.startsWith('Dangqian') && key !== 'DuonianLJCB'))
})

test('金额舍入、数量和年数输入校验', () => {
  assert.ok(validateProposalCostInputs({ ShebeiSL: 0 }, true))
  assert.ok(validateProposalCostInputs({ ShebeiDJ: 'abc' }, true))
  assert.ok(validateProposalCostInputs({ HesuanNS: 0 }, false))
  assert.equal(validateProposalCostInputs({ DangqianYSSBSL: 0 }, false), '')
  const point = calculateInstallationPointCosts({ ShebeiSL: 3, Renshu: 1, ShebeiDJ: 100, ShebeiDJZL: 0, GenghuanLXJG: 0 }, 7)
  assert.equal(point.DuonianLJCBMD, 526.8)
})

test('单台饮水成本等于三项费用之和，购置款不影响年饮水成本', () => {
  const p = { ShebeiSL: 2, Renshu: 100, ShebeiDJZL: 5500, ShebeiDJ: 15500, GenghuanLXJG: 1940 }
  const row = calculateInstallationPointCosts(p, 5)
  assert.equal(row.HezuoHYSZCB, 5500 + 1500 + 120)
  assert.equal(row.HezuoHFWCB, 11000)
  assert.equal(row.HezuoHFWCBMD, 3880)
  assert.equal(row.HezuoHYSZCBMD, 1940 + 1500 + 120)
  assert.equal(row.HezuoHYSZCBAllMD, 7120)
  assert.equal(row.DuonianLJCBMD, 31000 + 7120 * 5)
  assert.equal(calculateInstallationPointCosts({ ...p, ShebeiDJ: 99999 }, 7).HezuoHYSZCBMD, 3560)
})

test('当前服务费跟随现状设备数量，忽略旧方案数量且总成本不重复乘数量', () => {
  const form = { Renshu: 10, DangqianYSFS: '老式开水机（无过滤）', DangqianYSSBSL: 2, ShebeiSL: 99, HesuanNS: 5 }
  const row = calculateCurrentProposalCosts(form)
  assert.equal(row.DangqianFWCB, 1000)
  assert.equal(row.DangqianYSZCB, 1424)
  assert.equal(row.DangqianYSZCBAll, 2848)
  assert.equal(row.DuonianLJCB, 14240)
  assert.equal(calculateCurrentProposalCosts({ ...form, DangqianYSSBSL: 3 }).DangqianFWCB, 1500)
  assert.equal(calculateCurrentProposalCosts({ ...form, DangqianYSSBSL: 0 }).DangqianFWCB, 0)
  assert.equal(calculateCurrentProposalCosts({ ...form, DangqianYSSBSL: 0 }).DangqianYSZCBAll, 0)
  assert.equal(calculateCurrentProposalCosts({ ...form, DangqianYSFS: '直饮机' }).DangqianFWCB, 0)
})

test('截图中点位服务费乘数量，主表直接累加服务费合计', () => {
  const first = { ShebeiSL: 2, Renshu: 100, ShebeiDJZL: 5500, ShebeiDJ: 15500, GenghuanLXJG: 1940 }
  const second = { ShebeiSL: 1, Renshu: 10, ShebeiDJZL: 3100, ShebeiDJ: 7000, GenghuanLXJG: 1040 }
  const summary = aggregateInstallationPointCosts([first, second], 5)
  assert.equal(summary.HezuoHFWCB, 14100)
  assert.equal(summary.HezuoHFWCBMD, 4920)
  assert.equal(summary.HezuoHYSZCBAll, 17664)
  assert.equal(summary.HezuoHYSZCBAllMD, 8484)
  assert.equal(summary.DuonianLJCBMD, 80420)
  const updated = calculateInstallationPointCosts({ ...first, ShebeiSL: 3 }, 5)
  assert.equal(updated.HezuoHFWCB, 16500)
  assert.equal(updated.HezuoHFWCBMD, 5820)
  assert.equal(updated.HezuoHYSZCBAll, 19740)
  assert.equal(updated.DuonianLJCBMD, 91800)
})

// 执行发布的真实后端事件文本，检查部分更新、伪造金额和跨表事务边界。
function eventSource(table, label, type, chinese) {
  return fs.readFileSync(path.join(engineRoot, `表单引擎/${label}（${table}）/表单V8事件/${chinese}（${type}）.js`), 'utf8')
}
function runEvent(source, v8) {
  return new vm.Script(`(function(){${source}\n})()`).runInNewContext({ V8: v8 })
}
function transaction(plan = { Id: 'plan', HesuanNS: 5 }, rows = points) {
  return { FromSql(sql) { return { AddInParameter() { return this }, First() { return plan }, ToArray() { return rows } } } }
}

test('点位后端忽略伪造汇总和年数，部分更新合并旧型号价格', () => {
  const v8 = { Form: { Id: 'a', AnzhuangCS: '更名', ShisuanNS: 99, HezuoHYSZCBAll: 1 }, OldForm: points[0], DbTrans: transaction(), FormSubmitAction: 'Upt' }
  const result = runEvent(eventSource('diy_anzhuang_dw', '需求方案安装点位', 'SubmitBeforeServerV8', '后端表单提交前V8事件'), v8)
  assert.equal(result.Code, 1)
  assert.equal(v8.Form.HezuoHYSZCBAll, 5640)
  assert.equal(v8.Form.ShisuanNS, 5)
})

test('点位删除后只写父方案合作后派生字段，并共享原事务', () => {
  let written
  const tx = transaction(undefined, [points[1]])
  const v8 = { Form: { Id: 'a' }, OldForm: points[0], DbTrans: tx, FormSubmitAction: 'Del', FormEngine: {
    UptFormData(table, values, db) { assert.equal(table, 'diy_kehufaxx'); assert.equal(db, tx); written = values; return { Code: 1 } }
  } }
  const result = runEvent(eventSource('diy_anzhuang_dw', '需求方案安装点位', 'SubmitAfterServerV8', '后端表单提交后V8事件'), v8)
  assert.equal(result.Code, 1)
  assert.equal(written.ChangsuoDWSL, 1)
  assert.equal(written.DuonianLJCBAfter, 23220)
  assert.ok(!('DangqianYDCB' in written))
  assert.ok(!('Renshu' in written))
})

test('主表改年数批量重算子表且拒绝伪造总费用', () => {
  let updates
  const tx = transaction()
  const v8 = { Form: { Id: 'plan', HesuanNS: 7, DuonianLJCBMD: 1 }, OldForm: { Id: 'plan', Renshu: 100, DangqianYSFS: '直饮机', DangqianYSSBSL: 1 }, DbTrans: tx, FormSubmitAction: 'Upt', FormEngine: {
    UptTableData(rows, db) { assert.ok(rows.every(row => row.FormEngineKey === 'diy_anzhuang_dw')); assert.equal(db, tx); updates = rows; return { Code: 1 } }
  } }
  const result = runEvent(eventSource('diy_kehufaxx', '需求方案', 'SubmitBeforeServerV8', '后端表单提交前V8事件'), v8)
  assert.equal(result.Code, 1)
  assert.equal(updates.length, 2)
  assert.ok(updates.every(row => row.ShisuanNS === 7 && row.ShisuanNSMD === 7))
  assert.equal(v8.Form.DuonianLJCBMD, 71688)
})

test('服务器 Insert 动作首次保存无需锁尚未存在的父记录，Delete 不重算已删除方案', () => {
  const source = eventSource('diy_kehufaxx', '需求方案', 'SubmitBeforeServerV8', '后端表单提交前V8事件')
  const v8 = { Form: { HesuanNS: 5, Renshu: 100, DangqianYSFS: '直饮机' }, FormSubmitAction: 'Insert' }
  assert.equal(runEvent(source, v8).Code, 1)
  assert.equal(v8.Form.HezuoHYSZCBAll, 0)
  assert.equal(v8.Form.ShisuanNS, 5)
  assert.equal(runEvent(source, { Form: { Id: 'deleted-plan' }, FormSubmitAction: 'Delete' }).Code, 1)
})

test('组内分隔标题在折叠组中保留顺序且不拆组', () => {
  const source = fs.readFileSync(path.join(project, 'src/platform/native-form.js'), 'utf8')
  const start = source.indexOf('export function groupFields(')
  const end = source.indexOf('\nfunction buildDefinition', start)
  const group = new vm.Script(source.slice(start, end).replace('export ', '') + '\ngroupFields').runInNewContext({
    LAYOUT_COMPONENTS: new Set(['Divider','Tabs']), RELATED_COMPONENTS: new Set(['TableChild']), GUARDED_COMPONENTS: new Set(),
    configBoolean: (value, fallback) => value === undefined ? fallback : !!value
  })
  const fields = [
    { Name: 'compare', Label: '比价信息', component: 'CollapseGroup' },
    { Name: 'before', Label: '合作前成本', component: 'Divider' },
    { Name: 'current', component: 'Text' },
    { Name: 'rent', Label: '合作后成本（租赁）', component: 'Divider' },
    { Name: 'rentTotal', component: 'Text' },
    { Name: 'buy', Label: '合作后成本（买断）', component: 'Divider' },
    { Name: 'buyTotal', component: 'Text' }
  ].map(field => ({ ...field, visible: true }))
  const groups = group(fields)
  assert.equal(groups.length, 1)
  assert.deepEqual(Array.from(groups[0].fields, field => field.Name), ['before','current','rent','rentTotal','buy','buyTotal'])
})
