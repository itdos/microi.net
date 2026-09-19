import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { userOrganizationValues } from '../src/tenants/xjy/user-organization.mjs'
import { userRoleLevel } from '../src/tenants/xjy/user-role-level.mjs'
import { nativeTreeConfig, nativeTreeOptions, nativeTreeSelectionValues, nativeTreeSelectionKey, serializeNativeTreeValue, collectNativeTreeRows } from '../src/platform/native-tree-options.mjs'

const field = (multiple = false, emitPath = false) => ({ component: 'Department', config: { MultipleSelect: false, Department: { Multiple: multiple, EmitPath: emitPath } } })
const rows = [{ Id: 'company', Name: '公司', ParentId: '00000000-0000-0000-0000-000000000000', _Child: [{ Id: 'dept', Name: '部门', _Child: [{ Id: 'team', Name: '小组' }] }] }]

test('组织组件自身多选配置优先，单选保存 Id，多选保存完整路径', () => {
  assert.equal(nativeTreeConfig(field(true, true)).Multiple, true)
  const single = nativeTreeOptions(field(), rows)
  assert.equal(single[2].treeValue, 'team')
  assert.deepEqual(single[2].treeAncestors, ['company', 'dept'])
  assert.equal(single[2].label, '公司 / 部门 / 小组')
  assert.equal(single[2].raw.Name, '小组')
  const multi = nativeTreeOptions(field(true, true), rows)
  assert.deepEqual(multi[2].treeValue, ['company', 'dept', 'team'])
  assert.equal(serializeNativeTreeValue(field(true, true), [multi[1].treeValue, multi[2].treeValue]), '[["company","dept"],["company","dept","team"]]')
  assert.equal(serializeNativeTreeValue(field(false, true), multi[2].treeValue), '["company","dept","team"]')
})

test('回显兼容标量、JSON 路径、多路径与历史组织对象，清空不选中任何节点', () => {
  assert.deepEqual(nativeTreeSelectionValues(field(false, true), '["company","dept"]'), [['company', 'dept']])
  assert.deepEqual(nativeTreeSelectionValues(field(true, true), '[["company","dept"],["company","dept","team"]]'), [['company', 'dept'], ['company', 'dept', 'team']])
  assert.equal(nativeTreeSelectionKey(field(), { Id: 'dept', Name: '部门' }), 'dept')
  assert.equal(nativeTreeSelectionKey(field(), ['company', 'dept']), 'dept')
  assert.deepEqual(nativeTreeSelectionValues(field(), 'dept'), ['dept'])
  for (const empty of ['', null, [], '[]']) assert.deepEqual(nativeTreeSelectionValues(field(), empty), [])
})

test('平铺父子关系、禁用节点与懒加载继承路径', () => {
  const flat = [{ Id: 'r', Name: '根', ParentId: '' }, { Id: 'c', Name: '子', ParentId: 'r', disabled: true }, { Id: 'l', Name: '孙', ParentId: 'c' }]
  assert.equal(nativeTreeOptions(field(), flat)[2].treeDisabled, true)
  const lazyField = { component: 'Cascader', config: { SelectSaveField: 'Id', SelectLabel: 'Name', Cascader: { EmitPath: true, Lazy: true } } }
  const parent = nativeTreeOptions(lazyField, [{ Id: 'r', Name: '根' }])[0]
  assert.equal(parent.treeLazy, true)
  const child = nativeTreeOptions(lazyField, [{ Id: 'c', Name: '子', ParentId: 'r', _Leaf: true }], parent)[0]
  assert.deepEqual(child.treeValue, ['r', 'c'])
  assert.deepEqual(child.treeAncestors, ['r'])
  assert.equal(child.treeLazy, false)
  assert.throws(() => nativeTreeOptions(field(), [{ Id: 'a', ParentId: 'b' }, { Id: 'b', ParentId: 'a' }]), /循环/)
  assert.throws(() => nativeTreeOptions(field(), [{ Id: 'a', ParentId: 'missing' }]), /缺少父级/)
})

test('完整收集分页数据，重复页和网络失败不能伪装成完整树', async () => {
  const requested = []
  const result = await collectNativeTreeRows(field(), async (options) => {
    requested.push(options)
    return { treeRows: [{ Id: `page-${options.pageIndex}` }], hasMore: options.pageIndex < 2 }
  })
  assert.equal(result.length, 2)
  assert.equal(requested[0].preserveTree, true)
  await assert.rejects(collectNativeTreeRows(field(), async () => ({ treeRows: [{ Id: 'r' }], hasMore: true })), /分页不完整/)
  await assert.rejects(collectNativeTreeRows(field(), async () => { throw new Error('无权限') }), /无权限/)
})

