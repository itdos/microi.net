import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const formUrl = new URL('../src/views/form-engine/diy-form.vue', import.meta.url)
const styleUrl = new URL('../src/views/form-engine/styles/diy-form.scss', import.meta.url)

test('字段说明按标签方向直接呈现且不再使用信息图标提示', async () => {
  const [source, styles] = await Promise.all([
    readFile(formUrl, 'utf8'),
    readFile(styleUrl, 'utf8')
  ])

  assert.equal(source.includes('<InfoFilled'), false)
  assert.equal(source.includes('GetLabelPosition(field) === \'top\''), true)
  assert.equal(source.includes('GetLabelPosition(field) !== \'top\''), true)
  assert.equal((source.match(/diy-field-description--inline/g) || []).length, 2)
  assert.equal((source.match(/diy-field-description--below/g) || []).length, 2)
  assert.match(styles, /\.diy-field-description--inline[\s\S]*text-overflow:\s*ellipsis/)
  assert.match(styles, /\.diy-field-description--below[\s\S]*line-clamp:\s*2/)
})
