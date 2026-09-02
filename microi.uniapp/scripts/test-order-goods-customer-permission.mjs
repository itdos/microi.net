import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(appRoot, '..')
const source = (relative) => fs.readFileSync(path.join(appRoot, relative), 'utf8')
const engineSource = (relative) => fs.readFileSync(path.join(workspaceRoot, relative), 'utf8')
const moduleRoot = 'Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/模块引擎/订单管理（26011406-298b-44f8-b7c9-32975fb4d447）/订单商品列表（a6d5be58-adb2-40b9-b8df-0b85fdbd8977）'

const businessSource = source('src/tenants/xjy/business.js')
const runtimeSource = source('src/platform/business-runtime.js')
const sqlJoin = engineSource(`${moduleRoot}/Join关联（SqlJoin）.js`)
const sqlWhere = engineSource(`${moduleRoot}/Where条件（SqlWhere）.js`)
const orderGoodsMatch = businessSource.match(/orderGoods:\s*native\(\{([\s\S]*?)\r?\n\s*\}\),\r?\n\s*installationPositions:/)

assert.ok(orderGoodsMatch, '必须保留订单商品业务模块配置')
assert.match(orderGoodsMatch[1], /requireAuthorizedMenu:\s*true/,
  '订单商品入口必须要求当前账号拥有真实菜单授权')
assert.match(runtimeSource, /moduleConfig\.requireAuthorizedMenu === true && !menuId/,
  '通用列表运行时必须在缺少授权菜单时失败关闭')

assert.match(sqlJoin, /INNER JOIN Diy_Dingdan C ON A\.DingdanID=C\.Id/,
  '订单商品必须通过 DingdanID 回溯关联订单')
assert.match(sqlJoin, /INNER JOIN Diy_Kehu E ON C\.KehuID=E\.Id/,
  '订单商品必须通过订单回溯真实客户')
assert.match(sqlWhere, /C\.KehuZHID='\$CurrentUser\.Id\$'/,
  '客户账号必须能按订单上的精确绑定用户 Id 查看商品')
assert.match(sqlWhere, /E\.KehuZHID='\$CurrentUser\.Id\$'/,
  '客户账号只能按客户主档绑定的精确用户 Id 查看订单商品')
assert.doesNotMatch(sqlWhere, /KehuGLZH\s+LIKE/,
  '客户账号权限不得使用账号文本模糊匹配')

console.log('订单商品客户行级权限检查通过')
