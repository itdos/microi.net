import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { loadCustomerListSummary } from '../src/tenants/xjy/customer-list-summary.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'src/tenants/xjy/api-engines/xjy-customer-contract-totals.js'), 'utf8')
const customers = [{ Id: 'c1', Zhuangtai: '合作客户' }, { Id: 'c2', Zhuangtai: '目标客户' }]
const orders = [
  { Id: 'o1', KehuID: 'c1', DingdanZT: '已审批', HetongZT: '未断约', HetongKSSJ: '2026-10-14', HetongJSSJ: '2026-10-14' },
  { Id: 'o2', KehuID: 'c1', DingdanZT: '已到期', HetongZT: '未断约', HetongKSSJ: '2025-01-01', HetongJSSJ: '2025-12-31' },
  { Id: 'o3', KehuID: 'c2', DingdanZT: '已审批', HetongZT: '已断约', HetongKSSJ: '2026-01-01', HetongJSSJ: '2027-01-01' }
]

function execute(params, options = {}) {
  const requests = [], sqlCalls = []
  const visible = options.customers || customers
  const V8 = { Param: params, OsClient: options.osClient || 'xjy', CurrentUser: options.anonymous ? null : { Id: 'user1' },
    Method: { GetCurrentToken: () => ({ CurrentUser: { Id: 'user1' }, OsClient: 'xjy', Token: 'test-session' }) },
    Http: { PostResponse: request => {
      const body = JSON.parse(request.PostParamString)
      requests.push(body)
      if (options.denied || body._SysMenuId && body._SysMenuId !== 'customer-menu') return { StatusCode: 200, Content: JSON.stringify({ Code: 0, Msg: '无权限' }) }
      let rows = visible
      if (body.FormEngineKey === 'Diy_Dingdan') {
        const ids = body._Where[0][2]
        rows = orders.filter(order => ids.includes(order.KehuID))
      } else if (body._Where?.[0]?.[0] === 'Id') rows = visible.filter(row => body._Where[0][2].includes(row.Id))
      const start = (body._PageIndex - 1) * body._PageSize
      return { StatusCode: 200, Content: JSON.stringify({ Code: 1, Data: options.truncated ? [] : rows.slice(start, start + body._PageSize), DataCount: options.count ?? rows.length }) }
    } },
    Db: { FromSql: sql => {
      const bindings = {}
      const query = { AddInParameter: (name, value) => { bindings[name] = value; return query }, ToArray: () => {
        sqlCalls.push({ sql, bindings })
        if (options.query) return options.query(sql, bindings)
        const selected = orders.filter(order => Object.values(bindings).includes(order.Id))
        if (sql.startsWith('SELECT o.Id')) return selected
        const currentMatch = sql.match(/x\.DingdanID IN \(([^)]+)\)/)
        const current = currentMatch ? currentMatch[1].split(',').map(name => bindings[name]) : []
        const ids = [...new Set(selected.map(order => order.KehuID))]
        return ids.map(id => ({ KehuID: id,
          RentalAll: id === 'c1' ? '300.30' : '50.00', RentalCurrent: current.includes('o1') && id === 'c1' ? '100.10' : '0.00',
          BuyoutAll: id === 'c1' ? '200.20' : '20.00', AnnualAll: id === 'c1' ? '30.03' : '5.00',
          AnnualCurrent: current.includes('o1') && id === 'c1' ? '10.01' : '0.00', UnknownCount: options.unknown ? 1 : 0, MissingAmountCount: 0 }))
      } }
      return query
    } }
  }
  const context = vm.createContext({ V8, DateNow: () => '2026-10-14' })
  const result = vm.runInContext(`(function(){${source}\n})()`, context)
  return { result: JSON.parse(JSON.stringify(result)), requests, sqlCalls }
}

