import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import {
  NUGET_FALLBACK_STATS,
  NUGET_LOCAL_STORAGE_KEY,
  NUGET_STATS_ENDPOINT,
  __resetNugetStatsRequestForTests,
  formatCompactDownloads,
  loadCachedNugetStats,
  loadLocalNugetStats,
  loadNugetOwnerStats,
  normalizeNugetStatsPayload,
  persistLocalNugetStats,
  preferHigherNugetStats
} from '../docs/.vitepress/theme/utils/nuget-downloads.js'

const ENGINE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'Microi-V8-Engine',
  'Microi吾码 (api.itdos.com)',
  'iTdos.Product.Internal',
  '接口引擎',
  '系统',
  '[官网]NuGet官方实时汇总(official_nuget_stats).js'
)
let ENGINE_SOURCE = ''
try {
  ENGINE_SOURCE = await readFile(ENGINE_PATH, 'utf8')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
const ENGINE_TEST_OPTIONS = ENGINE_SOURCE
  ? {}
  : { skip: 'Microi-V8-Engine is a local MCP mirror and is not present in clean website checkouts' }

const STATS = Object.freeze({
  owner: 'ITdos',
  packageCount: 38,
  totalDownloads: 9741567,
  profileUrl: 'https://www.nuget.org/profiles/ITdos',
  queriedAt: '2026-08-22T00:46:00.065Z',
  cachedAt: '2026-08-22T00:46:00.065Z',
  successfulEndpoints: 2,
  ageSeconds: 12,
  didRefresh: false,
  refreshFailed: false
})

const FIXED_NOW = '2026-08-22T01:00:20.000Z'
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]))
  }

  static now() {
    return new Date(FIXED_NOW).getTime()
  }
}

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
  assert.match(component, /数据库每日持久快照/)
  assert.match(component, /浏览器最近成功快照/)
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
  assert.equal(formatCompactDownloads(9741567, 'zh-CN'), '974万+')
  assert.equal(formatCompactDownloads(9741567, 'en-US'), '9.7M+')
  assert.equal(formatCompactDownloads(999, 'zh-CN'), '999')
  assert.equal(NUGET_FALLBACK_STATS.totalDownloads, 9741567)
  assert.equal(NUGET_FALLBACK_STATS.profileUrl, 'https://www.nuget.org/profiles/ITdos')
})

test('keeps the browser last-success snapshot monotonic when the official API is unreachable', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  }

  const stored = persistLocalNugetStats({ ...STATS, stage: 'current' }, { storage })
  assert.equal(stored.totalDownloads, STATS.totalDownloads)
  assert.equal(stored.stage, 'browser')
  assert.ok(values.has(NUGET_LOCAL_STORAGE_KEY))

  persistLocalNugetStats({ ...STATS, totalDownloads: 9000000, stage: 'cache' }, { storage })
  const local = loadLocalNugetStats({ storage })
  assert.equal(local.totalDownloads, STATS.totalDownloads)
  assert.equal(
    preferHigherNugetStats(local, { ...STATS, totalDownloads: 9100000 }),
    local
  )

  values.set(NUGET_LOCAL_STORAGE_KEY, '{broken')
  assert.equal(loadLocalNugetStats({ storage }), null)
})

test('reads the daily database snapshot and repopulates Redis after a cache loss', ENGINE_TEST_OPTIONS, () => {
  const databaseRow = dailyRow(STATS.totalDownloads, '2026-08-21T23:00:00.000Z')
  const execution = executeStatsEngine({
    action: 'Cache',
    databaseRows: [databaseRow]
  })

  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.stage, 'database')
  assert.equal(execution.result.Data.cacheState, 'database-recovered')
  assert.equal(execution.result.Data.totalDownloads, STATS.totalDownloads)
  assert.ok(execution.cache.has('PublicStats:NuGetITdos'))
})

test('writes a successful refresh to Redis before adding the daily database snapshot', ENGINE_TEST_OPTIONS, () => {
  assert.match(ENGINE_SOURCE, /Version: v1\.0\.3/)
  assert.match(ENGINE_SOURCE, /mci_nuget_stats_daily/)

  const execution = executeStatsEngine({ action: 'Refresh' })
  const redisWrite = execution.events.indexOf('cache:set')
  const databaseWrite = execution.events.indexOf('db:add')

  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, STATS.totalDownloads)
  assert.equal(execution.result.Data.databaseState, 'persisted')
  assert.ok(redisWrite >= 0)
  assert.ok(databaseWrite > redisWrite)
  assert.equal(execution.databaseRows.length, 1)
  assert.equal(execution.databaseRows[0].StatDate, '2026-08-22')
  assert.equal(execution.databaseRows[0].TotalDownloads, STATS.totalDownloads)
})

test('updates the same daily row when a later successful total is higher', ENGINE_TEST_OPTIONS, () => {
  const databaseRow = dailyRow(9700000, '2026-08-22T00:00:00.000Z')
  const execution = executeStatsEngine({
    action: 'Refresh',
    databaseRows: [databaseRow]
  })

  const redisWrite = execution.events.indexOf('cache:set')
  const databaseWrite = execution.events.indexOf('db:update')
  assert.equal(execution.result.Code, 1)
  assert.ok(databaseWrite > redisWrite)
  assert.equal(execution.databaseRows.length, 1)
  assert.equal(execution.databaseRows[0].TotalDownloads, STATS.totalDownloads)
  assert.equal(execution.databaseRows[0].StatDate, '2026-08-22')
})

