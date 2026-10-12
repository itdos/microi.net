import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const ENGINE_PATH = process.env.MICROI_NUGET_ENGINE_TEST_SOURCE || resolve(
  dirname(fileURLToPath(import.meta.url)), '..', 'server', 'api-engines',
  'official-nuget-stats.js'
)
// 官网业务源码随站点仓库交付；缺失即失败，不能用私有本地镜像缺失跳过回归。
const ENGINE_SOURCE = await readFile(ENGINE_PATH, 'utf8')
const ENGINE_TEST_OPTIONS = {}
const JOB_DEFINITION = JSON.parse(await readFile(new URL('../server/jobs/official-nuget-stats.json', import.meta.url), 'utf8'))

const FIXED_NOW = '2026-10-13T03:00:00.000Z'
const JOB_NAME = 'officialNugetStatsRefresh'
const CACHE_KEY = 'PublicStats:NuGetITdos'
const TABLE = 'mci_nuget_stats_daily'
const ADMIN = { Id: 'administrator', Level: 9999 }
const JOB_PARAM = {
  _InvokeType: 'Server',
  JobName: JOB_NAME,
  JobId: JOB_NAME,
  JobRunId: 'quartz-fire-001',
  ScheduledFireTime: FIXED_NOW,
  JobParam: JSON.stringify({ Action: 'Refresh', LockScope: 'NuGetOfficialRefresh' })
}

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])) }
  static now() { return new Date(FIXED_NOW).getTime() }
}

function dailyRow(totalDownloads = 11000000, queriedAt = '2026-10-12T21:00:00.000Z') {
  return {
    Id: `snapshot-${queriedAt.slice(0, 10)}`,
    Owner: 'ITdos', StatDate: queriedAt.slice(0, 10), PackageCount: 2,
    TotalDownloads: totalDownloads, ProfileUrl: 'https://www.nuget.org/profiles/ITdos',
    QueriedAt: queriedAt, CachedAt: queriedAt, SuccessfulEndpoints: 2,
    Source: 'nuget-official-api', SchemaVersion: 1
  }
}

function payload(totalDownloads) {
  return { data: [
    { id: 'Microi.Core', owners: ['ITdos'], totalDownloads: Math.floor(totalDownloads / 2) },
    { id: 'Dos.ORM', owners: ['itdos'], totalDownloads: totalDownloads - Math.floor(totalDownloads / 2) }
  ] }
}

