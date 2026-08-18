const SYSTEM_PARAMETER_FIELD_NAMES = new Set([
  'id',
  'createtime',
  'updatetime',
  'createuserid',
  'createuser',
  'createusername',
  'updateuserid',
  'updateuser',
  'updateusername',
  'userid',
  'username',
  'isdeleted',
  'osclient'
])

export function filterProductParameterFields(fields) {
  if (!Array.isArray(fields)) return []

  return fields.filter((field) => {
    const name = String(field && (field.Name || field.name) || '').trim().toLowerCase()
    return Boolean(name) && !SYSTEM_PARAMETER_FIELD_NAMES.has(name)
  })
}

export function formatProductParameterValue(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}
