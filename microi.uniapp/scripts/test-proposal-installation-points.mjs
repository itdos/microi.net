import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PROPOSAL_INSTALLATION_BATCH_ENGINE,
  createProposalInstallationId,
  isProposalInstallationQuickContext,
  proposalInstallationBatchFields,
  proposalInstallationBatchPatch,
  proposalInstallationCopyValues,
  proposalInstallationDeviceBatchValues,
  proposalInstallationDeviceValues,
  proposalInstallationDraft,
  proposalInstallationWriteValues
} from '../src/tenants/xjy/proposal-installation-points.mjs'

const relatedListSource = readFileSync(
  new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url),
  'utf8'
)
const nativeFormSource = readFileSync(
  new URL('../src/pages/native-form/index.vue', import.meta.url),
  'utf8'
)
const relatedListPageSource = readFileSync(
  new URL('../src/pages/business/related-list.vue', import.meta.url),
  'utf8'
)

test('quick editor is restricted to the proposal installation child table', () => {
  assert.equal(isProposalInstallationQuickContext('Diy_KehuFaXX', 'DIY_ANZHUANG_DW'), true)
  assert.equal(isProposalInstallationQuickContext('Diy_Kehu', 'DIY_ANZHUANG_DW'), false)
})

test('new and copied installation points receive independent ids', () => {
  let tick = 100
  const now = () => ++tick
  const random = () => (tick % 13) / 13
  const first = createProposalInstallationId(now, random)
  const second = createProposalInstallationId(now, random)
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(first, second)
  assert.notEqual(proposalInstallationDraft(first).Id, proposalInstallationDraft(second).Id)
})

test('device selection fills model id and device name', () => {
  assert.deepEqual(proposalInstallationDeviceValues({
    value: 'A100',
    raw: { Id: 'product-1', ShangpinMC: '碧丽直饮机' }
  }), {
    ShebeiXH: 'A100',
    ShebeiXHID: 'product-1',
    ShebeiMC: '碧丽直饮机'
  })
})

test('batch device selection also fills prices and the hidden model id dependency', () => {
  assert.deepEqual(proposalInstallationDeviceBatchValues({
    value: 'FY-150K',
    raw: {
      Id: 'product-2', ShangpinMC: '世纪丰源饮水设备', Xianjia: 3200,
      ZulinXJ: 180, GenghuanLXJG: 260
    }
  }), {
    ShebeiXH: 'FY-150K', ShebeiXHID: 'product-2', ShebeiMC: '世纪丰源饮水设备',
    ShebeiDJ: 3200, ShebeiDJZL: 180, GenghuanLXJG: 260
  })
})

test('inline write values are normalized and allow incomplete point drafts', () => {
  const row = {
    AnzhuangCS: ' 一楼茶水间 ', ShebeiXH: 'A100', ShebeiXHID: 'product-1',
    ShebeiMC: '碧丽直饮机', ShebeiSL: '2', Renshu: '35'
  }
  assert.deepEqual(proposalInstallationWriteValues(row), {
    AnzhuangCS: '一楼茶水间', ShebeiXH: 'A100', ShebeiXHID: 'product-1',
    ShebeiMC: '碧丽直饮机', ShebeiSL: 2, Renshu: 35
  })
  assert.deepEqual(proposalInstallationWriteValues({ ...row, AnzhuangCS: '', Renshu: '' }), {
    AnzhuangCS: '', ShebeiXH: 'A100', ShebeiXHID: 'product-1',
    ShebeiMC: '碧丽直饮机', ShebeiSL: 2, Renshu: 0
  })
})

