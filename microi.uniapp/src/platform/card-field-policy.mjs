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

export function resolveConfiguredFieldNames(items = [], fields = []) {
  const byId = new Map(fields.map((field) => [String(field.Id || '').toLowerCase(), field]))
  const byName = new Map(fields.map((field) => [String(field.Name || '').toLowerCase(), field]))
  return items.map((item) => {
    const candidates = item && typeof item === 'object'
      ? [item.Id, item.id, item.Name, item.name, item.Field, item.field]
      : [item]
    const field = candidates
      .map((candidate) => String(candidate || '').toLowerCase())
      .filter(Boolean)
      .map((candidate) => byId.get(candidate) || byName.get(candidate))
      .find(Boolean)
    return field && field.Name
  }).filter(Boolean)
}
