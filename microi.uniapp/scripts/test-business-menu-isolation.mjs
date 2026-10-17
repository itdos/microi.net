import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  requiresAuthorizedMenuContext,
  resolveBusinessMenuPermission,
  selectAuthorizedMenu
} from '../src/platform/menu-resolution.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
const source = readFileSync(new URL('../src/platform/business-runtime.js', import.meta.url), 'utf8')
const aliases = ['合同订单', '订单管理', '我的订单']
const mainMenu = {
  Id: 'orders-menu', Name: '合同订单', DiyTableId: 'orders-table',
  DiyTableName: '', ModuleEngineKey: 'orders-module', Display: 1, AppDisplay: 1
}
const relatedMenu = {
  Id: 'renewals-menu', Name: '合同订单相关续签订单', DiyTableId: 'renewals-table',
  DiyTableName: 'diy_dingdanxq_relation', ModuleEngineKey: 'renewals-module',
  Display: 0, AppDisplay: 0
}
const parentMenu = { Id: 'orders-folder', Name: '订单管理', DiyTableId: '', _Child: [] }
const poisonedMenu = { ...relatedMenu, DiyTableName: 'Diy_Dingdan' }
const fixedTree = [{ ...parentMenu, _Child: [relatedMenu, mainMenu] }]
const oldTree = [{ ...parentMenu, _Child: [poisonedMenu, mainMenu] }]
const plain = value => JSON.parse(JSON.stringify(value))
const stripModule = value => value
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
  .replace(/export default[\s\S]*$/, '')
  .replace(/export /g, '')

function runtime({ runtimeSource = source, selectMenu = selectAuthorizedMenu, tree = fixedTree, storage = {} } = {}) {
  const values = new Map(Object.entries(storage))
  const requests = []
  const navigation = []
  let responseTree = tree
  const sandbox = {
    appConfig: { apiBase: 'https://fixture.microi.invalid', osClient: 'xjy' }, tenantRuntime: {}, V8: {},
    getToken: () => 'session-token', getUser: () => ({ Id: 'user-1' }),
    selectAuthorizedMenu: selectMenu, requiresAuthorizedMenuContext, resolveBusinessMenuPermission,
    getBusinessEntry: () => ({}), getBusinessModule: () => ({}),
    uni: {
      getStorageSync: key => values.get(key),
      setStorageSync: (key, value) => values.set(key, value),
      navigateTo: options => navigation.push(options.url), showToast() {}
    },
    cachedRequest: async (_key, task) => ({ data: await task(), stale: false }),
    resolveListReadApi: () => '',
    post: async (url, body) => {
      requests.push({ url, body: plain(body) })
      if (url.startsWith('/apiengine/platform-sys-menu')) return { Code: 1, Data: plain(responseTree) }
      if (url === '/apiengine/platform-module-data') return { Code: 1, Data: [], DataCount: 0 }
      throw new Error(`意外请求：${url}`)
    }
  }
  vm.runInNewContext(stripModule(runtimeSource), sandbox)
  return { api: sandbox, values, requests, navigation, setTree: value => { responseTree = value } }
}

function poisonedStorage() {
  return {
    microi_diy_table_ids_v2: JSON.stringify({ diy_dingdan: relatedMenu.DiyTableId }),
    'microi_mobile_menu_tree_v2:user-1': JSON.stringify({ data: oldTree, time: Date.now() })
  }
}

test('旧实现确实会被相同的关系菜单和永久缓存污染', async () => {
  // 固定旧版源码在隔离 VM 中复现；不能仅用自造替代实现宣称验证了修复前行为。
  const previous = path => execFileSync('git', [
    '-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'show', `44096d7a1:microi.uniapp/${path}`
  ], { cwd: root, encoding: 'utf8' })
  const oldResolver = {}
  vm.runInNewContext(stripModule(previous('src/platform/menu-resolution.mjs')), oldResolver)
  const old = runtime({
    runtimeSource: previous('src/platform/business-runtime.js'),
    selectMenu: oldResolver.selectAuthorizedMenu, storage: poisonedStorage()
  })
  assert.equal((await old.api.findMenu(aliases, 'Diy_Dingdan')).Id, relatedMenu.Id)
  assert.equal(old.requests.length, 0, '旧实现直接命中本地错误缓存，没有取得修正菜单')
})

