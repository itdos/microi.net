import assert from 'node:assert/strict'
import test from 'node:test'
import { getUserRoleNames } from '../src/personal-settings-user.js'

test('legacy serialized Roles cannot mask the refreshed role array', () => {
  assert.equal(getUserRoleNames({ Roles: '[{"Id":"legacy","Name":"旧角色"}]', _Roles: [{ Id: 'current', Name: '超级管理员' }] }), '超级管理员')
})

test('serialized and native role collections show the same names without changing input', () => {
  const roles = [{ Name: '管理员' }, { Name: '资产管理员' }, { Name: '管理员' }]
  assert.equal(getUserRoleNames({ Roles: JSON.stringify(roles) }), '管理员、资产管理员')
  assert.equal(getUserRoleNames({ Roles: roles }), '管理员、资产管理员')
  assert.equal(roles.length, 3)
})

test('explicit role labels take priority and single role objects remain compatible', () => {
  assert.equal(getUserRoleNames({ RoleName: '审核员', _Roles: [{ Name: '管理员' }] }), '审核员')
  assert.equal(getUserRoleNames({ Roles: '{"Name":"库管员"}' }), '库管员')
  assert.equal(getUserRoleNames({ Roles: ['审核员', '库管员'] }), '审核员、库管员')
})

test('empty or invalid legacy fields fall back to a valid collection', () => {
  for (const RoleName of [null, '', ' ', 'null', '[]', '[broken', {}, false]) {
    assert.equal(getUserRoleNames({ RoleName, _Roles: [], Roles: '[{"Name":"管理员"}]' }), '管理员')
  }
})

test('new tenants and malformed role values render a safe label', () => {
  for (const user of [null, {}, { Roles: null }, { Roles: '[]' }, { Roles: '{bad' }, { Roles: 1 }, { Roles: true }, { Roles: [{ Id: 'role-id' }, null, 99] }]) {
    assert.equal(getUserRoleNames(user), '普通用户')
  }
})