test('原生表单接入组织树配置和序列化，保留筛选区自定义 loader', () => {
  const form = readFileSync(new URL('../src/platform/native-form.js', import.meta.url), 'utf8')
  const control = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
  assert.match(form, /if \(tree\) return tree.Multiple/)
  assert.match(form, /serializeNativeTreeValue\(field, value\)/)
  assert.match(control, /nativeTree\(\) \{ return this.optionLoader \? null : nativeTreeConfig/)
  assert.match(control, /if \(this.nativeTree\) return option.treeValue/)
})

function controlInstance(nativeField, modelValue = '') {
  const source = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from ['"][^'"]+['"]/g, '').replace('export default', 'result =')
  const context = { result: null, nativeTreeConfig, nativeTreeOptions, nativeTreeSelectionValues, nativeTreeSelectionKey, collectNativeTreeRows, isNativeFieldMultiple: (f) => nativeTreeConfig(f)?.Multiple || f.config?.MultipleSelect === true || f.component === 'MultipleSelect',
    isRemoteNativeFieldOptions: () => false, parseJson: (v, fallback) => { try { return JSON.parse(v) } catch { return typeof v === 'object' && v !== null ? v : fallback } },
    filterNativeFieldOptions: (items, word) => items.filter((item) => item.label.includes(word || '')),
    setTimeout, clearTimeout, uni: {} }
  vm.runInNewContext(script, context)
  const options = context.result
  const events = []
  const instance = { field: nativeField, modelValue, readonly: false, optionLoader: null, treeLoader: null, selectorPortal: false, treeLinkage: false, $emit: (name, value) => { events.push([name, value]); if (name === 'update:modelValue') instance.modelValue = value }, $nextTick: () => {}, ...options.data() }
  Object.entries(options.methods).forEach(([key, method]) => { instance[key] = method.bind(instance) })
  Object.entries(options.computed).forEach(([key, getter]) => Object.defineProperty(instance, key, { get: getter.bind(instance) }))
  return { instance, events }
}

function roleFormContext(fields = [{ Name: 'Level' }]) {
  const source = readFileSync(new URL('../src/tenants/xjy/form.js', import.meta.url), 'utf8')
  const start = source.indexOf('export async function handleFieldSelect(')
  const end = source.indexOf('\nexport ', start + 1)
  const runtime = { userRoleLevel, userOrganizationValues }
  vm.runInNewContext(source.slice(start, end).replace('export ', ''), runtime)
  const context = { tableName: 'sys_user', definition: { fields }, form: { Level: '' },
    patchForm: (patch) => Object.assign(context.form, patch) }
  return { context, select: (payload) => runtime.handleFieldSelect(context, payload) }
}

test('角色级别取最大有效数值，完整选择不受已加载选项限制，清空归零', () => {
  assert.equal(userRoleLevel({ value: [{ Id: 'boss', Level: '9998' }, { Id: 'applicant', Level: 1 }], raw: [{ Id: 'applicant', Level: 1 }] }), 9998)
  assert.equal(userRoleLevel({ value: [{ Level: -1 }, { Level: null }, { Level: 'invalid' }, { Level: Infinity }, { Level: 0 }] }), 0)
  assert.equal(userRoleLevel({ value: ['boss', 'applicant'], raw: [{ Id: 'boss', Level: 9998 }, { Id: 'applicant', Level: 1 }] }), 9998)
  assert.equal(userRoleLevel({ value: [], raw: [{ Level: 9998 }] }), 0)
  assert.equal(userRoleLevel({ cleared: true, value: [{ Level: 9998 }] }), 0)
})

test('实际角色组件和租户事件联动：新增、取消最高角色、标签删除、全部清空', async () => {
  const boss = { Id: 'boss', Name: '总经理', Level: 9998 }
  const employee = { Id: 'employee', Name: '业务员', Level: '100' }
  const applicant = { Id: 'applicant', Name: '应聘者', Level: 1 }
  const nativeField = { Name: 'RoleIds', component: 'MultipleSelect', config: { SelectLabel: 'Name' }, options: [] }
  const { instance, events } = controlInstance(nativeField, JSON.stringify([boss]))
  const { context, select } = roleFormContext()
  const option = (raw) => ({ value: raw.Id, label: raw.Name, raw })
  instance.initializeDraftSelection()
  instance.selectDropdownOption(option(employee))
  // 总经理尚未加载到 knownOptions，但旧选择里的完整 Level 仍必须参与计算。
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 9998)
  instance.selectDropdownOption(option(boss))
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 100)
  instance.selectDropdownOption(option(applicant))
  instance.removeSelectedItem(instance.selectionItems.find((item) => item.value === 'employee'))
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 1)
  instance.removeSelectedItem(instance.selectionItems[0])
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 0)
  instance.selectDropdownOption(option(boss))
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 9998)
  instance.clearDropdownSelection()
  await select(events.at(-1)[1])
  assert.equal(context.form.Level, 0)
})

