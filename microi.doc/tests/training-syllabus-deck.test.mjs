import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staticPdfPath = path.join(projectRoot, 'docs/public/downloads/microi-ai-development-framework-training-syllabus.pdf')

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
  const metaBlock = /const slideMeta = \[([\s\S]*?)\] as const/u.exec(component)?.[1] || ''
  const slideCount = [...metaBlock.matchAll(/\{ id: '[^']+'/gu)].length

  assert.equal(slideCount, 18)
  for (const phrase of [
    '开源 AI 开发框架',
    '20+ 成熟引擎',
    '10× 方法',
    'MCP 智能交付',
    'MCP 让 AI 真正理解、操作并验收平台',
    '业务蓝图',
    '万物皆表单引擎',
    'V8 / API',
    '工作流',
    'AI 引擎',
    'SaaS 与安全',
    '多端与微服务',
    '部署运维',
    '实战工作坊',
    '建议 3 天 · 18 学时',
  ]) assert.ok(component.includes(phrase), `missing syllabus topic: ${phrase}`)

  assert.match(component, /典型平台能力高复用场景，不构成无条件性能承诺/)
  assert.match(component, /OsClient.*OsClientType.*OsClientNetwork/s)
  assert.match(component, /Code = 1.*自动提交/s)
  assert.doesNotMatch(component, /https?:\/\//u, 'the deck should not depend on remote media')
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
    'handlePointerDown',
    'handlePointerUp',
    'requestFullscreen',
    'document.exitFullscreen',
    'mci-training-deck__rail',
    'mci-training-deck__thumbnail',
    '/images/training-deck/thumbs/slide-',
    'pdfDownloadPath',
    'downloadPdf()',
    ':href="pdfDownloadPath"',
    'download aria-label="下载预生成 PDF"',
    'frame.scrollHeight > frame.clientHeight',
    'aria-roledescription="slide"',
    'aria-keyshortcuts="P"',
  ]) assert.ok(component.includes(token), `missing interaction contract: ${token}`)

  assert.doesNotMatch(component, /openPanel\('overview'\)/u)
  assert.doesNotMatch(component, /window\.print\s*\(/u)
  assert.doesNotMatch(component, /window\.(?:alert|confirm|prompt)\s*\(/u)
})

test('pre-generated PDF is published as a stable static download', () => {
  assert.ok(fs.existsSync(staticPdfPath), 'the downloadable PDF must exist before the site is published')
  const stat = fs.statSync(staticPdfPath)
  const pdf = fs.readFileSync(staticPdfPath)
  assert.ok(stat.size > 250_000, 'the PDF should contain the complete vector deck')
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.match(pdf.toString('latin1'), /\/Count\s+18\b/u, 'the static PDF should contain all 18 slides')
})

test('presentation styles provide isolated responsive, motion, and 16:9 print contracts', () => {
  const styles = read('docs/.vitepress/theme/styles/training-syllabus-deck.scss')

  for (const token of [
    '.mci-training-ppt-page',
    '.mci-training-deck:fullscreen',
    '.mci-training-deck__rail',
    '.mci-training-deck__thumbnail',
    '.mci-training-deck .mci-training-slide.is-active',
    '@media (min-width: 1920px) and (min-height: 900px)',
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
  ]) assert.ok(styles.includes(token), `missing style contract: ${token}`)

  assert.doesNotMatch(styles, /^(?:button|img|h1|h2)\s*\{/mu, 'generic selectors must remain scoped to the deck')
})
