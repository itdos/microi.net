const MESSAGE_SOURCE = 'microi-doc'
const REQUEST_SOURCE = 'microi-openclaw'

function isTrustedOpenClawOrigin(origin: string) {
  try {
    const url = new URL(origin)
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
      && ['http:', 'https:'].includes(url.protocol)
      && port >= 5566
      && port <= 5576
  } catch {
    return false
  }
}

export function isOpenClawBridgeMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('openclawBridge') === '1'
}

/**
 * 与本机吾码小龙虾建立受限握手。
 * ready 消息不携带敏感数据；只有 localhost/127.0.0.1 父窗口主动请求后，
 * 才会把当前官网登录态发回该父窗口。
 */
export function createOpenClawAuthBridge(getSnapshot: () => Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return { notify() {}, destroy() {} }
  }

  let trustedParent: MessageEventSource | null = null
  let trustedOrigin = ''
  let trustedChannel = ''

  const notify = () => {
    if (!trustedParent || !trustedOrigin || typeof (trustedParent as Window).postMessage !== 'function') return
    let snapshot: Record<string, unknown>
    try {
      // Vue ref 中的对象是 Proxy，不能直接经过 postMessage 的结构化克隆。
      snapshot = JSON.parse(JSON.stringify(getSnapshot() || {}))
    } catch {
      return
    }
    ;(trustedParent as Window).postMessage({
      source: MESSAGE_SOURCE,
      type: 'account:state',
      version: 1,
      channel: trustedChannel,
      ...snapshot
    }, trustedOrigin)
  }

  const onMessage = (event: MessageEvent) => {
    if (event.data?.source !== REQUEST_SOURCE || event.data?.type !== 'account:request') return
    if (!isTrustedOpenClawOrigin(event.origin) || !event.source) return
    if (typeof event.data.channel !== 'string' || event.data.channel.length < 16) return
    trustedParent = event.source
    trustedOrigin = event.origin
    trustedChannel = event.data.channel
    notify()
  }

  window.addEventListener('message', onMessage)
  if (window.parent !== window) {
    // 不含 Token，只提示父窗口可以开始受限握手。
    window.parent.postMessage({ source: MESSAGE_SOURCE, type: 'account:ready', version: 1 }, '*')
  }

  return {
    notify,
    destroy() {
      window.removeEventListener('message', onMessage)
      trustedParent = null
      trustedOrigin = ''
      trustedChannel = ''
    }
  }
}
