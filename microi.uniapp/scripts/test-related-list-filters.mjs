import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as filters from '../src/platform/list-filter-fields.mjs'
import { appendSystemAuditFields, moduleProjectionFields } from '../src/platform/card-field-policy.mjs'
import { tableChildRequiresModuleQuery } from '../src/platform/table-child-query-target.mjs'

const read = (name) => fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const source = read('components/mci-business-related-list/mci-business-related-list.vue')
const plain = (value) => JSON.parse(JSON.stringify(value))
function component(source, dependencies) {
  const code = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default {', 'globalThis.component = {')
  const scope = { ...dependencies }
  vm.runInNewContext(code, scope)
  return scope.component
}
function related() {
  const requests = [], moduleRequests = [], toasts = []
  const parseJson = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback
    if (typeof value === 'object') return value
    try { return JSON.parse(value) } catch (error) { return fallback }
  }
  const definition = component(source, {
    ...filters, appendSystemAuditFields, moduleProjectionFields, parseJson, tableChildRequiresModuleQuery, getUser: () => ({}), clearTimeout,
    MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    uni: { showToast: (value) => toasts.push(value.title) },
    loadModuleRows: async (config, options) => {
      moduleRequests.push({ config, options })
      return { rows: [], count: 0 }
    },
    V8: { FormEngine: { GetTableData: async (table, params) => { requests.push({ table, params }); return { Code: 1, Data: [], DataCount: 0 } } } }
  })
  const state = {
    ...definition.data(), ...definition.methods,
    config: { table: 'Related', pageSize: 15 }, childFkField: 'ParentId', relationValue: 'parent-1',
    tableChildAuth: { ParentRowId: 'parent-1', Parent: { ParentRowId: 'ancestor-1' } },
    hydrateProposalInstallationPointRows: async (rows) => rows, hydrateCollectionRows: async (rows) => rows
  }
  for (const key of ['filterFields', 'filterFormData', 'activeFilterCount']) {
    Object.defineProperty(state, key, { get: () => definition.computed[key].call(state) })
  }
  return { state, requests, moduleRequests, toasts }
}
const nativeFields = [
  { Id: 'status', Name: 'Status', component: 'Radio', Type: 'varchar(50)', config: { SelectSaveField: 'Value' } },
  { Id: 'contact', Name: 'Contacts', component: 'MultipleSelect', Type: 'mediumtext', optionsRemote: true, config: { SelectSaveField: 'Id' } },
  { Id: 'switch', Name: 'Enabled', component: 'Switch', Type: 'int' },
  { Id: 'date', Name: 'Time', component: 'DateTime', Type: 'varchar(25)', config: { DateTimeType: 'datetime' } },
  { Id: 'region', Name: 'Region', component: 'Address' },
  { Id: 'dept', Name: 'Dept', component: 'Department', config: { Department: { Multiple: true, EmitPath: true } } },
  { Id: 'name', Name: 'Name', component: 'Text' }
]
const searches = nativeFields.map((field) => ({ Id: field.Id, DisplayType: field.Id === 'name' ? 'Line' : 'Out', DisplaySelect: false }))

test('关联列表复用主列表类型，Out/Line 和系统日期可筛选，配置刷新不保留旧字段', () => {
  const { state } = related()
  state.definition = { fields: nativeFields }
  state.localFilterFields = [{ key: 'old-status', field: 'Status', type: 'text' }]
  state.applyMenuSearchFields([...searches, { Name: 'CreateTime', DisplayType: 'In' }])
  assert.deepEqual(state.filterFields.map((field) => field.type), ['options', 'options', 'options', 'date-range', 'address', 'options', 'text', 'date-range'])
  assert.equal(state.filterFields[0].multiple, true)
  assert.equal(state.filterFields[1].presentation, 'dropdown')
  assert.equal(state.filterFields[1].storage, 'array')
  assert.equal(state.filterFields[1].source, 'native-field')
  assert.equal(state.filterFields[3].date.timeColumns, 3)
  assert.equal(state.filterFields[5].storage, 'paths')
  state.applyMenuSearchFields([{ Id: 'status', DisplayType: 'In', SearchMultiple: false }])
  assert.equal(state.filterFields.length, 1)
  assert.equal(state.filterFields[0].multiple, false)
  state.applyMenuSearchFields(undefined)
  assert.equal(state.filterFields.length, 1)
})

test('关联列表把 SelectFields 中的 Join 字段加入筛选弹窗', () => {
  const { state } = related()
  state.table = { Id: 'service-goods-table', Name: 'diy_shouhousp' }
  state.definition = { fields: nativeFields }
  state.config = {
    table: state.table.Name,
    tableId: state.table.Id,
    displayFields: [
      {
        Id: 'service-type',
        Name: 'Leixing',
        Label: '服务类型',
        TableId: 'service-order-table',
        TableName: 'Diy_ShouhouDD',
        component: 'Radio',
        options: [{ label: '安装', value: '安装' }],
        visible: true
      },
      ...nativeFields
    ]
  }

  state.applyMenuSearchFields([
    {
      Id: 'service-type',
      Name: 'Leixing',
      Label: '服务类型',
      TableId: 'service-order-table',
      TableName: 'Diy_ShouhouDD',
      DisplayType: 'In'
    },
    {
      Id: 'service-status',
      Name: 'FuwuZT',
      Label: '状态',
      TableId: 'service-order-table',
      TableName: 'Diy_ShouhouDD',
      DisplayType: 'Out'
    }
  ])

  assert.equal(state.filterFields.length, 2)
  assert.equal(state.filterFields[0].label, '服务类型')
  assert.equal(state.filterFields[0].type, 'options')
  assert.equal(state.filterFields[0].key, 'Diy_ShouhouDD.Leixing')
  assert.equal(state.filterFields[0].formEngineKey, 'Diy_ShouhouDD')
  assert.equal(state.filterFields[1].label, '状态')
  assert.equal(state.filterFields[1].key, 'Diy_ShouhouDD.FuwuZT')
  assert.equal(state.filterFields[1].formEngineKey, 'Diy_ShouhouDD')
})

test('关联筛选取消放弃草稿，重置不提前请求，非法日期阻止提交，0 计入已选', async () => {
  const { state, requests, toasts } = related()
  state.definition = { fields: nativeFields }; state.applyMenuSearchFields(searches)
  state.filterValues = { Status: ['active'], Enabled: 0 }
  state.openAdvancedFilters(); state.filterDraft.Status.push('pending')
  assert.equal(state.activeFilterCount, 2)
  state.closeAdvancedFilters()
  assert.deepEqual(state.filterValues.Status, ['active'])
  state.openAdvancedFilters(); state.filterDraft.Time = { start: '2026-09-10' }
  state.applyAdvancedFilters()
  assert.equal(state.filterOpen, true)
  assert.match(toasts[0], /补全/)
  assert.equal(requests.length, 0)
  state.resetAdvancedFilters()
  assert.equal(state.filterValues.Enabled, 0)
  state.applyAdvancedFilters(); await new Promise(setImmediate)
  assert.equal(requests.length, 1)
  assert.deepEqual(plain(requests[0].params._Where), [{ Name: 'ParentId', Type: '=', Value: 'parent-1' }])
})

for (const parent of ['customer', 'order']) test(`${parent} 关联查询始终保留外键与完整授权链，多选/时间/地区按共同规则发送`, async () => {
  const { state, requests } = related()
  state.relationValue = `${parent}-1`; state.tableChildAuth.ParentRowId = state.relationValue
  state.definition = { fields: nativeFields }; state.applyMenuSearchFields(searches)
  state.filterValues = { Status: ['pending', 'active'], Contacts: ['a', 'b'], Enabled: 0, Time: { start: '2026-09-10 12:30:01', end: '2026-09-10 12:30:02' }, Region: ['浙江省', '杭州市', '全部'] }
  await state.loadData(true, true)
  const query = requests[0].params
  assert.deepEqual(plain(query._TableChildAuth), plain(state.tableChildAuth))
  assert.equal(query._TableChildAuth.Parent.ParentRowId, 'ancestor-1')
  assert.deepEqual(plain(query._Where), [{ Name: 'ParentId', Type: '=', Value: state.relationValue }, ...filters.buildListFilterWhere(state.filterFields, state.filterValues)])
  assert.ok(query._Where.some((item) => item.Name === 'Status' && item.Type === 'In' && item.Value.length === 2))
  assert.ok(query._Where.some((item) => item.Name === 'Enabled' && item.Value === 0))
  assert.ok(query._Where.some((item) => item.Name === 'Time' && item.Value === '2026-09-10 12:30:03'))
  assert.ok(query._Where.filter((item) => item.Name === 'Region').every((item) => item.Type === 'StartLike' && !item.Value.includes('全部')))
  assert.equal(query.SysMenuId, undefined)
})

test('配置联表的 TableChild 走模块查询并保留授权链、父子外键与卡片字段', async () => {
  const { state, requests, moduleRequests } = related()
  state.table = { Id: 'service-goods-table', Name: 'diy_shouhousp' }
  state.menu = {
    Id: 'service-goods-menu',
    DiyTableId: state.table.Id,
    ModuleEngineKey: 'service-goods-module',
    SqlJoin: 'LEFT JOIN Diy_ShouhouDD B ON A.ShouhouDDID = B.Id'
  }
  state.config = {
    table: state.table.Name,
    tableId: state.table.Id,
    menuId: state.menu.Id,
    menu: state.menu,
    moduleEngineKey: state.menu.ModuleEngineKey,
    pageSize: 15,
    selectFields: ['Id', 'ShebeiMC', 'Leixing', 'FuwuZT'],
    bottomFields: [{ field: 'Leixing', queryField: 'Leixing' }],
    displayFields: [{
      Id: 'service-type', Name: 'Leixing', Label: '服务类型',
      TableId: 'service-order-table', TableName: 'Diy_ShouhouDD',
      component: 'Radio', visible: true
    }]
  }
  state.definition = { fields: nativeFields }
  state.childFkField = 'ShebeiBH'
  state.relationValue = 'device-1'
  state.tableChildAuth = { ParentRowId: 'device-1', Parent: { ParentRowId: 'customer-1' } }
  state.applyMenuSearchFields([{
    Id: 'service-type', Name: 'Leixing', Label: '服务类型',
    TableId: 'service-order-table', TableName: 'Diy_ShouhouDD', DisplayType: 'In'
  }])
  state.filterValues = { 'Diy_ShouhouDD.Leixing': ['安装'] }

  await state.loadData(true, true)

  assert.equal(requests.length, 0)
  assert.equal(moduleRequests.length, 1)
  const call = moduleRequests[0]
  assert.equal(call.config.moduleEngineKey, 'service-goods-module')
  for (const field of ['Leixing', 'FuwuZT', 'ShebeiBH']) assert.ok(call.config.selectFields.includes(field), field)
  assert.equal(call.options.tableChildModuleQuery, true)
  assert.deepEqual(plain(call.options.tableChildAuth), plain(state.tableChildAuth))
  assert.deepEqual(plain(call.options.extraWhere), [
    { Name: 'ShebeiBH', Type: '=', Value: 'device-1' },
    { FormEngineKey: 'Diy_ShouhouDD', Name: 'Leixing', Type: 'In', Value: ['安装'] }
  ])
})

test('关联选择器分页和树懒加载携带菜单、父子授权和子表外键，主列表仍可省略上下文', async () => {
  const calls = []
  const fieldComponent = component(read('components/mci-list-filter-field/mci-list-filter-field.vue'), {
    MciNativeField: {}, regionPickerSelection: () => [], isRemoteNativeFieldOptions: () => true,
    loadNativeFieldOptionPage: async (...args) => { calls.push(args); return { options: [] } }
  })
  const { state } = related()
  const picker = { field: { nativeField: nativeFields[1], tree: {} }, formData: state.filterFormData, menuId: 'child-menu', moduleEngineKey: 'child-module', tableChildAuth: state.tableChildAuth }
  await fieldComponent.methods.sourcePage.call(picker, { pageIndex: 2, pageSize: 20, keyword: '甲', parentValue: 'root' })
  assert.deepEqual(plain(calls[0][1]), { ParentId: 'parent-1' })
  assert.deepEqual(plain(calls[0][2]), { pageIndex: 2, pageSize: 20, keyword: '甲', parentValue: 'root', menuId: 'child-menu', moduleEngineKey: 'child-module', tableChildAuth: plain(state.tableChildAuth), preserveTree: true, timeoutMs: 15000 })
  assert.equal(fieldComponent.props.tableChildAuth.default, null)
  assert.deepEqual(plain(fieldComponent.props.formData.default()), {})
  assert.match(source, /<mci-list-filter-field[\s\S]*?:table-child-auth="tableChildAuth" :form-data="filterFormData"/)
})
