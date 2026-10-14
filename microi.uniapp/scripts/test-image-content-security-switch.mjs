import assert from 'node:assert/strict'
import test from 'node:test'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

function setup({ enabled = false, policyError = false, serverDisabled = false, legacyPolicy = false } = {}) {
  const calls = { login: 0, policy: 0, session: 0, uploads: [] }
  globalThis.wx = { login() {} }
  globalThis.uni = {
    login({ success }) { calls.login++; success({ code: 'wechat-login-code' }) },
    showToast() {},
    uploadFile({ url, formData, success }) {
      calls.uploads.push({ url, formData })
      const checking = enabled && !serverDisabled
      success({ data: JSON.stringify({ Code: 1, Data: {
        Path: '/tenant/img/photo.jpg', Limit: true,
        ...(checking
          ? { ContentSecurityReviewId: 'b'.repeat(32), ContentSecurityStatus: 'Passed' }
          : { ContentSecurityEnabled: false, ContentSecurityRequired: false })
      } }) })
    }
  }
  const client = createMicroiV8({
    apiBase: 'https://api.example.test', osClient: 'tenant',
    requestAdapter: async ({ data }) => {
      if (data.Action === 'Policy') {
        calls.policy++
        return { statusCode: 200, data: legacyPolicy
          ? { Code: 0, Msg: '不支持的微信内容安全动作。' }
          : policyError
          ? { Code: 0, Msg: '配置读取失败' }
          : { Code: 1, Data: { ImageContentSecurityEnabled: enabled } } }
      }
      if (data.Action === 'CreateUploadSession') {
        calls.session++
        return { statusCode: 200, data: { Code: 1, Data: { SessionId: 'a'.repeat(32) } } }
      }
      throw new Error('关闭审核时不应查询审核状态')
    }
  })
  return { client, calls, cleanup() { delete globalThis.uni; delete globalThis.wx } }
}

test('关闭开关的单图走普通上传，不登录微信、不送审、不轮询', async () => {
  const runtime = setup()
  try {
    const result = await runtime.client.uploadFile('wxfile://photo.jpg', { preview: true })
    assert.equal(result.Data.ContentSecurityEnabled, false)
    assert.equal(runtime.calls.policy, 1)
    assert.equal(runtime.calls.login, 0)
    assert.equal(runtime.calls.session, 0)
    assert.match(runtime.calls.uploads[0].url, /apiengine\/mci-wechat-content-status-batch/)
    assert.equal(runtime.calls.uploads[0].formData.Action, 'Upload')
    assert.equal(runtime.calls.uploads[0].formData.ContentSecurityLoginCode, undefined)
    assert.equal(runtime.calls.uploads[0].formData.ContentSecurityRequired, undefined)
  } finally { runtime.cleanup() }
})

test('关闭开关的批次只读一次策略并保留普通上传字段上下文', async () => {
  const runtime = setup()
  try {
    const results = await runtime.client.uploadFiles(['a.jpg', 'b.jpg'], {
      preview: true, formFieldContext: { FormEngineKey: 'Biz', FieldId: 'field', SysMenuId: 'menu' }
    })
    assert.ok(results.every(item => item.Code === 1 && !item.PendingReview))
    assert.equal(runtime.calls.policy, 1)
    assert.equal(runtime.calls.login, 0)
    assert.equal(runtime.calls.uploads.length, 2)
    assert.equal(runtime.calls.uploads[0].formData.FormEngineKey, 'Biz')
    assert.equal(runtime.calls.uploads[0].formData.FieldId, 'field')
  } finally { runtime.cleanup() }
})

test('开启开关继续登录、建立批次会话并要求审核结果', async () => {
  const runtime = setup({ enabled: true })
  try {
    const results = await runtime.client.uploadFiles(['a.jpg', 'b.jpg'], { preview: true })
    assert.ok(results.every(item => item.Code === 1))
    assert.equal(runtime.calls.policy, 1)
    assert.equal(runtime.calls.login, 1)
    assert.equal(runtime.calls.session, 1)
    assert.ok(runtime.calls.uploads.every(item => item.formData.ContentSecurityRequired === 'true'))
    assert.ok(runtime.calls.uploads.every(item => item.formData.ContentSecuritySessionId === 'a'.repeat(32)))
  } finally { runtime.cleanup() }
})

test('配置读取失败不能自动按关闭审核上传', async () => {
  const runtime = setup({ policyError: true })
  try {
    await assert.rejects(runtime.client.uploadFile('a.jpg', { preview: true }))
    assert.equal(runtime.calls.uploads.length, 0)
  } finally { runtime.cleanup() }
})

test('旧接口不支持 Policy 时保留原有强制图片审核', async () => {
  const runtime = setup({ enabled: true, legacyPolicy: true })
  try {
    const result = await runtime.client.uploadFile('a.jpg', { preview: true })
    assert.equal(result.Data.ContentSecurityStatus, 'Passed')
    assert.equal(runtime.calls.login, 1)
    assert.equal(runtime.calls.uploads[0].formData.ContentSecurityRequired, 'true')
  } finally { runtime.cleanup() }
})

test('上传过程中管理员关闭开关时接受服务端明确返回的普通上传结果', async () => {
  const runtime = setup({ enabled: true, serverDisabled: true })
  try {
    const results = await runtime.client.uploadFiles(['a.jpg'], { preview: true })
    assert.equal(results[0].Code, 1)
    assert.equal(results[0].Data.ContentSecurityRequired, false)
  } finally { runtime.cleanup() }
})

test('文件与视频保持普通上传，不读取图片审核策略', async () => {
  const runtime = setup({ enabled: true })
  try {
    await runtime.client.uploadFile('contract.pdf', { preview: false })
    await runtime.client.uploadFile('clip.mp4', { preview: false })
    assert.equal(runtime.calls.policy, 0)
    assert.equal(runtime.calls.login, 0)
    assert.ok(runtime.calls.uploads.every(item => /HDFS\/UniappUpload/.test(item.url)))
  } finally { runtime.cleanup() }
})
