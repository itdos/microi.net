import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import * as renewal from '../src/tenants/xjy/order-renewal.mjs'
import * as summary from '../src/tenants/xjy/order-summary.mjs'
import * as contract from '../src/tenants/xjy/order-contract.mjs'
import * as status from '../src/tenants/xjy/order-status.mjs'
import * as cooperation from '../src/tenants/xjy/order-product-cooperation.mjs'

const DRAFT_ID = '00000000-0000-4000-8000-000000000001'
const SOURCE_ID = '00000000-0000-4000-8000-000000000002'
const OTHER_SOURCE_ID = '00000000-0000-4000-8000-000000000003'
// 当前租户真实配置仅保存子表/菜单 Id，没有 TableChildTableName；Label 为空。
const FILTER_FIELD_ID = '4a0eaea0-ede9-4657-a5e4-22a5965b12a1'
const PRODUCT_TABLE_ID = '6e4d13a2-6015-4dc1-8f9e-194e79532bb8'
function productFilterField() {
  return {
    Id: FILTER_FIELD_ID, Name: 'SpLvXin', Label: '', component: 'TableChild',
    config: {
      TableChildTableId: 'ae0f4c0d-12d1-4e5b-9fe5-2cbc7c65c8d1',
      TableChildSysMenuId: 'ae485545-447a-4147-b886-8d48dc9ff101',
      TableChildSysMenuName: '订单商品滤芯表', TableChildFkFieldName: 'DingdanSPID',
      TableChild: { PrimaryTableFieldName: 'Id' }
    }
  }
}
const inheritedDefaults = {
  XinLDD: renewal.ORDER_RENEWAL_TYPE, XQDingdanID: SOURCE_ID, XQDingdanBH: 'OLD-001',
  KehuID: 'customer-1', KehuMC: '原客户', RenewalInitialized: 1, RenewalTermMonths: 12,
  HetongKSSJ: '2027-04-02', HetongJSSJ: '2028-04-01',
  FuwuKSSJ: '2027-04-02', FuwuJSSJ: '2028-04-01',
  LianxiR: '原联系人', LianxiDH: '13800000000', XiangxiDZ: '原地址'
}
const plain = value => JSON.parse(JSON.stringify(value))

function harness({ run, products = [], positions = [], getFormData, getTableData, draftRows, draftRecord } = {}) {
  const calls = [], reads = [], toasts = [], opened = [], writes = [], contexts = []
  const source = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export default/g, 'const exported =')
    .replace(/export (?=(?:async )?function|const)/g, '')
  // 只替换 I/O 与与本场景无关的扩展；续签、计价和合同日期使用实际业务模块。
  const hooks = vm.runInNewContext(`${source}; exported`, {
    ...renewal, ...summary, ...contract, ...status, ...cooperation,
    console, setTimeout, clearTimeout,
    uni: { showToast: value => toasts.push(value) },
    getUser: () => ({ Id: 'user-1', Name: '当前人员' }),
    getVerifiedCurrentUser: async () => ({ Id: 'user-1' }),
    normalizeUploadItems: value => Array.isArray(value) ? value : [],
    proposalCostFieldPresentation: () => null,
    installationPositionButtonVisible: () => false,
    findMenu: async () => ({ Id: 'order-menu' }),
    openForm: async params => opened.push(params),
    post: async () => ({ Code: 1, Data: {} }),
    V8: {
      ApiEngine: {
        Run: async (key, params) => {
          calls.push({ key, params: plain(params) })
          if (key === renewal.ORDER_RENEWAL_ENGINE && params.Action === 'DraftRecord') {
            if (draftRecord) return draftRecord(params)
            const ctx = contexts.find(item => item.rowId === params.Id)
            return { Code: 1, Data: { ...ctx?.form, Id: params.Id } }
          }
          if (key === renewal.ORDER_RENEWAL_ENGINE && params.Action === 'DraftRows') {
            if (draftRows) return draftRows(params)
            const rows = params.TableName === 'diy_dingdansp' ? products : positions
            const start = (params._PageIndex - 1) * params._PageSize
            return { Code: 1, Data: rows.slice(start, start + params._PageSize), DataCount: rows.length }
          }
          if (run) return run(key, params)
          if (key === renewal.ORDER_DRAFT_ENGINE) return { Code: 1, Data: { Status: params.Action === 'Cancel' ? 'Cancelled' : 'Active' } }
          if (key === renewal.ORDER_RENEWAL_ENGINE) return { Code: 1, Data: { Defaults: { ...inheritedDefaults } } }
          throw new Error(`未声明的接口调用 ${key}`)
        },
        RunLegacy: async () => { throw new Error('本场景不应生成新设备编号') }
      },
      FormEngine: {
        GetFormData: getFormData || (async () => ({ Code: 1, Data: {} })),
        UptFormData: async (table, values) => { writes.push({ table, values: plain(values) }); return { Code: 1 } },
        GetTableData: async (table, params) => {
          reads.push({ table, params: plain(params) })
          if (getTableData) return getTableData(table, params)
          return { Code: 1, Data: table === 'diy_dingdansp' ? products : positions }
        }
      }
    }
  })
  function context({ tableName = 'Diy_Dingdan', mode = 'Add', form = {}, defaults = {}, rowId = '' } = {}) {
    const ctx = {
      tableName, mode, rowId, draftRowId: mode === 'Add' ? DRAFT_ID : '',
      menuId: 'order-menu', state: hooks.createState(),
      defaultValues: { ...defaults }, form: { Id: DRAFT_ID, ...defaults, ...form },
      definition: { table: { Id: PRODUCT_TABLE_ID }, fields: [], layoutFields: [],
        childFields: [productFilterField()], groups: [] }
    }
    ctx.patchForm = values => Object.assign(ctx.form, values)
    contexts.push(ctx)
    return ctx
  }
  return { hooks, context, calls, reads, toasts, opened, writes }
}

