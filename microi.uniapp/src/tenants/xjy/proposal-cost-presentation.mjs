// 移动表单的预计金额只读展示，现有成本 Divider 在移动端作为子折叠标题。
export function proposalCostFieldPresentation(tableName, field = {}) {
  const table = String(tableName || '').toLowerCase()
  const name = String(field.Name || '').toLowerCase()
  if (table === 'diy_kehufaxx' && ['yujihezuojezl', 'yujihezuojemd'].includes(name)) {
    return { readonly: true }
  }
  if (!['diy_kehufaxx', 'diy_anzhuang_dw'].includes(table) ||
      String(field.component || field.Component || '').toLowerCase() !== 'divider') return null
  if (table === 'diy_kehufaxx' && name === 'hezuoqcb') {
    return { collapsible: true, label: '当前成本' }
  }
  if (['hezuohcb', 'hezuohcbmd'].includes(name)) return { collapsible: true }
  return null
}
