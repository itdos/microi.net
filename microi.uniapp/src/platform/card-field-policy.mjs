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
    const result = {
      field: asName || field.Name,
      queryField: field.Name,
      label: String(source.Label || source.label || field.Label || field.Name).trim(),
      format: String(source.Format || source.format || '').trim()
    }
    Object.defineProperty(result, 'definition', { value: field, enumerable: false })
    return result
  }).filter(Boolean)
}

function safeProjectionName(value) {
  const name = String(value || '').trim()
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : ''
}

function parseFieldConfig(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

// 模块 SelectFields 可能包含关联表字段；这些字段不属于主表 diy_field，
// 但移动卡片仍需要它们的 Id、别名和显示元数据来编译查询与渲染配置。
export function moduleProjectionFields(items = []) {
  return items.map((item) => {
    if (!item || typeof item !== 'object') return null
    const nested = item.Field && typeof item.Field === 'object' ? item.Field : {}
    const source = { ...nested, ...item }
    const name = safeProjectionName(source.Name || source.FieldName || source.name)
    if (!name) return null
    const asName = safeProjectionName(source.AsName || source.asName)
    return {
      ...source,
      Id: source.Id || source.FieldId || source.DiyFieldId || '',
      Name: name,
      AsName: asName,
      Label: String(source.Label || source.FieldLabel || source.label || name).trim(),
      component: source.component || source.Component || 'Text',
      config: parseFieldConfig(source.config || source.Config),
      options: Array.isArray(source.options) ? source.options : (Array.isArray(source.Options) ? source.Options : []),
      visible: true
    }
  }).filter(Boolean)
}
