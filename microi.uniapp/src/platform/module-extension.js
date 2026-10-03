import tenantBusiness from '@/generated/tenant-business.js'

const extension = tenantBusiness && typeof tenantBusiness === 'object' ? tenantBusiness : {}

export function getTenantModuleRowActions(context = {}, row = {}) {
  const handler = extension.getModuleRowActions
  if (typeof handler !== 'function') return []
  const actions = handler(context, row)
  return Array.isArray(actions) ? actions.filter((item) => item && item.Key && item.Label && item.ActionType) : []
}

export default { getTenantModuleRowActions }
