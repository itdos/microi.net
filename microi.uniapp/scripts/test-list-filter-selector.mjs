import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { compileModuleFilterFields, validateListFilters } from '../src/platform/list-filter-fields.mjs'

// 执行真实组件方法，用可控的分页接口验证请求时序，无需网络和登录。
const source = fs.readFileSync(new URL('../src/components/mci-native-field/mci-native-field.vue', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*\r?\n/gm, '')
  .replace('export default', 'return')
const parseJson = (value, fallback) => { if (typeof value !== 'string') return value; try { return JSON.parse(value) } catch { return fallback } }
const definition = new Function('createRegionPickerState', 'parseJson', 'isNativeFieldMultiple', 'filterNativeFieldOptions', 'uni', script)(
  () => ({}), parseJson, (field) => !!field.config.MultipleSelect,
  (rows, keyword) => rows.filter((row) => row.label.includes(keyword)), { showToast() {} }
)

function selector(loader, multiple = false) {
  const events = []
  const instance = { ...definition.data(), field: { component: 'Select', options: [], config: { MultipleSelect: multiple, SelectSaveFormat: 'Json', SelectSaveField: '_filterKey', SelectLabel: '_filterLabel' } }, modelValue: multiple ? [] : '', optionLoader: loader, selectorPortal: false, selectorOpen: true,
    $emit(event, value) { events.push([event, value]); if (event === 'update:modelValue') instance.modelValue = value } }
  for (const [key, method] of Object.entries(definition.methods)) instance[key] = method.bind(instance)
  for (const [key, getter] of Object.entries(definition.computed)) Object.defineProperty(instance, key, { get: getter.bind(instance) })
  return { instance, events }
}
const option = (id) => ({ value: id, label: `联系人 ${id}`, raw: { _filterKey: id, _filterLabel: `联系人 ${id}`, _filterValue: { Id: id } } })

test('分页保留已选标签，失败重试同一页，不跳页、不丢已选项', async () => {
  const requests = []; let fail = true
  const { instance } = selector(async ({ pageIndex }) => {
    requests.push(pageIndex)
    if (pageIndex === 2 && fail) { fail = false; throw new Error('暂时断网') }
    return { options: [option(`page-${pageIndex}`)], hasMore: pageIndex < 3 }
  }, true)
  await instance.loadOptionPage(true)
  instance.selectDropdownOption(instance.selectorOptions[0])
  instance.optionPageIndex = 2
  await instance.loadOptionPage()
  assert.equal(instance.optionError, '暂时断网')
  instance.loadMoreOptions()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(requests, [1, 2, 2])
  assert.equal(instance.selectorOptions.length, 2)
  assert.equal(instance.selectionItems[0].label, '联系人 page-1')
  assert.deepEqual(instance.modelValue[0]._filterValue, { Id: 'page-1' })
})

test('输入新关键词后旧响应不能覆盖，搜索重置页码并保留多选', async () => {
  let complete
  const { instance } = selector(() => new Promise((resolve) => { complete = resolve }), true)
  instance.modelValue = [option('selected').raw]
  const pending = instance.loadOptionPage(true)
  instance.searchKeyword = '新关键词'
  instance.scheduleSearch()
  clearTimeout(instance.searchTimer)
  complete({ options: [option('old')], hasMore: false })
  await pending
  assert.deepEqual(instance.selectorOptions, [])
  let request
  instance.optionLoader = async (params) => { request = params; return { options: [option('new')], hasMore: false } }
  await instance.loadOptionPage(true)
  assert.equal(request.pageIndex, 1)
  assert.equal(request.keyword, '新关键词')
  assert.equal(instance.selectionItems[0].label, '联系人 selected')
})

test('单选立即回填并关闭，多选勾选保留展开状态', () => {
  const { instance: single } = selector(async () => ({}))
  single.selectDropdownOption(option('a'))
  assert.equal(single.modelValue._filterKey, 'a')
  assert.equal(single.selectorOpen, false)
  const { instance: multi } = selector(async () => ({}), true)
  multi.selectDropdownOption(option('a')); multi.selectDropdownOption(option('b'))
  assert.equal(multi.modelValue.length, 2)
  assert.equal(multi.selectorOpen, true)
  multi.selectDropdownOption(option('a'))
  assert.equal(multi.modelValue[0]._filterKey, 'b')
})

test('本地过滤远程分页时跳过中间空页，继续找到后续匹配项', async () => {
  const requests = []
  const { instance } = selector(async ({ pageIndex }) => {
    requests.push(pageIndex)
    return { options: pageIndex === 2 ? [] : [option(`match-${pageIndex}`)], hasMore: pageIndex < 3 }
  })
  instance.searchKeyword = 'match'
  await instance.loadOptionPage(true)
  instance.optionPageIndex = 2
  await instance.loadOptionPage()
  assert.deepEqual(requests, [1, 2, 3])
  assert.deepEqual(instance.selectorOptions.map((row) => row.value), ['match-1', 'match-3'])
  assert.equal(instance.optionFinished, true)
})

test('树的禁用节点不提交，展开才展示子级，懒加载保留祖先', async () => {
  const { instance } = selector(async () => ({}))
  const parent = { ...option('p'), treeChildren: true, treeLazy: true, treeAncestors: [], treeDisabled: true }
  const child = { ...option('c'), treeAncestors: ['p'] }
  instance.selectorOptions = [parent]
  instance.selectDropdownOption(parent)
  assert.equal(instance.modelValue, '')
  instance.treeLoader = async () => [child]
  await instance.toggleTreeOption(parent)
  assert.equal(instance.visibleSelectorOptions.length, 2)
  await instance.toggleTreeOption(parent)
  assert.equal(instance.visibleSelectorOptions.length, 1)
  instance.searchKeyword = '联系人 c'
  assert.equal(instance.visibleSelectorOptions.length, 2)
})

test('主列表关闭放弃草稿，重置不提前生效，查看结果才刷新', () => {
  const source = fs.readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('    openAdvancedFilters() {'), source.indexOf('    getTitle(row) {'))
  const methods = new Function('validateListFilters', 'uni', `return {${body}}`)(validateListFilters, { showToast() {} })
  let loads = 0
  const page = { filterValues: { Roles: [{ _filterKey: 'a' }] }, filterFields: [], loadData() { loads++ }, ...methods }
  page.openAdvancedFilters()
  page.filterDraft.Roles[0]._filterKey = 'b'
  page.closeAdvancedFilters()
  assert.equal(page.filterValues.Roles[0]._filterKey, 'a')
  assert.equal(loads, 0)
  page.openAdvancedFilters(); page.resetAdvancedFilters()
  assert.ok(page.filterValues.Roles.length)
  page.applyAdvancedFilters()
  assert.deepEqual(page.filterValues, {})
  assert.equal(loads, 1)
})

test('客户查询标签可同时选中两个值，取消单项不清空其他值，兼容旧单选草稿', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/customer-radio-search.json', import.meta.url), 'utf8'))
  const fields = compileModuleFilterFields(fixture.search, fixture.fields)
  const source = fs.readFileSync(new URL('../src/components/mci-list-filter-field/mci-list-filter-field.vue', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('    chipValue(option)'), source.indexOf('    async sourcePage(options)'))
  const methods = new Function(`return {${body}}`)()
  for (const field of fields) {
    const control = { field, modelValue: '原已选值', ...methods, emit(value) { this.modelValue = value } }
    control.selectChip({ value: '第二个值' })
    assert.deepEqual(control.modelValue, ['原已选值', '第二个值'])
    assert.equal(control.selected({ value: '原已选值' }), true)
    assert.equal(control.selected({ value: '第二个值' }), true)
    control.selectChip({ value: '原已选值' })
    assert.deepEqual(control.modelValue, ['第二个值'])
    control.selectChip({ value: '第二个值' })
    assert.deepEqual(control.modelValue, [])
  }
})
