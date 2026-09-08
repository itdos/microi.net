// 仅在移动表单中把现有成本 Divider 升级为子折叠标题，PC 元数据仍保持原样。
export function proposalCostFieldPresentation(tableName, field = {}) {
  const table = String(tableName || '').toLowerCase()
  const name = String(field.Name || '').toLowerCase()
  if (!['diy_kehufaxx', 'diy_anzhuang_dw'].includes(table) ||
      String(field.component || field.Component || '').toLowerCase() !== 'divider') return null
  if (table === 'diy_kehufaxx' && name === 'hezuoqcb') {
    return { collapsible: true, label: '当前成本' }
  }
  if (['hezuohcb', 'hezuohcbmd'].includes(name)) return { collapsible: true }
  return null
}
