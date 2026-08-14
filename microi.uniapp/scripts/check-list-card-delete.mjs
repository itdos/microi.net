import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendStandardDeleteAction } from '../src/platform/module-delete.js'
import { canDeleteMenuRecord } from '../src/platform/menu-permission.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const moduleList = read('src/pages/module/list.vue')
const businessList = read('src/pages/business/list.vue')
const businessCard = read('src/components/mci-business-card/mci-business-card.vue')
const relatedList = read('src/components/mci-business-related-list/mci-business-related-list.vue')
const deletePolicy = read('src/platform/module-delete.js')
const actions = read('src/platform/view-actions.js')
const actionTypes = read('src/platform/view-schema-core.mjs')
const businessActions = read('src/pages/business/utils/xjy-row-actions.js')

assert.doesNotMatch(moduleList, /class="action-row"/, '通用列表不能把删除等次要操作直接平铺在卡片中')
assert.doesNotMatch(businessCard, /class="card-actions"/, '业务卡片不能把删除等次要操作直接平铺在卡片中')
assert.match(moduleList, /data-card__detail[\s\S]*?data-card__more/, '通用卡片右下角必须先显示查看详情，再显示更多')
assert.match(businessCard, /detail-link[\s\S]*?more-link/, '业务卡片右下角必须先显示查看详情，再显示更多')
assert.doesNotMatch(businessCard, /查看详情\s*›/, '业务卡片查看详情右侧不能显示箭头')
assert.doesNotMatch(moduleList, /查看详情\s*›/, '通用卡片查看详情右侧不能显示箭头')
assert.match(moduleList, /showRowActionSheet\(actions/, '通用卡片更多入口必须使用统一操作面板')
assert.match(businessCard, /showRowActionSheet\(actions/, '业务卡片更多入口必须使用统一操作面板')

assert.match(deletePolicy, /canDeleteMenuRecord\(options\.menuId, options\.user\)/, '自动删除入口必须先检查菜单删除权限')
assert.match(deletePolicy, /ActionType:\s*'Delete'/, '标准删除入口必须走声明式 Delete 动作')
assert.match(actionTypes, /'Delete'/, 'ViewSchema 必须声明支持 Delete 动作')
assert.match(actions, /case 'Delete'/, '动作执行器必须实现 Delete')
assert.match(actions, /FormEngineKey:\s*tableName/, '删除请求必须携带表单引擎标识')
assert.match(actions, /_InvokeType:\s*'Client'/, '删除必须触发表单客户端调用链事件')
assert.match(actions, /params\._SysMenuId/, '动作参数必须补齐菜单权限上下文')
assert.match(actions, /params\.ModuleEngineKey/, '动作参数必须补齐模块权限上下文')
assert.match(businessActions, /canDeleteMenuRecord\(menuId, user\)/, '定制业务删除也必须复用菜单删除权限')
assert.match(relatedList, /appendStandardDeleteAction\(nativeActions\.concat\(configuredViewActions\)/,
  '客户详情及新增编辑页的关联 Tab 必须自动补充标准删除动作')
assert.match(relatedList, /getBusinessRowActions\(this\.moduleKey, row, this\.currentUser, this\.menuId \|\| this\.childMenuId\)/,
  '关联 Tab 的定制删除动作必须校验子菜单删除权限')
assert.match(relatedList, /tableChildAuth:\s*this\.tableChildAuth/,
  '关联 Tab 删除必须携带完整 TableChild 权限链')
assert.match(actions, /params\._TableChildAuth[\s\S]*?context\.tableChildAuth/,
  '声明式删除执行器必须透传 TableChild 权限链')

const row = { Id: 'row-1' }
const allowedUser = { _RoleLimits: [{ FkId: 'menu-1', Permission: [{ Name: 'Del' }] }] }
assert.equal(canDeleteMenuRecord('menu-1', allowedUser), true, 'Del 权限应允许删除')
assert.equal(canDeleteMenuRecord('menu-2', allowedUser), false, '其他菜单的 Del 权限不能越权复用')
assert.equal(canDeleteMenuRecord('menu-1', { _RoleLimits: '[]' }), false, '普通无权限用户不能删除')
assert.equal(canDeleteMenuRecord('menu-1', { _IsAdmin: true }), true, '平台管理员应允许删除')

const injected = appendStandardDeleteAction([], {
  row,
  user: allowedUser,
  menuId: 'menu-1',
  tableName: 'Diy_Test',
  moduleEngineKey: 'test-module',
  title: '测试记录'
})
assert.equal(injected.length, 1)
assert.equal(injected[0].ActionType, 'Delete')
assert.equal(injected[0].TableName, 'Diy_Test')
assert.equal(injected[0].ModuleEngineKey, 'test-module')
assert.equal(injected[0].SuccessActions[0].ActionType, 'Refresh')
assert.equal(injected[0].SuccessActions[0].Target, 'Data', '删除成功后只能刷新数据，不能刷新元数据')
assert.match(actions, /action\.Target === 'Data'[\s\S]*?context\.refreshData/, '数据级刷新必须走独立 refreshData 回调')
assert.match(businessList, /refreshData:\s*\(\)\s*=>\s*this\.loadData\(true, true\)/, '业务列表删除后必须只重新加载数据')
assert.equal(appendStandardDeleteAction([{ Label: '删除', ActionType: 'Delete' }], {
  row,
  user: {},
  menuId: 'menu-1'
}).length, 0, '无权限时必须移除后台声明的删除动作')

console.log('小程序列表卡片删除入口、权限上下文与交互布局检查通过')