// 真实 HTTP 的调用方式与上下文由宿主强制写入；业务参数中的身份字段不能替代它们。
function execute({
  params = { Action: 'Snapshot' }, user = {}, httpContext = { Request: {} },
  rows = [dailyRow()], cacheStats = null,
  endpoints = [{ totalDownloads: 12000000 }, { totalDownloads: 12100000 }],
  databaseReadFails = false, databaseWriteFails = false, cacheWriteSucceeds = true,
  cacheReadThrows = false, cacheWriteThrows = false
} = {}) {
  const events = []
  const databaseRows = rows.map(row => ({ ...row }))
  const cache = new Map(cacheStats ? [[CACHE_KEY, JSON.stringify(cacheStats)]] : [])
  const transaction = {}
  let endpointIndex = 0
  const V8 = {
    Param: { _InvokeType: 'Client', OsClient: 'iTdos', ...params },
    CurrentUser: user, HttpContext: httpContext, OsClient: 'iTdos', DbTrans: transaction,
    Method: { AddSysLog(log) { events.push({ kind: 'log', log }) } },
    Cache: {
      Get(key) {
        events.push({ kind: 'cache:get', key })
        if (cacheReadThrows) throw new Error('Redis temporarily unavailable')
        return cache.get(key) || null
      },
      Set(key, value) {
        events.push({ kind: 'cache:set', key })
        if (cacheWriteThrows) throw new Error('Redis temporarily unavailable')
        if (cacheWriteSucceeds) cache.set(key, value)
        return cacheWriteSucceeds
      }
    },
    FormEngine: {
      GetTableData(table, query) {
        assert.equal(table, TABLE)
        events.push({ kind: 'db:list', query })
        if (databaseReadFails) return { Code: 0, Msg: 'snapshot storage unavailable' }
        const field = query._OrderBy || 'QueriedAt'
        const data = databaseRows.filter(row => row.Owner === 'ITdos')
          .sort((left, right) => String(right[field]).localeCompare(String(left[field])))
          .slice(0, query._PageSize || 1)
        return { Code: 1, Data: data }
      },
      GetFormData(table, query) {
        assert.equal(table, TABLE)
        events.push({ kind: 'db:get', query })
        const dateCondition = query._Where.find(condition => condition.includes('StatDate'))
        const expectedDate = dateCondition?.at(-1)
        const row = databaseRows.find(item => item.Owner === 'ITdos' && item.StatDate === expectedDate)
        return row ? { Code: 1, Data: { ...row } } : { Code: 2, Data: null }
      },
      AddFormData(table, form, trans) {
        assert.equal(table, TABLE)
        assert.equal(trans, transaction)
        events.push({ kind: 'db:add', form })
        if (databaseWriteFails) return { Code: 0, Msg: 'snapshot write rejected' }
        databaseRows.push({ Id: `snapshot-${databaseRows.length + 1}`, ...form })
        return { Code: 1, Data: databaseRows.at(-1) }
      },
      UptFormData(table, form, trans) {
        assert.equal(table, TABLE)
        assert.equal(trans, transaction)
        events.push({ kind: 'db:update', form })
        if (databaseWriteFails) return { Code: 0, Msg: 'snapshot write rejected' }
        const row = databaseRows.find(item => item.Id === form.Id)
        if (!row) return { Code: 0, Msg: 'snapshot missing' }
        Object.assign(row, form)
        return { Code: 1, Data: row }
      }
    },
    Http: {
      GetResponse(request) {
        events.push({ kind: 'http:get', url: request.Url })
        const endpoint = endpoints[endpointIndex++] || { status: 503 }
        if (endpoint.error) throw new Error(endpoint.error)
        return {
          StatusCode: endpoint.status ?? 200,
          Content: endpoint.content ?? JSON.stringify(payload(endpoint.totalDownloads ?? 12000000)),
          ErrorMessage: endpoint.errorMessage || ''
        }
      }
    }
  }
  const result = runInNewContext(`(function () {\n${ENGINE_SOURCE}\n})()`, {
    V8, Date: FixedDate, console: { log: message => events.push({ kind: 'log', message }) }
  })
  return { result, events, databaseRows, cache }
}

function onlyReadSnapshot(execution, total = 11000000) {
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.stage, 'snapshot')
  assert.equal(execution.result.Data.totalDownloads, total)
  assert.equal(execution.result.Data.didRefresh, false)
  assert.equal(execution.result.Data.refreshIntervalSeconds, 10800)
  assert.deepEqual(execution.events.filter(event => !['db:list', 'log'].includes(event.kind)), [])
}

test('the versioned job declaration targets only the official refresh every three hours', () => {
  assert.equal(JOB_DEFINITION.JobName, JOB_NAME)
  assert.equal(JOB_DEFINITION.JobType, '1')
  assert.equal(JOB_DEFINITION.ApiEngineKey, 'official_nuget_stats')
  assert.equal(JOB_DEFINITION.CronExpression, '0 0 0/3 * * ?')
  assert.equal(JOB_DEFINITION.TimeZoneId, 'PRC')
  assert.equal(JOB_DEFINITION.Status, '正常')
  assert.deepEqual(JOB_DEFINITION.JobParam, { Action: 'Refresh', LockScope: 'NuGetOfficialRefresh' })
})

for (const action of [undefined, 'Snapshot', 'Cache', 'Get']) {
  test(`${action || 'default'} returns only the persisted snapshot without HTTP or cache access`, ENGINE_TEST_OPTIONS, () => {
    onlyReadSnapshot(execute({ params: action ? { Action: action } : {} }))
  })
}

test('snapshot ignores a larger Redis value and never repairs Redis', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ cacheStats: { owner: 'ITdos', packageCount: 2, totalDownloads: 99000000 } }))
})

test('snapshot returns the newest persisted success by timestamp', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ rows: [dailyRow(), dailyRow(11500000, '2026-10-12T23:00:00.000Z')] }), 11500000)
})

