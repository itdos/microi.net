import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const source = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8')
const makeOrder = (Id, KehuID = 'c1', extra = {}) => ({ Id, KehuID, IsDeleted: 0, DingdanZT: '已审批', HetongZT: '未断约', HetongKSSJ: '2026-10-02', HetongJSSJ: '2026-10-02', ...extra })
const makeProduct = (Id, DingdanID, HezuoFS, Zongjia = 0, LvxinZJ = 0, extra = {}) => ({ Id, DingdanID, HezuoFS, HezuoFSZ: '', Zongjia, LvxinZJ, Shuliang: 7, IsDeleted: 0, ...extra })

// 执行引擎实际SQL，而非在JavaScript替身里重新实现分类/聚合公式。
const sqlite = `import json,sqlite3,sys
p=json.load(sys.stdin)
c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row
c.executescript('CREATE TABLE Diy_Dingdan(Id TEXT,KehuID TEXT,IsDeleted INT,DingdanZT TEXT,HetongZT TEXT,HetongKSSJ TEXT,HetongJSSJ TEXT);CREATE TABLE Diy_DingdanSP(Id TEXT,DingdanID TEXT,HezuoFS TEXT,HezuoFSZ TEXT,Zongjia NUMERIC,LvxinZJ NUMERIC,Shuliang INT,IsDeleted INT);')
for table,rows in [('Diy_Dingdan',p['orders']),('Diy_DingdanSP',p['products'])]:
 cols=[r['name'] for r in c.execute('PRAGMA table_info('+table+')')]
 for row in rows:c.execute('INSERT INTO '+table+'('+','.join(cols)+') VALUES('+','.join(['?']*len(cols))+')',[row.get(k) for k in cols])
assert p['sql'].lstrip().upper().startswith('SELECT ')
rows=c.execute(p['sql'],{k.lstrip('@'):v for k,v in p['bindings'].items()}).fetchall()
print(json.dumps([dict(r) for r in rows],ensure_ascii=False))`

function fixture() {
  const orders = [makeOrder('rent'), makeOrder('expired', 'c1', { DingdanZT: '已到期' }), makeOrder('ended', 'c1', { HetongZT: '已断约' }),
    makeOrder('future', 'c1', { HetongKSSJ: '2027-01-01', HetongJSSJ: '2027-12-31' }), makeOrder('buy'), makeOrder('combo'), makeOrder('annual'),
    makeOrder('annual-expired', 'c1', { DingdanZT: '已到期' }), makeOrder('gift'), makeOrder('trial'), makeOrder('c2-rent', 'c2'),
    makeOrder('pending', 'c1', { DingdanZT: '待审批' }), makeOrder('void', 'c1', { DingdanZT: '已作废' }), makeOrder('deleted', 'c1', { IsDeleted: 1 }), makeOrder('hidden')]
  const products = [makeProduct('p1', 'rent', '租赁', 100), makeProduct('p2', 'expired', '租赁', 40), makeProduct('p3', 'ended', '租赁', 60),
    makeProduct('p4', 'future', '租赁', 900), makeProduct('p5', 'buy', '买断', 200), makeProduct('p6', 'combo', '买断+包年换芯', 500, 30),
    makeProduct('p7', 'annual', '包年换芯', 9999, 70), makeProduct('p8', 'annual-expired', '包年换芯', 9999, 25),
    makeProduct('p9', 'gift', '赠送', 99999, 8888), makeProduct('p10', 'trial', '试机', 99999, 8888), makeProduct('p11', 'c2-rent', '租赁', 20),
    ...['pending', 'void', 'deleted', 'hidden'].map((id, i) => makeProduct('excluded' + i, id, '租赁', 100000)),
    makeProduct('deleted-product', 'rent', '租赁', 50000, 0, { IsDeleted: 1 })]
  return { customers: ['c1', 'c2'], orders, products }
}

