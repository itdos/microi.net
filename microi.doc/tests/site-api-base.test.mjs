import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LOCAL_MICROI_API_BASE,
  OFFICIAL_MICROI_API_BASE,
  buildSiteApiEngineUrl,
  resolveSiteApiBaseForRuntime
} from '../docs/.vitepress/theme/utils/site-api-base.js'

test('local website uses the local iTdos API on port 61501', () => {
  assert.equal(resolveSiteApiBaseForRuntime('', {
    hostname: 'localhost',
    isProduction: false
  }), LOCAL_MICROI_API_BASE)
})

test('production website never keeps a localhost API base', () => {
  assert.equal(resolveSiteApiBaseForRuntime('https://localhost:61501', {
    hostname: 'microi.net',
    isProduction: true
  }), OFFICIAL_MICROI_API_BASE)
})

test('official website builds an OsClient path route for public engines', () => {
  assert.equal(
    buildSiteApiEngineUrl(OFFICIAL_MICROI_API_BASE, 'send-sms-reg', 'iTdos'),
    'https://api.itdos.com/apiengine/send-sms-reg--OsClient--iTdos--'
  )
})
