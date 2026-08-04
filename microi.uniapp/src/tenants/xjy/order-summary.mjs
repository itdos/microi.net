function text(value) {
  return String(value ?? '').trim()
}

export function uniqueCooperationValues(orderProducts = []) {
  const values = []
  ;(Array.isArray(orderProducts) ? orderProducts : []).forEach((item) => {
    const value = text(item && item.HezuoFS)
    if (value && !values.includes(value)) values.push(value)
  })
  return values
}

// 对齐订单表单 InFormV8：按“商品 + 安装位置”分组，每条设备位置记录计数一次。
export function installationPositionText(positions = []) {
  const groups = []
  ;(Array.isArray(positions) ? positions : []).forEach((item) => {
    const productId = text(item && item.ShangpinID)
    const position = text(item && item.AnzhuangWZ)
    const model = text(item && item.ShangpinXH)
    const existing = groups.find((group) =>
      group.productId === productId && group.position === position
    )
    if (existing) {
      existing.count += 1
    } else {
      groups.push({ productId, position, model, count: 1 })
    }
  })
  return groups
    .map((item) => `${item.model}/${item.position} * ${item.count}`)
    .join('\n')
}

export function orderSummaryValues(orderProducts = [], positions = []) {
  const cooperation = uniqueCooperationValues(orderProducts)
  return {
    DingdanHZFS: cooperation.join(','),
    AllDingdanHZFS: cooperation,
    ShebeiAZWZ: installationPositionText(positions)
  }
}

export function orderSummarySubmitValues(values = {}) {
  return {
    DingdanHZFS: text(values.DingdanHZFS),
    AllDingdanHZFS: JSON.stringify(
      Array.isArray(values.AllDingdanHZFS) ? values.AllDingdanHZFS : []
    ),
    ShebeiAZWZ: text(values.ShebeiAZWZ)
  }
}
