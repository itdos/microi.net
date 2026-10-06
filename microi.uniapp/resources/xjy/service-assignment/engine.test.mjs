import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import workspacePaths from '../../../scripts/lib/workspace-paths.js'

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
const candidates = Object.fromEntries(manifest.engines.map(engine => [engine.apiEngineKey, engine]))
const assignment = Function('V8', candidates.shouhoudd_zhipai.code)
const directory = Function('V8', candidates['get-sysUser-list'].code)

test('安装候选绑定两个真实同步接口的原始字节、版本及受控资源策略', () => {
  assert.deepEqual(Object.keys(candidates).sort(), ['get-sysUser-list', 'shouhoudd_zhipai'])
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
  for (const [key, candidate] of Object.entries(candidates)) {
    const source = readFileSync(workspacePaths.findSyncedXjyEngine(projectRoot, key), 'utf8')
    assert.equal(candidate.code, source)
    assert.match(source, new RegExp(`Version: ${candidate.version.replaceAll('.', '\\.')}`))
    assert.equal(manifest.ResourcePolicies.ApiEngines[key], 'Managed')
    assert.equal(candidate.allowAnonymous, false)
    assert.equal(candidate.stopHttp, false)
    assert.equal(candidate.v8Limit, false)
  }
})

function runAssignment(options = {}) {
  const current = { Id: 'operator', Name: '真实操作人', TenantId: 'tenant-a', Level: 100, State: 1, IsDeleted: 0, RoleIds: '[{"Id":"ordinary"}]', ...options.current }
  const target = { Id: 'worker', Name: '真实服务人', Phone: '13800000000', TenantId: 'tenant-a', State: 1, IsDeleted: 0, ...options.target }
  const tasks = options.tasks || [{ Id: 'task-1', TenantId: 'tenant-a', ZhuangtaiZ: 1, IsDeleted: 0 }]
  const calls = []
  const transaction = { kind: 'current-transaction' }
  let writes = null
  const V8 = {
    CurrentUser: options.anonymous ? {} : { Id: 'operator', Name: '旧缓存姓名', Level: 9999, TenantId: 'tenant-b', RoleIds: '[{"Id":"platform"}]' },
    Param: { Id: 'task-1', ShouhouRYID: 'worker', ShouhouRY: '伪造姓名', ShouhouRYDH: '000', CurrentUser: { Id: 'platform', Level: 9999 }, ...options.param },
    DbTrans: transaction,
    Action: { GetDateTimeNow: () => '2026-10-02 12:00:00' },
    FormEngine: {
      GetFormData(table, query, trans) {
        assert.equal(trans, transaction)
        assert.equal(table, 'Sys_User')
        assert.ok(query._SelectFields.includes('State'))
        assert.ok(!query._SelectFields.includes('Pwd'))
        calls.push({ table, query })
        if (query.Id === 'operator') return options.currentResult || { Code: 1, Data: current }
        return options.targetResult || { Code: 1, Data: target }
      },
      GetTableData(table, query, trans) {
        assert.equal(trans, transaction)
        calls.push({ table, query })
        if (table === 'Sys_Role') return options.roleResult || { Code: 1, Data: options.roles || [] }
        assert.equal(table, 'Diy_ShouhouDD')
        assert.ok(query._SelectFields.includes('TenantId'))
        return options.taskResult || { Code: 1, Data: tasks }
      },
      UptTableData(rows, trans) {
        assert.equal(trans, transaction)
        writes = rows
        return { Code: 1 }
      }
    }
  }
  assignment(V8)
  return { result: V8.Result, writes, calls }
}

test('操作者停用、删除、无记录、读失败或匿名时不写任务', () => {
  for (const options of [{ current: { State: 0 } }, { current: { IsDeleted: 1 } }, { currentResult: { Code: 2 } }, { currentResult: { Code: 0 } }, { anonymous: true }]) {
    const result = runAssignment(options)
    assert.notEqual(result.result.Code, 1)
    assert.equal(result.writes, null)
  }
})

test('目标不存在、读失败或记录Id不符时不写任务', () => {
  for (const options of [{ targetResult: { Code: 2 } }, { targetResult: { Code: 0 } }, { target: { Id: 'other' } }]) {
    const result = runAssignment(options)
    assert.equal(result.result.Code, 0)
    assert.equal(result.writes, null)
  }
})

test('客户端可以只传人员Id；数据库空电话会清理旧任务电话', () => {
  const { result, writes } = runAssignment({ target: { Phone: '' }, param: { ShouhouRY: '', ShouhouRYDH: '伪造号码' } })
  assert.equal(result.Code, 1)
  assert.equal(writes[0].ShouhouRY, '真实服务人')
  assert.equal(writes[0].ShouhouRYDH, '')
  assert.equal(writes[0].ZhipaiR, '真实操作人')
})

test('删除的管理员角色、未绑定角色及角色读取失败都不给跨商家能力', () => {
  const highUser = { Level: 9999, RoleIds: '[{"Id":"platform"}]' }
  for (const options of [{ roles: [{ Id: 'platform', Level: 9999, IsDeleted: 1 }] }, { roles: [{ Id: 'foreign', Level: 9999 }] }, { roleResult: { Code: 0 } }]) {
    const result = runAssignment({ ...options, current: highUser, target: { TenantId: 'tenant-b' } })
    assert.equal(result.result.Code, 0)
    assert.equal(result.writes, null)
  }
})

