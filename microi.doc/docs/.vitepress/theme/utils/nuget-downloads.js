const NUGET_SERVICE_INDEX = 'https://api.nuget.org/v3/index.json'
const NUGET_PROFILE_URL = 'https://www.nuget.org/profiles/ITdos'
const NUGET_OWNER = 'ITdos'
const REQUEST_TIMEOUT_MS = 8000
const SERVICE_INDEX_TIMEOUT_MS = 2500
const SHARED_REQUEST_TIMEOUT_MS = 12000
const KNOWN_SEARCH_ENDPOINTS = Object.freeze([
  'https://azuresearch-usnc.nuget.org/query',
  'https://azuresearch-ussc.nuget.org/query'
])

export const NUGET_FALLBACK_STATS = Object.freeze({
  owner: NUGET_OWNER,
  packageCount: 38,
  totalDownloads: 8923506,
  profileUrl: NUGET_PROFILE_URL,
  isLive: false
})

let sharedStatsRequest

function normalizeResourceTypes(resource) {
  const value = resource?.['@type']
  return Array.isArray(value) ? value.map(String) : [String(value || '')]
}

function isOfficialNugetUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'nuget.org' || url.hostname.endsWith('.nuget.org'))
  } catch {
    return false
  }
}

export function getSearchServiceEndpoints(serviceIndex) {
  const endpoints = []
  const seen = new Set()

  for (const resource of serviceIndex?.resources || []) {
    const isSearchService = normalizeResourceTypes(resource)
      .some(type => type === 'SearchQueryService/3.5.0' || type === 'SearchQueryService')
    const endpoint = String(resource?.['@id'] || '')
    if (!isSearchService || !isOfficialNugetUrl(endpoint) || seen.has(endpoint)) continue
    seen.add(endpoint)
    endpoints.push(endpoint)
  }

  return endpoints
}

function normalizeOwners(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim().toLowerCase())
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

async function fetchJson(fetchImpl, url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  let timeout

  try {
    const request = (async () => {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller?.signal
      })
      if (!response || response.ok === false) {
        throw new Error(`NuGet request failed: ${response?.status || 'unknown'}`)
      }
      return response.json()
    })()

    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller?.abort()
        reject(new Error(`NuGet request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    const response = await Promise.race([request, deadline])
    return response
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function fetchOwnerStatsFromEndpoint(endpoint, owner = NUGET_OWNER, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable')

  const url = new URL(endpoint)
  url.searchParams.set('q', `owner:${owner}`)
  url.searchParams.set('skip', '0')
  url.searchParams.set('take', '1000')
  url.searchParams.set('prerelease', 'true')
  url.searchParams.set('semVerLevel', '2.0.0')

  const payload = await fetchJson(fetchImpl, url.toString())
  const expectedOwner = owner.toLowerCase()
  const packages = new Map()

  for (const item of payload?.data || []) {
    if (!normalizeOwners(item?.owners).includes(expectedOwner)) continue
    const id = String(item?.id || '').trim()
    const totalDownloads = Number(item?.totalDownloads)
    if (!id || !Number.isFinite(totalDownloads) || totalDownloads < 0) continue
    packages.set(id.toLowerCase(), { id, totalDownloads })
  }

  if (!packages.size) throw new Error(`NuGet returned no public packages for ${owner}`)

  return {
    endpoint,
    packageCount: packages.size,
    totalDownloads: [...packages.values()].reduce((sum, item) => sum + item.totalDownloads, 0)
  }
}

export async function fetchNugetOwnerStats({ owner = NUGET_OWNER, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable')

  let endpoints = [...KNOWN_SEARCH_ENDPOINTS]
  try {
    const serviceIndex = await fetchJson(fetchImpl, NUGET_SERVICE_INDEX, SERVICE_INDEX_TIMEOUT_MS)
    const discovered = getSearchServiceEndpoints(serviceIndex)
    if (discovered.length) endpoints = [...new Set([...discovered, ...KNOWN_SEARCH_ENDPOINTS])]
  } catch {
    // The known URLs are both official resources published by the NuGet V3 service index.
  }

  const settled = await Promise.allSettled(
    endpoints.map(endpoint => fetchOwnerStatsFromEndpoint(endpoint, owner, fetchImpl))
  )
  const successful = settled
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
  if (!successful.length) throw new Error('All NuGet search endpoints failed')

  // NuGet 的主、备搜索索引会有短暂同步差。下载量只增不减时，较大值通常代表更新更快的节点。
  const freshest = successful.reduce((best, current) => (
    current.totalDownloads > best.totalDownloads ? current : best
  ))

  return {
    owner,
    packageCount: freshest.packageCount,
    totalDownloads: freshest.totalDownloads,
    profileUrl: NUGET_PROFILE_URL,
    queriedAt: new Date().toISOString(),
    successfulEndpoints: successful.length,
    isLive: true
  }
}

export function loadNugetOwnerStats() {
  if (!sharedStatsRequest) {
    let timeout
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('NuGet live total timed out')), SHARED_REQUEST_TIMEOUT_MS)
    })

    sharedStatsRequest = Promise.race([fetchNugetOwnerStats(), deadline]).finally(() => {
      if (timeout) clearTimeout(timeout)
    }).catch(error => {
      sharedStatsRequest = undefined
      throw error
    })
  }
  return sharedStatsRequest
}

export function formatCompactDownloads(totalDownloads, locale = 'zh-CN') {
  const total = Number(totalDownloads)
  if (!Number.isFinite(total) || total < 0) return '—'
  if (locale.toLowerCase().startsWith('zh') && total >= 10000) {
    return `${Math.floor(total / 10000)}万+`
  }
  if (total >= 1000000) return `${(total / 1000000).toFixed(1).replace(/\.0$/, '')}M+`
  if (total >= 1000) return `${Math.floor(total / 1000)}K+`
  return String(Math.floor(total))
}

export function __resetNugetStatsRequestForTests() {
  sharedStatsRequest = undefined
}
