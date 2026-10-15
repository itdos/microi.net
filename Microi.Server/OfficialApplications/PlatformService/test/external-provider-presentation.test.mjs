import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { externalProviderGlyph } from '../src/external-provider-presentation.js'

test('官方 Microi 账号有独立标记且兼容已有供应商', () => {
  assert.equal(externalProviderGlyph('Microi'), 'M')
  assert.equal(externalProviderGlyph('microi'), 'M')
  assert.equal(externalProviderGlyph('WeChat'), '微')
  assert.equal(externalProviderGlyph('GitHub'), 'GH')
  assert.equal(externalProviderGlyph('Gitee'), 'G')
  assert.equal(externalProviderGlyph('FutureProvider'), '◇')
  assert.equal(externalProviderGlyph(null), '◇')
})

test('个人中心通过现有外部账号契约绑定和解除 Microi 账号', () => {
  const source = readFileSync(new URL('../src/PersonalSettings.vue', import.meta.url), 'utf8')
  assert.match(source, /externalProviderGlyph\(provider\.Key\)/)
  assert.match(source, /Microi、Gitee、微信等绑定/)
  assert.match(source, /Microi 官方账号/)
  assert.match(source, /bindExternalIdentity\(client, context\.osClient, provider\.Key\)/)
  assert.match(source, /revokeExternalBinding\(client, binding\.Id\)/)
})
