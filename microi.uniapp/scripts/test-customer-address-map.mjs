import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

// 执行真实租户展示钩子，避免只检查经纬度字段却漏掉地图挂载状态。
const source = readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
  .replace(/export default\s+/, 'const exported = ')
  .replace(/export\s+(?=(?:async\s+)?function\s)/g, '')
const hooks = vm.runInNewContext(`${source}; exported`)

function addressContext(mode = 'View', form = {}) {
  return { tableName: 'diy_kehudz', mode, form, state: hooks.createState() }
}

test('客户地址详情读取已保存的字符串坐标后即可挂载地图', () => {
  const context = addressContext('View', {
    KehuDT_Lat: '29.829768', KehuDT_Lng: '121.603842', XiangxiDZ: '断桥残雪'
  })
  const before = JSON.stringify(context.form)
  const { location } = hooks.getPresentation(context)
  assert.equal(location.mapReady, true)
  assert.equal(location.latitude, 29.829768)
  assert.equal(location.longitude, 121.603842)
  assert.equal(location.address, '断桥残雪')
  assert.equal(location.actionKey, '')
  assert.equal(JSON.stringify(context.form), before)
})

test('客户地址新增和编辑在坐标回填后自动显示地图，再次选点使用新坐标', () => {
  for (const mode of ['Add', 'Edit']) {
    const context = addressContext(mode)
    assert.equal(hooks.getPresentation(context).location.mapReady, false)
    Object.assign(context.form, { KehuDT_Lat: 29.829768, KehuDT_Lng: 121.603842 })
    assert.equal(hooks.getPresentation(context).location.mapReady, true)
    Object.assign(context.form, { KehuDT_Lat: 30.221378, KehuDT_Lng: 120.12143 })
    const { location } = hooks.getPresentation(context)
    assert.equal(location.mapReady, true)
    assert.equal(location.latitude, 30.221378)
    assert.equal(location.longitude, 120.12143)
    assert.equal(location.actionKey, 'xjy-customer-address-location')
  }
})

test('无坐标、非数字或越界的客户地址保持地图占位', () => {
  for (const [latitude, longitude] of [
    [undefined, undefined], ['', ''], [null, null], [0, 0],
    ['invalid', 121.603842], [29.829768, Infinity], [91, 121], [30, -181]
  ]) {
    const { location } = hooks.getPresentation(addressContext('View', {
      KehuDT_Lat: latitude, KehuDT_Lng: longitude
    }))
    assert.equal(location.mapReady, false)
    assert.equal(location.emptyText, '该地址暂未保存坐标')
  }
})

test('客户地址坐标字段继续兼容元数据中的大小写', () => {
  const context = addressContext('View', { kehudt_lat: '29.829768', kehudt_lng: '121.603842' })
  context.definition = { fields: [{ Name: 'kehudt_lat' }, { Name: 'kehudt_lng' }] }
  const { location } = hooks.getPresentation(context)
  assert.equal(location.mapReady, true)
  assert.equal(location.latitude, 29.829768)
  assert.equal(location.longitude, 121.603842)
})

test('打卡地图继续等待自身的延迟挂载状态', () => {
  const context = { tableName: 'diy_location', mode: 'Add', form: {}, state: hooks.createState() }
  context.state.checkinLocation = { latitude: 30.221378, longitude: 120.12143, address: '杭州西湖' }
  assert.equal(hooks.getPresentation(context).location.mapReady, false)
  context.state.checkinMapReady = true
  assert.equal(hooks.getPresentation(context).location.mapReady, true)
})
