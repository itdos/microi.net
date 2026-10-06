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
  // 使用对象重载只提交可编辑字段，避免字符串重载合并服务器返回的只读字段。
  assert.match(source, /UptFormData\(\{ FormEngineKey: tableKey, Id: record.Id, _SysMenuId: menuId\(\), _RowModel: record \}\)/)
  assert.match(source, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  assert.match(source, /缺少菜单授权上下文/)
  assert.equal(generatedFormRoutePath(table), '/forms/biz_order')
  const parsed = parse(source, { filename: 'Form_Biz_Order.vue' })
  assert.deepEqual(parsed.errors, [])
  assert.ok(compileScript(parsed.descriptor, { id: 'form-codegen' }).content.includes('tableKey'))
  assert.deepEqual(compileTemplate({ source: parsed.descriptor.template.content, filename: 'Form_Biz_Order.vue', id: 'form-codegen' }).errors, [])
})

test('字段标签转义，复杂控件与动态数据源保留平台表单行为', () => {
  const source = generateFormVue(table, [{ Name: 'Name', Label: '<img src=x onerror=1>', Component: 'Text' }])
  assert.ok(!source.includes('<img src=x'))
  assert.match(source, /&lt;img src=x onerror=1&gt;/)
  assert.match(generateFormVue(table, [{ Name: 'Files', Component: 'FileUpload' }]), /action: 'openForm'/)
  assert.match(generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Sql"}' }]), /action: 'openForm'/)
  assert.match(generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Data"}', Data: '[{"Key":"A","Value":"可用"}]' }]), /可用/)
  assert.match(generateFormVue(table, [{ Name: 'Status', Component: 'Select', Config: '{"DataSource":"Data"}', Data: '[]' }]), /未配置选项，请输入/)
  assert.match(generateFormVue(table, [{ Name: 'Choices', Component: 'MultipleSelect', Data: '[]' }]), /action: 'openForm'/)
  assert.match(generateFormVue(table, [{ Name: 'Group', Component: 'CollapseGroup' }]), /action: 'openForm'/)
  assert.match(generateFormVue({ ...table, InFormV8: 'console.log(1)' }, fields), /action: 'openForm'/)
  assert.match(generateFormVue(table, [{ Name: 'Name', Component: 'Text', Config: { V8Code: 'return 1' } }]), /action: 'openForm'/)
  const withDisplay = generateFormVue(table, [...fields, { Name: 'SerialNo', Component: 'AutoNumber' }])
  assert.match(withDisplay, /"SerialNo": ""/)
  assert.match(withDisplay, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  const withReadonly = generateFormVue(table, [...fields, { Name: 'Locked', Component: 'Text', Readonly: 1 }])
  assert.match(withReadonly, /const editableFieldNames = \["Name","Quantity","Status"\]/)
  assert.ok(withReadonly.indexOf('>订单名称</th>') < withReadonly.indexOf('>Locked</th>'))
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


test('复杂表单入口可编译并携带准确菜单授权与宿主结果回执', () => {
  for (const field of [{Name:'Files',Component:'FileUpload'},{Name:'Children',Component:'TableChild'},{Name:'Name',Component:'Text',V8Code:'console.log(1)'}]) {
    const source=generateFormVue(table,[field]);const parsed=parse(source,{filename:'RuntimeForm.vue'});
    assert.deepEqual(parsed.errors,[]);assert.doesNotThrow(()=>compileScript(parsed.descriptor,{id:'runtime-form'}));
    assert.deepEqual(compileTemplate({source:parsed.descriptor.template.content,filename:'RuntimeForm.vue',id:'runtime-form'}).errors,[]);
    // 插值是 JavaScript 表达式，HTML 实体会使 vue-tsc 的表达式解析失败。
    assert.doesNotMatch(source,/row\[&quot;/);
    assert.match(source,/data: \{ tableName: tableKey, formMode, id, sysMenuId \}/);
    assert.match(source,/message\?\.hostActionResult/);assert.match(source,/removeDataListener/);
  }
})

test('基础表单按服务器有效字段权限隐藏并禁止提交只读列', () => {
  const source=generateFormVue(table,fields);
  assert.match(source,/v-if="canView\('Name'\)"/);assert.match(source,/!canEdit\('Name'\)/);
  assert.match(source,/editableFieldNames\.filter\(canEdit\)/);assert.match(source,/DataAppend\?\.FieldAccess/);
})
