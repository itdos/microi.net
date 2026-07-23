export function appendOpenTableWhere({ where }) {
  return where
}

export async function submitTenantOpenTableSelection() {
  return { matched: false }
}

export default {
  appendOpenTableWhere,
  submitTenantOpenTableSelection
}
