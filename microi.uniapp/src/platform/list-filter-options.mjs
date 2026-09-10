export function wrapFilterOption(option, actual = option.value) {
  const key = Array.isArray(actual) ? JSON.stringify(actual) : String(actual?.Id ?? actual?.Key ?? option.value)
  return { ...option, value: key, raw: { _filterKey: key, _filterLabel: option.label, _filterValue: actual, _filterRaw: option.raw } }
}

export function filterOptionRows(field, options) {
  return (options || []).map((option) => {
    const saveField = field.config?.SelectSaveField
    const saveScalar = saveField && ['Checkbox', 'MultipleSelect'].includes(field.component) && field.config?.DataSource !== 'KeyValue'
    const actual = ['array', 'object'].includes(field.storage) && !saveScalar ? (option.raw ?? option.value) : (option.raw?.[saveField] ?? option.value)
    return wrapFilterOption(option, actual)
  })
}

const truth = (value) => value === true || value === 1 || value === '1' || value === 'true'

// 树的搜索只裁剪展示，不丢弃祖先路径。同时兼容嵌套 children 与 ParentId 平铺数据。
export function filterTreeOptions(field, rows, parent = null) {
  const cfg = field.tree || {}
  const childrenKey = cfg.Children || '_Child'
  const parentKey = cfg.ParentField || 'ParentId'
  const nodes = new Map()
  const roots = []
  function collect(items, owner) {
    for (const raw of items || []) {
      const value = raw[cfg.valueKey]
      if (value === undefined || value === null || value === '') continue
      const id = String(value)
      if (nodes.has(id)) continue
      const node = { raw, id, value, parent: owner ?? raw[parentKey], children: [] }
      nodes.set(id, node)
      collect(raw[childrenKey] || raw.children || raw.Children, id)
    }
  }
  collect(rows, null)
  for (const node of nodes.values()) {
    const owner = nodes.get(String(node.parent))
    if (owner && owner !== node) owner.children.push(node)
    else {
      if (!parent && node.parent && !/^0+$|^00000000-0000-0000-0000-000000000000$/.test(String(node.parent))) throw new Error('树数据缺少父级，请检查数据源是否返回完整层级')
      roots.push(node)
    }
  }
  const result = []; const visited = new Set()
  function visit(node, ancestors, path, labels, inheritedDisabled) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    const nextPath = [...path, node.value]
    const label = String(node.raw[cfg.labelKey] ?? node.value)
    const nextLabels = [...labels, label]
    const lazy = truth(cfg.Lazy) && !truth(node.raw[cfg.Leaf || '_Leaf']) && !node.children.length
    const hasChildren = !!node.children.length || lazy
    const disabled = inheritedDisabled || truth(node.raw[cfg.Disabled || 'disabled'])
    const level = nextPath.length
    const allowedLevel = !Array.isArray(cfg.SearchSelectableLevels) || cfg.SearchSelectableLevels.includes(level)
    const allowed = (!cfg.SearchLeafOnly || !hasChildren) && allowedLevel
    const actual = ['path', 'paths'].includes(field.storage) ? nextPath : node.value
    const option = wrapFilterOption({ value: node.value, label: nextLabels.join(' / ') }, actual)
    Object.assign(option, { treeLabel: label, treePath: nextPath, treeLabels: nextLabels, treeAncestors: ancestors, treeChildren: hasChildren, treeLazy: lazy, treeDisabled: disabled || !allowed, treeLeafSelectable: !disabled && allowedLevel, treeInheritedDisabled: disabled, treeParentValue: node.value })
    result.push(option)
    node.children.forEach((child) => visit(child, [...ancestors, option.value], nextPath, nextLabels, disabled))
  }
  roots.forEach((node) => visit(node, parent ? [...parent.treeAncestors, parent.value] : [], parent?.treePath || [], parent?.treeLabels || [], parent?.treeInheritedDisabled || false))
  // 循环 / 缺失父级数据不能伪装成正常根节点并生成错误路径。
  if (visited.size !== nodes.size) throw new Error('树数据存在循环父级关系')
  return result
}
