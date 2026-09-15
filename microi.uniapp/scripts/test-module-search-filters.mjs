import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { filterOptionRows, filterTreeOptions } from '../src/platform/list-filter-options.mjs'

import {
  buildListFilterWhere,
  compileModuleFilterFields,
  hasListFilterValue,
  mergeModuleFilterFields,
  mergeTableSelectorFilterFields,
  relativeDaysFilterBounds,
  validateListFilters
} from '../src/platform/list-filter-fields.mjs'

const fields = [
  { Id: 'account-id', Name: 'Account', Label: '登陆帐号', component: 'Text', Type: 'varchar(255)', visible: true },
  { Id: 'phone-id', Name: 'Phone', Label: '手机号', component: 'Text', Type: 'varchar(255)', visible: true },
  {
    Id: 'role-id',
    Name: 'RoleIds',
    Label: '角色',
    component: 'MultipleSelect',
    Type: 'mediumtext',
    visible: true,
    multiple: true,
    optionsRemote: true,
    options: [],
    config: { DataSource: 'Sql', SelectLabel: 'Name' }
  },
  { Id: 'level-id', Name: 'Level', Label: '角色级别', component: 'NumberText', Type: 'int(11)', visible: true },
  { Id: 'created-id', Name: 'CreateTime', Label: '创建时间', component: 'DateTime', Type: 'datetime', Visible: 1, AppVisible: 1, visible: false },
  { Id: 'contract-days-id', Name: 'HetongDQSJ', Label: '距合同到期天数', component: 'Text', Type: 'varchar(50)', Visible: 0, AppVisible: 0, visible: false, config: { RelativeDaysSearch: { Enabled: true, TargetField: 'HetongJSSJ', Mode: 'FutureWithin', Min: 0, Max: 3650, TimeZone: 'Asia/Shanghai', Unit: '天' } } },
  { Id: 'tenant-id', Name: 'TenantName', Label: '所属租户', component: 'Text', Type: 'varchar(255)', visible: true }
]
const businessSource = fs.readFileSync(new URL('../src/tenants/xjy/business.js', import.meta.url), 'utf8')
const businessListSource = fs.readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
const moduleRegistrySource = fs.readFileSync(new URL('../src/platform/module-registry.js', import.meta.url), 'utf8')
const listFilterFieldSource = fs.readFileSync(new URL('../src/components/mci-list-filter-field/mci-list-filter-field.vue', import.meta.url), 'utf8')
const ordersStart = businessSource.indexOf('  orders: native({')
const tasksStart = businessSource.indexOf('  tasks:', ordersStart)
const ordersSource = ordersStart >= 0 && tasksStart > ordersStart
  ? businessSource.slice(ordersStart, tasksStart)
  : ''

test('我的订单不排除终态，并提供已作废和已到期状态筛选', () => {
  assert.ok(ordersSource, '未找到 orders 租户配置')
  assert.doesNotMatch(ordersSource, /fixedWhere\s*:\s*\[[^\]]*DingdanZT[^\]]*已作废/)
  assert.match(
    ordersSource,
    /statusOptions:\s*\['待审批',\s*'已审批',\s*'已驳回',\s*'待审批作废',\s*'已作废',\s*'已到期'\]/
  )
  assert.match(ordersSource, /summaryFixedWhere:\s*\[\{ Name: 'DingdanZT', Type: '!=', Value: '已作废' \}\]/)
  assert.match(businessListSource, /const localStatusOptions = Array\.isArray\(merged\.statusOptions\) \? merged\.statusOptions : \[\]/)
  assert.match(businessListSource, /merged\.statusOptions = \[\.\.\.new Set\(\[/)
  assert.match(businessListSource, /\.\.\.\(Array\.isArray\(dynamic\.statusOptions\) \? dynamic\.statusOptions : \[\]\)/)
  assert.match(businessListSource, /\.\.\.localStatusOptions\n\s*\]\)\]/)
})

