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

test('uses the stable latest entry and removes runtime/cache query parameters', () => {
  const actual = withPreviewVersion(
    'https://static.itdos.com/itdos/ai-app-publish/microi-developer-toolbox/versions/v1.0.3/index.html?v=old&apiBase=https%3A%2F%2Fapi.itdos.com&OsClient=iTdos',
    { AppVersion: 'v1.0.3' },
    'https://microi.net',
    { apiBase: 'https://api.itdos.com', osClient: 'iTdos' }
  )

  assert.equal(
    actual,
    'https://static.itdos.com/itdos/ai-app-publish/microi-developer-toolbox/index.html'
  )
})

test('keeps unrelated query parameters while normalizing the latest entry', () => {
  assert.equal(
    withPreviewVersion('/itdos/ai-app-publish/demo/versions/2.4.1/index.html?mode=share', {}, 'https://static.itdos.com'),
    'https://static.itdos.com/itdos/ai-app-publish/demo/index.html?mode=share'
  )
})

test('Unity Taoyuan always launches from its public stable entry without a version segment', () => {
  const actual = withPreviewVersion(
    '/micro-app/v3/tenants/itdos/kinds/runtime/apps/microi-unity-taoyuan/releases/v1.4.9/assets/index.html?v=1.4.9',
    { AppKey: 'microi-unity-taoyuan', AppVersion: 'v1.4.9' },
    'https://microi.net'
  )

  assert.equal(actual, 'https://static.itdos.com/itdos/micro-app/microi-unity-taoyuan/index.html?stable-entry=current')
  assert.doesNotMatch(actual, /\/v\d+(?:\.\d+)+\//)
})

test('uses one stable legacy fallback after rejecting release and request artifacts', () => {
  const app = {
    AppKey: 'legacy-office',
    AppName: '旧版办公应用',
    AppType: 'Web',
    PreviewUrl: 'https://static.itdos.com/requests/build-42/index.html',
    ReleaseUrl: 'https://static.itdos.com/apps/legacy-office/releases/v4/assets/index.html',
    VersionPreviewUrl: 'https://static.itdos.com/apps/legacy-office/versions/v4/index.html',
    AppUrl: 'https://static.itdos.com/apps/legacy-office/index.html?v=4&OsClient=iTdos'
  }

  assert.equal(
    resolveApplicationExperienceUrl(app, desktopWindow),
    'https://static.itdos.com/apps/legacy-office/index.html'
  )
})

test('prefers the public current publish path over a stale preview fallback', () => {
  assert.equal(
    resolveApplicationExperienceUrl({
      AppKey: 'current-office',
      ApplicationType: 'Web',
      PublicPublishPath: 'itdos/ai-app-publish/current-office/index.html',
      PreviewUrl: 'https://legacy.example.test/current-office/index.html'
    }, desktopWindow, { fileServer: 'https://static.itdos.com' }),
    'https://static.itdos.com/itdos/ai-app-publish/current-office/index.html'
  )
})

test('supports case-insensitive JSON legacy fields and normalizes old versions roots', () => {
  assert.equal(
    resolveStableApplicationEntry({
      AppKey: 'legacy-json',
      appurl: JSON.stringify({ Url: 'https://static.itdos.com/itdos/ai-app-publish/legacy-json/versions/v2.3.1/index.html?mode=share' })
    }),
    'https://static.itdos.com/itdos/ai-app-publish/legacy-json/index.html?mode=share'
  )
})

test('never promotes explicit version or release fields into the public experience link', () => {
  assert.equal(resolveStableApplicationEntry({
    AppKey: 'immutable-only',
    VersionPreviewUrl: 'https://static.itdos.com/apps/immutable-only/versions/v1/index.html',
    VersionUrl: 'https://static.itdos.com/apps/immutable-only/v1/index.html',
    ReleaseUrl: 'https://static.itdos.com/apps/immutable-only/releases/v1/index.html'
  }), '')
})
