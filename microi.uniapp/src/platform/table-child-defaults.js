function parseRelationList(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function normalizeRelation(item) {
  if (Array.isArray(item)) {
    return {
      father: item[0],
      child: item[1]
    }
  }
  if (item && typeof item === 'object') {
    return {
      father: item.Father || item.father,
      child: item.Child || item.child
    }
  }
  return { father: '', child: '' }
}

export function tableChildFieldRelations(fieldConfig = {}) {
  // zhy：新版设计器把字段回填关系保存到 TableChild.FieldRelations，旧配置仍兼容根级 TableChildCallbackField。
  const nestedRelations = parseRelationList(fieldConfig.TableChild && fieldConfig.TableChild.FieldRelations)
  const legacyRelations = parseRelationList(fieldConfig.TableChildCallbackField)
  const relations = []
  const relationKeys = new Set()

  ;[...nestedRelations, ...legacyRelations].forEach((item) => {
    const relation = normalizeRelation(item)
    if (!relation.father || !relation.child) return
    const key = `${relation.father}\u0000${relation.child}`
    if (relationKeys.has(key)) return
    relationKeys.add(key)
    relations.push(relation)
  })
  return relations
}

export function buildTableChildDefaultValues({
  fieldConfig = {},
  parentForm = {},
  childFkField = '',
  relationValue = ''
} = {}) {
  const result = {}
  if (childFkField) result[childFkField] = relationValue

  // zhy：统一根据父子字段关系生成新增默认值，确保客户详情各 Tab 都携带客户 Id 和客户名称。
  tableChildFieldRelations(fieldConfig).forEach(({ father, child }) => {
    if (parentForm[father] !== undefined) result[child] = parentForm[father]
  })
  return result
}
