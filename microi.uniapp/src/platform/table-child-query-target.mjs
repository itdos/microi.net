function parseArrayConfig(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function normalizedId(value) {
  return String(value || '').trim().toLowerCase()
}

export function tableChildRequiresModuleQuery(menuModel = {}, primaryTableId = '') {
  if (typeof menuModel.SqlJoin === 'string' && menuModel.SqlJoin.trim()) return true
  if (parseArrayConfig(menuModel.JoinTables).length) return true

  const primaryId = normalizedId(primaryTableId || menuModel.DiyTableId)
  if (!primaryId) return false
  return parseArrayConfig(menuModel.SelectFields).some((field) => {
    if (!field || typeof field !== 'object') return false
    const fieldTableId = normalizedId(field.TableId || field.DiyTableId || field.tableId)
    return Boolean(fieldTableId && fieldTableId !== primaryId)
  })
}

export function tableChildQueryMode(menuModel = {}, primaryTableId = '') {
  return tableChildRequiresModuleQuery(menuModel, primaryTableId) ? 'module' : 'physical-table'
}
