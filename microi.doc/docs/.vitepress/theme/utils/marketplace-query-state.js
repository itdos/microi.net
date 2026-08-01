export const DEFAULT_MARKETPLACE_STATE = Object.freeze({
  category: 'all',
  sort: 'AppUpdateTime',
  q: ''
})

const allowedSorts = new Set([
  'AppUpdateTime',
  'AppPublishTime',
  'ViewCount',
  'InstallCount',
  'FavoriteCount'
])

function normalizeCategory(value) {
  const category = String(value || '').trim()
  if (!category || category === DEFAULT_MARKETPLACE_STATE.category) return DEFAULT_MARKETPLACE_STATE.category
  return /^[a-z][a-z0-9_-]{0,39}$/i.test(category) ? category : DEFAULT_MARKETPLACE_STATE.category
}

function normalizeSort(value) {
  const sort = String(value || '').trim()
  return allowedSorts.has(sort) ? sort : DEFAULT_MARKETPLACE_STATE.sort
}

function normalizeKeyword(value) {
  return String(value || '').trim().slice(0, 120)
}

export function normalizeMarketplaceState(value = {}) {
  return {
    category: normalizeCategory(value.category),
    sort: normalizeSort(value.sort),
    q: normalizeKeyword(value.q)
  }
}

export function readMarketplaceState(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  return normalizeMarketplaceState({
    category: params.get('category'),
    sort: params.get('sort'),
    q: params.get('q')
  })
}

export function buildMarketplaceHref(locationLike, value = {}) {
  const state = normalizeMarketplaceState(value)
  const pathname = String(locationLike?.pathname || '/apps.html')
  const hash = String(locationLike?.hash || '')
  const params = new URLSearchParams(String(locationLike?.search || '').replace(/^\?/, ''))

  params.delete('category')
  params.delete('sort')
  params.delete('q')
  if (state.category !== DEFAULT_MARKETPLACE_STATE.category) params.set('category', state.category)
  if (state.sort !== DEFAULT_MARKETPLACE_STATE.sort) params.set('sort', state.sort)
  if (state.q) params.set('q', state.q)

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${hash}`
}
