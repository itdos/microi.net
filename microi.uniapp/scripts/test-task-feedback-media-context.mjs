import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { parse, compileTemplate } = require('@vue/compiler-sfc')
const source = readFileSync(new URL('../src/pages/native/task-feedback.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = descriptor.script.content
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
  .replace('export default', 'const component =')

test('完成服务页模板可编译，仍为照片与视频分别传递字段上下文', () => {
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'task-feedback.vue', id: 'task-feedback' })
  assert.deepEqual(compiled.errors, [])
  assert.match(descriptor.template.content, /taskFileContext\('JieguoTP'\)/)
  assert.match(descriptor.template.content, /taskFileContext\('ShipinSC'\)/)
})

function fixture(definitions, menu = { Id: 'task-menu' }) {
  const calls = []
  const component = vm.runInNewContext(`${script}\ncomponent`, {
    themeMixin: {},
    buildFriendShare: () => ({}), buildTimelineShare: () => ({}),
    V8: {}, findMenu: async () => menu,
    loadNativeFormDefinition: async (_table, refresh, options) => {
      calls.push({ refresh, options })
      return definitions[refresh ? 1 : 0]
    },
    loadTask: async () => ({}), loadTaskDevices: async () => [],
    readTaskDraft: () => null, removeTaskDraft: () => {},
    runTaskAction: async () => ({}), writeTaskDraft: () => {}
  })
  const page = { ...component.data(), taskId: 'reopened-task' }
  page.prepareTaskFileContexts = component.methods.prepareTaskFileContexts.bind(page)
  page.taskFileContext = component.methods.taskFileContext.bind(page)
  return { page, calls }
}

test('视频字段缺失时已保存的私有照片仍取得自己的记录级授权上下文', async () => {
  const definition = { fields: [{ Name: 'JieguoTP', Id: 'photo-field' }] }
  const { page, calls } = fixture([definition, definition])
  await page.prepareTaskFileContexts()
  assert.equal(calls.length, 2)
  assert.deepEqual(JSON.parse(JSON.stringify(page.taskFileContext('JieguoTP'))), {
    formEngineKey: 'Diy_ShouhouDD', formDataId: 'reopened-task', fieldId: 'photo-field', sysMenuId: 'task-menu'
  })
  assert.equal(page.taskFileContext('ShipinSC').failClosed, true)
  assert.match(page.fileContextError, /视频/)
})

test('首次元数据缓存缺项时强制刷新，恢复照片和视频的独立上下文', async () => {
  const { page, calls } = fixture([
    { fields: [] },
    { fields: [{ Name: 'JieguoTP', Id: 'photo-field' }, { Name: 'ShipinSC', Id: 'video-field' }] }
  ])
  await page.prepareTaskFileContexts()
  assert.deepEqual(calls.map((call) => call.refresh), [false, true])
  assert.equal(page.taskFileContext('JieguoTP').fieldId, 'photo-field')
  assert.equal(page.taskFileContext('ShipinSC').fieldId, 'video-field')
  assert.equal(page.fileContextError, '')
})

test('无售后菜单授权时私有照片仍失败关闭，不能拼公开直链', async () => {
  const { page } = fixture([{ fields: [] }], null)
  await page.prepareTaskFileContexts()
  assert.equal(page.taskFileContext('JieguoTP').failClosed, true)
  assert.match(page.fileContextError, /菜单权限/)
})

test('照片字段确实无权限时不借用视频字段授权', async () => {
  const definition = { fields: [{ Name: 'ShipinSC', Id: 'video-field' }] }
  const { page } = fixture([definition, definition])
  await page.prepareTaskFileContexts()
  assert.equal(page.taskFileContext('JieguoTP').failClosed, true)
  assert.equal(page.taskFileContext('ShipinSC').fieldId, 'video-field')
  assert.match(page.fileContextError, /照片/)
})

test('元数据刷新暂时失败仍保留首次取得的照片字段授权', async () => {
  const { page } = fixture([{ fields: [{ Name: 'JieguoTP', Id: 'photo-field' }] }])
  await page.prepareTaskFileContexts()
  assert.equal(page.taskFileContext('JieguoTP').fieldId, 'photo-field')
  assert.equal(page.taskFileContext('ShipinSC').failClosed, true)
})
