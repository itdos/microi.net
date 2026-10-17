import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ORDER_RENEWAL_TYPE, ORDER_DRAFT_ENGINE, ORDER_RENEWAL_ENGINE,
  createOrderDraftLifecycle, isReusedInstallationPosition, isInitializedRenewalOrder,
  renewalDateValues, renewalFieldPresentation, renewalPositionSubmitValues,
  renewalProductPriceValues
} from '../src/tenants/xjy/order-renewal.mjs'

const orderId = '15a5a82b-69d1-421d-92a2-97ea0b65a4a1'
const sourceOrderId = '16a5a82b-69d1-421d-92a2-97ea0b65a4a1'
const otherSource = '17a5a82b-69d1-421d-92a2-97ea0b65a4a1'
const renewal = values => ({ XinLDD: ORDER_RENEWAL_TYPE, RenewalInitialized: 1, ...values })
const success = Data => ({ Code: 1, Data })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('续签日期按日历处理完整年、闰年和月末，合同独立起点保留', () => {
  assert.deepEqual(renewalDateValues(renewal({ FuwuKSSJ: '2027-04-02', HetongKSSJ: '2027-04-02', RenewalTermMonths: 12 })), { FuwuJSSJ: '2028-04-01', HetongJSSJ: '2028-04-01' })
  assert.deepEqual(renewalDateValues(renewal({ FuwuKSSJ: '2024-02-29', HetongKSSJ: '2024-03-01', RenewalTermMonths: 12 })), { FuwuJSSJ: '2025-02-27' })
  assert.deepEqual(renewalDateValues(renewal({ FuwuKSSJ: '2028-01-31', RenewalTermMonths: 1 })), { FuwuJSSJ: '2028-02-28' })
})

test('不规则续期留空允许手动日期，非法月数明确阻止计算', () => {
  assert.deepEqual(renewalDateValues(renewal({ FuwuKSSJ: '2027-04-02', RenewalTermMonths: null })), {})
  assert.deepEqual(renewalDateValues(renewal({ FuwuKSSJ: '2027-02-30', RenewalTermMonths: 12 })), {})
  assert.deepEqual(renewalDateValues({ FuwuKSSJ: '2027-04-02', RenewalTermMonths: 12 }), {})
  for (const months of [0, -1, 1.5, 121, 'bad']) assert.throws(() => renewalDateValues(renewal({ FuwuKSSJ: '2027-04-02', RenewalTermMonths: months })), /1 至 120/)
})

test('已初始化锁来源，待审批日期仍可编辑，审批后服务期只读', () => {
  const context = { tableName: 'Diy_Dingdan', mode: 'Add', form: renewal({ DingdanZTZ: 1 }) }
  assert.equal(isInitializedRenewalOrder(context.form), true)
  for (const field of ['KehuMC', 'KehuID', 'XinLDD', 'XQDingdanID']) assert.deepEqual(renewalFieldPresentation(context, field), { readonly: true })
  for (const field of ['FuwuKSSJ', 'FuwuJSSJ', 'HetongKSSJ', 'HetongJSSJ', 'LianxiR']) assert.deepEqual(renewalFieldPresentation(context, field), {})
  assert.deepEqual(renewalFieldPresentation({ ...context, mode: 'Edit', form: renewal({ DingdanZTZ: 2 }) }, 'FuwuJSSJ'), { readonly: true })
  assert.deepEqual(renewalFieldPresentation({ tableName: 'Diy_Dingdan', form: {} }, 'RenewalTermMonths'), { visible: false })
})

test('已买断设备仅服务模式清零硬件价，服务单价和数量调整仍计算费用', () => {
  const form = { RenewalSourceSPID: sourceOrderId, RenewalChargeMode: 'Service', ShebeiSJDJ: 8888, Zongjia: 8888, Shuliang: 2, LvxinSJDJ: 99.95 }
  assert.deepEqual(renewalProductPriceValues(form), { ShebeiSJDJ: 0, Zongjia: 0, ShijiJG: 0, ShebeiYHFD: 0, LvxinZJ: 199.9 })
  assert.deepEqual(renewalProductPriceValues({ ...form, RenewalChargeMode: 'Original' }), {})
  const context = { tableName: 'Diy_DingdanSP', mode: 'Edit', form }
  assert.deepEqual(renewalFieldPresentation(context, 'LvxinSJDJ'), { readonly: false })
  assert.deepEqual(renewalFieldPresentation(context, 'ShebeiSJDJ'), { readonly: true })
})

test('沿用位置保留设备编号和绑定快照，隐藏重复绑定动作但位置和联系人可编辑', () => {
  const form = { DingdanSPID: orderId, ShangpinBH: '157591531846393', ReuseKehuSBID: 'device-a', DeviceUseType: 'Reuse', SourcePositionID: 'point-a', IoTDeviceId: 'iot-a', IoTDeviceNames: '既有设备', AnzhuangWZ: '本次地址' }
  assert.equal(isReusedInstallationPosition(form), true)
  assert.equal(isReusedInstallationPosition({}), false)
  const context = { tableName: 'diy_shebeiwz', mode: 'Edit', form }
  for (const field of ['XuanzeIoT', 'XinzengIoT', 'JiechuIoT']) assert.deepEqual(renewalFieldPresentation(context, field), { visible: false })
  for (const field of ['ShangpinBH', 'IoTDeviceId', 'DeviceUseType']) assert.deepEqual(renewalFieldPresentation(context, field), { readonly: true })
  assert.deepEqual(renewalFieldPresentation(context, 'AnzhuangWZ'), {})
  const values = renewalPositionSubmitValues(form)
  assert.equal(values.ShangpinBH, form.ShangpinBH)
  assert.equal(values.ReuseKehuSBID, form.ReuseKehuSBID)
  assert.equal(values.IoTDeviceId, 'iot-a')
  assert.equal(values.AnzhuangWZ, undefined)
})

