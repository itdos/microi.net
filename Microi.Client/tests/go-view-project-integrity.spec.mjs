import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createLatestRequestGate,
  createSerialTaskQueue,
  findDuplicateComponentIds
} from '../src/views/go-view/src/utils/projectIntegrity.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('latest request gate rejects every stale project response', () => {
  const gate = createLatestRequestGate()
  const first = gate.begin()
  const second = gate.begin()

  assert.equal(gate.isCurrent(first), false)
  assert.equal(gate.isCurrent(second), true)

  gate.invalidate()
  assert.equal(gate.isCurrent(second), false)
})

test('component restore queue serializes tasks and waits for tasks appended while waiting', async () => {
  const queue = createSerialTaskQueue()
  const events = []
  let releaseFirst
  let releaseSecond

  const firstBlocker = new Promise(resolve => {
    releaseFirst = resolve
  })
  const secondBlocker = new Promise(resolve => {
    releaseSecond = resolve
  })

  const first = queue.run(async () => {
    events.push('first:start')
    await firstBlocker
    events.push('first:end')
  })
  await Promise.resolve()

  let idleResolved = false
  const idle = queue.onIdle().then(() => {
    idleResolved = true
  })
  const second = queue.run(async () => {
    events.push('second:start')
    await secondBlocker
    events.push('second:end')
  })

  assert.deepEqual(events, ['first:start'])
  releaseFirst()
  await first
  await Promise.resolve()
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start'])
  assert.equal(idleResolved, false)

  releaseSecond()
  await Promise.all([second, idle])
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end'])
  assert.equal(idleResolved, true)
})

test('component restore queue remains usable after a failed task', async () => {
  const queue = createSerialTaskQueue()
  await assert.rejects(queue.run(async () => {
    throw new Error('expected restore failure')
  }), /expected restore failure/)

  const result = await queue.run(async () => 'recovered')
  assert.equal(result, 'recovered')
})

test('duplicate component ids are detected across top-level components and groups', () => {
  const componentList = [
    { id: 'top-a' },
    { id: 'group-a', isGroup: true, groupList: [{ id: 'child-a' }, { id: 'top-a' }] },
    { id: 'child-a' },
    { id: 'top-a' },
    { id: '' },
    null
  ]

  assert.deepEqual(findDuplicateComponentIds(componentList), ['top-a', 'child-a'])
  assert.deepEqual(findDuplicateComponentIds([{ id: 'a' }, { id: 'b' }]), [])
})

test('editor and preview discard stale responses and invalidate pending work on unmount', () => {
  for (const relativePath of ['src/views/go-view/editor.vue', 'src/views/go-view/preview.vue']) {
    const source = read(relativePath)
    assert.match(source, /createLatestRequestGate/)
    assert.match(source, /projectLoadGate:\s*markRaw\(createLatestRequestGate\(\)\)/)
    assert.match(source, /projectLoadGate\.isCurrent\(loadToken\)/)
    assert.match(source, /beforeUnmount\(\)\s*\{\s*this\.projectLoadGate\.invalidate\(\)/s)
  }
})

test('GoView restore is serialized and replacement commits the component list atomically', () => {
  const source = read('src/views/go-view/src/views/chart/hooks/useSync.hook.ts')
  assert.match(source, /createSerialTaskQueue/)
  assert.match(source, /componentUpdateQueue\.run\(async\s*\(\)\s*=>/)
  assert.match(source, /const nextComponentList/)
  assert.match(source, /chartEditStore\.componentList\s*=\s*nextComponentList/)
  assert.match(source, /export const waitForComponentUpdates/)
})

test('server save waits for restore completion and refuses duplicate component ids', () => {
  const source = read('src/views/go-view/src/views/chart/ContentHeader/headerRightBtn/index.vue')
  const projectIndex = source.indexOf('const projectId = getProjectId()')
  const waitIndex = source.indexOf('await waitForComponentUpdates()')
  const routeGuardIndex = source.indexOf('if (getProjectId() !== projectId) return null')
  const duplicateIndex = source.indexOf('findDuplicateComponentIds(storageInfo.componentList)')
  const writeIndex = source.indexOf('DiyCommon.FormEngine.UptFormData')

  assert.ok(projectIndex >= 0 && projectIndex < waitIndex, 'save must bind the destination project before waiting')
  assert.ok(waitIndex >= 0, 'save must wait for pending component restores')
  assert.ok(routeGuardIndex > waitIndex, 'save must abort when the destination route changes while waiting')
  assert.ok(duplicateIndex > waitIndex, 'duplicate validation must use the stable post-restore snapshot')
  assert.ok(writeIndex > duplicateIndex, 'duplicate validation must happen before the server write')

  for (const relativePath of ['src/lang/zh.js', 'src/lang/zh-tw.js', 'src/lang/en.js']) {
    assert.match(read(relativePath), /GoViewDuplicateComponentIds/)
  }
})

test('editor and preview fail closed when project data cannot be loaded', () => {
  for (const relativePath of ['src/views/go-view/editor.vue', 'src/views/go-view/preview.vue']) {
    const source = read(relativePath)
    assert.match(source, /if \(res\.Code !== 1 \|\| !res\.Data\)/)
    assert.match(source, /this\.loading = false/)
    assert.match(source, /return false\s*\n\s*}/)
  }
})