test('后台 SearchFieldIds 编译为移动端高级筛选，Out 保留查询配置，Line 留在行内', () => {
  const searchFieldIds = JSON.stringify([
    { Id: 'account-id', Name: 'Account', DisplayType: 'Line' },
    { Id: 'phone-id', Name: 'Phone', Label: '联系电话', DisplayType: 'In' },
    { Id: 'role-id', Name: 'RoleIds', Label: '角色', DisplayType: 'In', DisplaySelect: true },
    { Id: 'level-id', Name: 'Level', Label: '角色级别', DisplayType: 'In' },
    { Id: 'created-id', Name: 'CreateTime', Label: '创建时间', DisplayType: 'In' },
    { Id: 'tenant-id', Name: 'TenantName', DisplayType: 'Out' }
  ])

  const compiled = compileModuleFilterFields(searchFieldIds, fields)
  assert.deepEqual(compiled.map((field) => field.field), ['Phone', 'RoleIds', 'Level', 'CreateTime', 'TenantName'])
  assert.equal(compiled[0].type, 'text')
  assert.equal(compiled[1].type, 'options')
  assert.equal(compiled[1].presentation, 'dropdown')
  assert.equal(compiled[1].displaySelect, true)
  assert.equal(compiled[1].source, 'native-field')
  assert.equal(compiled[1].multiple, true)
  assert.equal(compiled[1].multiValueLike, true)
  assert.equal(compiled[2].type, 'range')
  assert.equal(compiled[3].type, 'date-range')
})

test('后台明确配置的查询字段不受移动表单显隐影响，但仍遵守角色字段权限', () => {
  const searchFieldIds = [
    { Id: 'contract-status-id', Name: 'HetongZT', Label: '合同状态', DisplayType: 'In' },
    { Id: 'contract-upload-id', Name: 'IsDingdanHT', Label: '合同是否上传', DisplayType: 'Out' }
  ]
  const hiddenFormFields = [
    { Id: 'contract-status-id', Name: 'HetongZT', Label: '合同状态', component: 'Radio', Visible: 0, AppVisible: 0, visible: false, bindRoleIds: [], options: [] },
    { Id: 'contract-upload-id', Name: 'IsDingdanHT', Label: '合同是否上传', component: 'Radio', Visible: 0, AppVisible: 0, visible: false, bindRoleIds: [], options: [] }
  ]

  assert.deepEqual(compileModuleFilterFields(searchFieldIds, hiddenFormFields), [])
  assert.deepEqual(
    compileModuleFilterFields(searchFieldIds, hiddenFormFields, { allowAppHidden: true }).map((field) => field.field),
    ['HetongZT', 'IsDingdanHT']
  )

  const roleRestricted = hiddenFormFields.map((field) => ({
    ...field,
    bindRoleIds: ['restricted-role']
  }))
  assert.deepEqual(compileModuleFilterFields(searchFieldIds, roleRestricted, { allowAppHidden: true }), [])
})

test('模块定义使用完整字段元数据编译后台筛选，而不是只读取移动表单可见字段', () => {
  assert.match(
    moduleRegistrySource,
    /const searchMetadataFields = definition\.layoutFields\?\.length \? definition\.layoutFields : fields/
  )
  assert.match(
    moduleRegistrySource,
    /module\.menu\.SearchFieldIds,\s*appendSystemAuditFields\(searchMetadataFields\),\s*\{ allowAppHidden: true \}/
  )
})

test('选项字段按后台组件类型决定下拉或平铺呈现', () => {
  const componentFields = [
    { Id: 'select-id', Name: 'SelectValue', Label: '下拉字段', component: 'Select', visible: true, options: [] },
    { Id: 'radio-id', Name: 'RadioValue', Label: '单选字段', component: 'Radio', visible: true, options: [] },
    { Id: 'forced-id', Name: 'ForcedSelect', Label: '强制下拉', component: 'Radio', visible: true, options: [] }
  ]
  const compiled = compileModuleFilterFields([
    { Id: 'select-id', DisplayType: 'In' },
    { Id: 'radio-id', DisplayType: 'In' },
    { Id: 'forced-id', DisplayType: 'In', DisplaySelect: true }
  ], componentFields)

  assert.deepEqual(compiled.map((field) => field.presentation), ['dropdown', 'chips', 'dropdown'])
})

