// A refreshed enum replaces its previous version. Unioning versions resurrects
// renamed/deleted values; local options are only a metadata-unavailable fallback.
export function resolveStatusOptions(preferred, fallback = []) {
  const options = Array.isArray(preferred) && preferred.length ? preferred : fallback
  return [...new Set((Array.isArray(options) ? options : []).filter(value => value !== '' && value != null))]
}

export function reconcileStatusSelection(value, options = []) {
  if (!value || !options.length) return value || ''
  return options.some(option => String(option) === String(value)) ? value : ''
}
