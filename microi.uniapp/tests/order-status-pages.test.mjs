import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { resolveStatusOptions, reconcileStatusSelection } from '../src/platform/status-filter-options.mjs'
import { buildRenderManifest, compileListConfig } from '../src/platform/view-schema-core.mjs'

const current = ['待审批', '进行中', '已到期', '终止待审批', '已终止']
const legacy = ['待审批', '已审批', '已驳回', '待审批作废', '已作废', '已到期']
const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const list = read('pages/business/list.vue')
const related = read('components/mci-business-related-list/mci-business-related-list.vue')
const detail = read('pages/business/detail.vue')
const plain = value => JSON.parse(JSON.stringify(value))
function method(source, start, end, scope = {}) {
  const from = source.indexOf(start), to = source.indexOf(end, from)
  assert.ok(from >= 0 && to > from)
  return Object.values(vm.runInNewContext(`({${source.slice(from, to).trim().replace(/,$/, '')}})`, {
    resolveStatusOptions, reconcileStatusSelection, ...scope
  }))[0]
}
const manifest = buildRenderManifest({ Id: 'orders-menu', ViewConfigVersion: 12, ViewSchema: JSON.stringify({
  Views: [{ Key: 'order:card', Scene: 'Card', Device: 'Mobile', Enabled: true, Layout: {
    Card: { TitleField: 'KehuMC', StatusFields: [{ Name: 'DingdanZT' }] }, Search: { StatusOptions: current }
  } }]
}) }, { scene: 'Card', device: 'Mobile', user: {} })
const scope = {
  loadModuleDefinition: async () => ({ menuId: 'orders-menu', statusOptions: current, definition: { fields: [] } }),
  loadModuleViewManifest: async () => manifest, compileListConfig,
  mergeModuleFilterFields: () => []
}

test('fresh mobile ViewSchema replaces legacy local/cache labels on the actual main page', async () => {
  const load = method(list, 'async loadViewConfig(', '    buildCurrentListOptions(', scope)
  const state = { menuId: 'orders-menu', baseConfig: { table: 'Diy_Dingdan', statusOptions: legacy }, currentUser: {} }
  await load.call(state)
  assert.deepEqual(plain(state.config.statusOptions), current)
  assert.equal(state.config.statusField, 'DingdanZT')
})

test('customer order tab replaces legacy labels at metadata hydration and ViewSchema stages', async () => {
  const apply = method(related, 'applyCardPresentationConfig(', '    emitTitleChange(', {})
  const state = { table: { Name: 'Diy_Dingdan' }, config: { statusOptions: legacy, relatedSummary: {} }, emitTitleChange() {} }
  apply.call(state, { table: 'Diy_Dingdan', statusOptions: current })
  assert.deepEqual(plain(state.config.statusOptions), current)
  state.config.statusOptions = legacy
  state.applyMenuSearchFields = () => {}
  const load = method(related, 'async loadViewConfig(', '    applyMenuSearchFields(', scope)
  await load.call(state)
  assert.deepEqual(plain(state.config.statusOptions), current)
})

test('metadata unavailable fallback remains complete; a refreshed enum can remove and add values', () => {
  assert.deepEqual(resolveStatusOptions([], current), current)
  assert.deepEqual(resolveStatusOptions(current, legacy), current)
  assert.deepEqual(resolveStatusOptions(['new', 'new', ''], current), ['new'])
  assert.equal(reconcileStatusSelection('已审批', current), '')
  assert.equal(reconcileStatusSelection('已终止', current), '已终止')
})

test('a retained main list with a retired filter reloads all states instead of showing stale rows', async () => {
  const calls = []
  const initialize = method(list, 'async initializeList(', '    getMciListSnapshotKey(', {
    findMenu: async () => ({ Id: 'orders-menu' }), requiresAuthorizedMenuContext: () => true
  })
  const state = { baseConfig: {}, config: {}, rows: [{ DingdanZT: '已审批' }], status: '已审批',
    statusOptionsFingerprint: JSON.stringify(legacy), keyword: '',
    loadViewConfig: async function () { this.config.statusOptions = current },
    loadData: async function (...args) { calls.push({ args, status: this.status }) },
    rowsContainConfiguredCardFields: () => true }
  await initialize.call(state, true)
  assert.equal(state.status, '')
  assert.equal(calls.length, 1)
  assert.deepEqual(plain(calls[0].args), [true, false])
})

