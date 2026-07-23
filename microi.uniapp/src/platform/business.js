import tenantBusiness from '@/generated/tenant-business.js'

export const businessGroups = tenantBusiness.businessGroups || []
export const businessModules = tenantBusiness.businessModules || {}
export const quickActions = tenantBusiness.quickActions || []

export function getBusinessModule(...args) {
  return tenantBusiness.getBusinessModule(...args)
}

export function getBusinessEntry(...args) {
  return tenantBusiness.getBusinessEntry(...args)
}

export function getRoleProfile(...args) {
  return tenantBusiness.getRoleProfile(...args)
}

export default {
  businessGroups,
  businessModules,
  quickActions,
  getBusinessModule,
  getBusinessEntry,
  getRoleProfile
}
