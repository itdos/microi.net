import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const related = fs.readFileSync(path.join(root, 'src/components/mci-business-related-list/mci-business-related-list.vue'), 'utf8')
const business = fs.readFileSync(path.join(root, 'src/tenants/xjy/business.js'), 'utf8')

assert.match(related, /v-if="!isPreview && relatedMetrics\.length"[\s\S]*?class="search-row"/,
  '客户关联 Tab 的统计条必须展示在检索框上方')
assert.match(related, /const baseWhere = \[[\s\S]*?this\.childFkField[\s\S]*?this\.relationValue[\s\S]*?this\.config\.fixedWhere/,
  '统计查询必须限定当前客户外键并继承模块固定条件')
assert.match(related, /_TableChildAuth: this\.tableChildAuth/,
  '统计查询必须携带完整 TableChild 授权链')
assert.match(related, /Promise\.all\(metrics\.map/,
  '同一 Tab 的多个统计指标应并行加载')
assert.match(related, /if \(metric\.aggregateField\)[\s\S]*?loadModuleRows\(this\.config,[\s\S]*?statisticsFieldValue\(summary\.append, metric\.aggregateField, 0\)/,
  '金额等汇总指标必须使用模块引擎的服务端全量 StatisticsFields')
assert.match(related, /handleDataChanged[\s\S]*?loadRelatedMetrics\(true\)/,
  '子表增删改后必须刷新统计')

for (const [key, labels] of [
  ['contacts', ['在职', '本月联系人', '联系人总量']],
  ['visits', ['有效跟进', '本月跟进', '跟进总量']],
  ['orders', ['待审批', '已审批', '订单总额', '本月订单']],
  ['devices', ['待安装', '使用中', '本月设备', '设备总量']],
  ['proposals', ['场所点位数量合计', '本月客户方案', '方案总量']],
  ['tasks', ['进行中', '已完结', '应收金额合计', '本月售后任务']],
  ['opportunities', ['预计金额合计', '本月商机', '商机总量']],
  ['serviceForms', ['本月服务', '信息已完善', '服务总量']]
]) {
  const start = business.indexOf(`${key}: ${key === 'tasks' ? '{' : 'native({'}`)
  assert.notEqual(start, -1, `缺少 ${key} 模块`)
  const end = business.indexOf(key === 'tasks' ? '\n  },' : '\n  }),', start)
  const moduleSource = business.slice(start, end)
  assert.match(moduleSource, /relatedMetrics:\s*\[/, `${key} 必须配置客户详情统计`)
  labels.forEach((label) => assert.ok(moduleSource.includes(`label: '${label}'`), `${key} 缺少“${label}”指标`))
}

assert.match(business, /proposals:[\s\S]*?aggregateField: 'ChangsuoDWSL'[\s\S]*?monthField: 'YujiHZSJ'/,
  '客户方案统计必须复用平台场所点位汇总和预计合作时间口径')
assert.match(business, /tasks:[\s\S]*?aggregateField: 'ShouhouFY'[\s\S]*?monthField: 'YujiSHSJ'/,
  '客户服务数据必须复用平台应收金额和计划服务时间口径')
assert.match(business, /opportunities:[\s\S]*?aggregateField: 'YujiJE'[\s\S]*?monthField: 'YujiHZSJ'/,
  '商机必须复用平台预计金额和预计合作时间口径')
assert.match(business, /serviceForms:[\s\S]*?monthField: 'KaishiSJ'[\s\S]*?Name: 'FuwuJLBSJ', Type: '<>'/,
  '客户服务记录必须复用平台开始时间和服务记录表数据完善口径')

console.log('客户详情关联 Tab 统计检查通过')