test('角色联动只更新表单实际存在的级别字段，兼容元数据字段大小写', async () => {
  const { context, select } = roleFormContext([{ Name: 'LEVEL' }])
  await select({ field: { Name: 'ROLEIDS' }, multiple: true, value: [{ Level: 9998 }] })
  assert.equal(context.form.LEVEL, 9998)
  const missing = roleFormContext([])
  assert.equal((await missing.select({ field: { Name: 'RoleIds' }, multiple: true, value: [{ Level: 9998 }] })).handled, true)
  assert.equal(missing.context.form.Level, '')
})

test('角色标签直接删除任意一项，保留其他完整对象并同步选择事件，不打开下拉', () => {
  const roles = [{ Id: 'r1', Name: '总经理' }, { Id: 'r2', Name: '业务员' }, { Id: 'r3', Name: '客服' }]
  const { instance, events } = controlInstance({ component: 'MultipleSelect', config: { SelectSaveField: 'Id', SelectLabel: 'Name' }, options: [] }, JSON.stringify(roles))
  instance.rememberOptions(roles.map((raw) => ({ value: raw.Id, label: raw.Name, raw })))
  instance.removeSelectedItem(instance.selectionItems[2])
  assert.equal(JSON.stringify(instance.modelValue), JSON.stringify(roles.slice(0, 2)))
  assert.equal(instance.selectorOpen, false)
  assert.deepEqual(Array.from(instance.draftIds), ['r1', 'r2'])
  assert.equal(events.at(-1)[0], 'select')
  assert.equal(events.at(-1)[1].removed.Id, 'r3')
  assert.equal(events.at(-1)[1].multiple, true)
  instance.removeSelectedItem(instance.selectionItems[0])
  assert.equal(JSON.stringify(instance.modelValue), JSON.stringify([roles[1]]))
  instance.removeSelectedItem(instance.selectionItems[0])
  assert.equal(JSON.stringify(instance.modelValue), '[]')
  assert.equal(events.at(-1)[1].cleared, true)
})

test('兼职组织移除保持完整路径，只读和过期标签不允许删除', () => {
  const paths = [['company', 'dept'], ['company', 'dept', 'team']]
  const { instance, events } = controlInstance({ ...field(true, true), options: [], Data: rows }, JSON.stringify(paths))
  instance.removeSelectedItem(instance.selectionItems[0])
  assert.equal(JSON.stringify(instance.modelValue), JSON.stringify([paths[1]]))
  instance.readonly = true
  const count = events.length
  instance.removeSelectedItem(instance.selectionItems[0])
  assert.equal(events.length, count)
  instance.readonly = false
  instance.removeSelectedItem({ key: 'not-selected' })
  assert.equal(events.length, count)
})

test('删除无需加载选项，空项不导致删除错位，父组件异步回写前草稿仍正确', () => {
  const { instance } = controlInstance({ component: 'MultipleSelect', config: {}, options: [] }, ['', 'r1', 'r2'])
  let emitted
  instance.$emit = (name, value) => { if (name === 'update:modelValue') emitted = value }
  instance.removeSelectedItem(instance.selectionItems[0])
  assert.equal(JSON.stringify(emitted), '["","r2"]')
  assert.deepEqual(Array.from(instance.draftIds), ['r2'])
})

test('完整标签列表使用停止冒泡的独立移除按钮，筛选区不重复渲染，浮层锚定输入框', () => {
  const source = readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="isMultiple && !optionLoader && !selectorOpen && selectionItems.length"/)
  assert.match(source, /v-for="item in selectionItems"/)
  assert.match(source, /@tap.stop="removeSelectedItem\(item\)"/)
  assert.match(source, /select\('\.native-select__trigger'\).boundingClientRect/)
})

test('实际组件单选展开和选择，多选跨层级勾选、取消、清空与回显', async () => {
  const nativeField = { ...field(true, true), options: [], Data: rows }
  const { instance, events } = controlInstance(nativeField, '[["company","dept"]]')
  await instance.openSelector()
  assert.deepEqual(Array.from(instance.draftIds), ['dept'])
  assert.deepEqual(Array.from(instance.expandedTreeKeys), ['company'])
  assert.equal(instance.visibleSelectorOptions.length, 2)
  await instance.toggleTreeOption(instance.selectorOptions[1])
  assert.equal(instance.visibleSelectorOptions.length, 3)
  instance.selectDropdownOption(instance.selectorOptions[2])
  assert.equal(JSON.stringify(instance.modelValue), '[["company","dept"],["company","dept","team"]]')
  assert.equal(instance.selectionItems.length, 2)
  assert.equal(instance.selectedPreview[1].label, '公司 / 部门 / 小组')
  assert.equal(instance.selectorOpen, true)
  instance.selectDropdownOption(instance.selectorOptions[1])
  assert.equal(JSON.stringify(instance.modelValue), '[["company","dept","team"]]')
  instance.clearDropdownSelection()
  assert.equal(JSON.stringify(instance.modelValue), '[]')
  assert.equal(events.at(-1)[1].cleared, true)
  instance.closeSelector()

  const single = controlInstance({ ...field(), options: [], Data: rows }).instance
  await single.openSelector()
  single.selectDropdownOption(single.selectorOptions[1])
  assert.equal(single.modelValue, 'dept')
  assert.equal(single.selectorOpen, false)
  assert.equal(single.displayText, '公司 / 部门')
})

