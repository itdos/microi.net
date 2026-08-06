import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const actionsFile = path.join(projectRoot, 'src/pages/business/utils/xjy-row-actions.js')
const listFile = path.join(projectRoot, 'src/pages/business/list.vue')
const detailFile = path.join(projectRoot, 'src/pages/business/detail.vue')
const actionsSource = fs.readFileSync(actionsFile, 'utf8')
const listSource = fs.readFileSync(listFile, 'utf8')
const detailSource = fs.readFileSync(detailFile, 'utf8')

assert.match(actionsSource, /export function canAddMenuRecord/,
  '业务列表新增入口必须使用共享菜单新增权限函数')
assert.match(actionsSource, /export function canEditMenuRecord/,
  '业务详情编辑入口必须使用共享菜单编辑权限函数')
assert.match(actionsSource, /hasExactMenuPermission\(menuId, \['Add', '新增'\], user\)/,
  '新增必须精确匹配平台 Add/新增权限')
assert.match(actionsSource, /hasExactMenuPermission\(menuId, \['Edit', '编辑'\], user\)/,
  '编辑必须精确匹配平台 Edit/编辑权限')
assert.match(listSource, /v-if="canAddRecord" class="nav-icon"/,
  '列表右上角新增按钮必须按新增权限显示')
assert.match(listSource, /v-if="canAddRecord" class="floating-add"/,
  '列表悬浮新增按钮必须按新增权限显示')
assert.match(listSource, /if \(!this\.canAddRecord\)[\s\S]*?当前账号没有新增权限/,
  '列表新增方法必须二次校验新增权限')
assert.match(detailSource, /v-if="canEditRecord" class="nav-button nav-button--edit"/,
  '详情编辑按钮必须按编辑权限显示')
assert.match(detailSource, /if \(!this\.canEditRecord\)[\s\S]*?当前账号没有编辑权限/,
  '详情编辑方法必须二次校验编辑权限')

assert.match(actionsSource, /export function canApproveOrder/,
  '订单列表与详情必须共享订单审批权限函数')
assert.match(actionsSource, /state === '待审批' \|\| stateCode === 1/,
  '普通审批必须使用精确状态，不能误匹配待审批作废')
assert.match(actionsSource, /sameTenant\(row, user\).*hasMenuPermission\(MENU_IDS\.orders, '审批', user\)/s,
  '订单审批必须同时校验同租户和合同订单审批按钮权限')
assert.match(detailSource, /hasOrderApprovalPermission\(this\.detail, this\.currentUser\)/,
  '订单详情必须复用列表页审批权限函数')
assert.doesNotMatch(detailSource, /showOrderApprovalDialog[^\n]*@tap\.self/,
  '订单审核弹窗不能依赖小程序端不稳定的 self 遮罩事件')
assert.match(detailSource, /class="dialog-backdrop" @tap="closeOrderApprovalDialog"/,
  '订单审核弹窗应使用独立背景层关闭')
assert.match(detailSource, /class="dialog-textarea"[^>]*fixed[^>]*adjust-position/s,
  '固定弹窗中的审核意见输入框必须启用小程序键盘位置适配')

console.log('集福鲤业务增改、订单审批权限与弹窗交互检查通过')
