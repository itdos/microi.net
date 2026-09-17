import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import * as termination from '../src/tenants/xjy/contract-termination.mjs'

function context(mode = 'Add', defaults = {}) {
  const ctx = { tableName: termination.TERMINATION_TABLE, mode, defaultValues: defaults, form: {}, state: {}, menuId: 'termination-menu' }
  ctx.patchForm = (values) => Object.assign(ctx.form, values)
  return ctx
}
function hooks(scope = {}) {
  const source = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export default/g, 'const exported =').replace(/export (?=(?:async )?function|const)/g, '')
  return vm.runInNewContext(`${source}; exported`, { ...termination, ...scope, console, setTimeout, clearTimeout })
}
test('订单文本/结构值及多商品数量总价按后台口径汇总', () => {
  assert.deepEqual(termination.terminationOrderValues({ Id: 'o1', DingdanBH: 'DD1', KehuMC: { KehuMC: '学校' }, AllDingdanHZFS: '租赁' }),
    { DingdanID: 'o1', DingdanBH: 'DD1', KehuMC: '学校', KehuID: '', HezuoFS: '租赁' })
  assert.deepEqual(termination.terminationGoodsValues([{ ShangpinMC: 'A', Shuliang: '2', Zongjia: '40' }, { ShangpinMC: 'B', Shuliang: 4, Zongjia: 60 }]),
    { ShangpinMC: '1. A\n2. B', Shuliang: 6, ShijiJG: 100 })
})
test('旧商品结果不能覆盖后选订单，清空订单同时清空汇总', async () => {
  const ctx = context()
  let complete
  const first = termination.bindTerminationOrder(ctx, { Id: 'old' }, { FormEngine: { GetTableData: () => new Promise((r) => { complete = r }) } })
  await termination.bindTerminationOrder(ctx, { Id: 'new' }, { FormEngine: { GetTableData: async () => ({ Code: 1, Data: [{ ShangpinMC: '新商品', Shuliang: 2, Zongjia: 10 }] }) } })
  complete({ Code: 1, Data: [{ ShangpinMC: '旧商品', Shuliang: 9 }] })
  await first
  assert.equal(ctx.form.DingdanID, 'new')
  assert.equal(ctx.form.Shuliang, 2)
  await termination.bindTerminationOrder(ctx, {}, {})
  assert.equal(ctx.form.DingdanID, '')
  assert.equal(ctx.form.ShijiJG, 0)
})
test('商品失败和截断返回不允许静默使用旧汇总', async () => {
  for (const result of [{ Code: 0, Msg: '无权限' }, { Code: 1, Data: [], DataCount: 1001 }]) {
    await assert.rejects(termination.bindTerminationOrder(context(), { Id: 'o1' }, { FormEngine: { GetTableData: async () => result } }))
  }
})
test('独立新增/编辑/查看及订单来源新增均显示图标按钮，订单来源锁定编号', () => {
  const h = hooks()
  const field = { Name: 'DingdanXQ', Label: '查看订单详情' }
  for (const mode of ['Add', 'Edit', 'View']) {
    const ctx = context(mode)
    ctx.form.DingdanID = 'order-1'
    assert.equal(h.getFieldPresentation(ctx, field).visible, true)
    assert.equal(h.getFieldActions(ctx, field)[0].disabled, false)
  }
  const ctx = context('Add', { DingdanID: 'order-1' })
  ctx.form.DingdanID = 'order-1'
  assert.equal(h.getFieldPresentation(ctx, field).visible, true)
  assert.equal(h.getFieldActions(ctx, field)[0].disabled, false)
  assert.equal(h.getFieldPresentation(ctx, { Name: 'DingdanBH' }).readonly, true)
})
test('隐藏订单/客户外键随表单提交，缺订单阻止保存', async () => {
  const h = hooks()
  const ctx = context()
  await assert.rejects(h.beforeSubmit(ctx), /有效订单/)
  ctx.form = { DingdanID: 'o1', KehuID: 'c1' }
  const values = await h.beforeSubmit(ctx)
  assert.equal(values.DingdanID, 'o1')
  assert.equal(values.KehuID, 'c1')
})
test('订单来源新增回读真实订单并自动填充全部快照及申请人', async () => {
  let goodsCalls = 0
  const h = hooks({ getUser: () => ({ Name: '申请人' }), findMenu: async () => ({ Id: 'goods-menu' }),
    V8: { FormEngine: {
      GetFormData: async () => ({ Code: 1, Data: { Id: 'o1', DingdanBH: 'DD1', KehuMC: '学校', DingdanHZFS: '租赁' } }),
      GetTableData: async (table, params) => { goodsCalls++; assert.equal(params._SysMenuId, 'goods-menu');
        return { Code: 1, Data: [{ ShangpinMC: '设备', Shuliang: 6, Zongjia: 61000 }] } }
    } } })
  const ctx = context('Add', { DingdanID: 'o1' })
  await h.initialize(ctx)
  assert.equal(ctx.form.ShenqingKF, '申请人')
  assert.equal(ctx.form.KehuMC, '学校')
  assert.equal(ctx.form.ShangpinMC, '1. 设备')
  assert.equal(ctx.form.Shuliang, 6)
  const values = await h.beforeSubmit(ctx)
  assert.equal(values.ShijiJG, 61000)
  assert.equal(values.DingdanBH, 'DD1')
  assert.equal(ctx.state.terminationGoodsReady, true)
})
test('汇总尚未加载或失败时阻止保存，空商品返回和无效数字也有稳定结果', async () => {
  const ctx = context(); ctx.form.DingdanID = 'o1'; ctx.state.terminationGoodsReady = false
  await assert.rejects(hooks().beforeSubmit(ctx), /完整加载/)
  assert.deepEqual(termination.terminationGoodsValues([{ Shuliang: 'NaN', Zongjia: 'invalid' }]),
    { ShangpinMC: '1. ', Shuliang: 0, ShijiJG: 0 })
  await termination.bindTerminationOrder(ctx, { Id: 'o1' }, { FormEngine: { GetTableData: async () => ({ Code: 1, Data: [] }) } })
  assert.equal(ctx.state.terminationGoodsReady, true)
})
test('订单跳转新增使用后台新增权限，复核后传入订单默认值', async () => {
  let permission = false
  let opened
  const h = hooks({ findMenu: async () => ({ Id: 'menu' }), canAddMenuRecord: () => permission,
    getUser: () => ({ Id: 'u1' }), openForm: async (p) => { opened = p } })
  const ctx = context('View'); ctx.tableName = 'Diy_Dingdan'; ctx.form = { Id: 'o1', DingdanBH: 'DD1' }
  assert.equal(h.getFieldActions(ctx, { Name: 'DingdanBH' }).length, 0)
  await assert.rejects(h.runFieldAction(ctx, {}, { key: 'xjy-order-termination' }), /新增权限/)
  permission = true
  assert.equal(h.getFieldActions(ctx, { Name: 'DingdanBH' })[0].label, '断约申请')
  await h.runFieldAction(ctx, {}, { key: 'xjy-order-termination' })
  assert.equal(opened.defaultValues.DingdanID, 'o1')
  assert.equal(opened.menuId, 'menu')
})

