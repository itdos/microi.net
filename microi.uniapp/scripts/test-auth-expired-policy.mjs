import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createLoginNavigationGuard, installLoginNavigationInterceptors, pageLocation } from '../src/platform/login-navigation.mjs'
import {
  isLoginRoute,
  isMissingTokenResponse,
  shouldPromptAuthExpired
} from '../src/platform/auth-expired-policy.mjs'

test('未登录请求不显示身份失效弹窗', () => {
  const body = { Code: 1001, Msg: '请求未携带Token，请重新登录。' }
  assert.equal(isMissingTokenResponse(body), true)
  assert.equal(shouldPromptAuthExpired(body, 'pages/business/list'), false)
})

test('登录页顶部时忽略底层页面迟到的失效响应', () => {
  assert.equal(isLoginRoute('/pages/login/index'), true)
  assert.equal(
    shouldPromptAuthExpired({ Code: 1001, Msg: '当前登录身份已过期' }, 'pages/login/index'),
    false
  )
})

test('已登录会话真正过期时仍保留明确提示', () => {
  assert.equal(
    shouldPromptAuthExpired({ Code: 1001, Msg: '登录会话已过期' }, 'pages/business/detail'),
    true
  )
})

function requestAuthHarness() {
  const pages = [{ route: 'pages/business/detail', options: { key: 'customers', id: 'customer-1' } }]
  const interceptors = {}
  const navigations = []
  const modals = []
  let token = ''
  let user = null
  let sdkConfig
  const sdk = {
    getToken: () => token, getUser: () => user,
    setToken: value => { token = value }, setUser: value => { user = value },
    clearToken: () => { token = ''; user = null }
  }
  const runtime = {
    addInterceptor: (method, hooks) => { interceptors[method] = hooks },
    $emit() {}, showModal: options => modals.push(options)
  }
  for (const method of ['navigateTo', 'redirectTo', 'reLaunch']) {
    runtime[method] = options => {
      if (interceptors[method]?.invoke(options) !== false) navigations.push({ method, options })
    }
  }
  const source = readFileSync(new URL('../src/utils/request.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+/gm, '')
  vm.runInNewContext(source, {
    appConfig: { apiBase: 'https://example.test', osClient: 'demo' },
    createMicroiV8: options => { sdkConfig = options; return sdk },
    createLoginNavigationGuard, installLoginNavigationInterceptors, pageLocation,
    shouldPromptAuthExpired, clearPlatformCache() {}, clearRetainedListSessions() {},
    clearAuthScopedStorageCaches() {}, uni: runtime, getCurrentPages: () => pages
  })
  return { pages, navigations, modals, expire: body => sdkConfig.onAuthExpired(body),
    establishSession: () => { token = 'new-session'; user = { Id: 'user-1' } } }
}

test('执行真实请求层：并发 MissingToken 响应共享导航锁，仅打开一个登录页', () => {
  const harness = requestAuthHarness()
  for (let index = 0; index < 12; index += 1) {
    harness.expire({ Code: 1001, Msg: '请求未携带Token，请重新登录。' })
  }
  assert.equal(harness.modals.length, 0)
  assert.equal(harness.navigations.length, 1)
})

test('执行真实请求层：并发真正失效只提示一次，并在确认后引导登录', () => {
  const harness = requestAuthHarness()
  harness.expire({ Code: 1001, Msg: '身份已过期 5 分钟' })
  harness.expire({ Code: 1001, Msg: '身份已过期 5 分钟' })
  assert.equal(harness.modals.length, 1)
  assert.equal(harness.modals[0].content, '身份已过期 5 分钟')
  assert.equal(harness.navigations.length, 0)
  harness.modals[0].complete()
  assert.equal(harness.navigations.length, 1)
})

test('执行真实请求层：失效提示弹窗的迟到完成回调不打断已建立的新登录', () => {
  const harness = requestAuthHarness()
  harness.expire({ Code: 1001, Msg: '旧身份已失效' })
  harness.establishSession()
  harness.modals[0].complete()
  assert.equal(harness.navigations.length, 0)
})

test('执行真实请求层：页面栈满时替换登录页，失败仍可清栈登录', () => {
  const harness = requestAuthHarness()
  harness.expire({ Code: 1001, Msg: '请求未携带Token' })
  harness.navigations[0].options.fail({ errMsg: 'page stack is full' })
  assert.equal(harness.navigations[1].method, 'redirectTo')
  harness.navigations[1].options.fail({ errMsg: 'redirect failed' })
  assert.equal(harness.navigations[2].method, 'reLaunch')
  assert.ok(harness.navigations.every(item => item.options.url.includes('redirect=')))
})
