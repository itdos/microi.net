import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const casebookUrl = new URL('../src/pages/native/casebook.vue', import.meta.url)
const tenantFormUrl = new URL('../src/tenants/xjy/form.js', import.meta.url)
const nativeFormUrl = new URL('../src/pages/native-form/index.vue', import.meta.url)
const relatedListUrl = new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url)

function caseDetailMethod(source) {
  const start = source.indexOf('openChildDetail(item) {')
  const end = source.indexOf('removeChild(item) {', start)
  assert.ok(start >= 0 && end > start, '未找到案例册案例详情跳转方法')
  return source.slice(start, end)
}

function methodSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.ok(start >= 0 && end > start, `未找到方法片段：${startMarker}`)
  return source.slice(start, end)
}

test('新增案例册时即可选择案例并随案例册一并保存', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  assert.match(source, /<view v-if="bookId \|\| canEdit" class="section-heading">/)
  assert.match(source, /class="add-case-button" @tap="openCasePicker"/)

  const addSelected = methodSource(source, 'async addSelectedCases() {', 'async persistCases(items) {')
  assert.match(addSelected, /if \(!this\.bookId\)/)
  assert.match(addSelected, /_pending: true/)
  assert.ok(
    addSelected.indexOf('if (!this.bookId)') < addSelected.indexOf('await this.persistCases(selected)'),
    '未保存的案例册必须先暂存选择，不能写入空的父记录 Id'
  )

  const createBook = methodSource(source, 'async createBook() {', 'openCasePicker() {')
  assert.match(createBook, /const pendingChildren = this\.children\.filter\(\(item\) => item\._pending\)/)
  assert.match(createBook, /await this\.persistCases\(pendingChildren\)/)
})

test('新建成功后先准备照片授权上下文再刷新案例', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const createBook = methodSource(source, 'async createBook() {', 'openCasePicker() {')
  const prepareIndex = createBook.indexOf('this.prepareCasePhotoContext()')
  const loadIndex = createBook.indexOf('await this.loadChildren()')
  assert.ok(prepareIndex >= 0 && loadIndex > prepareIndex, '新建后的图片上下文准备顺序不正确')
  assert.match(source, /V8\.normalizeUploadValue\(row\[CASE_PHOTO_FIELD\]\)/)
})

test('案例册保存后发送列表页实际监听的数据变更事件', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  assert.match(source, /uni\.\$emit\('microi:data-changed', \{ table: 'diy_anlice', action, id: this\.bookId \}\)/)
  assert.doesNotMatch(source, /xjy-business-refresh/)
})

test('案例册内案例按真实菜单权限进入编辑或只读详情', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const method = caseDetailMethod(source)
  assert.match(method, /`table=\$\{encodeURIComponent\(CASE_CHILD_TABLE\)\}`/)
  assert.match(method, /const mode = this\.canEditCase \? 'Edit' : 'View'/)
  assert.match(method, /`mode=\$\{encodeURIComponent\(mode\)\}`/)
  assert.doesNotMatch(method, /['"]mode=View['"]/)
})

test('选择案例弹窗打开时隐藏外层固定保存栏', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  assert.match(source, /v-if="!loading && !casePickerVisible && canEdit" class="bottom-bar"/)
  assert.match(source, /<view class="picker-submit"><button[\s\S]*?@tap="addSelectedCases"/)
})

test('案例册详情及原生表单编辑入口服从菜单编辑权限', async () => {
  const [casebookSource, nativeFormSource] = await Promise.all([
    readFile(casebookUrl, 'utf8'),
    readFile(nativeFormUrl, 'utf8')
  ])
  assert.match(casebookSource, /return canEditMenuRecord\(this\.bookMenuId, this\.currentUser\)/)
  assert.match(casebookSource, /canEditCase\(\) \{ return canEditMenuRecord\(this\.casePhotoContext\.sysMenuId, this\.currentUser\) \}/)
  assert.match(nativeFormSource, /mode === 'View' && rowId && canEditRecord && !openSelectorField/)
  assert.match(nativeFormSource, /if \(!this\.canEditRecord\)[\s\S]*?当前账号没有编辑权限/)
})

