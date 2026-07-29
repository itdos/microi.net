export const OFFICIAL_MICROI_API_BASE = 'https://api.itdos.com'
export const LOCAL_MICROI_API_BASE = 'https://localhost:61501'

function normalizeApiBase(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function isLoopbackHostname(value) {
  const hostname = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '::1'
    || hostname === '0.0.0.0'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

function isLoopbackApiBase(value) {
  try {
    return isLoopbackHostname(new URL(value).hostname)
  } catch {
    return false
  }
}

/**
 * Resolve the API base for the standalone website.
 * Local loopback overrides are valid only for the Vite development server.
 * A production bundle or a non-local website must never call the publisher's localhost.
 */
export function resolveSiteApiBaseForRuntime(configuredValue, runtime = {}) {
  const {
    isProduction = false,
    hostname = '',
    localFallback = LOCAL_MICROI_API_BASE
  } = runtime
  const configured = normalizeApiBase(configuredValue)
  const browserIsLocal = isLoopbackHostname(hostname)

  if (configured) {
    if (isLoopbackApiBase(configured) && (isProduction || !browserIsLocal)) {
      return OFFICIAL_MICROI_API_BASE
    }
    return configured
  }

  if (!isProduction && browserIsLocal) {
    return normalizeApiBase(localFallback)
  }
  return OFFICIAL_MICROI_API_BASE
}

export function resolveSiteApiBase(configuredValue, localFallback = LOCAL_MICROI_API_BASE) {
  return resolveSiteApiBaseForRuntime(configuredValue, {
    isProduction: Boolean(import.meta.env.PROD),
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    localFallback
  })
}

export function buildSiteApiEngineUrl(apiBase, apiEngineKey) {
  const base = normalizeApiBase(apiBase)
  const key = encodeURIComponent(String(apiEngineKey || '').trim())
  return `${base}/apiengine/${key}`
}