test('角色多选按 RoleIds 中的稳定角色 Id 做 OR Like 比对', () => {
  const compiled = compileModuleFilterFields([{ Id: 'role-id', DisplayType: 'In' }], fields)
  const where = buildListFilterWhere(compiled, { RoleIds: ['role-a', 'role-b'] })

  const matches = (stored) => where.some((condition) => stored.includes(condition.Value))
  assert.equal(matches('["role-a"]'), true)
  assert.equal(matches('["role-x", "role-b"]'), true)
  assert.equal(matches('["role-ab"]'), false)
  assert.equal(matches('[{"Name":"role-a"}]'), false)
  assert.equal(where[0].GroupStart, true)
  assert.equal(where.at(-1).GroupEnd, true)
})

test('日期和数值区间生成边界条件，筛选计数识别对象值', () => {
  const compiled = compileModuleFilterFields([
    { Id: 'level-id', DisplayType: 'In' },
    { Id: 'created-id', DisplayType: 'In' }
  ], fields)
  const where = buildListFilterWhere(compiled, {
    Level: { min: '10', max: '9999' },
    CreateTime: { start: '2026-08-01', end: '2026-08-20' }
  })

  assert.deepEqual(where, [
    { Name: 'Level', Type: '>=', Value: 10 },
    { Name: 'Level', Type: '<=', Value: 9999 },
    { Name: 'CreateTime', Type: '>=', Value: '2026-08-01 00:00:00' },
    { Name: 'CreateTime', Type: '<', Value: '2026-08-21 00:00:00' }
  ])
  assert.equal(hasListFilterValue({ start: '', end: '' }), false)
  assert.equal(hasListFilterValue({ start: '2026-08-01', end: '' }), true)
})

test('合同到期天数编译为受限输入，并查询真实合同结束日期', () => {
  const compiled = compileModuleFilterFields(
    [{ Id: 'contract-days-id', DisplayType: 'In' }],
    fields,
    { allowAppHidden: true }
  )[0]
  assert.equal(compiled.type, 'relative-days')
  assert.equal(compiled.relativeDays.min, 0)
  assert.equal(compiled.relativeDays.max, 3650)
  assert.match(compiled.description, /0 表示仅今天到期/)
  assert.deepEqual(relativeDaysFilterBounds(compiled, '30', new Date('2026-09-14T16:30:00.000Z')), [
    { Name: 'HetongJSSJ', Type: '>=', Value: '2026-09-15' },
    { Name: 'HetongJSSJ', Type: '<', Value: '2026-10-16' }
  ])
  assert.deepEqual(relativeDaysFilterBounds(compiled, 0, new Date('2026-09-15T03:00:00.000Z')), [
    { Name: 'HetongJSSJ', Type: '>=', Value: '2026-09-15' },
    { Name: 'HetongJSSJ', Type: '<', Value: '2026-09-16' }
  ])
  assert.deepEqual(buildListFilterWhere([compiled], { HetongDQSJ: '30' }).map(({ Name, Type }) => ({ Name, Type })), [
    { Name: 'HetongJSSJ', Type: '>=' },
    { Name: 'HetongJSSJ', Type: '<' }
  ])
  assert.match(validateListFilters([compiled], { HetongDQSJ: '-10' }), /0 至 3650/)
  assert.match(validateListFilters([compiled], { HetongDQSJ: '1.5' }), /整数/)
  assert.match(validateListFilters([compiled], { HetongDQSJ: '3651' }), /0 至 3650/)
  assert.equal(validateListFilters([compiled], { HetongDQSJ: '30' }), '')
  assert.match(listFilterFieldSource, /field\.type === 'relative-days'/)
  assert.match(listFilterFieldSource, /type="number"/)
  assert.match(listFilterFieldSource, /0 表示仅今天到期；输入 N 表示未来 N 天内到期（含今天）/)
})

function compile(component, config = {}, extra = {}, search = {}) {
  return compileModuleFilterFields([{ Id: 'field', ...search }], [{ Id: 'field', Name: 'Value', Label: '测试', component, config, ...extra }])[0]
}

