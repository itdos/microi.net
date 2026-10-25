import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrderProductPricing, normalizedOrderProductPrices } from '../src/tenants/xjy/order-product-cooperation.mjs'

const product = { Yuanjia: 1580, Xianjia: 1580, ZulinYJ: 1500, ZulinXJ: 1500, GenghuanLXJG: 1930 }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))

// 与 Vue 页面一致：每次钩子得到新 context，patchForm 替换整个 form 对象，不原地修改旧快照。
function setup(extra = {}) {
  let form = { Id: 'sp-1', DingdanID: 'order-1', ShangpinID: 'sku-1', HezuoFS: '包年换芯',
    Shuliang: 1, Xianjia: 1580, ShebeiSJDJ: 0, LvxinYJ: 1930, LvxinSJDJ: 1210, ...extra }
  const data = { record: { ...form }, filters: [300, 300, 60, 300, 250].map((value, i) => ({ Id: `f-${i}`, YouhuiHLXZJ: value })) }
  const notifications = [], patches = []
  const io = { loadRecord: async () => ({ ...data.record }), loadFilters: async () => data.filters, loadProduct: async () => product }
  const session = createOrderProductPricing({ loadRecord: (...args) => io.loadRecord(...args),
    loadFilters: (...args) => io.loadFilters(...args), loadProduct: (...args) => io.loadProduct(...args),
    notify: message => notifications.push(message) })
  const context = () => ({ rowId: form.Id, mode: 'Edit', form, patchForm: values => {
    patches.push(values); form = { ...form, ...values }
  } })
  const change = (name, value) => { form = { ...form, [name]: value }; session.change(context(), name, value) }
  const mode = async value => { form = { ...form, HezuoFS: value }; return session.refresh(context(), { reset: true, cooperationKey: 4 }) }
  return { session, data, io, context, change, mode, notifications, patches, get form() { return form } }
}

test('首次打开读取服务端1210，折扣统一为62.69%，不把原价1930当实际价', async () => {
  // 模拟新页面带入旧缓存，尚未有本次人工修改。
  const fresh = setup({ LvxinSJDJ: 1930 }); fresh.data.record.LvxinSJDJ = 1210
  await fresh.session.refresh(fresh.context())
  assert.equal(fresh.form.LvxinSJDJ, 1210)
  assert.equal(fresh.form.LvxinZJ, 1210)
  assert.equal(fresh.form.YouhuiFD, 62.69)
})

test('保留服务端已保存的人工报价，并按同一公式计算折扣', async () => {
  const h = setup({ LvxinSJDJ: 1100 })
  await h.session.refresh(h.context())
  const values = await h.session.prepare(h.context())
  assert.equal(values.LvxinSJDJ, 1100)
  assert.equal(values.YouhuiFD, 56.99)
})

test('报价未返回时阻止保存，返回后才提交1210', async () => {
  const h = setup({ LvxinSJDJ: 300 }), request = deferred()
  h.io.loadProduct = () => request.promise
  const pending = h.mode('包年换芯')
  assert.match(h.session.busy(), /核对/)
  await assert.rejects(h.session.prepare(h.context()), /核对/)
  request.resolve(product); await pending
  assert.equal((await h.session.prepare(h.context())).LvxinSJDJ, 1210)
})

test('查询失败不替价且阻止保存，重新核对成功后恢复', async () => {
  const h = setup({ LvxinSJDJ: 300 })
  h.io.loadFilters = async () => { throw new Error('无耗材权限') }
  await h.mode('包年换芯')
  assert.equal(h.form.LvxinSJDJ, 300)
  await assert.rejects(h.session.prepare(h.context()), /权限/)
  h.io.loadFilters = async () => h.data.filters
  await h.mode('包年换芯')
  assert.equal(h.form.LvxinSJDJ, 1210)
  assert.equal(h.session.busy(), '')
})

test('连续切换后迟到的旧成功和旧失败均不能覆盖最后一次报价', async () => {
  for (const failed of [false, true]) {
    const h = setup(), first = deferred(); let calls = 0
    h.io.loadProduct = () => ++calls === 1 ? first.promise : Promise.resolve(product)
    const previous = h.mode('包年换芯'); await tick()
    await h.mode('租赁')
    if (failed) first.reject(new Error('old error')); else first.resolve(product)
    await previous
    assert.equal(h.form.ShebeiSJDJ, 1500)
    assert.equal(h.form.LvxinSJDJ, 0)
    assert.equal(h.session.busy(), '')
    assert.equal(h.notifications.length, 0)
  }
})

test('报价期间修改数量及人工单价，以最新输入计价', async () => {
  const h = setup(), request = deferred(); h.io.loadProduct = () => request.promise
  const pending = h.mode('买断+包年换芯'); await tick()
  h.change('Shuliang', 3); h.change('LvxinSJDJ', 1000); h.change('ShebeiSJDJ', 1400)
  request.resolve(product); await pending
  assert.equal(h.form.LvxinSJDJ, 1000)
  assert.equal(h.form.LvxinZJ, 3000)
  assert.equal(h.form.Zongjia, 4200)
})