test('真实新增订单草稿 Id 先 Begin 再 Initialize，并展示完整可调整的合同资料', async () => {
  const h = harness({ products: [{ Id: 'new-product', HezuoFS: '买断+包年换芯' }] })
  const ctx = h.context({ defaults: { XinLDD: renewal.ORDER_RENEWAL_TYPE, XQDingdanID: SOURCE_ID, KehuID: 'customer-1' } })
  await h.hooks.initialize(ctx)
  assert.deepEqual(h.calls.filter(call => call.params.Action !== 'DraftRows').map(call => [call.key, call.params.Action]), [
    [renewal.ORDER_DRAFT_ENGINE, 'Begin'], [renewal.ORDER_RENEWAL_ENGINE, 'Initialize']
  ])
  assert.equal(h.calls[0].params.DingdanID, DRAFT_ID)
  assert.equal(h.calls[1].params.DingdanID, DRAFT_ID)
  assert.equal(h.calls[1].params.SourceOrderId, SOURCE_ID)
  assert.equal(ctx.form.HetongKSSJ, '2027-04-02')
  assert.equal(ctx.form.LianxiR, '原联系人')
  assert.equal(ctx.state.orderDraftReady, true)
  assert.equal(h.hooks.getFieldPresentation(ctx, { Name: 'KehuMC' }).readonly, true)
  for (const Name of ['HetongKSSJ', 'HetongJSSJ', 'FuwuKSSJ', 'FuwuJSSJ', 'LianxiR', 'LianxiDH']) {
    assert.notEqual(h.hooks.getFieldPresentation(ctx, { Name }).readonly, true, `${Name} 应允许微调`)
  }
  assert.equal(h.hooks.getBusyMessage(ctx), '')
})

test('返回同一新增表单时不重复初始化，不覆盖已微调的日期与联系人', async () => {
  const h = harness(), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  Object.assign(ctx.form, { FuwuKSSJ: '2027-05-01', FuwuJSSJ: '2028-04-30', LianxiR: '修改后联系人' })
  await h.hooks.initialize(ctx)
  assert.equal(h.calls.filter(call => call.params.Action === 'Initialize').length, 1)
  assert.equal(ctx.form.FuwuKSSJ, '2027-05-01')
  assert.equal(ctx.form.FuwuJSSJ, '2028-04-30')
  assert.equal(ctx.form.LianxiR, '修改后联系人')
})

test('初始化响应丢失后服务端已完成，重试仍补齐尚未回填的合同资料', async () => {
  const h = harness({ run: async (key) => key === renewal.ORDER_DRAFT_ENGINE
    ? { Code: 1, Data: { Status: 'Active' } }
    : { Code: 1, Data: { AlreadyInitialized: true, Defaults: { ...inheritedDefaults } } } })
  const ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  assert.equal(ctx.form.RenewalInitialized, 1)
  assert.equal(ctx.form.KehuMC, '原客户')
  assert.equal(ctx.form.FuwuKSSJ, '2027-04-02')
})

test('保存显式带出隐藏来源 Id，并保留当前日期、联系人和合同独立结束日', async () => {
  const h = harness(), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  Object.assign(ctx.form, {
    RenewalTermMonths: 6, FuwuKSSJ: '2027-06-01', FuwuJSSJ: '2027-11-30',
    HetongKSSJ: '2027-05-28', HetongJSSJ: '2027-12-03', LianxiR: '新联系人', LianxiDH: '13900000000'
  })
  const values = await h.hooks.beforeSubmit(ctx)
  for (const name of ['XQDingdanID', 'XQDingdanBH', 'KehuID', 'RenewalInitialized', 'RenewalTermMonths',
    'FuwuKSSJ', 'FuwuJSSJ', 'HetongKSSJ', 'HetongJSSJ', 'LianxiR', 'LianxiDH']) {
    assert.equal(values[name], ctx.form[name], `${name} 应采用当前表单值`)
  }
  assert.equal(h.calls.at(-1).params.Action, 'Touch')
})

test('普通新增只登记草稿，不误触发续签资料复制', async () => {
  const h = harness(), ctx = h.context()
  await h.hooks.initialize(ctx)
  assert.equal(ctx.form.XinLDD, '老客户新增订单')
  assert.equal(h.calls.filter(call => call.params.Action === 'Initialize').length, 0)
  assert.equal(ctx.form.RenewalInitialized, undefined)
  const values = await h.hooks.beforeSubmit(ctx)
  assert.equal(values.XQDingdanBH, '')
})

