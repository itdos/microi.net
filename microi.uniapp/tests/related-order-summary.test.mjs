import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { loadRelatedListSummary, formatRelatedSummaryMoney } from '../src/platform/related-list-summary.mjs'

const source = fs.readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8')
const metadata = JSON.parse(fs.readFileSync(new URL('../profiles/xjy/metadata/order-list-statistics.json', import.meta.url), 'utf8'))
const config = { table: metadata.table, statusField: 'DingdanZT', statusOptions: ['待审批', '已审批'], relatedSummary: { apiEngineKey: metadata.engineKey },
  relatedMetrics: metadata.metrics.map(m => ({ key: m.Key, label: m.Label, format: 'compactMoney', unit: '' })) }
const data = { Metrics: { rental: '128000', buyout: '400', annualFilter: '20', sum: '21000' }, StatusCounts: { All: 2, 待审批: 1, 已审批: 1 } }
const plain = value => JSON.parse(JSON.stringify(value))
function component(run = async () => ({ Code: 1, Data: data })) {
  const requests = []
  const scope = { loadRelatedListSummary, formatRelatedSummaryMoney, getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {}, clearTimeout,
    resolveListReadApi: () => '', loadModuleRows: async (config, options) => { requests.push(options); return { rows: [], count: 0 } },
    V8: { ApiEngine: { Run: run } } }
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '').replace('export default {', 'globalThis.component = {')
  vm.runInNewContext(script, scope)
  const definition = scope.component
  const state = { ...definition.data(), ...definition.methods, config, menuId: '', relationValue: 'customer-A', childFkField: 'KehuID', isPreview: false,
    tableChildAuth: { ParentRowId: 'customer-A', ParentFieldId: 'orders-field' },
    buildFilterWhere: () => [{ Name: 'DingdanJE', Type: '>=', Value: 100 }], buildKeywordFilterWhere: () => [],
    scheduleListBodyMeasure() {}, requiresModuleAssociationQuery: () => true, relatedSelectFields: () => ['Id'],
    hydrateProposalInstallationPointRows: async rows => rows, hydrateCollectionRows: async rows => rows }
  for (const key of ['relatedMetricDefinitions', 'showRelatedSummary', 'relatedMetrics']) Object.defineProperty(state, key, { get: () => definition.computed[key].call(state) })
  return { state, definition, requests }
}

test('关联四金额与主列表定义一致，单次请求保留父记录、授权链和筛选，不把快捷状态放进角标范围', async () => {
  const calls = []
  const { state } = component(async (key, params) => { calls.push({ key, params }); return { Code: 1, Data: data } })
  state.keyword = '学校'; state.relatedStatus = '待审批'
  await state.loadRelatedMetrics()
  assert.equal(calls.length, 1)
  assert.deepEqual(plain(calls[0].params._TableChildAuth), state.tableChildAuth)
  assert.deepEqual(plain(calls[0].params.Filters._Where), [{ Name: 'KehuID', Type: '=', Value: 'customer-A' }, { Name: 'DingdanJE', Type: '>=', Value: 100 }])
  assert.equal(calls[0].params.Filters.SelectedStatus, '待审批')
  assert.equal(calls[0].params.Filters._Keyword, '学校')
  assert.equal(calls[0].params.Filters.ValidOnly, true)
  assert.deepEqual(state.relatedMetrics.map(m => m.label), ['租赁总价', '买断总价', '包年换芯总价', '订单金额合计'])
  assert.equal(state.relatedStatusCount('已审批'), 1)
  assert.equal(state.relatedStatusCount('已作废'), 0)
  assert.equal(state.relatedMetrics[0].value, '¥12.80万')
})

test('有效期开关只重算统计，保留关键词、列表、状态、分页；重置恢复全部和默认开关', async () => {
  const { state } = component()
  state.rows = [{ Id: 'order' }]; state.pageIndex = 3; state.keyword = '学校'; state.relatedStatus = '已审批'
  state.loadData = () => { throw new Error('切换有效期不应请求列表') }
  await state.toggleRelatedValidity()
  assert.equal(state.relatedValidOnly, false); assert.equal(state.pageIndex, 3); assert.equal(state.rows.length, 1)
  assert.equal(state.keyword, '学校'); assert.equal(state.relatedStatus, '已审批')
  state.refreshFilteredRows = () => {}
  state.resetSearch()
  assert.equal(state.relatedStatus, ''); assert.equal(state.relatedValidOnly, true); assert.equal(state.keyword, '')
})

test('快捷状态实际过滤列表，金额查询保留其余状态的角标', async () => {
  const { state, requests } = component()
  await state.changeRelatedStatus('已审批')
  assert.ok(requests[0].extraWhere.some(w => w.Name === 'DingdanZT' && w.Value === '已审批'))
  assert.ok(requests[0].extraWhere.some(w => w.Name === 'KehuID' && w.Value === 'customer-A'))
  assert.equal(state.relatedStatusCount('待审批'), 1)
})

test('卡片未展示状态标签时，快捷状态仍使用统计配置的状态字段筛选', async () => {
  const { state, requests } = component()
  state.config = { ...config, statusField: '', relatedSummary: { ...config.relatedSummary, statusField: 'DingdanZT' } }
  await state.changeRelatedStatus('待审批')
  assert.ok(requests[0].extraWhere.some(w => w.Name === 'DingdanZT' && w.Value === '待审批'))
})

test('快速切换时迟到结果不能覆盖新口径，卸载或更换父客户后不能回写', async () => {
  const pending = []
  const { state } = component(() => new Promise(resolve => pending.push(resolve)))
  const old = state.loadRelatedMetrics()
  const current = state.toggleRelatedValidity()
  pending[1]({ Code: 1, Data: { ...data, Metrics: { ...data.Metrics, rental: '238000' } } }); await current
  pending[0]({ Code: 1, Data: data }); await old
  assert.equal(state.metricValues.rental, '238000')
  const stale = state.loadRelatedMetrics(); state.relationValue = 'customer-B'
  pending[2]({ Code: 1, Data: data }); await stale
  assert.deepEqual(plain(state.metricValues), {})
  const disposed = state.loadRelatedMetrics(); state.componentDisposed = true
  pending[3]({ Code: 1, Data: data }); await disposed
  assert.deepEqual(plain(state.metricValues), {})
})

test('权限或不完整响应显示错误和未知金额，可重试；不能伪装为零', async () => {
  const { state } = component(async () => ({ Code: 0, Msg: '没有权限' }))
  await state.loadRelatedMetrics()
  assert.equal(state.relatedSummaryError, '没有权限')
  assert.ok(state.relatedMetrics.every(m => m.value === '—'))
  assert.equal(state.relatedStatusCount('待审批'), '—')
  await assert.rejects(() => loadRelatedListSummary({ config, menuId: 'menu', run: async () => ({ Code: 1, Data: { ...data, Metrics: { rental: null } } }) }), /不完整/)
})

test('无父记录不请求统计；旧关联模块沿用原来的统计和样式', async () => {
  const { state } = component(() => { throw new Error('不应查询') })
  state.relationValue = ''; await state.loadRelatedMetrics()
  state.config = { relatedMetrics: [{ key: 'total', label: '总量' }] }; state.metricValues = { total: 3 }
  assert.equal(state.showRelatedSummary, false); assert.equal(state.relatedMetrics[0].value, 3)
})
