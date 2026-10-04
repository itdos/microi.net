import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import '../../../microi.uniapp/resources/xjy/customer-contract-totals/engine.test.mjs'
import {
  buildCustomerContractGroups,
  customerContractTotalsSupported,
  formatCustomerContractMoney,
  hydrateCustomerContractTotals,
  loadCustomerContractTotals
} from '../../../microi.uniapp/src/tenants/xjy/customer-contract-totals.mjs'

const complete = (value = 0) => ({
  Rental: { Current: value, All: value + 100 },
  Buyout: { All: value + 200 },
  AnnualFilter: { Current: value + 300, All: value + 400 }
})
const response = (customers, extra = {}) => ({ Code: 1, Data: { Customers: customers, ...extra } })

test('租赁、买断、包年换芯分别展示，当前有效期与所有合同不混为一项', () => {
  const groups = buildCustomerContractGroups({ status: 'ready', values: complete(10) })
  assert.deepEqual(groups.map(group => group.title), ['租赁总价', '买断总价', '包年换芯总价'])
  assert.deepEqual(groups.map(group => group.items.map(item => [item.label, item.value])), [
    [['当前有效合同期内', '¥10.00'], ['所有合同', '¥110.00']],
    [['所有合同', '¥210.00']],
    [['当前有效合同期内', '¥310.00'], ['所有合同', '¥410.00']]
  ])
})

test('有效零金额、缺失值与无效金额必须区分', () => {
  assert.equal(formatCustomerContractMoney(0), '¥0.00')
  assert.equal(formatCustomerContractMoney('1234567.89'), '¥1,234,567.89')
  assert.equal(formatCustomerContractMoney(-3.25), '¥-3.25')
  for (const value of [null, undefined, '', ' ', true, false, [], {}, 'NaN', Infinity]) {
    assert.equal(formatCustomerContractMoney(value), '未获取')
  }
})

