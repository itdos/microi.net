import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { buildListApiEnginePayload } from '../src/platform/list-api-engine.mjs'
import { tableChildQueryMode, tableChildRequiresModuleQuery } from '../src/platform/table-child-query-target.mjs'

test('TableChild 只在存在模块关联配置时切换到模块查询', () => {
  const tableId = 'service-goods-table'
  assert.equal(tableChildQueryMode({}, tableId), 'physical-table')
  assert.equal(tableChildRequiresModuleQuery({ JoinTables: '[{"TableId":"service-order-table"}]' }, tableId), true)
  assert.equal(tableChildRequiresModuleQuery({ SqlJoin: 'LEFT JOIN Diy_ShouhouDD B ON A.ShouhouDDID = B.Id' }, tableId), true)
  assert.equal(tableChildRequiresModuleQuery({
    SelectFields: [{ TableId: tableId, Name: 'ShebeiMC' }, { TableId: 'service-order-table', Name: 'Leixing' }]
  }, tableId), true)
  assert.equal(tableChildRequiresModuleQuery({ SelectFields: [{ TableId: tableId, Name: 'ShebeiMC' }] }, tableId), false)
  assert.equal(tableChildRequiresModuleQuery({ JoinTables: '{invalid-json' }, tableId), false)
})

test('TableChild 模块查询保留授权和外键条件但不附加子菜单上下文', () => {
  const auth = { ParentRowId: 'device-1', Parent: { ParentRowId: 'customer-1' } }
  const payload = buildListApiEnginePayload({
    menuId: 'service-goods-menu',
    configuredModuleEngineKey: 'service-goods-module',
    selectFields: ['Id', 'Leixing', 'FuwuZT']
  }, {
    pageIndex: 1,
    pageSize: 15,
    extraWhere: [{ Name: 'ShebeiBH', Type: '=', Value: 'device-1' }],
    tableChildAuth: auth,
    tableChildModuleQuery: true
  })

  assert.equal(payload.ModuleEngineKey, 'service-goods-module')
  assert.equal(payload._SysMenuId, undefined)
  assert.strictEqual(payload._TableChildAuth, auth)
  assert.deepEqual(payload._Where, [{ Name: 'ShebeiBH', Type: '=', Value: 'device-1' }])
  assert.deepEqual(payload._SelectFields, ['Id', 'Leixing', 'FuwuZT'])
})

test('普通模块查询继续携带真实菜单上下文', () => {
  const payload = buildListApiEnginePayload({ menuId: 'normal-menu' }, {})
  assert.equal(payload._SysMenuId, 'normal-menu')
  assert.equal(payload._TableChildAuth, undefined)
})

test('platform-module-data 的 TableChild 请求只使用授权链，不叠加子菜单数据范围', async () => {
  const source = readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace(/export default[\s\S]*$/, '')
    .replace(/export /g, '')
  const requests = []
  const sandbox = {
    getUser: () => ({ Id: 'user-1' }),
    requiresAuthorizedMenuContext: () => false,
    cachedRequest: async (key, task) => ({ data: await task(), stale: false }),
    post: async (url, body) => {
      requests.push({ url, body })
      return { Code: 1, Data: [], DataCount: 0 }
    },
    buildListApiEnginePayload() {}, listApiEnginePresentationKey() {}, normalizeListApiEngineResponse() {},
    appConfig: {}, tenantRuntime: {}, V8: {}, getToken() {}, getBusinessEntry() {}, getBusinessModule() {},
    getRoleProfile() {}, formatRegionValue() {}, formatStructuredValue() {}, selectAuthorizedMenu() {}
  }
  vm.runInNewContext(source, sandbox)
  const auth = { ParentRowId: 'device-1', Parent: { ParentRowId: 'customer-1' } }
  await sandbox.loadModuleRows({
    menuId: 'service-goods-menu', moduleEngineKey: 'service-goods-module', table: 'diy_shouhousp',
    selectFields: ['Id', 'Leixing', 'FuwuZT']
  }, {
    extraWhere: [{ Name: 'ShebeiBH', Type: '=', Value: 'device-1' }],
    tableChildAuth: auth,
    tableChildModuleQuery: true,
    refresh: true
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/apiengine/platform-module-data')
  assert.equal(requests[0].body.ModuleEngineKey, 'service-goods-module')
  assert.equal(requests[0].body._SysMenuId, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body._TableChildAuth)), auth)
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body._Where)), [{ Name: 'ShebeiBH', Type: '=', Value: 'device-1' }])
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body._SelectFields)), ['Id', 'Leixing', 'FuwuZT'])
})
