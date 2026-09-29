import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasVisibleNativeField, nativeFieldRoleVisibility } from '../src/platform/native-field-visibility.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const detailSource = fs.readFileSync(path.join(projectRoot, 'src/pages/business/detail.vue'), 'utf8')
const runtimeSource = fs.readFileSync(path.join(projectRoot, 'src/platform/business-runtime.js'), 'utf8')

const periodicTaskField = {
  Name: 'ShengchengZQRW',
  BindRole: JSON.stringify(['e757d4f5-e204-4039-9624-960bc3c60cbf'])
}
const definitionFor = (user) => {
  const visibility = nativeFieldRoleVisibility(periodicTaskField, user)
  return { fields: visibility.visible ? [{ ...periodicTaskField, visible: true }] : [] }
}

assert.equal(
  hasVisibleNativeField(definitionFor({ RoleIds: ['958b0d41-5851-45ef-967d-02cff27bc5ee'] }), periodicTaskField.Name),
  false,
  '销售角色不在平台 BindRole 中时不得显示生成任务'
)
assert.equal(
  hasVisibleNativeField(definitionFor({ RoleIds: ['e757d4f5-e204-4039-9624-960bc3c60cbf'] }), periodicTaskField.Name),
  true,
  '客服角色在平台 BindRole 中时应保留生成任务入口'
)

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
  /canGeneratePeriodicTasks\(\)[\s\S]*?hasVisibleNativeField\(this\.definition, 'ShengchengZQRW'\)/,
  '生成任务必须复用平台字段 BindRole 过滤结果，不能给全部内部角色放行'
)
assert.match(
  detailSource,
  /async generatePeriodicTasks\(\)[\s\S]*?if \(!this\.canGeneratePeriodicTasks\)[\s\S]*?当前账号无生成任务权限/,
  '生成任务点击入口必须再次校验权限并在无权时失败关闭'
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
assert.match(
  runtimeSource,
  /const direct = await V8\.ApiEngine\.Run\([\s\S]*?direct !== undefined && direct !== null\) return direct/,
  '接口引擎 Code=0 业务失败必须原样返回，不能再次调用旧接口'
)
assert.doesNotMatch(
  runtimeSource,
  /direct && direct\.Code !== 0/,
  '接口兼容回退不得把 Code=0 业务失败误判为新路由不可用'
)

const callApiEngineSource = runtimeSource.match(
  /export async function callApiEngine\(key, data = \{\}\) \{[\s\S]*?\n\}/
)
assert.ok(callApiEngineSource, '必须能定位接口引擎兼容调用函数')
const createCallApiEngine = (apiEngine) => new Function(
  'V8',
  `${callApiEngineSource[0].replace('export async function', 'async function')}; return callApiEngine`
)({ ApiEngine: apiEngine })

let legacyCallCount = 0
const businessFailure = await createCallApiEngine({
  Run: async () => ({ Code: 0, Msg: '无换芯统计数据插入' }),
  RunLegacy: async () => {
    legacyCallCount += 1
    return { Code: 1 }
  }
})('kehu_dingqirw', { Id: 'customer-1' })
assert.deepEqual(businessFailure, { Code: 0, Msg: '无换芯统计数据插入' })
assert.equal(legacyCallCount, 0, '业务失败不得兼容重试或吞掉原始 Msg')

const fallbackSuccess = await createCallApiEngine({
  Run: async () => { throw new Error('新路由不可达') },
  RunLegacy: async () => {
    legacyCallCount += 1
    return { Code: 1, Msg: '旧路由成功' }
  }
})('legacy-engine')
assert.equal(fallbackSuccess.Code, 1)
assert.equal(legacyCallCount, 1, '只有新路由异常时才允许回退旧接口')

assert.match(
  detailSource,
  /async runTaskEngine\([\s\S]*?catch \(error\)[\s\S]*?errorMessage = error\.message \|\| error\.Msg[\s\S]*?finally \{[\s\S]*?uni\.hideLoading\(\)[\s\S]*?uni\.showModal\(\{[\s\S]*?content: errorMessage/,
  '任务接口失败时必须先关闭 loading，再用模态框完整展示服务端 Msg'
)

console.log('客户详情底部操作栏与更多操作面板检查通过')
