import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { getTaskCardActions, taskNativeAction } from '../src/tenants/xjy/task-card-actions.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { findSyncedXjyEngine } = require('./lib/workspace-paths.js')
const menu = { Id: 'task-menu', MoreBtns: [{ Id: '6c979682-0dec-4f38-b107-3994b8f66cc5', Name: '指派' }, { Id: '718cc780-fe95-4af4-a7a8-96c829f15f45', Name: '接单' }] }
const row = { Id: 'task-1', Zhuangtai: '待接单', KehuMC: '客户' }
const user = (...names) => ({ Id: 'user-1', Level: 10, _RoleLimits: [{ Type: 'Menu', FkId: menu.Id, Permission: names.map(Name => ({ Name })) }] })

test('更多操作按当前菜单的精确按钮 Id 和编辑删除权限配置', () => {
  assert.deepEqual(getTaskCardActions(row, menu, user()).map(a => a.label), [])
  assert.deepEqual(getTaskCardActions(row, menu, user('指派')).map(a => a.label), [])
  assert.deepEqual(getTaskCardActions(row, menu, user(menu.MoreBtns[0].Id, 'Edit')).map(a => a.label), ['指派', '编辑'])
  assert.deepEqual(getTaskCardActions(row, menu, user('Del')).map(a => a.label), ['删除'])
  assert.deepEqual(getTaskCardActions(row, menu, { ...user('Edit'), Level: 999 }).map(a => a.label), ['编辑'])
  assert.equal(getTaskCardActions(row, menu, { _IsAdmin: true }).length, 4)
})

test('其他菜单、表权限、名称残留和授权撤销不能生成任务操作', () => {
  const permission = user(menu.MoreBtns[0].Id)
  assert.equal(getTaskCardActions(row, menu, permission).length, 1)
  permission._RoleLimits[0].FkId = 'other-menu'
  assert.equal(getTaskCardActions(row, menu, permission).length, 0)
  permission._RoleLimits[0].FkId = menu.Id
  permission._RoleLimits[0].Type = 'Table'
  assert.equal(getTaskCardActions(row, menu, permission).length, 0)
  assert.equal(getTaskCardActions(row, menu, user('6c979682-0dec-4f38-b107-3994b8f66cc5-old')).length, 0)
  permission._RoleLimits = []
  assert.equal(getTaskCardActions(row, menu, permission).length, 0)
})

test('JSON 权限兼容、按钮去重和任务状态映射', () => {
  const permission = user(menu.MoreBtns[1].Id)
  permission._RoleLimits = JSON.stringify(permission._RoleLimits)
  const action = getTaskCardActions(row, menu, permission)[0]
  assert.match(action.__viewAction.Target, /rowAction=718cc780/)
  assert.equal(taskNativeAction(menu.MoreBtns[1].Id, row), 'claim')
  assert.equal(taskNativeAction(menu.MoreBtns[1].Id, { Zhuangtai: '已结束' }), '')
  assert.equal(getTaskCardActions(row, {}, { _IsAdmin: true }).length, 0)
  assert.equal(getTaskCardActions({}, menu, { _IsAdmin: true }).length, 0)
  const duplicated = { ...menu, FormBtns: [{ ...menu.MoreBtns[0], Id: '5c36690a-73d8-4c88-bfad-04c12dd7c549' }] }
  assert.equal(getTaskCardActions(row, duplicated, user(menu.MoreBtns[0].Id, duplicated.FormBtns[0].Id)).length, 1)
})

test('旧评价按钮不能代替独立客户评价权限', () => {
  const legacy = { Id: '19dc5540-1fda-4d64-9a56-632c664399ac', Name: '用户评价' }
  const independent = { Id: '0c2cae82-29e9-4dbf-97c1-9ef6e9de0239', Name: '客户评价' }
  const configured = { Id: menu.Id, MoreBtns: [legacy], FormBtns: [independent] }
  const task = { ...row, Zhuangtai: '待评价' }
  assert.equal(getTaskCardActions(task, configured, user(legacy.Id)).length, 0)
  assert.deepEqual(getTaskCardActions(task, configured, user(independent.Id)).map(a => a.label), ['客户评价'])
})

