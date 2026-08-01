import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SITE_DID_STORAGE_KEY,
  buildSiteSessionHeaders,
  getOrCreateSiteDid,
  isSiteSessionExpired,
  normalizeSiteToken,
  readRotatedSiteToken
} from '../docs/.vitepress/theme/utils/site-session.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    value: key => values.get(key)
  }
}

test('creates one stable printable website did and reuses it', () => {
  const storage = memoryStorage()
  const cryptoApi = { randomUUID: () => '11111111-2222-4333-8444-555555555555' }
  const first = getOrCreateSiteDid(storage, cryptoApi)
  const second = getOrCreateSiteDid(storage, { randomUUID: () => 'different' })
  assert.equal(first, 'MicroiWeb:11111111-2222-4333-8444-555555555555')
  assert.equal(second, first)
  assert.equal(storage.value(SITE_DID_STORAGE_KEY), first)
})

test('reuses the established Microi.Client Did when available', () => {
  const storage = memoryStorage({ Did: '01JTESTDEVICE00000000000000' })
  assert.equal(getOrCreateSiteDid(storage), '01JTESTDEVICE00000000000000')
})

test('builds the complete authenticated website session headers', () => {
  assert.deepEqual(buildSiteSessionHeaders({ token: 'Bearer abc', osClient: 'iTdos', did: 'device-1' }), {
    'Content-Type': 'application/json',
    osclient: 'iTdos',
    did: 'device-1',
    authorization: 'Bearer abc',
    Token: 'abc'
  })
})

test('reads rotated tokens and does not mistake a business permission error for expiry', () => {
  const response = { headers: { get: name => name === 'authorization' ? 'Bearer rotated-token' : '' } }
  assert.equal(readRotatedSiteToken(response), 'rotated-token')
  assert.equal(normalizeSiteToken('Bearer old-token'), 'old-token')
  assert.equal(isSiteSessionExpired({ Code: 0, Msg: '您没有权限做此操作！' }), false)
  assert.equal(isSiteSessionExpired({ Code: 1001, Msg: 'Token失效' }), true)
})
