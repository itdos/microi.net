import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveApplicationExperienceUrl,
  resolveStableApplicationEntry,
  withPreviewVersion
} from './app-preview-url.js'

const desktopWindow = {
  location: { origin: 'https://microi.net' },
  matchMedia: () => ({ matches: false })
}

test('migrates official launch URLs even when the public API still returns the legacy FileServer', () => {
  const runtime = { fileServer: 'https://static.itdos.com', osClient: 'iTdos', apiBase: 'https://api.microi.net' }
  for (const ApplicationType of ['MicroService', 'Web', 'UniApp']) {
    for (const PreviewUrl of ['/itdos/micro-app/campus/index.html', 'https://static.itdos.com/itdos/micro-app/campus/index.html']) {
      assert.equal(resolveStableApplicationEntry({ AppKey: 'campus', ApplicationType, PreviewUrl }, 'https://microi.net', runtime),
        'https://file.microi.net/itdos/micro-app/campus/index.html')
    }
  }
  assert.equal(resolveStableApplicationEntry({ AppKey: 'legacy', PreviewUrl: 'https://static.itdos.com/itdos/ai-app-publish/legacy/index.html?v=old' }, 'https://microi.net', runtime),
    'https://file.microi.net/itdos/ai-app-publish/legacy/index.html')
  assert.equal(resolveStableApplicationEntry({ AppKey: 'legacy', PreviewUrl: 'https://customer.example/legacy/index.html' }, 'https://microi.net', runtime),
    'https://customer.example/legacy/index.html')
  assert.equal(resolveStableApplicationEntry({ PreviewUrl: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/campus/assets/index.html' }, 'https://microi.net', runtime),
    'https://api.microi.net/micro-app/v3/tenants/itdos/kinds/runtime/apps/campus/assets/index.html')
})

test('uses the stable latest entry and removes runtime/cache query parameters', () => {
  const actual = withPreviewVersion(
    'https://file.microi.net/itdos/ai-app-publish/microi-developer-toolbox/versions/v1.0.3/index.html?v=old&apiBase=https%3A%2F%2Fapi.microi.net&OsClient=iTdos',
    { AppVersion: 'v1.0.3' },
    'https://microi.net',
    { apiBase: 'https://api.microi.net', osClient: 'iTdos' }
  )

  assert.equal(
    actual,
    'https://file.microi.net/itdos/ai-app-publish/microi-developer-toolbox/index.html'
  )
})

test('keeps the legacy toolbox entry until its CDN objects are migrated', () => {
  const actual = resolveApplicationExperienceUrl({
    AppKey: 'microi-developer-toolbox',
    ApplicationType: 'Web',
    PreviewUrl: 'https://file.microi.net/ai-app-publish/microi-developer-toolbox/'
  }, desktopWindow, {
    fileServer: 'https://file.microi.net',
    osClient: 'iTdos'
  })

  assert.equal(
    actual,
    'https://file.microi.net/itdos/ai-app-publish/microi-developer-toolbox/index.html'
  )
})

test('accepts all Microi upload field shapes when resolving an application preview', () => {
  const expected = 'https://file.microi.net/itdos/micro-app/four-shapes/index.html'
  const previewValues = [
    expected,
    '/itdos/ai-app-publish/four-shapes/index.html',
    { FileUrl: '/itdos/ai-app-publish/four-shapes/index.html', Name: '入口', Size: 1024 },
    [
      { FilePathName: '', Name: '空记录' },
      { PreviewUrl: '/itdos/ai-app-publish/four-shapes/index.html', Name: '首个有效入口' }
    ]
  ]

  for (const [index, PreviewUrl] of previewValues.entries()) {
    assert.equal(resolveApplicationExperienceUrl({
      AppKey: 'four-shapes',
      ApplicationType: 'Web',
      PreviewUrl
    }, desktopWindow, {
      fileServer: 'https://file.microi.net',
      osClient: 'iTdos'
    }), index === 0 ? expected : 'https://file.microi.net/itdos/ai-app-publish/four-shapes/index.html')
  }
})

test('accepts JSON-serialized upload objects and arrays without stringifying metadata', () => {
  assert.equal(resolveStableApplicationEntry({
    AppKey: 'json-shape',
    PreviewUrl: JSON.stringify([
      { Name: '没有路径的元数据' },
      { FullPath: '/itdos/ai-app-publish/json-shape/index.html', Size: 2048 }
    ])
  }, 'https://microi.net', {
    fileServer: 'https://file.microi.net',
    osClient: 'iTdos'
  }), 'https://file.microi.net/itdos/ai-app-publish/json-shape/index.html')
})

test('routes protocol v3 stable application paths through the API instead of HDFS FileServer', () => {
  assert.equal(resolveStableApplicationEntry({
    AppKey: 'ocean-fishing-unity',
    PublicPublishPath: [{
      Path: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/ocean-fishing-unity/assets/index.html',
      Name: '服务端稳定入口'
    }]
  }, 'https://microi.net', {
    apiBase: 'https://api.microi.net',
    fileServer: 'https://file.microi.net',
    osClient: 'iTdos'
  }), 'https://api.microi.net/micro-app/v3/tenants/itdos/kinds/runtime/apps/ocean-fishing-unity/assets/index.html')
})

test('uses the CDN entry only when the marketplace record points to it', () => {
  const runtime = {
    apiBase: 'https://api.microi.net',
    fileServer: 'https://file.microi.net',
    osClient: 'iTdos'
  }
  const expected = 'https://file.microi.net/itdos/micro-app/canonical-office/index.html'
  const records = [
    { StablePreviewUrl: 'https://file.microi.net/micro-app/v3/tenants/iTdos/kinds/Web/apps/canonical-office/assets/index.html?version=9' },
    { PublicPublishPath: '/micro-app/v3/tenants/ITDOS/kinds/UniApp/apps/canonical-office/assets/index.html' },
    { PreviewUrl: expected },
    { StablePreviewUrl: 'https://api.microi.net/micro-app/v3/tenants/itdos/kinds/runtime/apps/canonical-office/assets/index.html', PreviewUrl: expected }
  ]

  for (const [index, fields] of records.entries()) {
    assert.equal(resolveApplicationExperienceUrl({
      AppKey: 'canonical-office',
      ApplicationType: 'Web',
      ...fields
    }, desktopWindow, runtime), index >= 2 ? expected
      : 'https://api.microi.net/micro-app/v3/tenants/itdos/kinds/runtime/apps/canonical-office/assets/index.html')
  }
})

test('rejects a protocol v3 candidate whose route AppKey belongs to another application', () => {
  assert.equal(resolveStableApplicationEntry({
    AppKey: 'expected-app',
    StableUrl: '/micro-app/v3/tenants/itdos/kinds/runtime/apps/another-app/assets/index.html'
  }, 'https://microi.net', {
    apiBase: 'https://api.microi.net',
    osClient: 'iTdos'
  }), '')
})

test('keeps unrelated query parameters while normalizing the latest entry', () => {
  assert.equal(
    withPreviewVersion('/itdos/ai-app-publish/demo/versions/2.4.1/index.html?mode=share', {}, 'https://file.microi.net'),
    'https://file.microi.net/itdos/ai-app-publish/demo/index.html?mode=share'
  )
})

test('Unity Taoyuan always launches from its public stable entry without a version segment', () => {
  const actual = withPreviewVersion(
    '/micro-app/v3/tenants/itdos/kinds/runtime/apps/microi-unity-taoyuan/releases/v1.4.9/assets/index.html?v=1.4.9',
    { AppKey: 'microi-unity-taoyuan', ApplicationType: 'MicroService', AppVersion: 'v1.4.9' },
    'https://microi.net',
    { osClient: 'iTdos', fileServer: 'https://file.microi.net' }
  )

  assert.equal(actual, 'https://file.microi.net/itdos/micro-app/microi-unity-taoyuan/index.html?stable-entry=current')
  assert.doesNotMatch(actual, /\/v\d+(?:\.\d+)+\//)
})

test('uses one stable legacy fallback after rejecting release and request artifacts', () => {
  const app = {
    AppKey: 'legacy-office',
    AppName: '旧版办公应用',
    AppType: 'Web',
    PreviewUrl: 'https://file.microi.net/requests/build-42/index.html',
    ReleaseUrl: 'https://file.microi.net/apps/legacy-office/releases/v4/assets/index.html',
    VersionPreviewUrl: 'https://file.microi.net/apps/legacy-office/versions/v4/index.html',
    AppUrl: 'https://file.microi.net/apps/legacy-office/index.html?v=4&OsClient=iTdos'
  }

  assert.equal(
    resolveApplicationExperienceUrl(app, desktopWindow),
    'https://file.microi.net/apps/legacy-office/index.html'
  )
})

test('prefers the public current publish path over a stale preview fallback', () => {
  assert.equal(
    resolveApplicationExperienceUrl({
      AppKey: 'current-office',
      ApplicationType: 'Web',
      PublicPublishPath: 'itdos/ai-app-publish/current-office/index.html',
      PreviewUrl: 'https://legacy.example.test/current-office/index.html'
    }, desktopWindow, { fileServer: 'https://file.microi.net' }),
    'https://file.microi.net/itdos/ai-app-publish/current-office/index.html'
  )
})

test('supports case-insensitive JSON legacy fields and normalizes old versions roots', () => {
  assert.equal(
    resolveStableApplicationEntry({
      AppKey: 'legacy-json',
      appurl: JSON.stringify({ Url: 'https://file.microi.net/itdos/ai-app-publish/legacy-json/versions/v2.3.1/index.html?mode=share' })
    }),
    'https://file.microi.net/itdos/ai-app-publish/legacy-json/index.html?mode=share'
  )
})

test('never promotes explicit version or release fields into the public experience link', () => {
  assert.equal(resolveStableApplicationEntry({
    AppKey: 'immutable-only',
    VersionPreviewUrl: 'https://file.microi.net/apps/immutable-only/versions/v1/index.html',
    VersionUrl: 'https://file.microi.net/apps/immutable-only/v1/index.html',
    ReleaseUrl: 'https://file.microi.net/apps/immutable-only/releases/v1/index.html'
  }), '')
})