test('列表新增未选客户时完整初始化，选客户后才读取受控草稿明细', async () => {
  let boundCustomer = ''
  const h = harness({
    run: async (key, params) => {
      assert.equal(key, renewal.ORDER_DRAFT_ENGINE)
      boundCustomer = params.KehuID || boundCustomer
      return { Code: 1, Data: { Status: 'Active' } }
    },
    getFormData: async () => ({ Code: 1, Data: { Id: 'customer-2', KehuMC: '新客户', LianxiR: '联系人' } }),
    // 对齐后端的客户前置条件，防止宽松的空数组夹具掩盖真实加载错误。
    draftRows: () => boundCustomer
      ? { Code: 1, Data: [{ Id: 'product-1', HezuoFS: '租赁' }], DataCount: 1 }
      : { Code: 0, Msg: '订单草稿尚未确定客户' }
  })
  const ctx = h.context()
  await h.hooks.initialize(ctx)
  assert.equal(ctx.state.orderInitialized, true)
  assert.equal(ctx.state.orderDraftReady, true)
  assert.equal(h.calls.filter(call => call.params.Action === 'Begin').length, 1)
  assert.equal(h.calls.filter(call => call.params.Action === 'DraftRows').length, 0)
  assert.equal(h.hooks.getRelatedPresentation(ctx, { Name: 'DingdanSP' }).visible, false)
  assert.deepEqual(plain(ctx.state.orderSummaryValues), summary.orderSummaryValues([], []))

  await h.hooks.handleFieldSelect(ctx, {
    field: { Name: 'KehuMC' }, option: { raw: { Id: 'customer-2' } }, value: '新客户'
  })
  await h.hooks.refreshDerivedValues(ctx)
  assert.equal(ctx.form.KehuID, 'customer-2')
  assert.equal(ctx.form.LianxiR, '联系人')
  assert.equal(ctx.form.DingdanHZFS, '租赁')
  assert.notEqual(h.hooks.getRelatedPresentation(ctx, { Name: 'DingdanSP' }).visible, false)
  assert.ok(h.calls.some(call => call.params.Action === 'DraftRows'))
  assert.equal(h.reads.length, 0, '草稿明细保持走受控接口')
})

test('客户详情新增仍读取草稿，真实权限错误继续阻止初始化', async () => {
  for (const accepted of [true, false]) {
    const h = harness({ draftRows: () => accepted
      ? { Code: 1, Data: [], DataCount: 0 }
      : { Code: 0, Msg: '订单草稿不属于当前账号' } })
    const ctx = h.context({ defaults: { KehuID: 'customer-1', KehuMC: '已有客户' } })
    if (accepted) {
      await h.hooks.initialize(ctx)
      assert.equal(ctx.form.KehuID, 'customer-1')
      assert.equal(ctx.state.orderInitialized, true)
    } else {
      await assert.rejects(h.hooks.initialize(ctx), /不属于当前账号/)
      assert.equal(ctx.state.orderSummaryValues, null)
    }
    assert.ok(h.calls.some(call => call.params.Action === 'DraftRows'))
    assert.equal(h.reads.length, 0)
  }
})

test('编辑已保存续签合同不重开草稿、不重新复制，待审批日期仍可调整', async () => {
  const h = harness(), ctx = h.context({ mode: 'Edit', rowId: DRAFT_ID, form: {
    ...inheritedDefaults, DingdanZTZ: 1, FuwuJSSJ: '2028-07-12'
  } })
  await h.hooks.initialize(ctx)
  await h.hooks.beforeSubmit(ctx)
  assert.equal(h.calls.length, 0)
  assert.equal(ctx.form.FuwuJSSJ, '2028-07-12')
  assert.notEqual(h.hooks.getFieldPresentation(ctx, { Name: 'FuwuJSSJ' }).readonly, true)
  ctx.form.DingdanZTZ = 2
  assert.equal(h.hooks.getFieldPresentation(ctx, { Name: 'FuwuJSSJ' }).readonly, true)
})

test('沿用安装位置不生成设备新号，保留真实设备/IoT 并隐藏三种改绑动作', async () => {
  const h = harness(), ctx = h.context({ tableName: 'diy_shebeiwz', form: {
    DeviceUseType: 'Reuse', ReuseKehuSBID: 'actual-device', SourcePositionID: 'source-position',
    ShangpinBH: 'KEEP-DEVICE-001', DingdanSPID: 'new-product', ShangpinID: 'sku-1',
    IoTDeviceId: 'actual-iot', IoTDeviceNames: '原 IoT', AnzhuangWZ_Lng: 121, AnzhuangWZ_Lat: 29
  } })
  await h.hooks.initialize(ctx)
  assert.equal(h.calls.length, 0)
  assert.equal(ctx.form.ShangpinBH, 'KEEP-DEVICE-001')
  for (const Name of ['XuanzeIoT', 'XinzengIoT', 'JiechuIoT']) {
    assert.equal(h.hooks.getFieldPresentation(ctx, { Name }).visible, false)
  }
  assert.equal(h.hooks.getFieldPresentation(ctx, { Name: 'ShangpinBH' }).readonly, true)
  const values = await h.hooks.beforeSubmit(ctx)
  for (const name of ['ReuseKehuSBID', 'SourcePositionID', 'ShangpinBH', 'IoTDeviceId']) assert.equal(values[name], ctx.form[name])
})

test('沿用买断设备 Service 模式不再计硬件价，滤芯费用保持可编辑并按数量计算', async () => {
  const h = harness(), ctx = h.context({ tableName: 'diy_dingdansp', mode: 'Edit', rowId: 'new-product', form: {
    RenewalSourceSPID: 'old-product', RenewalChargeMode: 'Service', Shuliang: 3,
    ShebeiSJDJ: 2000, ShijiJG: 2000, LvxinSJDJ: 150, LvxinYJ: 200
  } })
  await h.hooks.initialize(ctx)
  assert.equal(ctx.form.ShebeiSJDJ, 0)
  assert.equal(ctx.form.ShijiJG, 0)
  assert.equal(ctx.form.LvxinSJDJ, 150)
  assert.equal(ctx.form.LvxinZJ, 450)
  assert.equal(h.hooks.getFieldPresentation(ctx, { Name: 'ShebeiSJDJ' }).readonly, true)
  assert.equal(h.hooks.getFieldPresentation(ctx, { Name: 'LvxinSJDJ' }).readonly, false)
  ctx.form.LvxinSJDJ = 125
  const values = await h.hooks.beforeSubmit(ctx)
  assert.equal(values.LvxinZJ, 375)
  assert.equal(values.ShebeiSJDJ, 0)
  assert.equal(values.RenewalSourceSPID, 'old-product')
})

