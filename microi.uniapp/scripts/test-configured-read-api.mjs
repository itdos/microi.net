import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import * as readApi from '../src/platform/configured-read-api.mjs'
import * as minuteApi from '../src/pages/business/components/minute-range.mjs'
import { buildListApiEnginePayload, listApiEnginePresentationKey, normalizeListApiEngineResponse } from '../src/platform/list-api-engine.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const stripImports = source => source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
const api = '/apiengine/communication-list'
const auth = { ParentRowId: 'device-1', ParentValue: 'device-1', ParentFieldId: 'logs' }
const row = { Id: '202610:6acca7930772990d65d26a0c', RecordTime: '2026-10-12 17:25:39' }
const response = { Code: 1, Data: [row], DataCount: 51, DataAppend: { Storage: 'MongoDB' } }

function related(overrides = {}) {
  const source = readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  const sandbox = { getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    ...readApi, ...overrides }
  vm.runInNewContext(stripImports(source).replace('export default', 'globalThis.component ='), sandbox)
  return sandbox.component
}

function minuteControls() {
  const source = readFileSync(new URL('../src/pages/business/components/log-minute-range.vue', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  const sandbox = { ...readApi, ...minuteApi, themeMixin: {} }
  vm.runInNewContext(stripImports(source).replace('export default', 'globalThis.component ='), sandbox)
  return sandbox.component
}

test('子表预览优先使用配置的查询接口并保留父子范围', async () => {
  const calls = []
  const component = related({
    V8: { FormEngine: { GetTableData: async () => { calls.push('physical-table'); return { Code: 1, Data: [], DataCount: 0 } } } },
    loadModuleRows: async (config, options) => { calls.push({ config, options }); return { rows: [row], count: 51 } }
  })
  const context = { ...component.data(), ...component.methods, componentDisposed: false,
    relationValue: 'device-1', childFkField: 'DeviceId', tableChildAuth: auth,
    config: { table: 'communication', menu: { SelectApi: api }, tableModel: {} },
    isPreview: true, previewLimit: 2, proposalDraftGroup: null,
    requiresModuleAssociationQuery: () => false, buildFilterWhere: () => [], buildKeywordFilterWhere: () => [],
    relatedSelectFields: () => ['Id', 'RecordTime'], hydrateProposalInstallationPointRows: async rows => rows,
    hydrateCollectionRows: async rows => rows }
  await context.loadData(true)
  assert.equal(context.error, '')
  assert.equal(context.count, 51)
  assert.equal(context.rows[0].Id, row.Id)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.pageSize, 2)
  assert.deepEqual(plain(calls[0].options.tableChildAuth), auth)
  assert.deepEqual(plain(calls[0].options.extraWhere), [{ Name: 'DeviceId', Type: '=', Value: 'device-1' }])
})

test('列表配置优先级及普通表兼容', () => {
  assert.equal(readApi.resolveListReadApi({ menu: { SelectApi: api }, definition: { table: { ApiReplace: { Select: '/apiengine/detail' } } } }), api)
  assert.equal(readApi.resolveListReadApi({ definition: { table: { ApiReplace: JSON.stringify({ Select: api }) } } }), api)
  assert.equal(readApi.resolveListReadApi({}), '')
  assert.equal(readApi.resolveDetailReadApi({ ApiReplace: '{}' }), '')
  assert.throws(() => readApi.resolveDetailReadApi({ ApiReplace: '{broken' }), /配置无效/)
})

test('详情携带完整月份Id、设备条件和授权，普通表仍用FormEngine', async () => {
  const calls = []
  const sdk = { post: async (...args) => { calls.push(args); return { Code: 1, Data: row } },
    FormEngine: { GetFormData: async (...args) => { calls.push(args); return { Code: 2 } } } }
  const context = { tableName: 'communication', tableModel: { ApiReplace: { Select: api } }, rowId: row.Id,
    menuId: 'logs-menu', tableChildAuth: auth, readWhere: [{ Name: 'DeviceId', Type: '=', Value: 'device-1' }] }
  await readApi.readFormRecord(sdk, context)
  assert.equal(calls[0][0], api)
  assert.equal(calls[0][1].Id, row.Id)
  assert.deepEqual(calls[0][1]._TableChildAuth, auth)
  assert.deepEqual(calls[0][1]._Where, context.readWhere)
  assert.equal(calls[0][1].FormEngineKey, 'communication')
  await readApi.readFormRecord(sdk, { ...context, tableModel: {} })
  assert.equal(calls[1][0], 'communication')
})

test('接口失败、无权限及不存在保留原结果，不伪装为空记录', async () => {
  for (const result of [{ Code: 0, Msg: '无权查看此设备通讯日志' }, { Code: 2, Msg: '通讯日志不存在' }]) {
    assert.strictEqual(await readApi.requestReadApi({ post: async () => result }, api, {}), result)
  }
  await assert.rejects(readApi.requestReadApi({ post: async () => { throw new Error('网络失败') } }, api, {}), /网络失败/)
})

test('接口地址同源校验和小程序无URL对象兼容', () => {
  assert.equal(readApi.normalizeReadApi('communication-list'), api)
  assert.equal(readApi.normalizeReadApi('https://api.example.com/apiengine/list', 'https://api.example.com'), '/apiengine/list')
  assert.equal(readApi.normalizeReadApi('$ApiBase$/apiengine/list?OsClient=$OsClient$', 'https://api.example.com', 'tenant'), '/apiengine/list?OsClient=tenant')
  for (const value of ['//evil.example/list', 'https://evil.example/list', '/api/../list', '/api\\list']) {
    assert.throws(() => readApi.normalizeReadApi(value, 'https://api.example.com'))
  }
})

test('月份默认、历史月份及格式验证', () => {
  assert.equal(readApi.queryMonthValue('', new Date(2026, 9, 13)), '202610')
  assert.equal(readApi.queryMonthValue('2026-09'), '202609')
  assert.throws(() => readApi.queryMonthValue('2026-13'), /有效/)
})

test('分钟范围包含结束分钟全部秒数，支持同分钟、单侧条件及月底进位', () => {
  const same = minuteApi.minuteRangeWhere('RecordTime', '2026-10', { startDate: '2026-10-13', startTime: '14:39', endDate: '2026-10-13', endTime: '14:39' })
  assert.deepEqual(same, [{ Name: 'RecordTime', Type: '>=', Value: '2026-10-13 14:39:00' }, { Name: 'RecordTime', Type: '<', Value: '2026-10-13 14:40:00' }])
  assert.deepEqual(minuteApi.minuteRangeWhere('RecordTime', '2026-10', {}), [])
  assert.equal(minuteApi.minuteRangeWhere('RecordTime', '2026-12', { endDate: '2026-12-31', endTime: '23:59' })[0].Value, '2027-01-01 00:00:00')
  assert.deepEqual(minuteApi.queryMonthDateBounds('2028-02'), { first: '2028-02-01', last: '2028-02-29' })
})

test('跨月、倒序、非法日期、秒级或未完整选择的时间范围不发请求', () => {
  for (const draft of [
    { startDate: '2026-09-30', startTime: '14:30' },
    { startDate: '2026-10-13', startTime: '14:40', endDate: '2026-10-13', endTime: '14:30' },
    { startDate: '2026-10-00', startTime: '14:30' },
    { startDate: '2026-10-13', startTime: '25:00' },
    { startDate: '2026-10-13', startTime: '14:30:00' },
    { startDate: '2026-10-13' }
  ]) assert.throws(() => minuteApi.minuteRangeWhere('RecordTime', '2026-10', draft))
  assert.throws(() => minuteApi.minuteRangeWhere('RecordTime', '2026-02', { startDate: '2026-02-29', startTime: '14:30' }), /日期/)
})

test('时间草稿在点击查询后生效，重置保持月份，切换月份清空范围', async () => {
  const component = minuteControls()
  const listComponent = related({ buildListFilterWhere: () => [] })
  let queries = 0
  const list = { ...listComponent.data(), ...listComponent.methods, config: { monthField: 'LogMonth', timeRangeField: 'RecordTime' },
    queryMonth: '2026-10', selectedQueryMonth: '2026-10', rows: [row], count: 51, currentUser: {}, filterFields: [],
    refreshFilteredRows: async () => 'refreshed' }
  const context = { ...component.data(), ...component.methods, field: 'RecordTime', month: '2026-10',
    $emit: (event, where) => { assert.equal(event, 'query'); queries++; list.setQueryTimeRange(where) } }
  context.changeQueryTime('start', 'Date', { detail: { value: '2026-10-13' } })
  context.changeQueryTime('start', 'Time', { detail: { value: '14:39' } })
  context.changeQueryTime('end', 'Date', { detail: { value: '2026-10-13' } })
  context.changeQueryTime('end', 'Time', { detail: { value: '14:39' } })
  assert.equal(queries, 0)
  await context.applyQueryTime()
  assert.equal(queries, 1)
  assert.equal(list.count, 0)
  assert.equal(list.rows.length, 0)
  assert.equal(list.buildFilterWhere().length, 3)
  assert.equal(list.buildFilterWhere()[2].Value, '2026-10-13 14:40:00')
  await context.resetQueryTime()
  assert.equal(list.queryMonth, '2026-10')
  assert.equal(list.buildFilterWhere().length, 1)
  context.queryTimeDraft = { startDate: '2026-11-01', startTime: '14:39' }
  await context.applyQueryTime()
  assert.equal(queries, 2)
  assert.match(context.queryTimeError, /所选月份/)
  await list.changeQueryMonth({ detail: { value: '2026-09' } })
  component.watch.month.call(context)
  assert.deepEqual(plain(context.queryTimeDraft), {})
  assert.deepEqual(plain(list.queryTimeWhere), [])
})

test('切换分钟范围后，旧请求不能覆盖新列表、总数或错误', async () => {
  let resolveOld
  const oldResponse = new Promise(resolve => { resolveOld = resolve })
  const component = related({ loadModuleRows: () => oldResponse })
  const context = { ...component.data(), ...component.methods, componentDisposed: false, relationValue: 'device-1', childFkField: 'DeviceId', tableChildAuth: auth,
    config: { table: 'communication', menu: { SelectApi: api }, monthField: 'LogMonth', timeRangeField: 'RecordTime', readOnly: true },
    isPreview: false, proposalDraftGroup: null, rows: [], currentUser: {}, filterFields: [],
    buildFilterWhere: () => [], buildKeywordFilterWhere: () => [], relatedSelectFields: () => [],
    hydrateProposalInstallationPointRows: async rows => rows, hydrateCollectionRows: async rows => rows }
  const task = context.loadData(true)
  context.queryTimeWhere = [{ Name: 'RecordTime', Type: '>=', Value: '2026-10-13 14:30:00' }]
  context.rows = [{ Id: 'new-query' }]
  context.count = 1
  resolveOld({ rows: [row], count: 51 })
  await task
  assert.equal(context.rows[0].Id, 'new-query')
  assert.equal(context.count, 1)
  assert.equal(context.error, '')
})

test('模块列表执行配置地址，分页及缓存保留完整设备授权范围', async () => {
  const calls = []
  const source = readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
  const sandbox = { ...readApi, buildListApiEnginePayload, listApiEnginePresentationKey, normalizeListApiEngineResponse,
    appConfig: {}, tenantRuntime: {}, getUser: () => ({ Id: 'user-1' }),
    cachedRequest: async (key, task) => { calls.push({ key }); return { data: await task(), stale: false } },
    V8: { post: async (url, payload) => { calls.push({ url, payload }); return response } } }
  vm.runInNewContext(stripImports(source).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  const result = await sandbox.loadModuleRows({ table: 'communication', menuId: 'logs-menu', menu: { SelectApi: api } }, {
    pageIndex: 2, pageSize: 15, tableChildAuth: auth, tableChildModuleQuery: true,
    extraWhere: [{ Name: 'DeviceId', Type: '=', Value: 'device-1' }, { Name: 'LogMonth', Type: '=', Value: '202609' }] })
  assert.equal(result.count, 51)
  assert.equal(calls[1].url, api)
  assert.equal(calls[1].payload._PageIndex, 2)
  assert.equal(calls[1].payload._PageSize, 15)
  assert.equal(calls[1].payload._SysMenuId, undefined)
  assert.deepEqual(plain(calls[1].payload._TableChildAuth), auth)
  assert.equal(calls[1].payload._Where[1].Value, '202609')
  assert.ok(calls[0].key.includes('device-1'))
})

test('表单适配器复用已授权定义，以替换接口读取日志详情', async () => {
  const calls = []
  const source = readFileSync(new URL('../src/platform/form-record-adapter.js', import.meta.url), 'utf8')
  const sandbox = { ...readApi, V8: { post: async (url, payload) => { calls.push({ url, payload }); return { Code: 1, Data: row } } } }
  vm.runInNewContext(stripImports(source).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  const result = await sandbox.loadNativeFormRecord({ tableName: 'communication', rowId: row.Id, tableChildAuth: auth,
    readWhere: [{ Name: 'DeviceId', Type: '=', Value: 'device-1' }],
    definitionPromise: Promise.resolve({ table: { ApiReplace: JSON.stringify({ Select: api }) } }) })
  assert.equal(result.Data.Id, row.Id)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, api)
  assert.equal(calls[0].payload._Where[0].Value, 'device-1')
})

test('只读日志隐藏新增和行操作，普通业务表保留编辑能力', () => {
  const component = related({ canAddMenuRecord: () => true })
  assert.equal(component.computed.canAdd.call({ readonlyList: true, relationValue: 'device-1', childFkField: 'DeviceId', config: { table: 'communication' } }), false)
  assert.deepEqual(plain(component.methods.rowActions.call({ readonlyList: true }, row)), [])
  assert.equal(readApi.isReadOnlyTable('Communication', { logs: { table: 'communication', readOnly: true } }), true)
  assert.equal(readApi.isReadOnlyTable('orders', { logs: { table: 'communication', readOnly: true } }), false)
})

test('月份条件与父设备条件共同发送，切换月份立即刷新', async () => {
  const component = related({ buildListFilterWhere: () => [] })
  const context = { ...component.methods, config: { monthField: 'LogMonth' }, queryMonth: '2026-09', rows: [row],
    refreshFilteredRows: async () => 'refreshed' }
  assert.deepEqual(plain(context.buildFilterWhere()), [{ Name: 'LogMonth', Type: '=', Value: '202609' }])
  assert.equal(await context.changeQueryMonth({ detail: { value: '2026-10' } }), 'refreshed')
  assert.equal(context.queryMonth, '2026-10')
  assert.equal(context.rows.length, 0)
})

test('原生详情的路由参数不会覆盖页面壳已解码的中文标题', () => {
  const source = readFileSync(new URL('../src/pages/native-form/index.vue', import.meta.url), 'utf8')
  assert.match(source, /inheritAttrs:\s*false/)
  assert.match(source, /this\.title = decodeOption\(options\.title\)/)
})

test('通讯报文等长文本JSON保留全部键值，包含HTML时仍按文本展示', () => {
  const source = readFileSync(new URL('../src/platform/native-form.js', import.meta.url), 'utf8')
  const scope = { nativeControls: { layout: [], related: [], readonly: [], guarded: [] } }
  vm.runInNewContext(stripImports(source).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), scope)
  const payload = { IsOnline: 1, Status: '已接收', Command: '0011', PayloadHex: '1D01', Content: '<b>原始报文</b>' }
  for (const component of ['Textarea', 'CodeEditor', 'JsonTable']) {
    const text = scope.fieldDisplayValue({ component, options: [] }, JSON.stringify(payload))
    assert.deepEqual(JSON.parse(text), payload)
  }
  const control = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8').match(/isRichDisplay\(\)\s*\{([^}]+)\}/)[1]
  const display = new Function('isHtmlValue', control)
  assert.equal(display.call({ modelValue: JSON.stringify(payload), component: 'Textarea' }, () => true), false)
})