test('主库有效管理员用户与绑定的有效角色同时成立才可跨商家', () => {
  const result = runAssignment({ current: { Level: 9999, RoleIds: '["platform"]' }, roles: [{ Id: 'platform', Level: 9999, IsDeleted: 0 }], target: { TenantId: 'tenant-b' }, tasks: [{ Id: 'task-1', TenantId: 'tenant-c', ZhuangtaiZ: 1 }] })
  assert.equal(result.result.Code, 1)
  assert.equal(result.writes.length, 1)
})

test('绑定角色内嵌陈旧等级与名称不会覆盖主库角色的管理员资格', () => {
  const result = runAssignment({
    current: { Level: 9999, TenantId: '', RoleIds: '[{"Id":"platform","Name":"陈旧名称","Level":999}]' },
    roles: [{ Id: 'platform', Level: 9999, IsDeleted: 0 }],
    target: { TenantId: 'tenant-b' },
    tasks: [{ Id: 'task-1', TenantId: 'tenant-c', ZhuangtaiZ: 1 }]
  })
  assert.equal(result.result.Code, 1)
  assert.equal(result.writes.length, 1)
  const roleQuery = result.calls.find(call => call.table === 'Sys_Role').query
  assert.deepEqual(roleQuery._Where, [['Id', 'In', ['platform']], ['AND', 'IsDeleted', '=', 0]])
  assert.deepEqual(roleQuery._SelectFields, ['Id', 'Level', 'IsDeleted'])
})

test('非待指派、跨商家、删除、不完整或重复任务整批拒绝', () => {
  for (const tasks of [[{ Id: 'task-1', TenantId: 'tenant-a', ZhuangtaiZ: 2 }], [{ Id: 'task-1', TenantId: 'tenant-b', ZhuangtaiZ: 1 }], [{ Id: 'task-1', TenantId: 'tenant-a', ZhuangtaiZ: 1, IsDeleted: 1 }], []]) {
    const result = runAssignment({ tasks })
    assert.equal(result.result.Code, 0)
    assert.equal(result.writes, null)
  }
  const duplicate = runAssignment({ param: { Ids: ['task-1', 'task-2'] }, tasks: [{ Id: 'task-1', TenantId: 'tenant-a', ZhuangtaiZ: 1 }, { Id: 'task-1', TenantId: 'tenant-a', ZhuangtaiZ: 1 }] })
  assert.equal(duplicate.result.Code, 0)
  assert.equal(duplicate.writes, null)
})

test('最多200条任务只批量读取一次并保持阶段，201条不发起数据访问', () => {
  const tasks = Array.from({ length: 200 }, (_, index) => ({ Id: `task-${index + 1}`, TenantId: 'tenant-a', ZhuangtaiZ: 1 }))
  const result = runAssignment({ tasks, param: { Ids: tasks.map(task => task.Id) } })
  assert.equal(result.result.Code, 1)
  assert.equal(result.writes.length, 200)
  assert.equal(result.calls.filter(call => call.table === 'Diy_ShouhouDD').length, 1)
  assert.ok(result.writes.every(row => !Object.hasOwn(row, 'ZhuangtaiZ')))
  const oversized = runAssignment({ param: { Ids: Array.from({ length: 201 }, (_, i) => `task-${i + 1}`) } })
  assert.equal(oversized.result.Code, 0)
  assert.equal(oversized.calls.length, 0)
  assert.equal(oversized.writes, null)
})

async function runDirectory({ userContext = { TenantId: 'tenant-a', Level: 100 }, param = {} } = {}) {
  const calls = []
  const bindings = []
  let sql
  const V8 = {
    OsClient: 'xjy', CurrentUser: { Id: 'current-user', TenantId: 'tenant-b', Level: 9999 }, Param: { Keyword: '商家', TenantId: 'tenant-b', ...param },
    Db: { FromSql(text) { sql = text; return { AddInParameter(name, value) { bindings.push([name, value]); return this }, First() { return userContext } } } },
    FormEngine: { GetTableData(query) { calls.push(query); return { Code: 1, Data: [], DataCount: 0 } } }
  }
  return { result: await directory(V8), calls, sql, bindings }
}

test('通讯录以活动主库账号绑定商家，缓存与客户端管理员伪造不扩大查询', async () => {
  const { result, calls, sql, bindings } = await runDirectory()
  assert.equal(result.Code, 1)
  assert.match(sql, /IsDeleted = @p1 AND State = @p2/)
  assert.deepEqual(bindings, [['@p0', 'current-user'], ['@p1', 0], ['@p2', 1]])
  const query = calls.find(call => call.FormEngineKey === 'Sys_User')
  assert.ok(query._Where.some(condition => condition.Name === 'TenantId' && condition.Value === 'tenant-a'))
  assert.ok(!query._Where.some(condition => condition.Name === 'TenantName'))
})

test('通讯录当前主库账号无效不查询人员，平台管理员商家关键词正确闭合分组', async () => {
  const invalid = await runDirectory({ userContext: null })
  assert.equal(invalid.result.Code, 0)
  assert.equal(invalid.calls.length, 0)
  const admin = await runDirectory({ userContext: { Level: 9999, TenantId: '' } })
  assert.equal(admin.result.Code, 1)
  const query = admin.calls.find(call => call.FormEngineKey === 'Sys_User')
  assert.ok(!query._Where.some(condition => condition.Name === 'TenantId'))
  assert.equal(query._Where.at(-1).Name, 'TenantName')
  assert.equal(query._Where.at(-1).GroupEnd, true)
  assert.equal(query._Where.find(condition => condition.Name === 'Email').GroupEnd, false)
})
