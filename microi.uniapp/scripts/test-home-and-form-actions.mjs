import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as fieldVisibility from '../src/platform/native-field-visibility.mjs'
import { resolveBusinessMenuPermission } from '../src/platform/menu-resolution.mjs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const stripImports = (source) => source.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
const controls = JSON.parse(read('src/config/mci-native-controls.json'))
const nativeSource = stripImports(read('src/platform/native-form.js'))
  .replace(/export default/g, 'const exported =').replace(/export (?=(?:async )?function|const)/g, '')
const native = vm.runInNewContext(`${nativeSource}; exported`, {
  ...fieldVisibility, nativeControls: controls, getUser: () => ({})
})
const homeSource = stripImports(read('src/pages/workspace/index.vue').match(/<script>([\s\S]*?)<\/script>/)[1])
  .replace('export default', 'const page =')
const home = vm.runInNewContext(`${homeSource}; page`, { themeMixin: {} })
const names = (definition) => Array.from(definition.groups.flatMap(group => group.fields), field => field.Name)
const definition = (fieldOverrides = {}, user = {}) => native.createNativeFormDefinition({}, [
  { Name: 'Title', Component: 'Text' },
  { Name: 'OrderDetails', Component: 'Button', AppVisible: 1, ...fieldOverrides },
  { Name: 'UnknownButton', Component: 'Button' },
  { Name: 'CustomControl', Component: 'DevComponent' }
], { user })

test('受控原生按钮进入实际表单分组，未经适配的脚本按钮和自定义控件仍被隔离', () => {
  const raw = definition()
  assert.deepEqual(names(raw), ['Title'])
  const scoped = native.scopeNativeFormDefinition(raw, { actionFieldNames: ['OrderDetails', 'CustomControl'] })
  assert.deepEqual(names(scoped), ['Title', 'OrderDetails'])
  assert.equal(scoped.fields.find(field => field.Name === 'OrderDetails').editable, false)
  assert.deepEqual(names(native.applyNativeFormViewDefinition(scoped, { sections: [{ fields: [{ name: 'Title' }] }] })),
    ['Title', 'OrderDetails'])
})

test('原生按钮遵守后台字段显隐、角色绑定、隐藏分组和页面字段范围', () => {
  for (const raw of [definition({ AppVisible: 0 }), definition({ BindRole: '["finance"]' }, { RoleIds: ['sales'] })]) {
    assert.deepEqual(names(native.scopeNativeFormDefinition(raw, { actionFieldNames: ['OrderDetails'] })), ['Title'])
  }
  const restricted = native.createNativeFormDefinition({}, [
    { Name: 'PrivateGroup', Component: 'CollapseGroup', AppVisible: 0 },
    { Name: 'OrderDetails', Component: 'Button' }
  ])
  assert.deepEqual(names(native.scopeNativeFormDefinition(restricted, { actionFieldNames: ['OrderDetails'] })), [])
  assert.deepEqual(names(native.scopeNativeFormDefinition(definition(), {
    actionFieldNames: ['OrderDetails'], excludeNames: ['OrderDetails']
  })), ['Title'])
})

function homeContext(visibility, role = '销售') {
  const ctx = {
    isLoggedIn: true, businessEntryVisibility: visibility,
    roleProfile: { roleText: role, allowedGroupKeys: ['customer'] }, runtimeBusinessGroups: [],
    businessGroups: [
      { key: 'customer', items: [{ key: 'customers' }] },
      { key: 'service', items: [{ key: 'orders' }, { key: 'tasks' }] },
      { key: 'oa', items: [{ key: 'attendance' }] }
    ]
  }
  ctx.isHomeEntryVisible = key => home.methods.isHomeEntryVisible.call(ctx, key)
  return ctx
}

test('销售有订单菜单权限时显示服务管理，仅保留后台授权的菜单', () => {
  const groups = home.computed.visibleBusinessGroups.call(homeContext({ orders: true, tasks: false, customers: true, attendance: false }))
  assert.deepEqual(Array.from(groups, group => group.key), ['customer', 'service'])
  assert.deepEqual(Array.from(groups[1].items, item => item.key), ['orders'])
})

test('不同角色同样按菜单授权汇总板块，板块全部无权限才隐藏', () => {
  for (const role of ['销售', '客户', '售后', '管理员']) {
    const groups = home.computed.visibleBusinessGroups.call(homeContext({ orders: false, tasks: false, attendance: true }, role))
    assert.deepEqual(Array.from(groups, group => group.key), ['oa'])
  }
})

test('登录后权限尚未返回时不展示未经确认的菜单，游客保留入口引导', () => {
  const ctx = homeContext({})
  assert.deepEqual(Array.from(home.computed.visibleBusinessGroups.call(ctx)), [])
  ctx.isLoggedIn = false
  assert.equal(home.computed.visibleBusinessGroups.call(ctx).length, 3)
})

test('实际首页目录的全部入口均绑定后台菜单权限，包括原生页面和接口列表', () => {
  const source = stripImports(read('src/tenants/xjy/business.js'))
    .replace(/export default/g, 'const exported =').replace(/export (?=(?:async )?function|const)/g, '')
  const catalog = vm.runInNewContext(`${source}; exported`, { appConfig: { cdnAssets: { scan: 'scan.png' } } })
  for (const group of catalog.businessGroups) {
    for (const item of group.items) {
      const config = catalog.getBusinessModule(item.key)
      const permission = resolveBusinessMenuPermission(catalog.getBusinessEntry(item.key), config)
      assert.ok(permission?.table && permission?.menuAliases?.length, `${group.key}/${item.key} 缺少后台菜单权限映射`)
    }
  }
})

