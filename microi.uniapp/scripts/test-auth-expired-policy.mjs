import test from 'node:test'
import assert from 'node:assert/strict'
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
