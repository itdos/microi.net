import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'

const source = fs.readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
  .replace('export default {', 'globalThis.component = {')

function createContext(api = {}, runtime = {}) {
  const openedForms = []
  const sandbox = {
    uni: runtime,
    V8: { FormEngine: api }, getUser: () => ({}),
    MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    openForm: (options) => openedForms.push(options),
    formatFieldValue: (value, format) => format === 'money' ? `¥${value}` : String(value),
    fieldDisplayValue: (field, value) => field.options.find((item) => item.value === value)?.label || String(value)
  }
  vm.runInNewContext(script, sandbox)
  const component = sandbox.component
  const context = {
    ...component.data(), ...component.methods,
    latestSummaryEnabled: true,
    relationValue: 'customer-a', childFkField: 'KehuID',
    tableChildAuth: { ParentFormDataId: 'customer-a', ParentSysMenuId: 'customer-menu' },
    menuId: 'proposal-menu',
    presentation: {}, moduleKey: 'proposals',
    config: { table: 'Diy_kehufaxx', pageSize: 2 },
    definition: { fields: [{ Name: 'DangqianYSFS', options: [{ value: 'old', label: '老式开水机（有过滤）' }] }] },
    scheduleListBodyMeasure() {},
    loadRelatedMetrics: async () => {},
    emitDataCount() {},
    isPreview: false, keywordSearchFields: [], filterFields: [],
    buildFilterWhere: () => [{ Name: 'FanganMC', Type: 'Like', Value: '历史方案' }],
    relatedSelectFields: () => ['Id'],
    hydrateProposalInstallationPointRows: async (rows) => rows,
    hydrateCollectionRows: async (rows) => rows
  }
  return { context, component, openedForms }
}

test('按当前客户创建时间取最新方案，摘要和详情共用同一个 Id 与授权', async () => {
  const calls = []
  const { context } = createContext({
    GetTableData: async (table, params) => { calls.push({ table, params }); return { Code: 1, Data: [{ Id: 'newest' }] } },
    GetFormData: async (table, params) => { calls.push({ table, params }); return { Code: 1, Data: { Id: 'newest', DuonianLJCB: 7120 } } }
  })
  context.keyword = '历史方案'
  context.pageIndex = 9
  await context.loadLatestRecordSummary()
  const query = calls[0].params
  assert.equal(query._PageSize, 1)
  assert.equal(query._PageIndex, 1)
  assert.equal(query._OrderBy, 'CreateTime')
  assert.equal(query._OrderByType, 'DESC')
  assert.equal(query._Where.length, 1)
  assert.equal(query._Where[0].Name, 'KehuID')
  assert.equal(query._Where[0].Value, 'customer-a')
  assert.equal(query._Keyword, undefined)
  assert.equal(query._SysMenuId, undefined)
  assert.equal(query._TableChildAuth, context.tableChildAuth)
  assert.equal(calls[1].params._TableChildAuth, context.tableChildAuth)
  assert.equal(calls[1].params.Id, context.latestSummaryRow.Id)
  assert.equal(context.latestSummaryRow.DuonianLJCB, 7120)
})

test('进入与返回刷新获取最新方案，搜索、筛选和翻页不重新获取，增删改后刷新', async () => {
  let latestCalls = 0
  const { context } = createContext({
    GetTableData: async (table, params) => {
      if (params._PageSize === 1) {
        latestCalls += 1
        return { Code: 1, Data: [{ Id: `newest-${latestCalls}` }] }
      }
      return { Code: 1, Data: [{ Id: `old-${params._PageIndex}-a` }, { Id: `old-${params._PageIndex}-b` }], DataCount: 10 }
    },
    GetFormData: async (table, params) => ({ Code: 1, Data: { Id: params.Id } })
  })
  await context.loadData(true, false, false, true)
  assert.equal(context.latestSummaryRow.Id, 'newest-1')
  await context.loadData(false)
  assert.equal(context.latestSummaryRow.Id, 'newest-1')
  context.keyword = '历史方案'
  await context.loadData(true, true)
  assert.equal(context.latestSummaryRow.Id, 'newest-1')
  assert.equal(latestCalls, 1)
  await context.refreshData()
  assert.equal(context.latestSummaryRow.Id, 'newest-2')
  await context.loadData(true, true, true)
  assert.equal(context.latestSummaryRow.Id, 'newest-3')
  assert.equal(latestCalls, 3)
})

test('无方案时清除旧摘要，接口失败可重试且不继续显示旧值', async () => {
  let fail = false
  const { context } = createContext({ GetTableData: async () => fail ? { Code: 0, Msg: '连接失败' } : { Code: 1, Data: [] } })
  context.latestSummaryRow = { Id: 'old' }
  await context.loadLatestRecordSummary()
  assert.equal(context.latestSummaryRow, null)
  assert.equal(context.latestSummaryError, '')
  fail = true
  context.latestSummaryRow = { Id: 'old' }
  await context.loadLatestRecordSummary()
  assert.equal(context.latestSummaryRow, null)
  assert.equal(context.latestSummaryError, '连接失败')
  assert.equal(context.latestSummaryLoading, false)
})

