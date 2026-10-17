import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
const componentPath = 'src/components/mci-business-related-list/mci-business-related-list.vue'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const componentSource = read(componentPath)
const runtimeSource = read('src/platform/business-runtime.js')
const stripImports = source => source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
const plain = value => JSON.parse(JSON.stringify(value))
const flush = () => new Promise(resolve => setImmediate(resolve))
const savedEvent = 'native-form:record-saved'

function runtime(source = runtimeSource, overrides = {}) {
  const navigations = []
  const toasts = []
  const start = source.indexOf('export async function openForm(')
  const end = source.indexOf('\nexport async function openLowCodeMenu(', start)
  assert.ok(start >= 0 && end > start, '必须执行实际 openForm 函数')
  const sandbox = {
    requireLogin: () => true,
    findMenu: async () => ({ Id: 'orders-menu' }),
    findPreferredMenu: async () => null,
    uni: { navigateTo: value => navigations.push(value), showToast: value => toasts.push(value) },
    ...overrides
  }
  vm.runInNewContext(source.slice(start, end).replace('export ', ''), sandbox)
  return { openForm: sandbox.openForm, navigations, toasts }
}

function related({ source = componentSource, resolveTarget, openForm, ...overrides } = {}) {
  const calls = { navigations: [], toasts: [], loads: [], metrics: [] }
  const target = { table: 'Orders', menuId: 'orders-menu', mode: 'Add' }
  const sandbox = {
    getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    canAddMenuRecord: () => true, canEditMenuRecord: () => true,
    loadTenantRelatedRows: async () => null,
    resolveListReadApi: () => '', uniqueRowsById: rows => rows,
    resolveRelatedFormNavigation: resolveTarget || (async () => target),
    openForm: openForm || (async value => calls.navigations.push(value)),
    uni: { showToast: value => calls.toasts.push(value) },
    ...overrides
  }
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  vm.runInNewContext(stripImports(script).replace('export default', 'globalThis.component ='), sandbox)
  const component = sandbox.component
  const context = {
    ...component.data(), ...component.methods,
    relationValue: 'original-order', parentId: 'original-order', parentTableName: 'Orders', parentMode: 'View',
    parentForm: { Id: 'original-order' }, field: { Id: 'related-orders-field' },
    menuId: 'related-orders-menu', currentUser: {}, config: { table: 'OrderRelations' },
    preserveUnsavedParentRows: () => false,
    loadData: async (...args) => { calls.loads.push(args); context.rows = [{ Id: 'new-relation' }] },
    loadRelatedMetrics: async (...args) => calls.metrics.push(args)
  }
  return { calls, context, component }
}

test('旧版实际代码复现：真实订单保存事件不能刷新来源关系子表', async () => {
  // 固定修复前的真实源码，证明跨表保存通知曾丢失；不能用自造旧实现代替回归证据。
  const previous = path => execFileSync('git', [
    '-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'show', `a7f23e6b4:microi.uniapp/${path}`
  ], { cwd: root, encoding: 'utf8' })
  const navigation = runtime(previous('src/platform/business-runtime.js'))
  const fixture = related({ source: previous(componentPath), openForm: navigation.openForm })
  await fixture.context.openTenantRelatedForm('Add')
  assert.equal(navigation.navigations.length, 1)
  assert.equal(navigation.navigations[0].events?.[savedEvent], undefined)
  navigation.navigations[0].events?.[savedEvent]?.()
  fixture.context.handleDataChanged({ table: 'Orders', id: 'renewal-order', row: { Id: 'renewal-order' } })
  await flush()
  assert.equal(fixture.calls.loads.length, 0)
  assert.deepEqual(plain(fixture.context.rows), [], '保存真实业务表后来源关系仍为空，复现原问题')
})

test('运行时把事件回调原样交给 navigateTo，不写进 URL 或丢失函数', async () => {
  const navigation = runtime()
  const events = { [savedEvent]: () => {} }
  await navigation.openForm({ table: 'Orders', mode: 'Add', events })
  assert.equal(navigation.navigations[0].events, events)
  assert.equal(navigation.navigations[0].url.includes(savedEvent), false)
  assert.equal(new URLSearchParams(navigation.navigations[0].url.split('?')[1]).get('menuId'), 'orders-menu')
})

