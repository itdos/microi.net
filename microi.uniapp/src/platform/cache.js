const PREFIX = 'microi_uniapp_cache_v3:'
const memory = new Map()
const inflight = new Map()

function storageGet(key) {
  try {
    const value = uni.getStorageSync(PREFIX + key)
    if (!value) return null
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch (error) {
    return null
  }
}

function storageSet(key, value) {
  try { uni.setStorageSync(PREFIX + key, JSON.stringify(value)) } catch (error) {}
}

export function readCache(key, maxAge = 5 * 60 * 1000) {
  const item = memory.get(key) || storageGet(key)
  if (!item || !item.time) return null
  memory.set(key, item)
  return {
    data: item.data,
    stale: Date.now() - item.time > maxAge,
    age: Date.now() - item.time
  }
}

export function writeCache(key, data) {
  const item = { time: Date.now(), data }
  memory.set(key, item)
  storageSet(key, item)
  return data
}

export function removeCache(key) {
  memory.delete(key)
  try { uni.removeStorageSync(PREFIX + key) } catch (error) {}
}

export function removeCachePrefix(prefix) {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key)
  }
  try {
    const info = uni.getStorageInfoSync()
    ;(info.keys || []).forEach((key) => {
      if (key.startsWith(PREFIX + prefix)) uni.removeStorageSync(key)
    })
  } catch (error) {}
}

export function dedupeRequest(key, loader) {
  if (inflight.has(key)) return inflight.get(key)
  const task = Promise.resolve()
    .then(loader)
    .finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

export async function cachedRequest(key, loader, options = {}) {
  const maxAge = Number(options.maxAge || 5 * 60 * 1000)
  const cached = options.refresh ? null : readCache(key, maxAge)
  if (cached && !cached.stale) return { data: cached.data, fromCache: true, stale: false }
  try {
    const data = await dedupeRequest(key, loader)
    writeCache(key, data)
    return { data, fromCache: false, stale: false }
  } catch (error) {
    if (cached && options.allowStale !== false) return { data: cached.data, fromCache: true, stale: true, error }
    throw error
  }
}

export function readPageState(key, fallback = {}) {
  const cached = readCache(`page:${key}`, 30 * 24 * 60 * 60 * 1000)
  return cached ? cached.data : fallback
}

export function writePageState(key, value) {
  return writeCache(`page:${key}`, value)
}

export default {
  readCache,
  writeCache,
  removeCache,
  removeCachePrefix,
  dedupeRequest,
  cachedRequest,
  readPageState,
  writePageState
}
