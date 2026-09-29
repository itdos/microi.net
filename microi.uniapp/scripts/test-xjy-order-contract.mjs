import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  contractStateByEndDate,
  orderInitialCustomerDefaults,
  orderCustomerSourceValues
} from '../src/tenants/xjy/order-contract.mjs'

const v8Root = new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/', import.meta.url)

test('订单选择客户后完整带出联系人、地址和服务人员', () => {
  const city = ['浙江省', '杭州市', '滨江区']
  const values = orderCustomerSourceValues({
    Id: 'customer-1',
    KehuMC: '测试客户',
    LianxiR: '张三',
    LianxiDH: '13800000000',
    Chengshi: city,
    XiangxiDZ: '江南大道 1 号',
    FuzeR: '负责人',
    FuzeRID: 'owner-1',
    FuzeRDH: '13900000000',
    ZhuanshuKF: '客服甲',
    ZhuanshuKFID: 'service-1',
    ZhuanshuKFDH: '0571-10086',
    ShouhouRY: '售后乙',
    ShouhouRYID: 'after-sales-1',
    ShouhouRYDH: '13700000000'
  })

  assert.deepEqual(values, {
    customerId: 'customer-1', customerName: '测试客户',
    contact: '张三', contactPhone: '13800000000', city,
    address: '江南大道 1 号', owner: '负责人', ownerId: 'owner-1',
    ownerPhone: '13900000000', serviceAgent: '客服甲', serviceAgentId: 'service-1',
    serviceAgentPhone: '0571-10086', afterSales: '售后乙',
    afterSalesId: 'after-sales-1', afterSalesPhone: '13700000000'
  })
  assert.notEqual(values.city, city, '城市数组应复制，不能修改客户选择器原始行')
})

test('切换到字段不完整的客户时不会保留上一客户数据', () => {
  const values = orderCustomerSourceValues({ Id: 'customer-2', KehuMC: '新客户' })
  assert.equal(values.customerId, 'customer-2')
  assert.equal(values.contact, '')
  assert.equal(values.serviceAgentPhone, '')
  assert.equal(values.afterSales, '')

  const cleared = orderCustomerSourceValues({}, true)
  assert.ok(Object.values(cleared).every((value) => value === ''))
})

test('客户资料仅补充新增订单默认值，入口明确传值保持优先', () => {
  assert.deepEqual(orderInitialCustomerDefaults({
    ZhaunshuKF: '客户默认客服',
    ZhuanshuKFDH: '10086',
    ShouhouRY: '客户默认售后'
  }, {
    ZhaunshuKF: '订单指定客服'
  }), {
    ZhuanshuKFDH: '10086',
    ShouhouRY: '客户默认售后'
  })
})

test('合同结束日当天有效，次日转为已断约', () => {
  assert.equal(contractStateByEndDate('', '2026-09-14'), '未断约')
  assert.equal(contractStateByEndDate('2026-09-14', '2026-09-14'), '未断约')
  assert.equal(contractStateByEndDate('2026-09-15 23:59:59', '2026-09-14'), '未断约')
  assert.equal(contractStateByEndDate('2026-09-13 23:59:59', '2026-09-14'), '已断约')
})

test('移动端表单在选择、日期变化和提交三个阶段接入派生逻辑', () => {
  const source = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  assert.match(source, /orderCustomerSourceValues\(row, cleared\)/)
  assert.match(source, /ORDER_FIELDS\.contractEnd\.toLowerCase\(\)/)
  assert.match(source, /values\[orderFieldName\(context, 'contractState', '合同状态'\)\] = contractStateByEndDate/)
  assert.match(source, /首次打开时都按今天校准显示/)
  for (const field of [
    'LianxiR', 'LianxiDH', 'Chengshi', 'XiangxiDZ', 'ZhaunshuKF',
    'ZhuanshuKFDH', 'ShouhouRY', 'ShouhouRYDH'
  ]) assert.match(source, new RegExp(field))
})