test('both page status controls request every new state and reset to all', async () => {
  const mainChange = method(list, 'changeStatus(value)', '    customerStatusCount(')
  const relatedChange = method(related, 'changeRelatedStatus(status)', '    toggleRelatedValidity(')
  const mainCalls = [], relatedCalls = []
  const main = { status: '', loadData() { mainCalls.push(this.status) } }
  const tab = { relatedStatus: '', refreshFilteredRows() { relatedCalls.push(this.relatedStatus) } }
  for (const status of [...current, '']) {
    mainChange.call(main, status)
    relatedChange.call(tab, status)
  }
  assert.deepEqual(mainCalls, [...current, ''])
  assert.deepEqual(relatedCalls, mainCalls)
})

test('late related presentation refresh clears a retired status and reloads rows and metrics', async () => {
  const load = method(related, 'async loadPresentationConfig(', '    resolveBusinessModule(', scope)
  let refreshed = 0
  const state = { menuId: 'orders-menu', presentationRequestId: 0, relatedStatus: '已驳回', config: { statusOptions: legacy },
    applyCardPresentationConfig() {}, loadViewConfig: async function () { this.config.statusOptions = current },
    refreshFilteredRows: async () => { refreshed++ } }
  await load.call(state)
  assert.equal(state.relatedStatus, '')
  assert.equal(refreshed, 1)
})

for (const mode of ['approve', 'reject']) {
  test(`detail ${mode} uses the shared server action and notifies the source list; no client state overwrite`, async () => {
    const actionsSource = read('pages/business/utils/xjy-row-actions.js')
    const calls = [], events = [], toasts = []
    const run = method(actionsSource.replace('export async function executeBusinessRowAction', 'async executeBusinessRowAction'),
      'async executeBusinessRowAction(', '\nfunction newCopyOperationId(', {
        getUser: () => ({}), ensure: r => { if (r.Code !== 1) throw new Error(r.Msg); return r },
        callApiEngine: async (key, params) => { calls.push({ key, params }); return { Code: 1 } },
        V8: { FormEngine: { UptFormData() { throw new Error('client state overwrite') } } }, removeCachePrefix() {}
      })
    const submit = method(detail, 'async submitOrderApproval()', '\t\t\tgoBack()', {
      executeBusinessRowAction: run,
      uni: { showLoading() {}, hideLoading() {}, showToast: x => toasts.push(x), $emit: (...args) => events.push(args) }
    })
    const state = { canApproveOrder: true, approvalOpinion: ' 保留意见 ', approvalMode: mode,
      detail: { Id: 'order-a' }, currentUser: {}, moduleConfig: { table: 'Diy_Dingdan' },
      loadDetail: async function () { this.detail.DingdanZT = mode === 'approve' ? '进行中' : '待审批' } }
    await submit.call(state)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].key, mode === 'approve' ? 'dingdan_shenpi' : 'DingdanApproveReject')
    assert.equal(calls[0].params.formData.ShenpiYJ, '保留意见')
    assert.equal(events[0][0], 'microi:data-changed')
    assert.equal(state.detail.DingdanZT, mode === 'approve' ? '进行中' : '待审批')
    assert.equal(state.submitting, false)
    assert.equal(toasts[0].icon, 'success')
  })
}

test('detail rejection keeps its opinion on server failure and never announces success', async () => {
  const events = [], toasts = []
  const submit = method(detail, 'async submitOrderApproval()', '\t\t\tgoBack()', {
    executeBusinessRowAction: async () => { throw new Error('状态已变化，请刷新') },
    uni: { showLoading() {}, hideLoading() {}, showToast: x => toasts.push(x), $emit: (...args) => events.push(args) }
  })
  const state = { canApproveOrder: true, approvalOpinion: '驳回意见', approvalMode: 'reject',
    showOrderApprovalDialog: true, detail: { Id: 'order-a' }, currentUser: {} }
  await submit.call(state)
  assert.equal(state.approvalOpinion, '驳回意见')
  assert.equal(state.showOrderApprovalDialog, true)
  assert.equal(state.submitting, false)
  assert.equal(events.length, 0)
  assert.equal(toasts[0].title, '状态已变化，请刷新')
})
