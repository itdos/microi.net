import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const file = fileURLToPath(new URL('../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/AI应用/microi-ai-cad/tests/plan-engine.test.mjs', import.meta.url))
test('吾码 AI CAD 接口引擎回归纳入统一门禁', () => {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', env, windowsHide: true, timeout: 30000 })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /# pass 5/)
})
