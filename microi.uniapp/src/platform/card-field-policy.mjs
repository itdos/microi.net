export const SYSTEM_AUDIT_FIELDS = [
  { Name: 'CreateTime', Label: '创建时间', component: 'DateTime', visible: true },
  { Name: 'UpdateTime', Label: '更新时间', component: 'DateTime', visible: true },
  { Name: 'UserName', Label: '创建人', component: 'Text', visible: true },
  { Name: 'UpdateUserName', Label: '更新人', component: 'Text', visible: true }
]

export function appendSystemAuditFields(fields = []) {
  return fields.concat(SYSTEM_AUDIT_FIELDS.filter((systemField) =>
    !fields.some((field) => String(field.Name || '').toLowerCase() === systemField.Name.toLowerCase())
  ))
}

export function shouldKeepEmptyCardLine(line) {
  return String(line && line.label || '').trim() === '负责人'
}

export function cardFieldKey(field) {
  if (field && typeof field === 'object') return String(field.field || field.Name || field.name || '').trim().toLowerCase()
  return String(field || '').trim().toLowerCase()
}

export function filterVisibleCardLines(lines = [], row = {}, occupiedFields = [], keepEmpty = shouldKeepEmptyCardLine) {
  const usedFields = new Set(occupiedFields.map(cardFieldKey).filter(Boolean))
  return lines.filter((line) => {
    const key = cardFieldKey(line)
    if (!key || usedFields.has(key)) return false
    usedFields.add(key)
    if (keepEmpty(line)) return true
    const field = line && typeof line === 'object' ? line.field : line
    return row[field] !== undefined && row[field] !== null && row[field] !== ''
  })
}

export function resolveConfiguredFieldNames(items = [], fields = []) {
  // 查询、筛选等旧调用方需要数据库真实字段名；卡片渲染若需要 AsName，
  // 应直接使用 resolveConfiguredFields 返回的 field。
  return resolveConfiguredFields(items, fields).map((item) => item.queryField)
}

export function resolveConfiguredFields(items = [], fields = []) {
  const byId = new Map(fields.map((field) => [String(field.Id || '').toLowerCase(), field]))
  const byName = new Map(fields.map((field) => [String(field.Name || '').toLowerCase(), field]))
  return items.map((item) => {
    const candidates = item && typeof item === 'object'
      ? [
          item.Id, item.id,
          item.FieldId, item.fieldId,
          item.DiyFieldId, item.diyFieldId,
          item.Name, item.name,
          item.Field, item.field
        ]
      : [item]
    const field = candidates
      .map((candidate) => String(candidate || '').toLowerCase())
      .filter(Boolean)
      .map((candidate) => byId.get(candidate) || byName.get(candidate))
      .find(Boolean)
    if (!field || !field.Name) return null
    const source = item && typeof item === 'object' ? item : {}
    const asName = String(source.AsName || source.asName || field.AsName || '').trim()
    return {
      field: asName || field.Name,
      queryField: field.Name,
      label: String(source.Label || source.label || field.Label || field.Name).trim(),
      format: String(source.Format || source.format || '').trim()
    }
  }).filter(Boolean)
}
