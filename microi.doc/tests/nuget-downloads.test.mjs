import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
  loadNugetSnapshot,
  normalizeNugetStatsPayload,
  persistLocalNugetStats,
  preferHigherNugetStats,
  selectEmbeddedNugetStats
} from '../docs/.vitepress/theme/utils/nuget-downloads.js'
import { NUGET_BUILD_DEFINE, nugetBuildSnapshotPlugin } from '../scripts/nuget-build-snapshot.mjs'

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

test('uses the official iTdos API Engine endpoint instead of querying NuGet from every browser', async () => {
  assert.equal(
    NUGET_STATS_ENDPOINT,
    'https://api.microi.net/apiengine/official_nuget_stats?OsClient=iTdos'
  )

  const source = await readFile(new URL('../docs/.vitepress/theme/utils/nuget-downloads.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /api\.nuget\.org|azuresearch-[a-z]+\.nuget\.org/i)

  const component = await readFile(new URL('../docs/.vitepress/theme/components/MciNugetStats.vue', import.meta.url), 'utf8')
  assert.match(component, /NUGET 官方快照数据/)
  assert.match(component, /每 3 小时/)
  assert.match(component, /最新成功快照/)
  assert.match(component, /浏览器最近成功快照/)
  assert.match(component, /<time[\s\S]*:datetime="stats\.queriedAt"/)
  assert.doesNotMatch(component, /官方实时数据|当前 API 实时汇总|OFFICIAL LIVE DATA/)
  assert.doesNotMatch(component, /位居首位|Ranks first/)
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
  assert.equal(result.isLive, false)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, owner: 'another-owner' }), /owner/i)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, totalDownloads: 0 }), /invalid/i)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, queriedAt: 'invalid' }), /time/i)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, totalDownloads: 1.5 }), /invalid/i)
  assert.throws(() => normalizeNugetStatsPayload({ ...STATS, totalDownloads: Number.MAX_SAFE_INTEGER + 1 }), /invalid/i)
})

test('legacy cache loader only requests the latest persisted snapshot', async () => {
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
    Action: 'Snapshot',
    LockScope: 'NuGetSnapshotRead'
  })
})

test('deduplicates snapshot reads across every NuGet stats component on the same page', async () => {
  __resetNugetStatsRequestForTests()
  let calls = 0
  const fetchImpl = async (_url, options) => {
    calls++
    assert.deepEqual(JSON.parse(options.body), {
      Action: 'Snapshot',
      LockScope: 'NuGetSnapshotRead'
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    return response({
      Code: 1,
      Data: { ...STATS, stage: 'snapshot', databaseState: 'persisted', refreshIntervalSeconds: 10800 }
    })
  }

  const [first, second, third] = await Promise.all([
    loadCachedNugetStats({ fetchImpl }),
    loadNugetOwnerStats({ fetchImpl }),
    loadNugetOwnerStats({ fetchImpl })
  ])

  assert.equal(calls, 1)
  assert.equal(first.isLive, false)
  assert.equal(first.stage, 'snapshot')
  assert.deepEqual(second, first)
  assert.deepEqual(third, first)
})

test('fetches the latest snapshot again after the shared in-flight read completes', async () => {
  __resetNugetStatsRequestForTests()
  let calls = 0
  const fetchImpl = async () => {
    calls++
    return response({
      Code: 1,
      Data: { ...STATS, totalDownloads: STATS.totalDownloads + calls, stage: 'snapshot' }
    })
  }

  const first = await loadNugetOwnerStats({ fetchImpl })
  const nextVisit = await loadNugetOwnerStats({ fetchImpl })
  assert.equal(calls, 2)
  assert.equal(nextVisit.totalDownloads, first.totalDownloads + 1)
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
  assert.equal(recovered.isLive, false)
  assert.equal(calls, 2)
})

test('formats Chinese and English compact totals without rounding upward', () => {
  assert.equal(formatCompactDownloads(9741567, 'zh-CN'), '974万+')
  assert.equal(formatCompactDownloads(9741567, 'en-US'), '9.7M+')
  assert.equal(formatCompactDownloads(999, 'zh-CN'), '999')
  assert.equal(NUGET_FALLBACK_STATS.totalDownloads, 9741567)
  assert.equal(NUGET_FALLBACK_STATS.profileUrl, 'https://www.nuget.org/profiles/ITdos')
})

test('keeps the newest browser snapshot and uses the higher total only for equal snapshot times', () => {
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

  persistLocalNugetStats({
    ...STATS,
    totalDownloads: 9100000,
    queriedAt: '2026-08-23T00:00:00.000Z',
    stage: 'snapshot'
  }, { storage })
  assert.equal(loadLocalNugetStats({ storage }).totalDownloads, 9100000)

  values.set(NUGET_LOCAL_STORAGE_KEY, '{broken')
  assert.equal(loadLocalNugetStats({ storage }), null)
})

test('rejects failed HTTP responses, absent snapshots, and malformed snapshot content', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, status: 503 }),
    async () => response({ Code: 2, Msg: 'No successful snapshot' }),
    async () => response({ Code: 1, Data: null }),
    async () => response({ Code: 1, Data: { ...STATS, owner: 'other' } })
  ]) {
    __resetNugetStatsRequestForTests()
    await assert.rejects(loadNugetSnapshot({ fetchImpl }))
  }
})

