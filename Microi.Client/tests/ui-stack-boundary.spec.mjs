import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(fullPath) : [fullPath]
})

test('first-party UI stack is Element Plus + ECharts + Monaco', () => {
  const packageJson = JSON.parse(read('package.json'))
  const dependencies = packageJson.dependencies || {}
  for (const removed of ['chart.js', 'vue-chart-3', 'codemirror', '@codemirror/lang-html', '@codemirror/theme-one-dark']) {
    assert.equal(dependencies[removed], undefined, `${removed} must not remain a direct dependency`)
  }
  for (const retained of ['element-plus', 'echarts', 'vue-echarts', 'monaco-editor']) {
    assert.ok(dependencies[retained], `${retained} is part of the supported first-party UI stack`)
  }

  const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(?:js|ts|vue)$/.test(file))
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /from\s+['"](?:chart\.js|vue-chart-3|codemirror|@codemirror\/)/, file)
  }

  assert.match(read('src/views/page-engine/engine/components/vuechart/PieChart.vue'), /from 'echarts\/core'/)
  assert.match(read('src/views/page-engine/engine/components/monaco-html-editor/index.vue'), /MicroiCodeEditor/)
  assert.match(read('src/views/page-engine/engine/components/codemirror/index.vue'), /MonacoHtmlEditor/)
  assert.match(read('src/views/form-engine/diy-field-component/diy-code-editor.vue'), /loadMonaco/)
})

test('Naive UI and VChart stay inside the lazy GoView compatibility boundary', () => {
  const sourceRoot = path.join(root, 'src')
  const goViewRoot = path.normalize(path.join(sourceRoot, 'views', 'go-view')) + path.sep
  const importPattern = /from\s+['"](?:naive-ui(?:\/[^'"]*)?|@visactor\/vchart(?:\/[^'"]*)?)['"]/g

  for (const file of walk(sourceRoot).filter((item) => /\.(?:js|ts|vue)$/.test(item))) {
    const source = fs.readFileSync(file, 'utf8')
    if (!importPattern.test(source)) continue
    assert.ok(path.normalize(file).startsWith(goViewRoot), `compatibility dependency escaped GoView: ${file}`)
    importPattern.lastIndex = 0
  }

  const router = read('src/router/index.js')
  assert.match(router, /component:\s*\(\)\s*=>\s*import\("@\/views\/go-view\/editor\.vue"\)/)
  assert.match(router, /component:\s*\(\)\s*=>\s*import\("@\/views\/go-view\/preview\.vue"\)/)
  const vite = read('vite.config.js')
  assert.match(vite, /includes\('@visactor'\)\) return 'vchart'/)
  assert.match(vite, /includes\('naive-ui'\)\) return 'go-view-ui'/)
})