test('普通新增切换续签并选择原订单后动态初始化，来源客户保持服务器返回值', async () => {
  const h = harness(), ctx = h.context()
  await h.hooks.initialize(ctx)
  ctx.form.XinLDD = renewal.ORDER_RENEWAL_TYPE
  const result = await h.hooks.handleFieldSelect(ctx, { field: { Name: 'XQDingdanBH' }, option: {
    raw: { Id: SOURCE_ID, DingdanBH: 'OLD-001', KehuID: 'client-forged-customer' }
  }, value: 'OLD-001' })
  assert.equal(result.handled, true)
  assert.equal(ctx.form.XQDingdanID, SOURCE_ID)
  assert.equal(ctx.form.KehuID, 'customer-1')
  assert.equal(ctx.form.RenewalInitialized, 1)
  assert.equal(h.calls.filter(call => call.params.Action === 'Initialize').length, 1)
  await assert.rejects(h.hooks.handleFieldSelect(ctx, { field: { Name: 'KehuMC' }, option: {
    raw: { Id: 'other-customer' }
  } }), /不能更换客户/)
})

test('已初始化后拒绝更换原订单，拒绝时保持既有来源及已调整资料', async () => {
  const h = harness(), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  ctx.form.FuwuJSSJ = '2029-04-01'
  await assert.rejects(h.hooks.handleFieldSelect(ctx, { field: { Name: 'XQDingdanBH' }, option: {
    raw: { Id: OTHER_SOURCE_ID, DingdanBH: 'OTHER-002' }
  }, value: 'OTHER-002' }), /不能更换原订单/)
  assert.equal(ctx.form.XQDingdanID, SOURCE_ID)
  assert.equal(ctx.form.XQDingdanBH, 'OLD-001')
  assert.equal(ctx.form.FuwuJSSJ, '2029-04-01')
  assert.equal(ctx.state.orderDraftReady, true)
})

test('沿用设备查看按钮只打开真实客户设备详情，不新建或改绑设备', async () => {
  const h = harness(), ctx = h.context({ tableName: 'diy_shebeiwz', mode: 'Edit', form: {
    DeviceUseType: 'Reuse', ReuseKehuSBID: 'actual-device'
  } })
  const field = { Name: 'YulanSBXQ' }
  const action = h.hooks.getFieldActions(ctx, field)[0]
  assert.equal(action.disabled, false)
  await h.hooks.runFieldAction(ctx, field, action)
  assert.equal(h.opened.length, 1)
  assert.deepEqual(plain(h.opened[0]), {
    table: 'Diy_KehuSB', rowId: 'actual-device', mode: 'View', title: '沿用设备详情', menuId: 'order-menu'
  })
  assert.equal(h.calls.length, 0)
})

test('续签草稿商品与位置通过受控接口分页读取，完整汇总超过一页的明细', async () => {
  const products = Array.from({ length: 101 }, (_, index) => ({ Id: `product-${index}`, HezuoFS: '包年换芯' }))
  const positions = Array.from({ length: 102 }, (_, index) => ({ DingdanSPID: products[index % 101].Id,
    ShangpinID: 'sku-1', ShangpinXH: 'RO', AnzhuangWZ: '一楼' }))
  const h = harness({ products, positions }), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  const reads = h.calls.filter(call => call.params.Action === 'DraftRows')
  assert.deepEqual(reads.map(call => [call.params.TableName, call.params._PageIndex]), [
    ['diy_dingdansp', 1], ['diy_dingdansp', 2], ['diy_shebeiwz', 1], ['diy_shebeiwz', 2]
  ])
  assert.ok(reads.every(call => call.params.DingdanID === DRAFT_ID && call.params._PageSize === 100))
  assert.equal(h.reads.length, 0, '未保存合同明细不能回退普通父表权限查询')
  assert.equal(ctx.form.ShebeiAZWZ, 'RO/一楼 * 102')
})

test('草稿明细接口失败或超限保留错误，不把续签商品汇总伪装为空', async () => {
  for (const result of [
    { Code: 0, Msg: '无草稿读取权限' },
    { Code: 1, Data: [], DataAppend: { UseNativeQuery: true } },
    { Code: 1, Data: [], DataCount: 1001 }
  ]) {
    const h = harness({ draftRows: () => result }), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
    await assert.rejects(h.hooks.initialize(ctx), /权限|读取失败|明细过多/)
    assert.equal(ctx.state.orderSummaryValues, null)
    assert.equal(h.reads.length, 0)
  }
})

