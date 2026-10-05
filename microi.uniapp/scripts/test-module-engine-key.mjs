import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { resolveModuleEngineKey } from '../src/platform/module-engine-key.mjs'

test('dynamic menu key is preferred over the physical table name', () => {
  assert.equal(resolveModuleEngineKey({
    key: 'Diy_logbook1',
    table: 'diy_logbook'
  }), 'Diy_logbook1')
})

test('explicit engine keys retain priority and table remains a legacy fallback', () => {
  assert.equal(resolveModuleEngineKey({ moduleEngineKey: 'explicit', key: 'dynamic', table: 'table' }), 'explicit')
  assert.equal(resolveModuleEngineKey({ ModuleEngineKey: 'legacy-explicit', key: 'dynamic', table: 'table' }), 'legacy-explicit')
  assert.equal(resolveModuleEngineKey({ table: 'legacy_table' }), 'legacy_table')
})

test('generic module list exposes a permission-gated header create command', async () => {
  const source = await readFile(new URL('../src/pages/module/list.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="canAddRecord" class="module-nav__button module-nav__button--add"[^>]*[\s\S]*?@tap="openAdd"/)
  assert.doesNotMatch(source, /class="floating-add"[^>]*@tap="openAdd"/)
  assert.match(source, /canAddMenuRecord\(this\.menuId, getUser\(\) \|\| \{\}\)/)
  assert.match(source, /openAdd\(\)/)
})
