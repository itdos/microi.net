import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseSfc, compileTemplate } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { computed, ref, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { enterpriseSlideCount, enterpriseSlides, enterpriseSections } from '../docs/.vitepress/theme/enterprise-training-slides.js'
import { parseTrainingHash, trainingHash, trainingPdfPaths } from '../docs/.vitepress/theme/training-deck-versions.js'
import * as trainingVersions from '../docs/.vitepress/theme/training-deck-versions.js'
import { searchTrainingSlides } from '../docs/.vitepress/theme/training-syllabus-search.js'
import { verifiedTrainingAssetPath } from '../scripts/prepare-training-downloads.mjs'
import { verifiedDocAssetPath } from '../scripts/prepare-doc-assets.mjs'
import * as commonContent from '../docs/.vitepress/theme/common-training-content.js'
import { trainingCaseAssets } from '../docs/.vitepress/theme/training-case-assets.js'
import { trainingEngineAssets } from '../docs/.vitepress/theme/training-engine-assets.js'
import { trainingPreviewAssets, trainingPreviewPath } from '../docs/.vitepress/theme/training-previews.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const component = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'), 'utf8')
const { descriptor, errors } = parseSfc(component)
assert.deepEqual(errors, [], 'the real presentation component must remain valid Vue source')
const counts = { technical: 47, enterprise: 10 }