test('默认有效期金额、历史买断和零状态，不依赖客户当前页', () => {
  const { result, requests, sqlCalls } = execute({ Summary: true, SysMenuId: 'customer-menu', Filters: {} })
  assert.equal(result.Code, 1)
  assert.deepEqual(result.Data.Metrics, { rental: '100.10', buyout: '220.20', annualFilter: '10.01' })
  assert.deepEqual(result.Data.StatusCounts, { All: 2, 合作客户: 1, 目标客户: 1 })
  assert.equal(requests.length, 2)
  assert.equal(sqlCalls.length, 2)
  assert.equal(result.Data.ValidOnly, true)
})

test('关闭有效期包含过期与断约合同，买断保持累计', () => {
  const { result } = execute({ Summary: true, SysMenuId: 'customer-menu', Filters: { ValidOnly: false } })
  assert.deepEqual(result.Data.Metrics, { rental: '350.30', buyout: '220.20', annualFilter: '35.03' })
})

test('状态切换影响金额，角标保留全部状态，关键词/日期/高级筛选经过普通授权查询', () => {
  const filters = { SelectedStatus: '目标客户', _Keyword: '学校', _SearchDateTime: { CreateTime: ['2026-01-01', '2026-12-31'] }, _Where: [{ Name: 'FuzeRID', Type: '=', Value: 'user1' }] }
  const { result, requests } = execute({ Summary: true, SysMenuId: 'customer-menu', Filters: filters })
  assert.equal(result.Data.Metrics.buyout, '20.00')
  assert.equal(result.Data.StatusCounts.All, 2)
  assert.deepEqual(requests[0]._Where, filters._Where)
  assert.equal(requests[0]._Keyword, '学校')
  assert.deepEqual(requests[0]._SearchDateTime, filters._SearchDateTime)
  assert.deepEqual(requests[1]._Where[0][2], ['c2'])
})

test('原客户卡片50条协议与金额返回结构保持兼容', () => {
  const { result } = execute({ CustomerIds: ['c1'], CustomerSysMenuId: 'customer-menu' })
  assert.equal(result.Code, 1)
  assert.equal(result.Data.Customers.c1.Rental.Current, '100.10')
  assert.equal(result.Data.Customers.c1.Buyout.All, '200.20')
})

test('空列表是真实零；授权失败、非法菜单、截断和超限失败关闭', () => {
  assert.deepEqual(execute({ Summary: true, SysMenuId: 'customer-menu' }, { customers: [] }).result.Data.Metrics, { rental: '0.00', buyout: '0.00', annualFilter: '0.00' })
  for (const options of [{ denied: true }, { anonymous: true }, { osClient: 'other' }, { truncated: true }, { count: 10001 }]) {
    assert.equal(execute({ Summary: true, SysMenuId: 'customer-menu' }, options).result.Code, 0)
  }
  assert.equal(execute({ Summary: true, SysMenuId: 'another-menu' }).result.Code, 0)
})

test('历史未知商品影响买断指标，不阻断状态和有效期内租赁/换芯，也不返回伪零', () => {
  const { result } = execute({ Summary: true, SysMenuId: 'customer-menu', Filters: {} }, { unknown: true })
  assert.equal(result.Data.Metrics.buyout, null)
  assert.equal(result.Data.Metrics.rental, '100.10')
  assert.equal(result.Data.StatusCounts.All, 2)
  assert.equal(execute({ CustomerIds: ['c1'], CustomerSysMenuId: 'customer-menu' }, { unknown: true }).result.Code, 0)
})

test('客户端展示已有状态角标和完整金额，缺失金额显示待核对', async () => {
  const result = await loadCustomerListSummary({ menuId: 'customer-menu', run: async () => ({ Code: 1, Data: { Metrics: { rental: '100.10', buyout: null, annualFilter: '10.01' }, StatusCounts: { All: 2 }, IncompleteMetrics: { buyout: 3 } } }) })
  assert.equal(result.metrics.buyout, '-')
  assert.match(result.warning, /买断3项金额待核对/)
  assert.equal(result.statusCounts.All, 2)
})

