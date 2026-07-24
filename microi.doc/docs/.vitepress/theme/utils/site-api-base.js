export const OFFICIAL_MICROI_API_BASE = 'https://api.itdos.com'

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
export function resolveSiteApiBase(configuredValue, localFallback = 'https://localhost:7266') {
  const configured = normalizeApiBase(configuredValue)
  const browserIsLocal = typeof window !== 'undefined' && isLoopbackHostname(window.location.hostname)

  if (configured) {
    if (isLoopbackApiBase(configured) && (import.meta.env.PROD || !browserIsLocal)) {
      return OFFICIAL_MICROI_API_BASE
    }
    return configured
  }

  if (!import.meta.env.PROD && browserIsLocal) {
    return normalizeApiBase(localFallback)
  }
  return OFFICIAL_MICROI_API_BASE
}
