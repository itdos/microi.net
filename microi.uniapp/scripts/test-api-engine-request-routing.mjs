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

  await client.request({
    url: '/apiengine/wx-miniprogram-login-reg-bind',
    method: 'POST',
    data: {},
    auth: false,
    checkCode: false
  })

  assert.equal(calls[0].headers.apiengine, '1')
  assert.equal(calls[0].headers.osclient, 'xjy')
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