test('续签来源初始化失败可重试，未完成期间拒绝保存，成功后恢复', async () => {
  let attempts = 0
  const h = harness({ run: async (key, params) => {
    if (key === renewal.ORDER_DRAFT_ENGINE) return { Code: 1, Data: { Status: 'Active' } }
    if (++attempts === 1) return { Code: 0, Msg: '原设备 IoT 关系不一致' }
    return { Code: 1, Data: { Defaults: { ...inheritedDefaults } } }
  } })
  const ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await assert.rejects(h.hooks.initialize(ctx), /IoT 关系不一致/)
  assert.equal(ctx.state.orderDraftReady, false)
  assert.equal(ctx.state.orderDraftLoading, false)
  assert.equal(ctx.state.orderInitialized, false)
  await assert.rejects(h.hooks.beforeSubmit(ctx), /未完成初始化/)
  await h.hooks.initialize(ctx)
  assert.equal(attempts, 2)
  assert.equal(h.calls.filter(call => call.params.Action === 'Begin').length, 1)
  assert.equal(ctx.state.orderDraftReady, true)
  await h.hooks.beforeSubmit(ctx)
})

test('续约月数和开始日期联动正确，并允许手动保留不同合同区间', async () => {
  const h = harness(), ctx = h.context({ form: {
    ...inheritedDefaults, RenewalTermMonths: 1, FuwuKSSJ: '2028-01-31', HetongKSSJ: '2028-01-31'
  } })
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'RenewalTermMonths' }, value: 1 })
  assert.equal(ctx.form.FuwuJSSJ, '2028-02-28')
  assert.equal(ctx.form.HetongJSSJ, '2028-02-28')
  ctx.form.HetongKSSJ = '2028-01-01'
  ctx.form.HetongJSSJ = '2028-12-31'
  ctx.form.FuwuKSSJ = '2028-02-29'
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'FuwuKSSJ' }, value: '2028-02-29' })
  assert.equal(ctx.form.FuwuJSSJ, '2028-03-28')
  assert.equal(ctx.form.HetongJSSJ, '2028-12-31')
})

test('退出未保存表单只取消当前草稿；保存成功后退出不发送 Cancel', async () => {
  for (const committed of [false, true]) {
    const h = harness(), ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
    await h.hooks.initialize(ctx)
    if (committed) await h.hooks.afterSubmit(ctx)
    h.hooks.dispose(ctx)
    await new Promise(resolve => setImmediate(resolve))
    const cancelled = h.calls.filter(call => call.params.Action === 'Cancel')
    assert.equal(cancelled.length, committed ? 0 : 1)
    if (cancelled.length) assert.equal(cancelled[0].params.DingdanID, DRAFT_ID)
    assert.equal(h.calls.some(call => /iot|bind|unlink/i.test(call.key)), false)
  }
})

test('服务器拒绝续期时不伪装保存成功，草稿仍能取消释放', async () => {
  const h = harness({ run: async (key, params) => {
    if (key === renewal.ORDER_RENEWAL_ENGINE) return { Code: 1, Data: { Defaults: { ...inheritedDefaults } } }
    if (params.Action === 'Touch') return { Code: 0, Msg: '草稿已过期' }
    return { Code: 1, Data: { Status: params.Action === 'Cancel' ? 'Cancelled' : 'Active' } }
  } })
  const ctx = h.context({ defaults: { XQDingdanID: SOURCE_ID } })
  await h.hooks.initialize(ctx)
  await assert.rejects(h.hooks.beforeSubmit(ctx), /草稿已过期/)
  h.hooks.dispose(ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.at(-1).params.Action, 'Cancel')
})

test('安装位置数量回调通过草稿代理更新商品，并保持 Service 硬件价为零', async () => {
  const h = harness({ run: async (key, params) => {
    assert.equal(key, renewal.ORDER_RENEWAL_ENGINE)
    assert.equal(params.Action, 'DraftSave')
    return { Code: 1, Data: {}, DataAppend: { Draft: true } }
  } })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'order-product', form: {
    Shuliang: 8, RenewalSourceSPID: 'original-product', RenewalChargeMode: 'Service',
    ShebeiSJDJ: 2000, LvxinSJDJ: 99.95, LvxinYJ: 200
  } })
  const field = { Name: 'AnzhuangWZ', config: { TableChildTableName: 'diy_shebeiwz' } }
  await h.hooks.handleRelatedCount(ctx, { field, count: 2 })
  assert.equal(h.calls[0].params.Form.Shuliang, 2)
  assert.equal(h.calls[0].params.Form.ShebeiSJDJ, 0)
  assert.equal(h.calls[0].params.Form.ShijiJG, 0)
  assert.equal(h.calls[0].params.Form.LvxinZJ, 199.9)
  assert.equal(ctx.form.Shuliang, 2)
  assert.equal(ctx.form.ShebeiSJDJ, 0)
  assert.equal(h.writes.length, 0)
})

test('正式商品数量回调仅在服务器明确回原生分支后沿用原事件，代理拒绝时不回退', async () => {
  for (const accepted of [true, false]) {
    const h = harness({ run: async () => accepted
      ? { Code: 1, DataAppend: { UseNativeQuery: true } }
      : { Code: 0, Msg: '草稿不属于当前账号' } })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'saved-product', form: {
      Shuliang: 8, ShebeiSJDJ: 300, LvxinSJDJ: 50
    } })
    const operation = h.hooks.handleRelatedCount(ctx, {
      field: { Name: 'AnzhuangWZ', config: { TableChildTableName: 'diy_shebeiwz' } }, count: 3
    })
    if (accepted) {
      await operation
      assert.equal(h.writes.length, 1)
      assert.equal(h.writes[0].values._InvokeType, 'Client')
      assert.equal(h.writes[0].values.Id, 'saved-product')
      assert.equal(h.writes[0].values.Shuliang, 3)
      assert.equal(ctx.form.Zongjia, 900)
    } else {
      await assert.rejects(operation, /不属于当前账号/)
      assert.equal(h.writes.length, 0)
      assert.equal(ctx.form.Shuliang, 8)
    }
  }
})

