import assert from 'node:assert/strict'
import {
  buildRenderManifest,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig,
  extractViewSchema,
  isActionVisible,
  resolveActionParams,
  resolveMetricParams,
  selectViewDefinition,
  validateViewSchema
} from '../src/platform/view-schema-core.mjs'

const menu = {
  Id: 'menu-customer',
  Name: '客户管理',
  DiyTableName: 'Diy_Kehu',
  UpdateTime: '2026-07-23 10:00:00',
  EnableViewSchema: 1,
  ViewSchemaVersion: '1.0',
  ViewConfigVersion: 3,
  MobileListFields: '["KehuMC","FuzeR"]',
  ViewSchema: JSON.stringify({
    Views: [
        {
          Key: 'customer-detail-default',
          Scene: 'Detail',
          Device: 'All',
          Priority: 10,
          Layout: {
            Hero: {
              Title: '客户详情',
              TitleField: 'KehuMC',
              StatusField: 'Zhuangtai',
              Metrics: [
                { Label: '设备', Field: 'ShebeiSL', Suffix: '台' },
                {
                  Key: 'order-count',
                  Label: '订单',
                  Source: 'ApiEngine',
                  ApiEngineKey: 'customer_order_count',
                  ValueField: 'Count',
                  ParamMap: { CustomerId: '$form.Id', RoleId: '$user.RoleId' }
                }
              ]
            },
            Blocks: [{
              Type: 'ResponsiveSection',
              Title: '客户信息',
              Fields: ['KehuMC', { Name: 'LianxiDH', Label: '联系电话', Format: 'phone' }]
            }],
            Actions: [{
              Key: 'follow',
              Label: '新增跟进',
              ActionType: 'ApiEngine',
              ApiEngineKey: 'customer_follow_add',
              ParamMap: { CustomerId: '$form.Id', OperatorId: '$user.Id' },
              VisibleWhen: {
                Mode: 'All',
                Rules: [{ Field: 'Zhuangtai', Operator: '!=', Value: '已关闭' }]
              },
              V8Code: 'throw new Error("must be removed")'
            }]
          }
        },
        {
          Key: 'customer-edit',
          Scene: 'Edit',
          Device: 'Mobile',
          Layout: {
            Blocks: [{
              Type: 'ResponsiveSection',
              Title: '移动端编辑',
              Fields: [
                { Name: 'KehuMC', Label: '客户全称' },
                { Name: 'InternalCode', Hidden: true }
              ]
            }]
          }
        },
        {
          Key: 'customer-detail-manager',
          Scene: 'Detail',
          Device: 'Mobile',
          RoleIds: ['manager'],
          Priority: 20,
          Layout: {
            Hero: { Title: '管理视图', TitleField: 'KehuMC' }
          }
        },
        {
          Key: 'customer-card',
          Scene: 'Card',
          Device: 'Mobile',
          Layout: {
            Card: {
              TitleField: 'KehuMC',
              StatusField: 'Zhuangtai',
              TagFields: ['KehuLX'],
              Fields: [{ Name: 'FuzeR', Label: '负责人' }]
            },
            Statistics: { Field: 'YuqiJYJE', Label: '预期交易额', Format: 'money' }
          }
        }
      ]
  })
}

const schema = extractViewSchema(menu)
assert.equal(schema.ConfigVersion, 3)
assert.equal(schema.Views.length, 4)

const managerView = selectViewDefinition(menu, {
  scene: 'Detail',
  device: 'Mobile',
  user: { RoleIds: ['manager'] }
})
assert.equal(managerView.Key, 'customer-detail-manager')

const defaultView = selectViewDefinition(menu, {
  scene: 'Detail',
  device: 'PC',
  user: { RoleIds: ['sales'] }
})
assert.equal(defaultView.Key, 'customer-detail-default')

const detailManifest = buildRenderManifest(menu, {
  scene: 'Detail',
  device: 'PC',
  user: { RoleIds: ['sales'] }
})
assert.match(detailManifest.ManifestVersion, /^3-[0-9a-f]{8}$/)
assert.equal(detailManifest.Actions[0].ApiEngineKey, 'customer_follow_add')
assert.equal(Object.hasOwn(detailManifest.Actions[0], 'V8Code'), false)
assert.equal(isActionVisible(detailManifest.Actions[0], { Zhuangtai: '跟进中' }), true)
assert.equal(isActionVisible(detailManifest.Actions[0], { Zhuangtai: '已关闭' }), false)
assert.deepEqual(
  resolveActionParams(detailManifest.Actions[0], {
    form: { Id: 'customer-1' },
    user: { Id: 'user-1' }
  }),
  { CustomerId: 'customer-1', OperatorId: 'user-1' }
)
assert.deepEqual(detailManifest.Legacy.MobileListFields, ['KehuMC', 'FuzeR'])

const detailPreset = compileDetailPreset(detailManifest)
assert.equal(detailPreset.titleField, 'KehuMC')
assert.equal(detailPreset.sections[0].fields[1].format, 'phone')
assert.equal(detailPreset.metrics[1].source, 'ApiEngine')
assert.equal(detailPreset.metrics[1].valueField, 'Count')
assert.deepEqual(
  resolveMetricParams(detailPreset.metrics[1], {
    form: { Id: 'customer-1' },
    user: { RoleId: 'sales' }
  }),
  { CustomerId: 'customer-1', RoleId: 'sales' }
)

const editManifest = buildRenderManifest(menu, {
  scene: 'Edit',
  device: 'Mobile',
  user: { RoleIds: ['sales'] }
})
const editConfig = compileFormConfig(editManifest)
assert.equal(editConfig.sections[0].title, '移动端编辑')
assert.equal(editConfig.sections[0].fields[0].label, '客户全称')
assert.equal(editConfig.sections[0].fields[1].hidden, true)

const cardManifest = buildRenderManifest(menu, {
  scene: 'Card',
  device: 'Mobile',
  user: { RoleIds: ['sales'] }
})
const cardConfig = compileListConfig(cardManifest)
assert.equal(cardConfig.titleField, 'KehuMC')
assert.equal(cardConfig.statisticsField, 'YuqiJYJE')

const validation = validateViewSchema(menu)
assert.equal(validation.valid, true)

const retiredDiyConfig = extractViewSchema({
  EnableViewSchema: 1,
  DiyConfig: menu.ViewSchema
})
assert.equal(retiredDiyConfig.Views.length, 0)

console.log('ViewSchema checks passed.')
