import defaultTest from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 用真实页面方法配合可控慢请求复现空态闪烁；不依赖网络速度或线上数据。
function page(file, overrides = {}) {
  const source = process.env.MICROI_LOADING_BASELINE === '1'
    ? execFileSync('git', ['show', `HEAD:microi.uniapp/src/${file}`], { encoding: 'utf8' })
    : fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const original = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  const sandbox = { console: { log() {}, warn() {}, error() {} }, clearTimeout, setTimeout,
    uni: { showToast() {}, $on() {}, $off() {} },
    themeMixin: {}, listReturnMixin: {}, getUser: () => ({}), getToken: () => 'token',
    PERIOD_OPTIONS: [], TASK_PERIODS: [], TASK_TYPES: [], TASK_STATES: [],
    loadModulePeriodCounts: () => Promise.resolve({}),
    hydrateCustomerContractTotals: async (rows) => rows,
    appConfig: { features: {}, osClient: 'test' },
    ...overrides }
  for (const statement of original.matchAll(/^[ \t]*import\s([\s\S]*?)from\s+['"][^'"]+['"]\s*;?\r?$/gm)) {
    for (const name of statement[1].replace(/[{}]/g, '').split(',').map((item) => item.trim()).filter(Boolean)) {
      const local = name.split(/\s+as\s+/).at(-1)
      if (!(local in sandbox)) sandbox[local] = () => ({})
    }
  }
  const script = original.replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default {', 'globalThis.component = {')
  vm.runInNewContext(script, sandbox)
  const component = sandbox.component
  const context = { ...component.data(), ...component.methods }
  return { context, component, source }
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

export function registerListLoadingTests(test = defaultTest) {
test('业务列表首进和授权菜单等待期间保持骨架态', async () => {
  const gate = deferred()
  const { context } = page('pages/business/list.vue', { findMenu: () => gate.promise, requiresAuthorizedMenuContext: () => false })
  assert.equal(context.loading, true)
  context.baseConfig = { table: 'Business' }
  context.loadViewConfig = async () => {}
  context.loadData = async () => { context.loading = false }
  const pending = context.initializeList()
  assert.equal(context.loading, true)
  gate.resolve({ Id: 'menu' }); await pending
  assert.equal(context.loading, false)
})

test('业务列表菜单拒绝显示失败并结束骨架，不冒充空数据', async () => {
  const { context } = page('pages/business/list.vue', { findMenu: async () => null, requiresAuthorizedMenuContext: () => true })
  context.baseConfig = { table: 'Protected' }
  await context.initializeList()
  assert.equal(context.loading, false)
  assert.match(context.metadataError, /无权/)
})

test('业务列表恢复有效缓存不被骨架覆盖，初始化仍正确结束', async () => {
  const { context } = page('pages/business/list.vue', { requiresAuthorizedMenuContext: () => false })
  context.baseConfig = { skipModuleMetadata: true }
  context.rows = [{ Id: 'cached' }]
  context.rowsContainConfiguredCardFields = () => true
  context.loadViewConfig = async () => {}
  context.loadPlatformStatistics = async () => {}
  context.buildCurrentListOptions = () => ({})
  await context.initializeList(true)
  assert.equal(context.loading, false)
  assert.equal(context.rows[0].Id, 'cached')
})

for (const [file, method, rows, loader, response] of [
  ['pages/business/list.vue', 'loadData', 'rows', 'loadModuleRows', { rows: [], count: 0, append: {} }],
  ['pages/module/list.vue', 'loadData', 'rows', 'loadModuleRows', { rows: [], count: 0, append: {} }],
  ['pages/task/list.vue', 'loadData', 'rows', 'loadTasks', { rows: [], count: 0 }]
]) {
  test(`${file}: 首次慢请求成功为空后才结束骨架`, async () => {
    const gate = deferred()
    const { context } = page(file, { [loader]: () => gate.promise })
    context.config = { pageSize: 15 }; context.buildCurrentListOptions = () => ({}); context.taskFilters = () => ({}); context.mciRestoreListPosition = () => {}
    context.loadAuxiliaryCounts = () => {}; context.loadPlatformStatistics = () => {}; context.loadModulePeriodCounts = () => Promise.resolve({})
    const pending = context[method](true)
    assert.equal(context.loading, true); assert.equal(context[rows].length, 0)
    gate.resolve(response); await pending
    assert.equal(context.loading, false); assert.equal(context[rows].length, 0)
  })
  test(`${file}: 网络失败有独立错误状态，重试清除错误并保留已读数据`, async () => {
    let fail = true
    const { context } = page(file, { [loader]: async () => { if (fail) throw Error('network unavailable'); return { rows: [{ Id: 'fresh' }], count: 1, append: {} } } })
    context.config = { pageSize: 15 }; context.buildCurrentListOptions = () => ({}); context.taskFilters = () => ({}); context.mciRestoreListPosition = () => {}
    context.loadAuxiliaryCounts = () => {}; context.loadPlatformStatistics = () => {}; context.loadModulePeriodCounts = () => Promise.resolve({})
    context[rows] = [{ Id: 'cached' }]
    await context[method](true)
    assert.equal(context.loading, false); assert.match(context.error, /network unavailable/); assert.equal(context[rows][0].Id, 'cached')
    fail = false; await context[method](true)
    assert.equal(context.error, ''); assert.equal(context[rows][0].Id, 'fresh')
  })
}

for (const [file, key, snapshot] of [
  ['pages/mall/index.vue', 'products', { products: [], categories: [], types: [] }],
  ['pages/news/index.vue', 'newsList', { news: [], banners: [] }]
]) {
  test(`${file}: 未完成请求的空缓存不能提前关闭骨架`, () => {
    const { context } = page(file)
    context.applyInitialSnapshot(snapshot, false)
    assert.equal(context.loading, true)
    context.applyInitialSnapshot(snapshot, true)
    assert.equal(context.loading, false)
  })
  test(`${file}: 首屏快照失败关闭骨架并允许重试，缓存数据仍可阅读`, async () => {
    const loader = key === 'products' ? 'loadMallSnapshot' : 'loadNewsSnapshot'
    const { context } = page(file, { [loader]: async () => { throw Error('snapshot unavailable') } })
    await context.loadInitialSnapshot()
    assert.equal(context.loading, false); assert.match(context.error, /snapshot unavailable/)
    assert.equal(typeof context.retryList, 'function')
  })
}

test('投诉公示列表切换时骨架优先于空态，列表失败可重试', async () => {
  const gate = deferred()
  const { context, source } = page('pages/complaint/index.vue', { getPublicComplaints: () => gate.promise, newIdempotencyKey: () => 'key' })
  context.activeTab = 'public'
  const pending = context.reloadList()
  assert.equal(context.listLoading, true)
  assert.match(source, /mci-skeleton v-if="listLoading && !list.length"/)
  gate.reject(Error('public unavailable')); await pending
  assert.equal(context.listLoading, false); assert.match(context.listError, /public unavailable/)
})

test('公共骨架支持紧凑分页和主题色，不使用固定浅色破坏暗色主题', () => {
  const source = fs.readFileSync(new URL('../src/components/mci-skeleton/mci-skeleton.vue', import.meta.url), 'utf8')
  assert.match(source, /compact:.*Boolean/)
  assert.match(source, /--mci-skeleton-base/)
  assert.match(source, /prefers-reduced-motion/)
})

for (const [file, loader, method, listKey] of [
  ['pages/mall/index.vue', 'getProductList', 'loadProducts', 'products'],
  ['pages/news/index.vue', 'getNewsList', 'loadNews', 'newsList']
]) {
  test(`${file}: 接口业务失败不能显示空态，重新查询继续可用`, async () => {
    let fail = true
    const { context } = page(file, { [loader]: async () => fail ? { Code: 0, Msg: 'service rejected' } : { Code: 1, Data: [{ Id: 'fresh' }] } })
    await context[method](false)
    assert.equal(context.loading, false); assert.match(context.error, /service rejected/)
    fail = false; await context.retryList()
    assert.equal(context.error, ''); assert.equal(context[listKey][0].Id, 'fresh')
  })
  test(`${file}: 迟到的旧筛选失败不能覆盖新数据或回滚新分页`, async () => {
    const gate = deferred(); let calls = 0
    const { context } = page(file, { [loader]: () => ++calls === 1 ? gate.promise : Promise.resolve({ Code: 1, Data: [{ Id: 'new' }] }) })
    context[listKey] = [{ Id: 'cached' }]; context.pageIndex = 2
    const older = context[method](true)
    await context[method](false)
    gate.reject(Error('old failed')); await older
    assert.equal(context[listKey][0].Id, 'new'); assert.equal(context.pageIndex, 1); assert.equal(context.error, '')
  })
}

for (const file of ['components/mci-child-table/mci-child-table.vue', 'components/mci-related-table/mci-related-table.vue']) {
  test(`${file}: 展开当帧进入骨架，失败结束骨架并保留可读缓存`, async () => {
    const gate = deferred()
    const { context } = page(file, { V8: { FormEngine: { GetTableData: () => gate.promise } } })
    context.relationValue = 'parent'; context.childFkField = 'Parent'; context.childTableName = 'Rows'; context.table = { Name: 'Rows' }
    context.resolveDefinition = async () => {}; context.resolveTable = async () => {}; context.buildWhere = () => []
    const pending = context.toggleExpanded()
    assert.equal(context.expanded, true); assert.equal(context.loading, true)
    gate.reject(Error('related unavailable')); await pending
    assert.equal(context.loading, false); assert.match(context.error, /related unavailable/)
    context.rows = [{ Id: 'cached' }]
    await context.loadRows()
    assert.equal(context.rows[0].Id, 'cached'); assert.equal(context.loading, false)
  })
}

test('客户选择组件初始即打开时也启动骨架加载', async () => {
  const { context, component } = page('components/mci-customer-picker/mci-customer-picker.vue')
  assert.equal(component.watch.visible.immediate, true)
  let started = false
  context.loadRows = () => { started = true; context.loading = true }
  component.watch.visible.handler.call(context, true)
  assert.equal(started, true); assert.equal(context.loading, true)
})

test('通讯录慢请求、失败和重试均保持确定状态，不把网络故障当成无联系人', async () => {
  const gate = deferred(); let next = gate.promise
  const { context } = page('pages/message/index.vue', {
    post: () => next, buildContactRequest: () => ({ url: '/contacts', data: {} }), normalizeContact: (row) => row
  })
  context.aiAssistantEnabled = false; context.persistMessageCache = () => {}
  const pending = context.loadContacts(false)
  assert.equal(context.contactLoading, true)
  gate.reject(Error('contacts unavailable')); await pending
  assert.equal(context.contactLoading, false); assert.match(context.contactError, /contacts unavailable/)
  next = Promise.resolve({ Code: 1, Data: [{ Id: 'person' }], DataCount: 1 })
  await context.retryContacts()
  assert.equal(context.contactError, ''); assert.equal(context.contactList[0].Id, 'person')
})

test('新聊天窗口打开立即加载联系人骨架，失败后出现明确重试错误', async () => {
  const gate = deferred()
  const { context } = page('pages/message/index.vue', { post: () => gate.promise })
  const pending = context.openNewChat()
  assert.equal(context.showNewChat, true); assert.equal(context.dialogLoading, true)
  gate.resolve({ Code: 0, Msg: 'directory denied' }); await pending
  assert.equal(context.dialogLoading, false); assert.match(context.dialogError, /directory denied/)
})

test('带设备参数冷开扫码任务是骨架态，无参数只显示扫码引导', () => {
  const { context, component } = page('pages/task/scan.vue')
  component.onLoad.call(context, { deviceId: 'device-id' }); assert.equal(context.loading, true)
  component.onLoad.call(context, {}); assert.equal(context.loading, false)
})

test('投诉列表搜索并发时旧响应不能关闭新骨架或写进新页签', async () => {
  const old = deferred(), fresh = deferred(); let calls = 0
  const { context } = page('pages/complaint/index.vue', { getPublicComplaints: () => ++calls === 1 ? old.promise : fresh.promise })
  context.activeTab = 'public'
  const older = context.reloadList(); const newer = context.reloadList()
  old.resolve({ Code: 1, Data: [{ Id: 'old' }] }); await older
  assert.equal(context.listLoading, true); assert.equal(context.list.length, 0)
  fresh.resolve({ Code: 1, Data: [{ Id: 'fresh' }] }); await newer
  assert.equal(context.listLoading, false); assert.equal(context.list[0].Id, 'fresh')
})

test('商城分类和类型成功不能掩盖首屏商品接口失败', async () => {
  const file = 'platform/preload.js'
  const original = process.env.MICROI_LOADING_BASELINE === '1'
    ? execFileSync('git', ['show', `HEAD:microi.uniapp/src/${file}`], { encoding: 'utf8' })
    : fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const sandbox = { console: { warn() {} }, appConfig: { features: { mall: true } },
    readCache: () => null, cachedRequest: async (_key, loader) => ({ data: await loader() }),
    getProductCategories: async () => ({ Code: 1, Data: [] }), getProductTypes: async () => ({ Code: 1, Data: [] }),
    getProductList: async () => ({ Code: 0, Msg: 'product denied' }) }
  vm.runInNewContext(original.replace(/^import.*$/gm, '').replace(/export default/, 'const preloadApi =').replace(/\bexport\s+/g, ''), sandbox)
  await assert.rejects(sandbox.loadMallSnapshot(), /product denied/)
})

for (const [file, method, pageKey, rowsKey, loadingKey, errorKey, api] of [
  ['pages/native/service-record.vue', 'loadCustomers', 'customerPage', 'customers', 'customerLoading', 'customerError', 'GetTableData'],
  ['pages/native/casebook.vue', 'loadCases', 'casePage', 'sourceCases', 'caseLoading', 'caseError', 'GetTableData']
]) {
  test(`${file}: 选择列表分页失败保留内容、回退失败页并显示重试`, async () => {
    const { context } = page(file, { V8: { FormEngine: { [api]: async () => { throw Error('picker unavailable') } } } })
    context[pageKey] = 2; context[rowsKey] = [{ Id: 'cached' }]
    await context[method]()
    assert.equal(context[loadingKey], false); assert.match(context[errorKey], /picker unavailable/)
    assert.equal(context[pageKey], 1); assert.equal(context[rowsKey][0].Id, 'cached')
  })
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) registerListLoadingTests()
