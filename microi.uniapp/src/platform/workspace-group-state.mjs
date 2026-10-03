function keyOf(value) {
  return String(value || '').trim()
}

export function workspaceGroupKeys(groups = []) {
  return [...new Set((Array.isArray(groups) ? groups : [])
    .map((group) => keyOf(group && group.key))
    .filter(Boolean))]
}

export function normalizeExpandedWorkspaceGroups(expandedKeys = [], groups = []) {
  const available = new Set(workspaceGroupKeys(groups))
  return [...new Set((Array.isArray(expandedKeys) ? expandedKeys : [])
    .map(keyOf)
    .filter((key) => key && available.has(key)))]
}

export function initialExpandedWorkspaceGroups(groups = []) {
  return workspaceGroupKeys(groups)
}

export function toggleWorkspaceCategoryFilters(expanded = false) {
  return !Boolean(expanded)
}

export function toggleWorkspaceGroup(expandedKeys = [], groups = [], groupKey = '') {
  const key = keyOf(groupKey)
  const expanded = normalizeExpandedWorkspaceGroups(expandedKeys, groups)
  if (!key || !workspaceGroupKeys(groups).includes(key)) return expanded
  return expanded.includes(key)
    ? expanded.filter((item) => item !== key)
    : [...expanded, key]
}

export function expandWorkspaceGroup(expandedKeys = [], groups = [], groupKey = '') {
  const key = keyOf(groupKey)
  const expanded = normalizeExpandedWorkspaceGroups(expandedKeys, groups)
  if (!key || !workspaceGroupKeys(groups).includes(key) || expanded.includes(key)) return expanded
  return [...expanded, key]
}

export default {
  workspaceGroupKeys,
  normalizeExpandedWorkspaceGroups,
  initialExpandedWorkspaceGroups,
  toggleWorkspaceCategoryFilters,
  toggleWorkspaceGroup,
  expandWorkspaceGroup
}
