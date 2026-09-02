import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(appRoot, '..')
const source = (relative) => fs.readFileSync(path.join(appRoot, relative), 'utf8')
const engineSource = (relative) => fs.readFileSync(path.join(workspaceRoot, relative), 'utf8')

const mapSource = source('src/pages/task/map.vue')
const businessSource = source('src/tenants/xjy/business.js')
const runtimeSource = source('src/platform/business-runtime.js')
const workspaceSource = source('src/pages/workspace/index.vue')
const businessDetailSource = source('src/pages/business/detail.vue')
const repairEngineSource = engineSource('Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/移动端-申请售后(shenqing_shouhou).js')
const repairCancelEngineSource = engineSource('Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/客户取消报修(repair_cancel).js')
const deviceMapMethod = mapSource.match(/async loadCustomerDevices\(\) \{[\s\S]*?\r?\n    \},\r?\n    async loadTaskDevices/)

assert.ok(deviceMapMethod, '必须能定位客户设备地图加载方法')
assert.doesNotMatch(deviceMapMethod[0], /V8\.FormEngine\.GetTableData\('Diy_KehuSB'/,
  '客户维度设备地图不得绕过 ModuleEngine 的菜单与行权限')
assert.match(deviceMapMethod[0], /findMenu\(deviceModule\.menuAliases/,
  '客户维度设备地图必须解析当前账号的真实设备菜单')
assert.match(deviceMapMethod[0], /loadModuleRows\(/,
  '客户维度设备地图必须通过 ModuleEngine 读取设备')
assert.match(mapSource, /canOpenBusinessEntry\('deviceMap'\)/,
  '直达设备地图页面必须校验地图入口权限')
assert.match(mapSource, /DeviceAccessScope !== 'staff'/,
  '客户地图定位摘要不得跳转到通用设备表单详情')
assert.match(mapSource, /<template v-if="mode === 'device'">[\s\S]*?<view class="entity-sheet__row"><text>客户名称<\/text><text>\{\{ selected\.KehuMC \|\| '-' \}\}<\/text><\/view>\s*<view class="entity-sheet__row"><text>安装位置<\/text>/,
  '设备地图坐标信息必须在安装位置上方展示客户名称')

assert.match(businessSource, /deviceMap:\s*\{[\s\S]*?menuPermission:\s*\{\s*table:\s*'Diy_KehuSB'/,
  '设备地图必须绑定设备菜单权限')
assert.match(businessSource, /customerMap:\s*\{[\s\S]*?menuPermission:\s*\{\s*table:\s*'Diy_Kehu'/,
  '客户地图必须绑定客户菜单权限')
assert.match(runtimeSource, /export async function canOpenBusinessEntry\(/,
  '运行时必须提供统一的业务入口权限解析')
assert.match(runtimeSource, /if \(!await canOpenBusinessEntry\(key\)\)/,
  '绕过首页的业务入口仍必须校验权限')
assert.match(workspaceSource, /isHomeEntryVisible\(key\)/,
  '首页必须按地图入口权限过滤菜单')

const deviceEngine = engineSource('Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/获取N公里范围内的所有设备列表数据(get_location_shebei-v2).js')
assert.match(deviceEngine, /if \(!currentUserId \|\| !tenantId\)/,
  '设备地图接口必须在缺少登录身份或租户时拒绝访问')
assert.match(deviceEngine, /A\.TenantId = @p3/,
  '设备地图接口必须始终按租户过滤')
assert.match(deviceEngine, /A\.KehuZHID = @p5/,
  '设备地图接口必须按设备客户账号 ID 精确过滤')
assert.match(deviceEngine, /C\.KehuZHID = @p5/,
  '设备地图接口必须按客户主档账号 ID 精确过滤')
assert.doesNotMatch(deviceEngine, /KehuGLZH LIKE/,
  '设备地图接口不得按账号文本模糊匹配')

const deviceSqlWhere = engineSource('Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/模块引擎/设备管理（e1557c49-0420-45d8-98b9-a563cb90b629）/设备列表（d89ca3bf-6f0a-4c9d-97f6-db1a115744f0）/Where条件（SqlWhere）.js')
assert.match(deviceSqlWhere, /A\.KehuZHID = '\$CurrentUser\.Id\$'/,
  '设备列表必须支持按设备的客户账号 ID 做行级过滤')
assert.match(deviceSqlWhere, /C\.KehuZHID = '\$CurrentUser\.Id\$'/,
  '设备列表必须支持按客户主档账号 ID 做行级过滤')
assert.doesNotMatch(deviceSqlWhere, /KehuGLZH\s+LIKE/,
  '设备列表不得按账号文本模糊匹配')

assert.match(businessSource, /afterSalesAdd:\s*\{[\s\S]*?path:\s*'\/pages\/business\/list\?key=devices'/,
  '我要报修必须复用我的设备列表，不能绕过设备选择直接新增售后单')
assert.match(businessSource, /afterSalesAdd:\s*\{[\s\S]*?menuPermission:\s*\{\s*table:\s*'Diy_KehuSB'/,
  '我要报修入口必须复用设备菜单权限')
assert.doesNotMatch(repairEngineSource, /V8\.Param\._RowModel\s*=/,
  '报修接口不得向 Newtonsoft JToken 参数对象回写 JS 对象')
assert.match(repairEngineSource, /var newId\s*=\s*V8\.Method\.NewGuid\(\)/,
  '报修接口必须使用字符串 Guid，避免 CLR Guid 进入 JSON 提交对象')
assert.match(repairEngineSource, /sameUser\(kehuSBModel\.KehuZHID\)\s*\|\|\s*sameUser\(kehuModel\.KehuZHID\)/,
  '报修接口必须在服务端校验设备或客户主档的客户账号 ID')
assert.match(repairEngineSource, /if\(addSBResult\.Code != 1\)\{\s*return addSBResult;/,
  '售后设备子表新增失败时必须返回失败以回滚整个报修事务')
assert.doesNotMatch(businessDetailSource, /openDeviceRepair[\s\S]{0,300}my-baoxiu\.png/,
  '设备详情的一键报修按钮按当前产品要求不得显示图标')
assert.match(businessDetailSource, /const isRepair = Number\(item\.LeixingZ \|\| 0\) === 4 \|\| \/维修\//,
  '取消报修按钮只能由未终结的维修任务驱动，不能误用换芯或保养任务')
assert.match(businessDetailSource, /this\.deviceActiveTask = \{\}[\s\S]{0,160}ShebeiGZZT: '正常'/,
  '取消成功后必须立即清空活动报修并恢复页面设备状态')
assert.match(repairCancelEngineSource, /FormEngineKey\s*:\s*'diy_shouhousp'[\s\S]*ShouhouDDID/,
  '取消接口必须从售后设备关联表回查主表缺失的设备 ID')
assert.doesNotMatch(repairCancelEngineSource, /V8\.DbTrans\.(Commit|Rollback)\(/,
  '接口引擎事务必须由返回 Code 自动提交或回滚')

console.log('设备列表、地图与报修权限检查通过')
