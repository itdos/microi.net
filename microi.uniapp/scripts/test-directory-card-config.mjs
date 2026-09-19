import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildListApiEnginePayload, listApiEnginePresentationKey } from '../src/platform/list-api-engine.mjs'
import * as cardPolicy from '../src/platform/card-field-policy.mjs'
import { normalizeStringList } from '../src/platform/view-schema-core.mjs'
import { compileModuleFilterFields } from '../src/platform/list-filter-fields.mjs'
import { mergeModuleFilterFields, buildListFilterWhere } from '../src/platform/list-filter-fields.mjs'
import * as visibility from '../src/platform/native-field-visibility.mjs'
import * as treeOptions from '../src/platform/native-tree-options.mjs'

const engineUrl = new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/移动端通讯录获取系统人员(get-sysUser-list)(get-sysUser-list).js', import.meta.url)
const engine = Function('V8', readFileSync(process.env.DIRECTORY_ENGINE_TEST_FILE || engineUrl, 'utf8'))
const table = { Id: 'users-table', Name: 'Sys_User', Description: '员工信息' }
const fields = ['Name', 'Account', 'Phone', 'Sex', 'DeptName', 'RoleIds', 'DeptId', 'UserType', 'Jobs', 'State', 'Pwd', 'AiApiKey'].map((Name, i) => ({
  Id: `field-${Name}`, Name, Label: Name === 'Sex' ? '性别' : Name,
  Component: ['Sex', 'State'].includes(Name) ? 'Radio' : 'Text', Visible: 1, AppVisible: 1, Sort: i,
  Data: Name === 'Sex' ? '[{"Key":"F","Value":"女"}]' : '[]',
  Config: '{"DataSource":"KeyValue","SelectSaveField":"Key","SelectLabel":"Value","Sql":"SECRET SQL","V8Code":"SECRET V8"}'
}))
const configuredMenu = { Id: 'correct-menu', Name: '系统账号', DiyTableId: table.Id, ModuleEngineKey: 'Sys_User', ViewConfigVersion: 1,
  MobileListFields: JSON.stringify(['Name', 'Account', 'Phone', 'Sex', 'DeptName', 'RoleIds', 'DeptId'].map(Name => ({ Id: `field-${Name}`, Name }))),
  CardTitleTagFields: '["field-UserType"]', CardBottomTagFields: '["field-Jobs"]' }

function matchesWhere(row, where) {
  // 解释数据库布尔条件，检查分组与 AND/OR 优先级，而非只检查有无某一字段。
  const expression = where.map((w, i) => {
    const actual = row[w.Name]
    const value = w.Value
    const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
    const matched = w.Type === 'In' ? value.some(v => String(v) === String(actual))
      : w.Type === 'Like' ? new RegExp(`^${pattern}$`).test(String(actual))
      : w.Type === '=' ? String(actual) === String(value) : false
    return `${i ? w.AndOr === 'OR' ? ' || ' : ' && ' : ''}${w.GroupStart ? '(' : ''}${matched}${w.GroupEnd ? ')' : ''}`
  }).join('')
  return Function(`return (${expression})`)()
}

async function run(params = {}, options = {}) {
  const calls = []
  const menus = options.menus || [{ Id: 'parent', _Child: [{ ...configuredMenu, Id: 'wrong-menu', ModuleEngineKey: '', MobileListFields: '["field-Phone"]' }, configuredMenu] }]
  const context = { TenantId: 'tenant-a', Level: options.admin ? 9999 : 1 }
  const V8 = {
    CurrentUser: options.loggedOut ? {} : { Id: 'current', RoleIds: '[]' }, Param: params, OsClient: 'xjy',
    Db: { FromSql() { return { AddInParameter() { return this }, First() { return context } } } },
    Method: { ManageSystemDirectory(request) { assert.deepEqual(request, { Domain: 'SysMenu', Action: 'GetSysMenuStep', Param: {} }); return { Code: 1, Data: menus } } },
    FormEngine: {
      GetDiyTableModel() { return Promise.resolve({ Code: 1, Data: table }) },
      GetDiyFieldList() { return Promise.resolve({ Code: 1, Data: options.fields || fields }) },
      GetTableData(query) {
        calls.push(query)
        if (query.FormEngineKey === 'Sys_Role') return { Code: 1, Data: [{ Id: 'role-a', Name: '销售' }] }
        const source = { Id: 'user-a', Name: '张三', Sex: 'F', DeptName: '业务部', DeptId: 'dept-a', RoleIds: '["role-a"]', Jobs: '["顾问"]' }
        const rows = options.users ? options.users.filter(row => matchesWhere(row, query._Where)) : [source]
        return { Code: 1, Data: rows.map(row => Object.fromEntries(query._SelectFields.map(name => [name, row[name] ?? null]))), DataCount: rows.length }
      }
    }
  }
  return { result: await engine(V8), calls }
}

