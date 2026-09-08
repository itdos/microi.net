import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const repairSource = read('src/pages/native/repair.vue')
const profileSource = read('src/pages/profile/index.vue')
const plain = (value) => JSON.parse(JSON.stringify(value))

// 运行真实页面方法，替换网络/导航边界；覆盖新旧入口与请求竞态，不创建真实售后任务。
function mount(source, overrides = {}) {
  const calls = []
  const device = { Id: 'device-1', ShebeiXH: 'F-150', ShebeiBH: 'BH-001', TenantId: 'tenant-1' }
  const customer = { LianxiR: '联系人', LianxiDH: '13800000000', Chengshi: '["浙江省","杭州市","西湖区"]', XiangxiDZ: '测试地址', KehuGLZH: 'customer-account' }
  const scope = {
    themeMixin: {},
    appConfig: { cdnAssets: {} },
    getMiniProgramUpdateState: () => ({}),
    hasFeature: () => true,
    requireLogin: () => true,
    getUser: () => ({ Id: 'user-1' }),
    getBusinessModule: () => ({ table: 'Diy_KehuSB', target: 'native-list', menuAliases: ['设备列表'] }),
    findMenu: async () => ({ Id: 'menu-device', ModuleEngineKey: 'device-module' }),
    loadModuleRows: async (config, options) => {
      calls.push({ type: 'rows', config, options })
      return { rows: [device], count: 1 }
    },
    V8: { FormEngine: { GetFormData: async (table, params) => {
      calls.push({ type: 'detail', table, params })
      return { Code: 1, Data: device }
    } } },
    callApiEngine: async (key, params) => {
      calls.push({ type: key, params })
      return { Code: 1, Data: key === 'repair_customer' ? customer : { TaskId: 'task-1' } }
    },
    post: async () => ({ Code: 1, Data: [{ Key: 'power', Value: '设备不通电' }] }),
    uni: { showToast: (data) => calls.push({ type: 'toast', ...data }), showLoading() {}, hideLoading() {}, redirectTo() {} },
    setTimeout: () => 1,
    clearTimeout() {},
    ...overrides
  }
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'const page =')
  const page = vm.runInNewContext(`${script}; page`, scope)
  const state = { ...page.data() }
  for (const [key, method] of Object.entries(page.methods)) state[key] = method.bind(state)
  for (const [key, getter] of Object.entries(page.computed || {})) Object.defineProperty(state, key, { get: () => getter.call(state), configurable: true })
  return { page, state, calls }
}

test('所有角色均显示我的页报修入口，其他快捷项保留原权限', () => {
  const { state } = mount(profileSource)
  state.isLoggedIn = true
  for (const role of ['isAdmin', 'isCustomer', 'isSales', 'isService', 'isSupport', 'unknown']) {
    Object.defineProperty(state, 'roleProfile', { value: { [role]: true }, configurable: true })
    assert.ok(state.visibleQuickItems.some((item) => item.key === 'afterSalesAdd'), role)
    if (role === 'unknown') assert.deepEqual(plain(state.visibleQuickItems.map((item) => item.key)), ['afterSalesAdd', 'scan'])
  }
})

test('直接入口忽略附带设备编号，首次必须手动选择且不查询空设备', async () => {
  const { page, state, calls } = mount(repairSource)
  page.onLoad.call(state, { entry: 'quick', deviceId: 'injected-id' })
  await state.loadData()
  assert.equal(state.directRepair, true)
  assert.equal(state.deviceId, '')
  assert.equal(state.error, '')
  assert.equal(state.validate(), '请选择设备型号')
  await state.submit()
  assert.equal(calls.filter((c) => ['detail', 'repair_customer', 'shenqing_shouhou'].includes(c.type)).length, 0)
})

test('设备详情原有两种 Id 参数保持设备栏与联系信息初始化', async () => {
  for (const key of ['deviceId', 'id']) {
    const { page, state } = mount(repairSource)
    page.onLoad.call(state, { [key]: 'device-1' })
    await state.loadData()
    assert.equal(state.directRepair, false)
    assert.equal(state.deviceId, 'device-1')
    assert.equal(state.form.contact, '联系人')
    assert.equal(state.form.address, '测试地址')
    assert.equal(state.repairTypes[0].name, '设备不通电')
  }
})

test('未授权时不查设备，列表为空时不默认选择', async () => {
  const denied = mount(repairSource, { findMenu: async () => null })
  await denied.state.loadDevices(true)
  assert.match(denied.state.deviceListError, /没有设备列表查看权限/)
  assert.equal(denied.calls.length, 0)
  const empty = mount(repairSource, { loadModuleRows: async () => ({ rows: [], count: 0 }) })
  await empty.state.loadDevices(true)
  assert.equal(empty.state.deviceId, '')
  assert.equal(empty.state.deviceListFinished, true)
})

test('选择设备后按授权菜单回读详情，提交关联对应设备和联系信息', async () => {
  const { state, calls } = mount(repairSource)
  state.directRepair = true
  await state.selectDevice({ Id: 'device-1' })
  assert.equal(state.deviceId, 'device-1')
  assert.equal(state.deviceLabel, 'F-150')
  assert.equal(state.form.contact, '联系人')
  assert.equal(calls.find((c) => c.type === 'detail').params._SysMenuId, 'menu-device')
  const rowCall = calls.find((c) => c.type === 'rows')
  assert.equal(rowCall.config.menuId, 'menu-device')
  assert.deepEqual(plain(rowCall.options.extraWhere), [['Id', '=', 'device-1']])
  state.form.types = ['设备不通电']
  await state.submit()
  const submission = calls.find((c) => c.type === 'shenqing_shouhou')
  assert.equal(submission.params.KehuSBID, 'device-1')
  assert.equal(submission.params.KehuLXR, '联系人')
  assert.equal(submission.params.KehuGLZH, 'customer-account')
  assert.equal(calls.filter((c) => c.type === 'rows').length, 2, '提交前必须重新验证设备权限')
})

