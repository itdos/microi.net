import assert from 'node:assert/strict'
import { createMicroiV8 as createProjectSdk } from '../src/utils/microi.v8.js'
import { createMicroiV8 as createStandardSdk } from '../../microi.skills/microi.v8.js'

async function verifySdk(name, createMicroiV8) {
  const requests = []
  const V8 = createMicroiV8({
    apiBase: 'https://api.example.test',
    osClient: 'xjy',
    appendOsClientQuery: true,
    requestAdapter: async (request) => {
      requests.push(request)
      if (/\/api\/FormEngine\/getFormData(?:\?|$)/.test(request.url)) {
        return {
          statusCode: 200,
          data: { Code: 1, Data: { Id: request.data.Id, ServerPreservedField: 'preserved' } }
        }
      }
      return { statusCode: 200, data: { Code: 1, Data: { Id: request.data.Id || 'new-id' } } }
    }
  })

  await V8.FormEngine.AddFormData('Diy_Dingdan', {
    DingdanMC: 'new-order',
    _SysMenuId: 'menu-order',
    _InvokeType: 'Client'
  })

  const tableChildAuth = { ParentRowId: 'parent-1', FieldId: 'field-1' }
  await V8.FormEngine.UptFormData('Diy_Dingdan', {
    Id: 'order-1',
    DingdanMC: 'updated-order',
    _SysMenuId: 'menu-order',
    _TableChildAuth: tableChildAuth,
    _InvokeType: 'Client'
  }, {
    headers: { 'x-contract-check': name }
  })

  await V8.FormEngine.UptFormData({
    FormEngineKey: 'Diy_Dingdan',
    Id: 'legacy-order-1',
    _RowModel: { DingdanMC: 'legacy-order' }
  })

  assert.equal(requests.length, 4, `${name}: expected add, hydrate, update and legacy update requests`)

  const add = requests[0]
  assert.match(add.url, /\/api\/FormEngine\/addFormData(?:\?|$)/)
  assert.equal(add.data.FormEngineKey, 'Diy_Dingdan')
  assert.equal(add.data._RowModel.DingdanMC, 'new-order')
  assert.equal(add.data._RowModel._SysMenuId, 'menu-order')
  assert.equal(add.data._RowModel._InvokeType, 'Client')

  const hydrate = requests[1]
  assert.match(hydrate.url, /\/api\/FormEngine\/getFormData(?:\?|$)/)
  assert.equal(hydrate.data.FormEngineKey, 'Diy_Dingdan')
  assert.equal(hydrate.data.Id, 'order-1')
  assert.equal(hydrate.data._SysMenuId, 'menu-order')
  assert.deepEqual(hydrate.data._TableChildAuth, tableChildAuth)

  const update = requests[2]
  assert.match(update.url, /\/api\/FormEngine\/uptFormData(?:\?|$)/)
  assert.equal(update.data.FormEngineKey, 'Diy_Dingdan')
  assert.equal(update.data.Id, 'order-1')
  assert.equal(update.data._SysMenuId, 'menu-order')
  assert.deepEqual(update.data._TableChildAuth, tableChildAuth)
  assert.equal(update.data._InvokeType, 'Client')
  assert.equal(update.data._FormData.Id, 'order-1')
  assert.equal(update.data._FormData.DingdanMC, 'updated-order')
  assert.equal(update.data._FormData.ServerPreservedField, 'preserved')
  assert.equal(Object.hasOwn(update.data._FormData, '_SysMenuId'), false)
  assert.equal(Object.hasOwn(update.data._FormData, '_TableChildAuth'), false)
  assert.equal(update.headers['x-contract-check'], name, `${name}: request options must be preserved`)

  const legacyUpdate = requests[3]
  assert.match(legacyUpdate.url, /\/api\/FormEngine\/uptFormData(?:\?|$)/)
  assert.equal(legacyUpdate.data.Id, 'legacy-order-1')
  assert.deepEqual(legacyUpdate.data._RowModel, { DingdanMC: 'legacy-order' })
}

await verifySdk('project-sdk', createProjectSdk)
await verifySdk('standard-sdk', createStandardSdk)

console.log('FormEngine write contract checks passed.')
