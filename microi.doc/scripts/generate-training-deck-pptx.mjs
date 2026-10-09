/**
 * 从在线课件的真实排版生成可编辑 PPTX。
 * 原有 CSS 图形与场景图片保留为无文字背景，正文按浏览器实际行坐标生成原生文本框。
 * 不复制网页按钮和动画；引用保持在原生超链接与每页备注中。
 *
 * 依赖 Codex bundled runtime 的 @oai/artifact-tool、Playwright 与 presentations finalizer。
 * --runtime-node-modules / --runtime-python / --skill-root 均可显式传入，方便不同机器复用。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SITE_URL } from '../docs/.vitepress/config/seo-policy.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)
const dimensions = { width: 1600, height: 900 }
const fontFamily = 'Microsoft YaHei'
const basenames = {
  technical: 'microi-ai-development-framework-training-syllabus',
  enterprise: 'microi-enterprise-application-training-syllabus',
}

export function parseOptions(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (['--capture-only', '--build-only', '--powerpoint-verify', '--help'].includes(key)) values[key] = true
    else if (key.startsWith('--') && argv[index + 1] && !argv[index + 1].startsWith('--')) values[key] = argv[++index]
    else throw new Error(`无效参数：${key}`)
  }
  const edition = values['--edition'] || 'all'
  const theme = values['--theme'] || 'both'
  if (!['all', 'technical', 'enterprise'].includes(edition)) throw new Error('edition 必须为 all / technical / enterprise')
  if (!['both', 'dark', 'light'].includes(theme)) throw new Error('theme 必须为 both / dark / light')
  if (values['--capture-only'] && values['--build-only']) throw new Error('capture-only 与 build-only 不能同时使用')
  return {
    editions: edition === 'all' ? ['technical', 'enterprise'] : [edition],
    themes: theme === 'both' ? ['dark', 'light'] : [theme],
    url: values['--url'] || 'http://127.0.0.1:61503/doc/about/microi-training-syllabus.html',
    captureRoot: path.resolve(values['--capture-root'] || path.join(workspaceRoot, '.tmp/training-deck-pptx/captures')),
    buildRoot: path.resolve(values['--build-root'] || path.join(workspaceRoot, '.tmp/training-deck-pptx', `build-${Date.now()}`)),
    outputRoot: path.resolve(values['--output-root'] || path.join(projectRoot, 'docs/public/downloads')),
    runtimeNodeModules: values['--runtime-node-modules'] || process.env.RUNTIME_NODE_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    runtimePython: values['--runtime-python'] || process.env.RUNTIME_PYTHON || process.env.CODEX_PRIMARY_RUNTIME_PYTHON,
    skillRoot: values['--skill-root'] || process.env.PRESENTATIONS_SKILL_ROOT,
    captureOnly: Boolean(values['--capture-only']),
    buildOnly: Boolean(values['--build-only']),
    powerpointVerify: Boolean(values['--powerpoint-verify']),
    help: Boolean(values['--help']),
  }
}

async function importFromRuntime(nodeModules, name) {
  const runtimeRequire = createRequire(path.join(nodeModules, '__training_runtime__.cjs'))
  return import(pathToFileURL(runtimeRequire.resolve(name)).href)
}

async function declaredSlideCount(edition) {
  const source = path.join(projectRoot, edition === 'enterprise'
    ? 'docs/.vitepress/theme/enterprise-training-slides.js'
    : 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue')
  const matcher = edition === 'enterprise' ? /const\s+enterpriseSlideCount\s*=\s*(\d+)/ : /const\s+expectedSlideCount\s*=\s*(\d+)/
  const matched = (await fs.readFile(source, 'utf8')).match(matcher)
  if (!matched || Number(matched[1]) < 1) throw new Error(`${edition} 未声明有效页数`)
  return Number(matched[1])
}

async function sourceFingerprint() {
  const sources = ['components/TrainingSyllabusDeck.vue', 'components/EnterpriseTrainingSlide.vue',
    'enterprise-training-slides.js', 'styles/training-syllabus-deck.scss', '../config/seo-policy.mjs']
  const digest = createHash('sha256')
  for (const source of sources) {
    digest.update(source)
    digest.update(await fs.readFile(path.join(projectRoot, 'docs/.vitepress/theme', source)))
  }
  const enterpriseSource = await fs.readFile(path.join(projectRoot, 'docs/.vitepress/theme/enterprise-training-slides.js'), 'utf8')
  const scenarioImages = [...enterpriseSource.matchAll(/src:\s*'([^']+)'/g)].map(match => match[1])
  if (scenarioImages.length !== await declaredSlideCount('enterprise') || new Set(scenarioImages).size !== scenarioImages.length) throw new Error('企业课件必须逐页绑定不同的场景图片')
  // 场景图片字节与正文一起冻结，不能在源码不变时复用已经替换图片的旧捕获。
  for (const image of scenarioImages.sort()) {
    if (!image.startsWith('/images/')) throw new Error(`企业场景图片不是本地公开资产：${image}`)
    digest.update(image)
    digest.update(await fs.readFile(path.join(projectRoot, 'docs/public', image.slice(1))))
  }
  return digest.digest('hex')
}

/** 在 1600×900 确定画布上读取每个真实文本行，换行结果完全由在线组件决定。 */
function readSlideFromDom() {
  const active = document.querySelector('.mci-training-slide.is-active')
  const deck = document.querySelector('.mci-training-deck')
  if (!active || !deck) throw new Error('课件未就绪')
  const bounds = deck.getBoundingClientRect()
  const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT)
  const texts = []
  const elements = new Set()
  let node
  while ((node = walker.nextNode())) {
    const element = node.parentElement
    if (!element || !node.textContent?.trim() || element.closest('script, style, .mci-screen-only')) continue
    const computed = getComputedStyle(element)
    if (computed.display === 'none' || computed.visibility === 'hidden' || Number(computed.opacity) === 0) continue
    // 描边页码与复杂装饰图由原设计背景承载，不能另叠加实心文字或泄露图内被裁切的标签。
    if (parseFloat(computed.webkitTextStrokeWidth) > 0 || element.closest('.mci-deck-core-visual, .mci-engine-visual, .mci-device-constellation')) continue
    // CSS 旋转/缩放改变的是 glyph 本身，不能仅用 Range 外框重建为横向文本。
    // 平移已体现在坐标中；其余变换及竖排文字保留在背景，维持流程箭头等设计语义。
    let transformedGlyphs = false
    for (let ancestor = element; ancestor && ancestor !== active.parentElement; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform)
      if ((matrix && (Math.abs(matrix.a - 1) > 0.001 || Math.abs(matrix.d - 1) > 0.001 || Math.abs(matrix.b) > 0.001 || Math.abs(matrix.c) > 0.001)) ||
        (style.rotate !== 'none' && parseFloat(style.rotate) !== 0) || style.writingMode !== 'horizontal-tb') {
        transformedGlyphs = true
        break
      }
    }
    if (transformedGlyphs) continue
    const elementBox = element.getBoundingClientRect()
    if (elementBox.width < 1 || elementBox.height < 1 || elementBox.bottom < 0 || elementBox.top > 900) continue
    const content = node.textContent
    const rows = []
    // Range 包含字体实际 glyph 框；按同一基线聚合，避免重新让 PPT 排版器猜测中文换行。
    for (let index = 0; index < content.length; index += 1) {
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      const box = range.getBoundingClientRect()
      if (box.width <= 0 || box.height <= 0) continue
      const previous = rows.at(-1)
      if (previous && Math.abs(previous.top - box.top) < 1.5) {
        previous.text += content[index]
        previous.right = Math.max(previous.right, box.right)
        previous.bottom = Math.max(previous.bottom, box.bottom)
      } else rows.push({ text: content[index], left: box.left, top: box.top, right: box.right, bottom: box.bottom })
    }
    const clippingAncestors = []
    for (let ancestor = element; ancestor && ancestor !== active.parentElement; ancestor = ancestor.parentElement) {
      const ancestorStyle = getComputedStyle(ancestor)
      const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowX)
      const clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowY)
      if (clipsX || clipsY) clippingAncestors.push({ box: ancestor.getBoundingClientRect(), clipsX, clipsY })
    }
    // 已在网页中省略或部分裁切的视觉标签保留原始像素，不能通过 PPT 文本框使它重新显露。
    if (rows.some(row => clippingAncestors.some(({ box, clipsX, clipsY }) =>
      (clipsX && (row.left < box.left - 1 || row.right > box.right + 1)) ||
      (clipsY && (row.top < box.top - 1 || row.bottom > box.bottom + 1))))) continue
    const rgba = computed.color.match(/[\d.]+/g) || ['255', '255', '255']
    const color = '#' + rgba.slice(0, 3).map(value => Math.round(Number(value)).toString(16).padStart(2, '0')).join('')
    for (const row of rows) {
      const leading = row.text.match(/^\s*/)?.[0] || ''
      let text = row.text.trim()
      if (!text) continue
      if (computed.textTransform === 'uppercase') text = text.toUpperCase()
      const fontSize = parseFloat(computed.fontSize)
      const left = row.left - bounds.left
      const top = row.top - bounds.top
      const width = row.right - row.left
      const height = row.bottom - row.top
      if (left < -1 || top < -1 || left + width > 1601 || top + height > 901) throw new Error(`文字超出课件画布：${text}`)
      texts.push({ text, left, top, width, height, fontSize, color,
        bold: Number(computed.fontWeight) >= 600, italic: computed.fontStyle === 'italic',
        typeface: computed.fontFamily.includes('monospace') ? 'Consolas' : /[\u3400-\u9fff]/u.test(text) ? 'Microsoft YaHei' : 'Arial',
        href: element.closest('a')?.href || '', sourceTag: element.tagName.toLowerCase(),
        letterSpacing: parseFloat(computed.letterSpacing) || 0, leadingWhitespace: leading.length })
    }
    elements.add(element)
  }
  const links = [...active.querySelectorAll('a[href]')].filter(element => !element.closest('.mci-screen-only'))
    .map(element => ({ label: element.textContent.trim(), href: element.href }))
  for (const element of elements) element.setAttribute('data-pptx-text-layer', '')
  return { id: active.id, title: active.querySelector('h1,h2')?.textContent.trim() || active.getAttribute('aria-label'), texts, links,
    sourceUrl: location.href, content: active.innerText, backgroundColor: getComputedStyle(deck).backgroundColor }
}

