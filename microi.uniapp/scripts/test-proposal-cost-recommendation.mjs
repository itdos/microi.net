import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { aggregateInstallationPointCosts } from '../src/tenants/xjy/proposal-cost-model.mjs'
import { buildProposalCostRecommendation } from '../src/tenants/xjy/proposal-cost-recommendation.mjs'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engineRoot = path.resolve(project, '../.tmp/proposal-recommendation-tests', String(process.pid))
execFileSync(process.execPath, [path.join(project, 'scripts/build-proposal-cost-resources.mjs'), '--engine-only', '--output-root', engineRoot])
const engine = fs.readFileSync(path.join(engineRoot, '接口引擎/客户管理/客户方案一键比价(xjy_compare_customer_proposals).js'), 'utf8')
const point = { AnzhuangCS: '教学楼', ShebeiMC: '直饮设备', ShebeiXH: 'A', Renshu: 100, ShebeiSL: 2,
  ShebeiDJZL: 1200, ShebeiDJ: 6000, GenghuanLXJG: 300, ShuiwenYQ: '["温水","开水"]' }
function row(id, changes = {}, points = [point], years = 5) {
  const costs = aggregateInstallationPointCosts(points, years)
  return { Id: id, FanganMC: `方案${id}`, CustomerId: 'customer', Years: years, Locations: points,
    RentalMultiYearCost: costs.DuonianLJCBAfter, BuyoutMultiYearCost: costs.DuonianLJCBMD,
    BuyoutPriceTotal: costs.ShebeiMDCBDT, ...changes }
}
function compare(rows, options = {}) {
  return buildProposalCostRecommendation(rows, { Years: 5, ReferenceId: rows[0]?.Id, RequirementsConfirmed: true, ...options })
}

test('确认需求前不产生任何推荐；确认后给出最低成本和相对下一档的真实差额', () => {
  const rows = [row('A'), row('B', {}, [{ ...point, ShebeiDJZL: 1000, ShebeiDJ: 5500 }])]
  assert.equal(compare(rows, { RequirementsConfirmed: false }).Best.Winners.length, 0)
  const result = compare(rows)
  assert.equal(result.Rental.Winners[0].Id, 'B')
  assert.equal(result.Rental.GapToNext, 2000)
  assert.equal(result.Buyout.Winners[0].Id, 'B')
  assert.equal(result.Best.Winners[0].Mode, 'Rental')
  assert.equal(rows[0].CostReview.RentalRank, 2)
  assert.equal(rows[1].CostReview.RentalRank, 1)
})

test('截图经济性：买断五年少16500元，购置款计一次，买断年运行费不冒充总成本', () => {
  const screenshot = row('A', { RentalMultiYearCost: 95320, BuyoutMultiYearCost: 78820, BuyoutPriceTotal: 35000 })
  const result = compare([screenshot])
  assert.equal(result.Best.Winners[0].Mode, 'Buyout')
  assert.equal(result.Best.Winners[0].UpfrontCost, 35000)
  assert.equal(result.Best.GapToNext, 16500)
  assert.equal(result.Best.SavingPercent, 17.31)
  assert.equal(result.Status, 'limited', '单方案不宣称已经比较了其它方案')
})

test('多点位部分缺价不能因汇总金额低而胜出；租赁和买断分别判断完整性', () => {
  const partial = row('A', {}, [point, { ...point, AnzhuangCS: '办公楼', ShebeiDJZL: null }])
  const complete = row('B', {}, [point, { ...point, AnzhuangCS: '办公楼' }])
  assert.ok(partial.RentalMultiYearCost < complete.RentalMultiYearCost)
  const result = compare([partial, complete])
  assert.equal(partial.CostReview.RentalEligible, false)
  assert.equal(partial.CostReview.BuyoutEligible, true)
  assert.equal(result.Rental.Winners[0].Id, 'B')
  assert.match(partial.CostReview.RentalIssues.join(''), /办公楼.*租赁报价/)
})

