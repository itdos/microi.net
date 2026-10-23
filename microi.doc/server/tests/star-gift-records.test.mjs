import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync(new URL('../api-engines/official-star-gift-records.js', import.meta.url), 'utf8')
const role = 'ba43c735-d03e-4aa1-bc86-e185b5aaf014'
function run({ userId = 'operator', roleIds = JSON.stringify([{ Id: role }]), active = true, grant = true, params = {}, tenant = 'iTdos' } = {}) {
  const queries = [], reads = []
  const V8 = {
    OsClient: tenant, CurrentUser: userId ? { Id: userId, Level: 9999, RoleIds: [{ Id: role }] } : null, Param: params,
    Db: { FromSql(sql) { const entry = { sql, values: {} }; queries.push(entry); return { AddInParameter(k, v) { entry.values[k] = v; return this }, First() { return sql.includes('INNER JOIN') ? (grant ? { Id: role } : null) : (active ? { Id: userId, RoleIds: roleIds } : null) } } } },
    FormEngine: { GetTableData(table, query) { reads.push({ table, query }); return { Code: 1, Data: [{ Id: 'record', Phone: '13800000000' }], DataCount: 47 } } }
  }
  const result = vm.runInNewContext(`(function(){${source}\n})()`, { V8 })
  return { result: JSON.parse(JSON.stringify(result)), queries, reads: JSON.parse(JSON.stringify(reads)) }
}
test('匿名、失效帐号及其它租户不读取业务数据', () => {
  for (const args of [{ userId: '' }, { active: false }, { tenant: 'other' }]) { const r = run(args); assert.notEqual(r.result.Code, 1); assert.equal(r.reads.length, 0) }
})
test('不能用管理员等级、客户端角色或相似角色Id越权', () => {
  for (const roleIds of ['[]', JSON.stringify([{ Id: `${role}-suffix` }])]) {
    const r = run({ roleIds, params: { RoleIds: [{ Id: role }], _CurrentUser: { Id: 'admin', Level: 9999 } } })
    assert.equal(r.result.Code, 0); assert.equal(r.reads.length, 0)
  }
})
test('撤销模块授权后，即使保留角色也拒绝数据访问', () => { const r = run({ grant: false }); assert.equal(r.result.Code, 0); assert.equal(r.reads.length, 0) })
test('能力检查只返回布尔结果，无权限不泄露登记内容', () => {
  for (const roleIds of ['[]', JSON.stringify([{ Id: role }])]) { const r = run({ roleIds, params: { Action: 'Capabilities' } }); assert.equal(r.result.Code, 1); assert.equal(typeof r.result.Data.CanView, 'boolean'); assert.equal(r.reads.length, 0) }
})
test('畸形角色配置失败关闭', () => { for (const roleIds of ['bad', '{}']) { const r = run({ roleIds }); assert.equal(r.result.Code, 0); assert.equal(r.reads.length, 0) } })
test('完整字段、总数和稳定排序，不接受客户端投影或任意条件', () => {
  const r = run({ params: { _SelectFields: ['Pwd'], _Where: [], TableName: 'sys_user' } })
  assert.equal(r.result.Code, 1); assert.equal(r.result.Data.Total, 47); assert.equal(r.result.Data.Fields.length, 20)
  assert.equal(r.reads[0].table, 'mci_star_gift_registration'); assert.equal(r.reads[0].query._SelectFields.includes('Pwd'), false)
  assert.deepEqual(r.reads[0].query._Where, [['IsDeleted', '=', 0]]); assert.deepEqual(r.reads[0].query._OrderBys, { CreateTime: 'DESC', Id: 'DESC' })
})
test('搜索采用结构化条件，状态使用元数据键，页大小有界', () => {
  const r = run({ params: { Keyword: "' OR 1=1 --", StarVerifyStatus: 'verified', GiftStatus: 'claimed', PageSize: 999, PageIndex: -1 } })
  assert.equal(r.result.Code, 1); assert.equal(r.reads[0].query._PageSize, 100); assert.equal(r.reads[0].query._PageIndex, 1)
  assert.equal(r.reads[0].query._Where[1][4], "' OR 1=1 --"); assert.deepEqual(r.reads[0].query._Where.at(-1), ['GiftStatus', '=', 'claimed'])
  assert.equal(r.queries[0].sql.includes('operator'), false); assert.equal(r.queries[0].values['@uid'], 'operator')
})
test('非法筛选和写入动作不能读取或更改登记', () => {
  for (const params of [{ GiftStatus: 'other' }, { Keyword: 'x'.repeat(101) }, { Action: 'Update' }]) { const r = run({ params }); assert.equal(r.result.Code, 0); assert.equal(r.reads.length, 0) }
})