test('普通新增选客户先通过 Touch 验证草稿归属，失败时不更新隐藏客户关联', async () => {
  for (const accepted of [true, false]) {
    const h = harness({
      getFormData: async () => ({ Code: 1, Data: { Id: 'customer-2', KehuMC: '新客户', LianxiR: '新联系人' } }),
      run: async (key, params) => {
        if (params.Action === 'Touch' && !accepted) return { Code: 0, Msg: '已有商品不能更换客户' }
        return { Code: 1, Data: { Status: 'Active' } }
      }
    })
    const ctx = h.context()
    await h.hooks.initialize(ctx)
    const operation = h.hooks.handleFieldSelect(ctx, {
      field: { Name: 'KehuMC' }, option: { raw: { Id: 'customer-2', KehuMC: '新客户' } }, value: '新客户'
    })
    if (accepted) {
      await operation
      assert.equal(ctx.form.KehuID, 'customer-2')
      assert.equal(ctx.form.LianxiR, '新联系人')
    } else {
      await assert.rejects(operation, /不能更换客户/)
      assert.equal(ctx.form.KehuID, undefined)
      assert.equal(ctx.form.LianxiR, undefined)
    }
    assert.ok(h.calls.some(call => call.params.Action === 'Touch' && call.params.KehuID === 'customer-2'))
  }
})

test('合作方式价格读取受控草稿耗材合计，Service 模式不会恢复原设备收费', async () => {
  const h = harness({
    draftRows: params => {
      assert.equal(params.TableName, 'diy_dingdansphc')
      assert.equal(params.ParentId, 'order-product')
      return { Code: 1, Data: [{ YouhuiHLXZJ: 99.9 }, { YouhuiHLXZJ: 100.1 }], DataCount: 2 }
    },
    getFormData: async () => ({ Code: 1, Data: { Yuanjia: 5000, Xianjia: 4000, ZulinYJ: 1000, ZulinXJ: 800, GenghuanLXJG: 300 } })
  })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'order-product', form: {
    DingdanID: DRAFT_ID, ShangpinID: 'sku', Shuliang: 3, HezuoFS: '买断+包年换芯',
    RenewalSourceSPID: 'old-product', RenewalChargeMode: 'Service'
  } })
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS', options: [
    { value: '买断+包年换芯', raw: { Key: 2 } }
  ] }, value: '买断+包年换芯' })
  assert.equal(ctx.form.LvxinSJDJ, 200)
  assert.equal(ctx.form.LvxinZJ, 600)
  assert.equal(ctx.form.ShebeiSJDJ, 0)
  assert.equal(ctx.form.Zongjia, 0)
  assert.equal(ctx.form.ShijiJG, 0)
  assert.equal(h.reads.length, 0)
  assert.equal(h.toasts.length, 0)
})

test('正式商品耗材仅在明确原生标志后回退查询，失败/超限不静默丢弃耗材', async () => {
  for (const result of [
    { Code: 1, DataAppend: { UseNativeQuery: true } },
    { Code: 0, Msg: '无耗材读取权限' },
    { Code: 1, Data: [], DataCount: 101 }
  ]) {
    const native = result.DataAppend?.UseNativeQuery === true
    const h = harness({
      draftRows: () => result,
      positions: [{ YouhuiHLXZJ: 100 }, { YouhuiHLXZJ: 20 }],
      getFormData: async () => ({ Code: 1, Data: { GenghuanLXJG: 300 } })
    })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'order-product', form: {
      DingdanID: DRAFT_ID, ShangpinID: 'sku', Shuliang: 2, HezuoFS: '包年换芯', LvxinSJDJ: 88
    } })
    await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS' }, value: '包年换芯' })
    if (native) {
      assert.equal(h.reads[0].table, 'diy_dingdansphc')
      assert.equal(h.reads[0].params._Where[0][2], 'order-product')
      assert.equal(ctx.form.LvxinSJDJ, 120)
      assert.equal(ctx.form.LvxinZJ, 240)
    } else {
      assert.equal(h.reads.length, 0)
      assert.equal(ctx.form.LvxinSJDJ, 88)
      assert.match(h.toasts.at(-1).title, /权限|明细未完整/)
      await assert.rejects(h.hooks.beforeSubmit(ctx), /权限|明细未完整/)
    }
  }
})