test('有权限的案例册详情提供明确编辑入口并在返回时回源', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const editMethod = methodSource(source, 'openBookEdit() {', 'async createBook() {')
  assert.match(source, /return this\.hasPendingChildren \? '✓ 保存已选案例' : '✎ 编辑案例册'/)
  assert.match(editMethod, /return openForm\(\{/)
  assert.match(editMethod, /table: CASEBOOK_TABLE/)
  assert.match(editMethod, /mode: 'Edit'/)
  assert.match(source, /<input v-if="!bookId && canEdit"/)
  assert.match(source, /async onShow\(\)[\s\S]*?Promise\.all\(\[this\.loadBook\(\), this\.loadChildren\(\)\]\)/)
})

test('案例册编辑页子表复用已收录案例布局并通过弹窗选择现有案例', async () => {
  const [tenantSource, nativeFormSource, relatedSource] = await Promise.all([
    readFile(tenantFormUrl, 'utf8'),
    readFile(nativeFormUrl, 'utf8'),
    readFile(relatedListUrl, 'utf8')
  ])
  assert.match(tenantSource, /parentTable === CASEBOOK_TABLE && childFkField === 'anlicid'/)
  assert.match(tenantSource, /layout: 'collection-cards'/)
  assert.match(tenantSource, /title: '已收录案例'/)
  assert.match(tenantSource, /addLabel: '添加案例'/)
  assert.match(tenantSource, /sourceTable: CUSTOMER_CASE_TABLE/)
  assert.match(tenantSource, /title: '选择客户案例'/)
  assert.match(tenantSource, /fieldMap: \{/)
  assert.match(nativeFormSource, /:presentation="relatedPresentation\(relatedTab\.field\)"/)
  assert.match(relatedSource, /class="collection-heading"/)
  assert.match(relatedSource, /class="collection-heading__add"[\s\S]*?@tap="openAdd"/)
  assert.match(relatedSource, /!isCollectionCardLayout && !proposalBatchSelecting/)
  assert.match(relatedSource, /V8\.normalizeUploadValue\(row\[imageFieldName\]\)/)
  assert.match(relatedSource, /tableChildAuth: this\.tableChildAuth/)
  assert.match(relatedSource, /if \(this\.collectionPickerEnabled\)[\s\S]*?this\.openCollectionPicker\(\)/)
  assert.match(relatedSource, /<root-portal v-if="collectionPickerOpen">/)
  assert.match(relatedSource, /@tap="addSelectedCollectionSources"/)
  assert.match(relatedSource, /_SelectFields: this\.collectionSourceSelectFields\(\)/)
  assert.match(relatedSource, /V8\.FormEngine\.AddTableData\(batch\)/)
})

test('案例册编辑页按父表编辑权限展示并执行案例移除', async () => {
  const [tenantSource, relatedSource] = await Promise.all([
    readFile(tenantFormUrl, 'utf8'),
    readFile(relatedListUrl, 'utf8')
  ])
  assert.match(tenantSource, /removePermission: 'parent-edit'/)
  assert.match(relatedSource, /v-if="collectionCanRemove\(row\)"/)
  assert.match(relatedSource, /@tap\.stop="removeCollectionRow\(row\)"/)
  assert.match(relatedSource, /policy === 'parent-edit'[\s\S]*?canEditMenuRecord\(this\.parentMenuId, this\.currentUser\)/)
  assert.match(relatedSource, /V8\.FormEngine\.DelFormData\(payload\)/)
  assert.match(relatedSource, /_TableChildAuth: this\.tableChildAuth/)
})

test('案例册案例详情复用列表图片的权威菜单上下文', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const method = caseDetailMethod(source)
  assert.match(method, /const menuId = String\(this\.casePhotoContext\.sysMenuId \|\| ''\)/)
  assert.match(method, /params\.push\(`menuId=\$\{encodeURIComponent\(menuId\)\}`\)/)
  assert.match(method, /params\.push\(`fileMenuId=\$\{encodeURIComponent\(menuId\)\}`\)/)
})

test('案例册案例复用首页案例宣传册布局并映射全部展示字段', async () => {
  const source = await readFile(tenantFormUrl, 'utf8')
  assert.match(source, /\[CUSTOMER_CASE_TABLE, CASEBOOK_CASE_TABLE\]\.includes\(tableName\)/)
  for (const field of [
    'Biaoti', 'KehuMC', 'Select178', 'Select224', 'Text727', 'KehuGK',
    'DateTime340', 'Textarea579', 'KehuPJ', 'Textarea749', 'KehuALZP', 'TenantName'
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`), `缺少案例册详情字段映射：${field}`)
  }
})

test('收录首页案例时同步宣传册详情需要的快照字段', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const expectedMappings = [
    ['Select178', 'KehuLX'], ['Select224', 'ShebeiXH'], ['Text727', 'ShebeiSL'],
    ['Textarea419', 'KehuGK'], ['DateTime340', 'HezuoSJ'], ['Textarea579', 'HezuoNR'],
    ['Textarea619', 'KehuPJ'], ['Textarea749', 'ShujuZM'], ['KehuALZP', 'Tupian']
  ]
  for (const [target, sourceField] of expectedMappings) {
    assert.match(source, new RegExp(`${target}: item\\.${target} \\|\\| item\\.${sourceField}`), `未同步 ${sourceField} 到 ${target}`)
  }
})
