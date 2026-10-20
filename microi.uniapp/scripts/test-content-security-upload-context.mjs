import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import workspacePaths from './lib/workspace-paths.js'
import { buildFormFieldUploadData } from '../src/utils/microi.v8.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const engine = readFileSync(workspacePaths.findSyncedXjyEngine(projectRoot, 'mci-wechat-content-status-batch'), 'utf8')
const sessionId = 'a'.repeat(32)
const authorization = {
  ParentFieldId: 'task-devices-field', ParentTableId: 'tasks-table', ParentSysMenuId: 'tasks-menu',
  ParentRowId: 'task-1', ParentValue: 'task-1', ParentFormMode: 'View',
  Parent: { ParentFieldId: 'customer-tasks-field', ParentRowId: 'customer-1' }
}

function runUpload(value, { enabled = true, alias = false, userId = 'user-1' } = {}) {
  const calls = []
  const V8 = {
    Param: {
      Action: 'Upload', ContentSecuritySessionId: sessionId,
      FormEngineKey: 'task_devices', FieldId: 'result-photos', FormDataId: 'device-1', SysMenuId: 'devices-menu',
      [alias ? 'TableChildAuth' : '_TableChildAuth']: value
    },
    OsClient: 'tenant', CurrentUser: { Id: userId },
    SysConfig: { EnableMiniProgramImageCheck: enabled },
    FilesByteBase64: { 'photo.png': 'fixture' },
    Cache: { Get: () => JSON.stringify({ OsClient: 'tenant', UserId: 'user-1', OpenId: 'openid-1' }) },
    Method: {
      Upload(params) {
        // 模拟 .NET 上传参数绑定：multipart 字符串必须先还原为授权对象，不能丢弃授权链。
        assert.ok(params._TableChildAuth === null ||
          (typeof params._TableChildAuth === 'object' && !Array.isArray(params._TableChildAuth)),
        'TableChildAuth must bind to an object or null')
        calls.push(JSON.parse(JSON.stringify(params)))
        // 在存储边界终止，保证此回归不会上传文件、调用微信或修改业务记录。
        return { Code: 0, Msg: 'storage-boundary-reached' }
      }
    }
  }
  const result = vm.runInNewContext(`(function () { ${engine}\n})()`, { V8 })
  return { result, calls }
}

for (const enabled of [true, false]) {
  for (const serialized of [true, false]) {
    test(`upload preserves the complete child authorization (review=${enabled}, multipart=${serialized})`, () => {
      const context = buildFormFieldUploadData({ formFieldContext: { tableChildAuth: authorization } })
      const { result, calls } = runUpload(serialized ? context._TableChildAuth : authorization, { enabled })
      assert.equal(result.Msg, 'storage-boundary-reached')
      assert.equal(calls.length, 1)
      assert.deepEqual(calls[0]._TableChildAuth, authorization)
      assert.equal(calls[0].FormEngineKey, 'task_devices')
      assert.equal(calls[0].FieldId, 'result-photos')
      assert.equal(calls[0].FormDataId, 'device-1')
      assert.equal(calls[0].SysMenuId, 'devices-menu')
      if (enabled) assert.equal(calls[0].Limit, true)
    })
  }

  for (const value of [undefined, null, '', '  ']) {
    test(`upload supports absent child authorization (review=${enabled}, value=${String(value)})`, () => {
      const { result, calls } = runUpload(value, { enabled })
      assert.equal(result.Msg, 'storage-boundary-reached')
      assert.equal(calls[0]._TableChildAuth, null)
    })
  }

  for (const value of ['{bad', 'null', '[]', 'true', '"text"', 1, true, []]) {
    test(`invalid authorization fails before storage (review=${enabled}, value=${JSON.stringify(value)})`, () => {
      const { result, calls } = runUpload(value, { enabled })
      assert.equal(result.Code, 0)
      assert.notEqual(result.Msg, 'storage-boundary-reached')
      assert.equal(calls.length, 0)
      assert.doesNotMatch(result.Msg, /ParentRowId|task-1|customer-1/)
    })
  }
}

test('legacy authorization alias is normalized without losing the parent chain', () => {
  const { calls } = runUpload(JSON.stringify(authorization), { alias: true })
  assert.deepEqual(calls[0]._TableChildAuth, authorization)
})

test('reviewed upload still rejects another user session before storage', () => {
  const { result, calls } = runUpload(JSON.stringify(authorization), { userId: 'other-user' })
  assert.equal(result.Code, 0)
  assert.equal(calls.length, 0)
})
