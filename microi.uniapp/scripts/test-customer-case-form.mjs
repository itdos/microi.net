import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { buildTableChildDefaultValues } from '../src/platform/table-child-defaults.js'
import { casePhotoField, caseFieldDescription } from '../src/tenants/xjy/case-form.mjs'
import { proposalCostFieldPresentation } from '../src/tenants/xjy/proposal-cost-presentation.mjs'

const read = (name) => fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const plain = (value) => JSON.parse(JSON.stringify(value))

// 执行实际租户钩子，仅替换网络边界；不写入真实案例或修改角色权限。
function loadModule(name, scope = {}) {
  const source = read(name)
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export default/g, 'const exported =')
    .replace(/export (?=(?:async )?function|const)/g, '')
  return vm.runInNewContext(`${source}; exported`, { casePhotoField, caseFieldDescription, proposalCostFieldPresentation, ...scope, console, setTimeout, clearTimeout })
}

function formContext(mode = 'Add', form = {}) {
  const context = { tableName: 'Diy_Anli', mode, rowId: '', state: {}, form, definition: { fields: [] } }
  context.patchForm = (values) => Object.assign(context.form, values)
  return context
}

function loadVue(name, scope = {}) {
  const source = read(name).match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'const component =')
  return vm.runInNewContext(`${source}; component`, scope)
}

test('客户详情案例 Tab 新增直接带入城市、概况，保留父子表关联和原有字段映射', async () => {
  const platform = loadModule('platform/native-form.js', {
    nativeControls: JSON.parse(read('config/mci-native-controls.json'))
  })
  const tenant = loadModule('tenants/xjy/native-table.js', { parseJson: platform.parseJson })
  const page = loadVue('pages/business/detail.vue', {
    themeMixin: {}, MciBusinessRelatedList: {}, customerCaseChildField: tenant.customerCaseChildField
  })
  const opened = []
  const related = loadVue('components/mci-business-related-list/mci-business-related-list.vue', {
    MciBusinessCard: {}, MciTaskCard: {}, MciNativeField: {},
    buildTableChildDefaultValues, openForm: (args) => opened.push(args)
  })
  const field = {
    Id: 'case-child', Name: 'KehuAL', formTabKey: '客户案例',
    config: { TableChildFkFieldName: 'KehuID', TableChild: {
      FieldRelations: [['KehuMC', 'KehuMC'], ['KehuLX', 'KehuLX']]
    } }
  }
  const original = plain(field)
  const parent = { Id: 'customer-1', KehuMC: '客户一', KehuLX: '学校',
    Chengshi: '["浙江省","宁波市","鄞州区"]', KehuGK: '客户概况\n第二行 & 100%' }
  const [tab] = page.computed.relatedTabs.call({
    moduleConfig: { table: 'Diy_Kehu' }, definition: { childFields: [field] }
  })
  const state = {
    canAdd: true, config: { table: 'Diy_Anli', title: '客户案例' }, moduleKey: 'cases',
    fieldConfig: tab.field.config, parentForm: parent, childFkField: 'KehuID', relationValue: parent.Id,
    menuId: 'case-menu', tableChildAuth: { ParentSysMenuId: 'customer-menu', ParentFieldId: field.Id }
  }
  state.callbackDefaults = related.methods.callbackDefaults.bind(state)
  await related.methods.openAdd.call(state)
  assert.equal(opened[0].mode, 'Add')
  assert.equal(opened[0].table, 'Diy_Anli')
  assert.equal(opened[0].tableChildAuth, state.tableChildAuth)
  assert.deepEqual(plain(opened[0].defaultValues), {
    KehuID: parent.Id, KehuMC: parent.KehuMC, KehuLX: parent.KehuLX,
    Chengshi: parent.Chengshi, KehuGK: parent.KehuGK
  })
  const defaults = JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(opened[0].defaultValues))))
  const fields = ['KehuMC', 'KehuLX', 'Chengshi', 'KehuGK'].map((Name) => ({ Name }))
  const form = platform.defaultFormData({ fields }, defaults)
  assert.equal(form.Chengshi, parent.Chengshi)
  assert.equal(form.KehuGK, parent.KehuGK)
  assert.deepEqual(plain(field), original)
  assert.equal(tenant.customerCaseChildField('Diy_Kehu', tab.field), tab.field)
})

test('案例 Tab 带入兼容城市数组和空资料，其他客户子表及其他业务详情保持原配置', () => {
  const platform = loadModule('platform/native-form.js', {
    nativeControls: JSON.parse(read('config/mci-native-controls.json'))
  })
  const tenant = loadModule('tenants/xjy/native-table.js', { parseJson: platform.parseJson })
  const field = { Name: 'KehuAL', config: { TableChild: { FieldRelations: '[["KehuMC","KehuMC"]]' } } }
  assert.equal(tenant.customerCaseChildField('Diy_Dingdan', field), field)
  const other = { ...field, Name: 'LianxiR' }
  assert.equal(tenant.customerCaseChildField('Diy_Kehu', other), other)
  const config = tenant.customerCaseChildField('Diy_Kehu', field).config
  for (const parentForm of [{ Chengshi: ['浙江省', '杭州市', '西湖区'], KehuGK: '' }, {}]) {
    const defaults = buildTableChildDefaultValues({ fieldConfig: config, parentForm })
    assert.deepEqual(defaults, parentForm)
  }
})

