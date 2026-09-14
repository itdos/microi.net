import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...segments) => fs.readFileSync(path.join(...segments), 'utf8')

const listSource = read(appRoot, 'src/pages/business/list.vue')
const businessRuntimeSource = read(appRoot, 'src/platform/business-runtime.js')

test('人员定位列表默认只看我的，并可切换到平台授权的全部数据', () => {
  assert.match(listSource, /v-if="showMineSwitch" class="mine-switch"/)
  assert.match(listSource, /<text>只看我的<\/text>/)
  assert.match(listSource, /mineOnly: true/)
  assert.match(listSource, /this\.mineOnly = options\.scope !== 'all'/)
  assert.match(listSource, /mineOnly: this\.mineOnly/)
  assert.match(listSource, /\['business-list:v2', userKey, this\.key/)
  assert.match(listSource, /toggleMine\(\) \{[\s\S]*?this\.mineOnly = !this\.mineOnly[\s\S]*?this\.loadData\(true, true\)/)
})

test('只看我的使用 UserId 收窄查询，查看全部不在前端授予角色权限', () => {
  assert.match(listSource, /toLowerCase\(\) === 'diy_location'/)
  const filterMethod = listSource.match(/buildFilterWhere\(\) \{[\s\S]*?\n    \},\n    selectedSort/)
  assert.ok(filterMethod, '未找到业务列表筛选方法')
  assert.match(filterMethod[0], /this\.showMineSwitch && this\.mineOnly/)
  assert.match(filterMethod[0], /initial\.push\(\{ Name: 'UserId', Type: '=', Value:/)
  assert.doesNotMatch(filterMethod[0], /RoleIds|RoleName|Level|总经理|销售助理/)
})

test('查看全部仍携带真实菜单标识，由服务端执行数据权限', () => {
  assert.match(businessRuntimeSource, /if \(menuId\) payload\._SysMenuId = menuId/)
  assert.match(businessRuntimeSource, /Action: 'GetTableData'/)
})
