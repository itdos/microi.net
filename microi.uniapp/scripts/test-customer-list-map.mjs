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

test('客户列表地图默认15公里且最大可调整到300公里', () => {
  assert.match(mapSource, /radius: 15/)
  assert.match(mapSource, /rangeMax\(\) \{ return \(this\.mode === 'task' \|\| this\.hasListCustomerFilters\) \? 300 : 50 \}/)
  assert.match(mapSource, /:max="rangeMax"/)
  assert.match(mapSource, /async loadFilteredCustomers\(\)/)
  assert.match(mapSource, /uni\.getLocation\(\{ type: 'gcj02', isHighAccuracy: true/)
  assert.match(mapSource, /buildMapRangeBounds\(this\.latitude, this\.longitude, radius\)/)
  assert.match(mapSource, /mapDistanceKm\(this\.latitude, this\.longitude, latitude, longitude\) <= radius/)
  assert.match(mapSource, /changeRadius\(event\)[\s\S]*?this\.loadFilteredCustomers\(\)/)
})

test('客户地图范围查询始终经过真实菜单权限且不直接展示附近接口结果', () => {
  const methodSource = mapSource.match(/async loadFilteredCustomers\(\) \{[\s\S]*?\n    reload\(\)/)?.[0] || ''
  const permissionSource = mapSource.match(/async authorizedCustomerModule\([\s\S]*?(?=\n    async loadAuthorizedCustomerRows\()/)?.[0] || ''
  assert.match(methodSource, /const menuId = String\(filters\.menuId \|\| ''\)\.trim\(\)/)
  assert.match(methodSource, /if \(!menuId\) throw new Error\('当前账号无权查看客户地图'\)/)
  assert.match(permissionSource, /ModuleEngineKey: 'Diy_Kehu'/)
  assert.match(permissionSource, /requireAuthorizedMenu: true/)
  assert.match(methodSource, /loadModuleRows\(config, \{/)
  assert.doesNotMatch(methodSource, /callApiEngine\('get_location_kehu-v2'/)
  assert.doesNotMatch(methodSource, /applyRows\(nearbyCustomers\)/)
})

test('客户地图仅对授权范围内客户叠加当前列表筛选并按完全相同坐标聚合', () => {
  assert.match(mapSource, /const CUSTOMER_MAP_SELECT_FIELDS = \[[\s\S]*?'KehuDT_Lat', 'KehuDT_Lng'/)
  assert.match(mapSource, /authorizedCustomerModule\(CUSTOMER_MAP_SELECT_FIELDS, menuId\)/)
  assert.match(mapSource, /loadModuleRows\(config, \{[\s\S]*?keyword: filters\.keyword[\s\S]*?extraWhere:/)
  assert.match(mapSource, /\{ Name: 'KehuDT_Lat', Type: '>=', Value: bounds\.minLatitude \}/)
  assert.match(mapSource, /\.\.\.rangeWhere/)
  assert.match(mapSource, /while \(customers\.length < count\)/)
  assert.match(mapSource, /this\.mode === 'customer' && this\.customerFilters\.fromList === true/)
  assert.match(mapSource, /const key = `\$\{latitude\},\$\{longitude\}`/)
  assert.match(mapSource, /customerGroup \? '个客户'/)
})

test('客户地图弹层只展示详细地址且不拼接城市字段', () => {
  assert.match(mapSource, /<text>详细地址<\/text><text>\{\{ selected\.XiangxiDZ \|\| '-' \}\}<\/text>/)
  assert.match(mapSource, /this\.mode === 'customer' \? \(this\.selectedGroup\.length > 1 \? '位于同一客户坐标，请选择客户' : \(this\.selected\.XiangxiDZ/)
  assert.doesNotMatch(mapSource, /\[item\.Chengshi, item\.XiangxiDZ\]/)
  assert.doesNotMatch(mapSource, /\[selected\.Chengshi, selected\.XiangxiDZ\][\s\S]*?mode === 'customer'/)
})
