import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APP_RUNTIME_ENDPOINT_PROTOCOLS,
  buildAppRuntimeEndpoint,
  normalizeStoredAppRuntimeEndpoint,
  runtimeEndpointScope,
  splitRuntimeApiBase
} from '../src/platform/runtime-endpoint.mjs'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

test('App 运行端点由协议下拉和无协议地址组成', () => {
  assert.deepEqual(APP_RUNTIME_ENDPOINT_PROTOCOLS, ['https://', 'http://'])
  assert.deepEqual(buildAppRuntimeEndpoint({
    protocol: 'https://',
    apiHost: 'API.Example.com/gateway/',
    osClient: ' Demo-Tenant '
  }), {
    version: 1,
    protocol: 'https://',
    apiHost: 'api.example.com/gateway',
    apiBase: 'https://api.example.com/gateway',
    osClient: 'Demo-Tenant'
  })
})

test('App 运行端点支持手动选择 http 和带端口的内网地址', () => {
  assert.deepEqual(buildAppRuntimeEndpoint({
    protocol: 'http',
    apiHost: '192.168.1.20:5000',
    osClient: 'factory_1'
  }), {
    version: 1,
    protocol: 'http://',
    apiHost: '192.168.1.20:5000',
    apiBase: 'http://192.168.1.20:5000',
    osClient: 'factory_1'
  })
})

test('API 地址输入框拒绝重复输入协议、凭据、query 和非法租户', () => {
  assert.throws(
    () => buildAppRuntimeEndpoint({ protocol: 'https://', apiHost: 'http://api.example.com', osClient: 'demo' }),
    /协议请使用左侧下拉框/
  )
  assert.throws(
    () => buildAppRuntimeEndpoint({ protocol: 'https://', apiHost: 'user:pwd@example.com', osClient: 'demo' }),
    /用户名或密码/
  )
  assert.throws(
    () => buildAppRuntimeEndpoint({ protocol: 'https://', apiHost: 'api.example.com?a=1', osClient: 'demo' }),
    /query 或 hash/
  )
  assert.throws(
    () => buildAppRuntimeEndpoint({ protocol: 'https://', apiHost: 'api.example.com', osClient: 'bad tenant' }),
    /OsClient 含有非法字符/
  )
})

test('运行端点可拆回协议和无协议地址', () => {
  assert.deepEqual(splitRuntimeApiBase('http://localhost:5000/root/'), {
    protocol: 'http://',
    apiHost: 'localhost:5000/root',
    apiBase: 'http://localhost:5000/root'
  })
})

test('运行端点解析不依赖浏览器 URL 全局对象', () => {
  const originalUrl = globalThis.URL
  try {
    globalThis.URL = undefined
    assert.deepEqual(buildAppRuntimeEndpoint({
      protocol: 'https://',
      apiHost: 'API.Example.com:443/root/',
      osClient: 'demo'
    }), {
      version: 1,
      protocol: 'https://',
      apiHost: 'api.example.com/root',
      apiBase: 'https://api.example.com/root',
      osClient: 'demo'
    })
  } finally {
    globalThis.URL = originalUrl
  }
})

test('损坏的本地配置安全回退到构建 Profile', () => {
  const fallback = { apiBase: 'https://api.itdos.com', osClient: 'iTdos' }
  assert.deepEqual(normalizeStoredAppRuntimeEndpoint('{bad json', fallback), {
    version: 1,
    protocol: 'https://',
    apiHost: 'api.itdos.com',
    apiBase: 'https://api.itdos.com',
    osClient: 'iTdos',
    source: 'profile'
  })
  assert.equal(
    normalizeStoredAppRuntimeEndpoint({ apiBase: 'http://10.0.0.8:8080', osClient: 'tenant-a' }, fallback).source,
    'storage'
  )
})

test('登录凭据隔离范围同时包含 ApiBase 和 OsClient', () => {
  assert.notEqual(
    runtimeEndpointScope('https://api-a.example.com', 'demo'),
    runtimeEndpointScope('https://api-b.example.com', 'demo')
  )
  assert.notEqual(
    runtimeEndpointScope('https://api-a.example.com', 'demo'),
    runtimeEndpointScope('https://api-a.example.com', 'other')
  )
})

test('切换平台后拒绝旧平台迟到响应且新请求使用新地址和租户', async () => {
  const calls = []
  let resolveOldRequest
  const client = createMicroiV8({
    apiBase: 'https://old.example.com',
    osClient: 'old-tenant',
    requestAdapter: (request) => {
      calls.push(request)
      if (calls.length === 1) {
        return new Promise((resolve) => { resolveOldRequest = resolve })
      }
      return Promise.resolve({
        statusCode: 200,
        data: { Code: 1, Data: {} },
        header: { Token: 'new-platform-token' }
      })
    }
  })

  const oldRequest = client.post('/api/SysUser/Login', {}, { auth: false, checkCode: false })
  for (let index = 0; index < 5 && !resolveOldRequest; index += 1) await Promise.resolve()
  assert.equal(typeof resolveOldRequest, 'function')

  client.configure({ apiBase: 'https://new.example.com', osClient: 'new-tenant' })
  resolveOldRequest({
    statusCode: 200,
    data: { Code: 1, Data: {} },
    header: { Token: 'old-platform-token' }
  })
  await assert.rejects(oldRequest, (error) => error && error.Code === 'RUNTIME_ENDPOINT_CHANGED')
  assert.equal(client.getToken(), '')

  await client.post('/api/SysUser/Login', {}, { auth: false, checkCode: false })
  assert.match(calls[1].url, /^https:\/\/new\.example\.com\/api\/SysUser\/Login/)
  assert.equal(calls[1].headers.osclient, 'new-tenant')
  assert.equal(client.getToken(), 'new-platform-token')
})
