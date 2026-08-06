import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createMicroiV8 as createProjectSdk } from '../src/utils/microi.v8.js'
import { createMicroiV8 as createStandardSdk } from '../../microi.skills/microi.v8.js'

function createStorage() {
  const values = new Map()
  return {
    get: (key) => values.get(key) || '',
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key)
  }
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function expectRejected(promise) {
  try {
    await promise
    assert.fail('请求应当失败')
  } catch (error) {
    return error
  }
}

async function verifySdk(name, createMicroiV8) {
  const pending = []
  let authExpiredCount = 0
  const V8 = createMicroiV8({
    apiBase: 'https://api.example.test',
    osClient: 'demo',
    storage: createStorage(),
    requestAdapter(options) {
      const task = deferred()
      pending.push({ options, task })
      return task.promise
    },
    onAuthExpired() {
      authExpiredCount += 1
    }
  })

  V8.setToken('old-token')
  const staleExpired = V8.get('/protected', {}, { silentError: true })
  await Promise.resolve()
  assert.equal(pending[0].options.header.Token, 'old-token', `${name}: 请求应携带旧 Token`)
  V8.setToken('new-login-token')
  pending[0].task.resolve({ data: { Code: 1001, Msg: '旧会话已失效' }, statusCode: 200, header: {} })
  await expectRejected(staleExpired)
  assert.equal(V8.getToken(), 'new-login-token', `${name}: 旧 1001 不得清除新 Token`)
  assert.equal(authExpiredCount, 0, `${name}: 旧 1001 不得触发跳登录`)

  const staleRotation = V8.get('/protected', {}, { silentError: true })
  await Promise.resolve()
  V8.setToken('newer-token')
  pending[1].task.resolve({ data: { Code: 1 }, statusCode: 200, header: { authorization: 'Bearer old-rotated-token' } })
  await staleRotation
  assert.equal(V8.getToken(), 'newer-token', `${name}: 旧响应不得覆盖更新后的 Token`)

  const currentExpired = V8.get('/protected', {}, { silentError: true })
  await Promise.resolve()
  pending[2].task.resolve({ data: { Code: 1001, Msg: '当前会话已失效' }, statusCode: 200, header: {} })
  await expectRejected(currentExpired)
  assert.equal(V8.getToken(), '', `${name}: 当前会话真实失效时应清理 Token`)
  assert.equal(authExpiredCount, 1, `${name}: 当前会话真实失效时应提示一次`)

  const login = V8.post('/api/SysUser/Login', {}, { auth: false, silentError: true })
  await Promise.resolve()
  pending[3].task.resolve({ data: { Code: 1, Data: { Id: 'user-1' } }, statusCode: 200, header: { authorization: 'Bearer login-token' } })
  await login
  assert.equal(V8.getToken(), 'login-token', `${name}: 匿名登录响应应建立新会话`)
}

await verifySdk('project sdk', createProjectSdk)
await verifySdk('standard sdk', createStandardSdk)

const loginSource = readFileSync(fileURLToPath(new URL('../src/pages/login/index.vue', import.meta.url)), 'utf8')
assert.equal(
  (loginSource.match(/if \(!isValidLoginSession\(currentUser, token\)\)/g) || []).length,
  3,
  '三种登录入口都必须同时校验 Token 和用户 Id'
)
assert.ok(!loginSource.includes('setUser(result.Data)'), '登录页不得缓存未经归一化和校验的响应包装对象')
console.log('auth session race checks passed')
