export const ROOT_LOGIN_PATH = '/pages/login/index'

function appendFlag(params, key, enabled) {
  if (enabled) params.push(`${key}=1`)
}

export function buildRootLoginUrl(options = {}) {
  const base = String(options.base || ROOT_LOGIN_PATH).trim() || ROOT_LOGIN_PATH
  const params = ['root=1']
  appendFlag(params, 'logout', options.logout === true)
  appendFlag(params, 'endpoint', options.endpoint === true)
  if (options.redirect) params.push(`redirect=${encodeURIComponent(String(options.redirect))}`)
  return `${base}${base.includes('?') ? '&' : '?'}${params.join('&')}`
}

export function isRootLoginEntry(options = {}, pageCount = 0) {
  return options.root === '1' || options.logout === '1' || Number(pageCount) <= 1
}

export function reLaunchToLogin(options = {}) {
  const url = buildRootLoginUrl(options)
  if (typeof uni === 'undefined') return url
  uni.reLaunch({
    url,
    fail: () => uni.redirectTo({ url })
  })
  return url
}