/** 解码成功不能单独证明已绘制；逐页等待绘制帧并验证真实图位，异常不得吞掉。 */
async function verifySlideImagePaint() {
  await document.fonts.ready
  const active = document.querySelector('.mci-training-slide.is-active')
  const deck = document.querySelector('.mci-training-deck')
  if (!active || !deck) throw new Error('图片核验时课件未就绪')
  const images = [...active.querySelectorAll('img')].filter(image => !image.closest('.mci-screen-only'))
  await Promise.all(images.map(async image => {
    try { await image.decode() } catch (error) {
      throw new Error(`图片解码失败：${image.currentSrc || image.src}；${error.message}`)
    }
  }))
  // 两个独立绘制帧确保解码资源和主题/文字层改变均已进入 compositor。
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const deckBox = deck.getBoundingClientRect()
  const verified = images.map(image => {
    const source = image.currentSrc || image.src
    if (!image.complete || image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error(`图片未完整加载：${source}`)
    const box = image.getBoundingClientRect()
    if (box.width < 1 || box.height < 1 || box.right <= deckBox.left || box.left >= deckBox.right || box.bottom <= deckBox.top || box.top >= deckBox.bottom) throw new Error(`图片图位为空或超出画布：${source}`)
    let minAncestorOpacity = 1
    for (let element = image; element; element = element.parentElement) {
      const style = getComputedStyle(element)
      minAncestorOpacity = Math.min(minAncestorOpacity, Number(style.opacity))
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) <= 0) throw new Error(`图片或祖先不可见：${source}`)
      if (element === deck) break
    }
    const figure = image.closest('.mci-enterprise-image')
    if (figure) {
      const figureBox = figure.getBoundingClientRect()
      const style = getComputedStyle(figure)
      const expectedLeft = figureBox.left + parseFloat(style.borderLeftWidth)
      const expectedTop = figureBox.top + parseFloat(style.borderTopWidth)
      const expectedRight = figureBox.right - parseFloat(style.borderRightWidth)
      const expectedBottom = figureBox.bottom - parseFloat(style.borderBottomWidth)
      if (Math.abs(box.left - expectedLeft) > 2 || Math.abs(box.top - expectedTop) > 2 || Math.abs(box.right - expectedRight) > 2 || Math.abs(box.bottom - expectedBottom) > 2) throw new Error(`企业图片未填满图位：${source}；图片 ${box.width}×${box.height}，图位 ${figureBox.width}×${figureBox.height}`)
    }
    return { source, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      left: box.left - deckBox.left, top: box.top - deckBox.top, width: box.width, height: box.height,
      minAncestorOpacity, enterpriseFillValidated: Boolean(figure) }
  })
  if (deck.dataset.version === 'enterprise' && verified.filter(image => image.enterpriseFillValidated).length !== 1) throw new Error('企业当前页必须完整呈现唯一场景图片')
  return verified
}

