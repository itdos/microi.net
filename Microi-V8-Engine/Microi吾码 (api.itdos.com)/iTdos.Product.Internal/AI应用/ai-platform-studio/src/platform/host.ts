import type { HostContext } from '../domain/models'
import { isInternalPath, normalizeRoute, type RoutePath } from '../domain/navigation'

function hostData(): Record<string, unknown> {
  return window.microApp?.getData?.() ?? {}
}
function queryValue(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

export function getHostContext(): HostContext {
  const data = hostData()
  const capabilities = (data.hostCapabilities ?? {}) as { protocol?: string; actions?: unknown[] }
  const actions = capabilities.protocol === 'microi.host.v1' && Array.isArray(capabilities.actions)
    ? capabilities.actions.map(String)
    : []
  return {
    apiBase: String(data.apiBase ?? data.ApiBase ?? queryValue('ApiBase') ?? ''),
    osClient: String(data.osClient ?? data.OsClient ?? queryValue('OsClient') ?? ''),
    token: String(data.token ?? data.DiyToken ?? ''),
    appKey: String(data.appKey ?? 'ai-platform-studio'),
    buildVersion: String(data.version ?? data.buildVersion ?? 'v1.0.0'),
    routePath: normalizeRoute(data.microRoute ?? data.MicroRoute ?? data.routePath ?? data.RoutePath ?? window.location.hash),
    hostGeneration: String(data.hostGeneration ?? ''),
    hostMountAttempt: String(data.hostMountAttempt ?? ''),
    hostActions: actions
  }
}

export function callMicroiHost(action: string, data: Record<string, unknown> = {}): boolean {
  const context = getHostContext()
  if (!context.hostActions.includes(action)) return false
  if ((action === 'navigate' || action === 'replaceTab') && !isInternalPath(data.path)) return false
  window.microApp?.dispatch?.({
    type: 'micro-app:host-action',
    action,
    requestId: `mci-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    data
  })
  return true
}

/**
 * Navigate inside this microservice without changing the Microi host Tab route.
 * Host navigate/replaceTab are reserved for leaving the current microservice.
 */
export function navigateMicroRoute(path: unknown, replace = false): RoutePath {
  const route = normalizeRoute(path)
  const nextHash = `#${route}`
  if (window.location.hash !== nextHash) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextHash)
  }
  return route
}

export function notifyReady(): void {
  const context = getHostContext()
  window.microApp?.forceDispatch?.({
    type: 'micro-app:ready',
    appKey: context.appKey,
    version: context.buildVersion,
    hostGeneration: context.hostGeneration,
    hostMountAttempt: context.hostMountAttempt
  })
}

export function notifyInteraction(): void {
  window.microApp?.forceDispatch?.({ type: 'micro-app:interaction', nonce: `${Date.now()}-${Math.random()}` })
}
