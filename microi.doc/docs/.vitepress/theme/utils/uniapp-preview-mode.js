// Historical UniApp packages were published by more than one publisher version.
// These applications have a working H5 root entry, but that entry does not yet
// include the desktop `Microi UniApp H5 Preview` shell. Keep the compatibility
// decision data-driven until each package is republished by the fixed publisher.
//
// Audited against the iTdos public application catalogue on 2026-07-29.
export const LEGACY_UNIAPP_WITHOUT_DESKTOP_SHELL = Object.freeze([
  'community-circle',
  'community-group-buy',
  'enterprise-website',
  'fashion-lookbook',
  'habit-pulse',
  'hiking-journal',
  'home-repair-booking',
  'jewelry-store',
  'lost-found-hub',
  'mammoth-space',
  'mobile-attendance',
  'mobile-food-order',
  'mobile-office',
  'oa-collaboration-suite',
  'parking-helper',
  'player-social',
  'pocket-budget',
  'sales-dashboard',
  'smart-business-card',
  'tuniao-ecosystem',
  'visual-commerce'
])

const legacyShellKeys = new Set(LEGACY_UNIAPP_WITHOUT_DESKTOP_SHELL)

export function isMobilePreviewViewport(windowLike) {
  return Boolean(windowLike?.matchMedia?.(
    '(max-width: 767px), (pointer: coarse) and (max-width: 1024px)'
  ).matches)
}

export function buildApplicationLaunchUrl(app, target, windowLike) {
  const applicationType = String(app?.ApplicationType || '').trim().toLowerCase()
  const appKey = String(app?.AppKey || '').trim().toLowerCase()
  if (applicationType !== 'uniapp' || isMobilePreviewViewport(windowLike)) return target

  // Newer UniApp root entries already own the responsive phone shell. Only
  // historical shell-less roots need the website compatibility wrapper.
  if (!legacyShellKeys.has(appKey)) return target

  const name = String(app?.Name || '')
  return `/uniapp-preview.html?src=${encodeURIComponent(target)}&name=${encodeURIComponent(name)}`
}
