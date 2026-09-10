import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { filterOptionRows, filterTreeOptions } from '../src/platform/list-filter-options.mjs'

import {
  buildListFilterWhere,
  compileModuleFilterFields,
  hasListFilterValue,
  mergeModuleFilterFields,
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
  { Id: 'tenant-id', Name: 'TenantName', Label: '所属租户', component: 'Text', Type: 'varchar(255)', visible: true }
]

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
