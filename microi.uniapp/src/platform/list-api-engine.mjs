export function buildListApiEnginePayload(moduleConfig = {}, options = {}, periodRange = null) {
  const payload = {
    _PageIndex: Number(options.pageIndex || 1),
    _PageSize: Number(options.pageSize || moduleConfig.pageSize || 15),
    Keyword: String(options.keyword || '').trim(),
    _OrderBy: options.orderBy || moduleConfig.defaultOrderBy || '',
    _OrderByType: options.orderType || moduleConfig.defaultOrderType || '',
    _Where: [...(moduleConfig.fixedWhere || []), ...(options.extraWhere || [])]
  }
  if (moduleConfig.menuId) payload._SysMenuId = moduleConfig.menuId
  if (moduleConfig.configuredModuleEngineKey) payload.ModuleEngineKey = moduleConfig.configuredModuleEngineKey
  if (Array.isArray(moduleConfig.selectFields) && moduleConfig.selectFields.length) {
    payload._SelectFields = [...moduleConfig.selectFields]
  }
  if (options.status !== undefined && options.status !== null && options.status !== '' && moduleConfig.statusField) {
    payload._Where.push({ Name: moduleConfig.statusField, Type: '=', Value: options.status })
  }
  if (periodRange) {
    payload._SearchDateTime = {
      [moduleConfig.periodField || 'CreateTime']: periodRange
    }
  }
  return payload
}

// 列表缓存必须随授权菜单、卡片版本和字段集变化，避免更新布局后仍返回缺列的旧数据。
export function listApiEnginePresentationKey(moduleConfig = {}, payload = {}) {
  return JSON.stringify([
    payload._SysMenuId || '', payload.ModuleEngineKey || '',
    moduleConfig.menu?.ViewConfigVersion || '', moduleConfig.menu?.UpdateTime || '',
    moduleConfig.definition?.schemaFingerprint || '', payload._SelectFields || []
  ])
}

export function normalizeListApiEngineResponse(response) {
  if (!response || Number(response.Code) !== 1) {
    throw new Error((response && response.Msg) || '业务数据加载失败')
  }
  return {
    rows: Array.isArray(response.Data) ? response.Data : [],
    count: Number(response.DataCount || 0),
    append: response.DataAppend || {}
  }
}
