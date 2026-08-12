import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { platformUiMessages } from '../src/lang/platform-ui.js'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(clientRoot, relativePath), 'utf8')
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(fullPath) : [fullPath]
})

const outerTemplate = source => {
  const start = source.search(/<template\b/iu)
  const script = source.search(/<script\b/iu)
  const end = source.lastIndexOf('</template>', script)
  return start >= 0 && end > start ? source.slice(start, end + 11) : ''
}

test('Page and Print templates contain no unbound Chinese UI literals', () => {
  for (const relativeRoot of ['src/views/page-engine', 'src/views/print-engine']) {
    for (const file of walk(path.join(clientRoot, relativeRoot)).filter(item => item.endsWith('.vue'))) {
      const template = outerTemplate(fs.readFileSync(file, 'utf8'))
        .replace(/<!--[\s\S]*?-->/gu, '')
        .replace(/\{\{[\s\S]*?\}\}/gu, '')
        .replace(/(?:^|\s):[\w-]+\s*=\s*"[^"]*"/gu, '')
      assert.doesNotMatch(template, /(?:aria-label|start-placeholder|end-placeholder|range-separator|label|title|placeholder|confirm-button-text|cancel-button-text)\s*=\s*"[^"]*\p{Script=Han}/u, file)
      assert.doesNotMatch(template, />[^<>{}]*\p{Script=Han}[^<>{}]*</u, file)
    }
  }
})

test('every built-in Page property and Print provider label has an English locale value', () => {
  const pageTable = platformUiMessages.en.Msg.PageEngine.literal
  const builtInDirectory = path.join(clientRoot, 'src/views/page-engine/engine/utils/builtWidget')
  const labels = new Set()
  for (const file of walk(builtInDirectory).filter(item => item.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\blabel\s*:\s*['"]([^'"]*\p{Script=Han}[^'"]*)['"]/gu)) labels.add(match[1])
  }
  assert.ok(labels.size >= 300, 'the built-in property audit unexpectedly became too small')
  for (const label of labels) assert.ok(pageTable[label], `missing Page Engine locale: ${label}`)

  const printTable = platformUiMessages.en.Msg.PrintEngine.literal
  for (const relativePath of [
    'src/views/print-engine/engine/utils/provider1.js',
    'src/views/print-engine/engine/utils/provider2.js',
  ]) {
    const source = read(relativePath)
    for (const match of source.matchAll(/printT\('([^']+)'\)/gu)) {
      assert.ok(printTable[match[1]], `missing Print Engine locale: ${match[1]}`)
    }
  }
})

test('every static Page and Print template translator call has an English locale value', () => {
  const translators = [
    ['src/views/page-engine', '$pet', platformUiMessages.en.Msg.PageEngine.literal],
    ['src/views/print-engine', '$prt', platformUiMessages.en.Msg.PrintEngine.literal],
  ]

  for (const [relativeRoot, helper, localeTable] of translators) {
    const escapedHelper = helper.replace('$', '\\$')
    const callPattern = new RegExp(`${escapedHelper}\\(['\"]([^'\"]+)['\"]\\)`, 'gu')
    for (const file of walk(path.join(clientRoot, relativeRoot)).filter(item => item.endsWith('.vue'))) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(callPattern)) {
        assert.ok(localeTable[match[1]], `${file}: missing locale for ${helper}('${match[1]}')`)
      }
    }
  }
})

test('dynamic built-in labels pass through the locale-owned compatibility translator', () => {
  assert.match(read('src/views/page-engine/engine/components/form-designer/layout/layout-left.vue'), /\$pet\(item\.label\)/)
  const widgetAttr = read('src/views/page-engine/engine/components/form-designer/widget/widget-attr.vue')
  assert.match(widgetAttr, /\$pet\(item\.label\)/)
  assert.match(widgetAttr, /\$pet\(option\.label\)/)
  assert.match(read('src/main.js'), /\$pet[\s\S]+translateEngineLiteral\("PageEngine"/)
  assert.match(read('src/main.js'), /\$prt[\s\S]+translateEngineLiteral\("PrintEngine"/)
})