test('订单人员选择覆盖客服和售后，并在清空时同步清理隐藏 Id 与电话', () => {
  const source = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  assert.match(source, /source:\s*ORDER_FIELDS\.serviceAgent[\s\S]*?id:\s*'serviceAgentId'[\s\S]*?phone:\s*'serviceAgentPhone'/)
  assert.match(source, /source:\s*ORDER_FIELDS\.afterSales[\s\S]*?id:\s*'afterSalesId'[\s\S]*?phone:\s*'afterSalesPhone'/)
  assert.match(source, /const personnel = ORDER_PERSONNEL_LINKS\.find/)
  assert.match(source, /if \(!isOrderAdd\(context\)\) return/)
})

test('订单新增和编辑保存均保留用户修改后的人员快照，不再被客户默认人员覆盖', () => {
  const eventSource = fs.readFileSync(new URL(
    '表单引擎/订单（Diy_Dingdan）/表单V8事件/后端表单提交前V8事件（SubmitBeforeServerV8）.js',
    v8Root
  ), 'utf8')
  for (const action of ['Insert', 'Upt']) {
    const form = {
      Id: `order-${action}`,
      KehuID: 'customer-1',
      ZhaunshuKF: '订单客服',
      ZhaunshuKFID: 'order-support',
      ZhuanshuKFDH: '18800000001',
      ShouhouRY: '订单售后',
      ShouhouRYID: 'order-service',
      ShouhouRYDH: '18800000002'
    }
    const v8 = {
      FormSubmitAction: action,
      Form: form,
      OldForm: { ...form },
      Param: {},
      DbTrans: {},
      CurrentUser: { TenantId: 'tenant-1', TenantName: '测试商家' },
      FormEngine: {
        GetFormData: () => ({ Code: 1, Data: {
          Id: 'customer-1',
          ZhuanshuKF: '客户客服',
          ZhuanshuKFID: 'customer-support',
          ShouhouRY: '客户售后',
          ShouhouRYID: 'customer-service'
        } }),
        GetTableData: () => ({ Code: 1, Data: [] })
      }
    }
    const outcome = new Function('V8', 'DateNow', eventSource)(v8, () => '2026-09-28')
    assert.equal(outcome, undefined)
    assert.equal(form.ZhaunshuKFID, 'order-support')
    assert.equal(form.ZhuanshuKFDH, '18800000001')
    assert.equal(form.ShouhouRYID, 'order-service')
    assert.equal(form.ShouhouRYDH, '18800000002')
  }
})

test('商品接口返回新订单商品快照，新增订单可在父表保存前即时回显', () => {
  const engineSource = fs.readFileSync(new URL(
    '接口引擎/未分类/订单商品提交(ordergoods).js',
    v8Root
  ), 'utf8')
  const batches = []
  const productFilterQueries = []
  const v8 = {
    Param: {
      KehuID: 'customer-1',
      DingdanID: 'draft-order-1',
      goods: [{ Id: 'product-1', ShangpinMC: '净水设备', ShangpinBH: 'FY-150', Xianjia: 1200 }]
    },
    CurrentUser: { TenantId: 'tenant-1', TenantName: '测试商家' },
    DbTrans: {},
    FormEngine: {
      GetTableData: (query) => {
        productFilterQueries.push(query)
        return { Code: 1, Data: [] }
      },
      AddFormDataBatch: (rows) => { batches.push(rows); return { Code: 1 } }
    },
    Result: null
  }
  new Function('V8', 'System', engineSource)(v8, { Guid: { NewGuid: () => 'order-product-1' } })
  assert.equal(batches.length, 1)
  assert.equal(batches[0][0].Id, 'order-product-1')
  assert.equal(batches[0][0]._RowModel.Id, 'order-product-1')
  assert.equal(v8.Result.Code, 1)
  assert.equal(v8.Result.Data[0].DingdanID, 'draft-order-1')
  assert.equal(v8.Result.Data[0].ShangpinID, 'product-1')
  assert.equal(productFilterQueries[0]._Where[0].Value, 'product-1')

  const nativeTableSource = fs.readFileSync(new URL('../src/tenants/xjy/native-table.js', import.meta.url), 'utf8')
  assert.match(nativeTableSource, /const createdRows = Array\.isArray\(result\.Data\)/)
  assert.match(nativeTableSource, /parentValue: row\.DingdanID \|\| parentId/)
})
