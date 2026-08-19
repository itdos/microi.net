import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listSource = fs.readFileSync(new URL('../src/pages/task/list.vue', import.meta.url), 'utf8')
const mapSource = fs.readFileSync(new URL('../src/pages/task/map.vue', import.meta.url), 'utf8')

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

test('任务地图按当前筛选条件分页加载全部匹配任务并按客户坐标落点', () => {
  assert.match(mapSource, /task:\s*\{ title: '任务地图'/)
  assert.match(mapSource, /do \{[\s\S]*loadTasks\([\s\S]*while \(tasks\.length < count\)/)
  assert.match(mapSource, /period: 'all', mineOnly: false, \.\.\.this\.taskFilters/)
  assert.match(mapSource, /_SelectFields: \['Id', 'KehuMC', 'Chengshi', 'XiangxiDZ', 'KehuDT_Lat', 'KehuDT_Lng'\]/)
  assert.match(mapSource, /\/pages\/task\/detail\?id=/)
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
