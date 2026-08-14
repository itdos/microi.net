function roleLimits(user) {
  const value = user && user._RoleLimits
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

function permissionNames(permission) {
  if (Array.isArray(permission)) {
    return permission.map((item) => String(item && item.Name || item || '').trim()).filter(Boolean)
  }
  if (typeof permission === 'string') {
    try {
      const parsed = JSON.parse(permission)
      if (Array.isArray(parsed)) return permissionNames(parsed)
    } catch (error) {}
    return permission.split(',').map((item) => String(item || '').trim()).filter(Boolean)
  }
  return []
}

export function isPlatformAdmin(user = {}) {
  return user._IsAdmin === true || Number(user.Level || 0) >= 999
}

export function hasExactMenuPermission(menuId, names, user = {}) {
  if (isPlatformAdmin(user)) return true
  if (!menuId) return false
  const expected = new Set((Array.isArray(names) ? names : [names]).map((item) => String(item || '').trim()))
  return roleLimits(user)
    .filter((item) => String(item.FkId || '') === String(menuId))
    .some((row) => permissionNames(row.Permission).some((name) => expected.has(name)))
}

export function canDeleteMenuRecord(menuId, user = {}) {
  return hasExactMenuPermission(menuId, ['Del', '删除'], user)
}
