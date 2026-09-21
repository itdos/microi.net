import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeCurrentUserAfterProfileSave } from '../src/platform/current-user-profile.mjs'

const cachedUser = {
  Id: 'user-157',
  Account: '15772777281',
  Name: '赵157',
  RoleIds: ['staff'],
  Avatar: '/xjy/avatar/old.png'
}

test('资料接口返回刷新摘要时保留完整登录用户并合并新头像', () => {
  const result = mergeCurrentUserAfterProfileSave(
    cachedUser,
    {
      Avatar: '/xjy/avatar/new.png',
      ContentSecurityLoginCode: 'one-time-code'
    },
    { OsClient: 'xjy', UserId: 'user-157', Changed: true }
  )

  assert.equal(result.Id, cachedUser.Id)
  assert.equal(result.Account, cachedUser.Account)
  assert.deepEqual(result.RoleIds, cachedUser.RoleIds)
  assert.equal(result.Avatar, '/xjy/avatar/new.png')
  assert.equal(result.ContentSecurityLoginCode, undefined)
})

test('同一用户的完整响应可补充服务端规范化值但不能替换会话 Id', () => {
  const result = mergeCurrentUserAfterProfileSave(
    cachedUser,
    { Name: '本地昵称' },
    { Id: 'USER-157', Name: '服务端昵称', Email: 'user@example.com' }
  )

  assert.equal(result.Id, cachedUser.Id)
  assert.equal(result.Name, '服务端昵称')
  assert.equal(result.Email, 'user@example.com')
  assert.equal(result.Account, cachedUser.Account)
})

test('忽略不属于当前会话用户的响应对象', () => {
  const result = mergeCurrentUserAfterProfileSave(
    cachedUser,
    { Name: '新昵称' },
    { Id: 'another-user', Account: 'attacker', Name: '错误用户' }
  )

  assert.equal(result.Id, cachedUser.Id)
  assert.equal(result.Account, cachedUser.Account)
  assert.equal(result.Name, '新昵称')
})