function run(options = {}) {
  const data = options.data || fixture()
  const requests = []
  const queries = []
  const ids = options.ids || ['c1', 'c2']
  const http = request => {
    const body = JSON.parse(request.PostParamString)
    requests.push({ ...request, body })
    assert.equal(request.Url, 'https://api.jifulii.com/api/FormEngine/GetTableData')
    assert.equal(request.Headers.Authorization, 'Bearer fixture-session')
    assert.equal(request.Headers.osclient, 'xjy')
    assert.equal(body._IsTree, false)
    assert.deepEqual(body._SelectFields, ['Id'])
    assert.equal(body._TrustedServerInvocation, undefined)
    let visible = body.FormEngineKey === 'Diy_Kehu'
      ? data.customers.filter(id => body._Where[0][2].includes(id)).map(Id => ({ Id }))
      : data.orders.filter(row => body._Where[0][2].includes(row.KehuID) && row.IsDeleted !== 1 && ['已审批', '已到期'].includes(row.DingdanZT) && row.Id !== 'hidden').map(row => ({ Id: row.Id }))
    visible.sort((a, b) => a.Id.localeCompare(b.Id))
    const result = { Code: 1, DataCount: visible.length, Data: visible.slice((body._PageIndex - 1) * body._PageSize, body._PageIndex * body._PageSize) }
    const response = { StatusCode: 200, ErrorMessage: '', Content: JSON.stringify(result) }
    return options.http ? options.http({ request, body, result, response, index: requests.length }) : response
  }
  const V8 = {
    Param: { CustomerIds: ids, CustomerSysMenuId: options.menu === undefined ? 'customer-menu' : options.menu, Token: 'forged-parameter', ApiBase: 'https://evil.invalid', ...options.param },
    OsClient: options.osClient || 'xjy', CurrentUser: { Id: 'user-1' },
    Method: { GetCurrentToken: () => options.session === undefined ? { CurrentUser: { Id: 'user-1' }, OsClient: 'xjy', Token: 'fixture-session' } : options.session },
    Http: { PostResponse: http },
    FormEngine: new Proxy({}, { get() { throw new Error('禁止trusted表单调用或业务写入') } }),
    Db: { FromSql(sql) {
      const bindings = {}
      const query = { AddInParameter(name, value) { assert.ok(!(name in bindings)); bindings[name] = value; return query }, ToArray() {
        queries.push({ sql, bindings })
        if (options.dbFail) throw new Error('数据库不可用')
        const result = spawnSync('python3', ['-c', sqlite], { input: JSON.stringify({ sql, bindings, ...data }), encoding: 'utf8' })
        if (result.status !== 0) throw new Error(result.stderr)
        const rows = JSON.parse(result.stdout)
        return options.rows ? options.rows(rows, queries.length) : rows
      } }
      return query
    } }
  }
  const result = vm.runInNewContext(`(function(){${source}\n})()`, { V8, DateNow: () => '2026-10-02' })
  return { result: JSON.parse(JSON.stringify(result)), requests, queries }
}

test('真实SQL分别汇总五金额，结束日有效，组合合同拆分，已到期/已断约只计全部', () => {
  const { result, requests, queries } = run()
  assert.equal(result.Code, 1, result.Msg)
  assert.deepEqual(result.Data.Customers.c1, { Rental: { Current: '100.00', All: '1100.00' }, Buyout: { All: '700.00' }, AnnualFilter: { Current: '100.00', All: '125.00' } })
  assert.deepEqual(result.Data.Customers.c2, { Rental: { Current: '20.00', All: '20.00' }, Buyout: { All: '0.00' }, AnnualFilter: { Current: '0.00', All: '0.00' } })
  assert.equal(requests.length, 2)
  assert.equal(queries.length, 2)
  assert.match(result.Data.Scope, /已到期/)
  assert.match(result.Data.CurrentDefinition, /合同开始日期≤今天≤合同结束日期/)
})

test('标签优先，空标签兼容真实字典3包年、4买断+换芯，价格已含数量不再乘7', () => {
  const data = { customers: ['c1'], orders: [makeOrder('a'), makeOrder('b'), makeOrder('c')], products: [
    makeProduct('a', 'a', '', 1000, 17, { HezuoFSZ: '3' }), makeProduct('b', 'b', '', 41, 9, { HezuoFSZ: '4' }), makeProduct('c', 'c', '租赁', 3.25, 0, { HezuoFSZ: '1' })] }
  const { result } = run({ data, ids: ['c1'] })
  assert.equal(result.Code, 1, result.Msg)
  assert.equal(result.Data.Customers.c1.Rental.Current, '3.25')
  assert.equal(result.Data.Customers.c1.Buyout.All, '41.00')
  assert.equal(result.Data.Customers.c1.AnnualFilter.All, '26.00')
})

test('缺失/非法/未来合同日期不计当前，服务日期不能覆盖合同日期', () => {
  const data = { customers: ['c1'], orders: [makeOrder('a', 'c1', { HetongKSSJ: '', HetongJSSJ: '' }), makeOrder('b', 'c1', { HetongJSSJ: '2026-02-30', FuwuJSSJ: '2027-10-01' })], products: [makeProduct('a', 'a', '租赁', 40), makeProduct('b', 'b', '租赁', 60)] }
  const { result } = run({ data, ids: ['c1'] })
  assert.equal(result.Code, 1, result.Msg)
  assert.equal(result.Data.Customers.c1.Rental.Current, '0.00')
  assert.equal(result.Data.Customers.c1.Rental.All, '100.00')
})

test('没有授权订单是真实零金额，50客户仍只发2个授权查询，无N+1', () => {
  const customers = Array.from({ length: 50 }, (_, i) => 'c' + i)
  const { result, requests, queries } = run({ ids: customers, data: { customers, orders: [], products: [] } })
  assert.equal(result.Code, 1, result.Msg)
  assert.equal(Object.keys(result.Data.Customers).length, 50)
  assert.equal(requests.length, 2)
  assert.equal(queries.length, 0)
})

test('1001订单跨页完整查询，聚合覆盖全部而非第一页', () => {
  const orders = Array.from({ length: 1001 }, (_, i) => makeOrder('o' + String(i).padStart(4, '0')))
  const data = { customers: ['c1'], orders, products: orders.map(row => makeProduct('p' + row.Id, row.Id, '租赁', 1)) }
  const { result, requests, queries } = run({ ids: ['c1'], data })
  assert.equal(result.Code, 1, result.Msg)
  assert.equal(result.Data.Customers.c1.Rental.All, '1001.00')
  assert.equal(requests.length, 3)
  assert.equal(queries.length, 2)
})

