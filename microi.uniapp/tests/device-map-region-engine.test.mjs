import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

const code = readFileSync(new URL('../src/tenants/xjy/api-engines/get_location_shebei-v2.js', import.meta.url), 'utf8')
function run(params, user = { Id: 'staff', TenantId: 'tenant', Level: 1 }) {
  const queries = []
  const V8 = { Param: params, CurrentUser: user, Db: { FromSql(sql) {
    const query = { sql, bindings: {}, AddInParameter(key, value) { this.bindings[key] = value; return this }, ToArray() { return [] } }
    queries.push(query); return query
  } } }
  const returned = vm.runInNewContext(`(function(){${code}\n})()`, { V8 })
  return { result: returned || V8.Result, queries }
}
test('旧附近请求保持权限与10公里默认，上限支持6000公里', () => {
  const { queries } = run({ Latitude: 30, Longitude: 120, Km: 6000 })
  assert.equal(queries[0].bindings['@p2'], 6000)
  assert.match(queries[0].sql, /distance <= @p2/)
  assert.equal(run({ Latitude: 30, Longitude: 120 }).queries[0].bindings['@p2'], 10)
  assert.equal(run({ Latitude: 30, Longitude: 120, Km: 10000 }).queries[0].bindings['@p2'], 6000)
})
test('省市区与全国不需经纬度，不叠加公里条件，仍强制租户和责任权限', () => {
  const { queries, result } = run({ Scope: 'region', Region: '["浙江省","杭州市","全部"]', PageIndex: 2, PageSize: 500 })
  const query = queries[0]
  assert.equal(query.bindings['@region0'], '浙江省')
  assert.equal(query.bindings['@region1'], '杭州市')
  assert.equal(query.bindings['@offset'], 500)
  assert.equal(query.bindings['@p3'], 'tenant')
  assert.equal(query.bindings['@p4'], 0)
  assert.equal(query.bindings['@p5'], 'staff')
  assert.match(query.sql, /A.TenantId = @p3/)
  assert.match(query.sql, /C.TenantId = A.TenantId/)
  assert.match(query.sql, /C.FuzeRID = @p5/)
  assert.doesNotMatch(query.sql, /WHERE distance/)
  assert.equal(result.DataAppend.ScopeProtocol, 1)
  assert.doesNotMatch(run({ Scope: 'region', Region: '["全部","全部","全部"]' }).queries[0].sql, /INSTR/)
})
test('非法地区和身份失败关闭，SQL特殊字符只作绑定参数', () => {
  for (const Region of ['[]', '{}', 'bad', '"abc"', '[""]']) {
    const { result, queries } = run({ Scope: 'region', Region })
    assert.equal(result.Code, 0, Region)
    assert.equal(queries.length, 0)
  }
  assert.equal(run({ Scope: 'region', Region: '["全部"]' }, {}).result.Code, 0)
  const attack = "浙江省' OR 1=1 --%_"
  const query = run({ Scope: 'region', Region: JSON.stringify([attack, '全部']) }).queries[0]
  assert.equal(query.bindings['@region0'], attack)
  assert.ok(!query.sql.includes(attack))
})
