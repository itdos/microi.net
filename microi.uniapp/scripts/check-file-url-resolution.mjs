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

const resolvedUrl = await V8.resolveFileUrl(uploadValue)
assert.equal(
  resolvedUrl,
  'https://files.example.test/photo.jpg?expires=9999999999&signature=fresh',
  'private files must use the newly signed URL'
)
assert.equal(requests.length, 1, 'a private file with a durable Path should be re-signed')
assert.match(
  requests[0].url,
  new RegExp(`/api/HDFS/GetPrivateFileUrl\\?FilePathName=${encodeURIComponent(durablePath)}`),
  'the signing request must use the durable Path'
)

assert.equal(
  V8.extractUploadPath({ Url: expiredUrl }),
  expiredUrl,
  'legacy URL-only upload values must remain compatible'
)

console.log('File URL resolution checks passed.')