test('数字列中的 Switch 和 Select 保留组件；Radio 查询多选必须显式配置', () => {
  const radio = compile('Radio', {}, { multiple: true, Type: 'int' })
  assert.equal(radio.multiple, false)
  assert.equal(radio.presentation, 'chips')
  assert.equal(compile('Radio', {}, {}, { SearchMultiple: true }).multiple, true)
  assert.equal(compile('Select', {}, { Type: 'int' }).type, 'options')
  const field = compile('Switch', {}, { Type: 'tinyint' })
  assert.deepEqual(field.options.map((item) => item.value), ['', 1, 0])
  assert.deepEqual(buildListFilterWhere([field], { Value: '' }), [])
  assert.deepEqual(buildListFilterWhere([field], { Value: 0 }), [{ Name: 'Value', Type: '=', Value: 0 }])
  assert.equal(hasListFilterValue(0), true)
})

test('本地显式查询多选保留，Address 仍按后台组件，后台查询配置优先', () => {
  const merged = mergeModuleFilterFields([], [{ key: 'radio', field: 'Value', multiple: true, type: 'options' }, { key: 'region', field: 'Region', type: 'text' }], [{ Id: 'r', Name: 'Value', component: 'Radio' }, { Id: 'a', Name: 'Region', component: 'Address' }])
  assert.equal(merged[0].multiple, true)
  assert.equal(merged[1].type, 'address')
  const backend = compileModuleFilterFields([{ Id: 'r', DisplayType: 'Out', SearchMultiple: false }], [{ Id: 'r', Name: 'Value', component: 'Radio' }])
  assert.equal(mergeModuleFilterFields(backend, [{ key: 'radio', field: 'Value', multiple: true }])[0].multiple, false)
})

test('客户平台真实查询配置：客户类型与合作状态兼容复选组，不改变单值存储', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/customer-radio-search.json', import.meta.url), 'utf8'))
  const compiled = compileModuleFilterFields(fixture.search, fixture.fields)
  assert.deepEqual(compiled.map((field) => [field.field, field.multiple, field.storedMultiple, field.storage, field.presentation]), [
    ['KehuLX', true, false, 'scalar', 'chips'], ['Zhuangtai', true, false, 'scalar', 'chips']
  ])
  const where = buildListFilterWhere(compiled, { KehuLX: ['政府机关', '央企'], Zhuangtai: ['目标客户', '合作客户'] })
  assert.deepEqual(where, [{ Name: 'KehuLX', Type: 'In', Value: ['政府机关', '央企'] }, { Name: 'Zhuangtai', Type: 'In', Value: ['目标客户', '合作客户'] }])
  assert.deepEqual(buildListFilterWhere(compiled, { KehuLX: [], Zhuangtai: [] }), [])
  const overridden = compileModuleFilterFields(fixture.search.map((item) => ({ ...item, SearchMultiple: false })), fixture.fields)
  assert.ok(overridden.every((field) => field.multiple === false))
})

test('旧版查询复选组兼容布尔字符串，未配置的 Radio 保留单选', () => {
  assert.equal(compile('Radio', {}, {}, { DisplaySelect: 'false' }).multiple, true)
  assert.equal(compile('Radio', {}, {}, { displaySelect: 0 }).multiple, true)
  assert.equal(compile('Radio', {}, {}, { DisplaySelect: true }).multiple, true)
  assert.equal(compile('Radio').multiple, false)
  assert.equal(compile('Select').multiple, false)
  assert.equal(compile('Select', {}, {}, { DisplayType: 'In', SearchMultiple: false }).multiple, false)
})

// 2026-09-10 只读回读真实菜单/字段，剔除 SQL 和业务行；覆盖 In/Out 及缺省 DisplaySelect。
const businessFixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/business-option-search.json', import.meta.url), 'utf8'))
for (const fixture of businessFixtures) test(`${fixture.name}：后台选项查询支持多选，条件遵守实际存储`, () => {
  const compiled = compileModuleFilterFields(fixture.search, fixture.fields)
  assert.equal(compiled.length, fixture.fields.length)
  for (const field of compiled) {
    assert.equal(field.multiple, true, `${field.label} 不能降为单选`)
    assert.equal(field.presentation, field.component === 'Radio' ? 'chips' : 'dropdown')
    const options = ['a', 'b'].map((value) => ({ value, label: `显示 ${value}`, raw: { Id: value, [field.config.SelectSaveField || 'Name']: value } }))
    const values = filterOptionRows(field, options).map((option) => option.raw)
    const where = buildListFilterWhere([field], { [field.key]: values })
    if (field.component === 'MultipleSelect') {
      assert.equal(field.storage, 'array')
      assert.ok(where.every((condition) => condition.Type === 'Like'))
      assert.equal(where[0].GroupStart, true)
      assert.equal(where.at(-1).GroupEnd, true)
    } else {
      assert.equal(field.storedMultiple, false, '查询多选不能修改表单存储类型')
      assert.deepEqual(where, [{ Name: field.field, Type: 'In', Value: ['a', 'b'] }])
    }
    assert.deepEqual(buildListFilterWhere([field], { [field.key]: [] }), [])
  }
})