function loadSource(url, deps, exports) {
  const source = readFileSync(url, 'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?\n/gm, '')
    .replace(/export default \{[\s\S]*$/, '').replace(/\bexport\s+/g, '')
  return Function(...Object.keys(deps), `${source}\nreturn {${exports.join(',')}}`)(...Object.values(deps))
}
const native = loadSource(new URL('../src/platform/native-form.js', import.meta.url), {
  getUser: () => ({ Id: 'current' }), nativeControls: JSON.parse(readFileSync(new URL('../src/config/mci-native-controls.json', import.meta.url))),
  ...visibility, ...treeOptions, formatStructuredValue: value => String(value ?? '-'), formatRegionValue: value => String(value ?? '')
}, ['createNativeFormDefinition', 'parseJson', 'fieldDisplayValue'])
const registry = loadSource(new URL('../src/platform/module-registry.js', import.meta.url), {
  getUser: () => ({ Id: 'current' }), V8: { ApiEngine: { Run: async (key, params) => (await run(params)).result } },
  ...native, ...cardPolicy, normalizeStringList, compileModuleFilterFields
}, ['loadApiModuleDefinition', 'createMenuModuleDefinition'])

test('后台卡片配置使用精确模块键，排除同名菜单和敏感元数据', async () => {
  const { result, calls } = await run({ Action: 'GetCardDefinition', ModuleEngineKey: 'Sys_User' })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.Menu.Id, 'correct-menu')
  assert.deepEqual(result.Data.Menu.MobileListFields.map(f => f.Name), ['Name', 'Account', 'Phone', 'Sex', 'DeptName', 'RoleIds', 'DeptId'])
  assert.doesNotMatch(JSON.stringify(result.Data), /SECRET|AiApiKey|"Pwd"/)
  assert.equal(calls.length, 0, '配置请求不读取人员业务数据')
})

test('真实卡片编译保留顺序、字段标签、标签列和底部列', async () => {
  const config = await registry.loadApiModuleDefinition({ table: 'Sys_User', metadataApiEngineKey: 'get-sysUser-list', configuredModuleEngineKey: 'Sys_User' })
  assert.equal(config.menuId, 'correct-menu')
  assert.equal(config.titleField, 'Name')
  assert.deepEqual(config.lines.map(f => f.field), ['Account', 'Phone', 'Sex', 'DeptName', 'RoleIds', 'DeptId'])
  assert.equal(config.lines[2].label, '性别')
  assert.deepEqual(config.tagFields, ['UserType'])
  assert.deepEqual(config.bottomFields.map(f => f.field), ['Jobs'])
  const payload = buildListApiEnginePayload({ ...config, configuredModuleEngineKey: 'Sys_User' }, { pageIndex: 2 })
  const { result, calls } = await run(payload)
  const query = calls.find(q => q.FormEngineKey === 'Sys_User')
  for (const name of ['Sex', 'DeptId', 'UserType', 'Jobs']) assert.ok(query._SelectFields.includes(name), name)
  assert.equal(query._PageIndex, 2)
  assert.equal(result.Data[0].Sex, 'F')
  assert.equal(native.fieldDisplayValue(config.definition.fields.find(f => f.Name === 'Sex'), 'F'), '女')
  assert.deepEqual(result.Data[0]._CardDisplay, { RoleIds: '销售', DeptId: '业务部' })
  assert.ok(query._Where.some(w => w.Name === 'TenantId' && w.Value === 'tenant-a'))
  const key = listApiEnginePresentationKey(config, payload)
  assert.notEqual(key, listApiEnginePresentationKey({ ...config, menu: { ...config.menu, ViewConfigVersion: 2 } }, payload))
  assert.notEqual(key, listApiEnginePresentationKey(config, { ...payload, _SelectFields: [...payload._SelectFields, 'No'] }))
})

test('越权菜单、重复模块和错误表绑定失败，不查询人员', async () => {
  for (const menus of [[], [{ ...configuredMenu, DiyTableId: 'other' }], [configuredMenu, { ...configuredMenu, Id: 'duplicate' }]]) {
    const { result, calls } = await run({ Action: 'GetCardDefinition' }, { menus })
    assert.equal(result.Code, 0)
    assert.equal(calls.length, 0)
  }
  assert.equal((await run({ _SysMenuId: 'wrong-menu', ModuleEngineKey: 'Sys_User' })).result.Code, 0)
  assert.equal((await run({ Action: 'Delete' })).result.Code, 0)
  assert.equal((await run({}, { loggedOut: true })).result.Code, 1001)
})

test('配置或客户端注入敏感字段、角色限制字段都不能扩大查询', async () => {
  const restricted = [...fields, { Id: 'field-Remark', Name: 'Remark', BindRole: '["private-role"]' }]
  const { result, calls } = await run({ _SysMenuId: 'correct-menu', _SelectFields: ['Pwd', 'AiApiKey', 'Remark', 'Sex'] }, { fields: restricted })
  assert.equal(result.Code, 1)
  const query = calls.find(q => q.FormEngineKey === 'Sys_User')
  assert.ok(query._SelectFields.includes('Sex'))
  assert.ok(!query._SelectFields.some(f => ['Pwd', 'AiApiKey', 'Remark'].includes(f)))
})

test('旧通讯录调用保持商家隔离、固定查询列和角色显示', async () => {
  const scoped = await run({ _SelectFields: ['Sex', 'Pwd'], Keyword: '张', _PageSize: 500 })
  const query = scoped.calls.find(q => q.FormEngineKey === 'Sys_User')
  assert.equal(query._PageSize, 100)
  assert.ok(!query._SelectFields.includes('Sex'))
  assert.ok(query._Where.some(w => w.Name === 'TenantId'))
  assert.equal(scoped.result.Data[0].RoleName, '销售')
  assert.ok(!(await run({}, { admin: true })).calls.find(q => q.FormEngineKey === 'Sys_User')._Where.some(w => w.Name === 'TenantId'))
})

test('禁用状态保留零值且进入真实人员查询，全部状态没有隐式启用限制', async () => {
  for (const status of [0, '0', 1, '1']) {
    const payload = buildListApiEnginePayload({ statusField: 'State', configuredModuleEngineKey: 'Sys_User' }, { status })
    assert.equal(payload._Where[0]?.Value, status)
    const { calls } = await run(payload)
    const states = calls.find(q => q.FormEngineKey === 'Sys_User')._Where.filter(w => w.Name === 'State')
    assert.deepEqual(states.map(w => Number(w.Value)), [Number(status)])
  }
  const all = await run({ ModuleEngineKey: 'Sys_User' })
  assert.ok(!all.calls.find(q => q.FormEngineKey === 'Sys_User')._Where.some(w => w.Name === 'State'))
  assert.equal((await run({ ModuleEngineKey: 'Sys_User', _Where: [{ Name: 'State', Type: '=', Value: 'invalid' }] })).result.Code, 0)
})

test('通讯录组织配置保留存储方式，两个组织查询可多选且兼职条件按 OR 分组', async () => {
  const orgFields = ['DeptId', 'DeptIds'].map((Name, i) => ({ Id: Name, Name, Label: Name, Component: 'Department', Visible: 1, AppVisible: 1,
    Config: JSON.stringify({ Department: { Multiple: !!i, EmitPath: !!i, Filterable: true, V8Code: 'SECRET' } }) }))
  const meta = await run({ Action: 'GetCardDefinition' }, { fields: [...fields.filter(f => f.Name !== 'DeptId'), ...orgFields] })
  const definition = native.createNativeFormDefinition(table, meta.result.Data.Fields)
  const configured = compileModuleFilterFields(['DeptId', 'DeptIds'], definition.fields)
  const merged = mergeModuleFilterFields(configured, ['DeptId', 'DeptIds'].map(field => ({ key: field, field, multiple: true, overrideSearchMultiple: true })), definition.fields)
  assert.deepEqual(merged.map(f => [f.multiple, f.storage]), [[true, 'scalar'], [true, 'paths']])
  const extraWhere = buildListFilterWhere(merged, { DeptId: ['dept-a', 'dept-b'], DeptIds: [['root', 'dept-a'], ['root', 'dept-b']] })
  const { calls } = await run({ ModuleEngineKey: 'Sys_User', _Where: extraWhere }, { fields: orgFields })
  const where = calls.find(q => q.FormEngineKey === 'Sys_User')._Where
  assert.deepEqual(where.find(w => w.Name === 'DeptId').Value, ['dept-a', 'dept-b'])
  const parts = where.filter(w => w.Name === 'DeptIds')
  assert.deepEqual(parts.map(w => w.Value), ['%"dept-a"%', '%"dept-b"%'])
  assert.equal(parts[0].GroupStart, true)
  assert.equal(parts[0].AndOr, 'AND')
  assert.equal(parts[1].AndOr, 'OR')
  assert.equal(parts[1].GroupEnd, true)
  assert.ok(where.some(w => w.Name === 'TenantId' && w.AndOr === 'AND'))
  assert.doesNotMatch(JSON.stringify(meta.result.Data.Fields), /SECRET/)
})

test('状态按钮复用后台选项文字，查询仍使用原始值', () => {
  const source = readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
  const match = source.match(/    statusOptionLabel\(value\) \{([\s\S]*?)\n    \},/)
  assert.ok(match, '状态按钮需要独立的选项文字映射')
  const label = Function('value', match[1])
  const context = { config: { statusField: 'State' }, field: () => ({ options: [{ value: '0', label: '禁用' }, { value: '1', label: '启用' }] }) }
  assert.equal(label.call(context, 0), '禁用')
  assert.equal(label.call(context, '1'), '启用')
  assert.equal(label.call(context, 'future'), 'future')
  assert.match(source, /\{\{ statusOptionLabel\(item\) \}\}/)
})

test('禁用状态与多个兼职组织组合查询排除启用、跨商家、已删除和相似 Id 人员', async () => {
  const make = (Id, State, department, extra = {}) => ({ Id, State, DeptId: department, DeptIds: JSON.stringify([['root', department]]), TenantId: 'tenant-a', IsDeleted: 0, ...extra })
  const users = [make('disabled-a', 0, 'dept-a'), make('disabled-b', 0, 'dept-b'), make('enabled', 1, 'dept-b'),
    make('other-tenant', 0, 'dept-b', { TenantId: 'tenant-b' }), make('deleted', 0, 'dept-a', { IsDeleted: 1 }), make('similar-id', 0, 'dept-ab')]
  const { result } = await run({ ModuleEngineKey: 'Sys_User', _Where: [
    { Name: 'State', Type: '=', Value: '0' },
    { Name: 'DeptIds', Type: 'Like', Value: '["root","dept-a"]', AndOr: 'AND', GroupStart: true },
    { Name: 'DeptIds', Type: 'Like', Value: '["root","dept-b"]', AndOr: 'OR', GroupEnd: true }
  ] }, { users })
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.map(row => row.Id), ['disabled-a', 'disabled-b'])
  assert.equal(result.DataCount, 2)
})

