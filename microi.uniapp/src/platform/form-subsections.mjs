// 子分组只解释已授权的显示字段，不改写表单定义、字段值或后台布局。
export function buildFormSubsections(group, getPresentation = () => ({})) {
  const byField = {}
  let section = null
  for (const field of group.fields || []) {
    if (field.component === 'Divider') {
      const presentation = getPresentation(field) || {}
      // 每个分隔标题都结束前一段，普通标题后的字段不能被上一段误收起。
      section = presentation.collapsible === true && presentation.visible !== false
        ? {
            key: JSON.stringify([group.key, field.Id || field.Name]),
            title: presentation.label || field.Label || field.Name,
            fields: []
          }
        : null
    }
    if (!section) continue
    byField[field.Id || field.Name] = section
    if (field.component !== 'Divider') section.fields.push(field)
  }
  return byField
}