test('storage failures do not break snapshot rendering or overwrite a valid payload', () => {
  const storage = {
    getItem() { throw new Error('storage denied') },
    setItem() { throw new Error('quota exceeded') }
  }
  assert.equal(loadLocalNugetStats({ storage }), null)
  assert.equal(persistLocalNugetStats(STATS, { storage }), null)
})

test('component accepts the authoritative snapshot and shows its update time without triggering collection', async () => {
  const latest = {
    ...STATS,
    totalDownloads: 9500000,
    queriedAt: '2026-08-23T03:00:00.000Z',
    stage: 'snapshot'
  }
  const view = await executeStatsComponent({ latest, local: STATS })
  assert.equal(view.requests, 1)
  assert.equal(view.stats.value, latest)
  assert.equal(view.state.value, 'snapshot')
  assert.equal(view.displayDownloads.value, latest.totalDownloads)
  assert.equal(view.statusText.value, '最近成功采集')
  assert.match(view.updateTime.value, /2026/)
  assert.match(view.updateTime.value, /GMT\+8/)
  assert.match(view.sourceText.value, /最新成功快照/)
})

test('component keeps a labeled browser or embedded snapshot when snapshot service is unavailable', async () => {
  const browser = await executeStatsComponent({ local: STATS, failure: true })
  assert.equal(browser.state.value, 'cached')
  assert.equal(browser.statusText.value, '浏览器最近成功快照')
  assert.match(browser.sourceText.value, /浏览器最近成功快照/)
  const embedded = await executeStatsComponent({ failure: true })
  assert.equal(embedded.state.value, 'fallback')
  assert.equal(embedded.statusText.value, '历史内置快照')
  assert.equal(embedded.stats.value.totalDownloads, NUGET_FALLBACK_STATS.totalDownloads)
  const olderBrowser = await executeStatsComponent({
    local: { ...STATS, queriedAt: '2026-01-01T00:00:00.000Z' },
    failure: true
  })
  assert.equal(olderBrowser.state.value, 'fallback')
  assert.equal(olderBrowser.statusText.value, '历史内置快照')
})

test('server rendering labels the embedded collection date instead of promising an active request', async () => {
  const view = await executeStatsComponent({ mountComponent: false })
  assert.equal(view.requests, 0)
  assert.equal(view.state.value, 'fallback')
  assert.equal(view.statusText.value, '历史内置快照')
})

test('website build freezes one bounded read-only snapshot for both SSR and browser compilation', async () => {
  __resetNugetStatsRequestForTests()
  const requests = []
  const warnings = []
  const latest = { ...STATS, totalDownloads: 13000000, packageCount: 48, queriedAt: '2026-10-25T18:00:00+08:00' }
  const plugin = nugetBuildSnapshotPlugin({
    warn: message => warnings.push(message),
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return response({ Code: 1, Data: latest })
    }
  })
  assert.equal(plugin.apply, 'build')
  const [browser, ssr] = await Promise.all([plugin.config(), plugin.config()])
  assert.deepEqual(browser, ssr)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, NUGET_STATS_ENDPOINT)
  assert.deepEqual(JSON.parse(requests[0].options.body), { Action: 'Snapshot', LockScope: 'NuGetSnapshotRead' })
  const snapshot = selectEmbeddedNugetStats(JSON.parse(ssr.define[NUGET_BUILD_DEFINE]))
  assert.equal(snapshot.totalDownloads, latest.totalDownloads)
  assert.equal(snapshot.packageCount, latest.packageCount)
  assert.equal(snapshot.queriedAt, latest.queriedAt, 'UTC offsets must remain the actual collection time')
  assert.equal(snapshot.stage, 'build')
  assert.equal(snapshot.isLive, false)
  assert.equal(warnings.length, 0)
  assert.deepEqual(await plugin.config(), ssr)
  assert.equal(requests.length, 1)
  const shared = await readFile(new URL('../docs/.vitepress/config/shared.ts', import.meta.url), 'utf8')
  assert.match(shared, /plugins:\s*\[[^\]]*nugetBuildSnapshotPlugin\(\)/)
})

