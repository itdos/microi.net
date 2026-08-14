function authMessage(body) {
  if (!body || typeof body !== 'object') return ''
  return String(body.Msg || body.Message || '')
}

export function isLoginRoute(route) {
  return String(route || '').replace(/^\/+/, '').startsWith('pages/login/')
}

export function isMissingTokenResponse(body) {
  const reasonCode = String(body?.DataAppend?.ReasonCode || body?.ReasonCode || '').toLowerCase()
  if (reasonCode === 'missingtoken') return true
  return /(?:请求)?未携带\s*token|missing\s*token/i.test(authMessage(body))
}

// 未登录访问受保护页面属于正常登录引导，不应再叠加“身份失效”弹窗。
// 登录页已经显示时也必须静默，避免底层页面的迟到响应把弹窗带回去。
export function shouldPromptAuthExpired(body, currentRoute) {
  return !isLoginRoute(currentRoute) && !isMissingTokenResponse(body)
}
