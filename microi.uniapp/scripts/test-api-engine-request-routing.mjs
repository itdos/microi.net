import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMicroiV8,
  isApiEngineRequestUrl
} from '../src/utils/microi.v8.js'

function createRecorder() {
  const calls = []
  const client = createMicroiV8({
    apiBase: 'https://api.example.com',
    osClient: 'xjy',
    appendOsClientQuery: true,
    requestAdapter: async (options) => {
      calls.push(options)
      return {
        statusCode: 200,
        data: { Code: 1, Data: {} },
        header: {}
      }
    }
  })
  return { client, calls }
}

test('接口引擎稳定路径自动携带路由直达请求头', async () => {
  const { client, calls } = createRecorder()
  client.setToken('must-not-leak')

  await client.request({
    url: '/apiengine/wx-miniprogram-login-reg-bind',
    method: 'POST',
    data: {},
    auth: false,
    checkCode: false
  })

  assert.equal(calls[0].headers.apiengine, '1')
  assert.equal(calls[0].headers.osclient, 'xjy')
  assert.equal(calls[0].headers.Authorization, undefined)
  assert.equal(calls[0].headers.Token, undefined)
})

test('完整接口引擎 URL 大小写不敏感且普通控制器不误标记', async () => {
  assert.equal(isApiEngineRequestUrl('https://api.example.com/APIENGINE/test?x=1'), true)
  assert.equal(isApiEngineRequestUrl('/api/ApiEngine/Run'), false)

  const { client, calls } = createRecorder()
  await client.request({
    url: '/api/SysUser/login',
    method: 'POST',
    data: {},
    auth: false,
    checkCode: false
  })

  assert.equal(calls[0].headers.apiengine, undefined)
})

test('自定义接口地址仍可显式启用接口引擎直达路由', async () => {
  const { client, calls } = createRecorder()

  await client.request({
    url: '/wechat/notify',
    method: 'POST',
    data: {},
    auth: false,
    apiEngine: true,
    checkCode: false
  })

  assert.equal(calls[0].headers.apiengine, '1')
})

test('私有文件缺少权威资源上下文时不发送裸路径签名请求', async () => {
  const { client, calls } = createRecorder()

  assert.equal(await client.resolveFileUrl('/private/customer/photo.jpg'), '')
  assert.equal(calls.length, 0)

  await client.resolveFileUrl('/private/customer/photo.jpg', {
    formEngineKey: 'Diy_Customer',
    formDataId: 'row-1',
    fieldId: 'field-photo',
    sysMenuId: 'menu-customer'
  })

  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/apiengine\/platform-private-file-url/)
  assert.deepEqual(
    {
      FormEngineKey: calls[0].data.FormEngineKey,
      FormDataId: calls[0].data.FormDataId,
      FieldId: calls[0].data.FieldId,
      SysMenuId: calls[0].data.SysMenuId
    },
    {
      FormEngineKey: 'Diy_Customer',
      FormDataId: 'row-1',
      FieldId: 'field-photo',
      SysMenuId: 'menu-customer'
    }
  )
})

test('用户头像签名必须绑定 UserAvatar 与真实用户 Id', async () => {
  const { client, calls } = createRecorder()

  assert.equal(await client.resolveAvatarUrl('/private/avatar.png', { resourceKind: 'UserAvatar' }), '')
  assert.equal(calls.length, 0)

  await client.resolveAvatarUrl('/private/avatar.png', {
    resourceKind: 'UserAvatar',
    resourceId: 'user-1'
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].data.ResourceKind, 'UserAvatar')
  assert.equal(calls[0].data.ResourceId, 'user-1')
})
