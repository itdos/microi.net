function parseRoles(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  if (typeof value !== 'string') return []
  const text = value.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    return text.split(/[,，;；]/).map((name) => ({ Name: name.trim() })).filter((role) => role.Name)
  }
}

export const businessGroups = []
export const businessModules = {}
export const quickActions = []

export function getBusinessModule() {
  return null
}

export function getBusinessEntry() {
  return null
}

export function getRoleProfile(user = {}) {
  const roleNames = [user.RoleIds, user._Roles, user.Roles, user.RoleName]
    .reduce((rows, value) => rows.concat(parseRoles(value)), [])
    .map((role) => typeof role === 'string' ? role : role && (role.Name || role.RoleName || role.Label || role.Value))
    .filter(Boolean)
    .map((name) => String(name).trim())
    .filter((name, index, values) => values.indexOf(name) === index)
  const roleText = roleNames.join('、')
  const isAdmin = Number(user.Level || 0) >= 998 || roleText.includes('管理员')
  const organization = [user.TenantName, user.Position || user.JobName || user.DeptName]
    .filter((value, index, values) => value && values.indexOf(value) === index)
  return {
    isAdmin,
    isService: false,
    isSupport: false,
    isSales: false,
    isCustomer: false,
    isInternal: !!(user.Id || user.TenantId || user.DeptId),
    roleNames,
    roleText: roleText || '平台用户',
    primaryRole: roleNames[0] || '平台用户',
    tenantName: user.TenantName || '',
    departmentName: user.DeptName || '',
    positionName: user.Position || user.JobName || '',
    organizationText: organization.join(' · '),
    identityText: [...organization, roleText].filter(Boolean).join(' · '),
    allowedGroupKeys: [],
    primaryActions: []
  }
}

export default {
  businessGroups,
  businessModules,
  quickActions,
  getBusinessModule,
  getBusinessEntry,
  getRoleProfile
}