test('新增案例展示真实商家，隐藏 Id 和名称进入保存参数，并发保存共用身份请求', async () => {
  let calls = 0
  const hooks = loadModule('tenants/xjy/form.js', {
    V8: { ApiEngine: { Run: async (key, params) => {
      calls++
      assert.equal(key, 'platform-current-user')
      assert.deepEqual(plain(params), {})
      return { Code: 1, Data: { Id: 'user-1', TenantId: 'merchant-1', TenantName: '商家一' } }
    } } }
  })
  const context = formContext('Add', { TenantId: 'stale', TenantName: '旧商家', KehuID: 'customer-1' })
  const [, payload] = await Promise.all([hooks.initialize(context), hooks.beforeSubmit(context)])
  assert.equal(calls, 1)
  assert.equal(context.form.TenantName, '商家一')
  assert.deepEqual(plain(payload), { TenantId: 'merchant-1', TenantName: '商家一', KehuID: 'customer-1' })
})

test('编辑案例不覆盖原商家，身份请求失败后允许重试', async () => {
  let calls = 0
  const hooks = loadModule('tenants/xjy/form.js', { V8: { ApiEngine: { Run: async () => {
    if (++calls === 1) return { Code: 0, Msg: '连接失败' }
    return { Code: 1, Data: { CurrentUser: { Id: 'user-1', TenantId: 'merchant-1', TenantName: '商家一' } } }
  } } } })
  const edit = formContext('Edit', { TenantId: 'merchant-old', TenantName: '原商家' })
  await hooks.initialize(edit)
  assert.equal(calls, 0)
  assert.equal(edit.form.TenantName, '原商家')
  const add = formContext()
  await assert.rejects(hooks.initialize(add), /连接失败/)
  await hooks.initialize(add)
  assert.equal(add.form.TenantId, 'merchant-1')
})

test('选择、切换、清空客户同步隐藏 Id，保存时带上最新关联', async () => {
  const hooks = loadModule('tenants/xjy/form.js')
  const context = formContext('Edit', { KehuID: 'old' })
  const field = { Name: 'KehuMC' }
  await hooks.handleFieldSelect(context, { field, raw: { Id: 'customer-1' } })
  assert.equal(context.form.KehuID, 'customer-1')
  await hooks.handleFieldSelect(context, { field, option: { raw: { Id: 'customer-2' } } })
  assert.equal((await hooks.beforeSubmit(context)).KehuID, 'customer-2')
  await hooks.handleFieldSelect(context, { field, cleared: true })
  assert.equal((await hooks.beforeSubmit(context)).KehuID, '')
})

test('新增和编辑案例选择客户即带入类型、城市、概况，并通过实际保存流程提交最新值', async () => {
  const writes = []
  const V8 = {
    ApiEngine: { Run: async () => ({ Code: 1, Data: { Id: 'user-1', TenantId: 'merchant-1', TenantName: '商家一' } }) },
    FormEngine: Object.fromEntries(['AddFormData', 'UptFormData'].map((method) => [method, async (table, data) => {
      writes.push({ method, table, data: plain(data) })
      return { Code: 1 }
    }]))
  }
  const hooks = loadModule('tenants/xjy/form.js', { V8 })
  const platform = loadModule('platform/native-form.js', {
    V8, nativeControls: JSON.parse(read('config/mci-native-controls.json')), removeCachePrefix: () => {}
  })
  const fields = [
    ['KehuMC', 'Select'], ['KehuLX', 'Select'], ['Chengshi', 'Address'], ['KehuGK', 'Textarea']
  ].map(([Name, component]) => ({ Name, component, editable: true }))
  for (const tableName of ['Diy_Anli', 'Diy_Anlice_Child']) for (const mode of ['Add', 'Edit']) {
    const context = formContext(mode, { KehuMC: '客户一', KehuLX: '旧类型', Chengshi: '旧城市', KehuGK: '旧概况' })
    context.tableName = tableName
    const customer = { Id: 'customer-1', KehuLX: '学校', Chengshi: '["浙江省","宁波市","鄞州区"]', KehuGK: '校园直饮水项目\n覆盖三个校区' }
    await hooks.handleFieldSelect(context, { field: { Name: 'KehuMC' }, ...(mode === 'Add' ? { raw: customer } : { option: { raw: customer } }) })
    assert.equal(context.form.KehuLX, customer.KehuLX)
    assert.equal(context.form.Chengshi, customer.Chengshi)
    assert.equal(context.form.KehuGK, customer.KehuGK)
    context.form.KehuGK += '\n已补充案例说明'
    const tableChildAuth = tableName === 'Diy_Anlice_Child' ? { ParentSysMenuId: 'book-menu', ParentFieldId: 'book-cases', ParentFormDataId: 'book-1' } : undefined
    await platform.saveNativeForm(tableName, mode === 'Edit' ? 'case-1' : '', context.form, fields, await hooks.beforeSubmit(context), { menuId: 'case-menu', tableChildAuth })
    const saved = writes.at(-1)
    assert.equal(saved.table, tableName)
    if (tableChildAuth) assert.deepEqual(saved.data._TableChildAuth, tableChildAuth)
    assert.equal(saved.method, mode === 'Edit' ? 'UptFormData' : 'AddFormData')
    assert.equal(saved.data.KehuID, customer.Id)
    assert.equal(saved.data.KehuLX, customer.KehuLX)
    assert.equal(saved.data.Chengshi, customer.Chengshi)
    assert.equal(saved.data.KehuGK, context.form.KehuGK)
    assert.equal(saved.data._SysMenuId, 'case-menu')
  }
})

