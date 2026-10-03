import assert from 'node:assert/strict'
import {
  buildDefaultHomeActions,
  rememberRecentModuleList,
  resolveRecentModules
} from '../src/platform/home-workbench.mjs'
import {
  expandWorkspaceGroup,
  initialExpandedWorkspaceGroups,
  normalizeExpandedWorkspaceGroups,
  toggleWorkspaceCategoryFilters,
  toggleWorkspaceGroup
} from '../src/platform/workspace-group-state.mjs'

const actions = buildDefaultHomeActions({ messages: true, scan: false })
assert.deepEqual(actions.map((item) => item.nativeAction), ['workspace', 'dashboard', 'messages'])
assert.equal(actions.some((item) => item.nativeAction === 'scan'), false)
assert.deepEqual(
  buildDefaultHomeActions({ messages: true, scan: true }).map((item) => item.nativeAction),
  ['scan', 'workspace', 'dashboard', 'messages']
)

const modules = [
  { key: 'customer', menuId: 'menu-customer', title: '客户' },
  { key: 'contract', menuId: 'menu-contract', title: '合同' },
  { key: 'report', menuId: 'menu-report', title: '报表' }
]
let records = rememberRecentModuleList([], modules[0])
records = rememberRecentModuleList(records, modules[1])
records = rememberRecentModuleList(records, modules[0])
assert.deepEqual(resolveRecentModules(records, modules).map((item) => item.key), ['customer', 'contract'])

const staleAndUnauthorized = [
  { menuId: 'removed-menu' },
  { menuId: 'menu-report' },
  { menuId: 'menu-report' }
]
assert.deepEqual(resolveRecentModules(staleAndUnauthorized, modules).map((item) => item.key), ['report'])

const groups = [
  { key: 'customer', title: '客户管理' },
  { key: 'workflow', title: '流程管理' },
  { key: 'system', title: '系统管理' }
]
let categoryFiltersExpanded = false
let expandedGroups = initialExpandedWorkspaceGroups(groups)
assert.deepEqual(expandedGroups, ['customer', 'workflow', 'system'], '工作台下方业务菜单默认展开')
categoryFiltersExpanded = toggleWorkspaceCategoryFilters(categoryFiltersExpanded)
assert.equal(categoryFiltersExpanded, true, '第一次点击全部应展开顶部应用分类标签')
assert.deepEqual(expandedGroups, ['customer', 'workflow', 'system'], '展开顶部分类不得改变下方业务菜单')
categoryFiltersExpanded = toggleWorkspaceCategoryFilters(categoryFiltersExpanded)
assert.equal(categoryFiltersExpanded, false, '第二次点击全部应收起顶部应用分类标签')
assert.deepEqual(expandedGroups, ['customer', 'workflow', 'system'], '收起顶部分类不得改变下方业务菜单')
expandedGroups = toggleWorkspaceGroup(expandedGroups, groups, 'customer')
assert.deepEqual(expandedGroups, ['workflow', 'system'], '下方业务分组标题应支持单独收起')
expandedGroups = toggleWorkspaceGroup(expandedGroups, groups, 'customer')
assert.deepEqual(expandedGroups, ['workflow', 'system', 'customer'], '下方业务分组标题应支持单独展开')
assert.deepEqual(expandWorkspaceGroup([], groups, 'system'), ['system'], '从首页定向进入工作台时应展开目标分组')
assert.deepEqual(normalizeExpandedWorkspaceGroups(['customer', 'removed'], groups), ['customer'], '菜单刷新后应清理失效展开状态')

console.log('[home-workbench] PASS: generic actions and scoped recent-module policy')
