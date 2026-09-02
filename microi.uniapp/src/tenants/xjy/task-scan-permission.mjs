export const TASK_SCAN_PROCESS_ROLES = Object.freeze([
  '售后工程师',
  '售后主管',
  '客服',
  '客服主管',
  '总经理',
  '杭州总经理',
  '新纪源总经理',
  '超级管理员'
])

function appendRoleNames(value, names) {
  if (value === undefined || value === null || value === '') return
  if (Array.isArray(value)) {
    value.forEach((item) => appendRoleNames(item, names))
    return
  }
  if (typeof value === 'object') {
    appendRoleNames(value.Name || value.RoleName || value.Label || value.Value, names)
    return
  }
  const text = String(value).trim()
  if (!text) return
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      appendRoleNames(JSON.parse(text), names)
      return
    } catch (error) {}
  }
  text.split(/[,，;；|]/).forEach((item) => {
    const name = String(item || '').trim()
    if (name && !names.includes(name)) names.push(name)
  })
}

export function taskScanRoleNames(user = {}) {
  const names = []
  ;[user.RoleIds, user.RoleIdsString, user._Roles, user.Roles, user.RoleName]
    .forEach((value) => appendRoleNames(value, names))
  return names
}

function tenantId(source = {}) {
  return String(source.TenantId || source.TenantID || source.ShangjiaID || source.ShangjiaId || '').trim()
}

export function taskScanProcessAccess(task = {}, user = {}) {
  if (!user.Id) return { allowed: false, reason: '请先登录后再处理设备' }

  const roles = taskScanRoleNames(user)
  const isSuperAdmin = Number(user.Level || 0) >= 9999 || roles.includes('超级管理员')
  if (isSuperAdmin) return { allowed: true, reason: '' }

  if (!roles.some((role) => TASK_SCAN_PROCESS_ROLES.includes(role))) {
    return { allowed: false, reason: '仅售后工程师、售后主管、客服、客服主管、总经理或超级管理员可处理设备' }
  }

  const userTenantId = tenantId(user)
  const taskTenantId = tenantId(task)
  if (!userTenantId || !taskTenantId) {
    return { allowed: false, reason: '未能确认当前账号与任务的商家归属，请联系管理员完善资料' }
  }
  if (userTenantId !== taskTenantId) {
    return { allowed: false, reason: '仅任务所属商家的授权人员可处理该设备' }
  }
  return { allowed: true, reason: '' }
}