test('未知滤芯费用不当作免费；合法零价保留，负数、NaN、布尔报价和无设备数量均排除', () => {
  for (const invalid of [null, '', -1, 'abc', true, Infinity]) {
    const item = row('A', {}, [{ ...point, GenghuanLXJG: invalid }])
    compare([item])
    assert.equal(item.CostReview.BuyoutEligible, false, `invalid ${invalid}`)
    assert.equal(item.CostReview.RentalEligible, true)
  }
  const free = row('A', {}, [{ ...point, ShebeiDJZL: 0, ShebeiDJ: 0, GenghuanLXJG: 0 }])
  assert.equal(compare([free]).Best.Winners.length, 2)
  for (const qty of [null, 0, 1.5, -2, true]) {
    const item = row('A', {}, [{ ...point, ShebeiSL: qty }])
    assert.equal(compare([item]).Status, 'no-candidates')
  }
})

test('不同客户、点位、人数、水温需求及缺少需求信息均不混排', () => {
  for (const changed of [row('B', { CustomerId: 'other' }), row('B', { CustomerId: '' }),
    row('B', {}, [{ ...point, Renshu: 20 }]), row('B', {}, [{ ...point, AnzhuangCS: '另一场所' }]),
    row('B', {}, [{ ...point, ShuiwenYQ: '["冰水"]' }]), row('B', {}, [])]) {
    const result = compare([row('A'), changed])
    assert.equal(result.EligiblePlanCount, 1)
    assert.equal(changed.CostReview.RentalEligible, false)
    assert.ok(changed.CostReview.ScopeReasons.length)
  }
})

test('不同设备数量和型号允许比较，点位与多选需求的顺序不影响同一需求判断', () => {
  const left = [point, { ...point, AnzhuangCS: '办公楼', Renshu: 50 }]
  const right = [...left].reverse().map(p => ({ ...p, ShebeiXH: 'B', ShebeiSL: 3, ShuiwenYQ: '["开水","温水"]' }))
  const result = compare([row('A', {}, left), row('B', {}, right)])
  assert.equal(result.EligiblePlanCount, 2)
})

test('同价保留全部并列最低，全部同价时不虚构节省百分比', () => {
  const rows = [row('B'), row('A')]
  const result = compare(rows)
  assert.deepEqual(result.Rental.Winners.map(item => item.Id), ['A', 'B'])
  assert.equal(result.Rental.GapToNext, null)
  assert.equal(result.Rental.SavingPercent, null)
  assert.ok(rows.every(item => item.CostReview.RentalRank === 1))
})

// 执行正式发布文本，模拟平台菜单授权与参数化只读会话；任何数据库写调用均不存在。
function runEngine(input, { plans, points = [], allowed = plans, user = { Id: 'user' } } = {}) {
  let reads = 0
  const bindings = []
  const result = new vm.Script(`(function(){${engine}\n})()`).runInNewContext({ V8: {
    Param: input, CurrentUser: user,
    FormEngine: { GetTableData(table, query) { reads++; assert.equal(query._SysMenuId, 'd242a6ec-6773-4307-9ffd-3f4ce47736fa'); return { Code: 1, Data: allowed } } },
    Db: { FromSql(sql) {
      reads++
      assert.ok(/^SELECT /i.test(sql))
      return { AddInParameter(name, value) { bindings.push([name, value]); return this }, ToArray() { return sql.includes('FROM diy_kehufaxx') ? plans : points } }
    } }
  } })
  return { result: JSON.parse(JSON.stringify(result)), reads, bindings }
}
const plans = [{ Id: 'A', KehuID: 'customer', FanganMC: '方案A', HesuanNS: 5 }, { Id: 'B', KehuID: 'customer', FanganMC: '方案B', HesuanNS: 10 }]
const storedPoints = plans.map(plan => ({ ...point, Id: `point-${plan.Id}`, AnzhuangdianweiId: plan.Id }))

test('真实接口按所选基准统一年数，保留旧Data契约且仅进行三次批量读取', () => {
  const { result, reads, bindings } = runEngine({ Ids: ['B', 'A'], RequirementsConfirmed: true }, { plans, points: storedPoints })
  assert.equal(result.Code, 1)
  assert.equal(reads, 3)
  assert.ok(bindings.every(([, value]) => ['A', 'B'].includes(value)))
  assert.deepEqual(result.Data.map(item => item.Id), ['B', 'A'])
  assert.ok(result.Data.every(item => item.Years === 10))
  assert.equal(result.DataAppend.Comparison.ReferenceId, 'B')
  assert.equal(result.DataAppend.Comparison.EligiblePlanCount, 2)
  const single = runEngine({ Ids: ['A'], Years: 7 }, { plans: [plans[0]], points: [storedPoints[0]] }).result
  assert.equal(single.Code, 1)
  assert.equal(single.Data[0].CostFields.ShisuanNS, 7)
  assert.equal(single.DataAppend.Comparison.RequirementsConfirmed, false)
})

