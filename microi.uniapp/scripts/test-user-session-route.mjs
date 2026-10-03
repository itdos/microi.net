import assert from 'node:assert/strict'
import test from 'node:test'
import {
  USER_SESSION_ENGINE_PATH,
  buildUserSessionPayload,
  requestUserSession
} from '../src/platform/user-session-route.mjs'

test('uses the managed user-session engine and supplies the explicit action', async () => {
  let legacyCalls = 0
  const result = await requestUserSession({
    action: 'Login',
    data: { Account: 'reviewer' },
    requestPrimary: async (url, data) => {
      assert.equal(url, USER_SESSION_ENGINE_PATH)
      assert.deepEqual(data, { Account: 'reviewer', Action: 'Login' })
      return { Code: 1 }
    },
    requestLegacy: async () => {
      legacyCalls += 1
    }
  })
  assert.equal(result.Code, 1)
  assert.equal(legacyCalls, 0)
})

test('does not retry a business-level login rejection', async () => {
  let legacyCalls = 0
  const result = await requestUserSession({
    action: 'Login',
    requestPrimary: async () => ({ Code: 0, Msg: '用户名或密码错误' }),
    requestLegacy: async () => {
      legacyCalls += 1
    }
  })
  assert.equal(result.Code, 0)
  assert.equal(legacyCalls, 0)
})

test('falls back to the legacy Controller when the managed route is unavailable', async () => {
  const failure = new Error('HTTP 404')
  const result = await requestUserSession({
    action: 'RefreshToken',
    data: { authorization: 'masked' },
    requestPrimary: async () => { throw failure },
    requestLegacy: async (url, data, primaryError) => {
      assert.equal(url, '/api/SysUser/RefreshToken')
      assert.deepEqual(data, { authorization: 'masked' })
      assert.equal(primaryError, failure)
      return { Code: 1 }
    }
  })
  assert.equal(result.Code, 1)
})

test('rejects an empty action before issuing a request', async () => {
  assert.throws(() => buildUserSessionPayload('', {}), /动作不能为空/)
})
