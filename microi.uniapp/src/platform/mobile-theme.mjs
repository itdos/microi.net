import { mixRuntimeColor, normalizeRuntimeColor } from './runtime-branding.mjs'
import { runtimeEndpointScope } from './runtime-endpoint.mjs'

export const MOBILE_THEME_STORAGE_VERSION = 1

export const MOBILE_THEME_OPTIONS = Object.freeze([
  { key: 'system', label: '跟随 PC', color: '' },
  { key: 'brand-blue', label: '品牌蓝', color: '#2563EB' },
  { key: 'technology-cyan', label: '科技青', color: '#0E7490' },
  { key: 'collaboration-green', label: '协同绿', color: '#15803D' },
  { key: 'energy-orange', label: '活力橙', color: '#C2410C' },
  { key: 'alert-red', label: '警示红', color: '#B51220' },
  { key: 'professional-purple', label: '专业紫', color: '#6D28D9' },
  { key: 'deep-black', label: '深邃黑', color: '#111827' }
])

export function normalizeMobileThemeMode(value) {
  const key = String(value || '').trim()
  return MOBILE_THEME_OPTIONS.some((item) => item.key === key) ? key : 'system'
}

export function mobileThemeStorageKey({ profileId, apiBase, osClient } = {}) {
  const profile = String(profileId || 'microi').trim().toLowerCase() || 'microi'
  return `mci_mobile_theme_v${MOBILE_THEME_STORAGE_VERSION}:${profile}:${runtimeEndpointScope(apiBase, osClient)}`
}

export function resolveMobileTheme(baseTheme = {}, mode = 'system') {
  const normalizedMode = normalizeMobileThemeMode(mode)
  const option = MOBILE_THEME_OPTIONS.find((item) => item.key === normalizedMode)
  if (!option || option.key === 'system') return { ...baseTheme }

  const primary = normalizeRuntimeColor(option.color)
  return {
    ...baseTheme,
    primary,
    primaryLight: mixRuntimeColor(primary, '#FFFFFF', 0.22),
    primaryDark: mixRuntimeColor(primary, '#000000', 0.2),
    brand: primary
  }
}

export function getMobileThemeOption(mode) {
  const normalizedMode = normalizeMobileThemeMode(mode)
  return MOBILE_THEME_OPTIONS.find((item) => item.key === normalizedMode) || MOBILE_THEME_OPTIONS[0]
}