test('既有表单不传事件时仍可导航，授权上下文保持原样', async () => {
  const navigation = runtime()
  const auth = { ParentSysMenuId: 'source-menu', ParentRowId: 'original-order', ParentFieldId: 'related-orders-field' }
  await navigation.openForm({ table: 'Related', tableChildAuth: auth, readWhere: [['ParentId', '=', 'original-order']] })
  const params = new URLSearchParams(navigation.navigations[0].url.split('?')[1])
  assert.deepEqual(JSON.parse(params.get('tableChildAuth')), auth)
  assert.deepEqual(JSON.parse(params.get('readWhere')), [['ParentId', '=', 'original-order']])
  assert.deepEqual(plain(navigation.navigations[0].events), {})
})

for (const action of ['Add', 'Edit', 'View']) {
  test(`跨表 ${action} 保存成功后强制回读来源子表和统计`, async () => {
    const navigation = runtime()
    const fixture = related({ openForm: navigation.openForm })
    await fixture.context.openTenantRelatedForm(action, { Id: 'relation-1' })
    assert.equal(fixture.calls.loads.length, 0, '进入表单时不应提前刷新')
    const saved = navigation.navigations[0].events?.[savedEvent]
    assert.equal(typeof saved, 'function')
    saved({ table: 'Orders', id: 'renewal-order' })
    await flush()
    assert.deepEqual(fixture.calls.loads, [[true, true, false, true]], '保存后必须绕过列表缓存')
    assert.deepEqual(fixture.calls.metrics, [[true]], '统计也必须刷新')
    assert.deepEqual(plain(fixture.context.rows), [{ Id: 'new-relation' }])
    assert.equal(fixture.context.relatedFormOpening, false)
  })
}

test('取消表单没有保存事件，不刷新也不伪造关系记录', async () => {
  const fixture = related()
  await fixture.context.openTenantRelatedForm('Add')
  await flush()
  assert.equal(typeof fixture.calls.navigations[0].events[savedEvent], 'function')
  assert.deepEqual(fixture.calls.loads, [])
  assert.deepEqual(fixture.calls.metrics, [])
  assert.deepEqual(plain(fixture.context.rows), [])
})

for (const leave of ['disposed', 'parent', 'table']) {
  test(`保存通知迟到时拒绝刷新已离开的来源：${leave}`, async () => {
    const fixture = related()
    await fixture.context.openTenantRelatedForm('Add')
    if (leave === 'disposed') fixture.context.componentDisposed = true
    if (leave === 'parent') fixture.context.relationValue = 'another-order'
    if (leave === 'table') fixture.context.config.table = 'OtherRelations'
    fixture.calls.navigations[0].events[savedEvent]()
    await flush()
    assert.deepEqual(fixture.calls.loads, [])
    assert.deepEqual(fixture.calls.metrics, [])
  })
}

for (const leave of ['disposed', 'parent', 'table']) {
  test(`预览返回前来源切换不打开旧业务表单：${leave}`, async () => {
    let complete
    const pending = new Promise(resolve => { complete = resolve })
    const fixture = related({ resolveTarget: () => pending })
    const opening = fixture.context.openTenantRelatedForm('Add')
    if (leave === 'disposed') fixture.context.componentDisposed = true
    if (leave === 'parent') fixture.context.relationValue = 'another-order'
    if (leave === 'table') fixture.context.config.table = 'OtherRelations'
    complete({ table: 'Orders', menuId: 'orders-menu', mode: 'Add' })
    await opening
    assert.deepEqual(fixture.calls.navigations, [])
    assert.deepEqual(fixture.calls.loads, [])
    assert.equal(fixture.context.relatedFormOpening, false)
  })
}

