import workspacePaths from './lib/workspace-paths.js'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  ASSIGNEE_KEYWORD_FIELDS,
  buildServiceAssigneeRequest,
  buildSupportAssigneeWhere
} from '../src/tenants/xjy/task-assignee-query.mjs'

test('服务人员搜索交给可信通讯录接口判定商家范围，客户端不提交角色或商家条件', () => {
  const request = buildServiceAssigneeRequest(' 邓 ')
  assert.equal(request.Keyword, '邓')
  assert.equal(request._PageIndex, 1)
  assert.equal(request._PageSize, 100)
  assert.equal(Object.hasOwn(request, 'TenantId'), false)
  assert.equal(Object.hasOwn(request, 'RoleIds'), false)
})

test('客服负责人查询继续保留客服角色和商家限制', () => {
  const supportWhere = buildSupportAssigneeWhere({ keyword: '朱立雄', tenantId: 'tenant-a' })
  assert.equal(supportWhere.some((item) => item.Name === 'TenantId' && item.Value === 'tenant-a'), true)
  assert.equal(supportWhere.some((item) => item.Name === 'RoleIdsString' && item.Value === '客服'), true)
  assert.deepEqual(supportWhere.slice(-ASSIGNEE_KEYWORD_FIELDS.length).map((item) => item.Value), Array(ASSIGNEE_KEYWORD_FIELDS.length).fill('朱立雄'))
})

const engineSource = readFileSync(workspacePaths.findSyncedXjyEngine(fileURLToPath(new URL('..', import.meta.url)), 'shouhoudd_zhipai'), 'utf8')
const directoryEngineSource = readFileSync(workspacePaths.findSyncedXjyEngine(fileURLToPath(new URL('..', import.meta.url)), 'get-sysUser-list'), 'utf8')

// 服务端保存会单调提升版本；门禁要求修复的最低语义版本，不拒绝已发布的后续补丁。
function assertMinimumVersion(source, minimum) {
  const match = source.match(/^\s*\*\s*Version:\s*v(\d+)\.(\d+)\.(\d+)\s*$/m)
  assert.ok(match, '接口源码必须包含有效的语义版本头')
  const actual = match.slice(1).map(Number)
  const comparison = actual.reduce((result, value, index) => result || Math.sign(value - minimum[index]), 0)
  assert.ok(comparison >= 0, `接口版本 v${actual.join('.')} 必须至少为 v${minimum.join('.')}`)
}

test('通讯录接口从主库判定平台管理员，普通账号强制商家隔离且管理员可搜索商家名', () => {
  assertMinimumVersion(directoryEngineSource, [1, 1, 3])
  assert.match(directoryEngineSource, /var isPlatformAdmin = userLevel >= 9999/)
  assert.match(directoryEngineSource, /if \(!isPlatformAdmin\)[\s\S]*Name: 'TenantId'/)
  assert.match(directoryEngineSource, /Name: 'TenantName'[\s\S]*GroupEnd: true/)
  for (const field of ASSIGNEE_KEYWORD_FIELDS) assert.equal(directoryEngineSource.includes(`Name: '${field}'`), true)
})

function runAssignment({ taskTenantId = 'tenant-a', current = {}, target = {}, roleRows, param = {} } = {}) {
  let updatedRows = null
  const tasks = [{ Id: 'task-1', ZhuangtaiZ: 1, TenantId: taskTenantId }]
  const currentUser = {
    Id: 'manager-1',
    Name: '指派人',
    State: 1,
    IsDeleted: 0,
    TenantId: 'tenant-a',
    Level: 100,
    RoleIds: '[{"Id":"manager-role","Name":"普通管理员"}]',
    ...current
  }
  const targetUser = {
    Id: 'service-1',
    Name: '朱立雄',
    Account: 'zhulixiong',
    Phone: '13800000000',
    State: 1,
    IsDeleted: 0,
    TenantId: 'tenant-a',
    RoleIds: '[{"Id":"role-2","Name":"财务"}]',
    ...target
  }
  const resolvedRoleRows = roleRows || [{ Id: 'manager-role', Level: 100 }]
  const V8 = {
    Param: {
      Id: 'task-1',
      ShouhouRYID: 'service-1',
      ShouhouRY: '前端伪造姓名',
      ShouhouRYDH: '00000000000',
      ...param
    },
    CurrentUser: { Id: 'manager-1', Name: '缓存姓名', Level: 9999 },
    Action: { GetDateTimeNow: () => '2026-09-29 10:00:00' },
    FormEngine: {
      GetTableData: (table) => table === 'Sys_Role'
        ? { Code: 1, Data: resolvedRoleRows }
        : { Code: 1, Data: tasks },
      GetFormData: (table, options) => ({
        Code: 1,
        Data: String(options.Id) === 'manager-1' ? currentUser : targetUser
      }),
      UptTableData: (rows) => {
        updatedRows = rows
        return { Code: 1 }
      }
    }
  }
  new Function('V8', engineSource)(V8)
  return { result: V8.Result, updatedRows }
}

test('普通账号可以指派同商家的任意角色人员，姓名电话仍以数据库为准', () => {
  const { result, updatedRows } = runAssignment()
  assert.equal(result.Code, 1)
  assert.equal(updatedRows.length, 1)
  assert.equal(updatedRows[0].ShouhouRY, '朱立雄')
  assert.equal(updatedRows[0].ShouhouRYDH, '13800000000')
  assert.equal(updatedRows[0].ZhipaiR, '指派人')
  assertMinimumVersion(engineSource, [1, 0, 3])
})

test('普通账号不能跨商家指派，缓存中的伪造超级管理员等级不能绕过', () => {
  const crossTarget = runAssignment({ target: { TenantId: 'tenant-b' } })
  assert.equal(crossTarget.result.Code, 0)
  assert.equal(crossTarget.updatedRows, null)

  const crossCurrent = runAssignment({ current: { TenantId: 'tenant-b' } })
  assert.equal(crossCurrent.result.Code, 0)
  assert.equal(crossCurrent.updatedRows, null)
})

test('主库等级与有效超级管理员角色同时成立时允许跨商家指派', () => {
  const { result, updatedRows } = runAssignment({
    current: { Level: 9999, RoleIds: '[{"Id":"platform-admin"}]' },
    roleRows: [{ Id: 'platform-admin', Level: 9999 }],
    target: { TenantId: 'tenant-b', RoleIds: '[{"Id":"finance","Name":"财务"}]' }
  })
  assert.equal(result.Code, 1)
  assert.equal(updatedRows[0].ShouhouRYID, 'service-1')
})

test('只有高等级或只有普通角色都不能取得跨商家能力', () => {
  const highLevelOnly = runAssignment({
    current: { Level: 9999, RoleIds: '[{"Id":"ordinary-role"}]' },
    roleRows: [{ Id: 'ordinary-role', Level: 100 }],
    target: { TenantId: 'tenant-b' }
  })
  assert.equal(highLevelOnly.result.Code, 0)

  const adminRoleOnly = runAssignment({
    current: { Level: 100, RoleIds: '[{"Id":"platform-admin"}]' },
    roleRows: [{ Id: 'platform-admin', Level: 9999 }],
    target: { TenantId: 'tenant-b' }
  })
  assert.equal(adminRoleOnly.result.Code, 0)
})

test('停用或已删除人员不能被指派', () => {
  for (const target of [{ State: 0 }, { IsDeleted: 1 }]) {
    const { result, updatedRows } = runAssignment({ target })
    assert.equal(result.Code, 0)
    assert.equal(updatedRows, null)
  }
})
