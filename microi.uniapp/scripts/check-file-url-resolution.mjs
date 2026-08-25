import assert from 'node:assert/strict'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

const durablePath = '/xjy/native/diy_follow/GenjinZP/photo.jpg'
const expiredUrl = 'https://files.example.test/photo.jpg?expires=1&signature=expired'
const requests = []

const V8 = createMicroiV8({
  apiBase: 'https://api.example.test',
  fileServer: 'https://files.example.test',
  osClient: 'xjy',
  requestAdapter: async (request) => {
    requests.push(request)
    return {
      statusCode: 200,
      data: {
        Code: 1,
        Data: {
          Url: 'https://files.example.test/photo.jpg?expires=9999999999&signature=fresh'
        }
      }
    }
  }
})

const uploadValue = {
  Path: durablePath,
  Url: expiredUrl,
  Name: 'photo.jpg',
  Limit: true
}

assert.equal(
  V8.extractUploadPath(uploadValue),
  durablePath,
  'upload values must prefer the durable Path over a temporary Url'
)

const privateFileContext = {
  resourceKind: 'FormField',
  formEngineKey: 'diy_follow',
  formDataId: 'follow-record-1',
  fieldId: 'follow-photo-field-1',
  sysMenuId: 'follow-menu-1'
}

assert.equal(
  await V8.resolveFileUrl(uploadValue),
  '',
  'private files without authoritative record context must fail closed'
)
assert.equal(requests.length, 0, 'a bare private path must not reach the signing engine')

const resolvedUrl = await V8.resolveFileUrl(uploadValue, privateFileContext)
assert.equal(
  resolvedUrl,
  'https://files.example.test/photo.jpg?expires=9999999999&signature=fresh',
  'private files must use the newly signed URL'
)
assert.equal(requests.length, 1, 'a private file with a durable Path should be re-signed')
assert.equal(
  requests[0].url,
  'https://api.example.test/apiengine/platform-private-file-url',
  'the signing request must use the managed private-file ApiEngine'
)
assert.equal(requests[0].method, 'POST', 'private-file context must not be exposed in the query string')
assert.equal(requests[0].headers.apiengine, '1', 'private-file signing must use direct ApiEngine routing')
assert.equal(requests[0].data.FilePathName, durablePath, 'the signing request must use the durable Path')
assert.equal(requests[0].data.FormEngineKey, privateFileContext.formEngineKey)
assert.equal(requests[0].data.FormDataId, privateFileContext.formDataId)
assert.equal(requests[0].data.FieldId, privateFileContext.fieldId)
assert.equal(requests[0].data.SysMenuId, privateFileContext.sysMenuId)
assert.equal(requests[0].data.ResourceKind, privateFileContext.resourceKind)

assert.equal(
  V8.extractUploadPath({ Url: expiredUrl }),
  expiredUrl,
  'legacy URL-only upload values must remain compatible'
)

console.log('File URL resolution checks passed.')
