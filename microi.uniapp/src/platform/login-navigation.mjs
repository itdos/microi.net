function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ''))
  } catch (error) {
    return String(value || '')
  }
}

function parseQuery(queryString) {
  return String(queryString || '').split('&').filter(Boolean).reduce((result, pair) => {
    const separator = pair.indexOf('=')
    const key = safeDecode(separator >= 0 ? pair.slice(0, separator) : pair)
    const value = safeDecode(separator >= 0 ? pair.slice(separator + 1) : '')
    if (key) result[key] = value
    return result
  }, {})
}

export function parsePageLocation(url) {
  const normalized = String(url || '').trim().replace(/^\/+/, '')
  const separator = normalized.indexOf('?')
  return {
    route: separator >= 0 ? normalized.slice(0, separator) : normalized,
    options: parseQuery(separator >= 0 ? normalized.slice(separator + 1) : '')
  }
}

// 登录页由当前业务页 navigateTo 打开时，redirect 指向的就是栈内上一页。
// 此时必须 navigateBack 恢复原实例，不能 redirectTo 再复制一个详情页。
export function shouldResumePreviousPage(page, redirectUrl) {
  if (!page || !page.route || !redirectUrl) return false
  const target = parsePageLocation(redirectUrl)
  if (!target.route || String(page.route).replace(/^\/+/, '') !== target.route) return false
  const pageOptions = page.options || {}
  return Object.keys(target.options).every((key) =>
    safeDecode(pageOptions[key]) === target.options[key]
  )
}
