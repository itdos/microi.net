import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPageVueSource,
  canonicalPageSourceJson,
  parsePageVueSource,
} from '../src/views/page-engine/source-bridge.js'

const page = () => ({
  Id: '01TESTPAGE',
  Number: 'ai-command-center',
  Title: 'AI 指挥中心',
  JsonObj: {
    wrapperList: [{
      type: 'wrapper',
      wrapperOption: { number: 'w1', title: '运行态' },
      widgetList: [{ type: 'html', widgetOption: { number: 'x1', html: '</script><b>安全内容</b>' } }],
    }],
    formConfig: { gutter: 12, dark: true },
  },
})

test('界面设计可确定性生成有效 Vue SFC 并无损回导', async () => {
  const first = await buildPageVueSource(page())
  const second = await buildPageVueSource(page())
  assert.equal(first.source, second.source)
  assert.equal(first.hash, second.hash)
  assert.match(first.fileName, /ai-command-center\.microi-page\.vue$/)
  assert.match(first.source, /<MicroiPageRenderer/)
  assert.match(first.source, /@microi-page-schema:begin/)
  assert.equal((first.source.match(/<\/script>/g) || []).length, 1, '页面内容不得提前闭合 script')
  const parsed = await parsePageVueSource(first.source)
  assert.equal(parsed.sourceChanged, false)
  assert.equal(canonicalPageSourceJson(parsed.page), canonicalPageSourceJson(page()))
})

test('人工编辑桥接区只解析 JSON、不执行任意 Vue 代码，并标记内容变化', async () => {
  const built = await buildPageVueSource(page())
  const changedSource = built.source
    .replace('"Title": "AI 指挥中心"', '"Title": "AI 协同指挥中心"')
    .replace('</script>', 'globalThis.__microiShouldNotRun = true\n</script>')
  delete globalThis.__microiShouldNotRun
  const parsed = await parsePageVueSource(changedSource)
  assert.equal(parsed.sourceChanged, true)
  assert.equal(parsed.page.Title, 'AI 协同指挥中心')
  assert.equal(globalThis.__microiShouldNotRun, undefined)
})

test('拒绝任意 SFC、损坏摘要和原型污染字段', async () => {
  await assert.rejects(() => parsePageVueSource('<template><div /></template>'), /不是 Microi吾码界面源码桥接文件/)
  const built = await buildPageVueSource(page())
  await assert.rejects(() => parsePageVueSource(built.source.replace(/\/\/ @microi-page-schema-sha256:[0-9a-f]+/, '')), /缺少有效的 SHA-256/)
  const polluted = JSON.parse('{"JsonObj":{"formConfig":{},"wrapperList":[]},"__proto__":{"polluted":true}}')
  await assert.rejects(() => buildPageVueSource(polluted), /禁止字段/)
  assert.equal({}.polluted, undefined)
})