test('统计客户端单次调用且传递有效期、快捷状态与基础筛选', async () => {
  const calls = []
  const result = await loadCustomerListSummary({ menuId: 'customer-menu', validOnly: false, selectedStatus: '目标客户', filters: { _Keyword: '学校' }, run: async (key, params) => {
    calls.push({ key, params }); return { Code: 1, Data: { Metrics: { rental: '0.00', buyout: '20.00', annualFilter: '0.00' }, StatusCounts: { All: 2, 目标客户: 1 } } }
  } })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].params.Filters.ValidOnly, false)
  assert.equal(calls[0].params.Filters.SelectedStatus, '目标客户')
  assert.equal(calls[0].params.Filters._Keyword, '学校')
  assert.equal(result.metrics.buyout, '20.00')
})

test('统计客户端不把权限失败或缺失金额转换为零', async () => {
  for (const response of [{ Code: 0, Msg: '无权限' }, { Code: 1, Data: { Metrics: { rental: null }, StatusCounts: { All: 0 } } }]) {
    await assert.rejects(() => loadCustomerListSummary({ menuId: 'customer-menu', run: async () => response }))
  }
})

function listPage(loadSummary) {
  const source = fs.readFileSync(path.join(root, 'src/pages/business/list.vue'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  const sandbox = { console, clearTimeout, setTimeout, themeMixin: {}, listReturnMixin: {}, PERIOD_OPTIONS: [],
    CUSTOMER_CONTRACT_TOTALS_ENGINE: 'xjy-customer-contract-totals', loadCustomerListSummary: loadSummary,
    buildModuleFilterPayload: (_config, options) => ({ _Keyword: options.keyword, _Where: [], status: options.status }) }
  for (const statement of source.matchAll(/^[ \t]*import\s([\s\S]*?)from\s+['"][^'"]+['"]\s*;?\r?$/gm)) {
    for (const name of statement[1].replace(/[{}]/g, '').split(',').map(item => item.trim()).filter(Boolean)) {
      const local = name.split(/\s+as\s+/).at(-1)
      if (!(local in sandbox)) sandbox[local] = () => ({})
    }
  }
  vm.runInNewContext(source.replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '').replace('export default {', 'globalThis.component = {'), sandbox)
  return { ...sandbox.component.data(), ...sandbox.component.methods, showCustomerContractTotals: true,
    config: { statisticsMetrics: [{ key: 'rental', apiEngineKey: 'xjy-customer-contract-totals' }] }, menuId: 'customer-menu', loadRequestId: 1 }
}

test('真实列表快速切换有效期拒绝旧统计迟到覆盖，快照保留开关', async () => {
  const pending = []
  const page = listPage(options => new Promise(resolve => pending.push({ options, resolve })))
  const first = page.loadPlatformStatistics({ keyword: '学校', status: '目标客户' }, 1)
  page.customerValidOnly = false
  const second = page.loadPlatformStatistics({ keyword: '学校', status: '目标客户' }, 1)
  assert.equal(pending[0].options.validOnly, true)
  assert.equal(pending[1].options.validOnly, false)
  assert.equal(pending[1].options.filters.status, '')
  pending[1].resolve({ metrics: { rental: '200.00' }, statusCounts: { All: 3 }, warning: '' }); await second
  pending[0].resolve({ metrics: { rental: '100.00' }, statusCounts: { All: 1 }, warning: '' }); await first
  assert.equal(page.metricValues.rental, '200.00')
  assert.equal(page.customerStatusCount('All'), 3)
  assert.equal(page.customerStatusCount('断约客户'), 0)
  assert.equal(page.getMciListSnapshot().customerValidOnly, false)
})

test('真实列表失败不保留旧统计，重试恢复零值角标和正确金额', async () => {
  let fail = true
  const page = listPage(async () => { if (fail) throw new Error('无权限'); return { metrics: { rental: '0.00' }, statusCounts: { All: 0 }, warning: '' } })
  page.customerStatusCounts = { All: 3503 }
  await page.loadPlatformStatistics({}, 1)
  assert.equal(page.customerStatusCount('All'), '-')
  assert.equal(page.metricValues.rental, '-')
  assert.equal(page.metricLoading, false)
  fail = false
  await page.loadPlatformStatistics({}, 1)
  assert.equal(page.customerStatusCount('All'), 0)
  assert.equal(page.metricValues.rental, '0.00')
})

// 执行接口实际生成的聚合SQL，避免仅用替身金额掩盖历史空总价的兼容问题。
function executeProductSql(product, params = { Summary: true, SysMenuId: 'customer-menu', Filters: {} }) {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec('CREATE TABLE Diy_Dingdan (Id TEXT,KehuID TEXT,DingdanZT TEXT,HetongZT TEXT,HetongKSSJ TEXT,HetongJSSJ TEXT,IsDeleted INTEGER); CREATE TABLE Diy_DingdanSP (Id TEXT,DingdanID TEXT,HezuoFS TEXT,HezuoFSZ TEXT,Zongjia REAL,LvxinZJ REAL,ShebeiSJDJ REAL,Shuliang INTEGER,ShijiJG REAL,IsDeleted INTEGER)')
    const insertOrder = database.prepare('INSERT INTO Diy_Dingdan VALUES (?,?,?,?,?,?,0)')
    for (const order of orders) insertOrder.run(order.Id, order.KehuID, order.DingdanZT, order.HetongZT, order.HetongKSSJ, order.HetongJSSJ)
    const values = { Id: 'p1', DingdanID: 'o1', HezuoFS: '买断+包年换芯', HezuoFSZ: '4', Zongjia: null, LvxinZJ: 1020, ShebeiSJDJ: 4500, Shuliang: 2, ShijiJG: 9600, ...product }
    database.prepare('INSERT INTO Diy_DingdanSP VALUES (?,?,?,?,?,?,?,?,?,0)').run(...['Id','DingdanID','HezuoFS','HezuoFSZ','Zongjia','LvxinZJ','ShebeiSJDJ','Shuliang','ShijiJG'].map(key => values[key]))
    return execute(params, { query: (sql, bindings) => database.prepare(sql).all(bindings) }).result
  } finally { database.close() }
}

