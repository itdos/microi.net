function replacement(table = {}) {
  const value = table?.ApiReplace
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) || {} } catch { throw new Error('表单查询接口替换配置无效') }
}

export function resolveDetailReadApi(table) {
  return String(replacement(table).Select || '').trim()
}

export function resolveListReadApi(config = {}) {
  return String(config.menu?.SelectApi || config.selectApi || '').trim() ||
    resolveDetailReadApi(config.tableModel || config.definition?.table)
}

// 查询地址只从已授权元数据取得，并限定到当前 API 源；不能把登录令牌送到其它站点。
export function normalizeReadApi(api, apiBase = '', osClient = '') {
  let path = String(api || '').trim().split('$ApiBase$').join(apiBase).split('$OsClient$').join(encodeURIComponent(osClient))
  if (/^https?:\/\//i.test(path)) {
    const target = path.match(/^(https?:\/\/[^/?#]+)([\s\S]*)$/i)
    const origin = String(apiBase).match(/^(https?:\/\/[^/?#]+)/i)?.[1]
    if (!origin || target[1].toLowerCase() !== origin.toLowerCase()) throw new Error('查询接口必须使用当前服务器地址')
    path = target[2] || '/'
  }
  if (/^[A-Za-z0-9_-]+$/.test(path)) path = `/apiengine/${path}`
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\s#]/.test(path) || /(^|\/)\.\.?(\/|$)/.test(path)) {
    throw new Error('查询接口地址无效')
  }
  return path
}

export async function requestReadApi(sdk, api, payload) {
  const url = normalizeReadApi(api, sdk.ApiBase, sdk.OsClient)
  // 委托当前 SDK 处理租户、终端、续签及接口引擎请求队列；保留业务错误供页面展示。
  const result = await sdk.post(url, payload, { checkCode: false })
  if (!result || typeof result !== 'object' || result.Code === undefined) throw new Error('查询接口返回格式无效')
  return result
}

export async function readFormRecord(sdk, context = {}) {
  const payload = {
    Id: context.rowId,
    ...(context.menuId ? { _SysMenuId: context.menuId } : {}),
    ...(context.tableChildAuth ? { _TableChildAuth: context.tableChildAuth } : {}),
    ...(context.readWhere?.length ? { _Where: context.readWhere } : {})
  }
  const api = resolveDetailReadApi(context.tableModel || context.definition?.table)
  if (!api) return sdk.FormEngine.GetFormData(context.tableName, payload)
  // 虚拟记录 Id 必须原样传递，月份与底层 Id 的解析由接口引擎负责。
  return requestReadApi(sdk, api, { ...payload, FormEngineKey: context.tableName })
}

export function queryMonthValue(value = '', now = new Date()) {
  const month = String(value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('请选择有效的日志月份')
  return month.replace('-', '')
}

export function isReadOnlyTable(tableName, modules = {}) {
  return Object.values(modules).some(config => config.readOnly === true &&
    String(config.table || '').toLowerCase() === String(tableName || '').toLowerCase())
}
