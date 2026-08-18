import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterProductParameterFields,
  formatProductParameterValue
} from '../src/pages/mall/product-params.mjs'

test('商品参数不展示系统审计字段', () => {
  const fields = [
    { Name: 'Id', Label: 'Id' },
    { Name: 'CreateTime', Label: '创建时间' },
    { Name: 'UpdateTime', Label: '修改时间' },
    { Name: 'CreateUserId', Label: '创建人Id' },
    { Name: 'UserName', Label: '创建人' },
    { Name: 'IsDeleted', Label: '是否已删除' },
    { Name: 'OsClient', Label: '租户' },
    { Name: 'ChushuiMS', Label: '出水模式' },
    { Name: 'ShiyongRS', Label: '适用人数' }
  ]

  assert.deepEqual(
    filterProductParameterFields(fields).map((field) => field.Name),
    ['ChushuiMS', 'ShiyongRS']
  )
})

test('系统字段过滤忽略字段名大小写并兼容无效字段列表', () => {
  assert.deepEqual(filterProductParameterFields([{ Name: 'ISDELETED' }, { Name: 'Power' }]), [{ Name: 'Power' }])
  assert.deepEqual(filterProductParameterFields(null), [])
})

test('商品参数的 0 和 false 是有效值', () => {
  assert.equal(formatProductParameterValue(0), 0)
  assert.equal(formatProductParameterValue(false), false)
  assert.equal(formatProductParameterValue(''), '-')
  assert.equal(formatProductParameterValue(null), '-')
  assert.equal(formatProductParameterValue(undefined), '-')
})
