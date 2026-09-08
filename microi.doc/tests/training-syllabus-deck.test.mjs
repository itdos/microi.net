import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staticPdfPaths = [
  path.join(projectRoot, 'docs/public/downloads/microi-ai-development-framework-training-syllabus-dark.pdf'),
  path.join(projectRoot, 'docs/public/downloads/microi-ai-development-framework-training-syllabus-light.pdf'),
]
const thumbnailRoots = {
  dark: path.join(projectRoot, 'docs/public/images/training-deck/thumbs'),
  light: path.join(projectRoot, 'docs/public/images/training-deck/thumbs-light'),
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

test('training syllabus route mounts the dedicated HTML presentation', () => {
  const page = read('docs/doc/about/microi-training-syllabus.md')
  const profiles = read('docs/.vitepress/theme/doc-visual-profiles.js')
  const theme = read('docs/.vitepress/theme/index.ts')

  assert.match(page, /pageClass: mci-training-ppt-page/)
  assert.match(page, /<TrainingSyllabusDeck\s*\/>/)
  assert.match(page, /Microi吾码 AI 开发框架技术培训大纲/)
  assert.doesNotMatch(page, /^##\s+一、/mu, 'the old Markdown syllabus should not remain')
  assert.match(profiles, /'about\/microi-training-syllabus': 'showcase'/)
  assert.match(theme, /import TrainingSyllabusDeck from "\.\/components\/TrainingSyllabusDeck\.vue"/)
  assert.match(theme, /component\('TrainingSyllabusDeck', TrainingSyllabusDeck\)/)
  assert.match(theme, /styles\/training-syllabus-deck\.scss/)
})

test('presentation covers the complete technical learning path', () => {
  const component = read('docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')
  const engineBlock = /const engineSlides: EngineSlide\[\] = \[([\s\S]*?)\r?\n\]\r?\n\r?\n\/\/ 这些是官网左侧导航中的关键交付入口/u.exec(component)?.[1] || ''
  const engineCount = [...engineBlock.matchAll(/^\s+id: '[^']+'/gmu)].length
  const supplementalBlock = /const atlasSupplementalEntries: AtlasEntry\[\] = \[([\s\S]*?)\r?\n\]/u.exec(component)?.[1] || ''
  const supplementalCount = [...supplementalBlock.matchAll(/^\s+\{ id: '[^']+'/gmu)].length

  assert.equal(engineCount, 37)
  assert.equal(supplementalCount, 6)
  assert.match(component, /const expectedSlideCount = 46/)
  for (const phrase of [
    '开源 AI 开发框架',
    '10×+',
    'Token 更省*',
    'AI 开发更快*',
    '企业研发，为什么要先选一套开源 AI 开发框架？',
    '为什么选择吾码？',
    '三种方式开始使用，再让 AI 接管开发环境',
    'Docker 一键安装',
    '官网注册并开通免费 SaaS 租户',
    '@microi.net/cli',
    '30+ 引擎总览',
    'MCP 智能交付',
    'MCP 让 AI 理解、操作并验收真实平台',
    '业务蓝图',
    '万物皆表单',
    '接口引擎',
    '原数据源引擎已并入接口引擎',
    'V8 / SQL / JSON',
    '界面引擎',
    '模板引擎',
    '打印引擎',
    '报表引擎',
    '查询、编辑，并联动多表多库的可写报表',
    '工作流引擎',
    '邮箱系统',
    '独立 Web 运行',
    '吾码微服务运行',
    '完整源码与业务扩展',
    'AI 引擎',
    'AI 数据分析',
    '用自然语言，把业务数据变成可执行经营结论',
    'AI 创作中心',
    '从一个想法，完成图片、视频、声音与音乐创作',
    '29 项工具',
    '视觉引擎',
    '翻译引擎（多语言）',
    'Office 引擎 / 在线编辑',
    '分布式存储 / HDFS',
    '文件柜',
    'AI 开发工具（VS Code + CLI）',
    'MCP Server 完整指南',
    'PC、WebOS 与移动端',
    '系统设置',
    '蓝牙打印机',
    'SaaS 引擎',
    'L1 + L2 多级缓存',
    '一套业务能力，进入企业每一个终端',
    '微信小程序',
    '支付宝小程序',
    '抖音小程序',
    'Android App',
    'iOS App',
    '跨越行业边界，让业务价值落地',
    '工业制造',
    '商贸与消费',
    '组织与经营',
    '园区与公共服务',
    '专业服务',
    '物流与农业',
  ]) assert.ok(component.includes(phrase), `missing syllabus topic: ${phrase}`)

  assert.match(component, /典型平台能力高复用场景，实际收益取决于需求与团队基线/)
  assert.match(component, /class="mci-engine-slide-title"[\s\S]*\{\{ slide\.engine\.nav \}\}[\s\S]*\{\{ slide\.title \}\}/u)
  assert.match(component, /const atlasEntryIds = atlasGroups\.flatMap/u)
  assert.doesNotMatch(component, /nav: '视觉识别'/u)
  assert.match(component, /OsClient、OsClientType、OsClientNetwork/s)
  assert.match(component, /Code=1 自动提交.*自动回滚/s)
  assert.match(component, /href="\/doc\/getting-started\/docker-run\.html" target="_blank"/)
  assert.match(component, /href="\/login\.html\?tab=register" target="_blank"/)
  assert.match(component, /:href="slide\.engine\.href" target="_blank"/)
  assert.match(component, /:href="entry\.href" target="_blank"/)
  assert.match(component, /href="\/case\/case-index\.html" target="_blank"/)
  assert.doesNotMatch(engineBlock, /id: 'datasource-engine'/u)
  assert.doesNotMatch(component, /https?:\/\//u, 'the deck should not depend on remote media')
})

test('slide 03 presents a compact, persuasive Microi enterprise advantage matrix', () => {
  const component = read('docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')
  const advantageBlock = /const whyAdvantages: WhyAdvantage\[\] = \[([\s\S]*?)\r?\n\]/u.exec(component)?.[1] || ''
  const advantageCount = [...advantageBlock.matchAll(/^\s+no: '\d{2}'/gmu)].length

  assert.equal(advantageCount, 8)
  for (const phrase of [
    "nav: '为什么选择吾码？'",
    "title: '为什么选择吾码？'",
    '一句话，<em>开发大型企业应用</em>',
    '零代码 AI 对话',
    '跨平台全端',
    '高性能底座',
    '分布式原生',
    '插件化引擎',
    '微服务扩展',
    '全自动化测试',
    '企业级治理',
    "['AI 对话建模', '自动实现', '全自动测试', '受控发布', '运行治理']",
    "['开源可控', 'SaaS 多租户', '多数据库', '全端统一']",
    '零代码提速，工程化不设上限',
  ]) assert.ok(component.includes(phrase), `missing slide 03 advantage: ${phrase}`)

  assert.match(component, /whyAdvantagesOn\('left'\)/u)
  assert.match(component, /whyAdvantagesOn\('right'\)/u)
  assert.match(component, /aria-label="从需求到运行治理的五步闭环"/u)
  assert.doesNotMatch(component, /吾码绝对优势/u)
})

test('presentation supports mouse, keyboard, fullscreen, thumbnail navigation, and direct PDF download', () => {
  const component = read('docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')

  for (const token of [
    "'ArrowRight'",
    "'ArrowLeft'",
    "'PageDown'",
    "'PageUp'",
    "key === 'Home'",
    "key === 'End'",
    'handleWheel',
    'wheelAccumulator',
    'wheelDirection',
    'if (intentDirection > 0) nextSlide()',
    'handlePointerDown',
    'handlePointerUp',
    'requestFullscreen',
    'document.exitFullscreen',
    'mci-training-deck__rail',
    'mci-training-deck__thumbnail',
    "const { isDark } = useData()",
    "isDark.value ? 'thumbs' : 'thumbs-light'",
    ':src="thumbnailPath(index)"',
    'pdfDownloadPaths',
    'downloadPdf()',
    ':href="pdfDownloadPaths.dark"',
    ':href="pdfDownloadPaths.light"',
    'download aria-label="下载预生成暗色 PDF"',
    'download aria-label="下载预生成浅色 PDF"',
    '暗色 PDF',
    '浅色 PDF',
    'frame.scrollHeight > frame.clientHeight',
    'aria-roledescription="slide"',
    'aria-keyshortcuts="P"',
  ]) assert.ok(component.includes(token), `missing interaction contract: ${token}`)

  assert.doesNotMatch(component, /openPanel\('overview'\)/u)
  assert.doesNotMatch(component, /window\.print\s*\(/u)
  assert.doesNotMatch(component, /window\.(?:alert|confirm|prompt)\s*\(/u)
})

test('pre-generated dark and light PDFs are published as stable high-quality downloads', () => {
  for (const staticPdfPath of staticPdfPaths) {
    assert.ok(fs.existsSync(staticPdfPath), `the downloadable PDF must exist before publish: ${staticPdfPath}`)
    const stat = fs.statSync(staticPdfPath)
    const pdf = fs.readFileSync(staticPdfPath)
    assert.ok(stat.size > 250_000, 'each PDF should contain the complete high-quality vector deck')
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
    assert.match(pdf.toString('latin1'), /\/Count\s+46\b/u, 'each static PDF should contain all 46 slides')
  }
})

test('the preview rail publishes a complete thumbnail set for each theme', () => {
  for (const [theme, root] of Object.entries(thumbnailRoots)) {
    const files = fs.readdirSync(root).filter(name => /^slide-\d{2}\.webp$/u.test(name)).sort()
    assert.equal(files.length, 46, `${theme} theme should contain all 46 thumbnails`)
    assert.equal(files[0], 'slide-01.webp')
    assert.equal(files.at(-1), 'slide-46.webp')
    for (const name of files) {
      const file = fs.readFileSync(path.join(root, name))
      assert.ok(file.length > 1_000, `${theme}/${name} should be a real rendered preview`)
      assert.equal(file.subarray(0, 4).toString('ascii'), 'RIFF')
      assert.equal(file.subarray(8, 12).toString('ascii'), 'WEBP')
    }
  }

  const darkFirst = fs.readFileSync(path.join(thumbnailRoots.dark, 'slide-01.webp'))
  const lightFirst = fs.readFileSync(path.join(thumbnailRoots.light, 'slide-01.webp'))
  assert.notEqual(Buffer.compare(darkFirst, lightFirst), 0, 'light thumbnails must not reuse dark pixels')
})

test('official engine docs reflect the integrated data, writable report, and multilevel cache model', () => {
  const mapping = read('docs/mapping_zh.json')
  const api = read('docs/doc/v8-engine/api-engine.md')
  const legacyDataSource = read('docs/doc/system-engine/datasource-engine.md')
  const report = read('docs/doc/system-engine/report-engine.md')
  const cache = read('docs/doc/system-engine/cache.md')

  assert.doesNotMatch(mapping, /"datasource-engine\.md"\s*:\s*"数据源引擎"/u)
  assert.match(api, /原独立“数据源引擎”的全部能力已并入接口引擎/u)
  assert.match(api, /DataSourceType[\s\S]*V8[\s\S]*SQL[\s\S]*JSON/u)
  assert.match(legacyDataSource, /已不再作为独立引擎、新建入口或培训专题/u)
  assert.match(report, /可增删改查的写入型报表/u)
  assert.match(report, /多张业务表[\s\S]*多个已配置数据库/u)
  assert.match(cache, /L1 \+ L2 多级缓存/u)
  assert.match(cache, /ConcurrentDictionary[\s\S]*Redis Pub\/Sub/u)
})

test('every internal training and case link resolves to a published source page', () => {
  const component = read('docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')
  const urls = new Set([
    ...[...component.matchAll(/href:\s*'([^']+)'/gu)].map(match => match[1]),
    ...[...component.matchAll(/href="(\/[^"{]+)"/gu)].map(match => match[1]),
  ])

  for (const url of urls) {
    const pathname = url.split(/[?#]/u)[0]
    if (pathname === '/login.html' || pathname.startsWith('#')) continue

    let sourcePath
    if (/^\/(?:doc|case)\/.*\.html$/u.test(pathname)) {
      sourcePath = path.join(projectRoot, 'docs', pathname.replace(/^\//u, '').replace(/\.html$/u, '.md'))
    } else if (pathname.startsWith('/images/')) {
      sourcePath = path.join(projectRoot, 'docs/public', pathname.replace(/^\//u, ''))
    } else {
      continue
    }
    assert.ok(fs.existsSync(sourcePath), `broken internal training link: ${url} -> ${sourcePath}`)
  }
})

test('presentation styles provide isolated responsive, motion, and 16:9 print contracts', () => {
  const styles = read('docs/.vitepress/theme/styles/training-syllabus-deck.scss')

  for (const token of [
    '.mci-training-ppt-page',
    '.mci-training-deck:fullscreen',
    '.mci-training-deck__rail',
    '.mci-training-deck__thumbnail',
    '.mci-training-deck .mci-training-slide.is-active',
    '@media (min-width: 1440px) and (min-height: 800px)',
    'Presentation typography ladder',
    '@media (max-width: 767px)',
    '@media (prefers-reduced-motion: reduce)',
    '@media (prefers-contrast: more)',
    '@media print',
    '@page',
    'size: 13.333in 7.5in',
    'page-break-after: always',
    'min-height: 44px',
    'env(safe-area-inset-bottom)',
    'mciDeckBackgroundSweep',
    'mciDeckSlideSweep',
    'mciDeckNodeFloat',
    '.mci-engine-layout',
    '.mci-engine-visual',
    '.mci-atlas-directory',
    'grid-template-columns: repeat(3, minmax(0, 1fr))',
    'grid-template-rows: repeat(2, minmax(0, 1fr))',
    '.mci-device-constellation',
    'pointer-events: none',
    '.mci-device-links { position: relative; z-index: 5;',
    'translate: -50% -50%',
    'translate: none',
    '.mci-device-constellation { display: grid; grid-template-columns: 1fr; flex: 0 0 auto;',
    '@media (min-width: 2200px) and (min-height: 1200px)',
    'mciDeckCardScan',
  ]) assert.ok(styles.includes(token), `missing style contract: ${token}`)

  assert.doesNotMatch(styles, /^(?:button|img|h1|h2)\s*\{/mu, 'generic selectors must remain scoped to the deck')
})

test('dark and light PDF actions keep theme-independent WCAG-readable color pairs', () => {
  const styles = read('docs/.vitepress/theme/styles/training-syllabus-deck.scss')
  const readHexToken = (name) => {
    const match = styles.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'iu'))
    assert.ok(match, `missing PDF action color token: ${name}`)
    return match[1]
  }
  const rgb = value => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16))
  const luminance = (value) => {
    const channels = rgb(value).map(channel => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }

  for (const [foreground, background] of [
    ['--mci-deck-pdf-dark-text', '--mci-deck-pdf-dark-bg'],
    ['--mci-deck-pdf-dark-text', '--mci-deck-pdf-dark-bg-hover'],
    ['--mci-deck-pdf-light-text', '--mci-deck-pdf-light-bg'],
    ['--mci-deck-pdf-light-text', '--mci-deck-pdf-light-bg-hover'],
  ]) {
    assert.ok(
      contrast(readHexToken(foreground), readHexToken(background)) >= 4.5,
      `${foreground} on ${background} must meet WCAG AA`,
    )
  }

  assert.match(styles, /a\.is-dark-pdf\s*\{[\s\S]*?-webkit-text-fill-color:\s*var\(--mci-deck-pdf-dark-text\)\s*!important;/u)
  assert.match(styles, /a\.is-light-pdf\s*\{[\s\S]*?-webkit-text-fill-color:\s*var\(--mci-deck-pdf-light-text\)\s*!important;/u)
})