/** 几何与解码通过后，再检查真实截图中的场景区域，拒绝尚未绘制的纯色占位。 */
async function verifyScenarioImagePixels(canvasApi, screenshot, images) {
  const scenarios = images.filter(image => image.enterpriseFillValidated)
  if (!scenarios.length) return []
  const bitmap = await canvasApi.loadImage(screenshot)
  const canvas = canvasApi.createCanvas(dimensions.width, dimensions.height)
  const context = canvas.getContext('2d')
  context.drawImage(bitmap, 0, 0)
  return scenarios.map(image => {
    // 取内部区域，避开圆角、页码与图注；这些元素不能冒充真实场景图片。
    const left = Math.round(image.left + image.width * 0.12)
    const top = Math.round(image.top + image.height * 0.12)
    const width = Math.round(image.width * 0.76)
    const height = Math.round(image.height * 0.7)
    const { data } = context.getImageData(left, top, width, height)
    const colors = new Set()
    const minima = [255, 255, 255]
    const maxima = [0, 0, 0]
    for (let offset = 0; offset < data.length; offset += 20) {
      colors.add((data[offset] >> 4) * 256 + (data[offset + 1] >> 4) * 16 + (data[offset + 2] >> 4))
      for (let channel = 0; channel < 3; channel += 1) {
        minima[channel] = Math.min(minima[channel], data[offset + channel])
        maxima[channel] = Math.max(maxima[channel], data[offset + channel])
      }
    }
    const maxChannelRange = Math.max(...maxima.map((value, channel) => value - minima[channel]))
    if (colors.size < 32 || maxChannelRange < 60) throw new Error(`企业场景图尚未真实绘制：${image.source}；颜色 ${colors.size}，通道跨度 ${maxChannelRange}`)
    return { source: image.source, quantizedColors: colors.size, maxChannelRange, scenePixelsVerified: true }
  })
}

