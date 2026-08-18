// zhy：订单商品合作方式的价格联动与 PC 端 HezuoFS 字段值变更事件保持一致。
export function orderProductNumberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function fixedNumber(value) {
  return Number(orderProductNumberValue(value).toFixed(2))
}

function safePercent(value, baseValue) {
  const base = orderProductNumberValue(baseValue)
  if (base === 0) return 0
  const percent = orderProductNumberValue(value) / base * 100
  return Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0
}

// zhy：与 PC 端实际单价字段 V8 事件保持一致，集中计算设备、滤芯的优惠幅度与数量总价。
export function calculateOrderProductPriceBinding(form = {}) {
  const quantity = orderProductNumberValue(form.Shuliang)
  const deviceActualUnitPrice = orderProductNumberValue(form.ShebeiSJDJ)
  const filterActualUnitPrice = orderProductNumberValue(form.LvxinSJDJ)

  return {
    ShebeiYHFD: safePercent(deviceActualUnitPrice, form.Xianjia),
    Zongjia: fixedNumber(deviceActualUnitPrice * quantity),
    YouhuiFD: safePercent(filterActualUnitPrice, form.LvxinYJ),
    LvxinZJ: fixedNumber(filterActualUnitPrice * quantity)
  }
}

export function calculateOrderProductCooperation({
  cooperation = '',
  cooperationKey = '',
  form = {},
  product = {},
  filterActualUnitPrice = 0
} = {}) {
  const quantity = orderProductNumberValue(form.Shuliang)
  const buyoutOriginalPrice = orderProductNumberValue(product.Yuanjia)
  const buyoutPrice = orderProductNumberValue(product.Xianjia)
  const rentalOriginalPrice = orderProductNumberValue(product.ZulinYJ)
  const rentalPrice = orderProductNumberValue(product.ZulinXJ)
  const filterOriginalPrice = orderProductNumberValue(product.GenghuanLXJG)
  const actualFilterPrice = orderProductNumberValue(filterActualUnitPrice)

  let deviceOriginalPrice = buyoutOriginalPrice
  let devicePrice = buyoutPrice
  let productActualPrice = buyoutPrice
  let filterPrice = 0

  if (cooperation === '买断+包年换芯') {
    filterPrice = actualFilterPrice
    productActualPrice += filterPrice
  } else if (cooperation === '包年换芯') {
    deviceOriginalPrice = filterOriginalPrice
    devicePrice = 0
    productActualPrice = 0
    filterPrice = actualFilterPrice
  } else if (cooperation !== '买断') {
    // 租赁、赠送、试机等其余方式与 PC 端一致，统一走租赁价格分支。
    deviceOriginalPrice = rentalOriginalPrice
    devicePrice = rentalPrice
    productActualPrice = rentalPrice
  }

  const values = {
    HezuoFSZ: cooperationKey,
    Yuanjia: deviceOriginalPrice,
    Xianjia: cooperation === '包年换芯' ? buyoutPrice : devicePrice,
    ShijiJG: productActualPrice,
    ShebeiSJDJ: devicePrice,
    LvxinYJ: filterOriginalPrice,
    LvxinSJDJ: filterPrice
  }
  return { ...values, ...calculateOrderProductPriceBinding({ ...form, ...values, Shuliang: quantity }) }
}
