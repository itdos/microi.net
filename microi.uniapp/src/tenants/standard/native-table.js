export function appendOpenTableWhere({ where }) {
  return where
}

export function validateOpenTableContext() {
  return ''
}

export async function submitTenantOpenTableSelection() {
  return { matched: false }
}

export default {
  appendOpenTableWhere,
  validateOpenTableContext,
  submitTenantOpenTableSelection
}
