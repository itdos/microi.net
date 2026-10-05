export function buildListApiEnginePayload(moduleConfig = {}, options = {}, periodRange = null) {
  const payload = {
    _PageIndex: Number(options.pageIndex || 1),
    _PageSize: Number(options.pageSize || moduleConfig.pageSize || 15),
    Keyword: String(options.keyword || '').trim(),
    _OrderBy: options.orderBy || moduleConfig.defaultOrderBy || '',
    _OrderByType: options.orderType || moduleConfig.defaultOrderType || '',
    _Where: [...(moduleConfig.fixedWhere || []), ...(options.extraWhere || [])]
  }
  if (options.status && moduleConfig.statusField) {
    payload._Where.push({ Name: moduleConfig.statusField, Type: '=', Value: options.status })
  }
  if (periodRange) {
    payload._SearchDateTime = {
      [moduleConfig.periodField || 'CreateTime']: periodRange
    }
  }
  return payload
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
