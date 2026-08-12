import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const detailSource = fs.readFileSync(path.join(projectRoot, 'src/pages/business/detail.vue'), 'utf8')

assert.doesNotMatch(
  detailSource,
  /class="nav-button nav-button--edit"/,
  '全部业务详情页顶部都不应保留编辑节点'
)
assert.match(
  detailSource,
  /class="action-button action-button--edit action-button--with-icon"[\s\S]*?@tap="openFullForm"/,
  '客户详情底部必须提供带图形的编辑按钮'
)
assert.match(detailSource, /\.bottom-actions>\.action-button--edit:only-child[\s\S]*?width: 100%/,
  '详情页只有编辑按钮时必须占满整行')
assert.match(detailSource, /<template v-else-if="key === 'orders'">[\s\S]*?v-if="canApproveOrder"/,
  '订单详情必须使用独立分支，禁止落入通用联系按钮')
assert.match(
  detailSource,
  /\.action-button--edit,[\s\S]*?\.action-button--more[\s\S]*?background: #e94b2c;[\s\S]*?color: #fff;/,
  '客户编辑和更多按钮应使用与主操作一致的橙红色实心样式'
)
assert.match(
  detailSource,
  /v-if="canClaimCustomer"[\s\S]*?@tap="claimCustomer"[\s\S]*?v-else-if="canGeneratePeriodicTasks"/,
  '客户主操作位应根据状态在领取客户和生成任务之间切换'
)
assert.match(
  detailSource,
  /v-if="hasCustomerMoreActions"[\s\S]*?@tap="showCustomerMoreSheet = true"/,
  '客户低频操作应从更多入口打开'
)
assert.match(
  detailSource,
  /v-if="canExposeCustomerRelease"[\s\S]*?@tap="releaseCustomer"/,
  '底栏有剩余位置时应直接展示移入公海'
)
assert.match(
  detailSource,
  /customerReservedActionCount\(\)[\s\S]*?canExposeCustomerRelease\(\)[\s\S]*?customerReservedActionCount < 3/,
  '客户操作应以最多三个外露按钮为自适应阈值'
)
assert.match(
  detailSource,
  /class="customer-action-item customer-action-item--danger"[\s\S]*?runCustomerMoreAction\('release'\)/,
  '移入公海必须放在更多操作面板并保持危险操作样式'
)
assert.match(
  detailSource,
  /async runCustomerMoreAction\(action\)[\s\S]*?await this\.releaseCustomer\(\)/,
  '更多操作必须复用原有移入公海业务逻辑与二次确认'
)

console.log('客户详情底部操作栏与更多操作面板检查通过')