test('failed or invalid build reads retain historical values and dates with an explicit warning', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, status: 503 }),
    async () => response({ Code: 2, Data: null }),
    async () => response({ Code: 1, Data: null }),
    async () => response({ Code: 1, Data: { ...STATS, owner: 'other' } }),
    async () => response({ Code: 1, Data: { ...STATS, queriedAt: 'invalid' } }),
    async () => ({ ok: true, async json() { throw new Error('invalid JSON') } })
  ]) {
    __resetNugetStatsRequestForTests()
    const warnings = []
    const plugin = nugetBuildSnapshotPlugin({ fetchImpl, warn: message => warnings.push(message) })
    const config = await plugin.config()
    const snapshot = selectEmbeddedNugetStats(JSON.parse(config.define[NUGET_BUILD_DEFINE]))
    assert.equal(snapshot.totalDownloads, NUGET_FALLBACK_STATS.totalDownloads)
    assert.equal(snapshot.queriedAt, NUGET_FALLBACK_STATS.queriedAt)
    assert.equal(snapshot.stage, 'fallback')
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /历史快照及原采集时间/)
  }
})

test('build snapshot deadline aborts the request and falls back even when fetch ignores cancellation', async () => {
  __resetNugetStatsRequestForTests()
  let signal
  const plugin = nugetBuildSnapshotPlugin({
    timeoutMs: 10,
    warn() {},
    fetchImpl: async (_url, options) => {
      signal = options.signal
      return new Promise(() => {})
    }
  })
  const config = await plugin.config()
  assert.equal(signal.aborted, true)
  assert.equal(JSON.parse(config.define[NUGET_BUILD_DEFINE]).queriedAt, NUGET_FALLBACK_STATS.queriedAt)
})

test('SSR and failed browser reads preserve the build snapshot without labeling it as fresh or live', async () => {
  const embedded = selectEmbeddedNugetStats({
    ...STATS,
    totalDownloads: 13000000,
    packageCount: 48,
    queriedAt: '2026-10-25T10:00:00.000Z',
    cacheState: 'build-snapshot'
  })
  const ssr = await executeStatsComponent({ embedded, mountComponent: false })
  assert.equal(ssr.requests, 0)
  assert.equal(ssr.stats.value.totalDownloads, embedded.totalDownloads)
  assert.equal(ssr.statusText.value, '官网构建快照')
  assert.match(ssr.sourceText.value, /48 个公开包 · 本次官网构建时读取的快照/)
  const offline = await executeStatsComponent({ embedded, local: STATS, failure: true })
  assert.equal(offline.stats.value.queriedAt, embedded.queriedAt)
  assert.equal(offline.statusText.value, '官网构建快照')
  assert.doesNotMatch(offline.sourceText.value, /最新|实时/)
  assert.equal(selectEmbeddedNugetStats({ ...embedded, queriedAt: 'invalid' }).stage, 'fallback')
})

async function executeStatsComponent({ latest, local = null, failure = false, mountComponent = true, embedded = NUGET_FALLBACK_STATS } = {}) {
  const source = await readFile(new URL('../docs/.vitepress/theme/components/MciNugetStats.vue', import.meta.url), 'utf8')
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
  let mount
  let requests = 0
  const view = runInNewContext(`${script}\n;({stats,state,displayDownloads,statusText,sourceText,updateTime})`, {
    NUGET_FALLBACK_STATS: embedded,
    formatCompactDownloads,
    preferHigherNugetStats,
    ref: value => ({ value }),
    computed: getter => ({ get value() { return getter() } }),
    defineProps: () => ({ variant: 'home', locale: 'zh-CN' }),
    useRoute: () => ({ path: '/' }),
    onMounted: callback => { mount = callback },
    onBeforeUnmount() {},
    loadLocalNugetStats: () => local ? { ...local, stage: 'browser' } : null,
    persistLocalNugetStats() {},
    async loadNugetSnapshot() {
      requests++
      if (failure) throw new Error('service unavailable')
      return latest
    }
  })
  if (mountComponent) await mount()
  return { ...view, requests }
}

function response(payload) {
  return {
    ok: true,
    status: 200,
    async json() { return payload }
  }
}
