import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PENDING_EXTERNAL_BINDING,
  buildTenantLaunchProjection,
  normalizeHttpRuntimeBase
} from '../src/tenant-launch-url.js'

test('tenant launch URL uses the current trusted WebBase and ApiBase', () => {
  const projection = buildTenantLaunchProjection({
    webBase: 'https://dev.chongstech.com/',
    apiBase: 'https://api-dev.chongstech.com/',
    osClient: 'hongdi-dev',
    domainName: 'hongdi-dev.microi.net'
  })

  assert.equal(
    projection.LaunchUrl,
    'https://dev.chongstech.com/?ApiBase=https%3A%2F%2Fapi-dev.chongstech.com&OsClient=hongdi-dev'
  )
  assert.equal(projection.Url, projection.LaunchUrl)
  assert.equal(projection.BareDomainUrl, 'https://hongdi-dev.microi.net')
  assert.equal(projection.BareDomainReady, false)
  assert.equal(projection.DomainBindingRequired, true)
  assert.equal(projection.DomainBindingStatus, PENDING_EXTERNAL_BINDING)
})

test('tenant launch URL fails closed for credentials, query, hash and unsafe tenant keys', () => {
  for (const value of [
    'https://user:pwd@example.test',
    'https://example.test?target=other',
    'https://example.test/#fragment',
    'javascript:alert(1)'
  ]) {
    assert.throws(() => normalizeHttpRuntimeBase(value))
  }
  assert.throws(() => buildTenantLaunchProjection({
    webBase: 'https://dev.chongstech.com',
    apiBase: 'https://api-dev.chongstech.com',
    osClient: 'bad tenant'
  }))
})

test('missing host context never falls back to an unverified bare tenant domain', () => {
  const projection = buildTenantLaunchProjection({
    webBase: '',
    apiBase: 'https://api-dev.chongstech.com',
    osClient: 'hongdi-dev'
  })

  assert.equal(projection.LaunchUrl, '')
  assert.equal(projection.Url, '')
  assert.equal(projection.LaunchUrlAvailable, false)
  assert.equal(projection.BareDomainReady, false)
  assert.equal(projection.DomainBindingStatus, PENDING_EXTERNAL_BINDING)
})
