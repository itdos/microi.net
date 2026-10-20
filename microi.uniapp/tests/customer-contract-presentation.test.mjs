import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { buildCustomerContractCardLines, customerContractTotalsVisible } from '../src/tenants/xjy/customer-contract-totals.mjs'

const amounts = { status: 'ready', values: {
  Rental: { Current: 0, All: 12500.5 }, Buyout: { All: 300 }, AnnualFilter: { Current: 100, All: 200 }
} }

test('只有合作客户显示合同金额，客户类型不参与判断', () => {
  for (const Zhuangtai of ['目标客户', '意向客户', '合作中', '断约客户', '', null, undefined]) {
    assert.equal(customerContractTotalsVisible('Diy_Kehu', { Zhuangtai, KehuLX: '合作客户' }), false)
    assert.deepEqual(buildCustomerContractCardLines('Diy_Kehu', { Zhuangtai }), [])
  }
  for (const KehuLX of ['国企', '学校', '民企', undefined]) {
    assert.equal(customerContractTotalsVisible('DIY_KEHU', { Zhuangtai: '合作客户', KehuLX }), true)
  }
  assert.equal(customerContractTotalsVisible('Diy_Dingdan', { Zhuangtai: '合作客户' }), false)
  assert.equal(customerContractTotalsVisible('Diy_Kehu', null), false)
})

test('卡片保留三类金额及五个统计口径，真零值与缺失值清晰区分', () => {
  const row = { Id: 'a', Zhuangtai: '合作客户', __xjyContractTotals: amounts }
  const before = JSON.stringify(row)
  const lines = buildCustomerContractCardLines('Diy_Kehu', row)
  assert.deepEqual(lines.map(line => [line.label, line.value]), [
    ['租赁总价', '当前有效 ¥0.00 / 所有合同 ¥12,500.50'],
    ['买断总价', '所有合同 ¥300.00'],
    ['包年换芯总价', '当前有效 ¥100.00 / 所有合同 ¥200.00']
  ])
  assert.equal(new Set(lines.map(line => line.field)).size, 3)
  assert.ok(lines.every(line => line.maxLines === 3))
  assert.equal(JSON.stringify(row), before)
  const missing = buildCustomerContractCardLines('Diy_Kehu', { Zhuangtai: '合作客户' })
  assert.ok(missing.every(line => line.value.includes('未获取') && !line.value.includes('¥0.00')))
})

test('详情合同金额默认收起，非折叠用法保留原有展示', () => {
  const source = fs.readFileSync(new URL('../src/tenants/xjy/components/customer-contract-totals.vue', import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '').replace('export default', 'component =')
  const context = { buildCustomerContractGroups() {} }
  vm.runInNewContext(script, context)
  assert.equal(context.component.data.call({ collapsible: true }).expanded, false)
  assert.equal(context.component.data.call({ collapsible: false }).expanded, true)
})

test('实际列表把金额追加到同一字段列表，保留后台字段顺序和多行设置', () => {
  const source = fs.readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
  const method = source.slice(source.indexOf('cardLines(row) {'), source.indexOf('periodCount(item) {')).replace(/,\s*$/, '')
  const cardLines = vm.runInNewContext(`({${method}}).cardLines`, { buildCustomerContractCardLines, cardFieldKey: value => value })
  const row = { Zhuangtai: '合作客户', Address: '示例地址', __xjyContractTotals: amounts }
  const page = { config: { table: 'Diy_Kehu' }, baseConfig: { summaryField: 'Address', summaryLines: 2 },
    visibleLines: () => [{ field: 'Address', label: '详细地址' }], displayValue: item => item.Address }
  const lines = cardLines.call(page, row)
  assert.equal(lines.length, 4)
  assert.equal(lines[0].label, '详细地址')
  assert.equal(lines[0].value, '示例地址')
  assert.equal(lines[0].maxLines, 2)
  row.Zhuangtai = '目标客户'
  assert.equal(cardLines.call(page, row).length, 1)
})

test('实际详情随当前客户状态切换显隐', () => {
  const source = fs.readFileSync(new URL('../src/pages/business/detail.vue', import.meta.url), 'utf8')
  const method = source.match(/showCustomerContractTotals\(\)\s*\{[^}]+\}/)[0]
  const visible = vm.runInNewContext(`({${method}}).showCustomerContractTotals`, { customerContractTotalsVisible })
  const page = { moduleConfig: { table: 'Diy_Kehu' }, detail: {} }
  assert.equal(visible.call(page), false)
  page.detail = { Zhuangtai: '合作客户' }
  assert.equal(visible.call(page), true)
  page.detail = { Zhuangtai: '意向客户' }
  assert.equal(visible.call(page), false)
})