test('合同详情进入正式商品时使用真实 SpLvXin 配置，并保留无独立商品菜单的嵌套授权', async () => {
  for (const Label of ['', '订单商品滤芯表']) {
    const h = harness({
      draftRecord: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
      draftRows: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
      getFormData: async () => ({ Code: 1, Data: {
        Id: 'sp-1', HezuoFS: '包年换芯', LvxinSJDJ: 1210, LvxinYJ: 1930, ShebeiSJDJ: 0
      } }),
      getTableData: async () => ({ Code: 1, Data: [{ Id: 'f-1', YouhuiHLXZJ: 1210 }], DataCount: 1 })
    })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'View', rowId: 'sp-1', form: {
      ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '包年换芯', Shuliang: 1,
      LvxinSJDJ: 1210, LvxinYJ: 1930
    } })
    ctx.definition.childFields[0].Label = Label
    // 合同 -> 商品 -> 滤芯；商品页面可以仅通过上一级 TableChild 授权进入。
    ctx.menuId = ''
    ctx.tableChildAuth = { ParentFieldId: 'goods-field', ParentTableId: 'order-table',
      ParentSysMenuId: 'contract-menu', ParentRowId: DRAFT_ID, ParentValue: DRAFT_ID, ParentFormMode: 'View' }
    await h.hooks.initialize(ctx)
    assert.equal(h.toasts.length, 0)
    assert.equal(h.hooks.getBusyMessage(ctx), '')
    assert.equal(ctx.form.LvxinSJDJ, 1210)
    assert.equal(ctx.form.YouhuiFD, 62.69)
    assert.equal(h.reads.length, 1)
    assert.deepEqual(h.reads[0].params._TableChildAuth, {
      ParentFieldId: FILTER_FIELD_ID, ParentTableId: PRODUCT_TABLE_ID, ParentSysMenuId: '',
      ParentRowId: 'sp-1', ParentValue: 'sp-1', ParentFormMode: 'View', Parent: ctx.tableChildAuth
    })
    assert.deepEqual(h.reads[0].params._Where, [['DingdanSPID', '=', 'sp-1']])
  }
})

test('真实 HTTP 菜单投影不含行金额时读取后台统计合计，首次查看、切换和返回均不误报', async () => {
  let total = 1930
  const record = { Id: 'sp-1', HezuoFS: '包年换芯', LvxinSJDJ: 1930, LvxinYJ: 1930, ShebeiSJDJ: 0 }
  const h = harness({
    draftRecord: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
    draftRows: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
    getFormData: async table => ({ Code: 1, Data: table === 'diy_shangpin'
      ? { Xianjia: 1580, GenghuanLXJG: 1930 } : { ...record } }),
    // 与线上 HTTP 返回相同：菜单仅选了型号、名称、级数、周期、单价；行中没有 YouhuiHLXZJ。
    getTableData: async () => ({ Code: 1, DataCount: 5,
      DataAppend: { StatisticsFields: { LvxinZJ: total, YouhuiHLXZJ: total } },
      Data: [500, 60, 60, 150, 150].map((LvxinDJ, i) => ({
        Id: `f-${i}`, LvxinXH: '滤芯型号', LvxinMC: '滤芯名称', Paixu: i + 1,
        GenghuanZQ: i === 0 ? 24 : 3, LvxinDJ
      }))
    })
  })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'View', rowId: 'sp-1', form: {
    ...record, ShangpinID: 'sku', DingdanID: DRAFT_ID, Shuliang: 1
  } })
  await h.hooks.initialize(ctx)
  assert.equal(h.toasts.length, 0)
  assert.equal(h.hooks.getBusyMessage(ctx), '')
  assert.equal(ctx.form.LvxinSJDJ, 1930)
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS' }, value: '包年换芯' })
  assert.equal(ctx.form.LvxinSJDJ, 1930)
  assert.equal(ctx.form.YouhuiFD, 100)
  // 子表修改后后台已重算合计，返回及提交继续读取后台结果。
  total = 1210
  record.LvxinSJDJ = total
  await h.hooks.refreshDerivedValues(ctx)
  assert.equal(ctx.form.LvxinSJDJ, 1210)
  assert.equal(ctx.form.YouhuiFD, 62.69)
  assert.equal((await h.hooks.beforeSubmit(ctx)).LvxinZJ, 1210)
  assert.ok(h.reads.every(read => read.params._TableChildAuth.ParentFieldId === FILTER_FIELD_ID))
  assert.equal(h.toasts.length, 0)
})

test('后台滤芯统计为零有效，分页总计只用一次，统计缺失、无效、变化或截断均阻止保存', async () => {
  for (const scenario of ['zero', 'pages', 'missing', 'invalid', 'changed', 'truncated']) {
    const h = harness({
      draftRows: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
      getFormData: async () => ({ Code: 1, Data: { Xianjia: 1580, GenghuanLXJG: 1930 } }),
      getTableData: async (table, params) => {
        const page = params._PageIndex
        const rows = Array.from({ length: 101 }, (_, i) => ({ Id: `f-${i}`, LvxinDJ: 60, GenghuanZQ: 3 }))
        return { Code: 1, DataCount: 101,
          Data: scenario === 'truncated' ? rows.slice(0, 1) : rows.slice((page - 1) * 100, page * 100),
          DataAppend: { StatisticsFields: scenario === 'missing' ? {} : {
            YouhuiHLXZJ: scenario === 'zero' ? 0 : scenario === 'invalid' ? null : scenario === 'changed' && page === 2 ? 2000 : 1930
          } }
        }
      }
    })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'sp-1', form: {
      ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '包年换芯', Shuliang: 2, LvxinSJDJ: 1210
    } })
    await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS' }, value: '包年换芯' })
    if (scenario === 'zero' || scenario === 'pages') {
      const expected = scenario === 'zero' ? 0 : 1930
      assert.equal(ctx.form.LvxinSJDJ, expected)
      assert.equal(ctx.form.LvxinZJ, expected * 2)
      assert.equal(h.toasts.length, 0)
    } else {
      assert.equal(ctx.form.LvxinSJDJ, 1210)
      await assert.rejects(h.hooks.beforeSubmit(ctx), /价格|合计|变化|完整/)
    }
  }
})