test('客户菜单/订单权限拒绝及客户范围缺失必须失败且不读取金额SQL', () => {
  for (const deny of ['Diy_Kehu', 'Diy_Dingdan']) {
    const { result, queries } = run({ http: ({ body, response }) => body.FormEngineKey === deny ? { ...response, Content: JSON.stringify({ Code: 0, Msg: '权限不足' }) } : response })
    assert.equal(result.Code, 0)
    assert.match(result.Msg, /权限/)
    assert.equal(result.Data, undefined)
    assert.equal(queries.length, 0)
  }
  assert.equal(run({ ids: ['c1', 'missing'] }).result.Code, 0)
})

test('没有可信会话、伪造参数身份/服务器地址、错误租户与超量请求均不能越权', () => {
  for (const options of [{ session: null }, { session: { CurrentUser: { Id: 'another' }, Token: 'fixture-session', OsClient: 'xjy' } }, { osClient: 'other' }, { menu: '' }, { ids: Array(51).fill('c1') }, { ids: 'c1' }]) {
    const { result, requests, queries } = run(options)
    assert.equal(result.Code, 0)
    assert.equal(requests.length, 0)
    assert.equal(queries.length, 0)
  }
  assert.equal(run({ param: { CurrentUser: { Id: 'admin' }, OsClient: 'other' } }).result.Code, 1)
})

test('Id值只作为SQL参数绑定，特殊字符不会扩大授权范围', () => {
  const id = "c') OR 1=1 --"
  const orderId = "o') OR 1=1 --"
  const data = { customers: [id], orders: [makeOrder(orderId, id), makeOrder('hidden')], products: [makeProduct('a', orderId, '租赁', 2), makeProduct('b', 'hidden', '租赁', 999)] }
  const { result, queries } = run({ ids: [id], data })
  assert.equal(result.Code, 1, result.Msg)
  assert.equal(result.Data.Customers[id].Rental.All, '2.00')
  assert.ok(queries.every(query => !query.sql.includes(id) && !query.sql.includes(orderId)))
  assert.ok(queries.every(query => Object.values(query.bindings).includes(orderId)))
})

test('HTTP失败、无状态码、非JSON与缺总数不能伪装成零', () => {
  for (const change of [() => ({ StatusCode: 503, Content: '{}' }), ({ response }) => ({ ...response, StatusCode: undefined }), () => ({ StatusCode: 200, Content: '<html>error</html>' }), ({ response, result }) => ({ ...response, Content: JSON.stringify({ ...result, DataCount: undefined }) })]) {
    const { result, queries } = run({ http: change })
    assert.equal(result.Code, 0)
    assert.equal(result.Data, undefined)
    assert.equal(queries.length, 0)
  }
})

test('截断、重复Id、上限超出与页间总数变化全部拒绝', () => {
  for (const change of [({ response, result }) => ({ ...response, Content: JSON.stringify({ ...result, Data: [] }) }), ({ response, result }) => ({ ...response, Content: JSON.stringify({ ...result, Data: [{ Id: 'c1' }, { Id: 'c1' }] }) }), ({ response, body, result }) => body.FormEngineKey === 'Diy_Dingdan' ? { ...response, Content: JSON.stringify({ ...result, DataCount: 5001 }) } : response]) {
    assert.equal(run({ http: change }).result.Code, 0)
  }
  const orders = Array.from({ length: 1001 }, (_, i) => makeOrder('o' + i))
  const { result } = run({ ids: ['c1'], data: { customers: ['c1'], orders, products: [] }, http: ({ response, body, result }) => body._PageIndex === 2 ? { ...response, Content: JSON.stringify({ ...result, DataCount: 1000 }) } : response })
  assert.equal(result.Code, 0)
})

test('数据库错误、合同元数据截断、未知合作方式和缺价格均明确失败', () => {
  assert.equal(run({ dbFail: true }).result.Code, 0)
  assert.equal(run({ rows: (rows, index) => index === 1 ? rows.slice(1) : rows }).result.Code, 0)
  for (const product of [makeProduct('a', 'a', '未知', 10), makeProduct('a', 'a', '租赁', null)]) {
    const { result } = run({ ids: ['c1'], data: { customers: ['c1'], orders: [makeOrder('a')], products: [product] } })
    assert.equal(result.Code, 0)
    assert.equal(result.Data, undefined)
  }
})

test('Manifest声明唯一Managed接口，内联正文及版本与唯一可编辑engine源码一致', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.engines.length, 1)
  assert.equal(manifest.ResourcePolicies.ApiEngines['xjy-customer-contract-totals'], 'Managed')
  assert.equal(manifest.engines[0].code, source)
  assert.equal(manifest.engines[0].allowAnonymous, false)
  assert.equal(manifest.engines[0].version, source.match(/Version: (v\d+\.\d+\.\d+)/)[1])
})
