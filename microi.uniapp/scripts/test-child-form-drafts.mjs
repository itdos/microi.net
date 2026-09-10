import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import * as drafts from '../src/platform/child-form-drafts.mjs'
import * as points from '../src/tenants/xjy/proposal-installation-points.mjs'

const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const listSource = readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
const options = parse(listSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration
const methods = options.properties.find(node => node.key.name === 'methods').value.properties
function listMethod(name, globals = {}) {
  const method = methods.find(node => node.key.name === name)
  return vm.runInNewContext(`({${listSource.slice(method.start, method.end)}})`, { ...points, ...globals })[name]
}
test('hidden quick-card fields still have valid quantity and people field names', () => {
  const method = options.properties.find(node => node.key.name === 'computed').value.properties
    .find(node => node.key.name === 'proposalInstallationFieldNames')
  const computed = vm.runInNewContext(`({${listSource.slice(method.start, method.end)}})`, points).proposalInstallationFieldNames
  const names = computed.call({ proposalInstallationQuickFields: [{ key: 'place', name: 'AnzhuangCS' }],
    proposalInstallationDefinitionField: () => null })
  assert.equal(names.deviceQuantity, 'ShebeiSL')
  assert.equal(names.people, 'Renshu')
})
function fixture(id) {
  drafts.createChildDraftSession(id)
  const group = drafts.childDraftGroup(id, 'points', {
    tableName: points.PROPOSAL_INSTALLATION_TABLE, fkField: 'AnzhuangdianweiId', fieldConfig: {},
    menuId: 'child-menu', auth: { ParentRowId: id, ParentValue: id, ParentFormMode: 'Add', Parent: { ParentRowId: 'customer' } }
  })
  return group
}
const defaults = ({ relationValue }) => ({ AnzhuangdianweiId: relationValue, KehuMC: '当前客户' })

test('actual add/edit/copy/delete/refresh handlers keep unsaved points local and display every draft', async () => {
  const group = fixture('local-only')
  const unexpected = () => { throw new Error('A draft must not call the backend') }
  const ctx = { proposalDraftGroup: group, rows: [], canAdd: true, proposalPointSavingId: '',
    isProposalInstallationQuickMode: true, config: { table: points.PROPOSAL_INSTALLATION_TABLE },
    proposalInstallationFieldNames: points.PROPOSAL_INSTALLATION_FIELDS,
    callbackDefaults: () => ({ AnzhuangdianweiId: 'local-only' }),
    emitDataCount() {}, proposalPointCanEdit: () => true, confirmAction: async () => true }
  for (const name of ['openAdd', 'syncProposalDraftRows', 'updateProposalPointValue', 'saveProposalPoint', 'copyProposalPoint', 'deleteProposalPoint', 'loadData']) {
    ctx[name] = listMethod(name, { V8: { FormEngine: new Proxy({}, { get: () => unexpected }) }, uni: { showToast: unexpected, showLoading: unexpected } }).bind(ctx)
  }
  await ctx.openAdd()
  const original = ctx.rows[0]
  ctx.updateProposalPointValue(original, 'Renshu', 0)
  ctx.updateProposalPointValue(original, 'AnzhuangCS', '一楼')
  await ctx.saveProposalPoint(original)
  await ctx.copyProposalPoint(original)
  await ctx.openAdd()
  assert.equal(group.rows.length, 3)
  assert.notEqual(group.rows[1].Id, original.Id)
  const edited = drafts.writeChildDraft(group.key, group.tableName, original.Id, { Renshu: 30, ShebeiDJ: 2500 })
  assert.equal(edited.ShebeiDJ, 2500)
  await ctx.loadData(true, true)
  assert.equal(ctx.rows.find(row => row.Id === original.Id).Renshu, 30)
  await ctx.deleteProposalPoint(ctx.rows[0])
  assert.equal(group.rows.length, 2)
  drafts.disposeChildDraftSession('local-only')
  assert.equal(drafts.findChildDraftGroup(group.key), null)
  assert.throws(() => drafts.readChildDraft(group.key, group.tableName, original.Id), /已失效/)
})

test('flush uses the saved parent, original authorization chain, Client events and current parent defaults', async () => {
  const group = fixture('draft-parent')
  group.rows = [{ Id: 'p1', ShebeiSL: 2 }, { Id: 'p2', ShebeiSL: 0 }]
  const writes = []
  await drafts.flushChildDrafts('draft-parent', 'saved-parent', {
    async AddFormData(table, values) { writes.push({ table, values }); return { Code: 1, Data: { Id: values.Id } } }
  }, {}, defaults)
  assert.equal(writes.length, 2)
  for (const { table, values } of writes) {
    assert.equal(table, points.PROPOSAL_INSTALLATION_TABLE)
    assert.equal(values.AnzhuangdianweiId, 'saved-parent')
    assert.equal(values._TableChildAuth.ParentRowId, 'saved-parent')
    assert.equal(values._TableChildAuth.ParentFormMode, 'Edit')
    assert.equal(values._TableChildAuth.Parent.ParentRowId, 'customer')
    assert.equal(values._InvokeType, 'Client')
    assert.equal(values.KehuMC, '当前客户')
  }
  assert.equal(writes[1].values.ShebeiSL, 0)
  assert.equal(drafts.childDraftRows('draft-parent', group.tableName), null)
})

test('a rejected child remains editable and retry never adds an already saved child twice', async () => {
  const group = fixture('retry-parent')
  group.rows = [{ Id: 'a' }, { Id: 'b' }]
  const created = []
  let fail = true
  const api = {
    async AddFormData(table, row) {
      if (row.Id === 'b' && fail) return { Code: 0, Msg: '点位人数不能为负数' }
      assert.ok(!created.includes(row.Id))
      created.push(row.Id)
      return { Code: 1 }
    },
    async UptFormData(table, row) { assert.ok(created.includes(row.Id)); return { Code: 1 } }
  }
  await assert.rejects(drafts.flushChildDrafts('retry-parent', 'retry-parent', api, {}, defaults), /人数/)
  assert.equal(group.rows.length, 2)
  drafts.writeChildDraft(group.key, group.tableName, 'b', { Renshu: 5 })
  fail = false
  await drafts.flushChildDrafts('retry-parent', 'retry-parent', api, {}, defaults)
  assert.deepEqual(created, ['a', 'b'])
})

test('lost Add response is read back before retry and cannot create a duplicate', async () => {
  const group = fixture('timeout-parent')
  group.rows = [{ Id: 'a' }]
  let adds = 0
  let reads = 0
  let updates = 0
  const api = {
    async AddFormData() { adds++; throw new Error('network timeout') },
    async GetFormData() { reads++; return { Code: 1, Data: { Id: 'a' } } },
    async UptFormData() { updates++; return { Code: 1 } }
  }
  await assert.rejects(drafts.flushChildDrafts('timeout-parent', 'timeout-parent', api, {}, defaults), /timeout/)
  await drafts.flushChildDrafts('timeout-parent', 'timeout-parent', api, {}, defaults)
  assert.deepEqual({ adds, reads, updates }, { adds: 1, reads: 1, updates: 1 })
})

test('sessions and fields stay isolated; edits do not mutate drafts until saved', () => {
  const first = fixture('one')
  const second = fixture('two')
  first.rows = [{ Id: 'a', Nested: { value: 1 } }]
  second.rows = [{ Id: 'a', Nested: { value: 2 } }]
  drafts.readChildDraft(first.key, first.tableName, 'a').Nested.value = 10
  assert.equal(first.rows[0].Nested.value, 1)
  assert.equal(second.rows[0].Nested.value, 2)
  assert.throws(() => drafts.readChildDraft(first.key, 'another-table', 'a'), /已失效/)
  drafts.disposeChildDraftSession('one')
  drafts.disposeChildDraftSession('two')
})

test('actual parent Save waits for the parent, retains failed children and retries as Edit', async () => {
  const source = readFileSync(new URL('../src/pages/native-form/index.vue', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  const object = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration
  const method = object.properties.find(node => node.key.name === 'methods').value.properties.find(node => node.key.name === 'submit')
  const group = fixture('save-button')
  group.rows = [{ Id: 'a' }, { Id: 'b' }]
  const calls = []
  const toasts = []
  let rejectParent = true
  let rejectChild = true
  const globals = {
    validateNativeForm: () => '', tenantFormBusyMessage: () => '', prepareTenantFormSubmit: async () => ({}),
    nativeFormDefaultSubmitValues: () => ({}), getUser: () => ({}), setTimeout: () => {},
    notifyTenantFormSaved: async () => {}, flushChildDrafts: drafts.flushChildDrafts,
    buildTableChildDefaultValues: defaults,
    uni: { showToast: toast => toasts.push(toast), $emit() {} },
    async saveNativeFormRecord(context) {
      calls.push(context.rowId ? 'parent-edit' : 'parent-add')
      if (rejectParent) throw new Error('parent validation failed')
      return { Code: 1, Data: { Id: 'save-button' } }
    },
    V8: { FormEngine: {
      async AddFormData(table, row) {
        calls.push(`add-${row.Id}`)
        if (row.Id === 'b' && rejectChild) return { Code: 0, Msg: 'child validation failed' }
        return { Code: 1 }
      },
      async UptFormData(table, row) { calls.push(`edit-${row.Id}`); return { Code: 1 } }
    } }
  }
  const submit = vm.runInNewContext(`({${source.slice(method.start, method.end)}})`, globals).submit
  const ctx = { rowId: '', draftRowId: 'save-button', uploadStates: {}, form: { Id: 'save-button' },
    tableName: 'diy_kehufaxx', definition: { fields: [] }, defaultValues: {}, tenantFormContext: () => ({}),
    tenantFieldPresentation: () => ({}) }
  await submit.call(ctx)
  assert.deepEqual(calls, ['parent-add'])
  assert.equal(ctx.rowId, '')
  rejectParent = false
  await submit.call(ctx)
  assert.equal(ctx.rowId, 'save-button')
  assert.match(toasts.at(-1).title, /主表已保存，子表尚未全部保存/)
  assert.equal(group.rows.length, 2)
  rejectChild = false
  await submit.call(ctx)
  assert.deepEqual(calls, ['parent-add', 'parent-add', 'add-a', 'add-b', 'parent-edit', 'edit-a', 'add-b'])
  assert.equal(toasts.at(-1).title, '保存成功')
  assert.equal(ctx.saving, false)
})
