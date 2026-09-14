import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  contractStateByEndDate,
  orderCustomerSourceValues
} from '../src/tenants/xjy/order-contract.mjs'

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
