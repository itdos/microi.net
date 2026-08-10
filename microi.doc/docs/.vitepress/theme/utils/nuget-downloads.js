import {
  OFFICIAL_MICROI_API_BASE,
  buildSiteApiEngineUrl
} from './site-api-base.js'

const NUGET_PROFILE_URL = 'https://www.nuget.org/profiles/ITdos'
const NUGET_OWNER = 'ITdos'
const NUGET_STATS_ENGINE_KEY = 'official_nuget_stats'
const OS_CLIENT = 'iTdos'
const CACHE_REQUEST_TIMEOUT_MS = 4500
const REFRESH_REQUEST_TIMEOUT_MS = 16000

export const NUGET_STATS_ENDPOINT = `${buildSiteApiEngineUrl(
  OFFICIAL_MICROI_API_BASE,
  NUGET_STATS_ENGINE_KEY
)}?OsClient=${encodeURIComponent(OS_CLIENT)}`

export const NUGET_FALLBACK_STATS = Object.freeze({
  owner: NUGET_OWNER,
  packageCount: 38,
  totalDownloads: 8942864,
  profileUrl: NUGET_PROFILE_URL,
  queriedAt: '',
  cachedAt: '',
  successfulEndpoints: 0,
  stage: 'fallback',
  cacheState: 'embedded',
  ageSeconds: null,
  didRefresh: false,
  refreshFailed: false,
  isLive: false
})

let sharedCacheRequest
let sharedStatsRequest

function asNonNegativeInteger(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback
}

export function normalizeNugetStatsPayload(value, expectedStage = '') {
  if (!value || typeof value !== 'object') throw new Error('NuGet stats payload is empty')

  const owner = String(value.owner || '').trim()
  const packageCount = asNonNegativeInteger(value.packageCount)
  const totalDownloads = asNonNegativeInteger(value.totalDownloads)
  if (owner.toLowerCase() !== NUGET_OWNER.toLowerCase()) throw new Error('Unexpected NuGet owner')
  if (!packageCount || !totalDownloads) throw new Error('NuGet stats payload is invalid')

  const stage = String(value.stage || expectedStage || 'cache').toLowerCase()
  const refreshFailed = value.refreshFailed === true
  return {
    owner: NUGET_OWNER,
    packageCount,
    totalDownloads,
    profileUrl: NUGET_PROFILE_URL,
    queriedAt: String(value.queriedAt || ''),
    cachedAt: String(value.cachedAt || value.queriedAt || ''),
    successfulEndpoints: asNonNegativeInteger(value.successfulEndpoints),
    stage,
    cacheState: String(value.cacheState || ''),
    ageSeconds: value.ageSeconds === null || value.ageSeconds === undefined
      ? null
      : asNonNegativeInteger(value.ageSeconds),
    didRefresh: value.didRefresh === true,
    refreshFailed,
    isLive: stage === 'current' && !refreshFailed
  }
}

async function requestNugetStats(action, {
  fetchImpl = globalThis.fetch,
  timeoutMs
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable')

  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  let timeout
  try {
    const request = (async () => {
      const response = await fetchImpl(NUGET_STATS_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          osclient: OS_CLIENT,
          apiengine: '1'
        },
        body: JSON.stringify({
          Action: action,
          LockScope: action === 'Refresh' ? 'NuGetOfficialRefresh' : 'NuGetCacheRead'
        }),
        signal: controller?.signal
      })
      if (!response || response.ok === false) {
        throw new Error(`NuGet stats request failed: ${response?.status || 'unknown'}`)
      }
      const result = await response.json()
      if (Number(result?.Code) !== 1) throw new Error(result?.Msg || 'NuGet stats request failed')
      return normalizeNugetStatsPayload(result.Data, action === 'Cache' ? 'cache' : 'current')
    })()

    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller?.abort()
        reject(new Error(`NuGet stats request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    return await Promise.race([request, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function loadCachedNugetStats({ fetchImpl = globalThis.fetch } = {}) {
  if (!sharedCacheRequest) {
    sharedCacheRequest = requestNugetStats('Cache', {
      fetchImpl,
      timeoutMs: CACHE_REQUEST_TIMEOUT_MS
    }).catch(error => {
      sharedCacheRequest = undefined
      throw error
    })
  }
  return sharedCacheRequest
}

export function loadNugetOwnerStats({ fetchImpl = globalThis.fetch } = {}) {
  if (!sharedStatsRequest) {
    sharedStatsRequest = requestNugetStats('Refresh', {
      fetchImpl,
      timeoutMs: REFRESH_REQUEST_TIMEOUT_MS
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
  sharedCacheRequest = undefined
  sharedStatsRequest = undefined
}
