import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildListFilterWhere,
  compileModuleFilterFields,
  hasListFilterValue,
  mergeModuleFilterFields
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

test('后台 SearchFieldIds 编译为移动端高级筛选，排除 Line/Out 字段', () => {
  const searchFieldIds = JSON.stringify([
    { Id: 'account-id', Name: 'Account', DisplayType: 'Line' },
    { Id: 'phone-id', Name: 'Phone', Label: '联系电话', DisplayType: 'In' },
    { Id: 'role-id', Name: 'RoleIds', Label: '角色', DisplayType: 'In', DisplaySelect: true },
    { Id: 'level-id', Name: 'Level', Label: '角色级别', DisplayType: 'In' },
    { Id: 'created-id', Name: 'CreateTime', Label: '创建时间', DisplayType: 'In' },
    { Id: 'tenant-id', Name: 'TenantName', DisplayType: 'Out' }
  ])

  const compiled = compileModuleFilterFields(searchFieldIds, fields)
  assert.deepEqual(compiled.map((field) => field.field), ['Phone', 'RoleIds', 'Level', 'CreateTime'])
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

  assert.deepEqual(where, [
    { AndOr: 'AND', GroupStart: true, Name: 'RoleIds', Type: 'Like', Value: 'role-a', GroupEnd: false },
    { AndOr: 'OR', GroupStart: false, Name: 'RoleIds', Type: 'Like', Value: 'role-b', GroupEnd: true }
  ])
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
    { Name: 'CreateTime', Type: '<=', Value: '2026-08-20 23:59:59' }
  ])
  assert.equal(hasListFilterValue({ start: '', end: '' }), false)
  assert.equal(hasListFilterValue({ start: '2026-08-01', end: '' }), true)
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
