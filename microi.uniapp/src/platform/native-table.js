import { parseJson } from '@/platform/native-form.js'
import tenantNativeTable from '@/generated/tenant-native-table.js'

function normalizeCondition(condition = {}) {
  const name = condition.Name || condition.FieldName
  if (!name) return null
  let type = condition.Type || condition.ConditionType || '='
  const aliases = { Equal: '=', Euqal: '=', NotEqual: '!=', Contains: 'Like' }
  type = aliases[type] || type
  return { Name: name, Type: type, Value: condition.Value ?? condition.FieldValue ?? '' }
}

export function parseTableWhere(value, form = {}) {
  const source = parseJson(value, value)
  const rows = Array.isArray(source) ? source : []
  return rows.map(normalizeCondition).filter(Boolean).map((item) => {
    let value = item.Value
    if (typeof value === 'string') {
      value = value.replace(/\$Form\.([A-Za-z0-9_]+)\$/g, (all, name) => form[name] ?? '')
    }
    return { ...item, Value: value }
  })
}

export function getOpenTableWhere(field, form = {}) {
  const config = (field.config && field.config.OpenTable) || {}
  const where = parseTableWhere(config.PropsWhere, form)
  Object.entries(config.SearchAppend || {}).forEach(([Name, Value]) => where.push({ Name, Type: '=', Value }))
  const result = tenantNativeTable.appendOpenTableWhere({ field, form, where }) || where
  return result.filter((item) => item.Value !== undefined && item.Value !== null)
}

export function validateOpenTableContext(field, form = {}) {
  if (!tenantNativeTable || typeof tenantNativeTable.validateOpenTableContext !== 'function') return ''
  return String(tenantNativeTable.validateOpenTableContext({ field, form }) || '')
}

function cleanSelected(rows) {
  return rows.map((row) => {
    const item = { ...row }
    delete item._RowMoreBtnsIn
    delete item._RowMoreBtnsOut
    return item
  })
}

export async function submitOpenTableSelection({ tableName, parentId, field, form, rows }) {
  const selected = cleanSelected(Array.isArray(rows) ? rows : [])
  if (!selected.length) throw new Error('请选择数据')
  const tenantResult = await tenantNativeTable.submitTenantOpenTableSelection({
    tableName,
    parentId,
    field,
    form,
    rows: selected
  })
  if (tenantResult && tenantResult.matched) return tenantResult

  form[field.Name] = ((field.config || {}).OpenTable || {}).MultipleSelect === false ? selected[0] : selected
  return { handled: true, changedField: field.Name }
}

export default {
  parseTableWhere,
  getOpenTableWhere,
  validateOpenTableContext,
  submitOpenTableSelection
}
