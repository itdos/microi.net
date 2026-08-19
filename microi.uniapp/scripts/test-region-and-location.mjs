import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  createRegionPickerState,
  regionPickerSelection
} from '../src/platform/region-picker.mjs'
import {
  formatRegionSelection,
  stripRegionFromAddress
} from '../src/platform/region-value.mjs'
import { XJY_CUSTOMER_DEFAULT_REGION } from '../src/tenants/xjy/customer-location.mjs'

const nativeFieldSource = readFileSync(
  new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url),
  'utf8'
)
const tenantFormSource = readFileSync(
  new URL('../src/tenants/xjy/form.js', import.meta.url),
  'utf8'
)
const nativeFormPageSource = readFileSync(
  new URL('../src/pages/native-form/index.vue', import.meta.url),
  'utf8'
)

test('定位详细地址过滤完整省市区前缀', () => {
  assert.equal(
    stripRegionFromAddress('浙江省杭州市西湖区西湖街道西湖杭州西湖风景名胜区', ['浙江省', '杭州市', '西湖区']),
    '西湖街道西湖杭州西湖风景名胜区'
  )
})

test('定位详细地址兼容不带行政区后缀的地图地址', () => {
  assert.equal(
    stripRegionFromAddress('浙江宁波鄞州区首南街道123号', ['浙江省', '宁波市', '鄞州区']),
    '首南街道123号'
  )
})

test('定位详细地址只过滤开头，不误删道路或地点中的同名内容', () => {
  assert.equal(
    stripRegionFromAddress('浙江省杭州市西湖区西湖大道1号', ['浙江省', '杭州市', '西湖区']),
    '西湖大道1号'
  )
  assert.equal(
    stripRegionFromAddress('浙江杭州西湖大道1号', ['浙江省', '杭州市', '西湖区']),
    '西湖大道1号'
  )
})

test('合同订单与售后任务手动定位回填城市、过滤后的地址及后台坐标字段', () => {
  assert.match(tenantFormSource, /const ORDER_LOCATION_FIELDS = \{[\s\S]*region: 'Chengshi',[\s\S]*address: 'XiangxiDZ'/)
  assert.match(tenantFormSource, /const AFTER_SALES_LOCATION_FIELDS = \{[\s\S]*region: 'Chengshi',[\s\S]*address: 'Dizhi'/)
  assert.match(tenantFormSource, /configuredCoordinateFieldName\(context, fields\.latitude, 'latitude'\)/)
  assert.match(tenantFormSource, /configuredCoordinateFieldName\(context, fields\.longitude, 'longitude'\)/)
  assert.match(tenantFormSource, /updates\[config\.regionName\] = JSON\.stringify\(location\.region\)/)
  assert.match(tenantFormSource, /updates\[config\.addressName\] = stripRegionFromAddress\(location\.address, location\.region\)/)
  assert.match(tenantFormSource, /key: 'xjy-business-address-location'/)
  assert.match(tenantFormSource, /label: context\.state\.locating \? '定位中…' : '手动定位'/)
  assert.match(nativeFormPageSource, /action\.iconType === 'location'/)
})

test('客户表重新定位按钮统一更名为手动定位', () => {
  const customerAction = tenantFormSource.slice(
    tenantFormSource.indexOf("key: 'xjy-customer-location'"),
    tenantFormSource.indexOf("key: 'xjy-business-address-location'")
  )
  assert.match(customerAction, /'手动定位'/)
  assert.doesNotMatch(customerAction, /'重新定位'/)
})

test('地区选择器只在市和区首项加入全部', () => {
  const state = createRegionPickerState(['浙江省', '宁波市', '全部'])
  assert.equal(state.columns[0][state.indexes[0]].name, '浙江省')
  assert.equal(state.columns[1][state.indexes[1]].name, '宁波市')
  assert.equal(state.columns[0][0].name === '全部', false)
  assert.equal(state.columns[1][0].name, '全部')
  assert.equal(state.columns[2][0].name, '全部')
  assert.deepEqual(regionPickerSelection(state), ['浙江省', '宁波市', '全部'])
})

test('地区选择器回显已有区县值', () => {
  const state = createRegionPickerState(['浙江省', '宁波市', '鄞州区'])
  assert.deepEqual(regionPickerSelection(state), ['浙江省', '宁波市', '鄞州区'])
})

test('地区全部值按字面值展示', () => {
  assert.equal(formatRegionSelection(['浙江省', '全部', '全部']), '浙江省全部')
  assert.equal(formatRegionSelection(['浙江省', '宁波市', '全部']), '浙江省宁波市全部')
  assert.equal(formatRegionSelection(['浙江省', '宁波市', '鄞州区']), '浙江省宁波市鄞州区')
})

test('xjy 客户城市默认选中浙江省宁波市鄞州区', () => {
  assert.deepEqual(XJY_CUSTOMER_DEFAULT_REGION, ['浙江省', '宁波市', '鄞州区'])
  assert.deepEqual(
    regionPickerSelection(createRegionPickerState(XJY_CUSTOMER_DEFAULT_REGION)),
    ['浙江省', '宁波市', '鄞州区']
  )
})

test('地址控件监听异步赋值并同步地区选择器索引', () => {
  assert.equal((nativeFieldSource.match(/\n  watch: \{/g) || []).length, 1)
  assert.match(nativeFieldSource, /modelValue:\s*\{[\s\S]*?createRegionPickerState\(this\.regionValue\)/)
})

test('直辖市保留市级和区县级选择', () => {
  const state = createRegionPickerState(['北京市', '北京市', '东城区'])
  assert.equal(state.columns[1][0].name, '全部')
  assert.equal(state.columns[1][1].name, '北京市')
  assert.equal(state.columns[2][0].name, '全部')
  assert.ok(state.columns[2].some((item) => item.name === '东城区'))
  assert.deepEqual(regionPickerSelection(state), ['北京市', '北京市', '东城区'])
})