test('客户列表隐藏合同金额标题，任务电话图标与更多操作保留独立触控区', () => {
  const totals = fs.readFileSync(path.join(root, 'src/tenants/xjy/components/customer-contract-totals.vue'), 'utf8')
  const card = fs.readFileSync(path.join(root, 'src/components/mci-task-card/mci-task-card.vue'), 'utf8')
  assert.match(totals, /v-if="!compact \|\| collapsible" class="contract-totals__heading"/)
  for (const label of ['客户联系人', '客户电话', '设备数量', '更多']) assert.ok(card.includes(label))
  assert.doesNotMatch(card, /进入任务|task-card__detail|task-card__arrow/)
  assert.match(card, /class="task-card__phone"[\s\S]*?@tap\.stop="\$emit\('phone', item\.phone\)"/)
  assert.match(card, /v-if="actions.length" class="task-card__actions"[^>]*@tap\.stop="showActionMenu"/)
  assert.match(card, /value !== null && value !== undefined && value !== ''/)
  const detail = fs.readFileSync(path.join(root, 'src/pages/task/detail.vue'), 'utf8')
  assert.match(detail, /loadAll\(Boolean\(this\.pendingCardAction\)\)/)
})

const statsCode = fs.readFileSync(findSyncedXjyEngine(root, 'xjy-module-presentation-stats'), 'utf8')
function counts(params, options = {}) {
  let moduleCalls = 0, sqlCalls = 0
  const bindings = {}
  const V8 = {
    CurrentUser: options.anonymous ? {} : { Id: 'user-1' },
    Param: { SysMenuId: 'aab7df97-4009-4d9f-89f7-ed30e5eba3fb', TaskCardIds: ['task-1', 'task-2', 'task-denied'], ...params },
    OsClient: 'tenant-current',
    FormEngine: { GetTableData(tableName, query) {
      moduleCalls++
      assert.equal(tableName, 'Diy_ShouhouDD')
      assert.equal(query.OsClient, V8.OsClient)
      assert.deepEqual(query._CurrentUser, V8.CurrentUser)
      assert.equal(query._InvokeType, 'Client')
      assert.equal(query._SysMenuId, V8.Param.SysMenuId)
      assert.deepEqual(JSON.parse(JSON.stringify(query._SelectFields)), ['Id'])
      assert.deepEqual(JSON.parse(JSON.stringify(query._Where[0])), ['Id', 'In', V8.Param.TaskCardIds])
      return options.denied ? { Code: 0 } : { Code: 1, Data: [{ Id: 'task-1' }, { Id: 'task-2' }, { Id: 'unrequested' }] }
    } },
    Db: { FromSql(sql) {
      sqlCalls++
      assert.match(sql, /GROUP BY ShouhouDDID/)
      assert.match(sql, /IsDeleted IS NULL OR IsDeleted <> 1/)
      assert.doesNotMatch(sql, /task-denied|task-1/)
      return { AddInParameter(key, value) { bindings[key] = value; return this }, ToArray() {
        if (options.sqlFailure) throw new Error('offline')
        return [{ ShouhouDDID: 'task-1', DeviceCount: 4 }]
      } }
    } }
  }
  const result = vm.runInNewContext(`(function(){${statsCode}\n})()`, { V8 })
  return { result: JSON.parse(JSON.stringify(result)), moduleCalls, sqlCalls, bindings }
}

test('设备数量来自明细批量聚合，零台保留，未授权任务不返回数量', () => {
  const actual = counts()
  assert.deepEqual(actual.result.Data.TaskDeviceCounts, { 'task-1': 4, 'task-2': 0 })
  assert.deepEqual(actual.bindings, { '@task0': 'task-1', '@task1': 'task-2' })
  assert.equal(actual.moduleCalls, 1)
  assert.equal(actual.sqlCalls, 1)
})

test('匿名、错误菜单、非法 Id、超量、权限失败与 SQL 故障失败关闭', () => {
  for (const options of [{ anonymous: true }, { denied: true }, { sqlFailure: true }]) assert.equal(counts({}, options).result.Code, 0)
  for (const params of [{ SysMenuId: 'other-menu' }, { TaskCardIds: ['invalid\'id'] }, { TaskCardIds: 'task-1' }, { TaskCardIds: Array(101).fill('task-1') }]) {
    const actual = counts(params)
    assert.equal(actual.result.Code, 0)
    assert.equal(actual.moduleCalls, 0)
    assert.equal(actual.sqlCalls, 0)
  }
  const empty = counts({ TaskCardIds: [] })
  assert.deepEqual(empty.result.Data.TaskDeviceCounts, {})
  assert.equal(empty.moduleCalls, 0)
  assert.equal(empty.sqlCalls, 0)
})
