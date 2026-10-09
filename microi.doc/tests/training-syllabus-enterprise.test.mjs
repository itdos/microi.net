import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { computed, ref } from 'vue'
import { enterpriseSlideCount, enterpriseSlides, enterpriseSections } from '../docs/.vitepress/theme/enterprise-training-slides.js'
import { parseTrainingHash, trainingHash, trainingPdfPaths } from '../docs/.vitepress/theme/training-deck-versions.js'
import * as trainingVersions from '../docs/.vitepress/theme/training-deck-versions.js'
import { searchTrainingSlides } from '../docs/.vitepress/theme/training-syllabus-search.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(projectRoot, 'docs/public')
const component = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'), 'utf8')
const { descriptor, errors } = parseSfc(component)
assert.deepEqual(errors, [], 'the real presentation component must remain valid Vue source')
const counts = { technical: 47, enterprise: 12 }
const slideText = slide => JSON.stringify(slide)
const audienceCopy = slide => [slide.nav, slide.title, slide.summary, slide.eyebrow, slide.lead, slide.takeaway, ...slide.cards.map(card => `${card.title} ${card.text}`), ...slide.steps, ...slide.metrics.map(metric => `${metric.value} ${metric.label} ${metric.note || ''}`)].join('\n')

function sourceForUrl(url) {
  const pathname = url.split(/[?#]/u)[0]
  if (pathname === '/doc/') return path.join(projectRoot, 'docs/doc/index.md')
  assert.match(pathname, /^\/(?:doc|case)\/[^?]+\.html$/u, `unsupported evidence URL: ${url}`)
  return path.join(projectRoot, 'docs', pathname.slice(1).replace(/\.html$/u, '.md'))
}

function publicFile(url) {
  assert.ok(url.startsWith('/') && !url.startsWith('//'), `asset must use a stable local path: ${url}`)
  const result = path.resolve(publicRoot, `.${url}`)
  assert.ok(result.startsWith(`${publicRoot}${path.sep}`), `asset escaped public root: ${url}`)
  return result
}

function elements(node, predicate) {
  const result = []
  if (node.type === 1 && predicate(node)) result.push(node)
  for (const child of node.children || []) result.push(...elements(child, predicate))
  return result
}

function textContent(node) {
  return node.type === 2 ? node.content : (node.children || []).map(textContent).join('')
}

function attribute(node, name) {
  return node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
}

function directive(node, name, argument) {
  return node.props.find(prop => prop.type === 7 && prop.name === name && prop.arg?.content === argument)?.exp?.content
}

// 执行组件自身的 TypeScript 脚本，保留真实 ref/computed；只替换浏览器和生命周期边界。
// 这样验证版本切换、页码、搜索和下载的联动，避免另写一套“应当正确”的导航实现。
function presentationRuntime() {
  const source = ts.createSourceFile('TrainingSyllabusDeck.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const withoutImports = ts.factory.updateSourceFile(source, source.statements.filter(statement => !ts.isImportDeclaration(statement)))
  const printed = ts.createPrinter().printFile(withoutImports)
  const javascript = ts.transpileModule(printed, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const isDark = ref(false)
  const location = { hash: '', search: '' }
  const browser = {
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash } },
    clearTimeout() {},
    setTimeout() { return 0 },
  }
  class TestElement {}
  const dependencies = {
    computed, ref,
    nextTick: callback => Promise.resolve().then(callback),
    onMounted() {}, onBeforeUnmount() {},
    useData: () => ({ isDark }),
    ...trainingVersions, searchTrainingSlides, enterpriseSlides, trainingPdfPaths, parseTrainingHash, trainingHash,
    window: browser, document: {}, Element: TestElement, HTMLElement: TestElement,
  }
  const names = Object.keys(dependencies)
  const runtime = new Function(...names, `${javascript}\nreturn { deckVersion, activeIndex, activePanel, searchKeyword, slideSearchContent, slideMeta, visibleSlides, currentSlide, pdfDownloadPaths, deckRef, isDark, switchVersion, nextSlide, previousSlide, goTo, thumbnailPath, handleHashChange, handleKeydown };`)(...Object.values(dependencies))
  runtime.deckRef.value = {
    querySelector(selector) {
      const slide = enterpriseSlides.find(item => selector === `#mci-training-${item.id}`)
      return slide ? { textContent: slideText(slide) } : { textContent: '技术架构正文', scrollTop: 0 }
    },
  }
  return { ...runtime, browser, flush: () => Promise.resolve().then(() => Promise.resolve()) }
}

test('技术旧分享锚点保持兼容，企业版每一页拥有独立可恢复的链接', () => {
  assert.equal(trainingHash('technical', 0), '#slide-01')
  assert.equal(trainingHash('technical', 46), '#slide-47')
  assert.equal(trainingHash('enterprise', 0), '#enterprise-slide-01')
  assert.equal(trainingHash('enterprise', 11), '#enterprise-slide-12')
  const allHashes = new Set()
  for (const [version, count] of Object.entries(counts)) {
    for (let index = 0; index < count; index += 1) {
      const hash = trainingHash(version, index)
      assert.deepEqual(parseTrainingHash(hash, counts), { version, index })
      assert.ok(!allHashes.has(hash), `share links collided: ${hash}`)
      allHashes.add(hash)
    }
  }
})

test('损坏、越界或其它页面的锚点不会误选课件', () => {
  for (const hash of ['', '#slide-00', '#slide-48', '#enterprise-slide-00', '#enterprise-slide-13', '#slide-1', '#slide-100', '#enterprise-slide-001', '#slide--1', '#slide-01-extra', '#Slide-01', '#other-slide-01', '#slide-０１', '#enterprise-slide-NaN', '#slide-01?version=enterprise']) {
    assert.equal(parseTrainingHash(hash, counts), null, hash)
  }
  assert.equal(parseTrainingHash('#enterprise-slide-01', { technical: 47 }), null, 'an unavailable edition cannot be restored')
  assert.equal(parseTrainingHash('#slide-01', { technical: 0, enterprise: 12 }), null, 'an empty deck has no first page')
})

test('12 页经营者课件覆盖产品、公开案例、选型优势与 Agent 交付经验', () => {
  assert.equal(enterpriseSlideCount, 12)
  assert.equal(enterpriseSlides.length, 12, 'the enterprise briefing must remain compact')
  assert.equal(new Set(enterpriseSlides.map(slide => slide.id)).size, 12)
  assert.deepEqual(enterpriseSlides.map(slide => slide.chapter), Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')))
  for (const slide of enterpriseSlides) {
    for (const key of ['nav', 'title', 'summary']) assert.ok(slide[key].trim(), `${slide.id}: missing audience-facing ${key}`)
    assert.ok(slide.cards.length >= 1 && slide.cards.length <= 3, `${slide.id}: the simplified edition needs at most three short points`)
    assert.ok(slide.sources.length, `${slide.id}: decisions and claims need a source`)
    assert.doesNotMatch(slideText(slide), /```|V8\.(?:FormEngine|Db|Http)|SELECT\s+.+FROM/iu, 'this edition should explain business decisions without code lessons')
  }
  assert.deepEqual(enterpriseSections.flatMap(section => section.slideIds), enterpriseSlides.map(slide => slide.id), 'the content outline must include each slide once in presentation order')
  const corpus = enterpriseSlides.map(audienceCopy).join('\n')
  for (const topic of [
    /客户.*领导.*经营者/u, /ERP/u, /CRM/u, /SRM/u, /OA/u, /工程|项目/u, /园区|物联/u,
    /公开成功案例/u, /关键优势|为什么选择/u, /会搭.*交付|Agent.*交付/u,
    /业务流程|业务目标|拆.*流程/u, /RAG|知识检索/u, /检索.*(?:稳|准|质量)|找准知识/u, /框架.*(?:交付|产品|可用)/u,
    /工具.*失败|失败.*兜底/u, /(?:任务|中断).*恢复/u, /上下文/u, /输出.*(?:检查|校验)/u, /人工/u,
    /部署/u, /隔离/u, /权限/u, /日志/u, /监控/u, /成本/u, /数据安全/u, /MCP/u, /多\s*Agent/u,
    /任务完成率/u, /工具成功率/u, /检索.*(?:命中|准确|质量)|知识.*正确/u, /响应时间|延迟/u, /Token/u, /Bad Case|错误样例/u, /基线/u,
  ]) assert.match(corpus, topic, `missing business or delivery topic: ${topic}`)
  assert.doesNotMatch(corpus, /提升\s*\d+\s*%|节省\s*\d+\s*%|收益增长\s*\d+/u, 'do not invent quantified customer returns')
})

test('成功案例的事实回到已有公开案例，产品设计示例保持明确标识', () => {
  const cases = enterpriseSlides.filter(slide => slide.layout === 'case')
  assert.equal(cases.length, 3)
  for (const slide of cases) {
    assert.match(slide.eyebrow, /公开成功案例/u)
    assert.ok(slide.image && slide.image.alt && slide.image.caption, `${slide.id}: the AI illustration needs accessible description`)
    assert.match(slide.image.caption, /AI\s*场景示意/u, 'an illustration cannot be presented as a customer screenshot')
    for (const source of slide.sources) {
      assert.ok(source.href.startsWith('/case/'), `${slide.id}: a general feature page cannot prove a customer case`)
      assert.ok(fs.existsSync(sourceForUrl(source.href)), source.href)
    }
  }
  const manufacturing = cases.find(slide => slide.sources.some(source => source.href === '/case/ims/ims-case1.html'))
  assert.ok(manufacturing, 'retain the published group manufacturing case')
  assert.equal(manufacturing.metrics.find(metric => metric.label.includes('第三方')).value, '11')
  assert.match(fs.readFileSync(sourceForUrl('/case/ims/ims-case1.html'), 'utf8'), /\*\*11\*\*\s*个第三方系统数据库/u)
  const workflowExample = enterpriseSlides.find(slide => slide.id === 'enterprise-ai-loop')
  assert.match(workflowExample.eyebrow, /设计示例/u)
  assert.doesNotMatch(workflowExample.eyebrow, /成功案例/u, 'a proposed AI workflow must not be promoted as a completed customer delivery')
})

test('证据链接与十二张独立 AI 场景图随官网源码完整交付', () => {
  const paths = new Set()
  const images = new Set()
  for (const slide of enterpriseSlides) {
    for (const source of slide.sources) assert.ok(fs.existsSync(sourceForUrl(source.href)), `${slide.id}: broken evidence link ${source.href}`)
    assert.ok(slide.image && slide.image.alt, `${slide.id}: every page needs its own described business image`)
    assert.match(slide.image.caption, /AI\s*场景示意/u, `${slide.id}: distinguish generated scenes from customer evidence`)
    assert.ok(slide.image.src.startsWith('/images/enterprise-training/ai/'), `${slide.id}: AI scenes must be delivered with the site`)
    assert.ok(!paths.has(slide.image.src), `${slide.id}: each page needs a distinct scene`)
    paths.add(slide.image.src)
    const file = fs.readFileSync(publicFile(slide.image.src))
    assert.ok(file.length > 1_000, `${slide.id}: a complete generated image must be present`)
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${slide.id}: published PNG is invalid`)
    assert.ok(!images.has(file.toString('base64')), `${slide.id}: do not reuse the same pixels for different scene files`)
    images.add(file.toString('base64'))
  }
  assert.equal(paths.size, 12)
})

test('品牌右侧两按钮真实驱动版本、下载、缩略图、搜索与分享恢复', async () => {
  const runtime = presentationRuntime()
  const identity = elements(descriptor.template.ast, element => attribute(element, 'class') === 'mci-training-deck__identity')[0]
  assert.ok(identity, 'version selection belongs beside Microi吾码 in the header')
  const buttons = elements(identity, element => element.tag === 'button')
  const technicalButton = buttons.find(button => textContent(button).trim() === '技术架构版')
  const enterpriseButton = buttons.find(button => textContent(button).trim() === '企业应用版')
  assert.ok(technicalButton && enterpriseButton)
  assert.notEqual(attribute(technicalButton, 'class'), attribute(enterpriseButton, 'class'), 'versions need distinct color roles')
  for (const [button, version] of [[technicalButton, 'technical'], [enterpriseButton, 'enterprise']]) {
    assert.equal(directive(button, 'bind', 'aria-pressed'), `deckVersion === '${version}'`)
    assert.ok(directive(button, 'on', 'click'))
  }
  assert.equal(runtime.slideMeta.value.length, 47)
  runtime.goTo(20)
  runtime.searchKeyword.value = '旧搜索条件'
  runtime.activePanel.value = 'help'
  new Function('switchVersion', directive(enterpriseButton, 'on', 'click'))(runtime.switchVersion)
  await runtime.flush()
  assert.equal(runtime.deckVersion.value, 'enterprise')
  assert.equal(runtime.activeIndex.value, 0)
  assert.equal(runtime.activePanel.value, '')
  assert.equal(runtime.searchKeyword.value, '')
  assert.equal(runtime.slideMeta.value.length, 12)
  assert.equal(runtime.browser.location.hash, '#enterprise-slide-01')
  assert.deepEqual(runtime.pdfDownloadPaths.value, trainingPdfPaths.enterprise)
  assert.equal(runtime.thumbnailPath(11), '/images/training-deck-enterprise/thumbs-light/slide-12.webp')
  runtime.isDark.value = true
  assert.equal(runtime.thumbnailPath(11), '/images/training-deck-enterprise/thumbs/slide-12.webp')
  runtime.searchKeyword.value = '上下文'
  assert.equal(runtime.visibleSlides.value.length, 1, 'search the current edition\'s actual indexed body')
  assert.equal(runtime.visibleSlides.value[0].slide.id, 'enterprise-agent-reliability')
  runtime.browser.location.hash = '#enterprise-slide-07'
  runtime.handleHashChange()
  assert.equal(runtime.activeIndex.value, 6)
  runtime.handleKeydown({ key: 'End', preventDefault() {} })
  assert.equal(runtime.activeIndex.value, 11)
  runtime.nextSlide()
  assert.equal(runtime.activeIndex.value, 11, 'navigation must stop at the enterprise deck boundary')
  runtime.browser.location.hash = '#enterprise-slide-13'
  runtime.handleHashChange()
  assert.equal(runtime.activeIndex.value, 11, 'invalid history cannot select a non-existent slide')
  runtime.browser.location.hash = '#slide-47'
  runtime.handleHashChange()
  await runtime.flush()
  assert.equal(runtime.deckVersion.value, 'technical')
  assert.equal(runtime.activeIndex.value, 46)
  assert.equal(runtime.searchKeyword.value, '')
  assert.deepEqual(runtime.pdfDownloadPaths.value, trainingPdfPaths.technical)
  assert.equal(runtime.thumbnailPath(46), '/images/training-deck/thumbs/slide-47.webp')
  new Function('switchVersion', directive(technicalButton, 'on', 'click'))(runtime.switchVersion)
  assert.equal(runtime.activeIndex.value, 0)

  const anchors = elements(descriptor.template.ast, element => element.tag === 'a')
  for (const [label, binding] of [['下载预生成暗色 PDF', 'pdfDownloadPaths.dark'], ['下载预生成浅色 PDF', 'pdfDownloadPaths.light']]) {
    const anchor = anchors.find(element => attribute(element, 'aria-label') === label)
    assert.ok(anchor, label)
    assert.equal(directive(anchor, 'bind', 'href'), binding, 'both download controls must follow the chosen edition')
    assert.ok(anchor.props.some(prop => prop.type === 6 && prop.name === 'download'))
  }
})

test('企业暗浅 PDF 下载与在线页数匹配，技术版下载仍独立保留', () => {
  const paths = Object.values(trainingPdfPaths).flatMap(edition => Object.values(edition))
  assert.equal(new Set(paths).size, 4, 'no edition or theme may overwrite another download')
  for (const [version, themes] of Object.entries(trainingPdfPaths)) {
    for (const [theme, url] of Object.entries(themes)) {
      const file = fs.readFileSync(publicFile(url))
      assert.equal(file.subarray(0, 5).toString('ascii'), '%PDF-', `${version}/${theme}: invalid download`)
      assert.ok(file.length > 250_000, `${version}/${theme}: incomplete slide download`)
      const body = file.toString('latin1')
      assert.equal([...body.matchAll(/\/Type\s*\/Page(?=[\s/])/gu)].length, counts[version], `${version}/${theme}: PDF page count must match this edition`)
      assert.match(body, new RegExp(`/Count\\s+${counts[version]}\\b`, 'u'))
      assert.equal([...body.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+960\s+540\s*\]/gu)].length, counts[version], `${version}/${theme}: all pages retain 16:9 dimensions`)
    }
  }
  assert.notEqual(Buffer.compare(fs.readFileSync(publicFile(trainingPdfPaths.enterprise.dark)), fs.readFileSync(publicFile(trainingPdfPaths.enterprise.light))), 0, 'the light PDF must not reuse dark bytes')
})

test('企业预览完整提供 12 页独立暗浅缩略图，顺序和下载页码一致', () => {
  const rendered = {}
  for (const [theme, folder] of [['dark', 'thumbs'], ['light', 'thumbs-light']]) {
    const root = publicFile(`/images/training-deck-enterprise/${folder}`)
    const files = fs.readdirSync(root).filter(name => /^slide-\d{2}\.webp$/u.test(name)).sort()
    assert.deepEqual(files, Array.from({ length: 12 }, (_, index) => `slide-${String(index + 1).padStart(2, '0')}.webp`))
    rendered[theme] = files.map(name => {
      const bytes = fs.readFileSync(path.join(root, name))
      assert.ok(bytes.length > 1_000, `${theme}/${name}: empty preview`)
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF')
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP')
      return bytes
    })
    assert.equal(new Set(rendered[theme].map(bytes => bytes.toString('base64'))).size, 12, 'different slide titles and content must produce distinct previews')
  }
  for (let index = 0; index < 12; index += 1) assert.notEqual(Buffer.compare(rendered.dark[index], rendered.light[index]), 0, `slide ${index + 1}: light previews cannot reuse dark pixels`)
})
