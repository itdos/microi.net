/**
 * 按真实 Vue 课件逐页生成 PDF，两版均使用轻量视觉层与可搜索文字层。
 * 所有浏览器、截图、分片和输出都属于 .tmp；下载清单仅在 CDN 验签后更新。
 * 一次只使用一个浏览器页面，避免四套课件并发渲染挤占共享工作区内存。
 */
import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)
const dimensions = Object.freeze({ width: 1600, height: 900 })
const names = Object.freeze({
  technical: 'microi-ai-development-framework-training-syllabus',
  enterprise: 'microi-enterprise-application-training-syllabus',
})

export function parseNativePdfOptions(argv) {
  const values = new Map()
  const allowed = new Set(['--url', '--edition', '--theme', '--capture-root', '--output-root', '--runtime-node-modules', '--runtime-python', '--channel', '--executable-path', '--slides'])
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!allowed.has(key) || values.has(key) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`无效或重复参数：${key}`)
    values.set(key, argv[++index])
  }
  const edition = values.get('--edition') || 'all'
  const theme = values.get('--theme') || 'both'
  if (!['all', 'technical', 'enterprise'].includes(edition)) throw new Error('edition 必须为 all / technical / enterprise')
  if (!['both', 'dark', 'light'].includes(theme)) throw new Error('theme 必须为 both / dark / light')
  const url = new URL(values.get('--url') || 'http://127.0.0.1:61503/doc/about/microi-training-syllabus.html')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('课件 URL 必须为无凭据的 HTTP(S) 地址')
  const slideSelection = values.get('--slides')
  const slides = slideSelection ? slideSelection.split(',').map(Number) : null
  if (slides && (!slides.length || slides.some(number => !Number.isSafeInteger(number) || number < 1) || new Set(slides).size !== slides.length)) throw new Error('slides 必须为不重复的正整数逗号列表')
  return {
    editions: edition === 'all' ? ['technical', 'enterprise'] : [edition],
    themes: theme === 'both' ? ['dark', 'light'] : [theme],
    url: url.href,
    captureRoot: path.resolve(values.get('--capture-root') || path.join(workspaceRoot, '.tmp/training-20261016/native-pdf-captures')),
    outputRoot: path.resolve(values.get('--output-root') || path.join(workspaceRoot, '.tmp/training-20261016/pdf')),
    runtimeNodeModules: values.get('--runtime-node-modules') || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    runtimePython: values.get('--runtime-python') || process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python',
    channel: values.get('--channel') || 'msedge',
    executablePath: values.get('--executable-path'),
    slides,
  }
}