test('体验链接准确覆盖指定七图，技术引擎配图全部使用已验签的轻量CDN资源', () => {
  const linked = trainingCaseAssets.filter(asset => asset.experienceUrl)
  assert.equal(linked.length, 7)
  assert.deepEqual(linked.map(asset => [asset.fileName, asset.experienceUrl]), [
    ['microi-enterprise-iot-01.png', 'https://static.itdos.com/itdos/micro-app/warehouse-strategy-twin/index.html'],
    ['microi-enterprise-iot-02.png', 'https://static.itdos.com/itdos/micro-app/microi-ningbo-city-mall/index.html'],
    ['microi-enterprise-iot-03.png', 'https://static.itdos.com/itdos/micro-app/microi-ningbo-city-mall/index.html'],
    ['microi-enterprise-games-01.png', 'https://microi.net/apps.html?category=game'],
    ['microi-enterprise-games-02.png', 'https://static.itdos.com/itdos/micro-app/microi-unity-cs/index.html'],
    ['microi-enterprise-games-03.png', 'https://static.itdos.com/itdos/micro-app/gomoku-3d-cocos-arena/index.html'],
    ['microi-enterprise-games-04.png', 'https://static.itdos.com/itdos/micro-app/xiangqi-3d-cocos-arena/index.html'],
  ])
  const ids = [...component.matchAll(/id: '([^']+)', domain:/gu)].map(match => match[1])
  assert.equal(ids.length, 38)
  assert.deepEqual(Object.keys(trainingEngineAssets).sort(), ids.sort())
  for (const assets of Object.values(trainingEngineAssets)) for (const asset of assets) {
    assert.ok(asset.bytes > 1000 && asset.bytes < 1000000)
    assert.match(asset.url, /^https:\/\/file\.microi\.net\/itdos\/official-docs\/images\//u)
    assert.ok(asset.url.includes(asset.sha256))
    assert.equal(asset.mimeType, 'image/jpeg')
    assert.ok(Date.parse(asset.verifiedAt))
    if (asset.kind === 'diagram') assert.ok(asset.alt.includes('非系统截图'))
  }
})
const slideText = slide => JSON.stringify(slide)

function sourceForUrl(url) {
  const pathname = url.split(/[?#]/u)[0]
  if (pathname === '/doc/' || pathname === '/contact/') return path.join(projectRoot, `docs${pathname}index.md`)
  assert.match(pathname, /^\/(?:doc|case)\/[^?]+\.html$/u, `unsupported evidence URL: ${url}`)
  return path.join(projectRoot, 'docs', pathname.slice(1).replace(/\.html$/u, '.md'))
}

function scriptRuntime(sfc, dependencies, returns) {
  const source = ts.createSourceFile('Training.ts', sfc.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const withoutImports = ts.factory.updateSourceFile(source, source.statements.filter(statement => !ts.isImportDeclaration(statement)))
  const javascript = ts.transpileModule(ts.createPrinter().printFile(withoutImports), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  return new Function(...Object.keys(dependencies), `${javascript}\nreturn { ${returns} };`)(...Object.values(dependencies))
}

// 用真实子组件模板生成搜索正文，包含共用页的循环内容，避免只索引元数据而漏掉能力说明。
async function renderedSlide(componentName, props) {
  const { descriptor: sfc, errors } = parseSfc(fs.readFileSync(path.join(projectRoot, `docs/.vitepress/theme/components/${componentName}.vue`), 'utf8'))
  assert.deepEqual(errors, [])
  const compiled = compileTemplate({ source: sfc.template.content, id: componentName, filename: `${componentName}.vue` })
  assert.deepEqual(compiled.errors, [])
  const code = compiled.code.replace(/import \{([^}]+)\} from "vue"/gu, (_all, names) => `const {${names.replace(/ as /gu, ': ')}} = Vue`).replace('export function render', 'return function render')
  const render = new Function('Vue', code)(Vue)
  const bindings = componentName === 'CommonTrainingSlide' ? scriptRuntime(sfc, {
    computed, ...commonContent, defineProps: () => props, withDefaults: (values, defaults) => ({ ...defaults, ...values }), defineEmits() {},
  }, 'props, isEnterprise, page, coverRoute') : {}
  const html = await renderToString(createSSRApp({ setup: () => ({ ...commonContent, ...props, ...bindings }), render }))
  return html.replace(/<[^>]*>/gu, ' ').replace(/&(?:amp|lt|gt|quot|#39);/gu, value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[value])).replace(/\s+/gu, ' ')
}

const enterpriseBodies = await Promise.all(enterpriseSlides.map((slide, index) => renderedSlide(slide.commonKind ? 'CommonTrainingSlide' : 'EnterpriseTrainingSlide', slide.commonKind
  ? { kind: slide.commonKind, version: 'enterprise', title: slide.title, summary: slide.summary, index, total: counts.enterprise }
  : { slide, index })))

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
  const isDark = ref(false)
  const location = { hash: '', search: '' }
  const browser = {
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash } },
    clearTimeout() {},
    setTimeout() { return 0 },
  }
  class TestElement { focus() { this.focused = true } }
  const document = { activeElement: null }
  const dependencies = {
    computed, ref,
    nextTick: callback => Promise.resolve().then(callback),
    onMounted() {}, onBeforeUnmount() {},
    useData: () => ({ isDark }),
    ...trainingVersions, searchTrainingSlides, enterpriseSlides, trainingPdfPaths, parseTrainingHash, trainingHash,
    trainingPreviewPath,
    window: browser, document, Element: TestElement, HTMLElement: TestElement,
  }
  const runtime = scriptRuntime(descriptor, dependencies, 'deckVersion, activeIndex, activePanel, searchKeyword, slideSearchContent, slideMeta, visibleSlides, currentSlide, pdfDownloadPaths, deckRef, isDark, switchVersion, nextSlide, previousSlide, goTo, thumbnailPath, handleHashChange, handleKeydown, commonKind, previewImage, imageZoom, previewCloseRef, previewDialogRef, openPreview, closePreview, railCollapsed, indexSlideContent, progress, handleWheel, handlePointerDown, handlePointerUp')
  runtime.deckRef.value = {
    querySelector(selector) {
      const index = enterpriseSlides.findIndex(item => selector === `#mci-training-${item.id}`)
      return index >= 0 ? { textContent: enterpriseBodies[index] } : { textContent: '技术架构正文', scrollTop: 0 }
    },
  }
  return { ...runtime, browser, document, TestElement, flush: () => Promise.resolve().then(() => Promise.resolve()) }
}

test('技术旧分享锚点保持兼容，企业版每一页拥有独立可恢复的链接', () => {
  assert.equal(trainingHash('technical', 0), '#slide-01')
  assert.equal(trainingHash('technical', 46), '#slide-47')
  assert.equal(trainingHash('enterprise', 0), '#enterprise-slide-01')
  assert.equal(trainingHash('enterprise', 9), '#enterprise-slide-10')
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
  for (const hash of ['', '#slide-00', '#slide-48', '#enterprise-slide-00', '#enterprise-slide-11', '#enterprise-slide-12', '#enterprise-slide-13', '#slide-1', '#slide-100', '#enterprise-slide-001', '#slide--1', '#slide-01-extra', '#Slide-01', '#other-slide-01', '#slide-０１', '#enterprise-slide-NaN', '#slide-01?version=enterprise']) {
    assert.equal(parseTrainingHash(hash, counts), null, hash)
  }
  assert.equal(parseTrainingHash('#enterprise-slide-01', { technical: 47 }), null, 'an unavailable edition cannot be restored')
  assert.equal(parseTrainingHash('#slide-01', { technical: 0, enterprise: 10 }), null, 'an empty deck has no first page')
})

test('10 页企业版依用户顺序覆盖平台、系统选型和五类行业案例', () => {
  assert.equal(enterpriseSlideCount, 10)
  assert.equal(enterpriseSlides.length, 10)
  assert.equal(new Set(enterpriseSlides.map(slide => slide.id)).size, 10)
  assert.deepEqual(enterpriseSlides.map(slide => slide.chapter), Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0')))
  assert.deepEqual(enterpriseSlides.map(slide => slide.nav), ['企业版开场', '框架/系统架构重要性', '为什么选择吾码？', '成功案例总览', '大型MES', '数字孪生/IoT物联网', 'OA/ERP', '游戏', '更多成功案例', '致辞'])
  for (const slide of enterpriseSlides) {
    for (const key of ['nav', 'title', 'summary']) assert.ok(slide[key].trim(), `${slide.id}: missing audience-facing ${key}`)
    assert.doesNotMatch(slideText(slide), /```|V8\.(?:FormEngine|Db|Http)|SELECT\s+.+FROM/iu, 'this edition should explain business decisions without code lessons')
  }
  assert.deepEqual(enterpriseSections.flatMap(section => section.slideIds), enterpriseSlides.map(slide => slide.id), 'the content outline must include each slide once in presentation order')
  const corpus = enterpriseBodies.join('\n')
  assert.doesNotMatch(corpus, /提升\s*\d+\s*%|节省\s*\d+\s*%|收益增长\s*\d+/u, 'do not invent quantified customer returns')
  assert.doesNotMatch(corpus, /AI\s*界面概念图|enterprise-agent-reliability|企业应用版/u, 'the obsolete enterprise AI lesson has been replaced')
  const requirements = new Map([
    [4, ['上千人工厂', '中大型工厂', '上市公司', '15+', '工艺流程', '采购协同', '计划排产（APS）', '生产派工', '车间管理', '质量管理', '仓储管理', '设备管理', '设备机联', '模具管理', 'BOM', '计件工资', '能耗管理', '追溯', '报表看板', '移动端现场流程办公', '蓝牙打印', '金蝶 / 用友流程对接打通', '实施、交付人员可在线调整']],
    [5, ['AI + Blender / CAD / 3ds Max + Three.js / Unity', '无需人工从零绘图、建模', '照片 / 视频完成AI建模', '30+引擎', 'Socket', 'MQTT', 'TCP透传', '设备与网关', 'Zigbee', 'RS-485', 'Modbus']],
    [6, ['多家国企', '集团公司', 'OA办公系统', '服装ERP', '慈溪服装工厂', '100余家', 'SaaS引擎模式', '电器ERP', '轻量级ERP']],
    [7, ['游戏服务器端', '玩家数据管理', '实时通信', '类CS', '棋牌游戏', '几天', '可商用交付产品']],
    [8, ['500余套软件', 'CRM客户关系', 'CMS内容管理', 'B2C商城', '酒店管理', '财税服务', '考试系统', '售后系统', '企业服务平台', '商会管理', '互联网平台', '欢迎联系我们参观更多成功案例']],
  ])
  for (const [index, phrases] of requirements) for (const phrase of phrases) assert.ok(enterpriseBodies[index].includes(phrase), `${enterpriseSlides[index].nav}: missing requirement ${phrase}`)
})

test('两版前三页和致辞复用真实组件，完整重现用户要求的优势与架构选型', async () => {
  const runtime = presentationRuntime()
  for (const [index, commonKind] of [[0, 'cover'], [1, 'decision'], [2, 'why'], [46, 'closing']]) assert.equal(runtime.commonKind(runtime.slideMeta.value[index]), commonKind)
  runtime.switchVersion('enterprise')
  for (const [index, commonKind] of [[0, 'cover'], [1, 'decision'], [2, 'why'], [9, 'closing']]) assert.equal(runtime.commonKind(runtime.slideMeta.value[index]), commonKind)
  assert.match(component, /<CommonTrainingSlide v-if="commonKind\(slide\)"/u)
  const benefits = ['AI 低代码开发', 'V8 引擎 AI 编程', '微服务定制', '0 代码自然语言构建大型系统', '无需编译发布', '微软 NuGet 下载量 1189万+', '截止2026年10月16日']
  for (const version of ['technical', 'enterprise']) {
    for (const kind of ['cover', 'closing']) {
      const text = await renderedSlide('CommonTrainingSlide', { kind, version, total: counts[version] })
      for (const benefit of benefits) assert.ok(text.includes(benefit), `${version}/${kind}: missing core benefit ${benefit}`)
    }
  }
  assert.match(enterpriseBodies[0], /企业版介绍.*以成功案例为路线.*开始介绍/u)
  assert.match(await renderedSlide('CommonTrainingSlide', { kind: 'cover', version: 'technical' }), /技术培训大纲.*以功能点为路线，现场了解平台.*开始培训/u)
  for (const phrase of ['绝大部分研发团队', '前端框架', '后端框架', '表单引擎', '工作流引擎', '打印引擎', '分布式缓存', '分布式存储', '30+', 'Codex / WorkBuddy 直接开发软件', 'Codex / WorkBuddy + 系统框架底座', '软件产品', '8', '年', 'ChatGPT、Opus', '连续对话多年', '高性能分布式', '1 年以上', '大概率', '成熟系统框架', '至关重要', '优秀的开源系统框架很多', '许多企业', '全方位对比']) assert.ok(enterpriseBodies[1].includes(phrase), `framework selection: missing ${phrase}`)
  assert.doesNotMatch(enterpriseBodies[1], /AI直接从需求开始开发自由度高/u)
  for (const phrase of ['系统灵活性做到极致', '图片 / 文件上传', '模块引擎列、搜索、按钮、卡片', '1189', '万+', '截止2026年10月16日']) assert.ok(enterpriseBodies[2].includes(phrase), `why Microi: missing ${phrase}`)
  assert.equal(commonContent.trainingArchitectureImage.src, 'https://file.microi.net/itdos/official-docs/images/a35ae58a338f6b32f032d64a3ccf4fea1f7fad6cc42de9897907ffcfa1974f4d/202610/microi-ai-platform-architecture-2026_09_04_1.svg')
})

test('四类案例保留21张原图、移除指定OA图，并补充3张更多行业案例', () => {
  const cases = enterpriseSlides.filter(slide => slide.layout === 'case')
  assert.equal(cases.length, 4)
  assert.equal(trainingCaseAssets.length, 24)
  assert.equal(new Set(trainingCaseAssets.map(asset => asset.url)).size, 24)
  assert.equal(new Set(trainingCaseAssets.map(asset => asset.sha256)).size, 24)
  assert.deepEqual(cases.flatMap(slide => slide.gallery), trainingCaseAssets.filter(asset => asset.group !== 'more'))
  assert.deepEqual(cases.map(slide => slide.gallery.length), [5, 6, 6, 4])
  assert.equal(enterpriseSlides[8].gallery.length, 3)
  assert.ok(!trainingCaseAssets.some(asset => asset.fileName === 'microi-enterprise-oaerp-05.png'))
  for (const asset of trainingCaseAssets) {
    assert.ok(asset.bytes > 1000)
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u)
    assert.match(asset.mimeType, /^image\/(jpeg|png|webp)$/u)
    assert.ok(asset.alt.length > 5)
    assert.ok(asset.verifiedAt && Number.isFinite(Date.parse(asset.verifiedAt)))
    const url = new URL(asset.url)
    assert.equal(url.origin, 'https://file.microi.net')
    assert.equal(url.search + url.hash, '')
    assert.ok(url.pathname.startsWith(`/itdos/official-docs/images/${asset.sha256}/`))
    assert.ok(url.pathname.endsWith(`/${asset.fileName}`))
  }
  for (const slide of enterpriseSlides) for (const source of slide.sources) assert.ok(fs.existsSync(sourceForUrl(source.href)), source.href)
  const enterprise = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/EnterpriseTrainingSlide.vue'), 'utf8')
  assert.match(enterprise, /v-for="\(asset,i\) in slide\.gallery"/u)
  assert.match(enterprise, /<img :src="asset\.url" :alt="asset\.alt"/u)
  assert.match(enterprise, /@click="\$emit\('preview',\{src:asset\.url,alt:asset\.alt\}\)"/u)
  assert.doesNotMatch(enterprise, /\.slice\(|AI\s*界面概念图|enterprise-training\/ai/u)
})

test('品牌右侧两按钮真实驱动版本、下载、缩略图、搜索与分享恢复', async () => {
  const runtime = presentationRuntime()
  const identity = elements(descriptor.template.ast, element => attribute(element, 'class') === 'mci-training-deck__identity')[0]
  assert.ok(identity, 'version selection belongs beside Microi吾码 in the header')
  const buttons = elements(identity, element => element.tag === 'button')
  const technicalButton = buttons.find(button => textContent(button).trim() === '技术架构版')
  const enterpriseButton = buttons.find(button => textContent(button).trim() === '企业版')
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
  assert.equal(runtime.slideMeta.value.length, 10)
  assert.equal(runtime.browser.location.hash, '#enterprise-slide-01')
  assert.deepEqual(runtime.pdfDownloadPaths.value, trainingPdfPaths.enterprise)
  assert.equal(runtime.thumbnailPath(9), trainingPreviewPath('enterprise', 9, false))
  runtime.isDark.value = true
  assert.equal(runtime.thumbnailPath(9), trainingPreviewPath('enterprise', 9, true))
  runtime.searchKeyword.value = 'Modbus'
  assert.equal(runtime.visibleSlides.value.length, 1, 'search the current edition\'s actual indexed body')
  assert.equal(runtime.visibleSlides.value[0].slide.id, 'enterprise-iot')
  runtime.searchKeyword.value = 'ChatGPT'
  assert.deepEqual(runtime.visibleSlides.value.map(result => result.index), [1], 'shared component body participates in enterprise search')
  runtime.searchKeyword.value = '下载量'
  assert.deepEqual(runtime.visibleSlides.value.map(result => result.index), [0, 2, 9], 'all repeated opening advantages remain searchable')
  runtime.browser.location.hash = '#enterprise-slide-07'
  runtime.handleHashChange()
  assert.equal(runtime.activeIndex.value, 6)
  runtime.handleKeydown({ key: 'End', preventDefault() {} })
  assert.equal(runtime.activeIndex.value, 9)
  runtime.nextSlide()
  assert.equal(runtime.activeIndex.value, 9, 'navigation must stop at the enterprise deck boundary')
  runtime.browser.location.hash = '#enterprise-slide-13'
  runtime.handleHashChange()
  assert.equal(runtime.activeIndex.value, 9, 'invalid history cannot select a non-existent slide')
  runtime.browser.location.hash = '#slide-47'
  runtime.handleHashChange()
  await runtime.flush()
  assert.equal(runtime.deckVersion.value, 'technical')
  assert.equal(runtime.activeIndex.value, 46)
  assert.equal(runtime.searchKeyword.value, '')
  assert.deepEqual(runtime.pdfDownloadPaths.value, trainingPdfPaths.technical)
  assert.equal(runtime.thumbnailPath(46), trainingPreviewPath('technical', 46, true))
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
      const file = fs.readFileSync(verifiedTrainingAssetPath(url))
      assert.equal(file.subarray(0, 5).toString('ascii'), '%PDF-', `${version}/${theme}: invalid download`)
      assert.ok(file.length > 250_000, `${version}/${theme}: incomplete slide download`)
      const body = file.toString('latin1')
      assert.equal([...body.matchAll(/\/Type\s*\/Page(?=[\s/])/gu)].length, counts[version], `${version}/${theme}: PDF page count must match this edition`)
      assert.match(body, new RegExp(`/Count\\s+${counts[version]}\\b`, 'u'))
      // 当前生成器为每页显式写入 MediaBox；Chromium 的打印单位会产生小数取整，
      // 因而检查全部实际几何与统一尺寸，不把某一组整数写法当作16:9本身。
      const boxes = [...body.matchAll(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/gu)].map(match => match.slice(1).map(Number))
      assert.equal(boxes.length, counts[version], `${version}/${theme}: each page must declare its dimensions`)
      const firstWidth = boxes[0][2] - boxes[0][0]
      const firstHeight = boxes[0][3] - boxes[0][1]
      for (const [index, box] of boxes.entries()) {
        assert.ok(box.every(Number.isFinite), `${version}/${theme}/${index + 1}: invalid PDF coordinates`)
        assert.equal(box[0], 0)
        assert.equal(box[1], 0)
        const width = box[2] - box[0], height = box[3] - box[1]
        assert.ok(width > 0 && height > 0 && Math.abs(width / height - 16 / 9) <= 0.001, `${version}/${theme}/${index + 1}: ${width}x${height} must retain 16:9`)
        assert.ok(Math.abs(width - firstWidth) <= 0.01 && Math.abs(height - firstHeight) <= 0.01, `${version}/${theme}/${index + 1}: page size must remain consistent`)
      }
    }
  }
  assert.notEqual(Buffer.compare(fs.readFileSync(verifiedTrainingAssetPath(trainingPdfPaths.enterprise.dark)), fs.readFileSync(verifiedTrainingAssetPath(trainingPdfPaths.enterprise.light))), 0, 'the light PDF must not reuse dark bytes')
})

test('企业目录跳转、手机翻页和原图弹层驱动组件真实状态并保护焦点', async () => {
  const runtime = presentationRuntime()
  runtime.switchVersion('enterprise', 3)
  await runtime.flush()
  const enterprise = parseSfc(fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/EnterpriseTrainingSlide.vue'), 'utf8')).descriptor
  const jumpButton = elements(enterprise.template.ast, node => node.tag === 'button' && directive(node, 'on', 'click')?.includes("$emit('jump'"))[0]
  assert.ok(jumpButton)
  const emit = (event, payload) => event === 'jump' ? runtime.goTo(payload) : runtime.openPreview(payload)
  for (const [offset, card] of enterpriseSlides[3].cards.entries()) {
    new Function('$emit', 'card', directive(jumpButton, 'on', 'click'))(emit, card)
    assert.equal(runtime.activeIndex.value, offset + 4)
    assert.equal(runtime.currentSlide.value.nav, card.title)
    assert.equal(runtime.browser.location.hash, trainingHash('enterprise', offset + 4))
  }

  const pager = elements(descriptor.template.ast, node => attribute(node, 'class') === 'mci-training-mobile-pager')[0]
  assert.equal(attribute(pager, 'aria-label'), '幻灯片翻页')
  const pagerButtons = elements(pager, node => node.tag === 'button')
  const select = elements(pager, node => node.tag === 'select')[0]
  assert.equal(directive(pagerButtons[0], 'bind', 'disabled'), 'activeIndex === 0')
  assert.equal(directive(pagerButtons[1], 'bind', 'disabled'), 'activeIndex === slideMeta.length - 1')
  assert.equal(directive(select, 'bind', 'value'), 'activeIndex')
  assert.equal(attribute(select, 'aria-label'), '选择幻灯片页码')
  const change = ts.transpileModule(directive(select, 'on', 'change'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('goTo', '$event', change)(runtime.goTo, { target: { value: '0' } })
  assert.equal(runtime.activeIndex.value, 0)
  new Function('previousSlide', `return ${directive(pagerButtons[0], 'on', 'click')}`)(runtime.previousSlide)()
  assert.equal(runtime.activeIndex.value, 0)
  new Function('nextSlide', `return ${directive(pagerButtons[1], 'on', 'click')}`)(runtime.nextSlide)()
  assert.equal(runtime.activeIndex.value, 1)
  runtime.goTo(99)
  assert.equal(runtime.activeIndex.value, 9)

  const galleryButton = elements(enterprise.template.ast, node => node.tag === 'button' && directive(node, 'on', 'click')?.includes("$emit('preview'"))[0]
  const originalFocus = new runtime.TestElement()
  runtime.document.activeElement = originalFocus
  runtime.previewCloseRef.value = new runtime.TestElement()
  for (const asset of trainingCaseAssets) {
    // 模拟每次 v-if 新挂载的原生 dialog，验证真实 openPreview 进入顶层模态层。
    const modal = { open: false, showCalls: 0, showModal() { this.open = true; this.showCalls += 1 }, close() { this.open = false }, querySelectorAll() { return [] } }
    runtime.previewDialogRef.value = modal
    new Function('$emit', 'asset', directive(galleryButton, 'on', 'click'))(emit, asset)
    await runtime.flush()
    assert.equal(modal.open, true)
    assert.equal(modal.showCalls, 1)
    assert.deepEqual(runtime.previewImage.value, { src: asset.url, alt: asset.alt })
    assert.equal(runtime.previewCloseRef.value.focused, true)
    runtime.imageZoom.value = true
    runtime.handleKeydown({ key: 'ArrowLeft', preventDefault() { assert.fail('preview must not handle presentation arrows') } })
    assert.equal(runtime.activeIndex.value, 9)
    runtime.handleKeydown({ key: 'Escape', preventDefault() {} })
    await runtime.flush()
    assert.equal(runtime.previewImage.value, null)
    assert.equal(runtime.imageZoom.value, false)
    assert.equal(originalFocus.focused, true)
  }
  const common = parseSfc(fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/theme/components/CommonTrainingSlide.vue'), 'utf8')).descriptor
  const architectureButton = elements(common.template.ast, node => attribute(node, 'aria-label') === '全屏查看 Microi吾码系统架构图')[0]
  new Function('$emit', 'trainingArchitectureImage', directive(architectureButton, 'on', 'click'))(emit, commonContent.trainingArchitectureImage)
  assert.deepEqual(runtime.previewImage.value, commonContent.trainingArchitectureImage)
  const parentPreview = elements(descriptor.template.ast, node => node.tag === 'EnterpriseTrainingSlide')[0]
  assert.equal(directive(parentPreview, 'on', 'jump'), 'goTo')
  assert.equal(directive(parentPreview, 'on', 'preview'), 'openPreview')
  const dialog = elements(descriptor.template.ast, node => attribute(node, 'aria-label') === '全屏图片查看')[0]
  assert.equal(dialog.tag, 'dialog', 'native modal top layer must cover the site navigation as well as the deck')
  assert.equal(attribute(dialog, 'ref'), 'previewDialogRef')
  assert.equal(attribute(dialog, 'role'), 'dialog')
  assert.equal(attribute(dialog, 'aria-modal'), 'true')
})

test('企业预览完整提供10页独立暗浅缩略图，顺序和下载页码一致', () => {
  for (const [edition, index] of [['other', 0], ['enterprise', -1], ['enterprise', 10], ['enterprise', 1.5], ['technical', 47]]) assert.equal(trainingPreviewPath(edition, index, true), '', 'invalid previews must not silently display another page')
  const rendered = {}
  for (const theme of ['dark', 'light']) {
    const assets = trainingPreviewAssets.filter(asset => asset.edition === 'enterprise' && asset.theme === theme).sort((left, right) => left.index - right.index)
    assert.deepEqual(assets.map(asset => asset.index), Array.from({ length: 10 }, (_, index) => index + 1))
    rendered[theme] = assets.map(asset => {
      assert.equal(trainingPreviewPath('enterprise', asset.index - 1, theme === 'dark'), asset.url)
      const bytes = fs.readFileSync(verifiedDocAssetPath(asset.url, trainingPreviewAssets))
      assert.ok(bytes.length > 1_000, `${theme}/${asset.index}: empty preview`)
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF')
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP')
      return bytes
    })
    assert.equal(new Set(rendered[theme].map(bytes => bytes.toString('base64'))).size, 10, 'different slide titles and content must produce distinct previews')
  }
  for (let index = 0; index < 10; index += 1) assert.notEqual(Buffer.compare(rendered.dark[index], rendered.light[index]), 0, `slide ${index + 1}: light previews cannot reuse dark pixels`)
})