test('切换客户覆盖旧联动信息，缺失值及清空客户不会残留旧资料，城市数组独立复制', async () => {
  const hooks = loadModule('tenants/xjy/form.js')
  const context = formContext('Edit', { KehuID: 'old', KehuLX: '旧类型', Chengshi: '旧城市', KehuGK: '旧概况', Biaoti: '保留标题' })
  const field = { Name: 'KehuMC' }
  const city = ['浙江省', '杭州市', '西湖区']
  await hooks.handleFieldSelect(context, { field, raw: { Id: 'customer-2', KehuLX: '企业', Chengshi: city, KehuGK: '新客户概况' } })
  assert.deepEqual(plain(context.form.Chengshi), city)
  assert.notEqual(context.form.Chengshi, city)
  await hooks.handleFieldSelect(context, { field, raw: { Id: 'customer-3', KehuLX: null, Chengshi: null } })
  assert.deepEqual(plain(context.form), { KehuID: 'customer-3', KehuLX: '', Chengshi: '', KehuGK: '', Biaoti: '保留标题' })
  await hooks.handleFieldSelect(context, { field, raw: { Id: 'customer-2', KehuLX: '企业', Chengshi: city, KehuGK: '概况' } })
  await hooks.handleFieldSelect(context, { field, cleared: true, raw: { Id: 'customer-2', KehuLX: '企业' } })
  assert.deepEqual(plain(context.form), { KehuID: '', KehuLX: '', Chengshi: '', KehuGK: '', Biaoti: '保留标题' })
})

test('仅打开编辑页保留原案例内容，其他字段和非案例表不触发客户案例联动', async () => {
  const hooks = loadModule('tenants/xjy/form.js')
  const original = { KehuID: 'customer-1', KehuLX: '学校', Chengshi: '原城市', KehuGK: '编辑过的案例概况' }
  const context = formContext('Edit', { ...original })
  await hooks.initialize(context)
  assert.deepEqual(plain(context.form), original)
  await hooks.handleFieldSelect(context, { field: { Name: 'KehuLX' }, raw: { Id: 'other', KehuGK: '覆盖' } })
  assert.deepEqual(plain(context.form), original)
  context.tableName = 'diy_other'
  await hooks.handleFieldSelect(context, { field: { Name: 'KehuMC' }, raw: { Id: 'other', KehuGK: '覆盖' } })
  assert.deepEqual(plain(context.form), original)
})

test('未选客户不添加空 Id 条件，已选客户仍过滤，原配置条件保持', () => {
  const hooks = loadModule('tenants/xjy/native-table.js')
  const field = { Name: 'XuanzeZP' }
  for (const KehuID of [undefined, null, '', '  ']) {
    const where = [{ Name: 'Zhuangtai', Type: '=', Value: '已结束' }]
    assert.deepEqual(plain(hooks.appendOpenTableWhere({ field, form: { KehuID }, where })), where)
  }
  assert.deepEqual(plain(hooks.appendOpenTableWhere({ field, form: { KehuID: 'customer-1' }, where: [] })), [
    { Name: 'KehuID', Type: '=', Value: 'customer-1' }
  ])
})

test('选择无照片任务不清空已有照片，真实照片仍使用来源单据授权', async () => {
  const calls = []
  const hooks = loadModule('tenants/xjy/native-table.js', {
    parseJson: (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback } catch { return fallback } },
    V8: { resolveFileUrl: async (image, context) => { calls.push(context); return '/temporary-preview' } }
  })
  const form = { Tupian: [{ Path: '/old-photo' }] }
  const args = { tableName: 'Diy_Anli', field: { Name: 'XuanzeZP' }, form }
  await assert.rejects(hooks.submitTenantOpenTableSelection({ ...args, rows: [{ Id: 'task-empty' }] }), /暂无照片/)
  assert.equal(form.Tupian[0].Path, '/old-photo')
  const result = await hooks.submitTenantOpenTableSelection({ ...args, rows: [{ Id: 'task-1', JieguoTP: '[{"Id":"photo-1","Path":"/photo"}]' }] })
  assert.equal(result.changedField, 'Tupian')
  assert.equal(calls[0].formDataId, 'task-1')
  assert.equal(calls[0].sysMenuId, 'd9ed1fb9-1770-46e8-9662-31399aeece67')
  assert.equal(form['Tupian_photo-1_RealPath'], '/temporary-preview')
})