test('同页多个客户只请求一次，去重Id并携带当前客户菜单上下文', async () => {
  const calls = []
  const totals = await loadCustomerContractTotals({
    customerIds: [' a ', 'b', 'a'], customerMenuId: 'customer-menu',
    run: async (...args) => { calls.push(args); return response({ a: complete(), b: complete(2) }, { AsOf: '2026-10-02' }) }
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'xjy-customer-contract-totals')
  assert.deepEqual(calls[0][1], { CustomerIds: ['a', 'b'], CustomerSysMenuId: 'customer-menu' })
  assert.equal(totals.a.status, 'ready')
  assert.equal(totals.b.values.Rental.Current, 2)
  assert.equal(totals.a.asOf, '2026-10-02')
})

test('空列表不查询；超量Id与无菜单不发出请求', async () => {
  let calls = 0
  const run = async () => { calls++; return response({}) }
  assert.deepEqual(await loadCustomerContractTotals({ customerIds: [], run }), {})
  await assert.rejects(() => loadCustomerContractTotals({ customerIds: ['a'], run }), /客户菜单/)
  await assert.rejects(() => loadCustomerContractTotals({ customerIds: Array.from({ length: 51 }, (_, i) => String(i)), customerMenuId: 'm', run }), /50/)
  assert.equal(calls, 0)
})

test('服务器失败与客户缺失均不能伪装成零金额', async () => {
  const rows = [{ Id: 'a', KehuMC: '客户A' }, { Id: 'b', KehuMC: '客户B' }]
  const failed = await hydrateCustomerContractTotals(rows, {
    table: 'Diy_Kehu', customerMenuId: 'm', run: async () => ({ Code: 0, Msg: '当前账号没有合同查看权限' })
  })
  assert.equal(failed[0].__xjyContractTotals.status, 'unavailable')
  assert.match(failed[0].__xjyContractTotals.message, /权限/)
  assert.ok(buildCustomerContractGroups(failed[0].__xjyContractTotals).every(group => group.items.every(item => item.value === '未获取')))
  const missing = await hydrateCustomerContractTotals(rows, {
    table: 'Diy_Kehu', customerMenuId: 'm', run: async () => response({ a: complete() })
  })
  assert.equal(missing[0].__xjyContractTotals.status, 'ready')
  assert.equal(missing[1].__xjyContractTotals.status, 'unavailable')
  assert.ok(!Object.prototype.hasOwnProperty.call(rows[0], '__xjyContractTotals'), '不得污染SDK或列表缓存中的原行')
})

test('网络错误、响应缺契约与部分金额缺失保留真实失败而非假0', async () => {
  const runRows = run => hydrateCustomerContractTotals([{ Id: 'a' }], { table: 'Diy_Kehu', customerMenuId: 'm', run })
  const network = await runRows(async () => { throw new Error('request:fail timeout') })
  assert.match(network[0].__xjyContractTotals.message, /timeout/)
  const malformed = await runRows(async () => ({ Code: 1, Data: {} }))
  assert.equal(malformed[0].__xjyContractTotals.status, 'unavailable')
  const partial = await runRows(async () => response({ a: { Rental: { Current: 0, All: 0 }, Buyout: { All: null }, AnnualFilter: { Current: 0, All: 0 } } }))
  assert.equal(partial[0].__xjyContractTotals.status, 'partial')
  assert.equal(buildCustomerContractGroups(partial[0].__xjyContractTotals)[1].items[0].value, '未获取')
  assert.equal(buildCustomerContractGroups(partial[0].__xjyContractTotals)[0].items[0].value, '¥0.00')
})

test('客户合作列表与我的客户同表均支持，其它业务不调用金额接口', async () => {
  assert.equal(customerContractTotalsSupported('DIY_KEHU'), true)
  assert.equal(customerContractTotalsSupported('Diy_Dingdan'), false)
  const rows = [{ Id: 'a' }]
  const unchanged = await hydrateCustomerContractTotals(rows, { table: 'Diy_Dingdan', run: () => { throw new Error('不得调用') } })
  assert.equal(unchanged, rows)
})

test('只保留请求中的客户，特殊对象键不会修改原型', async () => {
  const customers = JSON.parse('{"__proto__":{"Rental":{"Current":0,"All":0},"Buyout":{"All":0},"AnnualFilter":{"Current":0,"All":0}},"unrequested":{"Rental":{"Current":5,"All":5}}}')
  const totals = await loadCustomerContractTotals({ customerIds: ['__proto__'], customerMenuId: 'm', run: async () => response(customers) })
  assert.equal(Object.getPrototypeOf(totals), Object.prototype)
  assert.equal(totals.__proto__.status, 'ready')
  assert.equal(Object.prototype.status, undefined)
  assert.equal(Object.prototype.hasOwnProperty.call(totals, 'unrequested'), false)
})

test('列表和详情必须接入同一金额模块，列表提交迟到响应前复核请求代次', () => {
  const list = fs.readFileSync(new URL('../../../microi.uniapp/src/pages/business/list.vue', import.meta.url), 'utf8')
  const detail = fs.readFileSync(new URL('../../../microi.uniapp/src/pages/business/detail.vue', import.meta.url), 'utf8')
  assert.match(list, /hydrateCustomerContractTotals\(incomingRows,[\s\S]*?customerMenuId: this\.menuId[\s\S]*?if \(requestId !== this\.loadRequestId\) return[\s\S]*?this\.rows =/)
  assert.match(detail, /loadCustomerContractTotals\([\s\S]*?customerMenuId: this\.menuId/)
  assert.match(list, /<xjy-customer-contract-totals[\s\S]*?:state="row\.__xjyContractTotals"/)
  assert.match(detail, /<xjy-customer-contract-totals[\s\S]*?:state="customerContractTotals"/)
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function pageMethod(page, name, nextName, dependencies) {
  const source = fs.readFileSync(new URL(`../../../microi.uniapp/src/pages/business/${page}.vue`, import.meta.url), 'utf8')
  const start = source.indexOf(`async ${name}(`)
  const next = source.indexOf(`${nextName}(`, start + 1)
  assert.ok(start >= 0 && next > start)
  const method = source.slice(start, next).replace(/,\s*$/, '')
  return vm.runInNewContext(`({${method}}).${name}`, dependencies)
}

test('列表金额请求延迟期间保持加载态，新搜索完成后旧金额响应不能覆盖新客户', async () => {
  const oldAmount = deferred()
  const reached = deferred()
  let rowCalls = 0
  const loadData = pageMethod('list', 'loadData', 'search', {
    loadModuleRows: async () => ({ rows: [{ Id: ++rowCalls === 1 ? 'old' : 'new' }], count: 1, append: {} }),
    hydrateCustomerContractTotals,
    loadModulePeriodCounts: async () => ({}),
    V8: { ApiEngine: { Run: async (key, params) => {
      if (params.CustomerIds[0] === 'old') { reached.resolve(); return oldAmount.promise }
      return response({ new: complete(20) })
    } } },
    uni: { showToast() {} }
  })
  const page = {
    key: 'customers', menuId: 'm', config: { table: 'Diy_Kehu', pageSize: 15 },
    rows: [], metadataError: '', loading: false, error: '', finished: false, loadRequestId: 0,
    buildCurrentListOptions: () => ({}), loadPlatformStatistics() {}
  }
  const older = loadData.call(page, true, true)
  await reached.promise
  assert.equal(page.loading, true)
  assert.equal(page.rows.length, 0)
  await loadData.call(page, true, true)
  assert.equal(page.rows[0].Id, 'new')
  assert.equal(page.rows[0].__xjyContractTotals.values.Rental.Current, 20)
  oldAmount.resolve(response({ old: complete(800) }))
  await older
  assert.equal(page.rows[0].Id, 'new')
  assert.equal(page.loading, false)
})

test('详情金额的迟到成功和失败均不能覆盖最后一次重试或切换后的客户', async () => {
  const gates = [deferred(), deferred(), deferred()]
  let calls = 0
  const loadAmounts = pageMethod('detail', 'loadCustomerContractAmounts', 'async loadCustomerRelationMetrics', {
    loadCustomerContractTotals,
    V8: { ApiEngine: { Run: () => gates[calls++].promise } }
  })
  const page = {
    showCustomerContractTotals: true, customerContractTotalsRequestId: 0,
    detail: { Id: 'a' }, id: 'a', menuId: 'm', customerContractTotals: {}
  }
  const old = loadAmounts.call(page)
  const current = loadAmounts.call(page)
  assert.equal(page.customerContractTotals.status, 'loading')
  gates[1].resolve(response({ a: complete(25) }))
  await current
  gates[0].reject(new Error('旧请求失败'))
  await old
  assert.equal(page.customerContractTotals.status, 'ready')
  assert.equal(page.customerContractTotals.values.Rental.Current, 25)
  const pending = loadAmounts.call(page)
  page.detail = { Id: 'b' }
  page.id = 'b'
  page.customerContractTotals = { status: 'loading' }
  gates[2].resolve(response({ a: complete(900) }))
  await pending
  assert.equal(page.customerContractTotals.status, 'loading')
})
