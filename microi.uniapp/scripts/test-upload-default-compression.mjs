import assert from 'node:assert/strict'
import test from 'node:test'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

function installUploadRuntime(calls) {
  globalThis.uni = {
    uploadFile({ formData, success }) {
      calls.push({ ...formData })
      success({
        statusCode: 200,
        data: JSON.stringify({
          Code: 1,
          Data: { Path: '/tenant/img/result.jpg', Size: 123456 }
        })
      })
    },
    showToast() {}
  }
}

test('interactive image upload enables server compression when preview is omitted', async () => {
  const calls = []
  installUploadRuntime(calls)
  const client = createMicroiV8({ apiBase: 'https://api.example.test', osClient: 'tenant' })
  try {
    await client.uploadFile('wxfile://photo.jpg', { resolveUrl: false, contentSecurity: false })
    await client.uploadFile('wxfile://original.jpg', {
      preview: false,
      resolveUrl: false,
      contentSecurity: false
    })

    assert.equal(calls[0].Preview, 'true')
    assert.equal(calls[0].Path, 'img')
    assert.equal(calls[1].Preview, 'false')
    assert.equal(calls[1].Path, 'file')
  } finally {
    delete globalThis.uni
  }
})
