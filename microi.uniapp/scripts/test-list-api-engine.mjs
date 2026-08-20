import assert from 'node:assert/strict'
import {
  buildListApiEnginePayload,
  normalizeListApiEngineResponse
} from '../src/platform/list-api-engine.mjs'

const payload = buildListApiEnginePayload({
  pageSize: 15,
  periodField: 'CreateTime',
  fixedWhere: [{ Name: 'State', Type: '=', Value: 1 }]
}, {
  pageIndex: 2,
  keyword: ' 范艳林 ',
  extraWhere: [{ Name: 'RoleIds', Type: 'Like', Value: 'role-1' }]
}, ['2026-08-01 00:00:00', '2026-08-31 23:59:59'])

assert.equal(payload._PageIndex, 2)
assert.equal(payload._PageSize, 15)
assert.equal(payload.Keyword, '范艳林')
assert.deepEqual(payload._Where, [
  { Name: 'State', Type: '=', Value: 1 },
  { Name: 'RoleIds', Type: 'Like', Value: 'role-1' }
])
assert.deepEqual(payload._SearchDateTime, {
  CreateTime: ['2026-08-01 00:00:00', '2026-08-31 23:59:59']
})

assert.deepEqual(normalizeListApiEngineResponse({
  Code: 1,
  Data: [{ Id: '1' }],
  DataCount: 1,
  DataAppend: { Scope: 'Tenant' }
}), {
  rows: [{ Id: '1' }],
  count: 1,
  append: { Scope: 'Tenant' }
})

assert.throws(
  () => normalizeListApiEngineResponse({ Code: 0, Msg: '无权限' }),
  /无权限/
)

console.log('接口引擎列表适配检查通过')
