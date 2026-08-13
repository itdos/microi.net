import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const detail = fs.readFileSync(path.join(root, 'src/pages/business/detail.vue'), 'utf8')
const business = fs.readFileSync(path.join(root, 'src/tenants/xjy/business.js'), 'utf8')

assert.match(business, /orders:\s*native\(\{[\s\S]*?table:\s*'Diy_Dingdan'[\s\S]*?fixedWhere:\s*\[\{ Name: 'DingdanZT', Type: '!=', Value: '已作废' \}\][\s\S]*?statisticsField:\s*'DingdanJE'/,
  '订单模块必须以 DingdanJE 汇总并排除已作废订单')
assert.match(detail, /label:\s*'订单'[\s\S]{0,260}?key:\s*'customer-order-amount'[\s\S]{0,260}?label:\s*'综合评价'/,
  '金额指标必须位于订单与综合评价之间')
assert.match(detail, /loadCustomerRelationMetrics\(\)[\s\S]*?extraWhere:\s*\[\{ Name: 'KehuID', Type: '=', Value: customerId \}\]/,
  '金额统计必须按当前客户 Id 限定订单范围')
assert.match(detail, /statisticsFieldValue\(orderSummary\.value\.append, 'DingdanJE', 0\)/,
  '金额统计必须读取后端全量 StatisticsFields，不得累加当前分页')
assert.match(detail, /metrics = \[\{[\s\S]*?key: 'customer-device-count'[\s\S]*?key: 'customer-order-count'[\s\S]*?key: 'customer-order-amount'[\s\S]*?label: '综合评价'/,
  '后台 ViewSchema 覆盖默认指标时仍应固定设备、订单、金额、综合评价顺序')
assert.match(detail, /gridTemplateColumns: `repeat\(\$\{heroMetrics\.length\}, minmax\(0, 1fr\)\)`/,
  'Hero 指标布局必须按实际指标数量自适应')

assert.doesNotMatch(detail, /label: '设备',\s*field: 'ShebeiSL'/,
  '客户设备数量不能继续读取未可靠回写的主表冗余字段')
assert.doesNotMatch(detail, /label: '订单',\s*field: 'DingdanSL'/,
  '客户订单数量不能继续读取未可靠回写的主表冗余字段')
assert.match(detail, /Promise\.allSettled\(\[[\s\S]*?loadSummary\('devices'\)[\s\S]*?loadSummary\('orders'\)/,
  '客户详情必须并行实时统计设备和订单模块')
assert.match(detail, /values\['customer-device-count'\][\s\S]*?deviceSummary\.value\.count/,
  '设备指标必须使用设备模块的全量 DataCount')
assert.match(detail, /values\['customer-order-count'\][\s\S]*?orderSummary\.value\.count/,
  '订单指标必须使用订单模块的全量 DataCount')

console.log('客户订单金额总和指标检查通过')
