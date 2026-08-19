import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  clearRetainedListSessions,
  readRetainedListSession,
  retainedListSessionCount,
  writeRetainedListSession
} from '../src/platform/list-session.mjs'

const taskListSource = fs.readFileSync(new URL('../src/pages/task/list.vue', import.meta.url), 'utf8')
const deviceListSource = fs.readFileSync(new URL('../src/pages/task/devices.vue', import.meta.url), 'utf8')
const listReturnSource = fs.readFileSync(new URL('../src/platform/list-return.js', import.meta.url), 'utf8')
const requestSource = fs.readFileSync(new URL('../src/utils/request.js', import.meta.url), 'utf8')

test.beforeEach(() => clearRetainedListSessions())

test('列表会话按 key 隔离并在有效期内恢复完整快照', () => {
  const saved = writeRetainedListSession('task-list|user-a', {
    scrollTop: 1280,
    anchor: { id: 'mci-task-42', offset: 18 },
    payload: { rows: [{ Id: '42' }], keyword: '水泵' }
  }, { now: 1000, ttl: 5000 })

  assert.equal(saved.key, 'task-list|user-a')
  assert.deepEqual(readRetainedListSession('task-list|user-a', { now: 5999, ttl: 5000 }), saved)
  assert.equal(readRetainedListSession('task-list|user-b', { now: 5999, ttl: 5000 }), null)
})

test('列表会话过期后删除，容量淘汰遵循最近使用顺序', () => {
  writeRetainedListSession('expired', { payload: {} }, { now: 1000, ttl: 500 })
  assert.equal(readRetainedListSession('expired', { now: 1501, ttl: 500 }), null)

  writeRetainedListSession('a', { payload: { value: 'a' } }, { now: 2000, maxEntries: 2 })
  writeRetainedListSession('b', { payload: { value: 'b' } }, { now: 2001, maxEntries: 2 })
  assert.ok(readRetainedListSession('a', { now: 2002 }))
  writeRetainedListSession('c', { payload: { value: 'c' } }, { now: 2003, maxEntries: 2 })

  assert.equal(readRetainedListSession('b', { now: 2004 }), null)
  assert.equal(retainedListSessionCount(), 2)
})

test('列表会话支持按前缀清理', () => {
  writeRetainedListSession('task-list|a', { payload: {} })
  writeRetainedListSession('task-devices|a', { payload: {} })
  writeRetainedListSession('other|a', { payload: {} })
  clearRetainedListSessions('task-')

  assert.equal(readRetainedListSession('task-list|a'), null)
  assert.equal(readRetainedListSession('task-devices|a'), null)
  assert.ok(readRetainedListSession('other|a'))
})

test('售后任务和任务设备显式接入同一套列表会话能力', () => {
  for (const source of [taskListSource, deviceListSource]) {
    assert.match(source, /listReturnMixin/)
    assert.match(source, /shouldMciRetainListSession\(\)/)
    assert.match(source, /getMciListSnapshotKey\(\)/)
    assert.match(source, /getMciListSnapshot\(\)/)
    assert.match(source, /mciApplyListSnapshotPosition\(snapshot\)/)
    assert.match(source, /mciRestoreListAnchor\(snapshot\.anchor, snapshot\.scrollTop\)/)
    assert.match(source, /:scroll-top="mciScrollCommand"/)
    assert.match(source, /@scroll="handleMciListScroll"/)
  }
  assert.match(listReturnSource, /writeRetainedListSession/)
  assert.match(requestSource, /export function removeToken\(\)[\s\S]*clearRetainedListSessions\(\)/)
})