test('续签先登记草稿再初始化，用户业务修改后不再应用旧默认值', async () => {
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => {
    calls.push({ key, params })
    return key === ORDER_DRAFT_ENGINE ? success({ Status: 'Active' }) : success({ Defaults: { FuwuJSSJ: '2028-04-01' }, AlreadyInitialized: false })
  } })
  const args = { orderId, sourceOrderId, customerId: 'customer-a' }
  const first = await lifecycle.initialize(args)
  assert.deepEqual(calls.map(item => [item.key, item.params.Action]), [[ORDER_DRAFT_ENGINE, 'Begin'], [ORDER_RENEWAL_ENGINE, 'Initialize']])
  assert.equal(first.applyDefaults, true)
  assert.equal(first.defaults.FuwuJSSJ, '2028-04-01')
  const repeated = await lifecycle.initialize(args)
  assert.equal(repeated.applyDefaults, false)
  assert.deepEqual(repeated.defaults, {})
  assert.equal(calls.length, 2)
  await assert.rejects(() => lifecycle.initialize({ ...args, sourceOrderId: otherSource }), /不能更换原订单/)
})

test('服务端已经初始化时重开不会覆盖用户资料', async () => {
  const lifecycle = createOrderDraftLifecycle({ run: async key => key === ORDER_DRAFT_ENGINE ? success({ Status: 'Active' }) : success({ Defaults: { LianxiR: '旧联系人' }, AlreadyInitialized: true }) })
  const result = await lifecycle.initialize({ orderId, sourceOrderId, customerId: 'customer-a' })
  assert.equal(result.applyDefaults, false)
})

test('并发初始化只复制一次，返回者只能有一次应用默认值', async () => {
  const wait = deferred()
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => {
    calls.push(params.Action)
    if (key === ORDER_DRAFT_ENGINE) return success({ Status: 'Active' })
    await wait.promise
    return success({ Defaults: { FuwuKSSJ: '2027-04-02' }, AlreadyInitialized: false })
  } })
  const args = { orderId, sourceOrderId }
  const first = lifecycle.initialize(args)
  const second = lifecycle.initialize(args)
  wait.resolve()
  const results = await Promise.all([first, second])
  assert.equal(results.filter(result => result.applyDefaults).length, 1)
  assert.deepEqual(calls, ['Begin', 'Initialize'])
})

test('退出等初始化完成后取消，禁止已经关闭的草稿重新初始化', async () => {
  const wait = deferred()
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => {
    calls.push(params.Action)
    if (key === ORDER_RENEWAL_ENGINE) { await wait.promise; return success({ Defaults: {}, AlreadyInitialized: false }) }
    return success({ Status: params.Action === 'Cancel' ? 'Cancelled' : 'Active' })
  } })
  const initializing = lifecycle.initialize({ orderId, sourceOrderId })
  const cancelled = lifecycle.cancel(orderId)
  wait.resolve()
  await Promise.all([initializing, cancelled])
  assert.deepEqual(calls, ['Begin', 'Initialize', 'Cancel'])
  assert.equal(await lifecycle.cancel(orderId), null)
  await assert.rejects(() => lifecycle.initialize({ orderId, sourceOrderId }), /已关闭/)
})

test('正式保存后不再取消或续期，不另外发起 Commit 请求', async () => {
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => { calls.push(params.Action); return success({ Status: 'Active' }) } })
  await lifecycle.begin({ orderId })
  lifecycle.committed(orderId)
  assert.equal(await lifecycle.cancel(orderId), null)
  assert.equal(await lifecycle.touch({ orderId }), null)
  assert.deepEqual(calls, ['Begin'])
})

test('草稿登记网络失败仍可取消，初始化失败可重试且不提前设置成功状态', async () => {
  let attempt = 0
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => {
    calls.push(params.Action)
    if (params.Action === 'Begin' && !attempt++) throw new Error('网络中断')
    return success({ Status: params.Action === 'Cancel' ? 'Cancelled' : 'Active' })
  } })
  await assert.rejects(() => lifecycle.begin({ orderId }), /网络中断/)
  await lifecycle.cancel(orderId)
  assert.deepEqual(calls, ['Begin', 'Cancel'])
  let initialized = false
  const retry = createOrderDraftLifecycle({ run: async key => {
    if (key === ORDER_DRAFT_ENGINE) return success({ Status: 'Active' })
    if (!initialized) { initialized = true; return { Code: 0, Msg: '设备绑定有变化' } }
    return success({ Defaults: { RenewalInitialized: 1 }, AlreadyInitialized: false })
  } })
  await assert.rejects(() => retry.initialize({ orderId, sourceOrderId }), /设备绑定有变化/)
  assert.equal((await retry.initialize({ orderId, sourceOrderId })).applyDefaults, true)
})

test('客户变化通过 Touch 更新，已关闭或无效 Id 不允许继续录入', async () => {
  const calls = []
  const lifecycle = createOrderDraftLifecycle({ run: async (key, params) => { calls.push(params); return success({ Status: 'Active' }) } })
  await lifecycle.begin({ orderId, customerId: 'customer-a' })
  await lifecycle.begin({ orderId, customerId: 'customer-b' })
  assert.deepEqual(calls.map(item => [item.Action, item.KehuID]), [['Begin', 'customer-a'], ['Touch', 'customer-b']])
  await assert.rejects(() => lifecycle.begin({ orderId: 'wrong' }), /Id无效/)
  const closed = createOrderDraftLifecycle({ run: async () => success({ Status: 'Committed' }) })
  await assert.rejects(() => closed.initialize({ orderId, sourceOrderId }), /已关闭/)
})
