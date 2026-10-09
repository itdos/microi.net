import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import ts from 'typescript'
import { parse as parseSfc, compileTemplate } from 'vue/compiler-sfc'
import * as vue from 'vue'
import * as serverRenderer from 'vue/server-renderer'
import * as versions from '../docs/.vitepress/theme/training-deck-versions.js'
import { enterpriseSlides } from '../docs/.vitepress/theme/enterprise-training-slides.js'
import { searchTrainingSlides } from '../docs/.vitepress/theme/training-syllabus-search.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(projectRoot, 'docs/public')
const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const artifacts = [
  { version: 'technical', dark: true, count: 47, url: '/downloads/microi-ai-development-framework-training-syllabus-dark.pptx' },
  { version: 'technical', dark: false, count: 47, url: '/downloads/microi-ai-development-framework-training-syllabus-light.pptx' },
  { version: 'enterprise', dark: true, count: 12, url: '/downloads/microi-enterprise-application-training-syllabus-dark.pptx' },
  { version: 'enterprise', dark: false, count: 12, url: '/downloads/microi-enterprise-application-training-syllabus-light.pptx' },
]

function artifactPath(url) {
  assert.match(url, /^\/downloads\/[a-z0-9-]+\.pptx$/u, 'PPTX downloads must use stable local filenames')
  return path.join(publicRoot, url.slice(1))
}

function findElements(node, predicate) {
  const result = node.type === 1 && predicate(node) ? [node] : []
  for (const child of node.children || []) result.push(...findElements(child, predicate))
  return result
}

function attribute(node, name) {
  return node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
}

function binding(node, name) {
  return node.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)?.exp?.content
}