test('历史买断总价为空时按不含耗材的设备实际单价乘数量计算，顶部和卡片一致', () => {
  const summary = executeProductSql({})
  assert.equal(summary.Code, 1)
  assert.equal(summary.Data.Metrics.buyout, '9000.00')
  assert.equal(summary.Data.Metrics.annualFilter, '1020.00')
  assert.equal(summary.Data.IncompleteMetrics.buyout, 0)
  const card = executeProductSql({}, { CustomerIds: ['c1'], CustomerSysMenuId: 'customer-menu' })
  assert.equal(card.Code, 1)
  assert.equal(card.Data.Customers.c1.Buyout.All, '9000.00')
})

test('已有设备总价及零价优先，不能被备用单价覆盖或再次乘数量', () => {
  assert.equal(executeProductSql({ Zongjia: 8000 }).Data.Metrics.buyout, '8000.00')
  assert.equal(executeProductSql({ Zongjia: 0 }).Data.Metrics.buyout, '0.00')
  assert.equal(executeProductSql({ ShebeiSJDJ: 0 }).Data.Metrics.buyout, '0.00')
  assert.equal(executeProductSql({ ShebeiSJDJ: 4500.125, Shuliang: 1 }).Data.Metrics.buyout, '4500.13')
})

test('设备单价或数量也缺失时仍待核对，不用含耗材的商品价格或订单总价替代', () => {
  for (const product of [{ ShebeiSJDJ: null }, { Shuliang: null }, { Shuliang: -1 }]) {
    const result = executeProductSql(product)
    assert.equal(result.Code, 1)
    assert.equal(result.Data.Metrics.buyout, null)
    assert.equal(result.Data.IncompleteMetrics.buyout, 1)
  }
})
