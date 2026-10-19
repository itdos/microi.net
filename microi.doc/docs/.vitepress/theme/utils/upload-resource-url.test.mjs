import assert from 'node:assert/strict'
import test from 'node:test'

test('normalizes an old official FileServer before joining relative public paths', () => {
  assert.equal(resolveUploadedResourceUrl('/itdos/covers/a.png', { fileServer: 'https://static.itdos.com' }), 'https://file.microi.net/itdos/covers/a.png')
})

import { normalizeUploadPath, resolveUploadedResourceUrl } from './upload-resource-url.js'

const runtime = {
  apiBase: 'https://api.microi.net',
  baseUrl: 'https://microi.net',
  fileServer: 'https://file.microi.net'
}

test('normalizes absolute, relative, object and array upload values', () => {
  assert.equal(normalizeUploadPath('https://cdn.example.test/a.png'), 'https://cdn.example.test/a.png')
  assert.equal(normalizeUploadPath('/itdos/a.png'), '/itdos/a.png')
  assert.equal(normalizeUploadPath({ FileURL: '/itdos/b.png', Name: '单图' }), '/itdos/b.png')
  assert.equal(normalizeUploadPath([{ Name: '空' }, { FullPath: '/itdos/c.png' }]), '/itdos/c.png')
})

test('normalizes JSON-serialized upload objects and arrays', () => {
  assert.equal(normalizeUploadPath(JSON.stringify({ Path: '/itdos/object.png' })), '/itdos/object.png')
  assert.equal(normalizeUploadPath(JSON.stringify([{ Name: '空' }, { previewUrl: '/itdos/array.png' }])), '/itdos/array.png')
})

test('uses FileServer for HDFS assets and API base for dynamic application routes', () => {
  assert.equal(resolveUploadedResourceUrl({ Path: '/itdos/previews/a.png' }, runtime), 'https://file.microi.net/itdos/previews/a.png')
  assert.equal(resolveUploadedResourceUrl('/file/private-preview', runtime), 'https://api.microi.net/file/private-preview')
  assert.equal(
    resolveUploadedResourceUrl('/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/cover.png', runtime),
    'https://api.microi.net/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/cover.png'
  )
})

test('migrates only unsigned official public aliases and preserves signed or tenant URLs', () => {
  assert.equal(resolveUploadedResourceUrl('https://static.itdos.com/itdos/a.png', runtime), 'https://file.microi.net/itdos/a.png')
  assert.equal(resolveUploadedResourceUrl('//static.itdos.com/itdos/a.png', runtime), 'https://file.microi.net/itdos/a.png')
  for (const url of [
    'https://static.itdos.com/itdos/a.png?signature=private',
    'https://static.itdos.com:8443/itdos/a.png',
    'http://static.itdos.com/itdos/a.png',
    'https://static.itdos.com.evil.example/a.png',
    'https://tenant.example/a.png', 'data:image/png;base64,aA==', 'blob:https://tenant.example/123'
  ]) assert.equal(resolveUploadedResourceUrl(url, runtime), url)
})
