import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  emptyOrderAmountValues,
  installationPositionText,
  orderSummarySubmitValues,
  orderSummaryValues
} from '../src/tenants/xjy/order-summary.mjs'

const products = [
  { Id: 'op-1', HezuoFS: '买断+包年换芯' },
  { Id: 'op-2', HezuoFS: '租赁' },
  { Id: 'op-3', HezuoFS: '买断+包年换芯' }
]
const positions = [
  { ShangpinID: 'p-1', ShangpinXH: 'CXS-FR100', AnzhuangWZ: '三楼茶水间' },
  { ShangpinID: 'p-1', ShangpinXH: 'CXS-FR100', AnzhuangWZ: '三楼茶水间' },
  { ShangpinID: 'p-1', ShangpinXH: 'CXS-FR100', AnzhuangWZ: '一楼前台' }
]

assert.equal(
  installationPositionText(positions),
  'CXS-FR100/三楼茶水间 * 2\nCXS-FR100/一楼前台 * 1'
)
assert.deepEqual(orderSummaryValues(products, positions), {
  DingdanHZFS: '买断+包年换芯,租赁',
  AllDingdanHZFS: ['买断+包年换芯', '租赁'],
  ShebeiAZWZ: 'CXS-FR100/三楼茶水间 * 2\nCXS-FR100/一楼前台 * 1'
})
assert.deepEqual(orderSummarySubmitValues(orderSummaryValues(products, positions)), {
  DingdanHZFS: '买断+包年换芯,租赁',
  AllDingdanHZFS: '["买断+包年换芯","租赁"]',
  ShebeiAZWZ: 'CXS-FR100/三楼茶水间 * 2\nCXS-FR100/一楼前台 * 1'
})
assert.deepEqual(emptyOrderAmountValues(), {
  DingdanJE: 0,
  DingdanXJ: 0,
  YouhuiHHTZJ: 0,
  YouhuiFD: 0,
  HuanxinJE: 0
})

const formSource = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
const nativeFormSource = fs.readFileSync(new URL('../src/pages/native-form/index.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('../src/pages/business/detail.vue', import.meta.url), 'utf8')
assert.equal(formSource.includes('UptFormData(ORDER_TABLE'), false)
assert.equal(nativeFormSource.includes('refreshTenantFormDerivedValues(this.tenantFormContext())'), true)
assert.equal(detailSource.includes('refreshTenantFormDerivedValues(this.tenantDetailFormContext())'), true)

console.log('xjy order summary checks passed')