test('设备 Out 状态在主列表合并后只有一个多选控件，隐藏/角色限制不被放开', () => {
  const fixture = businessFixtures.find((item) => item.name === '设备列表')
  const compiled = compileModuleFilterFields(fixture.search, fixture.fields)
  const merged = mergeModuleFilterFields(compiled, [{ key: 'state', field: 'ShebeiZT', type: 'options', multiple: true }], fixture.fields)
  assert.equal(merged.length, 1)
  assert.deepEqual(buildListFilterWhere(merged, { ShebeiZT: ['待安装', '使用中'] }), [{ Name: 'ShebeiZT', Type: 'In', Value: ['待安装', '使用中'] }])
  assert.deepEqual(compileModuleFilterFields(fixture.search.map((item) => ({ ...item, Hide: true })), fixture.fields), [])
  assert.deepEqual(compileModuleFilterFields(fixture.search, fixture.fields.map((field) => ({ ...field, bindRoleIds: ['restricted'], visible: false }))), [])
})

test('多选对象按稳定 Id 查询，保存字段值数组同时兼容历史对象，KeyValue 保留 Key', () => {
  const options = [{ value: 'person-a', label: '联系人甲', raw: { Id: 'person-a', Name: '联系人甲' } }]
  for (const component of ['Checkbox', 'MultipleSelect']) {
    const field = compile(component, { SelectSaveField: 'Id' })
    assert.equal(field.multiple, true)
    assert.equal(field.presentation, 'dropdown')
    const chosen = filterOptionRows(field, options)[0].raw
    assert.equal(chosen._filterValue, 'person-a')
    const where = buildListFilterWhere([field], { Value: [chosen] })
    const match = (stored) => where.some((condition) => stored.includes(condition.Value))
    assert.equal(match('["person-a"]'), true)
    assert.equal(match('[{"Id":"person-a","Name":"改名后"}]'), true)
    assert.equal(match('[{"Id":"person-ab","Name":"联系人甲"}]'), false)
  }
  const field = compile('MultipleSelect', { SelectLabel: 'Name' })
  const chosen = filterOptionRows(field, options)[0].raw
  assert.deepEqual(chosen._filterValue, options[0].raw)
  assert.ok(buildListFilterWhere([field], { Value: [chosen] }).every((condition) => condition.Value.includes('"Id"')))
  const keyValue = compile('Select', { DataSource: 'KeyValue' })
  assert.equal(keyValue.storage, 'object')
  const option = filterOptionRows(keyValue, [{ value: 0, label: '待处理', raw: { Key: 0, Value: '待处理' } }])[0]
  const where = buildListFilterWhere([keyValue], { Value: option.raw })
  assert.ok(where.some((item) => '{"Key":0,"Value":"改名"}'.includes(item.Value)))
  assert.ok(!where.some((item) => '{"Key":01,"Value":"待处理"}'.includes(item.Value)))
})

test('标量下拉可显式按显示业务值查询，不能把数据源主键误传给服务端', () => {
  const field = {
    key: 'ShebeiXH',
    field: 'ShebeiXH',
    type: 'options',
    component: 'Select',
    multiple: true,
    storage: 'scalar',
    queryValue: 'label',
    config: { SelectSaveField: 'Id', SelectLabel: 'ShebeiXH' }
  }
  const options = [
    { value: '34ca5566-52a9-4936-997d-555b6ca1c09e', label: 'FY-150K', raw: { Id: '34ca5566-52a9-4936-997d-555b6ca1c09e', ShebeiXH: 'FY-150K' } }
  ]
  const selected = filterOptionRows(field, options)[0].raw

  assert.equal(selected._filterKey, '34ca5566-52a9-4936-997d-555b6ca1c09e')
  assert.equal(selected._filterValue, 'FY-150K')
  assert.deepEqual(buildListFilterWhere([field], { ShebeiXH: [selected] }), [
    { Name: 'ShebeiXH', Type: 'In', Value: ['FY-150K'] }
  ])
})