test('组件加载失败可重试，迟到响应不会覆盖已关闭选择器', async () => {
  const { instance } = controlInstance({ ...field(), options: [], Data: rows })
  instance.getNativeTreeRows = async () => { throw new Error('无权限') }
  await instance.openSelector()
  assert.equal(instance.optionError, '无权限')
  assert.equal(instance.selectorOptions.length, 0)
  instance.getNativeTreeRows = async () => rows
  await instance.loadOptionPage(true)
  assert.equal(instance.selectorOptions.length, 3)
  let resolve
  instance.getNativeTreeRows = () => new Promise((done) => { resolve = done })
  const pending = instance.loadOptionPage(true)
  instance.closeSelector()
  resolve(rows)
  await pending
  assert.equal(instance.selectorOptions.length, 0)
})

test('通讯录部门与最近公司祖先联动，清空时移除旧部门和公司信息', () => {
  const treeRows = [{ Id: 'r', Name: '总公司', IsCompany: 1, Code: '1-', _Child: [{ Id: 'branch', Name: '分公司', IsCompany: 1, Code: '1-1-', _Child: [{ Id: 'dept', Name: '研发', Code: '1-1-1-' }] }] }]
  const option = nativeTreeOptions(field(), treeRows)[2]
  assert.deepEqual(userOrganizationValues({ raw: option.raw, option }), { DeptName: '研发', DeptCode: '1-1-1-', CompanyId: 'branch', CompanyName: '分公司', CompanyCode: '1-1-' })
  assert.deepEqual(userOrganizationValues({ cleared: true }), { DeptName: '', DeptCode: '', CompanyId: '', CompanyName: '', CompanyCode: '' })
})

test('实际保存接口提交单个 Id 与 JSON 多路径，携带真实菜单授权', async () => {
  const source = readFileSync(new URL('../src/platform/native-form.js', import.meta.url), 'utf8').replace(/import[\s\S]*?from ['"][^'"]+['"]/g, '').replace(/export default[\s\S]*$/, '').replace(/export /g, '')
  const writes = []
  const context = { nativeControls: { layout: [], related: [], readonly: [], guarded: [] }, nativeTreeConfig, serializeNativeTreeValue, removeCachePrefix: () => {}, V8: { FormEngine: { UptFormData: async (table, payload) => { writes.push({ table, payload }); return { Code: 1 } } } } }
  vm.runInNewContext(source, context)
  const fields = [{ ...field(), Name: 'DeptId', editable: true }, { ...field(true, true), Name: 'DeptIds', editable: true }]
  assert.equal(context.isNativeFieldMultiple(fields[1]), true)
  await context.saveNativeForm('sys_user', 'user', { DeptId: 'dept', DeptIds: [['company', 'dept'], ['company', 'dept', 'team']] }, fields, {}, { menuId: 'real-menu' })
  assert.equal(writes[0].payload.DeptId, 'dept')
  assert.equal(writes[0].payload.DeptIds, '[["company","dept"],["company","dept","team"]]')
  assert.equal(writes[0].payload._SysMenuId, 'real-menu')
  assert.equal(writes[0].payload._InvokeType, 'Client')
  const roles = [{ Id: 'boss', Name: '总经理', Level: 9998 }, { Id: 'applicant', Name: '应聘者', Level: 1 }]
  const roleForm = roleFormContext()
  await roleForm.select({ field: { Name: 'RoleIds' }, multiple: true, value: roles })
  await context.saveNativeForm('sys_user', 'user', { RoleIds: roles, ...roleForm.context.form }, [
    { Name: 'RoleIds', component: 'MultipleSelect', config: {}, editable: true },
    { Name: 'Level', component: 'NumberText', config: {}, editable: true }
  ], {}, { menuId: 'real-menu' })
  assert.equal(writes[1].payload.Level, 9998)
  assert.equal(writes[1].payload.RoleIds, JSON.stringify(roles))
})
