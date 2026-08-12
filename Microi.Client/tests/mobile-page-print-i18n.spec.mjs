import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const han = /[\u3400-\u9fff]/

const templateOf = (source) => (source.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '')
  .replace(/<!--[\s\S]*?-->/g, '')

test('mobile pages have no demo business records or leading source markers', () => {
  const files = ['home.vue', 'profile.vue', 'chat.vue', 'workspace.vue', 'message.vue', 'ai-assistant.vue']
  for (const file of files) {
    const source = read(`src/views/mobile/${file}`)
    assert.doesNotMatch(source, /^\s*\?/, `${file} must not start with an accidental ?`)
    assert.equal(han.test(templateOf(source)), false, `${file} template contains a non-i18n Chinese literal`)
  }

  const home = read('src/views/mobile/home.vue')
  assert.doesNotMatch(home, /张三|李四|春节通知|请假|报销/)
  assert.match(home, /WorkFlow\/getWFWork/)
  assert.match(home, /diy_notice/)
  assert.match(home, /const todoList\s*=\s*ref\(\[\]\)/)
  assert.match(home, /const noticeList\s*=\s*ref\(\[\]\)/)
})

test('Page and Print primary designer shells render through the shared locale', () => {
  const files = [
    'src/views/page-engine/engine/components/form-designer/layout/layout-header.vue',
    'src/views/print-engine/engine/components/print-designer.vue',
  ]
  for (const file of files) {
    const source = read(file)
    assert.equal(han.test(templateOf(source)), false, `${file} template contains a non-i18n Chinese literal`)
    assert.match(source, /Msg\.(?:PageEngine|PrintEngine)\./)
  }

  const locale = read('src/lang/platform-ui.js')
  assert.match(locale, /PageEngine: pageEngineZhCn/)
  assert.match(locale, /PrintEngine: printEngineZhCn/)
  assert.match(locale, /PageEngine: pageEngineEn/)
  assert.match(locale, /PrintEngine: printEngineEn/)
})
