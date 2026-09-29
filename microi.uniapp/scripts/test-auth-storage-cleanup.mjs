import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearAuthScopedStorageCaches,
  isAuthScopedStorageCacheKey
} from '../src/platform/auth-storage-cleanup.mjs'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getStorageInfoSync: () => ({ keys: [...values.keys()] }),
    removeStorageSync: key => values.delete(key)
  }
}

test('退出登录清除可重建的账号与平台缓存', () => {
  const storage = memoryStorage({
    SysConfig: 'cached',
    sys_config_cache: 'cached',
    microi_diy_table_ids_v2: 'cached',
    mci_ai_model_selection: 'cached',
    xjy_ai_model_selection: 'cached',
    'microi_mobile_menu_tree_v2:user-a': 'cached',
    'microi_mobile_menu_tree_v2:user-b': 'cached',
    microi_did: 'stable-device',
    mci_login_preferences_v2: 'remembered-account',
    mci_theme: 'preferred-theme',
    xjy_complaint_draft_key: 'business-draft'
  })

  const result = clearAuthScopedStorageCaches(storage)

  assert.equal(result.failed.length, 0)
  assert.equal(storage.values.has('SysConfig'), false)
  assert.equal(storage.values.has('sys_config_cache'), false)
  assert.equal(storage.values.has('microi_diy_table_ids_v2'), false)
  assert.equal(storage.values.has('mci_ai_model_selection'), false)
  assert.equal(storage.values.has('xjy_ai_model_selection'), false)
  assert.equal(storage.values.has('microi_mobile_menu_tree_v2:user-a'), false)
  assert.equal(storage.values.has('microi_mobile_menu_tree_v2:user-b'), false)
  assert.equal(storage.values.get('microi_did'), 'stable-device')
  assert.equal(storage.values.get('mci_login_preferences_v2'), 'remembered-account')
  assert.equal(storage.values.get('mci_theme'), 'preferred-theme')
  assert.equal(storage.values.get('xjy_complaint_draft_key'), 'business-draft')
})

test('缓存 Key 识别只命中明确的可重建数据', () => {
  assert.equal(isAuthScopedStorageCacheKey('microi_mobile_menu_tree_v2:user-a'), true)
  assert.equal(isAuthScopedStorageCacheKey('microi_diy_table_ids_v2'), true)
  assert.equal(isAuthScopedStorageCacheKey('microi_did'), false)
  assert.equal(isAuthScopedStorageCacheKey('mci_login_preferences_v2'), false)
  assert.equal(isAuthScopedStorageCacheKey('xjy_complaint_draft_key'), false)
})

test('存储枚举失败时仍清理固定缓存且不阻断退出', () => {
  const removed = []
  const runtimeUni = {
    getStorageInfoSync() { throw new Error('storage enumeration failed') },
    removeStorageSync(key) { removed.push(key) }
  }

  const result = clearAuthScopedStorageCaches(runtimeUni)
  assert.equal(result.failed.length, 0)
  assert.deepEqual(new Set(removed), new Set([
    'SysConfig',
    'sys_config_cache',
    'microi_diy_table_ids_v2',
    'mci_ai_model_selection',
    'xjy_ai_model_selection'
  ]))
})

test('退出登录清除模块、详情、表单与页面状态等通用派生缓存', async () => {
  const originalUni = globalThis.uni
  const storage = memoryStorage()
  globalThis.uni = {
    getStorageSync: key => storage.values.get(key) || '',
    setStorageSync: (key, value) => storage.values.set(key, value),
    removeStorageSync: key => storage.values.delete(key),
    getStorageInfoSync: storage.getStorageInfoSync
  }

  try {
    const cache = await import(`../src/platform/cache.js?auth-cleanup=${Date.now()}`)
    cache.writeCache('module:user-a:customers', { rows: [{ Id: 'customer-1' }] })
    cache.writeCache('task:detail:user-a:task-1', { Id: 'task-1' })
    cache.writePageState('task-draft:task-1', { Content: 'old account draft' })
    assert.equal(storage.values.size, 3)

    cache.clearPlatformCache()

    assert.equal(storage.values.size, 0)
    assert.equal(cache.readCache('module:user-a:customers'), null)
    assert.equal(cache.readCache('task:detail:user-a:task-1'), null)
    assert.deepEqual(cache.readPageState('task-draft:task-1', {}), {})
  } finally {
    if (originalUni === undefined) delete globalThis.uni
    else globalThis.uni = originalUni
  }
})