test('遗留字段 Id 回退 Name，并兼容空配置项与安全展示别名', async () => {
  const menu = { ...configuredMenu, MobileListFields: JSON.stringify([
    null, { Id: 'obsolete', Name: 'Name', Label: '联系人' },
    { FieldId: 'field-Phone', AsName: 'ContactPhone', Label: '联系电话' },
    { Name: 'Sex', AsName: 'Pwd' }
  ]) }
  const { result } = await run({ Action: 'GetCardDefinition' }, { menus: [menu] })
  assert.equal(result.Data.Menu.MobileListFields[0].Name, 'Name')
  assert.equal(result.Data.Menu.MobileListFields[0].Label, '联系人')
  assert.equal(result.Data.Menu.MobileListFields[1].AsName, 'ContactPhone')
  assert.equal(result.Data.Menu.MobileListFields[2].AsName, undefined)
  const list = await run({ _SysMenuId: menu.Id, _SelectFields: ['Phone', 'Sex', 'constructor'] }, { menus: [menu] })
  assert.equal(list.result.Data[0].ContactPhone, list.result.Data[0].Phone)
  assert.ok(!Object.hasOwn(list.result.Data[0], 'Pwd'))
  assert.ok(!list.calls.find(q => q.FormEngineKey === 'Sys_User')._SelectFields.includes('constructor'))
})