test('proposal preview keeps two inline cards, navigates on edit, and puts copies first', () => {
  assert.match(relatedListSource, /return this\.isPreview\s*\? this\.rows\.slice/)
  assert.match(relatedListSource, /!isProposalInstallationQuickMode \|\| proposalInstallationHasMore/)
  assert.match(relatedListSource, /openProposalPointEdit\(row\)/)
  assert.match(relatedListSource, /mode: 'Edit'/)
  assert.match(relatedListSource, /this\.rows = \[copied, \.\.\.this\.rows\.filter/)
  assert.doesNotMatch(relatedListSource, /isProposalPointEditing/)
})

test('returning from point editor refreshes child rows and preserves zero values', () => {
  assert.match(nativeFormSource, /onShow\(\)[\s\S]*this\.refreshRelatedChildLists\(\)/)
  assert.match(nativeFormSource, /ref="embeddedRelatedList"/)
  assert.match(relatedListSource, /refreshData\(\)[\s\S]*this\.loadData\(true, true\)/)
  assert.match(relatedListSource, /\{ \.\.\.item, \.\.\.payload\.row, Id: changedId \}/)
  assert.match(relatedListSource, /value === undefined \|\| value === null \|\| value === ''/)
})

test('installation cards hydrate list rows from the full form detail response', () => {
  assert.match(relatedListSource, /hydrateProposalInstallationPointRows\(rows = \[\]\)/)
  assert.match(relatedListSource, /V8\.FormEngine\.GetFormData\(this\.config\.table/)
  assert.match(relatedListSource, /\{ \.\.\.row, \.\.\.detail\.Data, Id: detail\.Data\.Id \|\| row\.Id \}/)
  assert.match(relatedListSource, /incomingRows = await this\.hydrateProposalInstallationPointRows\(incomingRows\)/)
})

test('copy keeps every business field while excluding id and audit fields', () => {
  const row = {
    Id: 'old-id', AnzhuangCS: '测试点位', ShuizhiYQ: 'RO反渗透',
    DashuiFS: '刷卡', JiareFS: '速热式', GaofengQS: 30,
    CreateTime: '2026-08-16', CreateUserId: 'user-1'
  }
  const fields = Object.keys(row).map((Name) => ({ Name, component: 'Text' }))
  fields.push({ Name: 'LayoutOnly', component: 'CollapseGroup' })
  assert.deepEqual(proposalInstallationCopyValues(row, fields), {
    AnzhuangCS: '测试点位', ShuizhiYQ: 'RO反渗透', DashuiFS: '刷卡',
    JiareFS: '速热式', GaofengQS: 30
  })
  assert.match(relatedListSource, /proposalPointWriteEnvelope\(row, id, true\)/)
})

test('all 17 visible installation business fields can participate in one batch patch', () => {
  const businessFields = [
    ['AnzhuangCS', 'Text'], ['ShebeiXH', 'Select'], ['ShebeiMC', 'Text'],
    ['ShebeiSL', 'NumberText', 'int'], ['Renshu', 'NumberText', 'int'],
    ['XianchangZP', 'ImgUpload'], ['ShipinSC', 'FileUpload'], ['AnzhuangXGT', 'ImgUpload'],
    ['ShuizhiYQ', 'Select'], ['DashuiFS', 'Select'], ['JiareFS', 'Select'],
    ['ShuiwenYQ', 'Select'], ['GaofengSDKSL', 'NumberText', 'int'],
    ['ShebeiDJZL', 'NumberText', 'decimal'], ['ShebeiDJ', 'NumberText', 'decimal'],
    ['GenghuanLXJG', 'NumberText', 'decimal'], ['Paixu', 'NumberText', 'int']
  ].map(([Name, component, Type = 'varchar'], Sort) => ({
    Name, Label: Name, component, Type, Sort, visible: true, editable: true
  }))
  businessFields.find((field) => field.Name === 'ShebeiMC').editable = false
  const excluded = [
    { Name: 'Id', component: 'Text', Type: 'varchar', visible: true, editable: true },
    { Name: 'AnzhuangdianweiId', component: 'Text', Type: 'varchar', visible: true, editable: true },
    { Name: 'Layout', component: 'CollapseGroup', Type: 'varchar', visible: true, editable: true },
    { Name: 'HiddenSecret', component: 'Text', Type: 'varchar', visible: false, editable: true },
    { Name: 'ReadonlyValue', component: 'Text', Type: 'varchar', visible: true, editable: false },
    { Name: 'VirtualValue', component: 'Text', Type: 'varchar', visible: true, editable: true, IsVirtual: 1 },
    { Name: 'EncryptedValue', component: 'Text', Type: 'varchar', visible: true, editable: true, Encrypt: 1 }
  ]
  const allowed = proposalInstallationBatchFields([...businessFields, ...excluded])
  assert.equal(allowed.length, 17)
  assert.deepEqual(allowed.map((field) => field.Name), businessFields.map((field) => field.Name))
})

test('batch patch only includes explicitly enabled fields and controlled dependencies', () => {
  assert.deepEqual(proposalInstallationBatchPatch(
    { ShebeiMC: '统一设备名', Renshu: 80, DashuiFS: '' },
    { ShebeiMC: true, Renshu: false, DashuiFS: true },
    { ShebeiXHID: 'product-2' }
  ), {
    ShebeiMC: '统一设备名', DashuiFS: '', ShebeiXHID: 'product-2'
  })
})

test('preview exposes batch entry and full list switches to selectable installation cards', () => {
  assert.equal(PROPOSAL_INSTALLATION_BATCH_ENGINE, 'xjy_batch_update_proposal_installation_points')
  assert.match(relatedListSource, /proposalInstallationBatchPreviewAvailable/)
  assert.match(relatedListSource, /openRelatedList\('installation-batch'\)/)
  assert.match(relatedListSource, /isProposalInstallationContext && !isPreview/)
  assert.match(relatedListSource, /proposalBatchSelectedRows\.length < 2/)
  assert.match(relatedListSource, /<root-portal v-if="proposalBatchEditorOpen">/)
  assert.match(relatedListSource, /Ids: JSON\.stringify\(/)
  assert.match(relatedListSource, /Versions: JSON\.stringify\(/)
  assert.match(relatedListSource, /Patches: JSON\.stringify\(patches\)/)
  assert.match(relatedListSource, /hydrateNativeFormOptions\(this\.definition, this\.proposalBatchControlForm/)
  assert.match(relatedListSource, /Id: firstPoint\.Id \|\| this\.relationValue/)
  assert.doesNotMatch(relatedListSource, /ParentId: this\.relationValue,\s*ParentMenuId:/)
  assert.match(relatedListPageSource, /:batch-entry-mode="batchEntryMode"/)
  assert.match(relatedListPageSource, /options\.entryMode/)
})

test('preview actions support batch, view-more, and add in one responsive row', () => {
  assert.match(relatedListSource, /preview-actions--three/)
  assert.doesNotMatch(relatedListSource, /preview-action--quick-add/)
})

test('inline installation cards stay preview-only while the full page keeps standard cards', () => {
  assert.match(relatedListSource, /return this\.isPreview && this\.isProposalInstallationContext/)
  assert.match(relatedListSource, /<template v-else-if="moduleKey === 'tasks'">/)
  assert.match(relatedListSource, /<template v-else-if="isProposalInstallationContext && !isPreview">/)
  assert.match(relatedListSource, /<mci-business-card/)
})