// 复用企业版验收的方法，执行组件脚本本身；模板表达式用真实绑定自动解包，避免固定 computed 名称。
function componentRuntime(descriptor) {
  const source = ts.createSourceFile('TrainingSyllabusDeck.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const statements = source.statements.filter(statement => !ts.isImportDeclaration(statement))
  const bindingNames = statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations.map(declaration => declaration.name.getText(source))).filter(name => /^[A-Za-z_$][\w$]*$/u.test(name))
  const functionNames = statements.filter(ts.isFunctionDeclaration).map(statement => statement.name.text)
  const printed = ts.createPrinter().printFile(ts.factory.updateSourceFile(source, statements))
  const javascript = ts.transpileModule(printed, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const isDark = vue.ref(false)
  const mountedCallbacks = []
  const browser = { location: { hash: '', search: '' }, history: { replaceState() {} }, innerWidth: 1600, innerHeight: 900,
    addEventListener() {}, clearTimeout() {}, setTimeout() { return 0 } }
  class TestElement {}
  const dependencies = {
    ...vue, ...versions, enterpriseSlides, searchTrainingSlides,
    nextTick: callback => Promise.resolve().then(callback), onMounted: callback => mountedCallbacks.push(callback), onBeforeUnmount() {},
    useData: () => ({ isDark }), window: browser, document: { getElementById() { return null }, addEventListener() {} }, Element: TestElement, HTMLElement: TestElement,
  }
  // Node 23+ 的 CJS namespace 会额外暴露 `module.exports`；它是元数据而非可注入的 JS 标识符。
  const names = Object.keys(dependencies).filter(name => name !== 'default' && /^[A-Za-z_$][\w$]*$/u.test(name))
  const runtime = new Function(...names, `${javascript}\nreturn { ${[...bindingNames, ...functionNames].join(',')} };`)(...names.map(name => dependencies[name]))
  const templateContext = { ...runtime, isDark, trainingPptxPath: versions.trainingPptxPath }
  const templateScope = new Proxy({ ...dependencies, ...templateContext }, { has: (target, name) => Reflect.has(target, name), get: (target, name) => vue.unref(target[name]) })
  return { ...runtime, isDark, templateContext, async mount() { for (const callback of mountedCallbacks) await callback(); await vue.nextTick() },
    evaluate: expression => new Function('scope', `with (scope) { return (${expression}); }`)(templateScope) }
}

// 对真实工具栏执行 Vue SSR 编译与渲染，检查输出链接；单纯求值 href 无法发现水合保留旧属性。
function toolbarRenderer(descriptor) {
  const toolbar = findElements(descriptor.template.ast, element => attribute(element, 'class')?.split(/\s+/u).includes('mci-training-deck__top-actions'))[0]
  assert.ok(toolbar, 'the real presentation toolbar must exist')
  const compiled = compileTemplate({ id: 'training-pptx-toolbar', source: toolbar.loc.source, filename: 'TrainingSyllabusDeck.vue', ssr: true, ssrCssVars: [] })
  assert.deepEqual(compiled.errors, [])
  const source = ts.createSourceFile('TrainingToolbarSSR.js', compiled.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const dependencies = {}
  for (const statement of source.statements.filter(ts.isImportDeclaration)) {
    const module = statement.moduleSpecifier.text === 'vue' ? vue : statement.moduleSpecifier.text === 'vue/server-renderer' ? serverRenderer : null
    assert.ok(module, `unexpected SSR dependency: ${statement.moduleSpecifier.text}`)
    for (const specifier of statement.importClause.namedBindings.elements) dependencies[specifier.name.text] = module[specifier.propertyName?.text || specifier.name.text]
  }
  const statements = source.statements.filter(statement => !ts.isImportDeclaration(statement))
  const printed = ts.createPrinter().printFile(ts.factory.updateSourceFile(source, statements)).replace(/^export /gmu, '')
  const names = Object.keys(dependencies)
  const ssrRender = new Function(...names, `${printed}\nreturn ssrRender;`)(...names.map(name => dependencies[name]))
  return runtime => serverRenderer.renderToString(vue.createSSRApp({ setup: () => runtime.templateContext, ssrRender }))
}

// 从 ZIP 中央目录读取真实 OOXML，不把 PK 文件头或扩展名当作已生成 PowerPoint 的证明。
// 只解压需要的 XML，47 页大图课件不必把全部图片再次放进内存。
function openPptx(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'PPTX must begin with a real ZIP local header')
  let footer = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { footer = offset; break }
  }
  assert.ok(footer >= 0, 'ZIP central directory is missing or truncated')
  assert.equal(bytes.readUInt16LE(footer + 4), 0, 'downloads must be single-volume archives')
  assert.equal(bytes.readUInt16LE(footer + 6), 0)
  const entryCount = bytes.readUInt16LE(footer + 10)
  let cursor = bytes.readUInt32LE(footer + 16)
  const entries = new Map()
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50, 'invalid ZIP central entry')
    const flags = bytes.readUInt16LE(cursor + 8)
    assert.equal(flags & 1, 0, 'public training downloads must not be encrypted')
    const method = bytes.readUInt16LE(cursor + 10)
    const compressedSize = bytes.readUInt32LE(cursor + 20)
    const size = bytes.readUInt32LE(cursor + 24)
    const nameSize = bytes.readUInt16LE(cursor + 28)
    const extraSize = bytes.readUInt16LE(cursor + 30)
    const commentSize = bytes.readUInt16LE(cursor + 32)
    const offset = bytes.readUInt32LE(cursor + 42)
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8')
    assert.ok(!entries.has(name), `duplicate package member: ${name}`)
    assert.ok(!name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..'), `unsafe package member: ${name}`)
    entries.set(name, { method, compressedSize, size, offset })
    cursor += 46 + nameSize + extraSize + commentSize
  }
  return {
    names: [...entries.keys()],
    xml(name) {
      const entry = entries.get(name)
      assert.ok(entry, `missing OOXML member: ${name}`)
      assert.equal(bytes.readUInt32LE(entry.offset), 0x04034b50, `invalid local member: ${name}`)
      const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28)
      const compressed = bytes.subarray(start, start + entry.compressedSize)
      assert.equal(compressed.length, entry.compressedSize, `truncated member: ${name}`)
      const result = entry.method === 0 ? compressed : entry.method === 8 ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.size) }) : null
      assert.ok(result, `unsupported compression: ${name}`)
      assert.equal(result.length, entry.size, `incorrect member size: ${name}`)
      return result.toString('utf8')
    },
  }
}

