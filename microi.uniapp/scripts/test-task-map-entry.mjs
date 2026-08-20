import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listSource = fs.readFileSync(new URL('../src/pages/task/list.vue', import.meta.url), 'utf8')
const mapSource = fs.readFileSync(new URL('../src/pages/task/map.vue', import.meta.url), 'utf8')
const taskSource = fs.readFileSync(new URL('../src/utils/xjy-task.js', import.meta.url), 'utf8')

test('售后任务列表在搜索框左侧展示任务地图入口', () => {
  const mapEntryIndex = listSource.indexOf('class="task-map-entry"')
  const searchIndex = listSource.indexOf('class="search-box"')
  assert.ok(mapEntryIndex >= 0)
  assert.ok(searchIndex > mapEntryIndex)
  assert.match(listSource, /\/pages\/task\/map\?mode=task/)
  assert.match(listSource, />任务地图<\/text>/)
  assert.match(listSource, /filters=\$\{encodeURIComponent\(JSON\.stringify\(filters\)\)\}/)
  for (const field of ['keyword', 'state', 'type', 'period', 'customRange', 'dateField', 'city', 'mineOnly', 'orderType']) {
    assert.match(listSource, new RegExp(`\\b${field}:`))
  }
})

test('任务地图按当前筛选条件、权限和范围分页加载任务坐标', () => {
  const loadTaskMapSource = mapSource.match(/async loadTaskMap\(\) \{[\s\S]*?(?=\n    async loadFilteredCustomers\(\))/)?.[0] || ''
  assert.match(mapSource, /task:\s*\{ title: '任务地图'/)
  assert.match(loadTaskMapSource, /uni\.getLocation\(\{ type: 'gcj02', isHighAccuracy: true/)
  assert.match(loadTaskMapSource, /buildMapRangeBounds\(this\.latitude, this\.longitude, radius\)/)
  assert.match(loadTaskMapSource, /const loadScopedTasks = async \(extraWhere\) => \{[\s\S]*loadTasks\([\s\S]*while \(tasks\.length < count\)/)
  assert.match(mapSource, /period: 'all', mineOnly: false, \.\.\.this\.taskFilters/)
  assert.match(loadTaskMapSource, /includeCoordinates: true/)
  assert.match(loadTaskMapSource, /loadScopedTasks\(\[\.\.\.baseExtraWhere, \.\.\.rangeWhere\]\)/)
  assert.match(loadTaskMapSource, /mapDistanceKm\(this\.latitude, this\.longitude, latitude, longitude\) <= radius/)
  assert.doesNotMatch(mapSource, /V8\.FormEngine\.GetTableData\('Diy_Kehu'/)
  assert.match(taskSource, /const TASK_MAP_SELECT_FIELDS = \[[\s\S]*?'KehuDT_Lat', 'KehuDT_Lng'/)
  assert.match(taskSource, /if \(options\.includeCoordinates === true\) payload\._SelectFields = TASK_MAP_SELECT_FIELDS/)
  assert.match(taskSource, /\.\.\.\(Array\.isArray\(options\.extraWhere\) \? options\.extraWhere : \[\]\)/)
  assert.match(taskSource, /if \(menuId\) payload\._SysMenuId = menuId/)
  assert.match(mapSource, /\/pages\/task\/detail\?id=/)
})

test('历史售后任务通过客户模块权限回填坐标且不绕过任务权限', () => {
  const customerModuleSource = mapSource.match(/async authorizedCustomerModule\([\s\S]*?(?=\n    async loadAuthorizedCustomerRows\()/)?.[0] || ''
  const loadTaskMapSource = mapSource.match(/async loadTaskMap\(\) \{[\s\S]*?(?=\n    async loadFilteredCustomers\(\))/)?.[0] || ''
  assert.match(customerModuleSource, /findMenu\(customerModule\.menuAliases \|\| \[\], table, false, preferredMenuId\)/)
  assert.match(customerModuleSource, /ModuleEngineKey: 'Diy_Kehu'/)
  assert.match(customerModuleSource, /menuId/)
  assert.match(customerModuleSource, /requireAuthorizedMenu: true/)
  assert.match(loadTaskMapSource, /const customerConfig = await this\.authorizedCustomerModule\(\)/)
  assert.match(loadTaskMapSource, /\{ Name: 'KehuID', Type: 'In', Value: customerIds\.slice/)
  assert.match(loadTaskMapSource, /await loadScopedTasks\(/)
  assert.match(loadTaskMapSource, /KehuDT_Lat: customer\.KehuDT_Lat/)
  assert.match(loadTaskMapSource, /KehuDT_Lng: customer\.KehuDT_Lng/)
  assert.match(loadTaskMapSource, /CoordinateSource: 'customer-default'/)
})

test('售后任务地图显示默认15公里、最大300公里的范围筛选', () => {
  assert.match(mapSource, /mode === 'task' \|\| !taskId/)
  assert.match(mapSource, /radius: 15/)
  assert.match(mapSource, /rangeMax\(\) \{ return \(this\.mode === 'task' \|\| this\.hasListCustomerFilters\) \? 300 : 50 \}/)
  assert.match(mapSource, /changeRadius\(event\)[\s\S]*?this\.mode === 'task'[\s\S]*?this\.loadTaskMap\(\)/)
})

test('任务地图将完全相同的经纬度聚合为带任务数量的单个标记', () => {
  assert.match(mapSource, /const groupsByCoordinate = new Map\(\)/)
  assert.match(mapSource, /const key = `\$\{latitude\},\$\{longitude\}`/)
  assert.match(mapSource, /groupsByCoordinate\.get\(key\)\.rows\.push\(item\)/)
  assert.match(mapSource, /count > 1 \? `\$\{count\}\$\{deviceGroup \? '台设备' : \(customerGroup \? '个客户' : '个任务'\)\}`/)
  assert.match(mapSource, /this\.selectedGroup = group \? group\.rows : \[\]/)
  assert.match(mapSource, /v-for="item in selectedGroup"/)
})

test('售后任务地图使用设备地图同款红蓝定位针', () => {
  assert.match(mapSource, /isAfterSalesTaskComplete\(item\)/)
  assert.match(mapSource, /iconPath: complete \? '\/static\/xjy\/business\/dw\.png' : '\/static\/xjy\/business\/dwRed\.png'/)
  assert.match(mapSource, /bgColor: complete \? '#0091eb' : '#e5484d'/)
})