// 执行首页实际加载方法与生命周期；网络边界可延迟，以验证首次加载和账号切换的竞态。
function loadingHome({ permission = async () => true, modules = async () => [], dynamic = false, entryCount = 9 } = {}) {
  let user = { Id: 'user-1', Name: '销售' }
  const scope = {
    themeMixin: {}, appConfig: {},
    businessGroups: [{ key: 'service', items: Array.from({ length: entryCount }, (_, index) => ({ key: `entry-${index}` })) }],
    canOpenBusinessEntry: permission, loadAccessibleModuleGroups: modules,
    getUser: () => user, getToken: () => user.Id ? 'session-token' : '', removeToken() {},
    hasFeature: (name) => name === 'dynamicModules' && dynamic
  }
  const page = vm.runInNewContext(`${homeSource}; page`, scope)
  const ctx = page.data()
  for (const [name, method] of Object.entries(page.methods)) ctx[name] = method.bind(ctx)
  for (const name of ['homeMenuLoading', 'homeMenuError', 'visibleBusinessGroups']) {
    Object.defineProperty(ctx, name, { get: () => page.computed[name].call(ctx) })
  }
  ctx.isLoggedIn = true
  ctx.currentUser = user
  ctx.businessPermissionIdentity = user.Id
  return { ctx, show: () => page.onShow.call(ctx), setUser: (value) => { user = value } }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('首次权限加载保持骨架布局，完成后展示授权入口；后台刷新保留已有布局', async () => {
  const response = deferred()
  const { ctx } = loadingHome({ permission: () => response.promise })
  const pending = ctx.loadBusinessEntryVisibility()
  assert.equal(ctx.homeMenuLoading, true)
  assert.equal(ctx.visibleBusinessGroups.length, 0)
  response.resolve(true)
  await pending
  assert.equal(ctx.homeMenuLoading, false)
  assert.equal(ctx.visibleBusinessGroups[0].items.length, 9)
  const refresh = ctx.loadBusinessEntryVisibility(true)
  assert.equal(ctx.homeMenuLoading, false)
  await refresh
})

test('菜单树先预热，后续入口最多四个并发检查', async () => {
  let active = 0
  let peak = 0
  const calls = []
  const { ctx } = loadingHome({ permission: async (key, refresh) => {
    calls.push([key, refresh]); active++; peak = Math.max(peak, active)
    if (key !== 'entry-0') assert.equal(calls[0][0], 'entry-0')
    await new Promise(resolve => setImmediate(resolve))
    active--
    return key !== 'entry-4'
  } })
  await ctx.loadBusinessEntryVisibility(true)
  assert.equal(peak, 4)
  assert.equal(calls.length, 9)
  assert.equal(calls[0][1], true)
  assert.ok(calls.slice(1).every(([, refresh]) => refresh === false))
  assert.equal(ctx.businessEntryVisibility['entry-4'], false)
})

test('权限加载失败结束骨架并提供重试状态，确无权限与失败明确区分', async () => {
  const failed = loadingHome({ permission: async () => { throw new Error('网络错误') } }).ctx
  await failed.loadBusinessEntryVisibility()
  assert.equal(failed.homeMenuLoading, false)
  assert.equal(failed.visibleBusinessGroups.length, 0)
  assert.ok(failed.homeMenuError)
  const denied = loadingHome({ permission: async () => false }).ctx
  await denied.loadBusinessEntryVisibility()
  assert.equal(denied.homeMenuLoading, false)
  assert.equal(denied.homeMenuError, '')
})

test('退出登录后迟到的权限与动态模块响应不得填回首页', async () => {
  const permission = deferred(); const modules = deferred()
  const setup = loadingHome({ permission: () => permission.promise, modules: () => modules.promise, dynamic: true })
  const pending = Promise.all([setup.ctx.loadBusinessEntryVisibility(), setup.ctx.loadRuntimeModules()])
  setup.setUser({}); setup.show()
  permission.resolve(true); modules.resolve([{ key: 'old-account', items: [{ key: 'private' }] }])
  await pending
  assert.equal(setup.ctx.isLoggedIn, false)
  assert.deepEqual(Object.keys(setup.ctx.businessEntryVisibility), [])
  assert.equal(setup.ctx.runtimeBusinessGroups.length, 0)
  assert.equal(setup.ctx.businessPermissionsLoading, false)
})

test('切换账号清除上一账号菜单；动态首页同样等待其首批模块就绪', async () => {
  const modules = deferred()
  const setup = loadingHome({ modules: () => modules.promise, dynamic: true })
  setup.ctx.businessPermissionsReady = true
  setup.ctx.runtimeModulesReady = true
  setup.ctx.businessEntryVisibility = { 'entry-0': true }
  setup.ctx.runtimeBusinessGroups = [{ key: 'previous-account', items: [] }]
  setup.setUser({ Id: 'user-2' }); setup.show()
  assert.equal(setup.ctx.businessPermissionsReady, false)
  assert.equal(setup.ctx.runtimeBusinessGroups.length, 0)
  assert.equal(setup.ctx.homeMenuLoading, true)
  modules.resolve([])
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(setup.ctx.businessPermissionsReady, true)
  assert.equal(setup.ctx.runtimeModulesReady, true)
  assert.equal(setup.ctx.homeMenuLoading, false)
})