for (const [type, start, end, upper] of [
  ['year', '2024', '2024', '2025'], ['month', '2024-12', '2024-12', '2025-01'],
  ['date', '2024-02-29', '2024-02-29', '2024-03-01'],
  ['datetime_HH', '2024-12-31 23', '2024-12-31 23', '2025-01-01 00'],
  ['datetime_HHmm', '2024-12-31 23:59', '2024-12-31 23:59', '2025-01-01 00:00'],
  ['datetime', '2024-12-31 23:59:59', '2024-12-31 23:59:59', '2025-01-01 00:00:00'],
  ['HH:mm', '12:58', '12:58', '12:59'], ['HH:mm:ss', '12:58:59', '12:58:59', '12:59:00']
]) test(`DateTime ${type} 保留后台精度并包含结束单位`, () => {
  const field = compile('DateTime', { DateTimeType: type }, { Type: 'varchar(255)' })
  assert.deepEqual(buildListFilterWhere([field], { Value: { start, end } }), [{ Name: 'Value', Type: '>=', Value: start }, { Name: 'Value', Type: '<', Value: upper }])
})

test('日期与数值倒序、缺失时分秒和非法日期阻止应用', () => {
  const date = compile('DateTime', { DateTimeType: 'datetime' })
  assert.match(validateListFilters([date], { Value: { start: '2026-02-30 10:20:30' } }), /无效/)
  assert.match(validateListFilters([date], { Value: { start: '2026-02-28' } }), /补全/)
  assert.match(validateListFilters([date], { Value: { start: '2026-03-01 00:00:00', end: '2026-02-28 00:00:00' } }), /不能晚于/)
  assert.match(validateListFilters([compile('NumberText')], { Value: { min: 20, max: 0 } }), /最小值/)
})

test('Address 省市区按名称数组和路径前缀筛选，全部不落库', () => {
  const field = compile('Address')
  const where = buildListFilterWhere([field], { Value: ['浙江省', '杭州市', '全部'] })
  const match = (stored) => where.some((item) => stored.startsWith(item.Value))
  assert.equal(match('["浙江省","杭州市","滨江区"]'), true)
  assert.equal(match('["浙江省", "杭州市", "西湖区"]'), true)
  assert.equal(match('["浙江省","宁波市","江北区"]'), false)
  assert.equal(match('["浙江省","杭州市新区","某区"]'), false)
  assert.deepEqual(buildListFilterWhere([field], { Value: [] }), [])
})

test('树保留父子与路径，禁用节点不可选，可显式限制选择层级', () => {
  const field = compile('Cascader', { SelectSaveField: 'Id', SelectLabel: 'Name', Cascader: { EmitPath: true, Children: 'nodes', Disabled: 'blocked' } }, {}, { SearchSelectableLevels: [2] })
  const rows = filterTreeOptions(field, [{ Id: 'p', Name: '省', nodes: [{ Id: 'a', Name: '市甲' }, { Id: 'b', Name: '市乙', blocked: true }] }])
  assert.deepEqual(rows[1].raw._filterValue, ['p', 'a'])
  assert.deepEqual(rows[1].treeAncestors, [rows[0].value])
  assert.equal(rows[0].treeDisabled, true)
  assert.equal(rows[1].treeDisabled, false)
  assert.equal(rows[2].treeDisabled, true)
  const where = buildListFilterWhere([field], { Value: rows[1].raw })
  assert.ok(where.some((item) => '["p","a"]'.includes(item.Value)))
  assert.ok(!where.some((item) => '["q","a"]'.includes(item.Value)))
  const dept = compile('Department', { Department: { Multiple: true, EmitPath: false } })
  assert.equal(dept.storage, 'array')
  const flat = filterTreeOptions(dept, [{ Id: 'p', Name: '总部', ParentId: '' }, { Id: 'c', Name: '部门', ParentId: 'p' }])
  assert.deepEqual(flat[1].treePath, ['p', 'c'])
  assert.equal(flat[1].raw._filterValue, 'c')
  assert.throws(() => filterTreeOptions(dept, [{ Id: 'c', Name: '部门', ParentId: 'missing' }]), /缺少父级/)
})

