import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as installation from '../src/tenants/xjy/proposal-installation-points.mjs'
import * as costs from '../src/tenants/xjy/proposal-cost-model.mjs'
import * as calculation from '../src/tenants/xjy/proposal-calculation.js'

const plain = (value) => JSON.parse(JSON.stringify(value))
const read = (file) => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const stripImports = (source) => source.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')

// 执行实际表单钩子、卡片事件和保存方法，仅替换网络与页面宿主。
function runtime({ draft = false, failure = false } = {}) {
  const writes = [], notices = [], summaries = []
  const other = { Id: 'point-2', ShebeiSL: 1, Renshu: 20, ShebeiDJZL: 100, ShebeiDJ: 1000, GenghuanLXJG: 50 }
  const point = { ...installation.proposalInstallationDraft('point-1'), ShebeiSL: 2, AnzhuangCS: '教学楼' }
  const saved = { ...point }
  const parent = { tableName: 'diy_kehufaxx', mode: draft ? 'Add' : 'Edit', rowId: draft ? '' : 'plan-1',
    state: {}, form: { Id: 'plan-1', HesuanNS: 7 }, patchForm(values) { Object.assign(this.form, values) } }
  const group = draft ? { rows: [point, other], parentForm: parent.form } : null
  const V8 = {
    FormEngine: { async UptFormData(table, values) {
      writes.push({ table, values: plain(values) })
      if (failure) return { Code: 0, Msg: '测试保存失败' }
      Object.assign(saved, values, costs.calculateInstallationPointCosts({ ...saved, ...values }, 7))
      return { Code: 1, Data: saved }
    } },
    ApiEngine: { async Run(key, params) {
      summaries.push({ key, params })
      return { Code: 1, Data: [{ CostFields: costs.aggregateInstallationPointCosts([saved, other], params.Years) }] }
    } }
  }
  const scope = { ...installation, ...costs, ...calculation, V8, console, setTimeout, clearTimeout,
    getUser: () => ({}), childDraftRows: () => group?.rows || null,
    findChildDraftGroup: () => null }
  const hooks = vm.runInNewContext(stripImports(read('tenants/xjy/form.js'))
    .replace(/export default/g, 'const hooks =').replace(/export (?=(?:async )?function|const)/g, '') + '\nhooks', scope)
  const component = vm.runInNewContext(stripImports(read('components/mci-business-related-list/mci-business-related-list.vue')
    .match(/<script>([\s\S]*?)<\/script>/)[1]).replace('export default', 'const component =') + '\ncomponent', {
    ...scope, MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    uni: { showToast: (value) => notices.push(value) }
  })
  const pending = []
  const card = { ...component.methods, rows: [point, other], parentForm: parent.form, proposalDraftGroup: group,
    proposalInstallationFieldNames: installation.PROPOSAL_INSTALLATION_FIELDS,
    proposalPointSavingId: '', config: { table: 'diy_anzhuang_dw' }, menuId: 'point-menu',
    tableChildAuth: { ParentFormDataId: 'plan-1', ParentFieldId: 'points' },
    field: { Label: '安装点位', config: { TableChildTableName: 'diy_anzhuang_dw' } },
    count: 2, keyword: '', activeFilterCount: 0, proposalPointCanEdit: () => true,
    $emit(event, payload) { if (event === 'data-count') pending.push(hooks.handleRelatedCount(parent, payload)) } }
  return { hooks, card, point, other, parent, saved, writes, notices, summaries, flush: () => Promise.all(pending) }
}

const selection = { value: 'FY-150K', raw: { Id: 'product-2', ShangpinMC: '饮水设备',
  Xianjia: 3200, ZulinXJ: 180, GenghuanLXJG: 260 } }

test('新增点位默认 10 人；显式 0、编辑、详情和重复初始化保留用户人数', async () => {
  const { hooks } = runtime()
  for (const [mode, defaults, expected] of [['Add', {}, 10], ['Add', { Renshu: 0 }, 0],
    ['Add', { Renshu: 35 }, 35], ['Edit', {}, 0], ['View', {}, 0]]) {
    const context = { tableName: 'diy_anzhuang_dw', mode, state: {}, form: { Renshu: 0, ...defaults },
      defaultValues: defaults, patchForm(values) { Object.assign(this.form, values) } }
    await hooks.initialize(context)
    assert.equal(context.form.Renshu, expected)
    context.form.Renshu = 23
    await hooks.initialize(context)
    assert.equal(context.form.Renshu, 23)
  }
  const draft = installation.proposalInstallationDraft()
  assert.equal(draft.Renshu, 10)
  assert.equal(installation.proposalInstallationCopyValues({ Renshu: 0 }, [{ Name: 'Renshu' }]).Renshu, 0)
})

