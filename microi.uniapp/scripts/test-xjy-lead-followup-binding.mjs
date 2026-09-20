import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { nativeTreeConfig, serializeNativeTreeValue } from '../src/platform/native-tree-options.mjs'

const read = (name) => fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const plain = (value) => JSON.parse(JSON.stringify(value))

// 执行真实选择钩子与保存函数，只替换网络边界，验证隐藏外键确实进入请求。
function loadModule(name, scope = {}) {
  const source = read(name)
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace(/export default/g, 'const exported =')
    .replace(/export (?=(?:async )?function|const)/g, '')
  return vm.runInNewContext(`${source}; exported`, { ...scope, console, setTimeout, clearTimeout })
}

const field = { Name: 'XiansuoMC', component: 'Select', editable: true }
function harness(mode = 'Add', form = {}) {
  const writes = []
  const V8 = { FormEngine: Object.fromEntries(['AddFormData', 'UptFormData'].map((method) => [method, async (table, data) => {
    writes.push({ method, table, data: plain(data) })
    return { Code: 1, Data: { Id: 'followup-1' } }
  }])) }
  const hooks = loadModule('tenants/xjy/form.js')
  const platform = loadModule('platform/native-form.js', {
    V8,
    nativeControls: JSON.parse(read('config/mci-native-controls.json')),
    nativeTreeConfig,
    serializeNativeTreeValue,
    removeCachePrefix: () => {}
  })
  const context = { tableName: 'Diy_XiansuoGJJL', mode, rowId: mode === 'Edit' ? 'followup-1' : '',
    form: { ...form }, state: {}, definition: { fields: [field] } }
  context.patchForm = (values) => Object.assign(context.form, values)
  const select = async (raw, options = {}) => {
    const value = options.cleared ? '' : raw.XiansuoMC
    context.form.XiansuoMC = value
    // 与原生选择组件一致：先 change，再携带原始行的 select。
    await hooks.handleFieldChange(context, { field, value })
    await hooks.handleFieldSelect(context, { field, value, raw, ...options })
  }
  const save = async (tableChildAuth) => platform.saveNativeForm(context.tableName, context.rowId,
    context.form, [field], await hooks.beforeSubmit(context), { menuId: 'followup-menu', tableChildAuth })
  return { hooks, context, writes, select, save }
}

for (const mode of ['Add', 'Edit']) test(`${mode} 选择线索名称后保存隐藏外键并可按父记录筛选`, async () => {
  const h = harness(mode)
  await h.select({ Id: 'lead-1', XiansuoMC: '同名线索' })
  await h.save()
  const saved = h.writes[0]
  assert.equal(saved.data.XiansuoID, 'lead-1')
  assert.equal(saved.data.XiansuoMC, '同名线索')
  assert.equal(saved.data._SysMenuId, 'followup-menu')
  assert.equal(saved.data._InvokeType, 'Client')
  assert.equal(saved.method, mode === 'Add' ? 'AddFormData' : 'UptFormData')
  assert.equal(h.writes.filter((row) => row.data.XiansuoID === 'lead-1').length, 1)
  assert.equal(h.writes.filter((row) => row.data.XiansuoID === 'lead-2').length, 0)
})

test('切换同名线索使用实际选中行 Id，兼容 option.raw 事件', async () => {
  const h = harness('Edit', { XiansuoID: 'lead-1', XiansuoMC: '同名线索' })
  await h.select({ XiansuoMC: '同名线索' }, { raw: undefined, option: { raw: { Id: 'lead-2', XiansuoMC: '同名线索' } } })
  await h.save()
  assert.equal(h.writes[0].data.XiansuoID, 'lead-2')
})

test('清空线索同时清空外键，不提交历史关联', async () => {
  const h = harness('Edit', { XiansuoID: 'lead-1', XiansuoMC: '原线索' })
  await h.select({ Id: 'lead-1' }, { cleared: true })
  await h.save()
  assert.equal(h.writes[0].data.XiansuoID, '')
  assert.equal(h.writes[0].data.XiansuoMC, '')
})

test('名称改变但选项无有效 Id 时解除旧关联并阻止保存孤立记录', async () => {
  const h = harness('Edit', { XiansuoID: 'lead-1', XiansuoMC: '原线索' })
  await h.select({ XiansuoMC: '新线索' })
  assert.equal(h.context.form.XiansuoID, '')
  await assert.rejects(h.save(), /重新选择.*线索/)
  assert.equal(h.writes.length, 0)
})

test('历史缺外键记录必须重新选择，不能凭同名猜测关联', async () => {
  const h = harness('Edit', { XiansuoMC: '同名线索', XiansuoID: null })
  await assert.rejects(h.save(), /重新选择.*线索/)
  await h.select({ Id: 'lead-2', XiansuoMC: '同名线索' })
  await h.save()
  assert.equal(h.writes[0].data.XiansuoID, 'lead-2')
})

test('详情子表入口传入的外键及父表授权上下文保留', async () => {
  const h = harness('Add', { XiansuoID: 'parent-1', XiansuoMC: '父线索' })
  const auth = { ParentSysMenuId: 'lead-menu', ParentFieldId: 'followups', ParentFormDataId: 'parent-1' }
  await h.save(auth)
  assert.equal(h.writes[0].data.XiansuoID, 'parent-1')
  assert.deepEqual(h.writes[0].data._TableChildAuth, auth)
})

test('其它表和其它字段不会触发线索绑定', async () => {
  const h = harness('Edit', { XiansuoID: 'lead-1' })
  await h.hooks.handleFieldSelect(h.context, { field: { Name: 'GenjinFS' }, raw: { Id: 'other' } })
  h.context.tableName = 'Diy_Other'
  await h.select({ Id: 'other', XiansuoMC: '其它名称' })
  assert.equal(h.context.form.XiansuoID, 'lead-1')
})