async function captureDecks(options) {
  if (os.freemem() < Math.max(1.5 * 1024 ** 3, os.totalmem() * 0.05) + 2 * 1024 ** 3) throw new Error('可用内存不足，暂停 PPTX 浏览器捕获')
  const playwright = await importFromRuntime(options.runtimeNodeModules, 'playwright')
  const { chromium } = playwright.chromium ? playwright : playwright.default
  const canvasModule = await importFromRuntime(options.runtimeNodeModules, '@napi-rs/canvas')
  const canvasApi = canvasModule.createCanvas ? canvasModule : canvasModule.default
  const sourceSha256 = await sourceFingerprint()
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-dev-shm-usage', '--renderer-process-limit=2'] })
  console.log(JSON.stringify({ stage: 'browser-started', generatorPid: process.pid, startedAt: new Date().toISOString() }))
  try {
    const context = await browser.newContext({ viewport: dimensions, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript(() => { localStorage.setItem('vitepress-theme-appearance', 'dark') })
    for (const edition of options.editions) {
      const count = await declaredSlideCount(edition)
      for (const theme of options.themes) {
        const directory = path.join(options.captureRoot, edition, theme)
        await fs.mkdir(directory, { recursive: true })
        const slides = []
        const initial = new URL(options.url)
        initial.searchParams.set('artifact-capture', '')
        initial.hash = edition === 'enterprise' ? 'enterprise-slide-01' : 'slide-01'
        await page.goto(initial.href, { waitUntil: 'networkidle' })
        await page.waitForSelector('.mci-training-slide.is-active')
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
        await page.addStyleTag({ content: '.mci-training-deck.is-artifact-capture [data-pptx-text-layer] { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' })
        for (let index = 0; index < count; index += 1) {
          if (os.freemem() < os.totalmem() * 0.05) throw new Error('系统内存占用达到95%，终止本任务浏览器')
          await page.evaluate(({ edition, index }) => { location.hash = `${edition === 'enterprise' ? 'enterprise-' : ''}slide-${String(index + 1).padStart(2, '0')}` }, { edition, index })
          await page.waitForFunction(({ edition, index }) => document.querySelector('.mci-training-deck')?.getAttribute('data-version') === edition && document.querySelector('.mci-training-deck__counter strong')?.textContent === String(index + 1).padStart(2, '0'), { edition, index })
          await page.evaluate(() => document.querySelectorAll('[data-pptx-text-layer]').forEach(element => element.removeAttribute('data-pptx-text-layer')))
          const images = await page.evaluate(verifySlideImagePaint)
          const originalPath = path.join(directory, `slide-${String(index + 1).padStart(2, '0')}-reference.png`)
          const referenceBytes = await page.locator('.mci-training-deck').screenshot({ path: originalPath })
          const referenceImagePaint = await verifyScenarioImagePixels(canvasApi, referenceBytes, images)
          const slide = await page.evaluate(readSlideFromDom)
          const backgroundPath = path.join(directory, `slide-${String(index + 1).padStart(2, '0')}-background.png`)
          await page.evaluate(verifySlideImagePaint)
          const backgroundBytes = await page.locator('.mci-training-deck').screenshot({ path: backgroundPath })
          const backgroundImagePaint = await verifyScenarioImagePixels(canvasApi, backgroundBytes, images)
          slides.push({ ...slide, images, referenceImagePaint, backgroundImagePaint, backgroundPath, originalPath })
          console.log(JSON.stringify({ stage: 'captured', edition, theme, slide: index + 1, count, nativeTextLines: slide.texts.length }))
        }
        if (sourceSha256 !== await sourceFingerprint()) throw new Error('课件源码在捕获过程中发生变化，请重新捕获当前候选')
        await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'editable-dom-lines.v4', edition, theme, dimensions, fontFamily, sourceSha256, slides }, null, 2))
      }
    }
    await context.close()
  } finally { await browser.close() }
}