test('同表隐藏菜单排在前面时主列表仍按精确业务别名命中', () => {
  const hidden = { ...relatedMenu, DiyTableId: mainMenu.DiyTableId, DiyTableName: 'Diy_Dingdan' }
  assert.equal(selectAuthorizedMenu([hidden, mainMenu], {
    aliases, tableName: 'Diy_Dingdan', tableId: mainMenu.DiyTableId
  })?.Id, mainMenu.Id)
})

test('显式打开同表隐藏菜单时保留该菜单，不被主列表别名抢占', () => {
  const hidden = { ...relatedMenu, DiyTableId: mainMenu.DiyTableId, DiyTableName: 'Diy_Dingdan' }
  assert.equal(selectAuthorizedMenu([hidden, mainMenu], {
    aliases, menuId: hidden.Id, tableName: 'Diy_Dingdan', tableId: mainMenu.DiyTableId
  })?.Id, hidden.Id)
})

test('精确别名遵守配置顺序，不受菜单树先后顺序影响', () => {
  const alternate = { ...mainMenu, Id: 'mine-orders-menu', Name: '我的订单' }
  assert.equal(selectAuthorizedMenu([alternate, mainMenu], {
    aliases, tableName: 'Diy_Dingdan', tableId: mainMenu.DiyTableId
  })?.Id, mainMenu.Id)
})

test('表 Id 匹配但显式表名矛盾时拒绝借用关系菜单', () => {
  assert.equal(selectAuthorizedMenu([relatedMenu], {
    aliases: [relatedMenu.Name], menuId: relatedMenu.Id,
    tableName: 'Diy_Dingdan', tableId: relatedMenu.DiyTableId
  }), null)
})

test('表名匹配但显式表 Id 矛盾时不能从表名分支绕过绑定检查', () => {
  assert.equal(selectAuthorizedMenu([{ ...mainMenu, DiyTableName: 'Diy_Dingdan' }], {
    aliases, tableName: 'Diy_Dingdan', tableId: relatedMenu.DiyTableId
  }), null)
})

test('没有真实业务菜单时不能拿无表绑定的订单管理目录作为授权', () => {
  assert.equal(selectAuthorizedMenu([parentMenu], { aliases, tableName: 'Diy_Dingdan' }), null)
})

test('仅剩关系菜单时主列表不能依靠模糊的合同订单别名串表', () => {
  assert.equal(selectAuthorizedMenu([relatedMenu], { aliases, tableName: 'Diy_Dingdan' }), null)
})

test('升级后的实际运行时忽略旧 v2 菜单树及永久表 Id 缓存', async () => {
  const current = runtime({ storage: poisonedStorage() })
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan')).Id, mainMenu.Id)
  assert.equal(current.requests.length, 1)
  assert.equal(current.requests[0].url.startsWith('/apiengine/platform-sys-menu'), true)
  assert.equal(current.values.has('microi_mobile_menu_tree_v3:https://fixture.microi.invalid|xjy|user-1'), true)
})

test('同一次 findMenu 刷新只读取一次菜单快照，表 Id 不再第二次请求覆盖', async () => {
  const current = runtime()
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan', true)).Id, mainMenu.Id)
  assert.equal(current.requests.length, 1)
})

