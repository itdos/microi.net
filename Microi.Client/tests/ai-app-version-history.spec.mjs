import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const workbenchSource = fs.readFileSync(
  new URL('../src/views/ai-engine/ai-app-workbench.vue', import.meta.url),
  'utf8'
)

test('unversioned legacy snapshots have an explicit archive label', () => {
  assert.match(workbenchSource, /\^legacy-unversioned\(\?:-\|\$\)\/i/)
  assert.match(workbenchSource, /历史归档（未标版本）/)
  assert.match(workbenchSource, /formatVersionDisplay\(getAppCurrentVersion\(scope\.row\)\)/)
})

test('version history keeps real semantic releases ahead of unversioned archives', () => {
  assert.match(workbenchSource, /const sortedVersions = computed\(\(\) => \[\.\.\.\(versions\.value \|\| \[\]\)\]\.sort\(compareVersionItemsDesc\)\)/)
  assert.match(workbenchSource, /if \(aArchive !== bArchive\) return aArchive \? 1 : -1/)
  assert.match(workbenchSource, /const semanticOrder = compareVersionDesc\(aVersion, bVersion\)/)
  assert.match(workbenchSource, /if \(semanticOrder !== 0\) return semanticOrder/)
})

test('runtime version formatting remains separate from the archive display label', () => {
  assert.match(workbenchSource, /function formatVersionNo\(value\)[\s\S]*?return `v\$\{major\}\.\$\{minor\}\.\$\{patch\}`/)
  assert.match(workbenchSource, /function formatVersionDisplay\(value\)/)
  assert.doesNotMatch(workbenchSource, /function formatVersionNo\(value\)[\s\S]{0,180}历史归档（未标版本）/)
})
