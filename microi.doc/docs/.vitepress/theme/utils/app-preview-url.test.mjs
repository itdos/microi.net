import assert from 'node:assert/strict'
import test from 'node:test'

import { withPreviewVersion } from './app-preview-url.js'

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
