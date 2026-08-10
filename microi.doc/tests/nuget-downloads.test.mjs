import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  NUGET_FALLBACK_STATS,
  NUGET_STATS_ENDPOINT,
  __resetNugetStatsRequestForTests,
  formatCompactDownloads,
  loadCachedNugetStats,
  loadNugetOwnerStats,
  normalizeNugetStatsPayload
} from '../docs/.vitepress/theme/utils/nuget-downloads.js'

const STATS = Object.freeze({
  owner: 'ITdos',
  packageCount: 38,
  totalDownloads: 8942864,
  profileUrl: 'https://www.nuget.org/profiles/ITdos',
  queriedAt: '2026-08-10T12:21:40.281Z',
  cachedAt: '2026-08-10T12:21:40.281Z',
  successfulEndpoints: 2,
  ageSeconds: 12,
  didRefresh: false,
  refreshFailed: false
})

test('uses the official iTdos API Engine endpoint instead of querying NuGet from every browser', async () => {
  assert.equal(
    NUGET_STATS_ENDPOINT,
    'https://api.itdos.com/apiengine/official_nuget_stats?OsClient=iTdos'
  )

  const source = await readFile(new URL('../docs/.vitepress/theme/utils/nuget-downloads.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /api\.nuget\.org|azuresearch-[a-z]+\.nuget\.org/i)

  const component = await readFile(new URL('../docs/.vitepress/theme/components/MciNugetStats.vue', import.meta.url), 'utf8')
  assert.match(component, /正在更新/)
  assert.match(component, /当前 API 实时汇总/)
  assert.match(component, /Redis 最近一次成功汇总/)
})

test('normalizes only valid ITdos server payloads and keeps the official profile URL', () => {
  const result = normalizeNugetStatsPayload({
    ...STATS,
    profileUrl: 'https://example.com/untrusted',
    stage: 'current',
    cacheState: 'fresh'
  })

  assert.equal(result.owner, 'ITdos')
  assert.equal(result.totalDownloads, STATS.totalDownloads)
  assert.equal(result.profileUrl, 'https://www.nuget.org/profiles/ITdos')
  assert.equal(result.isLive, true)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, owner: 'another-owner' }), /owner/i)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, totalDownloads: 0 }), /invalid/i)
})

test('loads the Redis last-success snapshot before the refresh request', async () => {
  __resetNugetStatsRequestForTests()
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options })
    return response({ Code: 1, Data: { ...STATS, stage: 'cache', cacheState: 'hit' } })
  }

  const result = await loadCachedNugetStats({ fetchImpl })
  assert.equal(result.stage, 'cache')
  assert.equal(result.isLive, false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, NUGET_STATS_ENDPOINT)
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.osclient, 'iTdos')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    Action: 'Cache',
    LockScope: 'NuGetCacheRead'
  })
})

test('deduplicates refreshes across every NuGet stats component on the same page', async () => {
  __resetNugetStatsRequestForTests()
  let calls = 0
  const fetchImpl = async (_url, options) => {
    calls++
    assert.deepEqual(JSON.parse(options.body), {
      Action: 'Refresh',
      LockScope: 'NuGetOfficialRefresh'
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    return response({
      Code: 1,
      Data: { ...STATS, stage: 'current', cacheState: 'updated', didRefresh: true }
    })
  }

  const [first, second, third] = await Promise.all([
    loadNugetOwnerStats({ fetchImpl }),
    loadNugetOwnerStats({ fetchImpl }),
    loadNugetOwnerStats({ fetchImpl })
  ])

  assert.equal(calls, 1)
  assert.equal(first.isLive, true)
  assert.deepEqual(second, first)
  assert.deepEqual(third, first)
})

test('keeps cached data when the server reports an upstream refresh failure', async () => {
  __resetNugetStatsRequestForTests()
  const result = await loadNugetOwnerStats({
    fetchImpl: async () => response({
      Code: 1,
      Data: { ...STATS, stage: 'cache', cacheState: 'stale', refreshFailed: true }
    })
  })

  assert.equal(result.totalDownloads, STATS.totalDownloads)
  assert.equal(result.refreshFailed, true)
  assert.equal(result.isLive, false)
})

test('clears a failed shared request so a later component can retry', async () => {
  __resetNugetStatsRequestForTests()
  let calls = 0
  const fetchImpl = async () => {
    calls++
    if (calls === 1) return response({ Code: 0, Msg: 'temporary failure' })
    return response({ Code: 1, Data: { ...STATS, stage: 'current', cacheState: 'fresh' } })
  }

  await assert.rejects(loadNugetOwnerStats({ fetchImpl }), /temporary failure/)
  const recovered = await loadNugetOwnerStats({ fetchImpl })
  assert.equal(recovered.isLive, true)
  assert.equal(calls, 2)
})

test('formats Chinese and English compact totals without rounding upward', () => {
  assert.equal(formatCompactDownloads(8942864, 'zh-CN'), '894万+')
  assert.equal(formatCompactDownloads(8942864, 'en-US'), '8.9M+')
  assert.equal(formatCompactDownloads(999, 'zh-CN'), '999')
  assert.equal(NUGET_FALLBACK_STATS.profileUrl, 'https://www.nuget.org/profiles/ITdos')
})

function response(payload) {
  return {
    ok: true,
    status: 200,
    async json() { return payload }
  }
}
