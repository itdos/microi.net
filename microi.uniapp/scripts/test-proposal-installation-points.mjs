import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createProposalInstallationId,
  isProposalInstallationQuickContext,
  proposalInstallationCopyValues,
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

test('preview actions share one row only when view-more and add are both visible', () => {
  assert.match(relatedListSource, /isProposalInstallationQuickMode && !proposalInstallationHasMore/)
  assert.doesNotMatch(relatedListSource, /preview-action--quick-add/)
})

test('special installation cards are limited to proposal preview, not the full list page', () => {
  assert.match(relatedListSource, /return this\.isPreview &&\s*isProposalInstallationQuickContext/)
  assert.match(relatedListSource, /<template v-else-if="moduleKey === 'tasks'">/)
  assert.match(relatedListSource, /<mci-business-card v-for="\(row, index\) in displayedRows"/)
})
