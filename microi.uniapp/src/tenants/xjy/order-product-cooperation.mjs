// zhy：订单商品合作方式的价格联动与 PC 端 HezuoFS 字段值变更事件保持一致。
export function orderProductNumberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function fixedNumber(value) {
  const number = Number(value == null || value === '' ? 0 : value)
  if (!Number.isFinite(number) || number < 0) throw new Error('订单商品价格或数量无效')
  return Number(number.toFixed(2))
}

function safePercent(value, baseValue) {
  const base = orderProductNumberValue(baseValue)
  if (base <= 0) return 0
  const percent = orderProductNumberValue(value) / base * 100
  return Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0
}

// 按后台 SubmitBeforeServerV8 的 orderMoney 顺序：先将单价/数量保留两位，再计算总价及实价占原价百分比。
export function calculateOrderProductPriceBinding(form = {}) {
  const quantity = fixedNumber(form.Shuliang)
  const deviceActualUnitPrice = fixedNumber(form.ShebeiSJDJ)
  const filterActualUnitPrice = fixedNumber(form.LvxinSJDJ)

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
  let filterPrice = 0

  if (cooperation === '买断+包年换芯') {
    filterPrice = actualFilterPrice
  } else if (cooperation === '包年换芯') {
    deviceOriginalPrice = filterOriginalPrice
    devicePrice = 0
    filterPrice = actualFilterPrice
  } else if (['赠送', '试机'].includes(cooperation)) {
    devicePrice = 0
  } else if (cooperation === '租赁') {
    deviceOriginalPrice = rentalOriginalPrice
    devicePrice = rentalPrice
  }

  const values = {
    HezuoFSZ: cooperationKey,
    Yuanjia: deviceOriginalPrice,
    Xianjia: cooperation === '租赁' ? rentalPrice : buyoutPrice,
    ShijiJG: devicePrice,
    ShebeiSJDJ: devicePrice,
    LvxinYJ: filterOriginalPrice,
    LvxinSJDJ: filterPrice
  }
  return { ...values, ...calculateOrderProductPriceBinding({ ...form, ...values, Shuliang: quantity }) }
}

export function orderProductChargesFilters(form = {}) {
  return form.RenewalChargeMode === 'Service' || ['包年换芯', '买断+包年换芯'].includes(form.HezuoFS)
}

export function normalizedOrderProductPrices(form = {}) {
  const deviceFree = form.RenewalChargeMode === 'Service' || ['包年换芯', '赠送', '试机'].includes(form.HezuoFS)
  const values = {
    ShebeiSJDJ: deviceFree ? 0 : fixedNumber(form.ShebeiSJDJ),
    LvxinSJDJ: orderProductChargesFilters(form) ? fixedNumber(form.LvxinSJDJ) : 0
  }
  const derived = calculateOrderProductPriceBinding({ ...form, ...values })
  return { ...values, ShijiJG: values.ShebeiSJDJ, ...derived }
}

// 分页和权限由调用方提供；失败、缺列、截断都不能冒充零元或商品参考原价。
export function orderProductFilterQuote(rows) {
  let total = 0
  const fingerprint = rows.map(row => {
    const value = row?.YouhuiHLXZJ
    if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new Error('滤芯明细价格不完整，请刷新后重试')
    }
    total += Math.round(Number(value) * 100)
    return [row.Id || '', Number(value), row.GenghuanZQ, row.MeinianGHLXSL, row.LvxinDJ, row.YouhuiFD]
  }).map(value => JSON.stringify(value)).sort().join('|')
  return { total: total / 100, fingerprint }
}

