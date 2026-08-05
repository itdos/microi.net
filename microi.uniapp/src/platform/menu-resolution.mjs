function normalize(value) {
  return String(value || '').trim()
}

function menuTableName(menu) {
  return normalize(
    menu && (
      menu.DiyTableName ||
      menu.TableName ||
      (menu.DiyTable && menu.DiyTable.Name) ||
      (menu._DiyTable && menu._DiyTable.Name)
    )
  )
}

function isBoundToRequestedTable(menu, tableName, tableId) {
  const requestedName = normalize(tableName).toLowerCase()
  const requestedId = normalize(tableId)
  const boundName = menuTableName(menu).toLowerCase()
  const boundId = normalize(menu && menu.DiyTableId)

  if (requestedId) {
    if (boundId) return boundId === requestedId
    return Boolean(requestedName && boundName === requestedName)
  }
  if (!requestedName) return true
  if (boundName) return boundName === requestedName

  // 菜单树有时只返回 DiyTableId。此时至少要求候选项确实绑定了业务表，
  // 绝不能把没有 DiyTableId 的父级目录当成表单授权菜单。
  return Boolean(boundId)
}

function findByAliasOrder(menus, aliases, predicate) {
  for (const alias of aliases) {
    const result = menus.find((menu) => predicate(menu, alias))
    if (result) return result
  }
  return null
}

export function selectAuthorizedMenu(menus = [], options = {}) {
  const aliases = (options.aliases || []).map(normalize).filter(Boolean)
  const tableName = normalize(options.tableName)
  const tableId = normalize(options.tableId)
  const menuId = normalize(options.menuId)

  if (menuId) {
    const explicitMenu = menus.find((menu) => normalize(menu && menu.Id) === menuId)
    if (explicitMenu && isBoundToRequestedTable(explicitMenu, tableName, tableId)) {
      return explicitMenu
    }
  }

  if (tableId) {
    const tableMatch = menus.find((menu) => normalize(menu && menu.DiyTableId) === tableId)
    if (tableMatch) return tableMatch
  }

  const exactAlias = findByAliasOrder(menus, aliases, (menu, alias) =>
    normalize(menu && menu.Name) === alias &&
    isBoundToRequestedTable(menu, tableName, tableId)
  )
  if (exactAlias) return exactAlias

  if (tableName) {
    const normalizedTableName = tableName.toLowerCase()
    const tableNameMatch = menus.find((menu) =>
      menuTableName(menu).toLowerCase() === normalizedTableName
    )
    if (tableNameMatch) return tableNameMatch
  }

  const partialAlias = findByAliasOrder(menus, aliases, (menu, alias) =>
    normalize(menu && menu.Name).includes(alias) &&
    isBoundToRequestedTable(menu, tableName, tableId)
  )
  if (partialAlias) return partialAlias

  // 仅按菜单名称查找时保留历史兼容；一旦指定业务表，必须失败关闭，
  // 不能回退到无表绑定的目录菜单并把它作为 _SysMenuId。
  if (!tableName && !tableId) {
    return findByAliasOrder(menus, aliases, (menu, alias) =>
      normalize(menu && menu.Name) === alias
    ) || findByAliasOrder(menus, aliases, (menu, alias) =>
      normalize(menu && menu.Name).includes(alias)
    )
  }
  return null
}