test('修改耗材后返回，刷新合计，旧页面保存不会覆盖新价', async () => {
  const h = setup(); await h.session.refresh(h.context())
  h.data.filters[0].YouhuiHLXZJ = 400
  h.data.record.LvxinSJDJ = 1310
  const values = await h.session.prepare(h.context())
  assert.equal(h.form.LvxinSJDJ, 1310)
  assert.equal(values.LvxinSJDJ, 1310)
  assert.equal(values.LvxinZJ, 1310)
})

test('本次明确人工改价后，耗材刷新保留该报价', async () => {
  const h = setup(); await h.session.refresh(h.context())
  h.change('LvxinSJDJ', 999)
  h.data.filters[0].YouhuiHLXZJ = 400; h.data.record.LvxinSJDJ = 1310
  assert.equal((await h.session.prepare(h.context())).LvxinSJDJ, 999)
})

test('仅服务、包年、赠送、试机均不会恢复设备收费', async () => {
  for (const mode of ['包年换芯', '赠送', '试机']) {
    const h = setup(); await h.mode(mode)
    assert.equal(h.form.ShebeiSJDJ, 0)
    assert.equal(h.form.Zongjia, 0)
  }
  const h = setup({ RenewalSourceSPID: 'original', RenewalChargeMode: 'Service' })
  await h.mode('买断+包年换芯')
  assert.equal(h.form.ShebeiSJDJ, 0)
  assert.equal(h.form.LvxinSJDJ, 1210)
})

test('空明细是真实零价，缺失或非法金额则拒绝保存', async () => {
  const h = setup(); h.data.filters = []; await h.mode('包年换芯')
  assert.equal(h.form.LvxinSJDJ, 0)
  for (const value of [undefined, null, '', -1, 'wrong']) {
    const invalid = setup(); invalid.data.filters = [{ Id: 'f-1', YouhuiHLXZJ: value }]
    await invalid.mode('包年换芯')
    await assert.rejects(invalid.session.prepare(invalid.context()), /价格不完整/)
  }
})

test('离开页面后迟到响应不会回写，也不能继续保存', async () => {
  const h = setup(), request = deferred(); h.io.loadProduct = () => request.promise
  const pending = h.mode('包年换芯'); await tick()
  h.session.dispose(); const count = h.patches.length
  request.resolve(product); await pending
  assert.equal(h.patches.length, count)
  await assert.rejects(h.session.prepare(h.context()), /关闭/)
})

test('设备款和滤芯款分别乘数量，折扣基数为零时不出现无穷大', () => {
  const values = normalizedOrderProductPrices({ HezuoFS: '买断+包年换芯', Shuliang: 2,
    Xianjia: 0, LvxinYJ: 0, ShebeiSJDJ: 1580, LvxinSJDJ: 1210 })
  assert.equal(values.Zongjia, 3160); assert.equal(values.LvxinZJ, 2420)
  assert.equal(values.ShebeiYHFD, 0); assert.equal(values.YouhuiFD, 0)
})

test('严格沿用后台单价先保留两位的顺序，不由小程序另算折扣或精度', () => {
  const values = normalizedOrderProductPrices({ HezuoFS: '买断+包年换芯', Shuliang: 3,
    Xianjia: 1580, LvxinYJ: 1930, ShebeiSJDJ: 100.125, LvxinSJDJ: 100.125 })
  assert.equal(values.ShebeiSJDJ, 100.13)
  assert.equal(values.LvxinSJDJ, 100.13)
  assert.equal(values.Zongjia, 300.39)
  assert.equal(values.LvxinZJ, 300.39)
  assert.equal(values.YouhuiFD, 5.19)
})

test('无效人工报价阻止保存，改回有效值后恢复', async () => {
  const h = setup(); await h.session.refresh(h.context())
  h.change('LvxinSJDJ', -1)
  await assert.rejects(h.session.prepare(h.context()), /无效/)
  h.change('LvxinSJDJ', 1200)
  assert.equal((await h.session.prepare(h.context())).LvxinSJDJ, 1200)
})

test('切换续签收费范围沿用后台规则保留滤芯报价，仅调整硬件收费', async () => {
  const h = setup({ HezuoFS: '买断+包年换芯', RenewalSourceSPID: 'old', RenewalChargeMode: 'Original', LvxinSJDJ: 999 })
  await h.session.refresh(h.context())
  h.change('RenewalChargeMode', 'Service')
  await h.session.refresh(h.context(), { reset: true, preserveFilter: true })
  assert.equal(h.form.ShebeiSJDJ, 0)
  assert.equal(h.form.LvxinSJDJ, 999)
  h.change('RenewalChargeMode', 'Original')
  await h.session.refresh(h.context(), { reset: true, preserveFilter: true })
  assert.equal(h.form.ShebeiSJDJ, 1580)
  assert.equal(h.form.LvxinSJDJ, 999)
})