function nativeText(xml) {
  return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gu)].map(match => match[1].replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, "'")).join('').replace(/\s+/gu, '')
}

test('同主题 PPTX 下载解析四个独立目标，未知版本安全回到技术版', () => {
  assert.equal(typeof versions.trainingPptxPath, 'function', 'the shared download selector must exist')
  for (const artifact of artifacts) assert.equal(versions.trainingPptxPath(artifact.version, artifact.dark), artifact.url)
  for (const unknown of [undefined, null, '', 'unknown', 'Enterprise', '../enterprise', 'https://example.invalid/deck', '__proto__', 'constructor']) {
    assert.equal(versions.trainingPptxPath(unknown, true), artifacts[0].url)
    assert.equal(versions.trainingPptxPath(unknown, false), artifacts[1].url)
  }
  assert.equal(new Set(artifacts.map(artifact => artifact.url)).size, 4)
})

test('真实 PPTX 下载按钮跟随课件版本与当前主题，PDF 下载继续保留', async () => {
  const component = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'), 'utf8')
  const { descriptor, errors } = parseSfc(component)
  assert.deepEqual(errors, [])
  const anchors = findElements(descriptor.template.ast, element => element.tag === 'a')
  const pptx = anchors.find(element => attribute(element, 'class')?.split(/\s+/u).includes('is-pptx'))
  assert.ok(pptx, 'the presentation toolbar must provide its own PPTX download')
  const label = binding(pptx, 'aria-label')
  assert.ok(label || attribute(pptx, 'aria-label'), 'the export control must have an accessible download name')
  assert.equal(attribute(pptx, 'type'), pptxMime, 'the download declares the PowerPoint MIME type')
  assert.ok(pptx.props.some(prop => prop.type === 6 && prop.name === 'download'))
  const href = binding(pptx, 'href')
  assert.ok(href, 'download URLs must react to edition and theme')
  const runtime = componentRuntime(descriptor)
  await runtime.mount()
  for (const artifact of artifacts) {
    runtime.switchVersion(artifact.version)
    runtime.isDark.value = artifact.dark
    assert.equal(runtime.evaluate(href), artifact.url)
    const accessibleName = label ? runtime.evaluate(label) : attribute(pptx, 'aria-label')
    assert.match(accessibleName, /下载.*PPTX/u)
    assert.ok(accessibleName.includes(artifact.dark ? '暗色' : '浅色') || accessibleName.includes('当前主题'), 'the accessible label must describe the selected theme')
    assert.equal(runtime.slideMeta.value.length, artifact.count, 'download and online deck must describe the same edition')
  }
  runtime.switchVersion('technical')
  runtime.isDark.value = false
  assert.equal(runtime.evaluate(href), artifacts[1].url, 'switching back restores the original technical download')
  assert.ok(anchors.some(element => attribute(element, 'aria-label') === '下载预生成暗色 PDF'))
  assert.ok(anchors.some(element => attribute(element, 'aria-label') === '下载预生成浅色 PDF'))
})

