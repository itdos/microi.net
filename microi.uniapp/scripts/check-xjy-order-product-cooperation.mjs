import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  calculateOrderProductCooperation,
  calculateOrderProductPriceBinding
} from '../src/tenants/xjy/order-product-cooperation.mjs'

const product = {
  Yuanjia: 2000,
  Xianjia: 1700,
  ZulinYJ: 500,
  ZulinXJ: 400,
  GenghuanLXJG: 300
}
const form = { Shuliang: 2 }

const buyout = calculateOrderProductCooperation({ cooperation: '买断', cooperationKey: 1, form, product })
assert.equal(buyout.Xianjia, 1700)
assert.equal(buyout.Zongjia, 3400)
assert.equal(buyout.LvxinSJDJ, 0)

const combined = calculateOrderProductCooperation({
  cooperation: '买断+包年换芯', cooperationKey: 3, form, product, filterActualUnitPrice: 240
})
assert.equal(combined.ShebeiSJDJ, 1700)
assert.equal(combined.LvxinSJDJ, 240)
assert.equal(combined.LvxinZJ, 480)
assert.equal(combined.YouhuiFD, 80)

const filterOnly = calculateOrderProductCooperation({
  cooperation: '包年换芯', cooperationKey: 4, form, product, filterActualUnitPrice: 240
})
assert.equal(filterOnly.ShebeiSJDJ, 0)
assert.equal(filterOnly.Zongjia, 0)
assert.equal(filterOnly.LvxinZJ, 480)

const rental = calculateOrderProductCooperation({ cooperation: '租赁', cooperationKey: 2, form, product })
assert.equal(rental.Xianjia, 400)
assert.equal(rental.Zongjia, 800)

const zeroBase = calculateOrderProductCooperation({
  cooperation: '买断+包年换芯', form, product: { ...product, GenghuanLXJG: 0 }, filterActualUnitPrice: 240
})
assert.equal(zeroBase.YouhuiFD, 0)

assert.deepEqual(calculateOrderProductPriceBinding({
  Shuliang: 6,
  Xianjia: 11000,
  ShebeiSJDJ: 9000,
  LvxinYJ: 2180,
  LvxinSJDJ: 1360
}), {
  ShebeiYHFD: 81.82,
  Zongjia: 54000,
  YouhuiFD: 62.39,
  LvxinZJ: 8160
})

assert.deepEqual(calculateOrderProductPriceBinding({
  Shuliang: '3',
  Xianjia: 0,
  ShebeiSJDJ: '',
  LvxinYJ: 0,
  LvxinSJDJ: '100.125'
}), {
  ShebeiYHFD: 0,
  Zongjia: 0,
  YouhuiFD: 0,
  LvxinZJ: 300.38
})

const formSource = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
assert.match(formSource, /\['shuliang', 'shebeisjdj', 'lvxinsjdj'\]/)
assert.match(formSource, /calculateOrderProductPriceBinding\(context\.form\)/)
assert.match(formSource, /\.\.\.priceValues,\s*_InvokeType: 'Client'/)

console.log('xjy order product cooperation checks passed')