test('部分无权查看时整次失败，不以剩余记录输出伪完整推荐，也不执行后续SQL', () => {
  const { result, reads } = runEngine({ Ids: ['A', 'B'], RequirementsConfirmed: true }, { plans, allowed: [plans[0]] })
  assert.equal(result.Code, 0)
  assert.equal(reads, 1)
})

test('伪造对象数组、SQL标识、年数、基准和布尔确认在访问数据库前被拒绝', () => {
  for (const input of [{ Ids: { 0: 'A', length: 1 } }, { Ids: ["A' OR 1=1"] },
    { Ids: ['A'], Years: true }, { Ids: ['A'], Years: 101 }, { Ids: ['A'], Years: 1.5 },
    { Ids: ['A'], ReferenceId: 'B' }, { Ids: ['A'], RequirementsConfirmed: 'true' }]) {
    const { result, reads } = runEngine(input, { plans })
    assert.equal(result.Code, 0)
    assert.equal(reads, 0)
  }
  assert.equal(runEngine({ Ids: ['A'] }, { plans, user: null }).reads, 0)
})

test('客户端伪造最低金额和已满足需求的方案正文不能影响服务端回读结论', () => {
  const result = runEngine({ Ids: ['A', 'B'], Years: 5, RequirementsConfirmed: true,
    Rows: [{ Id: 'A', RentalMultiYearCost: 0 }], CustomerId: 'forged' }, { plans, points: storedPoints }).result
  assert.equal(result.Code, 1)
  assert.ok(result.Data.every(item => item.RentalMultiYearCost > 0 && item.CustomerId === 'customer'))
})

function pageHarness(run) {
  const source = fs.readFileSync(path.join(project, 'src/pages/business/proposal-compare.vue'), 'utf8').split('<script>')[1].split('</script>')[0]
  const component = new vm.Script(source.replace(/^import .*$/gm, '').replace('export default', 'var component =') + '\ncomponent').runInNewContext({
    V8: { ApiEngine: { Run: run } }, themeMixin: {}, uni: { showToast() {}, navigateBack() {} }
  })
  const page = component.data()
  for (const [key, method] of Object.entries(component.methods)) page[key] = method.bind(page)
  page.proposalIds = ['A', 'B']
  return { page, component }
}
test('页面首次不代替用户确认，明确确认后才请求推荐；更换基准撤销原确认', async () => {
  const calls = []
  const { page } = pageHarness(async (key, params) => {
    calls.push(JSON.parse(JSON.stringify(params)))
    return runEngine(params, { plans, points: storedPoints }).result
  })
  await page.loadComparison()
  assert.equal(calls[0].RequirementsConfirmed, false)
  assert.equal(page.comparison.Best.Winners.length, 0)
  await page.confirmRequirements({ detail: { value: ['confirmed'] } })
  assert.equal(calls[1].RequirementsConfirmed, true)
  assert.ok(page.comparison.Best.Winners.length)
  await page.changeReference({ detail: { value: 1 } })
  assert.equal(calls[2].RequirementsConfirmed, false)
  assert.equal(calls[2].ReferenceId, 'B')
})
test('重算失败或旧响应迟到时不保留过期推荐，离开页面后不再回写', async () => {
  const pending = []
  const { page, component } = pageHarness(() => new Promise(resolve => pending.push(resolve)))
  const first = page.loadComparison(), second = page.loadComparison()
  const valid = runEngine({ Ids: ['A', 'B'] }, { plans, points: storedPoints }).result
  pending[1](valid); await second
  pending[0]({ Code: 0, Msg: '旧请求失败' }); await first
  assert.equal(page.errorMessage, '')
  const third = page.loadComparison()
  component.onUnload.call(page)
  pending[2]({ Code: 0, Msg: '页面已关闭' }); await third
  assert.equal(page.errorMessage, '')
  assert.equal(page.comparison, null)
})