test('同一账号切换 API 或租户时不能复用上一端点的菜单快照', async () => {
  const current = runtime()
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan')).Id, mainMenu.Id)
  const otherMenu = { ...mainMenu, Id: 'other-tenant-orders-menu', DiyTableId: 'other-orders-table' }
  current.api.appConfig.osClient = 'other-tenant'
  current.setTree([otherMenu])
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan')).Id, otherMenu.Id)
  current.api.appConfig.apiBase = 'https://other-fixture.microi.invalid'
  current.setTree([{ ...otherMenu, Id: 'other-api-orders-menu' }])
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan')).Id, 'other-api-orders-menu')
  assert.equal(current.requests.length, 3)
})

test('refresh 取得新授权菜单并重算表 Id，不继续恢复旧映射', async () => {
  const current = runtime({ tree: oldTree })
  assert.equal(await current.api.resolveDiyTableId('Diy_Dingdan'), relatedMenu.DiyTableId)
  const refreshed = [{ ...parentMenu, _Child: [relatedMenu, { ...mainMenu, DiyTableName: 'Diy_Dingdan' }] }]
  current.setTree(refreshed)
  assert.equal((await current.api.findMenu(aliases, 'Diy_Dingdan', true)).Id, mainMenu.Id)
  assert.equal(await current.api.resolveDiyTableId('Diy_Dingdan'), mainMenu.DiyTableId)
  assert.equal(current.requests.length, 2)
})

test('主列表查询和合同详情相关订单查询使用各自模块及授权条件', async () => {
  const current = runtime({ storage: poisonedStorage() })
  const main = await current.api.findMenu(aliases, 'Diy_Dingdan')
  const relation = await current.api.findMenu([], 'diy_dingdanxq_relation', false, relatedMenu.Id)
  assert.equal(main.Id, mainMenu.Id)
  assert.equal(relation.Id, relatedMenu.Id)
  await current.api.loadModuleRows({
    target: 'native-list', table: 'Diy_Dingdan', menuId: main.Id,
    moduleEngineKey: main.ModuleEngineKey
  })
  const auth = { ParentSysMenuId: main.Id, ParentRowId: 'source-order', ParentFieldId: 'related-orders-field' }
  await current.api.loadModuleRows({
    table: 'diy_dingdanxq_relation', menuId: relation.Id, moduleEngineKey: relation.ModuleEngineKey
  }, {
    tableChildModuleQuery: true, tableChildAuth: auth,
    extraWhere: [{ Name: 'ParentDingdanID', Type: '=', Value: 'source-order' }]
  })
  const queries = current.requests.filter(item => item.url === '/apiengine/platform-module-data')
  assert.equal(queries[0].body._SysMenuId, main.Id)
  assert.equal(queries[0].body.ModuleEngineKey, main.ModuleEngineKey)
  assert.equal(queries[0].body._TableChildAuth, undefined)
  assert.equal(queries[1].body.ModuleEngineKey, relation.ModuleEngineKey)
  assert.equal(queries[1].body._SysMenuId, undefined)
  assert.deepEqual(queries[1].body._TableChildAuth, auth)
  assert.deepEqual(queries[1].body._Where, [{ Name: 'ParentDingdanID', Type: '=', Value: 'source-order' }])
})

test('打开续签合同时真实订单表单保持主菜单，关系记录保持关系菜单', async () => {
  const current = runtime({ storage: poisonedStorage() })
  await current.api.openForm({ table: 'Diy_Dingdan', rowId: 'renewal-order', menuAliases: aliases, mode: 'Edit' })
  await current.api.openForm({
    table: 'diy_dingdanxq_relation', rowId: 'relation-row', menuId: relatedMenu.Id, mode: 'View',
    tableChildAuth: { ParentSysMenuId: mainMenu.Id, ParentRowId: 'source-order' }
  })
  const main = new URLSearchParams(current.navigation[0].split('?')[1])
  const relation = new URLSearchParams(current.navigation[1].split('?')[1])
  assert.equal(main.get('table'), 'Diy_Dingdan')
  assert.equal(main.get('menuId'), mainMenu.Id)
  assert.equal(relation.get('table'), 'diy_dingdanxq_relation')
  assert.equal(relation.get('menuId'), relatedMenu.Id)
})
