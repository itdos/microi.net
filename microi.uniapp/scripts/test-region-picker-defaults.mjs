import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import * as regions from '../src/platform/region-picker.mjs'

const require = createRequire(import.meta.url)
const appConfig = require('../profiles/xjy/profile.cjs').config
const source = readFileSync(new URL('../src/components/mci-region-picker/mci-region-picker.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[^\n]*\n/gm, '').replace('export default', 'globalThis.component =')
const scope = { ...regions, appConfig }
vm.runInNewContext(script, scope)
const component = scope.component
const plain = (value) => JSON.parse(JSON.stringify(value))
function picker(modelValue = []) {
  const events = []
  const state = { modelValue, $emit: (...args) => events.push(args) }
  Object.assign(state, component.data.call(state))
  for (const [key, method] of Object.entries(component.methods)) state[key] = method.bind(state)
  return { state, events }
}

test('空地区首次打开定位浙江省/全部/全部，未确认不写入值', () => {
  const { state, events } = picker()
  assert.deepEqual(regions.regionPickerSelection(state.region), ['浙江省', '全部', '全部'])
  assert.deepEqual(state.modelValue, [])
  assert.equal(events.length, 0)
})

test('滚动后取消重开恢复默认地区；确认才发送选择值', () => {
  const { state, events } = picker()
  state.changeColumn({ detail: { column: 0, value: 0 } })
  assert.notEqual(regions.regionPickerSelection(state.region)[0], '浙江省')
  state.resetRegion()
  state.confirmRegion({ detail: { value: state.region.indexes } })
  assert.deepEqual(plain(events), [
    ['update:modelValue', ['浙江省', '全部', '全部']],
    ['change', { detail: { value: ['浙江省', '全部', '全部'] } }]
  ])
})

test('异步回填、已有值、清空后重开共用同一初始化规则', () => {
  const { state } = picker(['广东省', '深圳市', '南山区'])
  assert.deepEqual(regions.regionPickerSelection(state.region), state.modelValue)
  state.modelValue = ['北京市', '北京市', '东城区']
  component.watch.modelValue.handler.call(state)
  assert.deepEqual(regions.regionPickerSelection(state.region), state.modelValue)
  state.modelValue = []
  component.watch.modelValue.handler.call(state)
  assert.deepEqual(regions.regionPickerSelection(state.region), appConfig.defaultRegion)
})

test('改变省、市清空下级选择，不把租户默认值强加给标准 Profile', () => {
  let state = regions.createRegionPickerState(['浙江省', '宁波市', '鄞州区'], appConfig.defaultRegion)
  state = regions.updateRegionPickerState(state, 1, 0)
  assert.deepEqual(regions.regionPickerSelection(state), ['浙江省', '全部', '全部'])
  state = regions.updateRegionPickerState(state, 0, 0)
  assert.deepEqual(state.indexes, [0, 0, 0])
  const standard = regions.createRegionPickerState([])
  assert.equal(standard.indexes[0], 0)
})

test('所有地区入口使用共用组件，取消和重开同步已确认值', () => {
  for (const file of ['components/mci-native-field/mci-native-field.vue', 'components/mci-list-filter-field/mci-list-filter-field.vue', 'components/mci-table-selector/mci-table-selector.vue', 'pages/native/repair.vue', 'pages/native/merchant-apply.vue']) {
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(text, /<mci-region-picker/, file)
    assert.doesNotMatch(text, /mode="region"/, file)
  }
  assert.match(source, /@cancel="resetRegion"/)
  assert.match(source, /@tap="resetRegion"/)
})

test('下拉触发框的真实编译事件不冒泡，保留页面已打开分组的裁剪解除状态', () => {
  const { compile } = require('@vue/compiler-dom')
  const Vue = require('vue')
  const fieldSource = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
  const trigger = fieldSource.match(/<view class="native-control__input native-select__trigger"[^>]*>/)[0] + '</view>'
  const render = new Function('Vue', compile(trigger).code)(Vue)
  let openField = '', stopped = false
  const vnode = render({ selectorOpen: false, openSelector() { openField = 'water-option' } }, [])
  vnode.props.onTap({ stopPropagation() { stopped = true } })
  if (!stopped) openField = '' // 对应页面 @tap 的外部关闭处理器。
  assert.equal(openField, 'water-option')
})