test('独立申请选中订单行后联动快照，清空编号解除关联', async () => {
  const h = hooks({ findMenu: async () => ({ Id: 'goods-menu' }), V8: { FormEngine: {
    GetTableData: async (table, params) => {
      assert.equal(params._SysMenuId, 'goods-menu')
      assert.equal(params._Where[0][2], 'o1')
      return { Code: 1, Data: [{ ShangpinMC: '设备', Shuliang: 3, Zongjia: 120 }] }
    }
  } } })
  const ctx = context()
  await h.handleFieldSelect(ctx, { field: { Name: 'DingdanBH' }, option: {
    raw: { Id: 'o1', DingdanBH: 'DD1', KehuID: 'c1', KehuMC: '学校', DingdanHZFS: '租赁' }
  } })
  const values = await h.beforeSubmit(ctx)
  assert.equal(values.KehuID, 'c1')
  assert.equal(values.ShijiJG, 120)
  assert.equal(values.Shuliang, 3)
  await h.handleFieldChange(ctx, { field: { Name: 'DingdanBH' }, value: '' })
  assert.equal(ctx.form.DingdanID, '')
  assert.equal(ctx.form.KehuMC, '')
  await assert.rejects(h.beforeSubmit(ctx), /有效订单/)
})

test('申请详情按钮使用真实订单授权菜单，无菜单权限时阻止跳转', async () => {
  let granted = false
  let opened
  const h = hooks({ findMenu: async () => granted ? { Id: 'order-menu' } : null,
    openForm: async (params) => { opened = params } })
  const ctx = context(); ctx.form = { DingdanID: 'o1', KehuMC: '学校' }
  const action = { key: 'xjy-termination-order-detail' }
  await assert.rejects(h.runFieldAction(ctx, {}, action), /查看权限/)
  granted = true
  await h.runFieldAction(ctx, {}, action)
  assert.equal(opened.rowId, 'o1')
  assert.equal(opened.menuId, 'order-menu')
  assert.equal(opened.mode, 'View')
  assert.equal(opened.fileMenuAliases[0], '合同订单')
  assert.equal(ctx.form.KehuMC, '学校')
})
