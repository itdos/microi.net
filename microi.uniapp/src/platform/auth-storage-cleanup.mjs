// 退出或登录失效时只删除可从服务端重建的缓存；设备标识、主题、语言、
// 登录偏好和业务草稿不在此清单内，避免清理会话时破坏用户设置或未提交数据。
const AUTH_CACHE_EXACT_KEYS = Object.freeze([
  'SysConfig',
  'sys_config_cache',
  'microi_diy_table_ids_v2',
  'mci_ai_model_selection',
  'xjy_ai_model_selection'
])

const AUTH_CACHE_PREFIXES = Object.freeze([
  'microi_mobile_menu_tree_v2:'
])

export function isAuthScopedStorageCacheKey(key) {
  const value = String(key || '')
  return AUTH_CACHE_EXACT_KEYS.includes(value) || AUTH_CACHE_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function clearAuthScopedStorageCaches(runtimeUni) {
  const removed = []
  const failed = []
  if (!runtimeUni || typeof runtimeUni.removeStorageSync !== 'function') return { removed, failed }

  const targets = new Set(AUTH_CACHE_EXACT_KEYS)
  try {
    const info = typeof runtimeUni.getStorageInfoSync === 'function'
      ? runtimeUni.getStorageInfoSync()
      : { keys: [] }
    ;(info && Array.isArray(info.keys) ? info.keys : []).forEach((key) => {
      if (isAuthScopedStorageCacheKey(key)) targets.add(String(key))
    })
  } catch (error) {
    // 即使枚举失败也继续删除固定 Key，避免单个存储异常阻断退出流程。
  }

  targets.forEach((key) => {
    try {
      runtimeUni.removeStorageSync(key)
      removed.push(key)
    } catch (error) {
      failed.push(key)
    }
  })
  return { removed, failed }
}

export default {
  isAuthScopedStorageCacheKey,
  clearAuthScopedStorageCaches
}
