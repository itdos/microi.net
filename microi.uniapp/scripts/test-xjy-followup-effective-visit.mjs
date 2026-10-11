import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
  .replace(/export default/g, 'const exported =')
  .replace(/export (?=(?:async )?function|const)/g, '')

const hooks = vm.runInNewContext(`${source}; exported`, {
  console,
  setTimeout,
  clearTimeout,
  getUser: () => ({ Id: 'user-1', Name: '测试人员' }),
  followupApprovalDefaultValues: () => ({}),
  parseJson: (value, fallback) => {
    if (typeof value !== 'string') return value ?? fallback
    try { return JSON.parse(value) } catch { return fallback }
  },
  normalizeOptions: ({ Data }) => Data.map((raw) => ({ value: raw.Id, label: raw.Xingming, raw }))
})

const contactsField = { Name: 'BeibaiFR', Label: '联系人', component: 'MultipleSelect', options: [] }
const effectiveField = { Name: 'GuanjianJCR', Label: '是否有效拜访', component: 'Switch' }

function context(mode = 'Add', form = {}, defaultValues = {}) {
  const result = {
    tableName: 'Diy_GenjinJL', mode, rowId: mode === 'Edit' ? 'record-1' : '',
    form: { ...form }, defaultValues, state: {},
    definition: { fields: [{ ...contactsField, options: [] }, { ...effectiveField }] }
  }
  result.patchForm = (values) => Object.assign(result.form, values)
  return result
}

async function select(ctx, contacts) {
  const field = ctx.definition.fields[0]
  const value = contacts.map((row) => ({ Id: row.Id }))
  ctx.form.BeibaiFR = value
  await hooks.handleFieldChange(ctx, { field, value })
  await hooks.handleFieldSelect(ctx, {
    field, value, raw: contacts, multiple: true, cleared: contacts.length === 0
  })
}

test('新增未选联系人时有效拜访关闭', async () => {
  const ctx = context()
  await hooks.initialize(ctx)
  assert.equal(ctx.form.GuanjianJCR, false)
})

test('新增页忽略旧入口给开关的默认开启值', async () => {
  const ctx = context('Add', { GuanjianJCR: true }, { GuanjianJCR: true })
  await hooks.initialize(ctx)
  assert.equal(ctx.form.GuanjianJCR, false)
})

test('编辑页初次打开保留已保存值，直到联系人发生变化', async () => {
  const ctx = context('Edit', { GuanjianJCR: true })
  await hooks.initialize(ctx)
  assert.equal(ctx.form.GuanjianJCR, true)
  await select(ctx, [{ Id: 'ordinary', Xingming: '普通联系人', GuanjianJCR: '一般联系人' }])
  assert.equal(ctx.form.GuanjianJCR, false)
})

test('更换拜访客户时清除旧联系人和有效拜访', async () => {
  const ctx = context('Edit', {
    BeibaiFR: [{ Id: 'maker', Xingming: '原联系人', GuanjianJCR: '关键决策人' }],
    GuanjianJCR: true
  })
  await hooks.handleFieldSelect(ctx, {
    field: { Name: 'KehuMC' }, value: '', raw: null, cleared: true, multiple: false
  })
  assert.equal(ctx.form.BeibaiFR.length, 0)
  assert.equal(ctx.form.GuanjianJCR, false)
})

for (const mode of ['Add', 'Edit']) {
  test(`${mode} 联系人选择按后台关键决策人和决策线规则重算`, async () => {
    const ctx = context(mode, { GuanjianJCR: true })
    await select(ctx, [{ Id: 'ordinary', Xingming: '普通联系人', GuanjianJCR: '一般联系人' }])
    assert.equal(ctx.form.GuanjianJCR, false)
    await select(ctx, [
      { Id: 'ordinary', Xingming: '普通联系人', GuanjianJCR: '一般联系人' },
      { Id: 'maker', Xingming: '决策人', GuanjianJCR: '关键决策人' }
    ])
    assert.equal(ctx.form.GuanjianJCR, true)
    await select(ctx, [{ Id: 'line', Xingming: '决策线', GuanjianJCR: '决策线' }])
    assert.equal(ctx.form.GuanjianJCR, true)
    await select(ctx, [])
    assert.equal(ctx.form.GuanjianJCR, false)
    await select(ctx, [{ Id: 'near', Xingming: '非精确值', GuanjianJCR: '非关键决策人' }])
    assert.equal(ctx.form.GuanjianJCR, false)
  })
}
