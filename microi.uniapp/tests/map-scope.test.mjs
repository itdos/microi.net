import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as regions from '../src/platform/region-picker.mjs'
import * as scopes from '../src/tenants/xjy/map-scope.mjs'

const source = readFileSync(new URL('../src/pages/task/map.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[^\n]*\n/gm, '').replace('export default', 'globalThis.component =')
const plain = value => JSON.parse(JSON.stringify(value))

function mapPage(overrides = {}) {
  const queries = [], calls = [], toasts = []
  const context = {
    ...scopes, themeMixin: {}, MciRegionPicker: {},
    uni: { showToast: value => toasts.push(value), getLocation: options => {
      calls.push('location'); options.success({ latitude: 30.27, longitude: 120.15 })
    } },
    getBusinessModule: key => ({ table: 'Diy_Kehu', key, fixedWhere: key === 'cooperativeCustomers' ? [{ Name: 'Zhuangtai', Type: 'Like', Value: '合作' }] : [] }),
    findMenu: async (aliases, table, refresh, id) => id === 'denied' ? null : ({ Id: id || 'customers-menu' }),
    loadModuleRows: async (config, options) => { queries.push({ config, options }); return { rows: [{ Id: 'far-away', KehuDT_Lat: 39.9, KehuDT_Lng: 116.4 }], count: 1 } },
    loadTasks: async options => { queries.push(options); return { rows: [{ Id: 'task', KehuDT_Lat: 39.9, KehuDT_Lng: 116.4 }], count: 1 } },
    callApiEngine: async (key, params) => { queries.push({ key, params }); return { Code: 1, Data: [], DataAppend: { ScopeProtocol: 1, HasMore: false } } },
    ...overrides
  }
  vm.runInNewContext(script, context)
  const component = context.component
  const page = component.data()
  Object.assign(page, component.methods)
  for (const [key, getter] of Object.entries(component.computed)) Object.defineProperty(page, key, { get: () => getter.call(page) })
  page.withAuthorizedTaskCoordinateDefaults = async rows => ({ rows })
  page.withCustomerCoordinateDefaults = async rows => rows
  page.mode = 'customer'
  page.customerFilters = { fromList: true, menuId: 'cooperative-menu', moduleKey: 'cooperativeCustomers', keyword: '学校', extraWhere: [{ Name: 'FuzeRID', Type: '=', Value: 'owner' }] }
  return { page, queries, calls, toasts, component }
}

test('全国、全省、全市、区级均可独立选择，切上级清空下级', () => {
  let state = regions.createRegionPickerState([], [], true)
  assert.deepEqual(regions.regionPickerSelection(state), ['全部', '全部', '全部'])
  state = regions.createRegionPickerState(['浙江省', '杭州市', '滨江区'], [], true)
  state = regions.updateRegionPickerState(state, 1, 0)
  assert.deepEqual(regions.regionPickerSelection(state), ['浙江省', '全部', '全部'])
  state = regions.createRegionPickerState(['浙江省', '杭州市', '全部'], [], true)
  assert.deepEqual(regions.regionPickerSelection(state), ['浙江省', '杭州市', '全部'])
  state = regions.updateRegionPickerState(state, 0, 0)
  assert.deepEqual(regions.regionPickerSelection(state), ['全部', '全部', '全部'])
  assert.deepEqual(regions.regionPickerSelection(regions.createRegionPickerState(['北京市', '北京市', '东城区'], [], true)), ['北京市', '北京市', '东城区'])
})

test('全部只移除下级条件，半径保留15公里默认且扩至6000公里', () => {
  assert.deepEqual(scopes.mapRegionWhere(['全部', '全部', '全部']), [])
  assert.equal(scopes.mapRegionWhere(['浙江省', '全部', '全部']).length, 1)
  assert.deepEqual(scopes.mapRegionWhere(['浙江省', '杭州市', '全部']).map(x => x.Value), ['浙江省', '杭州市'])
  assert.equal(scopes.mapRegionWhere(['浙江省', '杭州市', '滨江区']).length, 3)
  const { page } = mapPage()
  assert.equal(page.radius, 15)
  assert.equal(scopes.MAP_RADIUS_OPTIONS[page.rangeMax], 6000)
})

test('地图范围边界经 JSON 传输后仍为数值，避免文本坐标按字典顺序比较', async () => {
  const { page } = mapPage()
  for (const radius of [15, 1000, 2000, 3000, 6000]) {
    page.radius = radius
    const scope = await page.resolveMapScope()
    const where = plain(scope.where)
    assert.equal(where.length, 4)
    for (const condition of where) {
      assert.equal(typeof condition.Value, 'number', `${radius}km 的 ${condition.Name} 必须绑定数值`)
      assert.ok(Number.isFinite(condition.Value))
    }
  }
})

test('数据库坐标保存为文本时，扩大到2000至6000公里不能丢掉原先范围内的客户', async () => {
  const customers = [
    { Id: 'nearby', KehuDT_Lat: '30.2741', KehuDT_Lng: '120.1551' },
    { Id: 'within-1000', KehuDT_Lat: '34.18451', KehuDT_Lng: '115.22851' },
    { Id: 'within-2000', KehuDT_Lat: '39.9042', KehuDT_Lng: '116.4074' }
  ]
  const { page } = mapPage({ loadModuleRows: async (config, options) => {
    // 真实数据库已确认：文本列与文本参数按字典顺序比较，与数值参数则按数值比较。
    // 保留文本坐标，不在夹具里预转 Number，以覆盖原先漏掉的数据库类型边界。
    const rows = customers.filter(row => options.extraWhere.every(condition => {
      if (!['KehuDT_Lat', 'KehuDT_Lng'].includes(condition.Name)) return true
      return condition.Type === '>=' ? row[condition.Name] >= condition.Value : row[condition.Name] <= condition.Value
    }))
    return { rows, count: rows.length }
  } })
  let previous = []
  for (const radius of [1000, 2000, 3000, 6000]) {
    page.radius = radius
    await page.loadFilteredCustomers()
    const ids = page.rows.map(row => row.Id)
    assert.ok(ids.includes('nearby'), `${radius}km 不应把附近客户排除`)
    assert.ok(ids.includes('within-1000'), `${radius}km 应保留1000公里内的客户`)
    for (const id of previous) assert.ok(ids.includes(id), `${radius}km 不应丢失 ${id}`)
    previous = ids
  }
  assert.equal(page.rows.length, 3)
})

test('合作客户地图沿用来源菜单、合作状态及列表条件，地区查询无需手机定位', async () => {
  const { page, queries, calls } = mapPage()
  page.mapRegion = ['北京市', '全部', '全部']
  await page.loadFilteredCustomers()
  assert.equal(calls.length, 0)
  assert.equal(queries[0].config.menuId, 'cooperative-menu')
  assert.equal(queries[0].config.fixedWhere[0].Value, '合作')
  assert.equal(queries[0].options.keyword, '学校')
  assert.deepEqual(plain(queries[0].options.extraWhere.map(x => x.Name)), ['FuzeRID', 'Chengshi'])
  assert.equal(page.rows[0].Id, 'far-away')
})

test('全国任务加载历史坐标并保留任务权限查询，不再按附近半径过滤', async () => {
  const { page, calls, queries } = mapPage()
  page.mode = 'task'; page.mapRegion = ['全部', '全部', '全部']
  await page.loadTaskMap()
  assert.equal(calls.length, 0)
  assert.equal(queries.length, 1)
  assert.deepEqual(plain(queries[0].extraWhere), [])
  assert.equal(page.rows.length, 1)
})

test('附近仍按定位和距离过滤，权限失败不回退到其它客户菜单', async () => {
  const { page, calls, queries, toasts } = mapPage()
  await page.loadFilteredCustomers()
  assert.equal(calls.length, 1)
  assert.equal(page.rows.length, 0)
  assert.ok(queries[0].options.extraWhere.some(x => x.Name === 'KehuDT_Lat'))
  page.mapRegion = ['全部', '全部', '全部']; page.customerFilters.menuId = 'denied'
  await page.loadFilteredCustomers()
  assert.equal(queries.length, 1)
  assert.match(toasts.at(-1).title, /无权/)
})

test('快速切换地区后旧结果不能覆盖新结果或结束新请求', async () => {
  const pending = []
  const { page } = mapPage({ loadModuleRows: () => new Promise(resolve => pending.push(resolve)) })
  page.mapRegion = ['浙江省', '全部', '全部']
  const old = page.loadFilteredCustomers()
  await new Promise(resolve => setImmediate(resolve))
  page.mapRegion = ['广东省', '全部', '全部']
  const latest = page.loadFilteredCustomers()
  await new Promise(resolve => setImmediate(resolve))
  pending[0]({ rows: [{ Id: 'old', KehuDT_Lat: 30, KehuDT_Lng: 120 }], count: 1 })
  await old
  assert.equal(page.rows.length, 0)
  assert.equal(page.loading, true)
  pending[1]({ rows: [{ Id: 'new', KehuDT_Lat: 23, KehuDT_Lng: 113 }], count: 1 })
  await latest
  assert.equal(page.rows[0].Id, 'new')
  assert.equal(page.loading, false)
})

test('设备行政区查询分批加载且拒绝不支持区域协议的旧接口', async () => {
  let count = 0
  const { page, queries, calls } = mapPage({ callApiEngine: async (key, params) => {
    queries.push({ key, params }); count++
    return { Code: 1, Data: [{ Id: String(count), KehuSB_Lat: 30, KehuSB_Lng: 120 }], DataAppend: { ScopeProtocol: 1, HasMore: count === 1 } }
  } })
  page.mode = 'device'; page.mapRegion = ['浙江省', '杭州市', '全部']
  await page.loadNearby()
  assert.equal(calls.length, 0)
  assert.equal(queries.length, 2)
  assert.equal(queries[1].params.PageIndex, 2)
  assert.equal(page.rows.length, 2)
  assert.deepEqual(JSON.parse(queries[0].params.Region), page.mapRegion)
  const old = mapPage({ callApiEngine: async () => ({ Code: 1, Data: [{ Id: 'wrong' }] }) })
  old.page.mode = 'device'; old.page.mapRegion = ['全部', '全部', '全部']
  await old.page.loadNearby()
  assert.match(old.toasts[0].title, /升级/)
  assert.equal(old.page.rows.length, 0)
})

test('客户详情进入的设备地图同样应用地区范围，按客户权限判断所属城市', async () => {
  const queries = []
  const { page, calls } = mapPage({ loadModuleRows: async (config, options) => {
    queries.push({ config, options })
    return config.ModuleEngineKey === 'Diy_Kehu'
      ? { rows: [{ Id: 'customer' }], count: 1 }
      : { rows: [{ Id: 'device', KehuSB_Lat: 39.9, KehuSB_Lng: 116.4 }], count: 1 }
  } })
  page.mode = 'device'; page.customerId = 'customer'; page.mapRegion = ['北京市', '全部', '全部']
  await page.loadCustomerDevices()
  assert.equal(calls.length, 0)
  assert.equal(queries[0].config.ModuleEngineKey, 'Diy_Kehu')
  assert.deepEqual(plain(queries[0].options.extraWhere.map(x => x.Value)), ['customer', '北京市'])
  assert.equal(queries[1].config.requireAuthorizedMenu, true)
  assert.equal(page.rows[0].Id, 'device')
})
