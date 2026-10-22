import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const sandbox = { appConfig: { cdnAssets: {} }, orderListStatistics: JSON.parse(
  fs.readFileSync(new URL('../profiles/xjy/metadata/order-list-statistics.json', import.meta.url), 'utf8')) }
vm.runInNewContext(read('tenants/xjy/business.js')
  .replace(/^import .*\r?\n/gm, '').replace(/export default[^]*$/, '').replace(/export /g, ''), sandbox)
const getModule = key => sandbox.getBusinessModule(key)
function method(file, start, end, scope = {}) {
  const source = read(file), from = source.indexOf(start), to = source.indexOf(end, from)
  assert.ok(from >= 0 && to > from)
  return Object.values(vm.runInNewContext(`({${source.slice(from, to).trim().replace(/,$/, '')}})`, scope))[0]
}

for (const key of ['customers', 'cooperativeCustomers']) {
  test(`${key} opens the shared customer detail with the original record and authorized menu`, () => {
    const urls = [], forms = []
    const open = method('pages/business/list.vue', 'openDetail(row)', '    onMciListDetailReturned(', {
      openForm: form => forms.push(form)
    })
    open.call({ key, config: getModule(key), menuId: 'source-menu',
      mciNavigateToDetail: url => urls.push(url), mciMarkDetailReturn() {} }, { Id: 'customer/1' })
    assert.deepEqual(urls, ['/pages/business/detail?key=customers&id=customer%2F1&menuId=source-menu'])
    assert.deepEqual(forms, [])
  })
}

test('cooperative scope is exact and does not constrain the all-customer entry', () => {
  assert.deepEqual(plain(getModule('cooperativeCustomers').fixedWhere), [
    { Name: 'Zhuangtai', Type: '=', Value: '合作客户' }
  ])
  assert.deepEqual(plain(getModule('customers').fixedWhere || []), [])
})

test('search, pagination and clearing user filters keep the cooperative scope in the server payload', () => {
  const source = read('platform/business-runtime.js')
  const from = source.indexOf('export function buildModuleFilterPayload(')
  const to = source.indexOf('export async function loadModuleRows(', from)
  const scope = { buildPeriodRange: () => null }
  vm.runInNewContext(source.slice(from, to).replace('export ', ''), scope)
  for (const options of [{}, { keyword: '大学', pageIndex: 2 }, { status: '', extraWhere: [] },
    { status: '合作客户', extraWhere: [{ Name: 'FuzeR', Type: '=', Value: '负责人' }] }]) {
    const payload = scope.buildModuleFilterPayload(getModule('cooperativeCustomers'), options)
    assert.deepEqual(plain(payload._Where[0]), { Name: 'Zhuangtai', Type: '=', Value: '合作客户' })
  }
})

test('customer changes refresh the cooperative list through the same table event', () => {
  const shouldRefresh = method('pages/business/list.vue', 'shouldMciRefreshForDataChange(', '    async onMciListDataChanged(')
  const state = { config: getModule('cooperativeCustomers'), baseConfig: getModule('cooperativeCustomers') }
  assert.equal(shouldRefresh.call(state, { table: 'diy_kehu' }), true)
  assert.equal(shouldRefresh.call(state, { table: 'Diy_Dingdan' }), false)
})

test('shared customer detail rejects a revoked menu before reading customer data', async () => {
  let reads = 0
  const load = method('pages/business/detail.vue', 'async loadDetail(', '\t\t\tasync refresh()', {
    V8: { FormEngine: { GetFormData: () => { reads++; return {} } } }
  })
  const state = { key: 'customers', id: 'customer-1', menuId: '',
    loadViewManifest: async () => {}, $nextTick: () => {} }
  await load.call(state)
  assert.equal(reads, 0)
  assert.match(state.error, /没有客户表单查看权限/)
  assert.equal(state.loading, false)
})
