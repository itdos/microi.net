import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { shouldFallbackPlatformSysConfig } from '../src/utils/microi.v8.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('falls back only for an unavailable managed sys-config route', () => {
  assert.equal(shouldFallbackPlatformSysConfig({ statusCode: 404 }), true)
  assert.equal(shouldFallbackPlatformSysConfig({ status: 501 }), true)
  assert.equal(shouldFallbackPlatformSysConfig({ Code: 0, Msg: 'sys_apiengine platform-sys-config NoExistData' }), true)
  assert.equal(shouldFallbackPlatformSysConfig({ Code: 0, Msg: '租户未启用' }), false)
  assert.equal(shouldFallbackPlatformSysConfig({ Code: 1, Data: {} }), false)
})

test('login bootstrap and endpoint probe prefer the managed sys-config engine', () => {
  const requestSource = readFileSync(path.join(root, 'src', 'utils', 'request.js'), 'utf8')
  const loginSource = readFileSync(path.join(root, 'src', 'pages', 'login', 'index.vue'), 'utf8')
  const sysConfigSource = readFileSync(path.join(root, 'src', 'utils', 'sysconfig.js'), 'utf8')

  assert.match(requestSource, /\/apiengine\/platform-sys-config/)
  assert.match(requestSource, /apiengine:\s*'1'/)
  assert.match(requestSource, /\/api\/FormEngine\/GetSysConfig/)
  assert.match(loginSource, /getPlatformSysConfigResult\(/)
  assert.match(sysConfigSource, /getPlatformSysConfigResult\(/)
  assert.doesNotMatch(loginSource, /\/api\/DiyTable\/GetSysConfig/)
  assert.doesNotMatch(sysConfigSource, /\/api\/DiyTable\/GetSysConfig/)
})
