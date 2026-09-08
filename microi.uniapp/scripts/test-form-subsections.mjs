import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import { buildFormSubsections } from '../src/platform/form-subsections.mjs'
import { proposalCostFieldPresentation } from '../src/tenants/xjy/proposal-cost-presentation.mjs'

const field = (Name, component = 'Text', Label = Name) => ({ Name, component, Label })
const source = readFileSync(new URL('../src/pages/native-form/index.vue', import.meta.url), 'utf8')
const methodBlock = (start, end) => source.slice(source.indexOf(`\t\t\t${start}(`), source.indexOf(`\t\t\t${end}(`))
const methods = vm.runInNewContext(`({
  ${methodBlock('groupKey', 'initializeFormTabs')}
  ${methodBlock('expandFirstInvalidGroup', 'handleRelatedChange')}
})`, {
  buildFormSubsections,
  validateNativeForm: (form, fields) => fields.some(item => item.required && !form[item.Name]) ? '请填写必填项' : ''
})

function fixture(table = 'diy_kehufaxx') {
  const fields = [
    field('ShebeiDJ'),
    ...(table === 'diy_kehufaxx' ? [field('HezuoQCB', 'Divider', '合作前成本'), field('DangqianYDCB')] : []),
    field('HezuoHCB', 'Divider', '合作后成本（租赁）'), field('HezuoHYDCB'),
    field('HezuoHCBMD', 'Divider', '合作后成本（买断）'), field('HezuoHYDCBMD')
  ]
  const group = { key: 'price', source: 'CollapseGroup', tabKey: 'basic', fields }
  const presentation = item => proposalCostFieldPresentation(table, item)
  group.subsectionByField = buildFormSubsections(group, presentation)
  const page = {
    ...methods,
    collapsedSubsectionKeys: [], expandedGroupKeys: ['price'],
    form: { HezuoHYDCB: 1500, HezuoHYDCBMD: 1500 },
    definition: { groups: [group] },
    tenantFieldPresentation: presentation,
    isSelectorGroupOpen: item => item.fields.some(row => row.Name === page.openSelectorField)
  }
  return { group, page, fields: Object.fromEntries(fields.map(item => [item.Name, item])) }
}

test('需求方案三个成本面板默认展开，当前成本仅更改移动展示标题', () => {
  const { group, page, fields } = fixture()
  assert.equal(new Set(Object.values(group.subsectionByField)).size, 3)
  assert.equal(group.subsectionByField.HezuoQCB.title, '当前成本')
  assert.equal(fields.HezuoQCB.Label, '合作前成本')
  assert.ok(group.fields.every(item => page.isSubsectionFieldVisible(group, item)))
})

test('点位租赁和买断独立收展，报价不被折叠，编辑值保留', () => {
  const { group, page, fields } = fixture('diy_anzhuang_dw')
  assert.equal(new Set(Object.values(group.subsectionByField)).size, 2)
  page.toggleSubsection(group, fields.HezuoHCB)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCB), false)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHCB), true)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCBMD), true)
  assert.equal(page.isSubsectionFieldVisible(group, fields.ShebeiDJ), true)
  assert.equal(page.form.HezuoHYDCB, 1500)
  page.toggleSubsection(group, fields.HezuoHCBMD)
  page.toggleSubsection(group, fields.HezuoHCB)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCB), true)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCBMD), false)
})

test('收展外层保持内层选择，内层点击不修改外层状态', () => {
  const { group, page, fields } = fixture()
  page.toggleSubsection(group, fields.HezuoQCB)
  assert.equal(page.isGroupExpanded(group, 0), true)
  page.toggleGroup(group, 0)
  assert.equal(page.isGroupExpanded(group, 0), false)
  page.toggleGroup(group, 0)
  assert.equal(page.isSubsectionFieldVisible(group, fields.DangqianYDCB), false)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCB), true)
})

test('动态新增字段归入当前标题，普通 Divider 和外层分组结束折叠范围', () => {
  const { group } = fixture('diy_anzhuang_dw')
  const newer = field('FutureCost')
  const regular = field('Notes', 'Divider')
  group.fields.push(newer, regular, field('Remark'))
  const byField = buildFormSubsections(group, item => proposalCostFieldPresentation('diy_anzhuang_dw', item))
  assert.equal(byField.FutureCost, byField.HezuoHCBMD)
  assert.equal(byField.Notes, undefined)
  assert.equal(byField.Remark, undefined)
  assert.deepEqual(buildFormSubsections({ key: 'next', fields: [field('NextCost')] }), {})
  const other = buildFormSubsections({ ...group, key: 'other' }, item => ({ collapsible: item.component === 'Divider' }))
  assert.notEqual(other.HezuoHCB.key, byField.HezuoHCB.key)
})

test('其它表、普通字段及普通分隔标题保持原状', () => {
  assert.equal(proposalCostFieldPresentation('another_table', field('HezuoHCB', 'Divider')), null)
  assert.equal(proposalCostFieldPresentation('diy_kehufaxx', field('HezuoHCB')), null)
  assert.equal(proposalCostFieldPresentation('diy_kehufaxx', field('FanganSJ', 'Divider')), null)
  assert.deepEqual(buildFormSubsections({ fields: [field('Header', 'Divider'), field('Value')] }), {})
})

test('只清理被收起区域的选择器，必填失败同时展开内外层', () => {
  const { group, page, fields } = fixture()
  page.openSelectorField = 'HezuoHYDCBMD'
  page.toggleSubsection(group, fields.HezuoHCB)
  assert.equal(page.openSelectorField, 'HezuoHYDCBMD')
  page.toggleSubsection(group, fields.HezuoHCBMD)
  assert.equal(page.openSelectorField, '')
  page.toggleGroup(group, 0)
  fields.HezuoHYDCB.required = true
  page.form.HezuoHYDCB = ''
  page.expandFirstInvalidGroup()
  assert.equal(page.isGroupExpanded(group, 0), true)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCB), true)
  assert.equal(page.isSubsectionFieldVisible(group, fields.HezuoHYDCBMD), false)
})
