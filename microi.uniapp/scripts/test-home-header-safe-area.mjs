import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRenderer, h, nextTick } from 'vue'

function safeAreaReader(info, getRect, platform = 'h5') {
  const source = readFileSync(new URL('../src/utils/safe-area.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace(/export default[\s\S]*$/, '').replace(/\bexport /g, '')
  return Function('uni', 'getMenuButtonRect', 'getPlatform', `${source}\nreturn getSafeAreaMetrics`)(
    { getWindowInfo: () => info }, getRect, () => platform)
}

test('胶囊占位按实际宽度和屏幕右侧间距计算，不使用错误的 left 扩大占位', () => {
  const read = safeAreaReader({ windowWidth: 390, statusBarHeight: 47 }, () => ({ left: 140, right: 382, width: 88, top: 51, height: 32 }))
  assert.equal(read().capsuleRight, 104)
})

test('无效胶囊坐标回退到同一窗口的有效测量，窗口变化后不复用旧位置', () => {
  const info = { windowWidth: 390, statusBarHeight: 47 }
  let rect = { left: 286, right: 382, width: 96, top: 51, height: 32 }
  const read = safeAreaReader(info, () => rect)
  assert.equal(read().capsuleRight, 112)
  rect = { left: 1, right: 0, width: 0, top: 0, height: 32 }
  assert.equal(read().capsuleRight, 112)
  info.windowWidth = 430
  assert.equal(read().capsuleRight, 104)
  rect = null
  assert.equal(read().capsuleRight, 0, '没有胶囊的平台不预留横向空间')
})

test('微信首次读取失败仍预留胶囊空间，异常右边缘不会产生负值或过大占位', () => {
  const info = { windowWidth: 390, statusBarHeight: 47 }
  let rect = null
  const read = safeAreaReader(info, () => rect, 'mp-weixin')
  assert.equal(read().capsuleRight, 104)
  rect = { left: -200, right: 600, width: 88, height: 32, top: 51 }
  assert.equal(read().capsuleRight, 104)
  rect = { left: 294, right: 382, width: 88, height: 32, top: 51 }
  assert.equal(read().capsuleRight, 104)
})

test('首页安全区刷新必须使真实 Vue 实例中的头部样式重新计算', async () => {
  const source = readFileSync(new URL('../src/utils/theme.js', import.meta.url), 'utf8')
  const mixinSource = source.slice(source.indexOf('export const themeMixin ='), source.indexOf('\nexport default {')).replace('export const themeMixin =', 'return')
  let metrics = { statusBarHeight: 32, capsuleRight: 220 }
  const mixin = Function('getSafeAreaMetrics', 'getSafeAreaTokenStyle', 'getMciTokenStyle', 'getMciModeTokenStyle', 'getLang', 'WATER_PRIMARY', 'FIXED_GRADIENT', mixinSource)(
    () => ({ ...metrics }), value => ({ '--mci-capsule-right': `${(value || metrics).capsuleRight}px` }), () => ({}), () => ({}), () => 'cn', '#087da8', '')
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
    insert() {}, remove() {}, patchProp() {}
  })
  const app = renderer.createApp({ mixins: [mixin], render() { return h('view', { style: this.mciTokenStyle }) } })
  const page = app.mount({})
  try {
    assert.equal(page.mciTokenStyle['--mci-capsule-right'], '220px')
    metrics = { statusBarHeight: 32, capsuleRight: 104 }
    assert.equal(typeof mixin.onReady, 'function')
    mixin.onReady.call(page)
    await nextTick()
    assert.equal(page.mciTokenStyle['--mci-capsule-right'], '104px', '首次测量修正后不能仍缓存被挤窄的头部尺寸')
    metrics = { statusBarHeight: 47, capsuleRight: 96 }
    page.refreshSafeArea()
    await nextTick()
    assert.equal(page.safeTopStyle.paddingTop, '47px')
  } finally { app.unmount() }
})