test('SSR 与挂载前不输出 PPTX，首次挂载按实际主题生成链接并保留 PDF', async () => {
  const component = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'), 'utf8')
  const { descriptor, errors } = parseSfc(component)
  assert.deepEqual(errors, [])
  const renderToolbar = toolbarRenderer(descriptor)
  const server = componentRuntime(descriptor)
  const serverHtml = await renderToolbar(server)
  assert.doesNotMatch(serverHtml, /class="is-pptx"|\.pptx/u, 'SSR must not freeze a light-theme PPTX href before the client theme is known')
  for (const initialDark of [true, false]) {
    const runtime = componentRuntime(descriptor)
    runtime.isDark.value = initialDark
    const beforeMount = await renderToolbar(runtime)
    assert.doesNotMatch(beforeMount, /class="is-pptx"|\.pptx/u, 'the first client render must preserve the SSR absence of the download control')
    for (const url of Object.values(versions.trainingPdfPaths.technical)) assert.ok(beforeMount.includes(`href="${url}"`), 'both PDF choices remain available before mount')
    await runtime.mount()
    const firstMounted = await renderToolbar(runtime)
    assert.ok(firstMounted.includes(`href="${versions.trainingPptxPath('technical', initialDark)}"`), 'the first inserted button must already target the actual persisted theme')
    assert.ok(firstMounted.includes(`aria-label="下载${initialDark ? '暗色' : '浅色'} PPTX"`))
    for (const artifact of artifacts) {
      runtime.switchVersion(artifact.version)
      runtime.isDark.value = artifact.dark
      const html = await renderToolbar(runtime)
      assert.equal((html.match(/class="is-pptx"/gu) || []).length, 1, 'mount and version/theme changes must keep exactly one PPTX control')
      assert.ok(html.includes(`href="${artifact.url}"`), 'the rendered export link must follow both state changes')
      for (const url of Object.values(versions.trainingPdfPaths[artifact.version])) assert.ok(html.includes(`href="${url}"`), 'PDF targets must still follow the selected edition')
    }
  }
})

for (const artifact of artifacts) {
  test(`${artifact.version}/${artifact.dark ? 'dark' : 'light'} PPTX 真实包含 ${artifact.count} 页可编辑文字、讲者备注与有效引用`, () => {
    const file = fs.readFileSync(artifactPath(artifact.url))
    const archive = openPptx(file)
    const slides = archive.names.filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    const notes = archive.names.filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(name))
    assert.equal(slides.length, artifact.count, 'download must contain the complete chosen edition')
    assert.equal(notes.length, artifact.count, 'every slide should retain its speaker notes')
    const contentTypes = archive.xml('[Content_Types].xml')
    assert.match(contentTypes, /ContentType="application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation\.main\+xml"/u)
    const presentation = archive.xml('ppt/presentation.xml')
    assert.equal([...presentation.matchAll(/<p:sldId\b/gu)].length, artifact.count)
    const size = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/u.exec(presentation)
    assert.ok(size, 'the exported presentation declares its page dimensions')
    assert.ok(Math.abs(Number(size[1]) / Number(size[2]) - 16 / 9) < 0.001, 'slides must retain the online 16:9 layout')
    const relationships = archive.xml('ppt/_rels/presentation.xml.rels')
    const referencedSlides = new Set([...relationships.matchAll(/<Relationship\b[^>]*>/gu)].filter(match => /Type="[^"]*\/slide"/u.test(match[0])).map(match => {
      const target = /Target="([^"]+)"/u.exec(match[0])?.[1]
      assert.ok(target, 'slide relationships require a target')
      return target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join('ppt', target))
    }))
    for (let index = 1; index <= artifact.count; index += 1) {
      const name = `ppt/slides/slide${index}.xml`
      assert.ok(slides.includes(name), `page numbering is incomplete: ${name}`)
      assert.ok(contentTypes.includes(`PartName="/${name}"`), `missing slide content type: ${name}`)
      assert.ok(referencedSlides.has(name), `unreferenced presentation slide ${index}`)
      const slide = archive.xml(name)
      const text = nativeText(slide)
      assert.ok(text.length > 10, `slide ${index} cannot be only a flattened image`)
      assert.ok(nativeText(archive.xml(`ppt/notesSlides/notesSlide${index}.xml`)).length > 10, `slide ${index} has no usable speaker notes`)
      if (artifact.version === 'enterprise') assert.ok(text.includes(enterpriseSlides[index - 1].title.replace(/\s+/gu, '')), `slide ${index} must keep its actual enterprise title editable`)
    }
  })
}