function listPageMethod(name, nextName, deps) {
  const source = readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
  const start = source.indexOf(`    async ${name}(`)
  const end = source.indexOf(`    ${nextName}(`, start)
  const method = source.slice(start, end).trim().replace(/^async /, 'async function ').replace(/,\s*$/, '')
  return Function(...Object.keys(deps), `return (${method})`)(...Object.values(deps))
}

test('卡片授权失效清空旧数据，先前在途响应不能重新填充列表', async () => {
  let completeRows
  const loadData = listPageMethod('loadData', 'search', {
    loadModuleRows: () => new Promise(resolve => { completeRows = resolve })
  })
  const loadViewConfig = listPageMethod('loadViewConfig', 'buildCurrentListOptions', {
    loadApiModuleDefinition: async () => { throw Error('当前账号无权查看通讯录') }, mergeModuleFilterFields
  })
  const context = {
    baseConfig: { metadataApiEngineKey: 'directory-cards' }, config: { pageSize: 15 }, menuId: 'correct-menu',
    metadataError: '', loading: false, finished: false, loadRequestId: 0, pageIndex: 1,
    rows: [{ Id: 'old-user' }], count: 1, dataAppend: { Scope: 'Tenant' }, periodCounts: { all: 1 },
    metricValues: { total: 1 }, buildCurrentListOptions: () => ({})
  }
  const pending = loadData.call(context, true)
  assert.equal(await loadViewConfig.call(context, true), false)
  completeRows({ rows: [{ Id: 'late-user' }], count: 1, append: {} })
  await pending
  assert.deepEqual(context.rows, [])
  assert.equal(context.count, 0)
  assert.equal(context.menuId, '')
  assert.equal(context.loading, false)
  assert.deepEqual(context.periodCounts, {})
  assert.deepEqual(context.dataAppend, {})
  assert.equal(context.metadataError, '当前账号无权查看通讯录')
})