function useActualListQuery(fixture) {
  const { context, component } = fixture
  Object.assign(context, {
    loadData: component.methods.loadData,
    childFkField: 'ParentOrderId',
    tableChildAuth: { ParentSysMenuId: 'orders-menu', ParentRowId: 'original-order', ParentFieldId: 'related-orders-field' },
    buildKeywordFilterWhere: () => [], buildFilterWhere: () => [],
    requiresModuleAssociationQuery: () => true,
    relatedSelectFields: () => ['Id', 'ParentOrderId', 'RenewalOrderId'],
    hydrateProposalInstallationPointRows: async rows => rows,
    hydrateCollectionRows: async rows => rows,
    loadLatestRecordSummary: async () => {}
  })
}

test('真实保存返回链路回读服务器关系记录并保留父子授权与查询条件', async () => {
  const requests = []
  const navigation = runtime()
  const serverRows = [{ Id: 'saved-relation', ParentOrderId: 'original-order', RenewalOrderId: 'renewal-order' }]
  const fixture = related({
    openForm: navigation.openForm,
    loadModuleRows: async (config, options) => {
      requests.push({ config: plain(config), options: plain(options) })
      return { rows: serverRows, count: 1 }
    }
  })
  useActualListQuery(fixture)
  await fixture.context.openTenantRelatedForm('Add')
  navigation.navigations[0].events[savedEvent]({ table: 'Orders', id: 'renewal-order' })
  await flush()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].config.table, 'OrderRelations')
  assert.equal(requests[0].options.refresh, true)
  assert.equal(requests[0].options.cacheAge, 0)
  assert.deepEqual(requests[0].options.extraWhere, [{ Name: 'ParentOrderId', Type: '=', Value: 'original-order' }])
  assert.deepEqual(requests[0].options.tableChildAuth, fixture.context.tableChildAuth)
  assert.equal(requests[0].options.tableChildModuleQuery, true)
  assert.deepEqual(plain(fixture.context.rows), serverRows)
  assert.equal(fixture.context.count, 1)
  assert.equal(fixture.context.error, '')
  assert.equal(fixture.context.loading, false)
})

test('保存后关系回读失败保留错误和重试入口，不能伪装成已刷新成功', async () => {
  const fixture = related({ loadModuleRows: async () => { throw new Error('关系查询网络异常') } })
  useActualListQuery(fixture)
  await fixture.context.openTenantRelatedForm('Add')
  fixture.calls.navigations[0].events[savedEvent]()
  await flush()
  assert.equal(fixture.context.error, '关系查询网络异常')
  assert.equal(fixture.context.loading, false)
  assert.deepEqual(plain(fixture.context.rows), [])
})

test('无新增权限时保留真实原因，不打开表单或刷新关系', async () => {
  const fixture = related({ canAddMenuRecord: () => false })
  assert.equal(await fixture.context.openTenantRelatedForm('Add'), true)
  assert.equal(fixture.calls.toasts[0].title, '当前账号没有新增权限')
  assert.deepEqual(fixture.calls.navigations, [])
  assert.deepEqual(fixture.calls.loads, [])
  assert.equal(fixture.context.relatedFormOpening, false)
})

test('预览或导航失败显示原因并释放打开锁，不伪装保存成功', async () => {
  for (const stage of ['preview', 'navigation']) {
    const failure = async () => { throw new Error(`${stage} 网络异常`) }
    const fixture = related(stage === 'preview' ? { resolveTarget: failure } : { openForm: failure })
    assert.equal(await fixture.context.openTenantRelatedForm('Add'), true)
    assert.equal(fixture.calls.toasts[0].title, `${stage} 网络异常`)
    assert.deepEqual(fixture.calls.loads, [])
    assert.deepEqual(fixture.calls.metrics, [])
    assert.equal(fixture.context.relatedFormOpening, false)
  }
})

test('未接管的普通子表返回原生流程，不新增保存监听或刷新', async () => {
  const fixture = related({ resolveTarget: async () => null })
  assert.equal(await fixture.context.openTenantRelatedForm('Add'), false)
  assert.deepEqual(fixture.calls.navigations, [])
  assert.deepEqual(fixture.calls.loads, [])
  assert.equal(fixture.context.relatedFormOpening, false)
})
