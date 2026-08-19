const DEFAULT_TTL = 12 * 60 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 24

const retainedSessions = new Map()

function normalizeKey(key) {
  return String(key || '').trim()
}

function normalizePositive(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function pruneExpired(now, ttl) {
  retainedSessions.forEach((entry, key) => {
    if (!entry || now - Number(entry.updatedAt || 0) > ttl) retainedSessions.delete(key)
  })
}

function pruneOverflow(maxEntries) {
  while (retainedSessions.size > maxEntries) {
    const oldestKey = retainedSessions.keys().next().value
    if (oldestKey === undefined) break
    retainedSessions.delete(oldestKey)
  }
}

export function writeRetainedListSession(key, snapshot, options = {}) {
  const normalizedKey = normalizeKey(key)
  if (!normalizedKey || !snapshot || typeof snapshot !== 'object') return null

  const now = Number(options.now === undefined ? Date.now() : options.now)
  const ttl = normalizePositive(options.ttl, DEFAULT_TTL)
  const maxEntries = normalizePositive(options.maxEntries, DEFAULT_MAX_ENTRIES)
  pruneExpired(now, ttl)

  const oldEntry = retainedSessions.get(normalizedKey)
  const entry = {
    ...snapshot,
    key: normalizedKey,
    createdAt: Number(snapshot.createdAt || (oldEntry && oldEntry.createdAt) || now),
    updatedAt: now
  }
  retainedSessions.delete(normalizedKey)
  retainedSessions.set(normalizedKey, entry)
  pruneOverflow(maxEntries)
  return entry
}

export function readRetainedListSession(key, options = {}) {
  const normalizedKey = normalizeKey(key)
  if (!normalizedKey) return null

  const now = Number(options.now === undefined ? Date.now() : options.now)
  const ttl = normalizePositive(options.ttl, DEFAULT_TTL)
  const entry = retainedSessions.get(normalizedKey)
  if (!entry || now - Number(entry.updatedAt || 0) > ttl) {
    retainedSessions.delete(normalizedKey)
    return null
  }

  // 读命中后移动到末尾，使容量淘汰遵循最近使用顺序。
  retainedSessions.delete(normalizedKey)
  retainedSessions.set(normalizedKey, entry)
  return entry
}

export function removeRetainedListSession(key) {
  const normalizedKey = normalizeKey(key)
  if (normalizedKey) retainedSessions.delete(normalizedKey)
}

export function clearRetainedListSessions(prefix = '') {
  const normalizedPrefix = normalizeKey(prefix)
  if (!normalizedPrefix) {
    retainedSessions.clear()
    return
  }
  retainedSessions.forEach((entry, key) => {
    if (key.startsWith(normalizedPrefix)) retainedSessions.delete(key)
  })
}

export function retainedListSessionCount() {
  return retainedSessions.size
}

export const listSessionDefaults = Object.freeze({
  ttl: DEFAULT_TTL,
  maxEntries: DEFAULT_MAX_ENTRIES
})