async function buildDecks(options) {
  process.env.RUNTIME_NODE_MODULES = options.runtimeNodeModules
  const { FileBlob, Presentation, PresentationFile } = await importFromRuntime(options.runtimeNodeModules, '@oai/artifact-tool')
  const { finalizePresentation } = await import(pathToFileURL(path.join(options.skillRoot, 'container_tools/artifact_tool_utils.mjs')).href)
  await fs.mkdir(options.outputRoot, { recursive: true })
  const results = []
  const captureOrigin = new URL(options.url).origin
  const publicUrl = value => {
    const url = new URL(value)
    if (url.origin === captureOrigin) {
      url.searchParams.delete('artifact-capture')
      return new URL(url.pathname + url.search + url.hash, SITE_URL).href
    }
    return url.href
  }
  for (const edition of options.editions) for (const theme of options.themes) {
    const manifest = JSON.parse(await fs.readFile(path.join(options.captureRoot, edition, theme, 'manifest.json'), 'utf8'))
    const count = await declaredSlideCount(edition)
    if (manifest.schema !== 'editable-dom-lines.v4') throw new Error('捕获清单版本与当前原生文本映射不一致，请重新捕获')
    if (manifest.edition !== edition || manifest.theme !== theme || manifest.slides.length !== count) throw new Error(`${edition}/${theme} 捕获清单与当前课件不一致`)
    if (manifest.sourceSha256 !== await sourceFingerprint()) throw new Error(`${edition}/${theme} 捕获清单所属源码已变化，不能复用旧素材生成 PPTX`)
    const buildDirectory = path.join(options.buildRoot, edition, theme)
    const finalDirectory = path.join(buildDirectory, 'validated')
    await fs.mkdir(finalDirectory, { recursive: true })
    const presentation = Presentation.create({ slideSize: dimensions })
    let textCount = 0
    for (const [index, captured] of manifest.slides.entries()) {
      const slide = presentation.slides.add()
      slide.background.fill = theme === 'dark' ? '#070b12' : '#edf1f7'
      const bytes = await fs.readFile(captured.backgroundPath)
      slide.images.add({ blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType: 'image/png', alt: `${captured.title}在线设计背景`, position: { left: 0, top: 0, ...dimensions }, fit: 'contain' })
      for (const [lineIndex, text] of captured.texts.entries()) {
        // 原生 textbox 保留 DOM 每一行的换行与位置，背景截图中对应文字已隐藏。
        const shape = slide.shapes.add({ geometry: 'textbox', name: `editable-${text.sourceTag}-${lineIndex + 1}`, position: {
          left: text.left, top: text.top, width: Math.min(dimensions.width - text.left, text.width + Math.max(5, text.fontSize * 0.2)), height: Math.min(dimensions.height - text.top, text.height + 4),
        }, fill: 'none', line: { fill: 'none', width: 0 } })
        shape.text = text.text
        shape.text.style = { typeface: text.typeface, fontSize: text.fontSize, color: text.color, bold: text.bold, italic: text.italic,
          alignment: 'left', verticalAlignment: 'top', autoFit: 'none', wrap: 'none', insets: 0 }
        if (text.href) shape.text.get(text.text).link = { uri: publicUrl(text.href), isExternal: true }
        textCount += 1
      }
      slide.speakerNotes.text = `来源：${publicUrl(captured.sourceUrl)}\n${captured.title}\n${captured.links.map(link => `${link.label}: ${publicUrl(link.href)}`).join('\n')}`
      console.log(JSON.stringify({ stage: 'authored', edition, theme, slide: index + 1, count }))
    }
    const filename = `${basenames[edition]}-${theme}.pptx`
    const candidatePath = path.join(buildDirectory, 'candidate.pptx')
    const finalPath = path.join(finalDirectory, filename)
    await (await PresentationFile.exportPptx(presentation)).save(candidatePath)
    await finalizePresentation({ workspaceDir: workspaceRoot, candidatePath, finalPath, explicitTotalSlideCount: count,
      pythonExecutable: options.runtimePython,
      integrityValidatorPath: path.join(options.skillRoot, 'container_tools/inspect_presentation_package_integrity.py'),
      layoutValidatorPath: path.join(options.skillRoot, 'container_tools/inspect_presentation_layout_geometry.py'),
      layoutArgs: ['--expected-slide-size-emu', '15240000,8572500', '--validate-bullet-geometry', '--validate-heading-fit'],
      fontPolicy: { basis: 'design', families: [fontFamily, 'Arial', 'Consolas'], scriptFonts: { ea: fontFamily } }, verifyArtifactToolImport: true,
      receiptPath: path.join(buildDirectory, 'validation.json'),
    })
    // 从已校验的 OOXML 文件重新导入再渲染，验证的是实际 PowerPoint 产物而非导出前内存模型。
    const verifiedPresentation = await PresentationFile.importPptx(await FileBlob.load(finalPath))
    for (const [index, slide] of verifiedPresentation.slides.items.entries()) {
      const preview = await verifiedPresentation.export({ slide, format: 'png', scale: 1 })
      await fs.writeFile(path.join(buildDirectory, `slide-${String(index + 1).padStart(2, '0')}.png`), new Uint8Array(await preview.arrayBuffer()))
      console.log(JSON.stringify({ stage: 'rendered', edition, theme, slide: index + 1, count }))
    }
    if (options.powerpointVerify) await verifyWithPowerPoint(finalPath, path.join(buildDirectory, 'powerpoint'), count)
    const destination = path.join(options.outputRoot, filename)
    await fs.copyFile(finalPath, destination)
    const finalBytes = await fs.readFile(destination)
    const result = { edition, theme, slides: count, nativeTextLines: textCount, path: destination, bytes: finalBytes.length,
      sha256: createHash('sha256').update(finalBytes).digest('hex'), previewRoot: buildDirectory }
    results.push(result)
    console.log(JSON.stringify({ stage: 'complete', ...result }))
  }
  await fs.writeFile(path.join(options.buildRoot, 'results.json'), JSON.stringify(results, null, 2))
}