test('照片按钮声明定位在照片字段之前，不改变其他表的选择器', () => {
  const hooks = loadModule('tenants/xjy/form.js')
  const context = formContext()
  assert.equal(hooks.getRelatedPresentation(context, { Name: 'XuanzeZP' }).beforeField, 'Tupian')
  assert.equal(hooks.getRelatedPresentation(context, { Name: 'XuanzeZP' }).icon, 'images')
  context.tableName = 'other'
  assert.deepEqual(plain(hooks.getRelatedPresentation(context, { Name: 'XuanzeZP' })), {})
  const page = read('pages/native-form/index.vue')
  assert.ok(page.indexOf('openTableRelatedBeforeField(field)') < page.indexOf('class="form-field__label"'))
  const selector = read('components/mci-table-selector/mci-table-selector.vue')
  assert.match(selector, /_SysMenuId: this.targetMenuId/)
})

test('案例册复用客户案例编辑配置，只将图片字段映射为子表字段', () => {
  const hooks = loadModule('tenants/xjy/form.js')
  const main = formContext('Edit', { KehuID: 'customer-1' })
  const child = { ...main, tableName: 'Diy_Anlice_Child' }
  const field = { Name: 'XuanzeZP' }
  assert.deepEqual(plain(hooks.getRelatedPresentation(child, field)), {
    ...plain(hooks.getRelatedPresentation(main, field)), beforeField: 'KehuALZP'
  })
  for (const name of ['KehuPJ', 'KehuALZP']) {
    const sourceName = name === 'KehuALZP' ? 'Tupian' : name
    assert.deepEqual(plain(hooks.getFieldPresentation(child, { Name: name })),
      plain(hooks.getFieldPresentation(main, { Name: sourceName })))
  }
})

test('案例册选照片回填实际图片字段与预览，保存保留父案例册授权且不写入源客户案例', async () => {
  const writes = [], previews = []
  const V8 = {
    resolveFileUrl: async (image, context) => { previews.push(context); return '/preview/' + image.Id },
    FormEngine: { UptFormData: async (table, data) => { writes.push({ table, data: plain(data) }); return { Code: 1 } } }
  }
  const platform = loadModule('platform/native-form.js', {
    V8, nativeControls: JSON.parse(read('config/mci-native-controls.json')), removeCachePrefix: () => {}
  })
  const hooks = loadModule('tenants/xjy/native-table.js', { V8, parseJson: platform.parseJson })
  const formHooks = loadModule('tenants/xjy/form.js')
  const context = { ...formContext('Edit', {
    Biaoti: '保留案例标题', KehuID: 'customer-1', AnliCID: 'book-1', KehuALZP: [{ Path: '/old' }]
  }), tableName: 'Diy_Anlice_Child' }
  const args = { tableName: context.tableName, field: { Name: 'XuanzeZP' }, form: context.form }
  await assert.rejects(hooks.submitTenantOpenTableSelection({ ...args, rows: [{ Id: 'empty' }] }), /暂无照片/)
  assert.equal(context.form.KehuALZP[0].Path, '/old')
  const result = await hooks.submitTenantOpenTableSelection({ ...args, rows: [{
    Id: 'task-1', KehuSCZP: [{ Id: 'photo-1', Path: '/door' }], JieguoTP: '[{"Id":"photo-2","Path":"/device"}]'
  }] })
  assert.equal(result.changedField, 'KehuALZP')
  assert.equal(context.form.KehuALZP.length, 2)
  assert.equal(context.form['KehuALZP_photo-1_RealPath'], '/preview/photo-1')
  assert.equal(context.form.Tupian, undefined)
  assert.ok(previews.every((value) => value.formEngineKey === 'Diy_ShouhouDD' && value.formDataId === 'task-1'))
  assert.ok(previews.every((value) => value.sysMenuId === 'd9ed1fb9-1770-46e8-9662-31399aeece67'))
  const fields = [['Biaoti', 'Text'], ['KehuALZP', 'ImgUpload']].map(([Name, component]) => ({ Name, component, editable: true }))
  const tableChildAuth = { ParentSysMenuId: 'book-menu', ParentFieldId: 'book-cases', ParentFormDataId: 'book-1' }
  await platform.saveNativeForm(context.tableName, 'child-1', context.form, fields, await formHooks.beforeSubmit(context), { tableChildAuth })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].table, 'Diy_Anlice_Child')
  assert.deepEqual(writes[0].data._TableChildAuth, tableChildAuth)
  assert.equal(writes[0].data.Tupian, undefined)
  assert.equal(writes[0].data.Biaoti, '保留案例标题')
  assert.equal(writes[0].data.KehuALZP[1].Path, '/device')
  assert.ok(!JSON.stringify(writes[0].data).includes('/preview/'))
  assert.equal(context.form.AnliCID, 'book-1')
})