// 每个表单独享会话。所有异步结果检查记录、合作方式及代次，不能回写已退出/已切换的页面。
export function createOrderProductPricing({ loadProduct, loadFilters, loadRecord, notify = () => {} }) {
  let current, form = {}, version = 0, pending = null, error = '', inputError = '', disposed = false
  let baseline, saved = null, manualFilter = false, manualDevice = false
  const signature = value => JSON.stringify([value.Id, value.DingdanID, value.ShangpinID, value.HezuoFS, value.RenewalChargeMode])
  const observe = context => { current = context; form = { ...context.form } }
  const patch = values => {
    form = { ...form, ...values }
    current.form = form
    current.patchForm(values)
  }
  const present = () => {
    try { const values = normalizedOrderProductPrices(form); inputError = ''; patch(values) }
    catch (failure) { inputError = failure.message }
  }
  const busy = () => pending ? '正在核对商品价格，请稍候' : error || inputError

  async function refresh(context, { reset = false, cooperationKey, preserveFilter = false } = {}) {
    observe(context)
    if (disposed) return
    if (pending && !reset) return pending
    const request = ++version, key = signature(form), snapshot = { ...form }
    if (reset) { if (!preserveFilter) manualFilter = false; manualDevice = false }
    error = ''
    const isCurrent = () => !disposed && request === version && key === signature(form)
    // 先设置 pending，再开始 I/O；保存钩子不依赖 UI 按钮是否及时刷新。
    const task = Promise.resolve().then(async () => {
      try {
        const [record, filters, product] = await Promise.all([
          loadRecord(context, snapshot),
          orderProductChargesFilters(snapshot) ? loadFilters(context, snapshot) : Promise.resolve([]),
          reset ? loadProduct(context, snapshot) : Promise.resolve(null)
        ])
        if (!isCurrent()) return
        const quote = orderProductFilterQuote(filters)
        if (reset) {
          const values = calculateOrderProductCooperation({ cooperation: snapshot.HezuoFS, cooperationKey,
            form, product, filterActualUnitPrice: quote.total })
          // 查询期间新输入的人工报价优先；数量也使用最新值，不能回退到发起请求时的快照。
          if (manualFilter || preserveFilter) values.LvxinSJDJ = form.LvxinSJDJ
          if (manualDevice) values.ShebeiSJDJ = form.ShebeiSJDJ
          patch(values)
        } else {
          const values = {}
          const sameMode = record && record.HezuoFS === form.HezuoFS &&
            String(record.RenewalChargeMode || '') === String(form.RenewalChargeMode || '')
          if (sameMode) {
            for (const name of ['Xianjia', 'Yuanjia', 'LvxinYJ']) {
              if (record[name] != null && record[name] !== '' && (!saved || record[name] !== saved[name])) values[name] = record[name]
            }
            // 初次以服务端已保存报价回显；后续只接收真正变化的服务端单价，不覆盖本页未保存报价。
            for (const [name, manual] of [['LvxinSJDJ', manualFilter], ['ShebeiSJDJ', manualDevice]]) {
              if (!manual && record[name] != null && record[name] !== '' && (!saved || record[name] !== saved[name])) values[name] = record[name]
            }
          }
          if (!manualFilter && orderProductChargesFilters(form) &&
            ((baseline !== undefined && baseline !== quote.fingerprint) || form.LvxinSJDJ == null || form.LvxinSJDJ === '')) {
            values.LvxinSJDJ = quote.total
          }
          patch(values)
        }
        baseline = quote.fingerprint
        saved = record ? { ...record } : saved
        present()
      } catch (failure) {
        if (!isCurrent()) return
        error = failure.message || failure.Msg || '商品价格核对失败，请刷新或重新选择合作方式'
        notify(error)
      } finally {
        if (request === version) pending = null
      }
    })
    pending = task
    return task
  }

  function change(context, name, value) {
    observe(context)
    form[name] = value
    if (name === 'LvxinSJDJ') manualFilter = true
    if (name === 'ShebeiSJDJ') manualDevice = true
    present()
  }

  async function prepare(context) {
    observe(context)
    if (disposed) throw new Error('表单已关闭，请重新打开')
    if (busy()) throw new Error(busy())
    await refresh(context)
    if (busy()) throw new Error(busy())
    for (const name of ['Shuliang', 'ShebeiSJDJ', 'LvxinSJDJ']) {
      if (!Number.isFinite(Number(form[name] ?? 0)) || Number(form[name] ?? 0) < 0) throw new Error('价格和设备数量须为有效的非负数')
    }
    return { LvxinYJ: form.LvxinYJ, ...normalizedOrderProductPrices(form) }
  }

  return { refresh, change, prepare, busy, observe,
    dispose() { disposed = true; version += 1; pending = null } }
}
