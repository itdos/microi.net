import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildFormFieldUploadData,
  createMicroiV8
} from '../src/utils/microi.v8.js'

function installUploadRuntime(calls) {
  globalThis.uni = {
    uploadFile({ formData, success }) {
      calls.push({ ...formData })
      success({
        statusCode: 200,
        data: JSON.stringify({
          Code: 1,
          Data: { Path: '/tenant/img/result.jpg', Limit: false }
        })
      })
    },
    showToast() {}
  }
}

test('field upload context normalizes aliases and serializes table-child authorization', () => {
  const result = buildFormFieldUploadData({
    formFieldContext: {
      formEngineKey: 'article',
      fieldId: 'cover-field',
      formDataId: 'row-1',
      menuId: 'menu-1',
      tableChildAuth: { ParentRowId: 'parent-1' }
    }
  })

  assert.deepEqual(result, {
    FormEngineKey: 'article',
    FieldId: 'cover-field',
    FormDataId: 'row-1',
    SysMenuId: 'menu-1',
    _TableChildAuth: JSON.stringify({ ParentRowId: 'parent-1' })
  })
})

test('uploadFile sends authoritative lookup clues while leaving bucket choice to the server', async () => {
  const calls = []
  installUploadRuntime(calls)
  const client = createMicroiV8({ apiBase: 'https://api.example.test', osClient: 'tenant' })
  try {
    await client.uploadFile('wxfile://photo.jpg', {
      limit: true,
      resolveUrl: false,
      contentSecurity: false,
      formFieldContext: {
        FormEngineKey: 'article',
        FieldId: 'cover-field',
        SysMenuId: 'menu-1'
      }
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].FormEngineKey, 'article')
    assert.equal(calls[0].FieldId, 'cover-field')
    assert.equal(calls[0].SysMenuId, 'menu-1')
    assert.equal(calls[0].Limit, 'true', 'client Limit remains a compatibility hint only')
  } finally {
    delete globalThis.uni
  }
})

test('dynamic form uploader forwards its existing file context into the upload SDK', async () => {
  const source = await readFile(
    new URL('../src/components/mci-media-uploader/mci-media-uploader.vue', import.meta.url),
    'utf8'
  )
  assert.match(source, /formFieldContext:\s*this\.fileContext/)
})
