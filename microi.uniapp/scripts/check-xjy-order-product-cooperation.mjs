import assert from 'node:assert/strict'
import { calculateOrderProductCooperation } from '../src/tenants/xjy/order-product-cooperation.mjs'

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

console.log('xjy order product cooperation checks passed')

