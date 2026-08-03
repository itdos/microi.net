function uniqueLowercase(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))]
}

export function normalizeRoleIds(value) {
  if (value === undefined || value === null || value === '') return []
  if (Array.isArray(value)) return uniqueLowercase(value.flatMap((item) => normalizeRoleIds(item)))
  if (typeof value === 'object') {
    const candidate = value.Id ?? value.id ?? value.RoleId ?? value.roleId ?? value.Value ?? value.value
    return candidate === undefined ? [] : normalizeRoleIds(candidate)
  }

  const text = String(value).trim()
  if (!text) return []
  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    try {
      return normalizeRoleIds(JSON.parse(text))
    } catch (error) {}
  }
  return uniqueLowercase(text.split(/[,，;；|]/))
}

export function currentUserRoleIds(user = {}) {
  return normalizeRoleIds([
    user.RoleIds,
    user.RoleId,
    user.SysRoleIds,
    user.CurrentRoleId,
    user._Roles,
    user.Roles
  ])
}

export function isPlatformAdmin(user = {}) {
  const explicitAdmin = user._IsAdmin === true || user._IsAdmin === 1 ||
    ['1', 'true'].includes(String(user._IsAdmin || '').toLowerCase())
  return explicitAdmin || Number(user.Level || 0) >= 9999
}

export function nativeFieldRoleVisibility(field = {}, user = {}) {
  const bindRoleIds = normalizeRoleIds(field.BindRole)
  if (!bindRoleIds.length || isPlatformAdmin(user)) {
    return { visible: true, bindRoleIds }
  }
  const userRoleIds = new Set(currentUserRoleIds(user))
  return {
    visible: bindRoleIds.some((roleId) => userRoleIds.has(roleId)),
    bindRoleIds
  }
}

export function nativeRoleCacheKey(user = {}) {
  return JSON.stringify({
    admin: isPlatformAdmin(user),
    roles: currentUserRoleIds(user).sort()
  })
}

function collapseConfig(field = {}) {
  if (field.config?.CollapseGroup) return field.config.CollapseGroup
  try {
    const config = typeof field.Config === 'string' ? JSON.parse(field.Config) : field.Config
    return config?.CollapseGroup || {}
  } catch (error) {
    return {}
  }
}

export function filterFieldsByHiddenCollapseScope(fields = [], options = {}) {
  const layoutComponents = new Set(options.layoutComponents || [])
  const guardedComponents = new Set(options.guardedComponents || [])
  const hiddenScopes = new Map()
  const result = []

  fields.forEach((field) => {
    const rawTab = field.Tab && field.Tab !== 'none' ? String(field.Tab) : ''
    const tabKey = field.formTabKey || rawTab || '__basic__'
    if (field.component === 'CollapseGroup') {
      if (field.visible) {
        hiddenScopes.delete(tabKey)
        result.push(field)
      } else {
        const collapse = collapseConfig(field)
        const scopeMode = String(collapse.ScopeMode || 'UntilNextGroup').toLowerCase()
        const configuredCount = Math.max(0, Number(collapse.FieldCount || 0))
        hiddenScopes.set(tabKey, {
          remaining: scopeMode === 'fieldcount'
            ? (configuredCount || Number.POSITIVE_INFINITY)
            : Number.POSITIVE_INFINITY
        })
      }
      return
    }
    if (layoutComponents.has(field.component)) {
      hiddenScopes.delete(tabKey)
      if (field.visible) result.push(field)
      return
    }

    const hiddenScope = hiddenScopes.get(tabKey)
    if (hiddenScope) {
      if (!guardedComponents.has(field.component) && Number.isFinite(hiddenScope.remaining)) {
        hiddenScope.remaining -= 1
        if (hiddenScope.remaining <= 0) hiddenScopes.delete(tabKey)
      }
      return
    }
    if (field.visible) result.push(field)
  })
  return result
}
