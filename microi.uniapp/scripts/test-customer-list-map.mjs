import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listSource = fs.readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
const mapSource = fs.readFileSync(new URL('../src/pages/task/map.vue', import.meta.url), 'utf8')

test('客户列表搜索栏左侧提供客户地图入口', () => {
  assert.match(listSource, /v-if="key === 'customers'" class="customer-map-entry"/)
  assert.match(listSource, /src="\/static\/xjy\/business\/customerMap\.png"/)
  assert.match(listSource, /@tap="openCustomerMap"/)
})

test('客户地图携带当前列表全部筛选条件', () => {
  assert.match(listSource, /openCustomerMap\(\)[\s\S]*?keyword: this\.keyword\.trim\(\)/)
  assert.match(listSource, /period: this\.period/)
  assert.match(listSource, /customRange:[\s\S]*?this\.customStart[\s\S]*?this\.customEnd/)
  assert.match(listSource, /status: this\.status/)
  assert.match(listSource, /extraWhere: this\.buildFilterWhere\(\)/)
  assert.match(listSource, /mode=customer&filters=\$\{encodeURIComponent\(JSON\.stringify\(filters\)\)\}/)
})

test('客户地图加载全部筛选分页并按完全相同坐标聚合', () => {
  assert.match(mapSource, /async loadFilteredCustomers\(\)/)
  assert.match(mapSource, /const CUSTOMER_MAP_SELECT_FIELDS = \[[\s\S]*?'KehuDT_Lat', 'KehuDT_Lng'/)
  assert.match(mapSource, /selectFields: CUSTOMER_MAP_SELECT_FIELDS/)
  assert.match(mapSource, /loadModuleRows\(config, \{[\s\S]*?keyword: filters\.keyword[\s\S]*?extraWhere:/)
  assert.match(mapSource, /while \(customers\.length < count\)/)
  assert.match(mapSource, /this\.mode === 'customer' && this\.customerFilters\.fromList === true/)
  assert.match(mapSource, /const key = `\$\{latitude\},\$\{longitude\}`/)
  assert.match(mapSource, /customerGroup \? '个客户'/)
})
