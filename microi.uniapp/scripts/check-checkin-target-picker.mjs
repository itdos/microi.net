import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const page = read('src/pages/native/checkin.vue')
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
  requireToken(page, `${type}: '${moduleKey}'`, `拜访对象类型“${type}”未映射到 ${moduleKey}`)
  requireToken(business, `${moduleKey}: native({`, `租户业务模块缺少 ${moduleKey}`)
  requireToken(business, `table: '${table}'`, `${moduleKey} 未绑定表 ${table}`)
}

;[
  ['getBusinessModule(this.moduleKey)', '选择器必须复用租户业务模块配置'],
  ['findMenu(base.menuAliases || [], base.table)', '选择器必须从当前账号授权菜单解析真实菜单'],
  ['findMenu(base.menuAliases || [], base.table, true)', '首次未找到菜单时必须刷新授权树重试'],
  ['if (!menuId) throw new Error', '没有授权菜单时必须失败关闭'],
  ['this.moduleConfig = { ...base, menuId }', '查询配置必须携带真实 menuId'],
  ['loadModuleRows(config, {', '选择器必须通过统一模块查询链路加载数据']
].forEach(([token, message]) => requireToken(picker, token, message))

requireToken(page, ':module-key="targetModuleKey"', '页面未随拜访对象类型切换数据源')
requireToken(page, 'this.$refs.targetCombobox.openOptions()', '选中对象类型后未立即加载对象数据')
requireToken(page, "KehuID: this.form.targetType === '客户' ? this.targetId : ''", '非客户对象 Id 不得写入 KehuID')
requireToken(business, "menuAliases: ['商家列表', '商家', '商家管理']", '商家选择器必须优先匹配绑定 Diy_Tenant 的商家列表菜单')

if (failures.length) {
  failures.forEach((failure) => console.error(`[checkin-target-picker] FAIL: ${failure}`))
  process.exit(1)
}

console.log('[checkin-target-picker] PASS: 4 target types use authorized menu-scoped module queries')
