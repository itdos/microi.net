export const APP_RUNTIME_ENDPOINT_STORAGE_KEY = 'mci_app_runtime_endpoint_v1'
export const APP_RUNTIME_ENDPOINT_PROTOCOLS = Object.freeze(['https://', 'http://'])

function parseRuntimeUrlFallback(raw) {
  const matched = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(raw)
  if (!matched) throw new Error('invalid runtime URL')

  const protocol = `${matched[1].toLowerCase()}:`
  const authority = matched[2]
  const credentialsIndex = authority.lastIndexOf('@')
  const hostPort = credentialsIndex >= 0 ? authority.slice(credentialsIndex + 1) : authority
  let hostname = ''
  let port = ''

  if (hostPort.startsWith('[')) {
    const ipv6 = /^(\[[0-9a-f:.]+\])(?::(\d+))?$/i.exec(hostPort)
    if (!ipv6) throw new Error('invalid runtime URL')
    hostname = ipv6[1].toLowerCase()
    port = ipv6[2] || ''
  } else {
    if ((hostPort.match(/:/g) || []).length > 1) throw new Error('invalid runtime URL')
    const colonIndex = hostPort.lastIndexOf(':')
    hostname = (colonIndex >= 0 ? hostPort.slice(0, colonIndex) : hostPort).toLowerCase()
    port = colonIndex >= 0 ? hostPort.slice(colonIndex + 1) : ''
    if (!hostname || /[\\\[\]@]/.test(hostname)) throw new Error('invalid runtime URL')
  }

  if (port) {
    const portNumber = Number(port)
    if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65535) {
      throw new Error('invalid runtime URL')
    }
    if ((protocol === 'https:' && portNumber === 443) || (protocol === 'http:' && portNumber === 80)) {
      port = ''
    }
  }

  const pathname = matched[3] || '/'
  if (pathname.includes('\\') || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error('invalid runtime URL')
  }
  const host = hostname + (port ? `:${port}` : '')
  return {
    protocol,
    hostname,
    host,
    origin: `${protocol}//${host}`,
    pathname,
    username: credentialsIndex >= 0 ? 'blocked' : '',
    password: credentialsIndex >= 0 ? 'blocked' : '',
    search: matched[4] || '',
    hash: matched[5] || ''
  }
}

function parseRuntimeUrl(raw) {
  if (typeof URL === 'function') return new URL(raw)
  return parseRuntimeUrlFallback(raw)
}

export function normalizeRuntimeProtocol(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'https' || text === 'https:' || text === 'https://') return 'https://'
  if (text === 'http' || text === 'http:' || text === 'http://') return 'http://'
  throw new Error('连接协议只允许选择 https:// 或 http://')
}

export function normalizeRuntimeApiBase(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('请输入 API 地址')
  if (/\s/.test(raw)) throw new Error('API 地址不能包含空格')

  let parsed
  try {
    parsed = parseRuntimeUrl(raw)
  } catch (error) {
    throw new Error('API 地址格式不正确')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('连接协议只允许选择 https:// 或 http://')
  }
  if (!parsed.hostname) throw new Error('API 地址缺少有效主机名')
  if (parsed.username || parsed.password) throw new Error('API 地址不能包含用户名或密码')
  if (parsed.search || parsed.hash) throw new Error('API 地址不能包含 query 或 hash')

  const pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.origin + (pathname && pathname !== '/' ? pathname : '')
}

export function normalizeRuntimeOsClient(value) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error('请输入租户标识 OsClient')
  if (normalized.length > 128 || /[\u0000-\u001f\u007f\s\\/?#&=%]/.test(normalized)) {
    throw new Error('OsClient 含有非法字符或长度超过 128')
  }
  return normalized
}

export function splitRuntimeApiBase(apiBase) {
  const normalized = normalizeRuntimeApiBase(apiBase)
  const parsed = parseRuntimeUrl(normalized)
  const pathname = parsed.pathname.replace(/\/+$/, '')
  return {
    protocol: parsed.protocol === 'http:' ? 'http://' : 'https://',
    apiHost: parsed.host + (pathname && pathname !== '/' ? pathname : ''),
    apiBase: normalized
  }
}

export function buildAppRuntimeEndpoint(input = {}) {
  const protocol = normalizeRuntimeProtocol(input.protocol)
  const apiHost = String(input.apiHost || '').trim().replace(/\/+$/, '')
  if (!apiHost) throw new Error('请输入 API 地址')
  if (apiHost.includes('://')) throw new Error('协议请使用左侧下拉框选择，API 地址中不要重复输入协议')
  if (/^[\\/]/.test(apiHost)) throw new Error('API 地址必须以域名或 IP 开头')

  const apiBase = normalizeRuntimeApiBase(protocol + apiHost)
  const osClient = normalizeRuntimeOsClient(input.osClient)
  const parts = splitRuntimeApiBase(apiBase)
  return {
    version: 1,
    protocol: parts.protocol,
    apiHost: parts.apiHost,
    apiBase,
    osClient
  }
}

export function normalizeStoredAppRuntimeEndpoint(rawValue, fallback = {}) {
  const fallbackApiBase = normalizeRuntimeApiBase(fallback.apiBase)
  const fallbackOsClient = normalizeRuntimeOsClient(fallback.osClient)
  let stored = rawValue

  if (typeof stored === 'string') {
    try { stored = JSON.parse(stored) } catch (error) { stored = null }
  }

  if (stored && typeof stored === 'object') {
    try {
      const normalized = stored.apiBase
        ? {
            ...splitRuntimeApiBase(stored.apiBase),
            osClient: normalizeRuntimeOsClient(stored.osClient)
          }
        : buildAppRuntimeEndpoint(stored)
      return { version: 1, ...normalized, source: 'storage' }
    } catch (error) {}
  }

  const normalizedFallback = splitRuntimeApiBase(fallbackApiBase)
  return {
    version: 1,
    ...normalizedFallback,
    osClient: fallbackOsClient,
    source: 'profile'
  }
}

export function runtimeEndpointScope(apiBase, osClient) {
  return `${normalizeRuntimeApiBase(apiBase).toLowerCase()}|${normalizeRuntimeOsClient(osClient).toLowerCase()}`
}