for (const draft of [false, true]) {
  test(`${draft ? '新增草稿' : '已保存点位'}卡片选型更新三项报价、成本和全部点位汇总`, async () => {
    const r = runtime({ draft })
    await r.card.selectProposalPointDevice(r.point, selection)
    await r.flush()
    assert.equal(r.point.ShebeiDJZL, 180)
    assert.equal(r.point.ShebeiDJ, 3200)
    assert.equal(r.point.GenghuanLXJG, 260)
    assert.equal(r.point.HezuoHYSZCBAll, 684)
    assert.equal(r.point.DuonianLJCBAfter, 4788)
    assert.equal(r.point.DuonianLJCBMD, 12308)
    assert.equal(r.parent.form.HezuoHYSZCBAll, 1432)
    assert.equal(r.parent.form.DuonianLJCBAfter, 10024)
    assert.equal(r.parent.form.ChangsuoDWSL, 2)
    assert.equal(r.writes.length, draft ? 0 : 1)
    if (!draft) {
      assert.equal(r.writes[0].values.ShebeiDJZL, 180)
      assert.equal(r.writes[0].values.ShebeiDJ, 3200)
      assert.equal(r.writes[0].values.GenghuanLXJG, 260)
      assert.equal(r.writes[0].values._InvokeType, 'Client')
      assert.equal(r.writes[0].values._SysMenuId, 'point-menu')
      assert.equal(r.writes[0].values._TableChildAuth.ParentFormDataId, 'plan-1')
      assert.equal(r.summaries[0].key, 'xjy_compare_customer_proposals')
    }
    const form = { ...r.point }
    const context = { tableName: 'diy_anzhuang_dw', form, state: { proposalPointYears: 7 }, definition: { fields: [] },
      patchForm: (values) => Object.assign(form, values) }
    await r.hooks.handleFieldSelect(context, { ...selection, field: { Name: 'ShebeiXH' } })
    for (const field of ['ShebeiDJZL', 'ShebeiDJ', 'GenghuanLXJG', ...costs.PROPOSAL_AFTER_COST_FIELDS]) {
      assert.equal(r.point[field], form[field], field)
    }
    await r.card.selectProposalPointDevice(r.point, { cleared: true })
    await r.flush()
    assert.equal(r.point.ShebeiDJZL, '')
    assert.equal(r.point.ShebeiDJ, '')
    assert.equal(r.point.GenghuanLXJG, '')
    assert.equal(r.point.DuonianLJCBAfter, null)
    assert.equal(r.point.DuonianLJCBMD, null)
    assert.equal(r.parent.form.HezuoHYSZCBAll, 748)
  })
}

test('合法零元报价与缺失报价分开，选项嵌套 raw 也可带出报价', () => {
  const zero = installation.proposalInstallationDeviceValues({ value: 'free', option: { raw: {
    Xianjia: 0, ZulinXJ: '0', GenghuanLXJG: 0
  } } })
  assert.equal(zero.ShebeiDJ, 0)
  assert.equal(zero.ShebeiDJZL, '0')
  assert.equal(installation.proposalInstallationDeviceValues({ value: 'missing' }).ShebeiDJ, '')
  assert.equal(installation.proposalInstallationWriteValues({ ShebeiDJ: null }).ShebeiDJ, null)
  assert.equal('ShebeiDJ' in installation.proposalInstallationWriteValues({ AnzhuangCS: '一楼' }), false)
})

test('点位保存失败时展示真实错误且不刷新父表为成功结果', async () => {
  const r = runtime({ failure: true })
  await r.card.selectProposalPointDevice(r.point, selection)
  await r.flush()
  assert.equal(r.notices[0].title, '测试保存失败')
  assert.equal(r.summaries.length, 0)
  assert.equal(r.card.proposalPointSavingId, '')
})
