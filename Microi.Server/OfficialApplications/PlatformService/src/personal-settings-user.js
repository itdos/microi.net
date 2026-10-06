// Role data from historic databases may be a JSON string; refreshed _Roles is an array.
function readRoleNames(value, depth = 0) {
  if (depth > 3 || value == null) return []
  if (Array.isArray(value)) return value.flatMap(item => readRoleNames(item, depth + 1))
  if (typeof value === 'object') return readRoleNames(value.Name ?? value.RoleName ?? value.name, depth + 1)
  if (typeof value !== 'string') return []
  const text = value.trim()
  if (!text || text === 'null' || text === 'undefined') return []
  if (/^[\[{"]/.test(text)) {
    try { return readRoleNames(JSON.parse(text), depth + 1) } catch { return [] }
  }
  return [text]
}

export function getUserRoleNames(user) {
  for (const value of [user?.RoleName, user?._Roles, user?.Roles]) {
    const names = [...new Set(readRoleNames(value))]
    if (names.length) return names.join('、')
  }
  return '普通用户'
}
