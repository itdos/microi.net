import assert from 'node:assert/strict'
import {
  appendSystemAuditFields,
  resolveConfiguredFieldNames,
  shouldKeepEmptyCardLine
} from '../src/platform/card-field-policy.mjs'

const fields = [
  { Id: 'field-owner', Name: 'OwnerId', Label: '负责人' },
  { Id: 'field-type', Name: 'CustomerType', Label: '客户类型' }
]

const availableFields = appendSystemAuditFields(fields)
assert.ok(availableFields.some((field) => field.Name === 'CreateTime'), '应补齐创建时间系统字段')
assert.ok(availableFields.some((field) => field.Name === 'UpdateTime'), '应补齐更新时间系统字段')
assert.equal(availableFields.filter((field) => field.Name === 'CreateTime').length, 1, '已有系统字段不应重复')
assert.deepEqual(
  resolveConfiguredFieldNames([{ Id: 'legacy-system-id', Name: 'CreateTime' }], availableFields),
  ['CreateTime'],
  '对象配置的 Id 无法匹配时应继续尝试 Name'
)
assert.equal(shouldKeepEmptyCardLine({ label: '负责人' }), true, '负责人空值时应保留')
assert.equal(shouldKeepEmptyCardLine({ label: ' 负责人 ' }), true, '负责人标签应容忍首尾空格')
assert.equal(shouldKeepEmptyCardLine({ label: '负责人电话' }), false, '其他空字段不应被扩大保留')

console.log('card field display checks passed')