test('滤芯字段、外键或父级授权不完整时仍拒绝查询，不借用安装位置或相似文案', async () => {
  for (const missing of ['field', 'foreign-key', 'parent']) {
    const h = harness({ draftRows: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }) })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'View', rowId: 'sp-1', form: {
      ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '包年换芯', Shuliang: 1, LvxinSJDJ: 1210
    } })
    if (missing === 'field') ctx.definition.childFields = [{ Id: 'positions-field', Name: 'AnzhuangWZ',
      Label: '滤芯明细安装位置', config: { TableChildTableId: 'positions-table', TableChildFkFieldName: 'DingdanSPID' } }]
    if (missing === 'foreign-key') ctx.definition.childFields[0].config.TableChildFkFieldName = 'OtherId'
    if (missing === 'parent') ctx.menuId = ''
    await h.hooks.initialize(ctx)
    assert.equal(h.reads.length, 0)
    assert.match(h.toasts.at(-1).title, /滤芯明细授权信息不完整/)
    assert.equal(ctx.form.LvxinSJDJ, 1210)
    await assert.rejects(h.hooks.beforeSubmit(ctx), /滤芯明细授权信息不完整/)
  }
})

test('正式订单耗材查询失败不能把1930原价替代1210实际价，保留完整父子授权', async () => {
  const h = harness({
    draftRows: () => ({ Code: 1, DataAppend: { UseNativeQuery: true } }),
    getTableData: async () => ({ Code: 0, Msg: '耗材读取失败' }),
    getFormData: async () => ({ Code: 1, Data: { Xianjia: 1580, GenghuanLXJG: 1930 } })
  })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'sp-1', form: {
    DingdanID: DRAFT_ID, ShangpinID: 'sku', HezuoFS: '包年换芯', Shuliang: 1, LvxinSJDJ: 1210
  } })
  ctx.tableChildAuth = { ParentRowId: 'customer-1' }
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS' }, value: '包年换芯' })
  assert.equal(ctx.form.LvxinSJDJ, 1210)
  assert.equal(h.reads[0].params._TableChildAuth.ParentFieldId, FILTER_FIELD_ID)
  assert.equal(h.reads[0].params._TableChildAuth.ParentRowId, 'sp-1')
  assert.equal(h.reads[0].params._TableChildAuth.Parent.ParentRowId, 'customer-1')
  await assert.rejects(h.hooks.beforeSubmit(ctx), /耗材读取失败/)
})

test('草稿耗材超过一页时完整累计，分页截断和重复均阻止保存', async () => {
  for (const broken of ['', 'truncated', 'duplicate']) {
    const rows = Array.from({ length: 101 }, (_, i) => ({ Id: `f-${i}`, YouhuiHLXZJ: 10 }))
    const h = harness({
      draftRows: params => ({ Code: 1, DataCount: 101,
        Data: broken === 'truncated' ? rows.slice(0, 1) : broken === 'duplicate'
          ? rows.slice(0, 100) : rows.slice((params._PageIndex - 1) * 100, params._PageIndex * 100) }),
      getFormData: async () => ({ Code: 1, Data: { GenghuanLXJG: 1930 } })
    })
    const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'sp-1', form: {
      ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '包年换芯', Shuliang: 1
    } })
    await h.hooks.handleFieldChange(ctx, { field: { Name: 'HezuoFS' }, value: '包年换芯' })
    if (broken) await assert.rejects(h.hooks.beforeSubmit(ctx), /未完整|重复/)
    else { assert.equal(ctx.form.LvxinSJDJ, 1010); assert.equal(h.hooks.getBusyMessage(ctx), '') }
  }
})

test('真实初始化钩子回源服务端报价，耗材返回刷新不会保留旧页面1930', async () => {
  let unit = 1210, amount = 1210
  const h = harness({
    draftRecord: async () => ({ Code: 1, Data: { Id: 'sp-1', HezuoFS: '包年换芯', LvxinSJDJ: unit, LvxinYJ: 1930, ShebeiSJDJ: 0 } }),
    draftRows: () => ({ Code: 1, Data: [{ Id: 'f-1', YouhuiHLXZJ: amount }], DataCount: 1 })
  })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'sp-1', form: {
    ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '包年换芯', Shuliang: 1, LvxinSJDJ: 1930, LvxinYJ: 1930
  } })
  await h.hooks.initialize(ctx)
  assert.equal(ctx.form.LvxinSJDJ, 1210)
  assert.equal(ctx.form.YouhuiFD, 62.69)
  unit = 1310; amount = 1310
  await h.hooks.refreshDerivedValues(ctx)
  assert.equal(ctx.form.LvxinSJDJ, 1310)
  assert.equal((await h.hooks.beforeSubmit(ctx)).LvxinZJ, 1310)
})

test('本次收费范围字段切换按后台保留原滤芯实际单价', async () => {
  const h = harness({ getFormData: async () => ({ Code: 1, Data: { Xianjia: 1580, GenghuanLXJG: 1930 } }),
    draftRows: () => ({ Code: 1, Data: [{ Id: 'f-1', YouhuiHLXZJ: 1210 }], DataCount: 1 }) })
  const ctx = h.context({ tableName: 'Diy_DingdanSP', mode: 'Edit', rowId: 'sp-1', form: {
    ShangpinID: 'sku', DingdanID: DRAFT_ID, HezuoFS: '买断+包年换芯', Shuliang: 1,
    RenewalSourceSPID: 'old-sp', RenewalChargeMode: 'Service', LvxinSJDJ: 999
  } })
  await h.hooks.handleFieldChange(ctx, { field: { Name: 'RenewalChargeMode' }, value: 'Service' })
  assert.equal(ctx.form.LvxinSJDJ, 999)
  assert.equal(ctx.form.ShebeiSJDJ, 0)
})
