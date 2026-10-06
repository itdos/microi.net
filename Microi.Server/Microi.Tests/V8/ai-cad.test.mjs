import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { officialApplicationSource } from './official-application-source.mjs'

const file = path.join(officialApplicationSource('microi-ai-cad'), 'tests/plan-engine.test.mjs')
test('吾码 AI CAD 接口引擎回归纳入统一门禁', () => {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { encoding: 'utf8', env, windowsHide: true, timeout: 30000 })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /# pass 5/)
})
