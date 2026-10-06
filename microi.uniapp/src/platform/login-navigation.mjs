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

export function isLoginPageLocation(url) {
  return parsePageLocation(url).route.startsWith('pages/login/')
}

export function normalizeLoginRedirect(url) {
  const value = String(url || '').trim()
  const target = parsePageLocation(value)
  // 登录返回地址只允许应用内业务页；登录页本身不能成为下一次登录的返回目标。
  if (!/^\/?pages\/[a-z0-9_/-]+(?:\?|$)/i.test(value) || isLoginPageLocation(value)) return ''
  return `/${target.route}${value.includes('?') ? `?${value.slice(value.indexOf('?') + 1)}` : ''}`
}

export function decodeLoginRedirect(value) {
  let candidate = String(value || '').trim()
  for (let index = 0; index < 3; index += 1) {
    const normalized = normalizeLoginRedirect(candidate)
    // uni-app 可能已经解码 redirect 外层；内部业务参数的 %26/%2F 不能再整串解码。
    if (normalized) return normalized
    const decoded = safeDecode(candidate)
    if (decoded === candidate) break
    candidate = decoded
  }
  return ''
}

export function pageLocation(page) {
  if (!page || !page.route) return ''
  const query = Object.entries(page.options || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `/${String(page.route).replace(/^\/+/, '')}${query ? `?${query}` : ''}`
}

// onLoad 因未登录而暂停后，navigateBack 只触发原业务页 onShow。
// 保留原页面参数，合并两次生命周期，并在会话失效后允许登录回来继续初始化。
export async function initializeAuthenticatedPage(page, requireLogin, initialize) {
  if (page.authInitialized || page.authInitializing || !requireLogin()) return false
  page.authInitializing = true
  try {
    await initialize.call(page)
    page.authInitialized = Boolean(requireLogin())
    return page.authInitialized
  } finally {
    page.authInitializing = false
  }
}

// 所有页面入口与鉴权回调共享同一导航锁。锁以真实页面到达/导航失败释放，
// 不采用固定时间窗，避免弱网首启时多个生命周期把登录页重复压栈。
export function createLoginNavigationGuard({ getPages = () => [], hasSession = () => false } = {}) {
  let pending = false
  let attempt = 0
  return {
    invoke(options = {}) {
      if (!isLoginPageLocation(options.url)) return
      const target = parsePageLocation(options.url)
      if (hasSession() && target.options.logout !== '1') return false
      const pages = getPages() || []
      if (pending || pages.some((page) => isLoginPageLocation(page?.route))) return false

      const current = pages[pages.length - 1]
      const redirect = normalizeLoginRedirect(target.options.redirect) || normalizeLoginRedirect(pageLocation(current))
      if (redirect && !target.options.redirect) {
        options.url += `${String(options.url).includes('?') ? '&' : '?'}redirect=${encodeURIComponent(redirect)}`
      }
      pending = true
      const currentAttempt = ++attempt
      const fail = options.fail
      options.fail = (...args) => {
        if (attempt === currentAttempt) pending = false
        if (typeof fail === 'function') fail(...args)
      }
    },
    pageOpened() { pending = false },
    reset() { pending = false; attempt += 1 }
  }
}

const installedRuntimes = new WeakSet()
export function installLoginNavigationInterceptors(runtimeUni, guard) {
  if (!runtimeUni || typeof runtimeUni.addInterceptor !== 'function' || installedRuntimes.has(runtimeUni)) return false
  for (const method of ['navigateTo', 'redirectTo', 'reLaunch']) {
    runtimeUni.addInterceptor(method, { invoke: (options) => guard.invoke(options) })
  }
  installedRuntimes.add(runtimeUni)
  return true
}

export function buildLoginReturnPlan(pages = [], redirectUrl = '', fallbackUrl = '/pages/workspace/index') {
  const fallback = normalizeLoginRedirect(fallbackUrl) || '/pages/workspace/index'
  const redirect = normalizeLoginRedirect(redirectUrl)
  const stack = Array.isArray(pages) ? pages : []
  let previousIndex = stack.length - 2
  while (previousIndex >= 0 && isLoginPageLocation(stack[previousIndex]?.route)) previousIndex -= 1
  const target = redirect || normalizeLoginRedirect(pageLocation(stack[previousIndex])) || fallback

  for (let index = previousIndex; index >= 0; index -= 1) {
    if (!shouldResumePreviousPage(stack[index], target)) continue
    // 旧版本可能把登录页夹在业务栈中。仅退回目标仍会在下一次返回看到旧登录，
    // 因此这种历史栈直接重新进入业务目标；正常栈保留原页面实例和筛选状态。
    if (stack.slice(0, index).some((page) => isLoginPageLocation(page?.route))) {
      return { method: 'reLaunch', url: target }
    }
    return { method: 'navigateBack', delta: stack.length - 1 - index, url: target }
  }
  // 分享/扫码冷启动没有可恢复实例，清理全部登录栈后再创建目标。
  return { method: 'reLaunch', url: target }
}

export function executeLoginReturnPlan(runtimeUni, plan, fallbackUrl = '/pages/workspace/index', onFailure = () => {}) {
  const fallback = normalizeLoginRedirect(fallbackUrl) || '/pages/workspace/index'
  const launchTarget = () => runtimeUni.reLaunch({
    url: plan.url || fallback,
    fail: () => runtimeUni.switchTab({ url: fallback, fail: onFailure })
  })
  if (plan.method === 'navigateBack') runtimeUni.navigateBack({ delta: plan.delta, fail: launchTarget })
  else launchTarget()
}