test('选中设备后权限撤销时清空设备和联系信息，不提交售后任务', async () => {
  let allowed = true
  const { state, calls } = mount(repairSource, { findMenu: async () => allowed ? { Id: 'menu-device' } : null })
  state.directRepair = true
  await state.selectDevice({ Id: 'device-1' })
  state.form.types = ['设备不通电']
  allowed = false
  await state.submit()
  assert.equal(state.deviceId, '')
  assert.equal(state.form.contact, '')
  assert.ok(!calls.some((c) => c.type === 'shenqing_shouhou'))
})

test('失效设备与联系信息请求失败均不能保留旧设备或误提交', async () => {
  for (const overrides of [
    { loadModuleRows: async () => ({ rows: [], count: 0 }) },
    { callApiEngine: async () => { throw new Error('网络失败') } }
  ]) {
    const { state } = mount(repairSource, overrides)
    state.directRepair = true
    state.deviceId = 'old-device'
    state.form.contact = '旧联系人'
    await state.selectDevice({ Id: 'device-1' })
    assert.equal(state.deviceId, '')
    assert.equal(state.form.contact, '')
    assert.equal(state.deviceLoading, false)
    assert.equal(state.validate(), '请选择设备型号')
  }
})

test('分页加载失败重试同一页，搜索仅接受最后一次响应', async () => {
  let failed = false
  const pages = []
  const { state } = mount(repairSource, { loadModuleRows: async (config, options) => {
    pages.push(options.pageIndex)
    if (options.pageIndex === 2 && !failed) { failed = true; throw new Error('网络失败') }
    return { rows: Array.from({ length: options.pageIndex === 1 ? 20 : 1 }, (_, i) => ({ Id: `${options.pageIndex}-${i}` })), count: 21 }
  } })
  await state.loadDevices(true)
  await state.loadMoreDevices()
  await state.loadMoreDevices()
  assert.deepEqual(pages, [1, 2, 2])
  assert.equal(state.deviceRows.length, 21)
  assert.equal(state.deviceListFinished, true)
  const pending = []
  const racing = mount(repairSource, { loadModuleRows: (config, options) => new Promise((resolve) => pending.push({ options, resolve })) })
  racing.state.deviceKeyword = '旧型号'
  const oldRequest = racing.state.loadDevices(true)
  await new Promise(setImmediate)
  racing.state.deviceKeyword = '新型号'
  const newRequest = racing.state.loadDevices(true)
  await new Promise(setImmediate)
  pending[1].resolve({ rows: [{ Id: 'new' }], count: 1 })
  await newRequest
  pending[0].resolve({ rows: [{ Id: 'old' }], count: 1 })
  await oldRequest
  assert.ok(pending[1].options.extraWhere.every((condition) => condition.Value === '新型号'))
  assert.equal(racing.state.deviceRows[0].Id, 'new')
})

test('设备搜索支持仅安装位置命中，保留型号编号检索并可清空关键词', async () => {
  const rows = [
    { Id: 'device-location', ShebeiXH: 'FY-150', ShebeiBH: 'SB-001', ShangpinMC: '净水设备', AnzhuangWZ: '一楼大厅' },
    { Id: 'device-model', ShebeiXH: 'F-300', ShebeiBH: 'SB-002', AnzhuangWZ: '三楼茶水间' }
  ]
  const requests = []
  const { state } = mount(repairSource, { loadModuleRows: async (config, options) => {
    requests.push({ config, options })
    const conditions = options.extraWhere || []
    // 模拟服务端在当前授权设备集合中执行查询；防止搜索仍依赖默认菜单关键词。
    assert.ok(!options.keyword)
    const matches = rows.filter((row) => !conditions.length || conditions.some((c) => String(row[c.Name] || '').includes(c.Value)))
    return { rows: matches, count: matches.length }
  } })
  for (const [keyword, expectedId] of [['  一楼大厅  ', 'device-location'], ['F-300', 'device-model'], ['SB-001', 'device-location']]) {
    state.deviceKeyword = keyword
    await state.searchDevices()
    assert.deepEqual(plain(state.deviceRows.map((row) => row.Id)), [expectedId])
    const { config, options } = requests.at(-1)
    assert.equal(config.menuId, 'menu-device')
    assert.equal(options.pageIndex, 1)
    assert.equal(options.extraWhere[0].AndOr, 'AND')
    assert.equal(options.extraWhere[0].GroupStart, true)
    assert.ok(options.extraWhere.slice(1).every((c) => c.AndOr === 'OR'))
    assert.equal(options.extraWhere.at(-1).GroupEnd, true)
  }
  state.deviceKeyword = '不存在的位置'
  await state.searchDevices()
  assert.equal(state.deviceRows.length, 0)
  state.deviceKeyword = '   '
  await state.searchDevices()
  assert.equal(state.deviceRows.length, 2)
  assert.deepEqual(plain(requests.at(-1).options.extraWhere), [])
})
