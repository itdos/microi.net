export const SITE_DID_STORAGE_KEY = 'microi_doc_did'
export const SITE_TOKEN_STORAGE_KEY = 'microi_doc_token'

export function normalizeSiteToken(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim()
}

function validDid(value) {
  const did = String(value || '').trim()
  return did.length >= 8 && did.length <= 128 && /^[\x21-\x7e]+$/.test(did)
}

function randomHex(cryptoApi) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`
}

export function getOrCreateSiteDid(storage = globalThis.localStorage, cryptoApi = globalThis.crypto) {
  const existing = storage?.getItem?.(SITE_DID_STORAGE_KEY)
  if (validDid(existing)) return String(existing).trim()

  // 复用 Microi.Client 已生成的 Did，避免同一浏览器被拆成两个终端。
  const legacy = storage?.getItem?.('Did')
  const did = validDid(legacy) ? String(legacy).trim() : `MicroiWeb:${randomHex(cryptoApi)}`
  storage?.setItem?.(SITE_DID_STORAGE_KEY, did)
  return did
}

export function buildSiteSessionHeaders({ token = '', osClient = 'iTdos', did = '', contentType = 'application/json' } = {}) {
  const normalizedToken = normalizeSiteToken(token)
  const headers = {
    'Content-Type': contentType,
    osclient: String(osClient || 'iTdos'),
    did: String(did || '')
  }
  if (normalizedToken) {
    headers.authorization = `Bearer ${normalizedToken}`
    headers.Token = normalizedToken
  }
  return headers
}

export function readRotatedSiteToken(response) {
  return normalizeSiteToken(response?.headers?.get?.('authorization'))
}

export function isSiteSessionExpired(result, httpStatus = 200) {
  if (Number(httpStatus) === 401 || [1001, 1002].includes(Number(result?.Code))) return true
  const message = String(result?.Msg || result?.Message || '')
  return /请先登录|登录状态.*失效|Token.*(?:失效|过期|缺失)|身份验证失败/i.test(message)
}