test('snapshot without a successful record reports no data without external requests', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ rows: [] })
  assert.equal(execution.result.Code, 2)
  assert.deepEqual(execution.events.filter(event => !['db:list', 'log'].includes(event.kind)), [])
})

test('a corrupt persisted snapshot cannot be presented as successful data', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ rows: [dailyRow(0)] })
  assert.equal(execution.result.Code, 2)
  assert.deepEqual(execution.events.filter(event => !['db:list', 'log'].includes(event.kind)), [])
})

test('a persisted row with an invalid success timestamp is rejected as a corrupt snapshot', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ rows: [dailyRow(11000000, 'invalid-date')] })
  assert.equal(execution.result.Code, 2)
  assert.deepEqual(execution.events.filter(event => !['db:list', 'log'].includes(event.kind)), [])
})

test('snapshot database failure is reported as a failure without attempting upstream recovery', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ databaseReadFails: true })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.result.Data, null)
  assert.deepEqual(execution.events.filter(event => !['db:list', 'log'].includes(event.kind)), [])
})

test('anonymous legacy Refresh safely returns the snapshot', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ params: { Action: 'Refresh', LockScope: 'NuGetOfficialRefresh' } }))
})

test('authenticated ordinary users cannot refresh official upstream data', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ user: { Id: 'ordinary-user', Level: 1 }, params: { Action: 'Refresh', LockScope: 'NuGetOfficialRefresh' } }))
})

test('HTTP job and identity parameter spoofing remains a pure snapshot read', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ params: {
    ...JOB_PARAM, _InvokeType: 'Client', Action: 'Refresh',
    _CurrentUser: ADMIN, _TrustedServerInvocation: true, InvokeType: 'Server'
  } }))
})

test('an HTTP context prevents job impersonation even if parameters contain Server invocation', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ params: { ...JOB_PARAM, Action: 'Refresh' } }))
})

test('a headless call with the wrong job name cannot refresh', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ httpContext: null, params: { ...JOB_PARAM, JobName: 'anotherJob', JobId: 'anotherJob', Action: 'Refresh' } }))
})

test('a headless call without the scheduler run identity cannot refresh', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ httpContext: null, params: { ...JOB_PARAM, JobRunId: '', Action: 'Refresh' } }))
})

test('a headless call with a mismatched job Id cannot refresh', ENGINE_TEST_OPTIONS, () => {
  onlyReadSnapshot(execute({ httpContext: null, params: { ...JOB_PARAM, JobId: 'anotherJob', Action: 'Refresh' } }))
})

test('malformed JSON from an otherwise trusted scheduler fails without upstream or storage writes', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: { ...JOB_PARAM, JobParam: '{' } })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.events.filter(event => ['http:get', 'db:add', 'db:update', 'cache:set'].includes(event.kind)).length, 0)
})

test('a real scheduled job parses its JSON JobParam and persists before writing Redis', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.didRefresh, true)
  assert.equal(execution.result.Data.totalDownloads, 12100000)
  const write = execution.events.findIndex(event => event.kind === 'db:add')
  const cacheWrite = execution.events.findIndex(event => event.kind === 'cache:set')
  assert.ok(write >= 0 && cacheWrite > write)
  assert.equal(execution.databaseRows.at(-1).StatDate, '2026-10-13')
  assert.equal(execution.databaseRows.at(-1).SuccessfulEndpoints, 2)
})

test('an authenticated administrator may explicitly refresh', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ user: ADMIN, params: { Action: 'Refresh', LockScope: 'NuGetOfficialRefresh' } })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.didRefresh, true)
  assert.equal(execution.events.filter(event => event.kind === 'http:get').length, 2)
})

test('an administrator with the wrong refresh scope fails before external calls', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ user: ADMIN, params: { Action: 'Refresh', LockScope: 'NuGetCacheRead' } })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.events.filter(event => event.kind === 'http:get').length, 0)
})

test('duplicate scheduled delivery within five minutes reuses the confirmed success without querying upstream', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [dailyRow(12000000, '2026-10-13T02:59:00.000Z')] })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, 12000000)
  assert.equal(execution.result.Data.didRefresh, false)
  assert.equal(execution.events.filter(event => ['http:get', 'db:add', 'db:update', 'cache:set'].includes(event.kind)).length, 0)
})

