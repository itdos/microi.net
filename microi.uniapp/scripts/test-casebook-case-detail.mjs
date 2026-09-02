import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const casebookUrl = new URL('../src/pages/native/casebook.vue', import.meta.url)
const tenantFormUrl = new URL('../src/tenants/xjy/form.js', import.meta.url)

function caseDetailMethod(source) {
  const start = source.indexOf('openChildDetail(item) {')
  const end = source.indexOf('removeChild(item) {', start)
  assert.ok(start >= 0 && end > start, '未找到案例册案例详情跳转方法')
  return source.slice(start, end)
}

test('案例册内案例点击始终进入只读详情', async () => {
  const source = await readFile(casebookUrl, 'utf8')
  const method = caseDetailMethod(source)
  assert.match(method, /`table=\$\{encodeURIComponent\(CASE_CHILD_TABLE\)\}`/)
  assert.match(method, /['"]mode=View['"]/)
  assert.doesNotMatch(method, /this\.canEdit \? 'Edit'/)
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
    assert.match(source, new RegExp(`${target}: item\\.${sourceField}`), `未同步 ${sourceField} 到 ${target}`)
  }
})
