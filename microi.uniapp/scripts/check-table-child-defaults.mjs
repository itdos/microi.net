import assert from 'node:assert/strict'
import {
  buildTableChildDefaultValues,
  tableChildFieldRelations
} from '../src/platform/table-child-defaults.js'

const customer = {
  Id: 'customer-1',
  KehuMC: 'cs新版tab'
}

// zhy：覆盖客户详情 → 联系人新增，名称应从 KehuMC 映射到 SuoshuKH。
assert.deepEqual(buildTableChildDefaultValues({
  fieldConfig: {
    TableChild: {
      PrimaryTableFieldName: 'Id',
      FieldRelations: [['KehuMC', 'SuoshuKH']]
    }
  },
  parentForm: customer,
  childFkField: 'KehuID',
  relationValue: customer.Id
}), {
  KehuID: 'customer-1',
  SuoshuKH: 'cs新版tab'
})

// zhy：覆盖客户详情 → 跟进记录/项目合伙人跟进记录新增，Id 与客户名称必须同时带入。
assert.deepEqual(buildTableChildDefaultValues({
  fieldConfig: {
    TableChild: {
      FieldRelations: [['KehuMC', 'KehuMC'], ['Id', 'KehuID']]
    }
  },
  parentForm: customer,
  childFkField: 'KehuID',
  relationValue: customer.Id
}), {
  KehuID: 'customer-1',
  KehuMC: 'cs新版tab'
})

// zhy：保留旧版对象格式兼容，并对新旧配置中的重复关系去重。
const legacyConfig = {
  TableChild: {
    FieldRelations: [['KehuMC', 'KehuMC']]
  },
  TableChildCallbackField: JSON.stringify([
    { Father: 'KehuMC', Child: 'KehuMC' },
    { Father: 'Id', Child: 'KehuID' }
  ])
}
assert.deepEqual(tableChildFieldRelations(legacyConfig), [
  { father: 'KehuMC', child: 'KehuMC' },
  { father: 'Id', child: 'KehuID' }
])

console.log('table-child default value checks passed')