test('案例册照片弹窗支持筛选、确认回显、取消草稿及切换客户清除旧选择', async () => {
  const { state, calls } = createPhotoSelector({}, 'Diy_Anlice_Child')
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  await state.openFilters()
  state.draftFilterValues.city = '杭州市'
  await state.applyFilters()
  assert.equal(calls.queries.at(-1)._SysMenuId, 'photo-menu')
  assert.ok(calls.queries.at(-1)._Where.some((item) => item.Name === 'Chengshi' && item.Value === '杭州市'))
  await state.confirmSelection()
  assert.equal(calls.submitted[0].tableName, 'Diy_Anlice_Child')
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  state.toggleRow({ Id: 'task-2' })
  state.closeSelector()
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-2' }), false)
  state.closeSelector()
  state.parentForm.KehuID = 'customer-2'
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-1' }), false)
  assert.ok(calls.queries.at(-1)._Where.some((item) => item.Name === 'KehuID' && item.Value === 'customer-2'))
})

test('表单实际布局只渲染一个内嵌入口，目标被隐藏时回退原入口，查看态不显示', () => {
  const script = read('pages/native-form/index.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'const page =')
  const page = vm.runInNewContext(`${script}; page`, {
    themeMixin: {}, MciBusinessRelatedList: {}, MciCustomerPicker: {}, MciPosterDetail: {}, MciVisitTargetFields: {}
  })
  const target = { Name: 'Tupian', formTabKey: '__basic__' }
  const selector = { type: 'openTable', field: { Name: 'XuanzeZP', formTabKey: '__basic__' } }
  const state = {
    isEditableMode: true,
    definition: { groups: [{ fields: [target] }] },
    activeRelatedTabs: [selector],
    relatedPresentation: () => ({ beforeField: 'Tupian' }),
    tenantFieldPresentation: () => ({})
  }
  for (const key of ['isInlineOpenTableRelated', 'openTableRelatedBeforeField', 'isEmbeddedRelated', 'isEmbeddedChildRelated', 'isEmbeddedOpenTableRelated']) {
    state[key] = page.methods[key].bind(state)
  }
  assert.equal(state.openTableRelatedBeforeField(target).length, 1)
  assert.equal(page.computed.standaloneRelatedTabs.call(state).length, 0)
  state.isEditableMode = false
  assert.equal(state.openTableRelatedBeforeField(target).length, 0)
  state.tenantFieldPresentation = () => ({ visible: false })
  assert.equal(page.computed.standaloneRelatedTabs.call(state).length, 1)
})

test('选择器查询继续携带原照片菜单权限，接口拒绝时展示错误', async () => {
  const source = read('components/mci-table-selector/mci-table-selector.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'const component =')
  const calls = []
  let response = { Code: 1, Data: [{ Id: 'task-1' }], DataCount: 1 }
  const tenant = loadModule('tenants/xjy/native-table.js')
  const component = vm.runInNewContext(`${source}; component`, {
    V8: { FormEngine: { GetTableData: async (table, query) => { calls.push({ table, query }); return response } } },
    getOpenTableWhere: (field, form) => tenant.appendOpenTableWhere({ field, form, where: [] })
  })
  const state = {
    ...component.data(), table: { Name: 'Diy_ShouhouDD' },
    field: { Name: 'XuanzeZP' }, parentForm: {}, filterWhere: [],
    targetMenuId: 'd9ed1fb9-1770-46e8-9662-31399aeece67', resolveTable: async () => {}
  }
  await component.methods.loadRows.call(state, true)
  assert.deepEqual(plain(calls[0].query._Where), [])
  assert.equal(calls[0].query._SysMenuId, state.targetMenuId)
  assert.equal(calls[0].query._PageSize, 20)
  assert.equal(state.rows.length, 1)
  state.parentForm.KehuID = 'customer-1'
  response = { Code: 0, Msg: '没有访问权限' }
  await component.methods.loadRows.call(state, true)
  assert.equal(calls[1].query._Where[0].Value, 'customer-1')
  assert.equal(state.error, '没有访问权限')
  assert.equal(state.rows.length, 0)
})

function createPhotoSelector(overrides = {}, tableName = 'Diy_Anli') {
  const tenant = loadModule('tenants/xjy/native-table.js')
  const formHooks = loadModule('tenants/xjy/form.js')
  const calls = { queries: [], dictionaries: [], submitted: [], toasts: [] }
  const source = read('components/mci-table-selector/mci-table-selector.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'const component =')
  const component = vm.runInNewContext(`${source}; component`, {
    setTimeout, clearTimeout,
    uni: { showToast: (message) => calls.toasts.push(message) },
    validateOpenTableContext: () => '',
    getOpenTableWhere: (field, form) => tenant.appendOpenTableWhere({ field, form, where: [] }),
    post: async (url, params) => {
      calls.dictionaries.push({ url, params })
      if (overrides.post) return overrides.post(params)
      return { Code: 1, Data: params.ParentKey === 'ShouhouDDLX'
        ? [{ Key: '4', Value: '维修' }, { Key: '1', Value: '安装' }]
        : [{ Key: '1', Value: '待接单' }, { Key: '9', Value: '已结束' }] }
    },
    V8: { FormEngine: { GetTableData: async (table, query) => {
      calls.queries.push(plain(query))
      return overrides.query ? overrides.query(query) : { Code: 1, Data: [{ Id: 'task-1' }], DataCount: 40 }
    } } },
    submitOpenTableSelection: async (args) => {
      calls.submitted.push(plain(args))
      return overrides.submit ? overrides.submit(args) : { handled: true }
    }
  })
  const state = {
    ...component.data(), parentId: 'case-1', parentTable: tableName, parentForm: { KehuID: 'customer-1' },
    readonly: false, field: { Name: 'XuanzeZP', config: { OpenTable: { SysMenuId: 'photo-menu' } } },
    table: { Name: 'Diy_ShouhouDD' }, definition: { fields: [] }, $emit: () => {},
    presentation: formHooks.getRelatedPresentation({ ...formContext(), tableName }, { Name: 'XuanzeZP' })
  }
  for (const [key, method] of Object.entries(component.methods)) state[key] = method.bind(state)
  for (const [key, computed] of Object.entries(component.computed)) Object.defineProperty(state, key, { get: computed.bind(state) })
  return { state, calls }
}

test('照片筛选读取指定基础字典并按实际存储的中文名称查询，叠加客户、关键词与菜单权限', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  assert.deepEqual(calls.dictionaries.map((item) => item.params.ParentKey).sort(), ['ShouHouDDZT', 'ShouhouDDLX'])
  assert.ok(calls.dictionaries.every((item) => item.url.includes('platform-sys-base-data?Action=GetSysBaseData')))
  const [type, status] = state.filterFields
  assert.equal(state.filterOptionsFor(type)[1].value, '维修')
  await state.openFilters()
  await state.changeFilter(type, { detail: { value: '1' } })
  await state.changeFilter(status, { detail: { value: '2' } })
  state.keyword = ' 编号100 '
  state.draftFilterValues.staff = " 张'三 "
  state.pageIndex = 4
  await state.applyFilters()
  const query = calls.queries.at(-1)
  assert.equal(query._PageIndex, 1)
  assert.equal(query._Keyword, '编号100')
  assert.equal(query._SysMenuId, 'photo-menu')
  assert.deepEqual(query._Where, [
    { Name: 'KehuID', Type: '=', Value: 'customer-1' },
    { Name: 'Leixing', Type: '=', Value: '维修' },
    { Name: 'Zhuangtai', Type: '=', Value: '已结束' },
    { Name: 'ShouhouRY', Type: 'Like', Value: "张'三" }
  ])
  await state.resetSearch()
  assert.deepEqual(calls.queries.at(-1)._Where, [{ Name: 'KehuID', Type: '=', Value: 'customer-1' }])
  assert.equal(calls.queries.at(-1)._Keyword, '')
})

test('字典加载失败可重试，成功字典在当前选择器内复用，不缓存错误为空字典', async () => {
  let attempt = 0
  const { state, calls } = createPhotoSelector({ post: async ({ ParentKey }) => {
    if (ParentKey === 'ShouhouDDLX' && ++attempt === 1) return { Code: 0, Msg: '网络错误' }
    return { Code: 1, Data: [{ Key: '1', Value: '有效选项' }] }
  } })
  await state.openSelector()
  assert.equal(state.filterError, '筛选选项加载失败')
  assert.equal(state.filterLoading, false)
  assert.equal(state.filterOptions.serviceType, undefined)
  await state.loadFilterOptions()
  assert.equal(state.filterError, '')
  assert.equal(calls.dictionaries.length, 3)
  assert.equal(state.filterOptions.serviceType[0].label, '有效选项')
  state.closeSelector()
  await state.openSelector()
  assert.equal(calls.dictionaries.length, 3)
})

test('确认后重开恢复选中高亮；取消的临时勾选不覆盖上次确认', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  state.toggleRow({ Id: 2 })
  await state.confirmSelection()
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  assert.equal(state.isSelected({ Id: '2' }), true)
  assert.equal(state.selectedIds.length, 2)
  state.toggleRow({ Id: 'task-1' })
  state.toggleRow({ Id: 'task-3' })
  state.closeSelector()
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  assert.equal(state.isSelected({ Id: 'task-3' }), false)
  assert.equal(calls.submitted.length, 1)
})

test('筛选、分页和重置都保留已选订单，并刷新已选订单的数据', async () => {
  const { state, calls } = createPhotoSelector({ query: async (query) => ({
    Code: 1, Data: [{ Id: query._Where.some((item) => item.Name === 'Leixing') ? 'task-2' : 'task-1', Version: 2 }], DataCount: 40
  }) })
  await state.openSelector()
  state.toggleRow({ Id: 'task-1', Version: 1 })
  await state.openFilters()
  await state.changeFilter(state.filterFields[0], { detail: { value: '1' } })
  await state.applyFilters()
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  state.toggleRow(state.rows[0])
  state.pageIndex = 2
  await state.loadRows()
  assert.equal(calls.queries.at(-1)._PageIndex, 2)
  assert.equal(state.selectedIds.length, 2)
  await state.resetSearch()
  assert.equal(state.selectedRows.find((row) => row.Id === 'task-1').Version, 2)
  await state.confirmSelection()
  assert.deepEqual(calls.submitted[0].rows.map((row) => row.Id), ['task-1', 'task-2'])
})

test('失败的确认不改变已确认状态，切换客户或案例不复用旧选择', async () => {
  let fail = false
  const { state } = createPhotoSelector({ submit: async () => {
    if (fail) throw new Error('暂无照片')
    return { handled: true }
  } })
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  await state.confirmSelection()
  await state.openSelector()
  state.toggleRow({ Id: 'task-2' })
  fail = true
  await state.confirmSelection()
  assert.equal(state.visible, true)
  state.closeSelector()
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-2' }), false)
  state.parentForm.KehuID = 'customer-2'
  state.closeSelector()
  await state.openSelector()
  assert.equal(state.selectedIds.length, 0)
  fail = false
  state.toggleRow({ Id: 'task-2' })
  await state.confirmSelection()
  state.parentId = 'case-2'
  await state.openSelector()
  assert.equal(state.selectedIds.length, 0)
})

test('普通开表选择器维持原有单次选择行为，不读取照片筛选字典', async () => {
  const { state, calls } = createPhotoSelector()
  state.presentation = {}
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  await state.confirmSelection()
  await state.openSelector()
  assert.equal(state.selectedIds.length, 0)
  assert.equal(state.filterFields.length, 0)
  assert.equal(calls.dictionaries.length, 0)
})

test('迟到的旧搜索响应不能覆盖当前筛选列表或选中状态', async () => {
  let resolveOld
  const { state } = createPhotoSelector({ query: (query) => query._Keyword === '旧查询'
    ? new Promise((resolve) => { resolveOld = resolve })
    : Promise.resolve({ Code: 1, Data: [{ Id: 'new' }], DataCount: 1 }) })
  await state.openSelector()
  state.toggleRow({ Id: 'new' })
  state.keyword = '旧查询'
  const old = state.search()
  await new Promise((resolve) => setImmediate(resolve))
  state.keyword = '新查询'
  await state.search()
  resolveOld({ Code: 1, Data: [{ Id: 'old' }], DataCount: 1 })
  await old
  assert.equal(state.rows[0].Id, 'new')
  assert.equal(state.isSelected(state.rows[0]), true)
})

test('筛选弹窗在查看结果前不改查询；关闭仅丢弃草稿，再次打开恢复已应用条件', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  const [type] = state.filterFields
  await state.openFilters()
  state.changeFilter(type, { detail: { value: '1' } })
  state.draftFilterValues.staff = '张师傅'
  assert.equal(calls.queries.length, 1)
  assert.equal(state.hasActiveFilters, false)
  await state.applyFilters()
  assert.equal(state.filterVisible, false)
  assert.equal(state.visible, true)
  assert.equal(state.filterWhere.length, 2)
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  await state.openFilters()
  assert.equal(state.filterOptionIndex(type, state.draftFilterValues), 1)
  state.changeFilter(type, { detail: { value: '2' } })
  state.clearFilter(state.filterFields[2])
  state.closeFilters()
  assert.equal(calls.queries.length, 2)
  assert.equal(state.filterValues.serviceType, '维修')
  assert.equal(state.filterValues.staff, '张师傅')
  await state.openFilters()
  assert.equal(state.draftFilterValues.serviceType, '维修')
  assert.equal(state.draftFilterValues.staff, '张师傅')
  state.closeSelector()
  assert.equal(state.filterVisible, false)
})

