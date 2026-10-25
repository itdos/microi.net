import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { CUSTOMER_FOLLOW_FIELDS, customerFollowScopeValues } from '../src/tenants/xjy/customer-follow-scope.mjs'

const formSource = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
  .replace(/export default/g, 'const exported =')
  .replace(/export (?=(?:async )?function|const)/g, '')
const hooks = vm.runInNewContext(`${formSource}; exported`, { CUSTOMER_FOLLOW_FIELDS, customerFollowScopeValues, console, setTimeout, clearTimeout })

function context(mode) {
  const ctx = { tableName: 'Diy_Kehu', mode, form: {}, state: {}, definition: { fields: [] } }
  ctx.patchForm = (patch) => Object.assign(ctx.form, patch)
  return ctx
}

for (const mode of ['Add', 'Edit']) {
  for (const source of ['raw', 'option']) {
    test(`${mode}/${source}: 客服名称、隐藏 ID 和电话一起保存，清空一起撤销`, async () => {
      const ctx = context(mode)
      const person = { Id: 'service-user', Name: '客服', Phone: 'phone' }
      const selection = source === 'raw' ? { raw: person } : { option: { raw: person } }
      await hooks.handleFieldSelect(ctx, { field: { Name: 'ZhuanshuKF', Label: '专属客服' }, value: person.Name, ...selection })
      assert.equal(ctx.form.ZhuanshuKFID, person.Id)
      assert.equal(ctx.form.ZhuanshuKFDH, person.Phone)
      assert.equal(ctx.state.personnelValues.ZhuanshuKFID, person.Id)
      assert.equal((await hooks.beforeSubmit(ctx)).ZhuanshuKFID, person.Id)
      await hooks.handleFieldSelect(ctx, { field: { Name: 'ZhuanshuKF' }, cleared: true, ...selection })
      assert.equal(ctx.form.ZhuanshuKFID, '')
      assert.equal(ctx.form.ZhuanshuKFDH, '')
      assert.equal(ctx.state.personnelValues.ZhuanshuKFID, '')
      assert.equal((await hooks.beforeSubmit(ctx)).ZhuanshuKFID, '')
    })
  }
}

const engineDirectory = new URL('../../Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/表单引擎/客户（Diy_Kehu）/表单V8事件/', import.meta.url)
const serverSource = fs.readFileSync(new URL('后端表单提交前V8事件（SubmitBeforeServerV8）.js', engineDirectory), 'utf8')

// 执行完整提交事件，只替换数据库边界；查询也必须带同商家条件及原提交事务。
function submit(form, { users = [{ Id: 'service-user', Name: '客服', Phone: 'phone', TenantId: 'merchant' }], action = 'Update', error = false } = {}) {
  const calls = []
  const V8 = { Form: { Guid70: 'contact', AddressBH: 'address', ...form },
    OldForm: { Guid70: 'contact', AddressBH: 'address', TenantId: 'merchant', ZhuanshuKF: '原客服', ZhuanshuKFID: 'old-id' },
    CurrentUser: { Id: 'owner', TenantId: 'merchant', TenantName: '商家' }, FormSubmitAction: action, DbTrans: {} }
  V8.FormEngine = {
    GetFormData: () => ({ Code: 2 }),
    GetTableData: (table, query, trans) => {
      calls.push(query)
      assert.equal(table, 'sys_user')
      assert.equal(trans, V8.DbTrans)
      assert.ok(query._Where.some(([field, op, value]) => field === 'TenantId' && op === '=' && value === 'merchant'))
      const Data = users.filter((u) => query._Where.every(([field, , value]) => (field === 'IsDeleted' ? 0 : u[field]) === value))
      return error ? { Code: 0 } : { Code: 1, Data, DataCount: Data.length }
    }
  }
  const result = vm.runInNewContext(`(function(){${serverSource}\n})()`, { V8 })
  return { form: V8.Form, result, calls }
}

for (const action of ['Insert', 'Update']) {
  test(`${action}: 旧客户端只提交名称和电话时补齐权限 ID`, () => {
    const r = submit({ ZhuanshuKF: '客服', ZhuanshuKFDH: 'phone' }, { action })
    assert.equal(r.result, undefined)
    assert.equal(r.form.ZhuanshuKFID, 'service-user')
  })
}
test('显式清空客服同时清空 ID 和电话；无关增量与删除不解析客服', () => {
  const r = submit({ ZhuanshuKF: '', ZhuanshuKFID: 'old-id', ZhuanshuKFDH: 'old-phone' })
  assert.equal(r.form.ZhuanshuKFID, '')
  assert.equal(r.form.ZhuanshuKFDH, '')
  assert.equal(r.calls.length, 0)
  assert.equal(submit({ KehuMC: '客户' }).calls.length, 0)
  assert.equal(submit({ ZhuanshuKF: '客服' }, { action: 'Delete' }).calls.length, 0)
})
test('跨商家 ID、错误 ID、同商家重名和查询失败均拒绝保存', () => {
  for (const options of [
    { users: [{ Id: 'service-user', Name: '客服', TenantId: 'other' }] },
    { users: [{ Id: 'other-id', Name: '客服', TenantId: 'merchant' }] },
    { error: true }
  ]) assert.equal(submit({ ZhuanshuKF: '客服', ZhuanshuKFID: 'service-user' }, options).result?.Code, 0)
  const users = ['a', 'b'].map((Id) => ({ Id, Name: '客服', TenantId: 'merchant' }))
  assert.equal(submit({ ZhuanshuKF: '客服' }, { users }).result?.Code, 0)
})
test('改名称保留旧 ID 的存量编辑页重新绑定到所选客服', () => {
  assert.equal(submit({ ZhuanshuKF: '客服', ZhuanshuKFID: 'old-id' }).form.ZhuanshuKFID, 'service-user')
})