test('falls back to the database and never accepts a lower NuGet regional index total', ENGINE_TEST_OPTIONS, () => {
  const databaseRow = dailyRow(9800000, '2026-08-20T00:00:00.000Z')
  const unavailable = executeStatsEngine({
    action: 'Refresh',
    databaseRows: [databaseRow],
    httpStatus: 503
  })
  assert.equal(unavailable.result.Code, 1)
  assert.equal(unavailable.result.Data.stage, 'database')
  assert.equal(unavailable.result.Data.totalDownloads, 9800000)
  assert.equal(unavailable.result.Data.refreshFailed, true)

  const lagging = executeStatsEngine({
    action: 'Refresh',
    databaseRows: [databaseRow],
    upstreamTotal: 9700000
  })
  assert.equal(lagging.result.Code, 1)
  assert.equal(lagging.result.Data.cacheState, 'index-lag')
  assert.equal(lagging.result.Data.totalDownloads, 9800000)
})

function dailyRow(totalDownloads, queriedAt) {
  return {
    Id: `snapshot-${String(totalDownloads)}`,
    Owner: 'ITdos',
    StatDate: String(queriedAt).slice(0, 10),
    PackageCount: 38,
    TotalDownloads: totalDownloads,
    ProfileUrl: 'https://www.nuget.org/profiles/ITdos',
    QueriedAt: queriedAt,
    CachedAt: queriedAt,
    SuccessfulEndpoints: 2,
    Source: 'nuget-official-api',
    SchemaVersion: 1
  }
}

function nugetPayload(totalDownloads) {
  const base = Math.floor(totalDownloads / 38)
  let remainder = totalDownloads - (base * 38)
  return {
    data: Array.from({ length: 38 }, (_, index) => {
      const downloads = base + (remainder > 0 ? 1 : 0)
      remainder = Math.max(0, remainder - 1)
      return {
        id: `Package.${index + 1}`,
        owners: ['ITdos'],
        totalDownloads: downloads
      }
    })
  }
}

function executeStatsEngine({
  action,
  cacheStats = null,
  databaseRows = [],
  upstreamTotal = STATS.totalDownloads,
  httpStatus = 200,
  cacheWriteSucceeds = true
}) {
  const events = []
  const cache = new Map()
  const rows = databaseRows.map(row => ({ ...row }))
  if (cacheStats) cache.set('PublicStats:NuGetITdos', JSON.stringify(cacheStats))

  const V8 = {
    Param: {
      Action: action,
      LockScope: action === 'Refresh' ? 'NuGetOfficialRefresh' : 'NuGetCacheRead'
    },
    DbTrans: {},
    Cache: {
      Get(key) {
        events.push('cache:get')
        return cache.has(key) ? cache.get(key) : null
      },
      Set(key, value) {
        events.push('cache:set')
        if (!cacheWriteSucceeds) return false
        cache.set(key, value)
        return true
      }
    },
    FormEngine: {
      GetTableData(tableName) {
        assert.equal(tableName, 'mci_nuget_stats_daily')
        events.push('db:list')
        const data = rows
          .filter(row => row.Owner === 'ITdos')
          .sort((left, right) => String(right.StatDate).localeCompare(String(left.StatDate)))
          .slice(0, 1)
        return { Code: 1, Data: data }
      },
      GetFormData(tableName, query) {
        assert.equal(tableName, 'mci_nuget_stats_daily')
        events.push('db:get')
        const expectedDate = query._Where[1][3]
        const row = rows.find(item => item.Owner === 'ITdos' && item.StatDate === expectedDate)
        return row ? { Code: 1, Data: row } : { Code: 2, Data: null }
      },
      AddFormData(tableName, form) {
        assert.equal(tableName, 'mci_nuget_stats_daily')
        events.push('db:add')
        rows.push({ Id: `snapshot-${rows.length + 1}`, ...form })
        return { Code: 1, Data: rows.at(-1) }
      },
      UptFormData(tableName, form) {
        assert.equal(tableName, 'mci_nuget_stats_daily')
        events.push('db:update')
        const row = rows.find(item => item.Id === form.Id)
        if (!row) return { Code: 0, Msg: 'missing row' }
        Object.assign(row, form)
        return { Code: 1, Data: row }
      }
    },
    Http: {
      GetResponse() {
        events.push('http:get')
        return {
          StatusCode: httpStatus,
          Content: JSON.stringify(nugetPayload(upstreamTotal))
        }
      }
    }
  }

  const result = runInNewContext(`(function () {\n${ENGINE_SOURCE}\n})()`, {
    V8,
    Date: FixedDate,
    console: { log: message => events.push(`log:${message}`) }
  })
  return { result, events, cache, databaseRows: rows }
}

function response(payload) {
  return {
    ok: true,
    status: 200,
    async json() { return payload }
  }
}
