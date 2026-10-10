import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const engine = fs.readFileSync(new URL(
  '../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎/未分类/移动端-选择方案提交(selectPlan).js',
  import.meta.url
), 'utf8')
const run = new Function('V8', engine)

function fixture({
  plan = { Id: 'plan-1', KehuID: 'customer-1', TenantId: 'tenant-1', FanganMC: '测试方案', AnzhuangCS: '157 客户一楼', Renshu: 10, ChangsuoDWSL: 0 },
  addResult = { Code: 1 } } = {}) {
  const writes = []
  const positions = [{ Id: 'existing', ShangpinXH: 'MODEL', AnzhuangWZ: '旧点位' }]
  const v8 = {
    Param: { Id: 'product-1', PlanIds: ['plan-1'] },
    CurrentUser: { TenantId: 'tenant-1' },
    FormEngine: {
      GetFormData(table) {
        if (table === 'Diy_DingdanSP') return { Code: 1, Data: { Id: 'product-1', DingdanID: 'draft-order-1', KehuID: 'customer-1', ShangpinID: 'goods-1', ShebeiBH: 'MODEL', TenantId: 'tenant-1' } }
        if (table === 'Diy_Dingdan') throw new Error('订单尚未保存时不得查询订单主表')
        throw new Error(`unexpected table ${table}`)
      },
      GetTableData(query) {
        if (query.FormEngineKey === 'diy_kehufaxx') return { Code: 1, Data: [plan], DataCount: 1 }
        if (query.FormEngineKey === 'diy_anzhuang_dw') throw new Error('PC 选择位置不查询方案点位子表')
        if (query.FormEngineKey === 'diy_shebeiwz') return { Code: 1, Data: [...positions], DataCount: positions.length }
        throw new Error(`unexpected table ${query.FormEngineKey}`)
      },
      AddFormDataBatch(batch) {
        writes.push({ kind: 'add', batch })
        if (addResult.Code === 1) batch.forEach((item, index) => positions.push({ Id: `new-${index}`, ...item._RowModel }))
        return addResult
      },
      UptFormData(value) { writes.push({ kind: 'update', value }); return { Code: 1 } }
    },
    ApiEngine: { Run(key, param) {
      assert.equal(key, 'create_unique_value')
      return { Code: 1, Data: param.Batch === 1 ? 'code-0' : Array.from({ length: param.Batch }, (_, i) => `code-${i}`) }
    } }
  }
  return { v8, writes }
}

test('157 客户方案点位汇总为 0 且订单尚未保存时，按 PC 按钮从方案主表生成位置', () => {
  const { v8, writes } = fixture()
  const result = run(v8)
  assert.equal(result.Code, 1)
  assert.equal(result.Data.AddedCount, 1)
  assert.equal(writes[0].batch.length, 1)
  assert.equal(writes[0].batch[0]._RowModel.DingdanSPID, 'product-1')
  assert.equal(writes[0].batch[0]._RowModel.AnzhuangWZ, '157 客户一楼')
  assert.equal(writes[0].batch[0]._RowModel.Renshu, 10)
  assert.equal(writes[1].value._RowModel.Shuliang, 2)
  assert.equal(writes[1].value._RowModel.ShebeiAZWZ, 'MODEL/旧点位,MODEL/157 客户一楼')
  assert.equal(JSON.parse(writes[1].value._RowModel.ShebeiAZWZArr).length, 2)
})

test('方案主表没有设备型号时仍按 PC 按钮选择位置', () => {
  const { v8, writes } = fixture({
    plan: { Id: 'plan-1', KehuID: 'customer-1', TenantId: 'tenant-1', AnzhuangCS: '旧方案场所', ChangsuoDWSL: 0 }
  })
  const result = run(v8)
  assert.equal(result.Code, 1)
  assert.equal(writes[0].batch[0]._RowModel.AnzhuangWZ, '旧方案场所')
})

test('跨客户方案与批量写入失败均不会报告成功', () => {
  const wrongCustomer = fixture({ plan: { Id: 'plan-1', KehuID: 'another-customer', FanganMC: '其他客户方案' } })
  assert.equal(run(wrongCustomer.v8).Code, 0)
  assert.equal(wrongCustomer.writes.length, 0)

  const failed = fixture({ addResult: { Code: 0, Msg: '写入失败' } })
  assert.deepEqual(run(failed.v8), { Code: 0, Msg: '写入失败' })
  assert.equal(failed.writes.some((entry) => entry.kind === 'update'), false)
})

test('小程序订单商品选择器调用专用接口并刷新安装位置', () => {
  const source = fs.readFileSync(new URL('../src/tenants/xjy/native-table.js', import.meta.url), 'utf8')
  assert.match(source, /parentTable === 'diy_dingdansp' && fieldName === 'XuanzeFA'/)
  assert.match(source, /callApiEngine\('selectPlan'/)
  assert.match(source, /table: 'diy_shebeiwz', parentId/)
})