export function assertTrainingTemporaryPath(target) {
  const absolute = path.resolve(target)
  const relative = path.relative(workspaceRoot, absolute)
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`) || relative.split(path.sep)[0] !== '.tmp') throw new Error('培训 PDF 生成物必须位于工作区 .tmp')
  return absolute
}

/** 两版默认扁平复杂视觉；先验收临时候选，再写最终输出，原始合并件仍供追溯。 */
export async function finalizeNativeTrainingPdf({ edition, nativeResult, outputPath, captureDirectory, runtimePython }, execute = spawnSync) {
  if (!['enterprise', 'technical'].includes(edition)) throw new Error('未知培训版本')
  await assertRegularTemporaryPath(outputPath)
  if (path.extname(outputPath).toLowerCase() !== '.pdf') throw new Error('企业 PDF 最终输出必须使用 .pdf 扩展名')
  await assertRegularTemporaryPath(nativeResult.path)
  await assertRegularTemporaryPath(captureDirectory)
  if (path.resolve(nativeResult.path) === path.resolve(outputPath)) throw new Error('企业 PDF 优化输入不能覆盖最终输出')
  const optimizerSource = path.join(projectRoot, 'scripts/optimize-training-deck-pdf.py')
  const optimizerSha256 = createHash('sha256').update(await fs.readFile(optimizerSource)).digest('hex')
  const candidatePath = path.join(captureDirectory, `optimized-${randomUUID()}.pdf`)
  const optimized = execute(runtimePython, ['-X', 'utf8', optimizerSource, '--input', nativeResult.path, '--output', candidatePath],
    { encoding: 'utf8', windowsHide: true, timeout: 600000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  if (optimized.status !== 0) throw new Error(`企业 PDF 轻量视觉/文字验收失败：${optimized.stderr || optimized.stdout || optimized.error}`)
  const receipt = JSON.parse(optimized.stdout.trim())
  await assertRegularTemporaryPath(candidatePath)
  const candidate = await fs.readFile(candidatePath)
  const actualHash = createHash('sha256').update(candidate).digest('hex')
  if (path.resolve(receipt.path) !== candidatePath || receipt.bytes !== candidate.length || receipt.sha256 !== actualHash ||
      receipt.sourceSha256 !== nativeResult.sha256 || receipt.optimizerSha256 !== optimizerSha256 ||
      createHash('sha256').update(await fs.readFile(optimizerSource)).digest('hex') !== optimizerSha256 ||
      receipt.pages !== nativeResult.pages || !receipt.nativeTextVerified || !receipt.linearized ||
      receipt.visualImages !== nativeResult.pages || receipt.formObjects !== 0 || receipt.softMasks !== 0) throw new Error('企业 PDF 优化回执与最终字节/源码不一致')
  // Python渲染可能耗时数十秒，提交前重查路径，且拒绝覆盖共享目录中的未知文件。
  await assertRegularTemporaryPath(outputPath)
  await assertRegularTemporaryPath(captureDirectory)
  const validationPath = outputPath.replace(/\.pdf$/iu, '.validation.json')
  await assertRegularTemporaryPath(validationPath)
  try {
    await fs.lstat(validationPath)
    throw Object.assign(new Error('企业 PDF 验收记录已存在，请选择新的输出根'), { code: 'EEXIST' })
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await fs.copyFile(candidatePath, outputPath, constants.COPYFILE_EXCL)
  const result = { ...nativeResult, path: outputPath, bytes: candidate.length, sha256: actualHash,
    linearized: true, visualImages: receipt.visualImages, optimizerSource, optimizerSha256,
    nativeSourcePdf: { path: nativeResult.path, bytes: nativeResult.bytes, sha256: nativeResult.sha256 },
    optimization: receipt }
  await fs.writeFile(validationPath, JSON.stringify(result, null, 2), { flag: 'wx' })
  return result
}

async function assertRegularTemporaryPath(target) {
  const absolute = assertTrainingTemporaryPath(target)
  let current = workspaceRoot
  for (const part of path.relative(workspaceRoot, absolute).split(path.sep)) {
    current = path.join(current, part)
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`培训 PDF 目录禁止符号链接：${current}`) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return absolute
}

async function runtimeModule(root, name) {
  if (!root) throw new Error('请传入 --runtime-node-modules 指定 bundled runtime')
  const runtimeRequire = createRequire(path.join(root, '__training_native_pdf__.cjs'))
  return import(pathToFileURL(runtimeRequire.resolve(name)).href)
}

async function slideCount(edition) {
  const source = await fs.readFile(path.join(projectRoot, edition === 'enterprise'
    ? 'docs/.vitepress/theme/enterprise-training-slides.js'
    : 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'), 'utf8')
  const match = source.match(edition === 'enterprise' ? /const\s+enterpriseSlideCount\s*=\s*(\d+)/u : /const\s+expectedSlideCount\s*=\s*(\d+)/u)
  if (!match || Number(match[1]) < 1) throw new Error(`${edition} 未声明有效页数`)
  return Number(match[1])
}

/** 递归绑定课件直接源码依赖，新增的封面/案例组件同样进入候选哈希。 */
export async function nativePdfSourceFingerprint() {
  const pending = [path.join(projectRoot, 'docs/.vitepress/theme/components/TrainingSyllabusDeck.vue'),
    path.join(projectRoot, 'docs/.vitepress/theme/styles/training-syllabus-deck.scss'),
    path.join(projectRoot, 'docs/doc/about/microi-training-syllabus.md')]
  const sources = new Map()
  while (pending.length) {
    const filename = pending.pop()
    if (sources.has(filename)) continue
    const source = await fs.readFile(filename)
    sources.set(filename, source)
    const imports = source.toString('utf8').matchAll(/(?:from\s*|import\s*|@(?:use|import)\s*)['"](\.[^'"]+)['"]/gu)
    for (const match of imports) {
      const imported = path.resolve(path.dirname(filename), match[1])
      if (!/\.(?:vue|[cm]?js|ts|s[ac]ss|css|json)$/u.test(imported)) continue
      // 下载与导航缩略图属于生成后的渠道回执，capture 中不可见；纳入它们会形成
      // “PDF 先生成 → 上传更新 URL → 原 PDF 哈希失效”的循环依赖。
      if (['training-downloads.js', 'training-previews.js'].includes(path.basename(imported))) continue
      if (!(await fs.stat(imported)).isFile()) throw new Error(`课件源码依赖不是普通文件：${imported}`)
      pending.push(imported)
    }
  }
  const hash = createHash('sha256')
  for (const [filename, bytes] of [...sources].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path.relative(projectRoot, filename).replaceAll('\\', '/'))
    hash.update(bytes)
  }
  return hash.digest('hex')
}

/** 必须等解码和实际绘制帧完成；HTTP 200 或自然宽度本身不能证明图像已进入 PDF。 */
async function inspectActiveSlide() {
  const deck = document.querySelector('.mci-training-deck')
  const active = deck?.querySelector('.mci-training-slide.is-active')
  const frame = active?.querySelector('.mci-training-slide__frame')
  if (!deck || !active || !frame) throw new Error('课件当前页尚未就绪')
  await document.fonts.ready
  const images = await Promise.all([...active.querySelectorAll('img')].map(async image => {
    image.loading = 'eager'
    await image.decode()
    if (!image.complete || image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error(`图片解码失败：${image.currentSrc || image.src}`)
    const rectangle = image.getBoundingClientRect()
    if (image.closest('.mci-enterprise-gallery, .mci-more-case-gallery, .mci-engine-gallery')) {
      // 图像矩形在画布内仍可能被 figure/button 裁掉；验证每个实际裁切祖先。
      for (let ancestor = image.parentElement; ancestor && ancestor !== active; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (!/(?:hidden|clip|scroll|auto)/u.test(`${style.overflowX} ${style.overflowY}`)) continue
        const clipping = ancestor.getBoundingClientRect()
        if (rectangle.left < clipping.left - 2 || rectangle.top < clipping.top - 2 || rectangle.right > clipping.right + 2 || rectangle.bottom > clipping.bottom + 2) throw new Error(`PDF 原图被祖先容器裁切：${image.currentSrc || image.src}`)
      }
    }
    return { src: image.currentSrc || image.src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      left: rectangle.left, top: rectangle.top, width: rectangle.width, height: rectangle.height,
      gallery: Boolean(image.closest('.mci-enterprise-gallery, .mci-more-case-gallery, .mci-engine-gallery')), objectFit: getComputedStyle(image).objectFit }
  }))
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const bounds = deck.getBoundingClientRect()
  const outside = images.filter(image => image.width <= 0 || image.height <= 0 || image.left < bounds.left - 1 || image.top < bounds.top - 1
    || image.left + image.width > bounds.right + 1 || image.top + image.height > bounds.bottom + 1)
  if (outside.length) throw new Error(`PDF 存在不可见或超出页面的图片：${outside.map(image => image.src).join(', ')}`)
  if (frame.scrollWidth > frame.clientWidth + 2 || frame.scrollHeight > frame.clientHeight + 2) throw new Error(`PDF 当前页溢出：${frame.scrollWidth}×${frame.scrollHeight} / ${frame.clientWidth}×${frame.clientHeight}`)
  if (images.some(image => image.gallery && image.objectFit !== 'contain')) throw new Error('成功案例 PDF 原图必须使用 contain 展示，不能裁切截图')
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT)
  const snippets = []
  let node
  while ((node = walker.nextNode())) {
    const element = node.parentElement
    const text = node.textContent.trim()
    if (!text || !element || element.closest('.mci-screen-only, script, style, .mci-enterprise-gallery figcaption')) continue
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0 || parseFloat(style.webkitTextStrokeWidth) > 0) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const box = range.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue
    // 装饰性轨道标签可部分裁切；正文、标题和截图图注必须完整显示。
    if (!element.closest('.mci-deck-core-visual, .mci-engine-visual, .mci-device-constellation') &&
      (box.left < bounds.left - 2 || box.top < bounds.top - 2 || box.right > bounds.right + 2 || box.bottom > bounds.bottom + 2)) throw new Error(`PDF 正文超出页面：${text.slice(0, 80)}`)
    if (text.replace(/\s/gu, '').length >= 4 && !element.closest('svg')) snippets.push(text)
  }
  const title = (frame.querySelector('h2') || frame.querySelector('h1') || frame.querySelector('strong'))?.textContent?.trim() || snippets[0]
  if (!title || snippets.join('').length < 40) throw new Error('PDF 当前页缺少可读正文')
  return { title, snippets, images, frame: { clientWidth: frame.clientWidth, clientHeight: frame.clientHeight, scrollWidth: frame.scrollWidth, scrollHeight: frame.scrollHeight } }
}

function assertMemoryBudget() {
  if (os.freemem() < Math.max(1.5 * 1024 ** 3, os.totalmem() * 0.05) + 1.5 * 1024 ** 3) throw new Error('可用内存不足，暂停本任务 PDF 浏览器生成')
}

export async function generateNativeTrainingPdfs(options) {
  await assertRegularTemporaryPath(options.captureRoot)
  await assertRegularTemporaryPath(options.outputRoot)
  assertMemoryBudget()
  const playwright = await runtimeModule(options.runtimeNodeModules, 'playwright')
  const { chromium } = playwright.chromium ? playwright : playwright.default
  const canvasModule = await runtimeModule(options.runtimeNodeModules, '@napi-rs/canvas')
  const canvasApi = canvasModule.createCanvas ? canvasModule : canvasModule.default
  const sourceSha256 = await nativePdfSourceFingerprint()
  const browser = await chromium.launch({ ...(options.executablePath ? { executablePath: options.executablePath } : { channel: options.channel }), headless: true, args: ['--disable-dev-shm-usage', '--renderer-process-limit=2', '--js-flags=--max-old-space-size=512'] })
  console.log(JSON.stringify({ stage: 'browser-started', pid: process.pid, startedAt: new Date().toISOString(), sourceSha256 }))
  const results = []
  const previews = []
  try {
    for (const edition of options.editions) for (const theme of options.themes) {
      const count = await slideCount(edition)
      const selected = options.slides || Array.from({ length: count }, (_, index) => index + 1)
      if (selected.some(index => index > count)) throw new Error(`${edition} 指定页超出 ${count} 页范围`)
      const directory = path.join(options.captureRoot, edition, theme)
      const previewDirectory = path.join(options.outputRoot, 'previews', edition, theme)
      await fs.mkdir(directory, { recursive: true })
      await fs.mkdir(previewDirectory, { recursive: true })
      const context = await browser.newContext({ viewport: dimensions, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: theme })
      try {
        const page = await context.newPage()
        await page.addInitScript(theme => localStorage.setItem('vitepress-theme-appearance', theme), theme)
        const url = new URL(options.url)
        url.searchParams.set('artifact-capture', '')
        url.hash = `${edition === 'enterprise' ? 'enterprise-' : ''}slide-01`
        await page.goto(url.href, { waitUntil: 'networkidle' })
        await page.waitForSelector('.mci-training-deck.is-artifact-capture .mci-training-slide.is-active')
        await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' })
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
        // page.pdf 继续使用屏幕 CSS，保持与真实课件相同的字号和缩略图排布。
        // 隐藏其它站点外壳而保留原有继承链，不能 clone 静态 HTML 后丢失 Vue 内容。
        await page.addStyleTag({ content: `@page { size: 1600px 900px; margin: 0; }
          html, body { margin:0!important; width:1600px!important; height:900px!important; overflow:hidden!important; }
          body * { visibility:hidden!important; }
          .mci-training-deck, .mci-training-deck * { visibility:visible!important; }
          .mci-training-deck .mci-training-slide:not(.is-active) { visibility:hidden!important; display:none!important; }
          .mci-training-deck { transform:none!important; }
          .mci-training-deck *, .mci-training-deck *::before, .mci-training-deck *::after { animation:none!important; transition:none!important; }
          .mci-training-deck .mci-deck-reveal { opacity:1!important; transform:none!important; }
          .mci-training-deck .mci-screen-only { display:none!important; }
          /* PDF 只需要原图缩略排列。序号图注会在固定槽位外被正文 figure 规则裁切，
             隐藏重复标签并让按钮使用槽位高度，确保 contain 的完整原图没有第二层裁切。 */
          .mci-training-deck .mci-enterprise-gallery figure { border:0!important; padding:0!important; min-height:0!important; }
          .mci-training-deck .mci-enterprise-gallery .mci-case-image { height:100%!important; min-height:0!important; }
          .mci-training-deck .mci-enterprise-gallery button { height:100%!important; aspect-ratio:auto!important; box-sizing:border-box!important; }
          .mci-training-deck .mci-enterprise-gallery img { width:100%!important; height:100%!important; max-height:none!important; margin:0!important; object-fit:contain!important; box-sizing:border-box!important; }
          .mci-training-deck .mci-enterprise-gallery figcaption { display:none!important; }` })
        const slides = []
        for (const index of selected) {
          if (os.freemem() < os.totalmem() * 0.05) throw new Error('系统内存占用达到95%，停止本任务 PDF 浏览器')
          if (sourceSha256 !== await nativePdfSourceFingerprint()) throw new Error('课件源码在生成中发生变化，停止当前候选捕获')
          await page.evaluate(({ edition, index }) => { location.hash = `${edition === 'enterprise' ? 'enterprise-' : ''}slide-${String(index).padStart(2, '0')}` }, { edition, index })
          await page.waitForFunction(({ edition, index }) => document.querySelector('.mci-training-deck')?.getAttribute('data-version') === edition &&
            document.querySelector('.mci-training-deck__counter strong')?.textContent === String(index).padStart(2, '0'), { edition, index })
          const slide = await page.evaluate(inspectActiveSlide)
          const referencePath = path.join(directory, `slide-${String(index).padStart(2, '0')}.png`)
          const reference = await page.locator('.mci-training-deck').screenshot({ path: referencePath, animations: 'disabled' })
          const bitmap = await canvasApi.loadImage(reference)
          const thumbnail = canvasApi.createCanvas(320, 180)
          thumbnail.getContext('2d').drawImage(bitmap, 0, 0, 320, 180)
          const thumbnailPath = path.join(previewDirectory, `slide-${String(index).padStart(2, '0')}.webp`)
          const thumbnailBytes = await thumbnail.encode('webp', 86)
          await fs.writeFile(thumbnailPath, thumbnailBytes)
          const pdfPath = path.join(directory, `slide-${String(index).padStart(2, '0')}.pdf`)
          await page.pdf({ path: pdfPath, width: '1600px', height: '900px', printBackground: true, displayHeaderFooter: false,
            preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, tagged: true })
          slides.push({ index, ...slide, pdfPath, referencePath, thumbnailPath, thumbnailBytes: thumbnailBytes.length,
            thumbnailSha256: createHash('sha256').update(thumbnailBytes).digest('hex') })
          console.log(JSON.stringify({ stage: 'captured', edition, theme, page: index, count, images: slide.images.length, textNodes: slide.snippets.length }))
        }
        if (sourceSha256 !== await nativePdfSourceFingerprint()) throw new Error('课件源码在生成中发生变化，拒绝复用混合版本 PDF')
        await page.close()
        const filename = `${names[edition]}-${theme}${options.slides ? '-sample' : ''}.pdf`
        const outputPath = path.join(options.outputRoot, filename)
        // 两版都保留原生合并件作为视觉/字序比对基准，避免技术版配图增加后再次出现卡顿。
        const nativeOutputPath = path.join(directory, 'native-merged.pdf')
        const manifest = { schema: 'native-training-pdf.v1', edition, theme, dimensions, sourceSha256, expectedPageCount: selected.length, outputPath: nativeOutputPath, slides }
        const manifestPath = path.join(directory, 'manifest.json')
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
        const merge = spawnSync(options.runtimePython, ['-X', 'utf8', path.join(projectRoot, 'scripts/merge-training-deck-native-pdfs.py'), '--manifest', manifestPath],
          { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 })
        if (merge.status !== 0) throw new Error(`原生 PDF 合并/文字验收失败：${merge.stderr || merge.stdout || merge.error}`)
        const nativeResult = JSON.parse(merge.stdout.trim())
        const result = await finalizeNativeTrainingPdf({ edition, nativeResult, outputPath, captureDirectory: directory, runtimePython: options.runtimePython })
        for (const slide of slides) previews.push({ edition, theme, index: slide.index,
          legacyPath: `/images/${edition === 'enterprise' ? 'training-deck-enterprise' : 'training-deck'}/${theme === 'dark' ? 'thumbs' : 'thumbs-light'}/slide-${String(slide.index).padStart(2, '0')}.webp`,
          path: slide.thumbnailPath, bytes: slide.thumbnailBytes, sha256: slide.thumbnailSha256, mimeType: 'image/webp' })
        results.push({ ...result, manifestPath, sourceSha256 })
        const { pageEvidence, ...summary } = result
        console.log(JSON.stringify({ stage: 'complete', ...summary, sourceSha256 }))
      } finally { await context.close() }
    }
  } finally { await browser.close() }
  await fs.mkdir(options.outputRoot, { recursive: true })
  await fs.writeFile(path.join(options.outputRoot, options.slides ? 'sample-results.json' : 'results.json'), JSON.stringify(results, null, 2))
  await fs.writeFile(path.join(options.outputRoot, options.slides ? 'sample-preview-upload-inputs.json' : 'preview-upload-inputs.json'), JSON.stringify(previews, null, 2))
  return results
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateNativeTrainingPdfs(parseNativePdfOptions(process.argv.slice(2))).catch(error => { console.error(error); process.exitCode = 1 })
}
