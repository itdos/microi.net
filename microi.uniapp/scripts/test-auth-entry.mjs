import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRootLoginUrl,
  isRootLoginEntry
} from '../src/platform/auth-entry.mjs'

test('根登录地址固定清空页面栈语义并保留重定向目标', () => {
  assert.equal(buildRootLoginUrl(), '/pages/login/index?root=1')
  assert.equal(
    buildRootLoginUrl({ logout: true, endpoint: true, redirect: '/pages/ai/index?mode=data' }),
    '/pages/login/index?root=1&logout=1&endpoint=1&redirect=%2Fpages%2Fai%2Findex%3Fmode%3Ddata'
  )
})

test('自定义登录路由已有查询参数时使用 & 追加根入口参数', () => {
  assert.equal(
    buildRootLoginUrl({ base: '/pages/login/index?source=profile', endpoint: true }),
    '/pages/login/index?source=profile&root=1&endpoint=1'
  )
})

test('冷启动、主动退出和显式根入口都不可返回业务页面', () => {
  assert.equal(isRootLoginEntry({}, 1), true)
  assert.equal(isRootLoginEntry({ root: '1' }, 3), true)
  assert.equal(isRootLoginEntry({ logout: '1' }, 2), true)
  assert.equal(isRootLoginEntry({}, 2), false)
})
