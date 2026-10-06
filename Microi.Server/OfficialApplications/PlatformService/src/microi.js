import V8 from './utils/microi.v8.js'

let appliedHostToken = ''

function normalizeToken(value) {
  return String(value || '').replace(/^Bearer\s+/i, '').trim()
}

function notifyHostTokenChanged(token, requestToken) {
  const nextToken = normalizeToken(token)
  if (!nextToken) return
  dispatch('micro-app:token', {
    token: nextToken,
    requestToken: normalizeToken(requestToken)
  })
}

export function getContext(hostData) {
  const data = hostData || window.microApp?.getData?.() || {}
  return {
    webBase: data.webBase || data.WebBase || '',
    apiBase: data.apiBase || '',
    osClient: data.osClient || '',
    token: data.token || '',
    appKey: data.appKey || '',
    version: data.version || '',
    themeColor: data.themeColor || '#409eff',
    themeMode: data.themeMode || 'light',
    themePalette: data.themePalette || data.themeTokens?.palette || 'custom',
    themeOnPrimary: data.themeOnPrimary || data.themeTokens?.onPrimary || '#ffffff',
    themePrimaryText: data.themePrimaryText || data.themeTokens?.primaryText || data.themeColor || '#409eff',
    themeColorStrong: data.themeColorStrong || data.themeTokens?.primaryStrong || data.themeColor || '#337ecc',
    themeTokens: data.themeTokens || {},
    systemStyle: data.systemStyle || 'Classic',
    systemTitle: data.systemTitle || data.systemShortTitle || data.osClient || '当前系统',
    systemShortTitle: data.systemShortTitle || '',
    fileServer: data.fileServer || '',
    isOfficialPlatform: data.isOfficialPlatform === true || Number(data.isOfficialPlatform || 0) === 1,
    disableFormMaskBlur: data.disableFormMaskBlur === true || Number(data.disableFormMaskBlur || 0) === 1,
    currentUser: data.currentUser || {},
    microRoute: data.microRoute || data.MicroRoute || data.routePath || data.RoutePath || data.route || '',
    route: data.route || {},
    dialogData: data.dialogData || data.DialogData || {},
    componentData: data.componentData || data.ComponentData || {},
    componentMode: data.componentMode || data.ComponentMode || '',
    hostViewport: data.hostViewport || data.HostViewport || { width: 0, height: 0, safeAreaBottom: 0 },
    hostCapabilities: data.hostCapabilities || data.HostCapabilities || {}
  }
}

export function subscribeContext(listener, immediate = true) {
  if (typeof listener !== 'function') return () => {}
  const microApp = window.microApp
  const handleData = (data) => listener(getContext(data))
  if (typeof microApp?.addDataListener === 'function') microApp.addDataListener(handleData)
  if (immediate) handleData(microApp?.getData?.() || {})
  return () => microApp?.removeDataListener?.(handleData)
}

export function configureV8() {
  const context = getContext()
  const contextToken = normalizeToken(context.token)
  V8.configure?.({
    apiBase: context.apiBase,
    osClient: context.osClient,
    appendOsClientQuery: false,
    onTokenChanged: notifyHostTokenChanged
  })
  // getData() 中的 Token 是宿主打开弹窗时的快照。只在宿主真正给出新值时
  // 覆盖一次；子应用从响应头接收的轮换 Token 必须继续作为后续请求事实源。
  if (contextToken && contextToken !== appliedHostToken) {
    appliedHostToken = contextToken
    if (normalizeToken(V8.getToken?.()) !== contextToken) V8.setToken?.(contextToken)
  }
  return V8
}

export function dispatch(type, data = {}, options = {}) {
  const payload = { type, data }
  const microApp = window.microApp
  if (options.force === true && typeof microApp?.forceDispatch === 'function') {
    microApp.forceDispatch(payload)
    return true
  }
  if (typeof microApp?.dispatch === 'function') {
    microApp.dispatch(payload)
    return true
  }
  return false
}
