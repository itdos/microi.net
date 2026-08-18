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
})

test('任务地图分页加载全部授权任务并按客户坐标落点', () => {
  assert.match(mapSource, /task:\s*\{ title: '任务地图'/)
  assert.match(mapSource, /do \{[\s\S]*loadTasks\([\s\S]*while \(tasks\.length < count\)/)
  assert.match(mapSource, /period: 'all', mineOnly: false/)
  assert.match(mapSource, /_SelectFields: \['Id', 'KehuMC', 'Chengshi', 'XiangxiDZ', 'KehuDT_Lat', 'KehuDT_Lng'\]/)
  assert.match(mapSource, /\/pages\/task\/detail\?id=/)
})
