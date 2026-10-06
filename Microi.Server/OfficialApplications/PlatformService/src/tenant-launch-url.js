export const PENDING_EXTERNAL_BINDING = 'PendingExternalBinding'

export function normalizeHttpRuntimeBase(value, label = '运行地址') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`${label}必须是完整的 http:// 或 https:// 地址`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label}只允许 http:// 或 https:// 地址`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label}禁止包含用户名或密码`)
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label}不能包含 query 或 hash`)
  }

  const pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.origin + (pathname && pathname !== '/' ? pathname : '')
}

export function normalizeTenantKey(value) {
  const tenantKey = String(value || '').trim()
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey)) {
    throw new Error('OsClient 格式不正确，无法生成安全启动地址')
  }
  return tenantKey
}

export function buildTenantLaunchProjection({ apiBase, webBase, osClient, domainName }) {
  const normalizedApiBase = normalizeHttpRuntimeBase(apiBase, 'ApiBase')
  const normalizedWebBase = normalizeHttpRuntimeBase(webBase, 'WebBase')
  const normalizedOsClient = normalizeTenantKey(osClient)
  const normalizedDomainName = String(domainName || `${normalizedOsClient}.microi.net`).trim()
  const bareDomainUrl = normalizedDomainName ? `https://${normalizedDomainName}` : ''
  let launchUrl = ''

  if (normalizedApiBase && normalizedWebBase) {
    const target = new URL(`${normalizedWebBase}/`)
    target.searchParams.set('ApiBase', normalizedApiBase)
    target.searchParams.set('OsClient', normalizedOsClient)
    launchUrl = target.toString()
  }

  return {
    LaunchUrl: launchUrl,
    Url: launchUrl,
    LaunchUrlAvailable: Boolean(launchUrl),
    LaunchApiBase: normalizedApiBase,
    LaunchWebBase: normalizedWebBase,
    BareDomainUrl: bareDomainUrl,
    BareDomainReady: false,
    DomainBindingRequired: true,
    DomainBindingStatus: PENDING_EXTERNAL_BINDING,
    DomainBindingMessage: '该域名目前仅完成租户登记；DNS、证书与 Web 网关绑定并验证通过前，请使用安全启动地址。'
  }
}
