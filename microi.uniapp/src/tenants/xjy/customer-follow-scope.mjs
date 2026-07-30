export const CUSTOMER_FOLLOW_FIELDS = Object.freeze({
  owner: 'FuzeR',
  ownerId: 'FuzeRID',
  ownerPhone: 'FuzeRDH',
  status: 'KehuGJZT',
  statusValue: 'KehuGJZTZ'
})

function hasValue(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '[]'
  if (Array.isArray(value)) return value.some(hasValue)
  if (typeof value === 'object') return Object.values(value).some(hasValue)
  return true
}

export function hasCustomerOwner(form = {}) {
  return hasValue(form[CUSTOMER_FOLLOW_FIELDS.ownerId]) ||
    hasValue(form[CUSTOMER_FOLLOW_FIELDS.owner])
}

export function customerFollowScopeValues(form = {}) {
  const isPrivate = hasCustomerOwner(form)
  return {
    [CUSTOMER_FOLLOW_FIELDS.status]: isPrivate ? '私有' : '公海',
    [CUSTOMER_FOLLOW_FIELDS.statusValue]: isPrivate ? 1 : 2
  }
}