test('弹窗内重置只清草稿；搜索栏重置清关键词和已应用条件，但保留已选订单', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  await state.confirmSelection()
  await state.openSelector()
  state.keyword = '设备'
  await state.openFilters()
  state.changeFilter(state.filterFields[1], { detail: { value: '2' } })
  await state.applyFilters()
  const queryCount = calls.queries.length
  await state.openFilters()
  state.resetDraftFilters()
  assert.deepEqual(plain(state.draftFilterValues), {})
  assert.equal(calls.queries.length, queryCount)
  assert.equal(state.filterVisible, true)
  state.closeFilters()
  assert.equal(state.filterValues.status, '已结束')
  await state.resetSearch()
  assert.equal(state.keyword, '')
  assert.equal(state.filterWhere.length, 0)
  assert.equal(state.filterVisible, false)
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
  state.closeSelector()
  await state.openSelector()
  assert.equal(state.isSelected({ Id: 'task-1' }), true)
})

test('城市与计划服务时间区间组合查询，时间范围按一个条件计数且包含结束分钟', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  await state.openFilters()
  const city = state.filterFields.find((field) => field.key === 'city')
  const range = state.filterFields.find((field) => field.key === 'plannedService')
  assert.equal(city.field, 'Chengshi')
  assert.equal(range.field, 'YujiSHSJ')
  state.draftFilterValues.city = ' 杭州市 '
  state.changeDateTimeRange(range, 'start', 'date', { detail: { value: '2026-09-01' } })
  state.changeDateTimeRange(range, 'start', 'time', { detail: { value: '08:30' } })
  state.changeDateTimeRange(range, 'end', 'date', { detail: { value: '2026-09-07' } })
  state.changeDateTimeRange(range, 'end', 'time', { detail: { value: '18:15' } })
  assert.equal(calls.queries.length, 1)
  await state.applyFilters()
  assert.deepEqual(calls.queries.at(-1)._Where, [
    { Name: 'KehuID', Type: '=', Value: 'customer-1' },
    { Name: 'Chengshi', Type: 'Like', Value: '杭州市' },
    { Name: 'YujiSHSJ', Type: '>=', Value: '2026-09-01 08:30' },
    { Name: 'YujiSHSJ', Type: '<', Value: '2026-09-07 18:16' }
  ])
  assert.equal(state.activeFilterCount, 2)
  assert.equal(calls.queries.at(-1)._SysMenuId, 'photo-menu')
  await state.openFilters()
  state.changeDateTimeRange(range, 'end', 'time', { detail: { value: '19:15' } })
  state.closeFilters()
  assert.equal(state.filterValues.plannedService.end, '2026-09-07 18:15')
})

