// zhy：覆盖版本归一化、数字段比较和正式版最低支持版本判断。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareVersions,
  isVersionUnsupported,
  normalizeVersion
} from '../src/platform/mini-program-version-core.mjs'

test('normalizeVersion extracts numeric version segments', () => {
  assert.equal(normalizeVersion('v2.10.3-beta'), '2.10.3')
  assert.equal(normalizeVersion(''), '')
})

test('compareVersions compares numeric segments instead of text', () => {
  assert.equal(compareVersions('2.10.0', '2.9.9'), 1)
  assert.equal(compareVersions('2.1', '2.1.0'), 0)
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1)
})

test('minimum version only blocks released mini programs', () => {
  assert.equal(isVersionUnsupported({ currentVersion: '2.0.0', minimumVersion: '2.1.0', envVersion: 'release' }), true)
  assert.equal(isVersionUnsupported({ currentVersion: '2.0.0', minimumVersion: '2.1.0', envVersion: 'trial' }), false)
  assert.equal(isVersionUnsupported({ currentVersion: '', minimumVersion: '2.1.0', envVersion: 'release' }), false)
})
