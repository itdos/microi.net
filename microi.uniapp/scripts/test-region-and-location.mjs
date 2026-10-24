import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

import {
  createRegionPickerState,
  regionPickerSelection
} from '../src/platform/region-picker.mjs'
import {
  formatRegionSelection,
  stripRegionFromAddress
} from '../src/platform/region-value.mjs'
import { XJY_CUSTOMER_DEFAULT_REGION } from '../src/tenants/xjy/customer-location.mjs'
import { customerFollowScopeValues } from '../src/tenants/xjy/customer-follow-scope.mjs'

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

// 执行真实地址归一化模块；仅隔离网络依赖，避免只检查源码而漏掉点位名称被覆盖。
const locationSource = readFileSync(new URL('../src/platform/location.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{.*$/gm, '')
  .replace('export default {', 'const locationApi = {')
  .replace(/^export (?=(?:async )?function )/gm, '')
const locationApi = vm.runInNewContext(`${locationSource}; locationApi`, { stripRegionFromAddress })
const selectedLocation = {
  address: '鄞州区中物科技园7号楼', name: '宁波新纪源净水科技有限公司',
  latitude: 29.829768, longitude: 121.603842
}
const parsedLocation = {
  address: '浙江省宁波市鄞州区潘火街道金信路中物科技园',
  region: ['浙江省', '宁波市', '鄞州区'],
  latitude: 29.8297, longitude: 121.6038
}

test('手动选点保留所选楼号和名称，逆解析只补充省市区', () => {
  const result = locationApi.normalizeChosenLocation(selectedLocation, parsedLocation)
  assert.equal(result.address, selectedLocation.address + selectedLocation.name)
  assert.equal(stripRegionFromAddress(result.address, result.region), '中物科技园7号楼宁波新纪源净水科技有限公司')
  assert.deepEqual(Array.from(result.region), parsedLocation.region)
  assert.equal(result.latitude, selectedLocation.latitude)
  assert.equal(result.longitude, selectedLocation.longitude)
})

test('选点地址已含名称时不重复追加，仍保留用户选择的地址', () => {
  const address = '浙江省宁波市鄞州区中物科技园7号楼宁波新纪源净水科技有限公司'
  assert.equal(locationApi.normalizeChosenLocation({ ...selectedLocation, address }, parsedLocation).address, address)
})

test('仅有点位名称时用解析地址补齐，解析地址已含名称时去重', () => {
  for (const address of [undefined, '', '   ']) {
    const picked = { ...selectedLocation, address }
    assert.equal(locationApi.normalizeChosenLocation(picked, parsedLocation).address,
      parsedLocation.address + selectedLocation.name)
    const geocode = { ...parsedLocation, address: parsedLocation.address + selectedLocation.name }
    assert.equal(locationApi.normalizeChosenLocation(picked, geocode).address, geocode.address)
  }
})

test('没有点位名称时保留选点地址，地址对象沿用格式化结果', () => {
  assert.equal(locationApi.normalizeChosenLocation({ ...selectedLocation, name: '' }, parsedLocation).address,
    selectedLocation.address)
  assert.equal(locationApi.normalizeChosenLocation({
    ...selectedLocation, address: { formatted_address: selectedLocation.address }
  }, parsedLocation).address, selectedLocation.address + selectedLocation.name)
})

test('自动定位只有坐标时继续使用解析地址与省市区', () => {
  const result = locationApi.normalizeChosenLocation({
    latitude: selectedLocation.latitude, longitude: selectedLocation.longitude
  }, parsedLocation)
  assert.equal(result.address, parsedLocation.address)
  assert.deepEqual(Array.from(result.region), parsedLocation.region)
})

test('解析失败时保留选点地址和名称，并从完整地址推断省市区', () => {
  const picked = { ...selectedLocation, address: '浙江省宁波市鄞州区中物科技园7号楼' }
  const result = locationApi.normalizeChosenLocation(picked, null)
  assert.equal(result.address, picked.address + picked.name)
  assert.deepEqual(Array.from(result.region), parsedLocation.region)
  assert.equal(locationApi.normalizeChosenLocation({ name: picked.name }).address, picked.name)
  assert.equal(locationApi.normalizeChosenLocation({}).address, '')
})

function locationFormHarness({ geocodeFails = false, cancelled = false } = {}) {
  const chosen = [selectedLocation]
  const messages = []
  const source = tenantFormSource
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export default\s+/, 'const hooks = ')
    .replace(/export\s+(?=(?:async\s+)?function\s)/g, '')
  const hooks = vm.runInNewContext(`${source}; hooks`, {
    ...locationApi,
    customerFollowScopeValues,
    reverseGeocode: async () => {
      if (geocodeFails) throw new Error('地址解析失败')
      return parsedLocation
    },
    uni: {
      chooseLocation: ({ success, fail }) => cancelled
        ? fail({ errMsg: 'chooseLocation:fail cancel' }) : success(chosen.shift()),
      showToast: (message) => messages.push(message)
    }
  })
  function context(tableName = 'diy_kehu', mode = 'Add') {
    const result = {
      tableName, mode, state: hooks.createState(),
      form: { XiangxiDZ: '原有详细地址' },
      patchForm: (updates) => Object.assign(result.form, updates)
    }
    return result
  }
  return { hooks, context, chosen, messages }
}

test('客户新增、编辑和客户地址表单的手动定位回填名称并保留提交值', async () => {
  for (const tableName of ['diy_kehu', 'diy_kehudz']) {
    for (const mode of ['Add', 'Edit']) {
      const { hooks, context, messages } = locationFormHarness()
      const current = context(tableName, mode)
      const action = tableName === 'diy_kehu'
        ? { key: 'xjy-customer-location' } : { key: 'xjy-customer-address-location' }
      const result = tableName === 'diy_kehu'
        ? await hooks.runFieldAction(current, {}, action)
        : await hooks.runPresentationAction(current, action)
      assert.equal(result.handled, true)
      assert.equal(current.form.XiangxiDZ, '中物科技园7号楼宁波新纪源净水科技有限公司')
      assert.equal(current.form.Chengshi, JSON.stringify(parsedLocation.region))
      assert.equal(current.form.KehuDT_Lat, selectedLocation.latitude)
      assert.equal(current.state.locationValues.XiangxiDZ, current.form.XiangxiDZ)
      const submit = await hooks.beforeSubmit(current)
      assert.equal({ ...current.form, ...submit }.XiangxiDZ, current.form.XiangxiDZ)
      assert.equal(current.state.locating, false)
      assert.equal(messages.at(-1).title, '位置已更新')
    }
  }
})

test('连续选点使用最新点位，解析失败也不回退到原有详细地址', async () => {
  const { hooks, context, chosen } = locationFormHarness({ geocodeFails: true })
  const current = context()
  await hooks.runFieldAction(current, {}, { key: 'xjy-customer-location' })
  assert.equal(current.form.XiangxiDZ, '中物科技园7号楼宁波新纪源净水科技有限公司')
  chosen.push({ ...selectedLocation, address: '浙江省宁波市鄞州区金信路8号', name: '服务中心' })
  await hooks.runFieldAction(current, {}, { key: 'xjy-customer-location' })
  assert.equal(current.form.XiangxiDZ, '金信路8号服务中心')
  assert.equal(current.state.locationValues.XiangxiDZ, '金信路8号服务中心')
  assert.equal(current.state.locating, false)
})

test('合同订单、售后和安装位置共用定位逻辑时同样保留楼号和点位名', async () => {
  for (const [tableName, addressField, latitudeField, longitudeField, actionKey, stateKey] of [
    ['diy_dingdan', 'XiangxiDZ', 'DingdanDT_Lat', 'DingdanDT_Lng', 'xjy-business-address-location', 'businessLocationValues'],
    ['diy_shouhoudd', 'Dizhi', 'ShouhouDT_Lat', 'ShouhouDT_Lng', 'xjy-business-address-location', 'businessLocationValues'],
    ['diy_shebeiwz', 'AnzhuangWZ', 'AnzhuangWZ_Lat', 'AnzhuangWZ_Lng', 'xjy-installation-position-location', 'installationLocationValues']
  ]) {
    const { hooks, context } = locationFormHarness()
    const current = context(tableName, 'Edit')
    current.definition = { fields: [addressField, latitudeField, longitudeField].map((Name) => ({ Name })) }
    await hooks.runFieldAction(current, {}, { key: actionKey })
    assert.equal(current.form[addressField], '中物科技园7号楼宁波新纪源净水科技有限公司')
    assert.equal(current.form[latitudeField], selectedLocation.latitude)
    assert.equal(current.form[longitudeField], selectedLocation.longitude)
    assert.equal(current.state[stateKey][latitudeField], selectedLocation.latitude)
    assert.equal(current.state.locating, false)
  }
})

test('取消地图选点保持原有详细地址并释放定位状态', async () => {
  const { hooks, context, messages } = locationFormHarness({ cancelled: true })
  const current = context()
  await hooks.runFieldAction(current, {}, { key: 'xjy-customer-location' })
  assert.equal(current.form.XiangxiDZ, '原有详细地址')
  assert.equal(Object.keys(current.state.locationValues).length, 0)
  assert.equal(current.state.locating, false)
  assert.equal(messages.length, 0)
})

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

test('xjy 客户城市默认选中浙江省全部全部', () => {
  assert.deepEqual(XJY_CUSTOMER_DEFAULT_REGION, ['浙江省', '全部', '全部'])
  assert.deepEqual(
    regionPickerSelection(createRegionPickerState(XJY_CUSTOMER_DEFAULT_REGION)),
    ['浙江省', '全部', '全部']
  )
})

test('地址控件将异步业务值传入共用地区选择器', () => {
  assert.match(nativeFieldSource, /<mci-region-picker[^>]*:model-value="regionValue"/)
})

test('直辖市保留市级和区县级选择', () => {
  const state = createRegionPickerState(['北京市', '北京市', '东城区'])
  assert.equal(state.columns[1][0].name, '全部')
  assert.equal(state.columns[1][1].name, '北京市')
  assert.equal(state.columns[2][0].name, '全部')
  assert.ok(state.columns[2].some((item) => item.name === '东城区'))
  assert.deepEqual(regionPickerSelection(state), ['北京市', '北京市', '东城区'])
})
