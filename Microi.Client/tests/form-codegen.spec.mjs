import test from 'node:test'
import assert from 'node:assert/strict'
import { generateFormVue, generatedFormAppShell, generatedFormRoutePath } from '../src/utils/form-codegen.js'
import { saveGeneratedFormSource } from '../src/utils/form-codegen-publish.js'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const table = { Id: 'table-1', Name: 'Biz_Order', Label: '订单' }
const fields = [
  { Name: 'Name', Label: '订单名称', Component: 'Text', Sort: 1, NotEmpty: 1 },
  { Name: 'Quantity', Label: '数量', Component: 'NumberText', Sort: 2 },
  { Name: 'Status', Label: '状态', Component: 'Select', Sort: 3, Data: '[{"Key":"New","Value":"新建"}]' }
]

test('表单设计生成独立 Vue SFC，复用菜单权限上下文与 FormEngine 写入契约', () => {
  const source = generateFormVue(table, fields)
  assert.match(source, /<script setup>/)
  assert.match(source, /import \{ microiV8 as V8 \} from '\.\.\/platform\/microi'/)
  assert.match(source, /form\['Name'\]/)
  assert.match(source, /form\['Quantity'\]/)
  assert.match(source, /V8\.FormEngine\.GetTableData\(tableKey, \{ _SysMenuId: menuId\(\)/)
  assert.match(source, /V8\.FormEngine\.GetFormData\(tableKey, \{ Id: row\.Id, _SysMenuId: menuId\(\) \}\)/)
  assert.match(source, /_RowModel: record/)
  assert.match(source, /_FormData: record/)
  assert.match(source, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  assert.match(source, /缺少菜单授权上下文/)
  assert.equal(generatedFormRoutePath(table), '/forms/biz_order')
  const parsed = parse(source, { filename: 'Form_Biz_Order.vue' })
  assert.deepEqual(parsed.errors, [])
  assert.ok(compileScript(parsed.descriptor, { id: 'form-codegen' }).content.includes('tableKey'))
  assert.deepEqual(compileTemplate({ source: parsed.descriptor.template.content, filename: 'Form_Biz_Order.vue', id: 'form-codegen' }).errors, [])
})

test('字段标签转义，复杂控件与动态数据源拒绝静默丢字段', () => {
  const source = generateFormVue(table, [{ Name: 'Name', Label: '<img src=x onerror=1>', Component: 'Text' }])
  assert.ok(!source.includes('<img src=x'))
  assert.match(source, /&lt;img src=x onerror=1&gt;/)
  assert.throws(() => generateFormVue(table, [{ Name: 'Files', Component: 'FileUpload' }]), /暂不支持/)
  assert.throws(() => generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Sql"}' }]), /动态数据源/)
  assert.match(generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Data"}', Data: '[{"Key":"A","Value":"可用"}]' }]), /可用/)
  assert.match(generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Data"}', Data: '[]' }]), /未配置选项，请输入/)
  assert.throws(() => generateFormVue(table, [{ Name: 'Choices', Component: 'MultipleSelect', Data: '[]' }]), /没有配置选项/)
  assert.throws(() => generateFormVue(table, [{ Name: 'Group', Component: 'CollapseGroup' }]), /暂不支持/)
  assert.throws(() => generateFormVue({ ...table, InFormV8: 'console.log(1)' }, fields), /前端 V8 事件/)
  assert.throws(() => generateFormVue(table, [{ Name: 'Name', Component: 'Text', Config: { V8Code: 'return 1' } }]), /前端 V8 或模板代码/)
  const withDisplay = generateFormVue(table, [...fields, { Name: 'SerialNo', Component: 'AutoNumber' }])
  assert.match(withDisplay, /"SerialNo": ""/)
  assert.match(withDisplay, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  const withReadonly = generateFormVue(table, [...fields, { Name: 'Locked', Component: 'Text', Readonly: 1 }])
  assert.match(withReadonly, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  assert.ok(withReadonly.indexOf('<th>订单名称</th>') < withReadonly.indexOf('<th>Locked</th>'))
  const withDate = generateFormVue(table, [{ Name: 'OccurredAt', Component: 'DateTime' }])
  assert.match(withDate, /const dateFieldNames = \["OccurredAt"\]/)
  assert.match(withDate, /type="datetime-local" step="1"/)
  assert.match(withDate, /String\(value\)\.replace\(' ', 'T'\)/)
})

test('微服务路由入口也是可编译 Vue SFC', () => {
  const parsed = parse(generatedFormAppShell, { filename: 'App.vue' })
  assert.deepEqual(parsed.errors, [])
  assert.ok(compileScript(parsed.descriptor, { id: 'form-code-app' }).content.includes('import.meta.glob'))
  assert.deepEqual(compileTemplate({ source: parsed.descriptor.template.content, filename: 'App.vue', id: 'form-code-app' }).errors, [])
})

test('保存生成微服务源码并回读；人工改动后拒绝覆盖', async () => {
  const files = new Map()
  let app = null
  const call = async (key, args) => {
    if (key === 'ai_app_list') return { Code: 1, Data: app ? [app] : [] }
    if (key === 'ai_app_create') {
      app = { Id: 'app-1', AppKey: args.AppKey }
      files.set('src/App.vue', 'starter')
      files.set('microi.routes.json', '[{"path":"/","name":"home","isHome":true}]')
      return { Code: 1, Data: app }
    }
    if (key === 'ai_app_get_file') return files.has(args.FilePath)
      ? { Code: 1, Data: { Content: files.get(args.FilePath) } }
      : { Code: 2, Data: null }
    if (key === 'ai_app_save_file') {
      files.set(args.FilePath, args.Content)
      return { Code: 1, Data: { FilePath: args.FilePath } }
    }
    throw new Error(key)
  }
  const first = await saveGeneratedFormSource(call, table, fields)
  assert.equal(first.appKey, 'microi-generated-forms')
  assert.equal(JSON.parse(files.get('microi.routes.json')).find(row => row.path === first.routePath).sourceFile, first.pagePath)
  assert.equal(JSON.parse(files.get('microi.routes.json')).some(row => row.path === '/'), false)
  assert.equal(JSON.parse(files.get('microi.routes.json'))[0].isHome, true)
  const again = await saveGeneratedFormSource(call, table, fields)
  assert.equal(again.created, false)
  files.set(first.pagePath, files.get(first.pagePath) + '\n<!-- 人工修改 -->')
  await assert.rejects(saveGeneratedFormSource(call, table, fields), /已手工修改/)
  assert.match(files.get(first.pagePath), /人工修改/)
})