test('后台筛选优先，保留租户专用排序等扩展筛选', () => {
  const merged = mergeModuleFilterFields(
    [{ key: 'Phone', field: 'Phone', type: 'text' }],
    [
      { key: 'phone-local', field: 'Phone', type: 'text' },
      { key: 'sort', type: 'sort', options: [] }
    ]
  )
  assert.deepEqual(merged.map((field) => field.key), ['Phone', 'sort'])
})

test('租户可显式覆盖同字段的呈现与查询值协议', () => {
  const merged = mergeModuleFilterFields(
    [{ key: 'ShebeiXH', field: 'ShebeiXH', label: '设备型号', type: 'text' }],
    [{
      key: 'model', field: 'ShebeiXH', label: '设备型号', type: 'options', component: 'Select',
      presentation: 'dropdown', multiple: true, storage: 'scalar', queryValue: 'label', overrideConfigured: true
    }],
    [{ Id: 'model-id', Name: 'ShebeiXH', Label: '设备型号', component: 'Text', visible: true }]
  )

  assert.equal(merged.length, 1)
  assert.equal(merged[0].type, 'options')
  assert.equal(merged[0].presentation, 'dropdown')
  assert.equal(merged[0].queryValue, 'label')
})

test('我的设备将设备型号声明为按业务值查询的多选下拉', () => {
  assert.match(businessSource, /key: 'model', label: '设备型号', field: 'ShebeiXH', type: 'options'/)
  assert.match(businessSource, /presentation: 'dropdown', multiple: true, storage: 'scalar', queryValue: 'label', overrideConfigured: true/)
  assert.match(businessSource, /source: 'module', moduleEngineKey: 'Diy_KehuSB', valueField: 'ShebeiXH', labelField: 'ShebeiXH'/)
  assert.match(listFilterFieldSource, /field\.source === 'module'/)
  assert.match(listFilterFieldSource, /!field\.source && isRemoteNativeFieldOptions\(native\)/)
  assert.match(listFilterFieldSource, /if \(!field\.source\)/)
  assert.match(listFilterFieldSource, /'\/apiengine\/platform-module-data'/)
  assert.match(listFilterFieldSource, /ModuleEngineKey: moduleEngineKey/)
})

test('开表选择器以菜单筛选为基础，特殊展示配置同字段覆盖、新字段追加', () => {
  const menuFilters = [
    { key: 'Name', field: 'Name', label: '名称', type: 'text' },
    { key: 'Status', field: 'Status', label: '后台状态', type: 'options', options: [{ value: 1, label: '启用' }] }
  ]
  const presentationFilters = [
    { key: 'specialStatus', field: 'Status', label: '业务状态', type: 'select', source: 'baseData', parentKey: 'STATUS' },
    { key: 'city', field: 'City', label: '城市', type: 'address' }
  ]

  const merged = mergeTableSelectorFilterFields(menuFilters, presentationFilters)
  assert.deepEqual(merged.map((field) => [field.key, field.field, field.type]), [
    ['Name', 'Name', 'text'],
    ['specialStatus', 'Status', 'select'],
    ['city', 'City', 'address']
  ])
  assert.equal(merged[1].label, '业务状态')
  assert.equal(merged[1].parentKey, 'STATUS')
  assert.equal(merged[1].options, undefined, '特殊业务覆盖不能残留后台控件的选项语义')
  assert.notEqual(merged[0], menuFilters[0], '合并结果不能修改菜单定义')
})

test('开表选择器忽略不完整或不支持的特殊筛选，不会覆盖有效菜单配置', () => {
  const menu = [{ key: 'Status', field: 'Status', label: '状态', type: 'options' }]
  assert.deepEqual(mergeTableSelectorFilterFields(menu, [
    { key: 'bad', field: 'Status', type: 'sort' },
    { key: 'missing-type', field: 'Other' }
  ]), menu)
})
