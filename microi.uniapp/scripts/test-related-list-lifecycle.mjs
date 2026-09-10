import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
  .replace('export default {', 'globalThis.component = {')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup(overrides = {}) {
  const sandbox = {
    getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {},
    uni: { $off() {} }, clearTimeout,
    loadNativeTableModel: async () => ({ Id: 'table-1', Name: 'Related' }),
    loadNativeFormDefinition: async () => ({ fields: [] }),
    findMenu: async () => null,
    buildKeywordWhere: () => [],
    uniqueRowsById: (rows) => rows,
    ...overrides
  }
  vm.runInNewContext(script, sandbox)
  const component = sandbox.component
  const context = {
    ...component.data(), ...component.methods,
    childTableId: 'table-1', relationValue: 'parent-1', childFkField: 'ParentId',
    tableChildAuth: { ParentFormDataId: 'parent-1' },
    config: { table: 'Related', pageSize: 15 },
    resolveBusinessModule: () => ({ key: 'related', config: {} }),
    emitTitleChange() {}, applyMenuSearchFields() {}, $emit() {},
    scheduleListBodyMeasure() {},
    buildFilterWhere: () => [], relatedSelectFields: () => ['Id'],
    keywordSearchFields: [], filterFields: [],
    hydrateProposalInstallationPointRows: async (rows) => rows,
    hydrateCollectionRows: async (rows) => rows
  }
  return { context, unmount: () => component.beforeUnmount.call(context) }
}

for (const stage of ['table', 'definition', 'menu']) {
  test(`switching tabs while ${stage} loads stops the old initialization chain`, async () => {
    const gate = deferred()
    const reached = deferred()
    const calls = []
    const values = { table: { Id: 'table-1', Name: 'Related' }, definition: { fields: [] }, menu: null }
    const load = (name) => async () => {
      calls.push(name)
      if (name === stage) { reached.resolve(); return gate.promise }
      return values[name]
    }
    const { context, unmount } = setup({
      loadNativeTableModel: load('table'), loadNativeFormDefinition: load('definition'), findMenu: load('menu')
    })
    context.loadPresentationConfig = async () => { calls.push('presentation') }
    context.loadData = async () => { calls.push('rows') }
    context.loadRelatedMetrics = async () => { calls.push('metrics') }
    const pending = context.initialize()
    await reached.promise
    unmount()
    const before = [...calls]
    const tableBefore = context.table
    const definitionBefore = context.definition
    gate.resolve(values[stage])
    await pending
    assert.deepEqual(calls, before, 'unmounted tab must not enqueue more requests')
    assert.equal(context.table, tableBefore)
    assert.equal(context.definition, definitionBefore)
  })
}

test('a late list response after unmount does not hydrate rows, change state or emit data counts', async () => {
  const gate = deferred()
  const calls = []
  const { context, unmount } = setup({ V8: { FormEngine: { GetTableData: () => gate.promise } } })
  context.hydrateProposalInstallationPointRows = async (rows) => { calls.push('hydrate'); return rows }
  context.emitDataCount = () => { calls.push('count') }
  const pending = context.loadData(true, false, true, false)
  unmount()
  gate.resolve({ Code: 1, Data: [{ Id: 'stale-row' }], DataCount: 1 })
  await pending
  assert.deepEqual(calls, [])
  assert.equal(context.rows.length, 0)
  assert.equal(context.error, '')
})

test('a late failed initialization does not update an unmounted tab', async () => {
  const gate = deferred()
  const { context, unmount } = setup({ loadNativeTableModel: () => gate.promise })
  const pending = context.initialize()
  unmount()
  gate.reject(new Error('late network failure'))
  await pending
  assert.equal(context.error, '')
})

test('unmount while a card manifest loads prevents its list-manifest fallback request', async () => {
  const gate = deferred()
  let requests = 0
  const { context, unmount } = setup({
    loadModuleViewManifest: () => { requests += 1; return gate.promise },
    compileListConfig: () => null
  })
  const pending = context.loadViewConfig()
  unmount()
  gate.resolve(null)
  await pending
  assert.equal(requests, 1)
})

test('the current tab still initializes and loads rows normally', async () => {
  const calls = []
  const { context } = setup({
    V8: { FormEngine: { GetTableData: async () => ({ Code: 1, Data: [{ Id: 'current-row' }], DataCount: 1 }) } }
  })
  context.loadPresentationConfig = async () => { calls.push('presentation') }
  context.loadRelatedMetrics = async () => { calls.push('metrics') }
  await context.initialize()
  assert.equal(context.table.Name, 'Related')
  assert.equal(context.rows[0].Id, 'current-row')
  assert.equal(context.count, 1)
  assert.equal(context.loading, false)
  assert.equal(context.error, '')
  assert.deepEqual(calls, ['presentation', 'metrics'])
})

test('late metrics cannot update an unmounted tab, and disposed methods send no new requests', async () => {
  const gate = deferred()
  let requests = 0
  const { context, unmount } = setup({
    V8: { FormEngine: { GetTableData: () => { requests += 1; return gate.promise } } }
  })
  context.relatedMetricDefinitions = [{ key: 'total' }]
  const pending = context.loadRelatedMetrics()
  unmount()
  gate.resolve({ Code: 1, DataCount: 12 })
  await pending
  assert.equal(context.metricValues.total, undefined)
  await Promise.all([context.initialize(), context.loadData(true), context.loadRelatedMetrics(), context.loadLatestRecordSummary(), context.loadPresentationConfig()])
  assert.equal(requests, 1)
})

test('a superseded initialization cannot overwrite the newer initialization', async () => {
  const gate = deferred()
  let requests = 0
  const { context } = setup({
    loadNativeTableModel: () => ++requests === 1 ? gate.promise : { Id: 'new-table', Name: 'NewRelated' }
  })
  context.loadPresentationConfig = async () => {}
  context.loadData = async () => {}
  context.loadRelatedMetrics = async () => {}
  const older = context.initialize()
  await context.initialize(true)
  gate.resolve({ Id: 'old-table', Name: 'OldRelated' })
  await older
  assert.equal(context.table.Id, 'new-table')
  assert.equal(context.config.table, 'NewRelated')
})
