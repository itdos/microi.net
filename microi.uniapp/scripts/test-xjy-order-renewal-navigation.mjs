import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { serializeNativeTreeValue } from '../src/platform/native-tree-options.mjs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const withoutImports = source => source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
const sourceDefaults = { XQDingdanID: 'source-order', XQDingdanBH: 'O-001', XinLDD: '老客户续签订单',
  KehuID: 'customer-1', HetongKSSJ: '2027-04-02', HetongJSSJ: '2028-04-01' }

function tenantFixture(overrides = {}) {
  const calls = []
  const sandbox = {
    V8: {}, getUser: () => ({}), parseJson: (value, fallback) => typeof value === 'object' ? value : fallback,
    findMenu: async () => ({ Id: 'real-orders-menu' }),
    callApiEngine: async (key, args) => { calls.push({ key, args: plain(args) }); return { Code: 1, Data: { Defaults: sourceDefaults } } },
    ...overrides
  }
  const source = withoutImports(read('../src/tenants/xjy/native-table.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, '')
  vm.runInNewContext(source, sandbox)
  return { ...sandbox, calls }
}

const relation = { tableName: 'diy_dingdanxq_relation', parentTableName: 'Diy_Dingdan',
  parentId: 'source-order', parentMode: 'View', parentForm: { Id: 'source-order' },
  menuId: 'hidden-relation-menu', field: { Name: 'RelatedOrders' } }

test('续签新增通过服务端预览打开真实合同完整表单，不继承只读关系表权限链', async () => {
  const fixture = tenantFixture()
  const result = await fixture.resolveRelatedFormNavigation({ ...relation, action: 'Add' })
  assert.equal(result.table, 'Diy_Dingdan')
  assert.equal(result.menuId, 'real-orders-menu')
  assert.equal(result.mode, 'Add')
  assert.equal(result.includeRelated, true)
  assert.equal(result.tableChildAuth, null)
  assert.equal(result.readWhere, null)
  assert.deepEqual(plain(result.defaultValues), sourceDefaults)
  assert.equal(result.readonlyFieldNames, undefined, '不能把日期等原订单字段强制变成只读')
  assert.equal(result.fieldNames, undefined, '必须呈现完整合同字段和商品子表')
  assert.deepEqual(fixture.calls, [{ key: 'xjy-order-renewal', args: { Action: 'Preview', SourceOrderId: 'source-order' } }])
})

test('详情和编辑使用真实续签订单 Id，不能误用关系快照 Id', async () => {
  const fixture = tenantFixture()
  for (const action of ['View', 'Edit']) {
    const result = await fixture.resolveRelatedFormNavigation({ ...relation, action, row: { Id: 'relation-snapshot', XQDingdanID: 'renewal-order' } })
    assert.equal(result.rowId, 'renewal-order')
    assert.equal(result.mode, action)
    assert.equal(result.table, 'Diy_Dingdan')
    assert.equal(result.menuId, 'real-orders-menu')
  }
  assert.equal(fixture.calls.length, 0)
})

test('能力解析不发起预览，普通子表仍走原生行为', async () => {
  const fixture = tenantFixture()
  const target = await fixture.resolveRelatedFormNavigation({ ...relation, action: 'Add', resolveOnly: true })
  assert.equal(target.menuId, 'real-orders-menu')
  assert.equal(fixture.calls.length, 0)
  assert.equal(await fixture.resolveRelatedFormNavigation({ ...relation, tableName: 'Diy_DingdanSP' }), null)
})

test('未保存来源、缺失真实订单、无订单权限和预览错误均阻止导航', async () => {
  const fixture = tenantFixture()
  await assert.rejects(fixture.resolveRelatedFormNavigation({ ...relation, action: 'Add', parentMode: 'Add' }), /请先保存原订单/)
  await assert.rejects(fixture.resolveRelatedFormNavigation({ ...relation, action: 'View', row: { Id: 'mirror' } }), /关联已失效/)
  await assert.rejects(tenantFixture({ findMenu: async () => null }).resolveRelatedFormNavigation({ ...relation, action: 'Add' }), /没有合同订单权限/)
  await assert.rejects(tenantFixture({ callApiEngine: async () => ({ Code: 0, Msg: '原订单尚未审批' }) }).resolveRelatedFormNavigation({ ...relation, action: 'Add' }), /尚未审批/)
})

test('订单、商品、安装位置和耗材草稿只经续签业务网关获取分页数据', async () => {
  const fixture = tenantFixture({ callApiEngine: async (key, args) => {
    fixture.calls.push({ key, args: plain(args) })
    return { Code: 1, Data: [{ Id: 'child-1' }], DataCount: 21 }
  } })
  for (const [tableName, parentTableName, parentId] of [
    ['Diy_DingdanSP', 'Diy_Dingdan', 'draft-order'],
    ['diy_shebeiwz', 'Diy_DingdanSP', 'draft-product'],
    ['diy_dingdansphc', 'Diy_DingdanSP', 'draft-product']
  ]) {
    const result = await fixture.loadRelatedRows({ tableName, parentTableName, parentId,
      parentForm: { DingdanID: 'draft-order' }, pageIndex: 2, pageSize: 10, keyword: ' FY ',
      filterWhere: [{ Name: 'Id', Type: '<>', Value: 'excluded-child' }] })
    assert.deepEqual(plain(result), { rows: [{ Id: 'child-1' }], count: 21 })
    assert.deepEqual(fixture.calls.at(-1), { key: 'xjy-order-renewal', args: {
      Action: 'DraftRows', TableName: tableName, ParentId: parentId, DingdanID: 'draft-order',
      _PageIndex: 2, _PageSize: 10, _Keyword: 'FY', _Where: [{ Name: 'Id', Type: '<>', Value: 'excluded-child' }]
    } })
  }
})

test('正式订单仅由服务端明确 UseNativeQuery 后回退，网关拒绝不能伪装空列表', async () => {
  const context = { tableName: 'Diy_DingdanSP', parentTableName: 'Diy_Dingdan', parentId: 'order-1' }
  assert.equal(await tenantFixture({ callApiEngine: async () => ({ Code: 1, Data: [], DataAppend: { UseNativeQuery: true } }) }).loadRelatedRows(context), null)
  await assert.rejects(tenantFixture({ callApiEngine: async () => ({ Code: 0, Msg: '草稿已失效' }) }).loadRelatedRows(context), /草稿已失效/)
  assert.equal(await tenantFixture().loadRelatedRows({ ...context, tableName: 'Diy_Kehu' }), null)
})

function relatedFixture(overrides = {}) {
  const calls = { navigation: [], toasts: [], permissions: [] }
  const sandbox = {
    getUser: () => ({}), MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {}, MciListFilterField: {},
    canAddMenuRecord: menuId => { calls.permissions.push(menuId); return menuId === 'real-orders-menu' },
    canEditMenuRecord: menuId => menuId === 'real-orders-menu',
    resolveRelatedFormNavigation: tenantFixture().resolveRelatedFormNavigation,
    openForm: async value => calls.navigation.push(plain(value)),
    uni: { showToast: value => calls.toasts.push(value) },
    ...overrides
  }
  const script = read('../src/components/mci-business-related-list/mci-business-related-list.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
  vm.runInNewContext(withoutImports(script).replace('export default', 'globalThis.component ='), sandbox)
  const component = sandbox.component
  const context = { ...component.data(), ...component.methods, ...relation,
    config: { table: relation.tableName }, parentTableName: relation.parentTableName,
    childMenuId: 'hidden-relation-menu', relationValue: relation.parentId, childFkField: 'ParentDingdanID',
    readonlyList: false, currentUser: {}, relatedFormTarget: { table: 'Diy_Dingdan', menuId: 'real-orders-menu' } }
  return { calls, component, context }
}

test('关联列表新增及行编辑按真实合同菜单判断，不向关系表提供删除', async () => {
  const { component, context, calls } = relatedFixture()
  context.canAdd = component.computed.canAdd.call(context)
  assert.equal(context.canAdd, true)
  assert.deepEqual(calls.permissions, ['real-orders-menu'])
  await component.methods.openAdd.call(context)
  assert.equal(calls.navigation[0].table, 'Diy_Dingdan')
  assert.deepEqual(plain(component.methods.rowActions.call(context, {})), [{ key: 'related-target-edit', label: '编辑', tone: 'default' }])
  await component.methods.triggerRowAction.call(context, { key: 'related-target-edit' }, { Id: 'mirror', XQDingdanID: 'renewal-order' })
  assert.equal(calls.navigation[1].rowId, 'renewal-order')
  assert.equal(calls.navigation[1].mode, 'Edit')
})

test('连续点击仅打开一次，失败显示原因且不打开空白表单', async () => {
  let resolve
  const pending = new Promise(done => { resolve = done })
  const fixture = relatedFixture({ resolveRelatedFormNavigation: async () => pending })
  const first = fixture.component.methods.openTenantRelatedForm.call(fixture.context, 'Add')
  await fixture.component.methods.openTenantRelatedForm.call(fixture.context, 'Add')
  resolve({ table: 'Diy_Dingdan', menuId: 'real-orders-menu', mode: 'Add' })
  await first
  assert.equal(fixture.calls.navigation.length, 1)
  assert.equal(fixture.context.relatedFormOpening, false)
  const failed = relatedFixture({ resolveRelatedFormNavigation: async () => { throw new Error('原订单尚未审批') } })
  await failed.component.methods.openTenantRelatedForm.call(failed.context, 'Add')
  assert.equal(failed.calls.navigation.length, 0)
  assert.equal(failed.calls.toasts[0].title, '原订单尚未审批')
})

test('草稿读取失败或组件离开时不能退回普通查询绕过服务端草稿校验', async () => {
  for (const leave of [false, true]) {
    let complete
    const pending = new Promise(resolve => { complete = resolve })
    let nativeCalls = 0
    const fixture = relatedFixture({
      loadTenantRelatedRows: async () => leave ? pending : Promise.reject(new Error('草稿已失效')),
      loadModuleRows: async () => { nativeCalls += 1; return { rows: [], count: 0 } }
    })
    Object.assign(fixture.context, { relatedFormTarget: null, keyword: '',
      buildKeywordFilterWhere: () => [], buildFilterWhere: () => [],
      requiresModuleAssociationQuery: () => true,
      hydrateProposalInstallationPointRows: async rows => rows, hydrateCollectionRows: async rows => rows })
    const loading = fixture.component.methods.loadData.call(fixture.context, true, false, false)
    if (leave) { fixture.context.componentDisposed = true; complete(null) }
    await loading
    assert.equal(nativeCalls, 0)
    if (!leave) assert.equal(fixture.context.error, '草稿已失效')
  }
})

test('标准租户缺省扩展保持兼容，详情页两个入口均保留父表名', async () => {
  const sandbox = { tenantNativeTable: {} }
  vm.runInNewContext(withoutImports(read('../src/platform/native-table.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  assert.equal(await sandbox.resolveRelatedFormNavigation(relation), null)
  assert.equal(await sandbox.loadTenantRelatedRows({}), null)
  assert.equal(await sandbox.loadTenantFormRecord({}), null)
  assert.equal(await sandbox.saveTenantFormRecord({}), null)
  assert.equal(await sandbox.deleteTenantRelatedRecord({}), null)
  const detail = read('../src/pages/business/detail.vue')
  assert.equal((detail.match(/:parent-table-name="moduleConfig\.table"/g) || []).length, 2)
})

function recordFixture(response) {
  const calls = { draft: [], reads: 0, writes: 0, cache: [] }
  const tenant = tenantFixture({ callApiEngine: async (key, args) => {
    calls.draft.push({ key, args: plain(args) })
    return typeof response === 'function' ? response(args) : response
  } })
  const sandbox = {
    V8: {}, getUser: () => ({}), setUser() {},
    loadTenantFormRecord: tenant.loadFormRecord, saveTenantFormRecord: tenant.saveFormRecord,
    isNativeFieldMultiple: field => field.multiple === true,
    serializeNativeTreeValue, validateNativeForm: () => '',
    removeCachePrefix: prefix => calls.cache.push(prefix),
    readFormRecord: async () => { calls.reads += 1; return { Code: 1, Data: { Id: 'formal-child' } } },
    saveNativeForm: async () => { calls.writes += 1; return { Code: 1, Data: { Id: 'formal-child' } } }
  }
  vm.runInNewContext(withoutImports(read('../src/platform/form-record-adapter.js')).replace(/export default[\s\S]*$/, '').replace(/export /g, ''), sandbox)
  return { calls, sandbox, tenant }
}

test('原生订单子表读写经草稿服务端，保存只采集可编辑字段并保留父外键和新 Id', async () => {
  const { calls, sandbox } = recordFixture({ Code: 1, Data: { Id: 'new-child' } })
  await sandbox.loadNativeFormRecord({ tableName: 'diy_shebeiwz', rowId: 'new-child' })
  assert.deepEqual(calls.draft[0].args, { Action: 'DraftRecord', TableName: 'diy_shebeiwz', Id: 'new-child' })
  await sandbox.saveNativeFormRecord({ tableName: 'diy_shebeiwz', rowId: '',
    form: { Location: '调整后位置', ServiceDate: '2027-05-01', Readonly: '伪造设备编号', Enabled: false, Items: ['A', 'B'] },
    fields: [
      { Name: 'Location', component: 'Text', editable: true },
      { Name: 'ServiceDate', component: 'DateTime', editable: true },
      { Name: 'Readonly', component: 'Text', editable: false },
      { Name: 'Enabled', component: 'Switch', editable: true },
      { Name: 'Items', component: 'Checkbox', editable: true, multiple: true }
    ], extraValues: { Id: 'new-child', DingdanSPID: 'draft-product', DingdanID: 'draft-order', Location: '旧位置' }
  })
  assert.deepEqual(calls.draft[1].args, { Action: 'DraftSave', TableName: 'diy_shebeiwz', Id: 'new-child', Form: {
    Id: 'new-child', DingdanSPID: 'draft-product', DingdanID: 'draft-order',
    Location: '调整后位置', ServiceDate: '2027-05-01', Enabled: 0, Items: '["A","B"]'
  } })
  assert.equal(calls.reads, 0)
  assert.equal(calls.writes, 0)
  assert.deepEqual(calls.cache, ['module:'])
})

test('正式明细必须收到显式回退指令才走旧 CRUD，草稿拒绝不进入原生请求', async () => {
  const context = { tableName: 'Diy_DingdanSP', rowId: 'child', definition: {}, fields: [], form: {}, extraValues: {} }
  const formal = recordFixture({ Code: 1, DataAppend: { UseNativeQuery: true } })
  await formal.sandbox.loadNativeFormRecord(context)
  await formal.sandbox.saveNativeFormRecord(context)
  assert.equal(formal.calls.reads, 1)
  assert.equal(formal.calls.writes, 1)
  const denied = recordFixture({ Code: 0, Msg: '草稿属于其他用户' })
  await assert.rejects(denied.sandbox.loadNativeFormRecord(context), /其他用户/)
  await assert.rejects(denied.sandbox.saveNativeFormRecord(context), /其他用户/)
  assert.equal(denied.calls.reads, 0)
  assert.equal(denied.calls.writes, 0)
})

test('草稿表单采集排除审计列和位置派生摘要，保留可修改的业务资料', async () => {
  const fixture = tenantFixture({ callApiEngine: async (_key, args) => {
    assert.deepEqual(plain(args.Form), { Id: 'product', DingdanID: 'draft', LvxinSJDJ: 300 })
    return { Code: 1, Data: { Id: 'product' } }
  } })
  await fixture.saveFormRecord({ tableName: 'Diy_DingdanSP', rowId: 'product', values: {
    Id: 'product', DingdanID: 'draft', LvxinSJDJ: 300, UserId: 'actor', UserName: '创建人',
    IsDeleted: 0, CreateTime: '2026-10-16', ShebeiAZWZ: '旧摘要', ShebeiAZWZArr: '[]'
  } })
})

test('草稿删除保留原确认和成功刷新，readonly 拒绝且正式记录继续原删除', async () => {
  const calls = { modal: 0, native: 0, refresh: 0, draft: [] }
  const sandbox = {
    V8: { FormEngine: { DelFormData: async () => { calls.native += 1; return { Code: 1 } } } },
    getUser: () => ({}), isActionVisible: () => true, resolveActionParams: () => ({}),
    uni: { showModal: options => { calls.modal += 1; options.success({ confirm: true }) }, showToast() {} }
  }
  vm.runInNewContext(withoutImports(read('../src/platform/view-actions.js')).replace(/export default[\s\S]*$/, '').replace(/export \{ isActionVisible \}/, '').replace(/export /g, ''), sandbox)
  const tenant = tenantFixture({ callApiEngine: async (_key, args) => { calls.draft.push(plain(args)); return { Code: 1 } } })
  const action = { ActionType: 'Delete', TableName: 'diy_shebeiwz', Confirm: '确认删除？',
    SuccessActions: [{ ActionType: 'Refresh', Target: 'Data' }] }
  await sandbox.executeViewAction(action, { form: { Id: 'position-1' },
    deleteRecord: tenant.deleteRelatedRecord, refreshData: () => { calls.refresh += 1 } })
  assert.deepEqual(calls.draft, [{ Action: 'DraftDelete', TableName: 'diy_shebeiwz', Id: 'position-1' }])
  assert.equal(calls.modal, 1)
  assert.equal(calls.refresh, 1)
  assert.equal(calls.native, 0)
  await assert.rejects(tenant.deleteRelatedRecord({ tableName: 'diy_shebeiwz', rowId: 'position-1', readonly: true }), /只支持查看/)
  await sandbox.executeViewAction(action, { form: { Id: 'formal-position' },
    deleteRecord: tenantFixture({ callApiEngine: async () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }) }).deleteRelatedRecord })
  assert.equal(calls.native, 1)
})
