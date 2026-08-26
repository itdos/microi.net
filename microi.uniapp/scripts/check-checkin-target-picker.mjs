import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const page = read('src/pages/native/checkin.vue')
const nativeForm = read('src/pages/native-form/index.vue')
const sharedFields = read('src/components/mci-visit-target-fields/mci-visit-target-fields.vue')
const picker = read('src/components/mci-visit-target-combobox/mci-visit-target-combobox.vue')
const business = read('src/tenants/xjy/business.js')
const failures = []

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message)
}

const mappings = [
  ['客户', 'customers', 'Diy_Kehu'],
  ['项目合伙人', 'partners', 'diy_waibuxzr'],
  ['供应商', 'suppliers', 'Diy_ShangpinGYS'],
  ['商家', 'stores', 'Diy_Tenant']
]

for (const [type, moduleKey, table] of mappings) {
  requireToken(sharedFields, `${type}: '${moduleKey}'`, `拜访对象类型“${type}”未映射到 ${moduleKey}`)
  requireToken(business, `${moduleKey}: native({`, `租户业务模块缺少 ${moduleKey}`)
  requireToken(business, `table: '${table}'`, `${moduleKey} 未绑定表 ${table}`)
}

;[
  ['getBusinessModule(this.moduleKey)', '选择器必须复用租户业务模块展示配置'],
  ["const VISIT_TARGET_ENGINE_KEY = 'xjy-visit-target-options'", '打卡全量查询接口 Key 配置错误'],
  ["getBusinessModule('attendanceRecords')", '打卡全量查询必须以人员定位模块作为权限锚点'],
  ['permissionMenuId: menuId', '打卡全量查询必须携带人员定位菜单标识'],
  ["V8.ApiEngine.Run(VISIT_TARGET_ENGINE_KEY", '打卡全量查询必须调用服务端专用接口'],
  ["this.queryScope === CHECKIN_QUERY_SCOPE", '普通跟进与打卡查询范围必须显式隔离'],
  ['loadModuleRows(config, {', '非打卡页面必须继续使用原模块权限查询']
].forEach(([token, message]) => requireToken(picker, token, message))

requireToken(sharedFields, ':module-key="moduleKey"', '共享组件未随拜访对象类型切换数据源')
requireToken(sharedFields, 'this.$refs.targetCombobox.openOptions()', '选中对象类型后未立即加载对象数据')
requireToken(page, "KehuID: this.form.targetType === '客户' ? this.targetId : ''", '非客户对象 Id 不得写入 KehuID')
requireToken(page, '<mci-visit-target-fields', '拜访打卡未复用拜访对象共享组件')
requireToken(page, 'query-scope="checkin"', '拜访打卡未启用人员定位权限下的全量对象查询')
requireToken(nativeForm, '<mci-visit-target-fields', '人员定位新增/编辑页未复用拜访对象共享组件')
requireToken(nativeForm, ':query-scope="visitTargetQueryScope"', '通用表单未按当前表隔离拜访对象查询范围')
requireToken(nativeForm, "=== 'diy_location' ? 'checkin' : 'module'", '只有人员定位表可以启用全量对象查询')
requireToken(sharedFields, "'visit-target-fields__control--active': typeOpen }\" @tap.stop", '类型下拉控件内部未阻止点击冒泡')
requireToken(sharedFields, "'visit-target-fields__control--active': targetOpen }\" @tap.stop", '对象下拉控件内部未阻止点击冒泡')
requireToken(nativeForm, '@back="goBack" @tap="closeOpenVisitTarget"', '人员定位整页未监听下拉框外点击')
requireToken(nativeForm, "typeof component.closeOptions === 'function'", '人员定位外部点击未调用共享组件关闭方法')
requireToken(page, '@tap="closeDropdowns"', '拜访打卡整页未监听下拉框外点击')
requireToken(sharedFields, "'visit-target-fields__control--active': typeOpen", '类型下拉未将高层级限制到当前控件')
requireToken(sharedFields, "'visit-target-fields__control--active': targetOpen", '对象下拉未将高层级限制到当前控件')
requireToken(business, "menuAliases: ['商家列表', '商家', '商家管理']", '商家选择器必须优先匹配绑定 Diy_Tenant 的商家列表菜单')
requireToken(business, "menuPermission: { table: 'Diy_location'", '拜访打卡入口必须绑定人员定位菜单权限')

if (failures.length) {
  failures.forEach((failure) => console.error(`[checkin-target-picker] FAIL: ${failure}`))
  process.exit(1)
}

console.log('[checkin-target-picker] PASS: check-in/location use permission-anchored full target queries while follow-up keeps module scope')
