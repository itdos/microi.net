import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...segments) => fs.readFileSync(path.join(...segments), 'utf8')

const listSource = read(appRoot, 'src/pages/task/list.vue')
const repairSource = read(appRoot, 'src/pages/native/repair.vue')
const businessSource = read(appRoot, 'src/tenants/xjy/business.js')

test('客户身份使用精确角色名且内部客户管理角色不会被模糊命中', () => {
  assert.match(businessSource, /user\.RoleIdsString/)
  assert.match(businessSource, /new Set\(\['客户', '客户账号', '客户用户', '终端客户', '客户（用户）'\]\)/)
  assert.match(businessSource, /roleNames\.some\(\(name\) => customerRoleNames\.has\(name\)\)/)
  assert.doesNotMatch(businessSource, /const isCustomer = \/客户\//)
})

test('客户隐藏负责人开关，内部人员明确显示只看我负责', () => {
  assert.match(listSource, /v-if="showMineSwitch" class="mine-switch"/)
  assert.match(listSource, />只看我负责<\/text>/)
  assert.match(listSource, /showMineSwitch\(\) \{ return !this\.isCustomerAccount \}/)
  assert.match(listSource, /this\.mineOnly = this\.isCustomerAccount \? false : options\.scope !== 'all'/)
  assert.match(listSource, /mineOnly: this\.isCustomerAccount \? false : this\.mineOnly/)
})

test('报修成功按服务端任务Id定位，并继续经过模块列表权限', () => {
  assert.match(repairSource, /result\.Data\.TaskId \|\| result\.Data\.Id/)
  assert.match(repairSource, /focusTaskId=\$\{encodeURIComponent\(taskId\)\}/)
  assert.match(listSource, /extraWhere: \[\{ Name: 'Id', Type: '=', Value: this\.focusTaskId \}\]/)
  assert.match(listSource, /const \[result, focusedTask\] = await Promise\.all\(\[loadTasks\(filters\), focusPromise\]\)/)
  assert.doesNotMatch(listSource, /\bloadTask\s*,/)
  assert.match(listSource, />本次报修<\/text>/)
})