test('较早的请求迟到时不能覆盖最新请求结果或重新显示已删除的方案', async () => {
  let release
  let count = 0
  const { context } = createContext({
    GetTableData: async () => ++count === 1 ? new Promise((resolve) => { release = resolve }) : { Code: 1, Data: [] },
    GetFormData: async () => { throw new Error('过期请求不应继续读取详情') }
  })
  const older = context.loadLatestRecordSummary()
  await context.loadLatestRecordSummary()
  release({ Code: 1, Data: [{ Id: 'deleted-old' }] })
  await older
  assert.equal(context.latestSummaryRow, null)
  assert.equal(context.latestSummaryError, '')
})

test('切换客户后迟到的详情不能串客户，普通页面不请求摘要', async () => {
  let release
  let detailStarted
  const ready = new Promise((resolve) => { detailStarted = resolve })
  const { context } = createContext({
    GetTableData: async () => ({ Code: 1, Data: [{ Id: 'customer-a-proposal' }] }),
    GetFormData: async () => new Promise((resolve) => { release = resolve; detailStarted() })
  })
  const pending = context.loadLatestRecordSummary()
  await ready
  context.relationValue = 'customer-b'
  context.latestSummaryEnabled = false
  await context.loadLatestRecordSummary()
  release({ Code: 1, Data: { Id: 'customer-a-proposal' } })
  await pending
  assert.equal(context.latestSummaryRow, null)
  assert.equal(context.latestSummaryLoading, false)
})

test('金额零值正常显示，空值不冒充零，饮水方式按选项标签展示', () => {
  const { context } = createContext()
  context.latestSummaryRow = { DuonianLJCB: 0, DuonianLJCBAfter: null, DangqianYSFS: 'old' }
  assert.equal(context.latestSummaryValue({ field: 'DuonianLJCB', format: 'money' }), '¥0')
  assert.equal(context.latestSummaryValue({ field: 'DuonianLJCBAfter', format: 'money' }), '—')
  assert.equal(context.latestSummaryValue({ field: 'DangqianYSFS' }), '老式开水机（有过滤）')
})

test('查看详情打开摘要对应的最新记录，保留菜单和父子授权上下文', () => {
  const { context, openedForms } = createContext()
  context.config.title = '需求方案'
  context.rows = [{ Id: 'old-filtered-row' }]
  context.latestSummaryRow = { Id: 'latest-row' }
  context.openDetail(context.latestSummaryRow)
  assert.equal(openedForms.length, 1)
  assert.equal(openedForms[0].rowId, 'latest-row')
  assert.equal(openedForms[0].title, '需求方案详情')
  assert.equal(openedForms[0].mode, 'View')
  assert.equal(openedForms[0].menuId, context.menuId)
  assert.equal(openedForms[0].tableChildAuth, context.tableChildAuth)
})

test('比价按钮跳转目标必须注册在默认租户分包，且源码真实存在', async () => {
  const { context } = createContext()
  let navigation
  const sandbox = { uni: { navigateTo(options) { navigation = options; options.success() } } }
  const compare = vm.runInNewContext(`(async function ${context.compareProposals.toString().replace(/^async\s+/, '')})`, sandbox)
  context.proposalSelection = [{ Id: 'plan-a' }, { Id: 'plan-b' }]
  await compare.call(context)
  const [route, query] = navigation.url.slice(1).split('?')
  const profile = JSON.parse(fs.readFileSync(new URL('../profiles/xjy/pages.json', import.meta.url), 'utf8'))
  const routes = [...profile.pages.map((page) => page.path), ...profile.subPackages.flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page.path}`))]
  assert.ok(routes.includes(route), `比价跳转页未注册：${route}`)
  assert.ok(fs.existsSync(new URL(`../src/${route}.vue`, import.meta.url)))
  assert.equal(new URLSearchParams(query).get('ids'), 'plan-a,plan-b')
  assert.equal(context.proposalComparing, false)
})

test('摘要展开后剩余高度不足 80px 仍更新滚动区，收起后恢复可用高度', () => {
  let bodyTop = 540
  const query = {
    in() { return this }, select() { return this }, boundingClientRect() { return this },
    exec(callback) { callback([{ bottom: 574 }, { top: bodyTop }]) }
  }
  const { context } = createContext({}, { createSelectorQuery: () => query })
  Object.assign(context, { independentScroll: true, $nextTick: (callback) => callback(), listBodyHeight: 200 })
  context.measureListBody()
  assert.equal(context.listBodyHeight, 34)
  bodyTop = 580
  context.measureListBody()
  assert.equal(context.listBodyHeight, 1)
  bodyTop = 400
  context.measureListBody()
  assert.equal(context.listBodyHeight, 174)
})
