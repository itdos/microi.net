import assert from 'node:assert/strict'
import {
  appendFieldDisplayUnit,
  fieldDisplayUnit,
  fieldEmptyText,
  isTechnicalIdentifier,
  userFacingFallback
} from '../src/platform/user-facing-display.mjs'

assert.equal(isTechnicalIdentifier('c4f27c1b-a467-4c6c-9e54-d2bb6bd03d54'), true)
assert.equal(isTechnicalIdentifier('正常业务编号-20260901'), false)
assert.equal(fieldEmptyText({ component: 'FileUpload' }), '暂无附件')
assert.equal(fieldEmptyText({ component: 'Text' }), '暂无')
assert.equal(fieldDisplayUnit({ Label: '年假剩余天数' }), '天')
assert.equal(fieldDisplayUnit({ Label: '时长', config: { Unit: '小时' } }), '小时')
assert.equal(fieldDisplayUnit({ Label: '时长' }, { moduleTitle: '请假管理详情' }), '天')
assert.equal(fieldDisplayUnit({ Label: '时长' }, { moduleTitle: '设备运行统计' }), '')
assert.equal(appendFieldDisplayUnit('1', { Label: '年假剩余天数' }), '1 天')
assert.equal(appendFieldDisplayUnit('1', { Label: '时长' }, { moduleTitle: '请假管理' }), '1 天')
assert.equal(appendFieldDisplayUnit('年假', { Label: '请假类型', config: { Unit: '天' } }), '年假')
assert.equal(userFacingFallback('c4f27c1b-a467-4c6c-9e54-d2bb6bd03d54'), '信息未解析')
assert.equal(userFacingFallback('业务编号-01'), '业务编号-01')

console.log('用户可读字段值、内部标识保护与单位展示检查通过')
