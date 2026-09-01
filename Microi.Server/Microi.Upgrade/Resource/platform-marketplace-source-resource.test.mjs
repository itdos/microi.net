import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const resourceDir = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(
  path.join(resourceDir, 'platform-marketplace-source.js'),
  'utf8',
).replaceAll('\r\n', '\n')
const execute = new Function('V8', source)

test('resource and package declare the v1.0.5 authenticated same-origin failover contract', () => {
  const packageModel = JSON.parse(fs.readFileSync(
    path.join(resourceDir, 'app.microi.store.json'),
    'utf8',
  ))
  const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'platform-marketplace-source')
  assert.match(source, /Version: v1\.0\.5/)
  assert.match(source, /MARKETPLACE_LIST_ROUTE_FAILOVER_V2/)
  assert.match(source, /MARKETPLACE_NESTED_JSON_PAYLOAD_V2/)
  assert.match(source, /MARKETPLACE_SOURCE_HEADER_ISOLATION_V1/)
  assert.equal(engine.Version, 'v1.0.5')
  assert.equal(Number(engine.StopHttp), 0)
  assert.equal(Number(engine.AllowAnonymous), 0)
  assert.equal(engine.ApiV8Code.replaceAll('\r\n', '\n'), source)
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    'ApiEngine:platform-marketplace-source@v1.0.5',
  ))
})

function officialParam(action = 'Query') {
  return {
    Action: action,
    SourceId: 'official',
    ApiBase: 'https://api.itdos.com',
    OsClient: 'iTdos',
    Operation: 'List',
    Param: {
      _PageIndex: 1,
      _PageSize: 15,
      InstalledVersions: [{ AppId: 'app.microi.store', Version: 'v7.7.21' }],
    },
  }
}

test('official public list falls back only for an explicitly unavailable formal route', () => {
  const requests = []
  const result = execute({
    Param: officialParam(),
    Method: {
      RunPlatformApiRuntime() {
        return { Code: 0, Msg: 'NoExistData[ApiAddress]:/apiengine/get-microi-store-list' }
      },
    },
    Http: {
      Post(request) {
        requests.push(request)
        return JSON.stringify({ Code: 1, Data: [{ Id: 'store-1' }], DataCount: 1284 })
      },
    },
  })

  assert.equal(result.Code, 1)
  assert.equal(result.DataCount, 1284)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].Url, 'https://api.itdos.com/apiengine/get-microi-store?OsClient=iTdos')
  assert.equal(requests[0].PostParamString, undefined)
  assert.deepEqual(requests[0].PostParam, {
    _PageIndex: 1,
    _PageSize: 15,
    InstalledVersions: [{ AppId: 'app.microi.store', Version: 'v7.7.21' }],
  })
  assert.deepEqual(requests[0].Headers, {})
  assert.equal(result.DataAppend.MarketplaceListRouteFallback, true)
  assert.equal(result.DataAppend.SourceAuthenticated, false)
})

test('business and network failures are not hidden by the compatibility route', () => {
  for (const formalResult of [
    { Code: 0, Msg: '商城访问权限不足。' },
    { Code: 0, Msg: '商城源连接超时。' },
  ]) {
    let fallbackCalls = 0
    const result = execute({
      Param: officialParam(),
      Method: { RunPlatformApiRuntime() { return formalResult } },
      Http: { Post() { fallbackCalls++; return { Code: 1 } } },
    })
    assert.equal(result, formalResult)
    assert.equal(fallbackCalls, 0)
  }
})

test('non-official sources remain entirely inside the trusted runtime', () => {
  const runtimeResult = { Code: 0, Msg: 'upstream failure' }
  let fallbackCalls = 0
  const result = execute({
    Param: { ...officialParam(), SourceId: 'partner-a', ApiBase: 'https://partner.example.test' },
    Method: { RunPlatformApiRuntime() { return runtimeResult } },
    Http: { Post() { fallbackCalls++; return { Code: 1 } } },
  })
  assert.equal(result, runtimeResult)
  assert.equal(fallbackCalls, 0)
})

test('official discovery reports the real legacy-list count instead of silently returning zero', () => {
  const runtimeCalls = []
  const result = execute({
    Param: officialParam('Discover'),
    Method: {
      RunPlatformApiRuntime(request) {
        runtimeCalls.push(request)
        if (request.Action === 'Discover') {
          return {
            Code: 1,
            Msg: '商城源识别成功。',
            Data: {
              SourceId: 'official',
              ApiBase: 'https://api.itdos.com',
              OsClient: 'iTdos',
              SystemTitle: 'Microi吾码',
              SystemShortTitle: '吾码',
              PublicApplicationCount: 0,
              AccessibleApplicationCount: 0,
            },
          }
        }
        return { Code: 0, Msg: 'NoExistData[ApiAddress]:/apiengine/get-microi-store-list' }
      },
    },
    Http: { Post() { return { Code: 1, Data: [], DataCount: 1284 } } },
  })

  assert.deepEqual(runtimeCalls.map(item => item.Action), ['Discover', 'Query'])
  assert.equal(result.Code, 1)
  assert.equal(result.Data.PublicApplicationCount, 1284)
  assert.equal(result.Data.AccessibleApplicationCount, 1284)
  assert.equal(result.Data.MarketplaceListRouteFallback, true)
})

test('official discovery surfaces a failed compatibility query instead of fabricating zero applications', () => {
  const result = execute({
    Param: officialParam('Discover'),
    Method: {
      RunPlatformApiRuntime(request) {
        return request.Action === 'Discover'
          ? { Code: 1, Data: { SourceId: 'official' } }
          : { Code: 0, Msg: 'NoExistData[ApiAddress]:/apiengine/get-microi-store-list' }
      },
    },
    Http: { Post() { return { Code: 0, Msg: 'official legacy gateway unavailable' } } },
  })
  assert.equal(result.Code, 0)
  assert.match(result.Msg, /legacy gateway unavailable/)
})
