import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const actionsFile = path.join(projectRoot, 'src/pages/business/utils/xjy-row-actions.js')
const listFile = path.join(projectRoot, 'src/pages/business/list.vue')
const detailFile = path.join(projectRoot, 'src/pages/business/detail.vue')
const businessConfigFile = path.join(projectRoot, 'src/tenants/xjy/business.js')
const relatedListFile = path.join(projectRoot, 'src/components/mci-business-related-list/mci-business-related-list.vue')
const tenantFormFile = path.join(projectRoot, 'src/tenants/xjy/form.js')
const actionsSource = fs.readFileSync(actionsFile, 'utf8')
const listSource = fs.readFileSync(listFile, 'utf8')
const detailSource = fs.readFileSync(detailFile, 'utf8')
const businessConfigSource = fs.readFileSync(businessConfigFile, 'utf8')
const relatedListSource = fs.readFileSync(relatedListFile, 'utf8')
const tenantFormSource = fs.readFileSync(tenantFormFile, 'utf8')

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

assert.match(businessConfigSource, /label: '设备编号', field: 'ShangpinBH'/,
  '安装位置列表必须将 ShangpinBH 显示为设备编号')
assert.doesNotMatch(businessConfigSource, /label: '商品编号', field: 'ShangpinBH'/,
  '安装位置列表不能再将 ShangpinBH 显示为商品编号')
assert.match(actionsSource, /export function canViewOrderDevice/,
  '安装位置必须统一判断设备详情是否可见')
assert.match(actionsSource, /\['待审批', '已驳回', '待审批作废', '待审批已作废'\]/,
  '待审批、已驳回和待审批作废订单必须隐藏设备详情按钮')
assert.match(actionsSource, /!\[1, 5, 6\]\.includes\(stateCode\)/,
  '设备详情显隐必须兼容订单状态码')
assert.match(actionsSource, /GetFormData\('Diy_KehuSB',[\s\S]*?Name: 'KehuID'[\s\S]*?Name: 'ShebeiBH'/,
  '设备详情必须按客户 Id 与设备编号查询客户设备')
assert.match(actionsSource, /table: 'Diy_KehuSB'[\s\S]*?mode: 'View'/,
  '查询到设备后必须以查看模式打开客户设备表单')
assert.match(listSource, /openInstallationPositionDevice\(row\)/,
  '安装位置独立列表必须响应设备详情按钮')
assert.match(relatedListSource, /openInstallationPositionDevice\(row\)/,
  '订单商品详情中的安装位置关联列表必须响应设备详情按钮')
assert.match(actionsSource, /callApiEngine\('position-copy',[\s\S]*?NewId: newCopyOperationId\(\)/,
  '复制安装位置必须调用带幂等操作 Id 的专用接口')
assert.doesNotMatch(actionsSource, /actionKey === 'position-copy'[^\n]*add_datacopy/,
  '安装位置不能继续使用会复制原设备编号的通用复制接口')
assert.match(tenantFormSource, /isOrderProductForm\(context\) && isOrderProductInstallationChild\(payload\.field\)/,
  '订单商品必须识别安装位置关联列表的完整总数')
assert.match(tenantFormSource, /UptFormData\(ORDER_PRODUCT_TABLE,[\s\S]*?\[field\]: value/,
  '安装位置总数变化后必须回写订单商品设备数量')

console.log('集福鲤业务增改、订单审批权限与弹窗交互检查通过')