test('both upstream failures return Code 0 and retain the last successful snapshot', ENGINE_TEST_OPTIONS, () => {
  const before = dailyRow()
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [before], endpoints: [{ status: 0 }, { status: 503 }] })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.result.Data.totalDownloads, before.TotalDownloads)
  assert.equal(execution.result.Data.didRefresh, false)
  assert.equal(execution.result.Data.refreshFailed, true)
  assert.deepEqual(execution.databaseRows, [before])
  assert.equal(execution.events.filter(event => ['cache:set', 'db:add', 'db:update'].includes(event.kind)).length, 0)
})

test('one healthy official node is sufficient and counts only that successful endpoint', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, endpoints: [{ error: 'network timeout' }, { totalDownloads: 12100000 }] })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, 12100000)
  assert.equal(execution.result.Data.successfulEndpoints, 1)
})

test('malformed upstream JSON is isolated to its endpoint', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, endpoints: [{ content: '{' }, { totalDownloads: 12100000 }] })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, 12100000)
  assert.equal(execution.result.Data.successfulEndpoints, 1)
})

test('a successful lower regional observation preserves the historical maximum with an honest new timestamp', ENGINE_TEST_OPTIONS, () => {
  const before = dailyRow(15000000)
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [before] })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, 15000000)
  assert.equal(execution.result.Data.didRefresh, true)
  assert.equal(execution.result.Data.source, 'nuget-official-api-high-water')
  assert.equal(execution.result.Data.queriedAt, FIXED_NOW)
  assert.equal(execution.databaseRows.at(-1).TotalDownloads, 15000000)
  assert.equal(execution.databaseRows.at(-1).QueriedAt, FIXED_NOW)
  assert.equal(execution.databaseRows.at(-1).SuccessfulEndpoints, 2)
})

test('a later successful refresh updates its existing UTC daily row rather than adding another', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [dailyRow(11000000, '2026-10-13T00:00:00.000Z')] })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.databaseRows.length, 1)
  assert.equal(execution.databaseRows[0].TotalDownloads, 12100000)
  assert.equal(execution.events.filter(event => event.kind === 'db:add').length, 0)
})

test('persistence rejection fails the job without exposing unpersisted data through Redis', ENGINE_TEST_OPTIONS, () => {
  const before = dailyRow()
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [before], databaseWriteFails: true })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.result.Data.refreshFailed, true)
  assert.deepEqual(execution.databaseRows, [before])
  assert.equal(execution.events.filter(event => event.kind === 'cache:set').length, 0)
})

test('Redis unavailability does not discard a successfully persisted snapshot', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, cacheWriteSucceeds: false })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.databaseRows.at(-1).TotalDownloads, 12100000)
  assert.equal(execution.result.Data.didRefresh, true)
})

test('Redis read exceptions do not block a scheduled refresh from persisting its database snapshot', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, cacheReadThrows: true })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.databaseRows.at(-1).TotalDownloads, 12100000)
  assert.equal(execution.result.Data.didRefresh, true)
})

test('Redis write exceptions do not turn an accepted database snapshot into a failed refresh', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, cacheWriteThrows: true })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.databaseRows.at(-1).TotalDownloads, 12100000)
  assert.equal(execution.result.Data.didRefresh, true)
})

test('an existing higher successful Redis value remains protected when the official indexes lag', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM,
    cacheStats: { owner: 'ITdos', packageCount: 2, totalDownloads: 16000000, queriedAt: '2026-10-12T22:00:00.000Z' }
  })
  assert.equal(execution.result.Code, 1)
  assert.equal(execution.result.Data.totalDownloads, 16000000)
  assert.equal(execution.databaseRows.at(-1).TotalDownloads, 16000000)
  assert.equal(execution.result.Data.queriedAt, FIXED_NOW)
})

test('an empty store with both endpoints down reports a failed refresh without fabricating a snapshot', ENGINE_TEST_OPTIONS, () => {
  const execution = execute({ httpContext: null, params: JOB_PARAM, rows: [], endpoints: [{ status: 0 }, { status: 0 }] })
  assert.equal(execution.result.Code, 0)
  assert.equal(execution.result.Data, null)
  assert.equal(execution.databaseRows.length, 0)
})