test('计划服务区间支持单边、整天及跨年边界，清空边界和重置后不发送空条件', async () => {
  const { state } = createPhotoSelector()
  await state.openSelector()
  const range = state.filterFields.find((field) => field.type === 'datetime-range')
  await state.openFilters()
  state.changeDateTimeRange(range, 'end', 'date', { detail: { value: '2026-12-31' } })
  assert.equal(state.dateTimeRangePart(range, 'end', 'time'), '23:59')
  await state.applyFilters()
  assert.deepEqual(plain(state.filterWhere), [{ Name: 'YujiSHSJ', Type: '<', Value: '2027-01-01 00:00' }])
  await state.openFilters()
  state.clearDateTimeRange(range, 'end')
  state.changeDateTimeRange(range, 'start', 'date', { detail: { value: '2026-12-31' } })
  await state.applyFilters()
  assert.deepEqual(plain(state.filterWhere), [{ Name: 'YujiSHSJ', Type: '>=', Value: '2026-12-31 00:00' }])
  await state.openFilters()
  state.clearDateTimeRange(range, 'start')
  await state.applyFilters()
  assert.equal(state.filterWhere.length, 0)
  assert.equal(state.activeFilterCount, 0)
})

test('倒置区间和非法日期不能应用，已应用筛选、选中订单及弹窗状态保持', async () => {
  const { state, calls } = createPhotoSelector()
  await state.openSelector()
  state.toggleRow({ Id: 'task-1' })
  await state.openFilters()
  state.draftFilterValues.city = '宁波市'
  await state.applyFilters()
  const count = calls.queries.length
  for (const range of [
    { start: '2026-09-07 18:00', end: '2026-09-07 08:00' },
    { start: '2026-02-30 08:00' },
    { end: '2026-09-07 24:01' }
  ]) {
    await state.openFilters()
    state.draftFilterValues.plannedService = range
    await state.applyFilters()
    assert.equal(state.filterVisible, true)
    assert.equal(calls.queries.length, count)
    assert.equal(state.filterValues.city, '宁波市')
    assert.equal(state.isSelected({ Id: 'task-1' }), true)
  }
  assert.match(calls.toasts.at(-1).title, /格式不正确/)
  await state.resetSearch()
  assert.equal(state.filterWhere.length, 0)
})

test('图片列表按模块返回字段展示城市、地址和计划服务时间，照片字段不作为文字列', () => {
  const { state } = createPhotoSelector()
  const fields = [
    ['KehuMC', '客户名称', 'Text'], ['Leixing', '服务类型', 'Select'],
    ['Chengshi', '城市', 'Address'], ['Dizhi', '地址', 'Text'],
    ['YujiSHSJ', '计划服务时间', 'DateTime'], ['KehuSCZP', '初始照片', 'ImgUpload']
  ]
  state.definition = { fields: fields.map(([Name, Label, component]) => ({ Name, Label, component, visible: true, options: [] })) }
  state.menuDefinition = { titleField: 'KehuMC', cardFields: fields.map(([Name]) => Name) }
  assert.deepEqual(plain(state.secondaryColumns.map((field) => field.Name)), ['Leixing', 'Chengshi', 'Dizhi', 'YujiSHSJ'])
})
