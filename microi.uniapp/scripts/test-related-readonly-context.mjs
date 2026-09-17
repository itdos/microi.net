import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { appendSystemAuditFields, resolveConfiguredFields, resolveConfiguredFieldNames } from '../src/platform/card-field-policy.mjs'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const stripImports = source => source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
const plain = value => JSON.parse(JSON.stringify(value))
const rootAuth = { ParentSysMenuId: 'order-menu', ParentTableId: 'orders', ParentFieldId: 'goods-field', ParentRowId: 'order-1', ParentValue: 'order-1', ParentFormMode: 'View' }

test('子表元数据沿用父子授权链，不把未授权子菜单当成独立菜单入口', async () => {
  const calls = []
  const sandbox = { nativeControls: { layout: [], related: [], readonly: [], guarded: [] },
    V8: { FormEngine: { GetDiyTableModel: async (...args) => { calls.push(args); return { Code: 1, Data: { Id: 'positions' } } } } } }
  vm.runInNewContext(stripImports(read('../src/platform/native-form.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  await sandbox.loadNativeTableModel('positions', { menuId: 'diy_positions', moduleEngineKey: 'diy_positions', tableChildAuth: rootAuth })
  assert.deepEqual(plain(calls[0][1]), { _TableChildAuth: rootAuth })
})

function related(sandbox = {}) {
  const script = read('../src/components/mci-business-related-list/mci-business-related-list.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
  const context = { getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {}, ...sandbox }
  vm.runInNewContext(stripImports(script).replace('export default', 'globalThis.component ='), context)
  return context.component
}

test('项目合伙人没有商品独立菜单时，孙表仍携带完整父子授权链', () => {
  const component = related()
  const auth = component.computed.tableChildAuth.call({ field: { Id: 'positions-field' }, parentTableId: 'goods', parentMenuId: '', parentId: 'goods-1', relationValue: 'goods-1', parentMode: 'View', parentTableChildAuth: rootAuth })
  assert.equal(auth?.ParentFieldId, 'positions-field')
  assert.deepEqual(plain(auth.Parent), rootAuth)
  assert.equal(component.computed.tableChildAuth.call({ field: { Id: 'f' }, parentTableId: 't', parentMenuId: '', parentId: 'r', relationValue: 'r' }), null, '没有任何授权入口时不能自行构造链')
})

test('子表菜单展示配置由服务端授权读取，并拒绝其它表的菜单', async () => {
  let response = { Code: 1, Data: { Id: 'goods-menu', DiyTableId: 'goods', MobileListFields: ['Name', 'Model', 'Quantity'], CardBottomTagFields: ['Cooperation'] } }
  const calls = []
  const component = related({ post: async (...args) => { calls.push(args); return response } })
  const context = { childMenuId: 'goods-menu', tableChildAuth: rootAuth, table: { Id: 'goods' } }
  const menu = await component.methods.loadChildPresentationMenu.call(context)
  assert.equal(menu.Id, 'goods-menu')
  assert.deepEqual(plain(calls[0][1]._TableChildAuth), rootAuth)
  response = { Code: 1, Data: { Id: 'other-menu', DiyTableId: 'other-table' } }
  assert.equal(await component.methods.loadChildPresentationMenu.call(context), null)
  response = { Code: 0, Msg: '没有权限' }
  assert.equal(await component.methods.loadChildPresentationMenu.call(context), null)
})

test('打开已授权子表详情时保留子菜单上下文，即使导航树未列出该菜单', async () => {
  let navigation
  const sandbox = { appConfig: {}, tenantRuntime: {}, getToken: () => 'token', getUser: () => ({}),
    uni: { navigateTo: value => { navigation = value.url }, getStorageSync() {}, setStorageSync() {} },
    post: async () => ({ Code: 1, Data: [] }), selectAuthorizedMenu: () => null }
  vm.runInNewContext(stripImports(read('../src/platform/business-runtime.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  await sandbox.openForm({ table: 'Goods', rowId: 'goods-1', menuId: 'goods-menu', tableChildAuth: rootAuth })
  const params = new URLSearchParams(navigation.split('?')[1])
  assert.equal(params.get('menuId'), 'goods-menu')
  assert.deepEqual(JSON.parse(params.get('tableChildAuth')), rootAuth)
})

test('项目合伙人与销售编译相同商品正文和底部字段，权限只影响动作', async () => {
  const registry = { appendSystemAuditFields, resolveConfiguredFields, resolveConfiguredFieldNames,
    parseJson: (value, fallback) => { if (typeof value !== 'string') return value ?? fallback; try { return JSON.parse(value) } catch { return fallback } },
    normalizeStringList: value => Array.isArray(value) ? value : [], compileModuleFilterFields: () => [] }
  vm.runInNewContext(stripImports(read('../src/platform/module-registry.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), registry)
  const table = { Id: 'goods', Name: 'Goods' }
  const fields = [
    ['Name', '商品名称'], ['Model', '设备型号'], ['Quantity', '设备数量'], ['Cooperation', '合作方式']
  ].map(([Name, Label]) => ({ Id: `${Name}-field`, Name, Label, component: 'Text', visible: true }))
  const menu = { Id: 'goods-menu', Name: '订单商品', DiyTableId: table.Id,
    MobileListFields: ['Name', 'Model', 'Quantity'], CardTitleTagFields: [], CardBottomTagFields: ['Cooperation'] }
  const layouts = []
  for (const role of ['项目合伙人', '销售']) {
    const component = related({
      loadNativeTableModel: async () => table, loadNativeFormDefinition: async () => ({ fields }),
      findMenu: async () => role === '销售' ? menu : null,
      post: async () => ({ Code: 1, Data: menu }), createMenuModuleDefinition: registry.createMenuModuleDefinition
    })
    const context = { ...component.data(), ...component.methods, childTableId: 'goods', childMenuId: 'goods-menu',
      tableChildAuth: rootAuth, currentUser: { RoleName: role },
      resolveBusinessModule: () => ({ key: 'goods', config: { tagFields: ['Cooperation', 'Model'] } }),
      emitTitleChange() {}, applyMenuSearchFields() {}, loadPresentationConfig: async () => {},
      loadData: async () => {}, loadRelatedMetrics: async () => {}, scheduleListBodyMeasure() {} }
    await context.initialize()
    assert.equal(context.error, '')
    layouts.push(plain({ title: context.config.titleField, tags: context.config.tagFields,
      lines: context.config.lines.map(line => line.field), bottom: context.config.bottomFields.map(item => item.field || item) }))
  }
  assert.deepEqual(layouts[0], layouts[1])
  assert.deepEqual(layouts[0], { title: 'Name', tags: [], lines: ['Model', 'Quantity'], bottom: ['Cooperation'] })
})

test('独立菜单元数据继续使用真实菜单，授权链缓存按完整关系隔离', async () => {
  const calls = []
  const sandbox = { nativeControls: { layout: [], related: [], readonly: [], guarded: [] },
    V8: { FormEngine: { GetDiyTableModel: async (...args) => { calls.push(args); return { Code: 1, Data: { Id: 'goods' } } } } } }
  vm.runInNewContext(stripImports(read('../src/platform/native-form.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  await sandbox.loadNativeTableModel('goods', { menuId: 'goods-menu' })
  assert.deepEqual(plain(calls[0][1]), { _SysMenuId: 'goods-menu' })
  assert.notEqual(sandbox.definitionAuthorizationScope({ menuId: 'goods-menu', tableChildAuth: rootAuth }),
    sandbox.definitionAuthorizationScope({ menuId: 'goods-menu', tableChildAuth: { ...rootAuth, ParentRowId: 'order-2' } }))
})

test('首屏子表查询包含实际卡片正文和底部字段，兼容菜单缺失和字段别名', () => {
  const component = related()
  const fields = component.methods.relatedSelectFields.call({
    config: { titleField: 'Name', lines: [{ field: 'Model' }, { field: 'Quantity' }], tagFields: [],
      bottomFields: [{ field: 'CooperationText', queryField: 'Cooperation' }] },
    childFkField: 'OrderId', isCollectionCardLayout: false
  })
  for (const field of ['Name', 'Model', 'Quantity', 'Cooperation', 'OrderId', 'Id']) assert.ok(fields.includes(field))
  assert.equal(fields.includes('CooperationText'), false)
})
