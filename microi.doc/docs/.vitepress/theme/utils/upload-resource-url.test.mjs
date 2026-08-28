import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeUploadPath, resolveUploadedResourceUrl } from './upload-resource-url.js'

const runtime = {
  apiBase: 'https://api.itdos.com',
  baseUrl: 'https://microi.net',
  fileServer: 'https://static.itdos.com'
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
  assert.equal(resolveUploadedResourceUrl({ Path: '/itdos/previews/a.png' }, runtime), 'https://static.itdos.com/itdos/previews/a.png')
  assert.equal(resolveUploadedResourceUrl('/file/private-preview', runtime), 'https://api.itdos.com/file/private-preview')
  assert.equal(
    resolveUploadedResourceUrl('/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/cover.png', runtime),
    'https://api.itdos.com/micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/cover.png'
  )
})