export async function verifyWithPowerPoint(pptxPath, renderDirectory, expectedCount) {
  if (process.platform !== 'win32') throw new Error('powerpoint-verify 需要已安装 PowerPoint 的 Windows')
  await fs.mkdir(renderDirectory, { recursive: true })
  const verifierPath = path.join(path.dirname(renderDirectory), 'verify-powerpoint.ps1')
  const ownerPath = path.join(path.dirname(renderDirectory), 'powerpoint-owner.json')
  // 只启动本任务的新 PowerPoint 实例，避免与用户正在编辑的演示文稿共用进程。
  await fs.writeFile(verifierPath, `\uFEFFparam([string]$PptxPath,[string]$RenderDirectory,[int]$ExpectedCount,[string]$OwnerPath)
$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $OutputEncoding
$powerPointCandidates = @(
  (Join-Path $env:ProgramFiles 'Microsoft Office/root/Office16/POWERPNT.EXE'),
  (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft Office/root/Office16/POWERPNT.EXE')
)
foreach ($key in @('Registry::HKEY_LOCAL_MACHINE/Software/Microsoft/Windows/CurrentVersion/App Paths/POWERPNT.EXE','Registry::HKEY_CURRENT_USER/Software/Microsoft/Windows/CurrentVersion/App Paths/POWERPNT.EXE')) {
  if (Test-Path -LiteralPath $key) { $powerPointCandidates += (Get-ItemProperty -LiteralPath $key).'(default)' }
}
if (-not @($powerPointCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }).Count) { throw '未发现真正的 Microsoft PowerPoint 可执行文件；兼容 ProgID 不代表已安装微软客户端' }
if (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw '已有 PowerPoint 进程，不能占用或退出用户的编辑会话' }
$pptApp = $null
$pptDeck = $null
try {
  $pptApp = New-Object -ComObject PowerPoint.Application
  Get-Process -Name POWERPNT | Select-Object Id,@{Name='StartTimeUtcTicks';Expression={$_.StartTime.ToUniversalTime().Ticks}} | ConvertTo-Json -Compress | Set-Content -LiteralPath $OwnerPath -Encoding UTF8
  $pptDeck = $pptApp.Presentations.Open($PptxPath, -1, 0, 0)
  if ($pptDeck.Slides.Count -ne $ExpectedCount) { throw 'PowerPoint 读取页数不匹配' }
  $pptDeck.Export($RenderDirectory, 'PNG', 1600, 900)
  $pageFiles = @(Get-ChildItem -LiteralPath $RenderDirectory -Filter '*.PNG' -File)
  if ($pageFiles.Count -ne $ExpectedCount) { throw 'PowerPoint 原生渲染页数不匹配' }
  @{application='Microsoft PowerPoint';slides=$pptDeck.Slides.Count;renderedPages=$pageFiles.Count;readOnly=$true} | ConvertTo-Json -Compress
} finally {
  if ($null -ne $pptDeck) { $pptDeck.Close(); [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($pptDeck) | Out-Null }
  if ($null -ne $pptApp) { $pptApp.Quit(); [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($pptApp) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`, 'utf8')
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', verifierPath,
    '-PptxPath', pptxPath, '-RenderDirectory', renderDirectory, '-ExpectedCount', String(expectedCount), '-OwnerPath', ownerPath], { encoding: 'utf8', windowsHide: true, timeout: 180000 })
  // 超时可能终止了 PowerShell 而未触发 finally；按记录的 PID/启动时间只清理本任务的 Office 进程。
  if (result.error) {
    const ownerJson = await fs.readFile(ownerPath, 'utf8').catch(() => '')
    if (ownerJson) {
      const cleanup = `$expected = Get-Content -LiteralPath $args[0] -Raw | ConvertFrom-Json; foreach ($owned in @($expected)) { $current = Get-Process -Id $owned.Id -ErrorAction SilentlyContinue; if ($current -and $current.ProcessName -eq 'POWERPNT' -and $current.StartTime.ToUniversalTime().Ticks -eq [long]$owned.StartTimeUtcTicks) { Stop-Process -Id $current.Id -Force } }`
      spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', cleanup, ownerPath], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    }
  }
  if (result.status !== 0) throw new Error(`PowerPoint 原生验收失败：${result.stderr || result.error?.message || result.stdout}`)
  await fs.writeFile(path.join(path.dirname(renderDirectory), 'powerpoint-validation.json'), result.stdout.trim(), 'utf8')
  console.log(JSON.stringify({ stage: 'powerpoint-verified', path: pptxPath, slides: expectedCount }))
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log('generate-training-deck-pptx.mjs --runtime-node-modules <dir> --runtime-python <exe> --skill-root <presentations-skill> [--edition all|technical|enterprise] [--theme both|dark|light] [--url <page>] [--capture-only|--build-only] [--powerpoint-verify] [--capture-root <dir>] [--build-root <dir>] [--output-root <dir>]')
    return
  }
  for (const key of ['runtimeNodeModules', ...(options.captureOnly ? [] : ['runtimePython', 'skillRoot'])]) {
    if (!options[key] || !path.isAbsolute(options[key])) throw new Error(`请通过参数提供 ${key} 的绝对路径`)
  }
  if (!options.buildOnly) await captureDecks(options)
  if (!options.captureOnly) await buildDecks(options)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1 })
