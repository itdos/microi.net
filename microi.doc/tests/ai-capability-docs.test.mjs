import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(projectRoot, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

function readAsset(relativePath) {
  return fs.readFileSync(path.join(projectRoot, 'docs/public', relativePath))
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'asset must be a valid PNG')
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', 'PNG must start with IHDR')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

test('AI data analysis and creation are independent Chinese docs and sidebar entries', () => {
  const dataPage = read('docs/doc/system-engine/ai-data-analysis.md')
  const creativePage = read('docs/doc/system-engine/ai-creative-studio.md')
  const aiEngine = read('docs/doc/system-engine/ai-engine.md')
  const mapping = read('docs/mapping_zh.json')
  const profiles = read('docs/.vitepress/theme/doc-visual-profiles.js')
  const capabilityMap = fs.readFileSync(path.join(workspaceRoot, 'microi.skills/microi-docs-coverage/references/capability-map.md'), 'utf8')
  const theme = read('docs/.vitepress/theme/index.ts')

  assert.match(dataPage, /^title: AI 数据分析$/mu)
  assert.match(dataPage, /<h1>用自然语言，<br><em>读懂真实业务数据<\/em><\/h1>/u)
  assert.match(creativePage, /^title: AI 创作中心$/mu)
  assert.match(creativePage, /<h1>从一个想法，<br><em>开始完整创作<\/em><\/h1>/u)

  const aiEngineIndex = mapping.indexOf('"ai-engine.md"')
  const dataIndex = mapping.indexOf('"ai-data-analysis.md":"AI数据分析"')
  const creativeIndex = mapping.indexOf('"ai-creative-studio.md":"AI创作中心（图片/视频/音乐）"')
  const workflowIndex = mapping.indexOf('"ai-workflow-suite.md"')
  assert.ok(aiEngineIndex < dataIndex && dataIndex < creativeIndex && creativeIndex < workflowIndex, 'sidebar order must keep both training pages directly after AI engine')

  assert.match(profiles, /'system-engine\/ai-data-analysis': 'showcase'/u)
  assert.match(profiles, /'system-engine\/ai-creative-studio': 'showcase'/u)
  assert.match(capabilityMap, /`system-engine\/ai-data-analysis\.md` \| ai-engine, v8-security, v8-saas-multi-tenant/u)
  assert.match(capabilityMap, /`system-engine\/ai-creative-studio\.md` \| ai-engine, v8-image-processing, v8-file-upload/u)
  assert.match(aiEngine, /\[AI 数据分析\]\(\.\/ai-data-analysis\)/u)
  assert.match(aiEngine, /\[AI 创作中心\]\(\.\/ai-creative-studio\)/u)
  assert.match(theme, /styles\/ai-capability-docs\.scss/u)
})

test('the data-analysis page publishes exactly three original screenshots in one three-column gallery', () => {
  const page = read('docs/doc/system-engine/ai-data-analysis.md')
  const styles = read('docs/.vitepress/theme/styles/ai-capability-docs.scss')
  const gallery = /<div class="mci-doc-screenshot-grid mci-doc-screenshot-grid--three mci-ai-analysis-gallery"[\s\S]*?<\/div>/u.exec(page)?.[0] || ''
  const imagePaths = [...gallery.matchAll(/<img src="([^"]+)"/gu)].map(match => match[1])

  assert.deepEqual(imagePaths, [
    '/images/ai-data-analysis/monthly-business-overview.png',
    '/images/ai-data-analysis/sales-activity-analysis.png',
    '/images/ai-data-analysis/customer-follow-up-activity-analysis.png',
  ])
  assert.equal([...gallery.matchAll(/<figure>/gu)].length, 3)
  assert.equal([...gallery.matchAll(/data-fancybox="ai-data-analysis-originals"/gu)].length, 3)
  assert.equal([...gallery.matchAll(/<figcaption>/gu)].length, 3)
  assert.equal([...gallery.matchAll(/\salt="[^"]+"/gu)].length, 3)
  assert.match(styles, /\.mci-doc-screenshot-grid--three\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/u)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.mci-doc-screenshot-grid--three\s*\{[\s\S]*?grid-template-columns:\s*1fr/u)
})

test('all four user screenshots remain byte-identical originals with locked dimensions', () => {
  const assets = [
    ['images/ai-creative-studio/capability-overview.png', [1905, 1233], '6babe1f45815d5ac150ea21136f9dd20dc7f5f4b079e1af26546d9d167566590'],
    ['images/ai-data-analysis/monthly-business-overview.png', [743, 1590], '77be6bdfa2eecf7a0f02553efa30c35d413993925125894a8a067f609540a6ab'],
    ['images/ai-data-analysis/sales-activity-analysis.png', [764, 1611], '79fac1f948c62189514d0fed32de3190a3c00130e0e908b6fa2da5480d48dc75'],
    ['images/ai-data-analysis/customer-follow-up-activity-analysis.png', [771, 1614], 'ccec441f0f15b02fc51710def3039f5945603c5334cea6b68169fee8b17ba338'],
  ]

  for (const [relativePath, dimensions, hash] of assets) {
    const image = readAsset(relativePath)
    assert.deepEqual(pngDimensions(image), dimensions, `${relativePath} dimensions changed`)
    assert.equal(sha256(image), hash, `${relativePath} must remain the uploaded original bytes`)
  }
})

test('the creation training page mirrors all 29 current image tools and media boundaries', () => {
  const page = read('docs/doc/system-engine/ai-creative-studio.md')
  const directory = fs.readFileSync(path.join(workspaceRoot, 'Microi.Client/src/views/ai-engine/ai-image-tool-directory.js'), 'utf8')
  const labels = [...directory.matchAll(/label:\s*"([^"]+)"/gu)].map(match => match[1])

  assert.equal(labels.length, 29, 'the product directory must still expose 29 tools')
  for (const label of labels) assert.ok(page.includes(`<b>${label}</b>`), `creation training is missing current tool: ${label}`)

  for (const phrase of [
    'AI 视频视觉创作',
    '文生视频',
    '图生视频',
    '声音与音乐创作',
    '纯音乐',
    '当前采用“参考图 + 提示词”重新生成画面',
    'AI 去水印只能用于企业自有或已获授权素材',
    '确定性的精确图像处理',
    'HDFS',
  ]) assert.ok(page.includes(phrase), `creation training is missing boundary: ${phrase}`)

  assert.match(page, /src="\/images\/ai-creative-studio\/capability-overview\.png"/u)
  assert.match(page, /data-fancybox="ai-creative-studio-original"/u)
})

test('the 45-slide syllabus links both independent AI training pages', () => {
  const component = read('docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')
  const source = read('docs/doc/about/microi-training-syllabus.md')

  assert.match(component, /id: 'ai-data-analysis'[\s\S]*?href: '\/doc\/system-engine\/ai-data-analysis\.html'/u)
  assert.match(component, /id: 'ai-creative-studio'[\s\S]*?href: '\/doc\/system-engine\/ai-creative-studio\.html'/u)
  assert.match(component, /entryIds: \['app-store', 'ai-engine', 'ai-data-analysis', 'ai-creative-studio', 'ai-workflow-suite'/u)
  assert.match(component, /const expectedSlideCount = 45/u)
  assert.match(source, /45 页交互式 HTML PPT/u)
  assert.match(source, /36 个逐项功能页/u)
})
