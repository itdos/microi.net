import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('all built-in micro app hosts use the shared skeleton', () => {
  const skeleton = read('src/views/micro-app/loading-skeleton.vue')
  assert.match(skeleton, /micro-app-skeleton-shimmer/)
  assert.match(skeleton, /aria-busy="true"/)

  for (const file of ['dialog.vue', 'host.vue', 'dev-component.vue']) {
    const source = read(`src/views/micro-app/${file}`)
    assert.match(source, /MicroAppLoadingSkeleton/)
    assert.doesNotMatch(source, /<Loading\s*\/>/)
  }

  const customDialog = read('src/views/form-engine/diy-custom-dialog.vue')
  assert.match(customDialog, /<Suspense/)
  assert.match(customDialog, /BodyHeight/)
  assert.match(customDialog, /MicroAppLoadingSkeleton/)

  for (const file of ['diy-table-navigation.mixin.js', 'diy-form-navigation.mixin.js']) {
    const source = read(`src/views/form-engine/mixins/${file}`)
    assert.match(source, /BodyHeight:\s*param\.BodyHeight\s*\|\|\s*"min\(780px, calc\(100vh - 160px\)\)"/)
  }
})
