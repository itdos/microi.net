import {
  SITE_TOKEN_STORAGE_KEY, normalizeSiteToken, buildSiteSessionHeaders,
  getOrCreateSiteDid, readRotatedSiteToken, isSiteSessionExpired
} from './site-session.js'

const ENDPOINT = 'https://api.microi.net/apiengine/sso_http_complete_authorization?OsClient=iTdos'
const opaque = value => /^[A-Za-z0-9_-]{20,256}$/.test(String(value || ''))
const allowedScopes = new Set(['openid', 'profile', 'email'])

export function readAuthorizationRequest(search) {
  const parameters = new URLSearchParams(search)
  const request = parameters.get('request') || ''
  return parameters.getAll('request').length === 1 && opaque(request) ? request : ''
}

export function authorizationLoginUrl(requestId) {
  if (!opaque(requestId)) throw new Error('授权请求无效，请从目标系统重新发起。')
  return '/login.html?redirect=' + encodeURIComponent('/microi-authorize.html?request=' + requestId)
}

function secureCallback(value) {
  const url = new URL(String(value || ''))
  if (url.username || url.password || url.hash
    || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('目标系统的回调地址无效。')
  return url
}

export function validateAuthorizationContext(value, requestId) {
  if (!value || !opaque(requestId) || value.RequestId !== requestId
    || !String(value.CurrentUserId || '').trim()
    || !String(value.ClientName || '').trim() || !Array.isArray(value.Scopes)
    || !value.Scopes.includes('openid') || value.Scopes.some(scope => !allowedScopes.has(scope))
    || !Number.isFinite(Date.parse(value.ExpiresAt)) || Date.parse(value.ExpiresAt) <= Date.now())
    throw new Error('授权请求无效、权限范围不支持或已过期，请从目标系统重新发起。')
  const callback = secureCallback(value.RedirectUri)
  if (callback.searchParams.has('code') || callback.searchParams.has('state'))
    throw new Error('目标系统的回调参数无效。')
  return value
}

export function validateAuthorizationRedirect(value, registeredCallback) {
  const target = secureCallback(value), registered = secureCallback(registeredCallback)
  if (target.origin !== registered.origin || target.pathname !== registered.pathname
    || target.searchParams.getAll('code').length !== 1 || !opaque(target.searchParams.get('code'))
    || target.searchParams.getAll('state').length > 1)
    throw new Error('授权响应未匹配已登记的目标系统。')
  // 最终跳转只能在服务端预览过的精确地址上添加 code/state，不能改变租户或 Provider。
  for (const key of new Set([...registered.searchParams.keys(), ...target.searchParams.keys()])) {
    if (key === 'code' || key === 'state') continue
    if (JSON.stringify(target.searchParams.getAll(key)) !== JSON.stringify(registered.searchParams.getAll(key)))
      throw new Error('授权响应的回调参数已变更。')
  }
  return value
}

function loginRequired() {
  const error = new Error('登录状态已过期，请重新登录 Microi 官方帐号。')
  error.code = 'LOGIN_REQUIRED'
  return error
}

export function createAuthorizationClient({ storage = globalThis.localStorage, fetchImpl = globalThis.fetch } = {}) {
  async function request(requestId, preview, expectedUserId = '') {
    if (!opaque(requestId)) throw new Error('授权请求无效。')
    const token = normalizeSiteToken(storage?.getItem?.(SITE_TOKEN_STORAGE_KEY))
    if (!token) throw loginRequired()
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST', credentials: 'include', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: buildSiteSessionHeaders({ token, osClient: 'iTdos', did: getOrCreateSiteDid(storage) }),
      body: JSON.stringify({ OsClient: 'iTdos', RequestId: requestId, Preview: preview,
        ...(expectedUserId ? { ExpectedUserId: expectedUserId } : {}) })
    })
    const rotated = readRotatedSiteToken(response)
    if (rotated) storage?.setItem?.(SITE_TOKEN_STORAGE_KEY, rotated)
    let result
    try { result = await response.json() } catch {
      if (response.status === 401) throw loginRequired()
      throw new Error('授权服务暂时不可用，请稍后重新发起。')
    }
    if (isSiteSessionExpired(result, response.status)) throw loginRequired()
    if (result?.Code !== 1 || response.status >= 400)
      throw new Error(String(result?.Msg || '授权未完成，请从目标系统重新发起。'))
    return result.Data
  }
  return {
    async preview(requestId) { return validateAuthorizationContext(await request(requestId, true), requestId) },
    async complete(requestId, callback, expectedUserId) {
      if (!String(expectedUserId || '').trim()) throw new Error('请重新确认当前官方帐号后授权。')
      const result = await request(requestId, false, expectedUserId)
      return validateAuthorizationRedirect(result?.RedirectUrl, callback)
    }
  }
}
