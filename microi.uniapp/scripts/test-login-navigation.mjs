import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePageLocation, shouldResumePreviousPage } from '../src/platform/login-navigation.mjs'

test('解析登录重定向页面及查询参数', () => {
  assert.deepEqual(parsePageLocation('/pages/business/detail?key=customers&id=a%2Fb'), {
    route: 'pages/business/detail',
    options: { key: 'customers', id: 'a/b' }
  })
})

test('登录前页面仍在栈中时恢复原页面实例', () => {
  const previous = {
    route: 'pages/business/detail',
    options: { key: 'customers', id: 'customer-1' }
  }
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/detail?key=customers&id=customer-1'),
    true
  )
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/detail?key=customers&id=customer-2'),
    false
  )
  assert.equal(
    shouldResumePreviousPage(previous, '/pages/business/list?key=customers'),
    false
  )
})
