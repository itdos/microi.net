import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const source = fs.readFileSync(path.join(projectRoot, 'src/pages/task/map.vue'), 'utf8')
const taskMapMethod = source.match(/async loadTaskMap\(\) \{[\s\S]*?\n    \},\n    async loadFilteredCustomers/)
const taskDeviceMapMethod = source.match(/async loadTaskDevices\(\) \{[\s\S]*?\n    \},\n    async loadTaskMap/)

assert.ok(taskMapMethod, '必须能定位售后任务地图加载方法')
assert.doesNotMatch(taskMapMethod[0], /authorizedCustomerModule|loadAuthorizedCustomerRows/,
  '售后任务地图不得要求当前用户拥有客户表菜单权限')
assert.match(taskMapMethod[0], /TASK_COORDINATE_MISSING_WHERE/,
  '历史无坐标任务必须先通过售后任务模块权限查询')
assert.match(source, /callApiEngine\('get_location_shouhou-v2',[\s\S]*?TaskIds:/,
  '客户默认坐标必须通过受控售后任务坐标接口读取')
assert.match(source, /catch \(error\) \{[\s\S]*?fallbackFailed = true/,
  '坐标兜底接口失败不得阻断已有坐标任务的展示')
assert.ok(taskDeviceMapMethod, '必须能定位任务设备地图加载方法')
assert.match(taskDeviceMapMethod[0], /callApiEngine\('get_location_shebei-v2'/,
  '任务设备地图必须通过受控设备坐标接口读取兜底坐标')
assert.match(taskDeviceMapMethod[0], /catch \(error\) \{[\s\S]*?fallbackFailed = true[\s\S]*?this\.applyRows/,
  '设备坐标增强失败不得阻断任务设备地图')

console.log('售后任务地图坐标权限检查通过')
