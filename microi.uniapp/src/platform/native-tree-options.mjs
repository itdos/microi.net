import { filterTreeOptions } from './list-filter-options.mjs'

export function treeBoolean(value, fallback = false) {
  if ([true, 1, '1', 'true'].includes(value)) return true
  if ([false, 0, '0', 'false'].includes(value)) return false
  return fallback
}

export function nativeTreeConfig(field = {}) {
  const component = field.component || field.Component
  if (!['Department', 'Cascader', 'SelectTree', 'TreeCheckbox'].includes(component)) return null
  let config = field.config || field.Config || {}
  if (typeof config === 'string') { try { config = JSON.parse(config) } catch { config = {} } }
  const source = config[component] || (component === 'TreeCheckbox' ? config.SelectTree : {}) || {}
  return {
    ...source,
    Multiple: treeBoolean(source.Multiple, component === 'TreeCheckbox'),
    ParentChildLinkage: treeBoolean(source.ParentChildLinkage),
    EmitPath: ['Department', 'Cascader'].includes(component) && treeBoolean(source.EmitPath, true),
    valueKey: component === 'Department' ? 'Id' : config.SelectSaveField || source.Value || 'Id',
    labelKey: component === 'Department' ? 'Name' : config.SelectLabel || source.Label || config.SelectSaveField || 'Name'
  }
}

// 复用筛选区的树拓扑校验与展开协议，但表单必须保存真实 Id/路径，不能保存筛选包装对象。
export function nativeTreeOptions(field, rows, parent = null) {
  const tree = nativeTreeConfig(field)
  const rawRows = new Map()
  function collect(items) {
    for (const row of items || []) {
      rawRows.set(String(row[tree.valueKey]), row)
      collect(row[tree.Children || '_Child'] || row.children || row.Children)
    }
  }
  collect(rows)
  const filterParent = parent ? { ...parent, value: String(parent.treeParentValue), treeAncestors: parent.treePath.slice(0, -1).map(String) } : null
  return filterTreeOptions({ tree, storage: tree.EmitPath ? 'path' : 'scalar' }, rows, filterParent).map((option) => ({
    ...option,
    value: String(option.treeParentValue),
    raw: rawRows.get(String(option.treeParentValue)),
    treeValue: tree.EmitPath ? option.treePath : option.treeParentValue,
    treeAncestorRows: [...(parent?.treeAncestorRows || []), ...(parent ? [parent.raw] : []), ...option.treePath.slice(parent ? parent.treePath.length : 0, -1).map((value) => rawRows.get(String(value)))].filter(Boolean),
    treeAncestors: option.treePath.slice(0, -1).map(String)
  }))
}

function parsedValue(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

export function nativeTreeSelectionValues(field, value) {
  const tree = nativeTreeConfig(field)
  const parsed = parsedValue(value)
  if (parsed === '' || parsed == null || (Array.isArray(parsed) && !parsed.length)) return []
  return tree.Multiple ? (Array.isArray(parsed) ? parsed : [parsed]) : [parsed]
}

export function nativeTreeSelectionKey(field, value) {
  const tree = nativeTreeConfig(field)
  if (Array.isArray(value)) return value.length ? nativeTreeSelectionKey(field, value[value.length - 1]) : ''
  return String(value && typeof value === 'object' ? value[tree.valueKey] ?? value.Id ?? value.value ?? '' : value ?? '')
}

// 单选完整路径也需要 JSON 序列化；多选 EmitPath=false 只保存 Id 数组，与 PC 数据契约一致。
export function serializeNativeTreeValue(field, value) {
  const tree = nativeTreeConfig(field)
  return tree && Array.isArray(value) ? JSON.stringify(value) : value
}

export async function collectNativeTreeRows(field, loadPage, parent = null) {
  const tree = nativeTreeConfig(field)
  const rows = []; const seen = new Set()
  for (let pageIndex = 1; pageIndex <= 100; pageIndex += 1) {
    const page = await loadPage({ pageIndex, pageSize: 200, keyword: '', parentValue: parent?.treeParentValue, preserveTree: true })
    const next = page.treeRows || (page.options || []).map((option) => option.raw)
    const fresh = next.filter((row) => row && !seen.has(String(row[tree.valueKey])))
    fresh.forEach((row) => seen.add(String(row[tree.valueKey])))
    rows.push(...fresh)
    if (!page.hasMore || page.clientPaging) return rows
    if (!fresh.length) throw new Error('树数据分页不完整，请检查数据源')
  }
  throw new Error('树数据分页超出上限，请检查数据源')
}
