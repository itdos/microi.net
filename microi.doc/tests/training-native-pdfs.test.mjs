import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertTrainingTemporaryPath, finalizeNativeTrainingPdf, nativePdfSourceFingerprint, parseNativePdfOptions } from '../scripts/generate-training-deck-native-pdfs.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)

test('原生 PDF 默认串行导出四套课件到 .tmp，样页需要显式选择', () => {
  const options = parseNativePdfOptions([])
  assert.deepEqual(options.editions, ['technical', 'enterprise'])
  assert.deepEqual(options.themes, ['dark', 'light'])
  assert.equal(options.outputRoot, path.join(workspaceRoot, '.tmp/training-20261016/pdf'))
  assert.equal(options.slides, null)
  assert.deepEqual(parseNativePdfOptions(['--edition', 'enterprise', '--theme', 'light', '--slides', '1,5,10']).slides, [1, 5, 10])
})

test('PDF 参数拒绝无效选择、重复参数和带凭据的地址', () => {
  for (const args of [['--edition', 'unknown'], ['--theme', 'sepia'], ['--slides', '1,1'], ['--slides', '0'], ['--slides', '1,no'], ['--slides', '1.5'], ['--theme'], ['--unknown', 'x'], ['--theme', 'dark', '--theme', 'light'], ['--url', 'file:///private'], ['--url', 'https://user:secret@example.invalid']]) assert.throws(() => parseNativePdfOptions(args))
  assert.equal(assertTrainingTemporaryPath(path.join(workspaceRoot, '.tmp/training-20261016/pdf')), path.join(workspaceRoot, '.tmp/training-20261016/pdf'))
  for (const target of [path.join(projectRoot, 'docs/public/downloads'), path.join(workspaceRoot, '../external'), workspaceRoot]) assert.throws(() => assertTrainingTemporaryPath(target), /工作区 .tmp/u)
})

test('原生 PDF 捕获绑定真实组件依赖、解码图片与最终可选择文字', async () => {
  const fingerprint = await nativePdfSourceFingerprint()
  assert.match(fingerprint, /^[a-f0-9]{64}$/u)
  assert.equal(fingerprint, await nativePdfSourceFingerprint())
  const generator = fs.readFileSync(path.join(projectRoot, 'scripts/generate-training-deck-native-pdfs.mjs'), 'utf8')
  assert.match(generator, /await image\.decode\(\)/u)
  assert.match(generator, /frame\.scrollHeight > frame\.clientHeight/u)
  assert.match(generator, /rectangle\.bottom > clipping\.bottom \+ 2/u, '图片必须处于每层裁切祖先的可见矩形内')
  assert.match(generator, /mci-enterprise-gallery button \{ height:100%!important; aspect-ratio:auto!important/u)
  assert.match(generator, /mci-enterprise-gallery img \{ width:100%!important; height:100%!important/u, '导出原图尺寸不受正文自然图片高度覆盖')
  assert.match(generator, /mci-enterprise-gallery figcaption \{ display:none!important/u, 'PDF只隐藏截图重复标签，业务正文继续逐条验收')
  assert.match(generator, /await page\.pdf\(/u)
  assert.doesNotMatch(generator, /Promise\.all\(options\.(?:editions|themes)/u)
  const verifier = fs.readFileSync(path.join(projectRoot, 'scripts/merge-training-deck-native-pdfs.py'), 'utf8')
  assert.match(verifier, /final = PdfReader\(output_path\)/u)
  assert.match(verifier, /page\.extract_text\(\)/u)
  assert.match(verifier, /searchable PDF text missing/u)
  assert.match(verifier, /embedded\.replace\(bitmap, quality=90, subsampling=0/u, '原生合并件继续保留，用于企业优化后的全文和视觉比对')
})

test('企业导出默认验收轻量候选，技术版保持原生输出，错误回执不能成为最终件', async () => {
  fs.mkdirSync(path.join(workspaceRoot, '.tmp/training-pdf-20261017/pipeline'), { recursive: true })
  const directory = fs.mkdtempSync(path.join(workspaceRoot, '.tmp/training-pdf-20261017/pipeline/native-integration-'))
  try {
    const source = Buffer.from('native-source-fixture')
    const nativeResult = { path: path.join(directory, 'native.pdf'), bytes: source.length,
      sha256: createHash('sha256').update(source).digest('hex'), pages: 10, galleryImageCount: 22 }
    fs.writeFileSync(nativeResult.path, source)
    const outputPath = path.join(directory, 'enterprise.pdf')
    const options = { nativeResult, outputPath, captureDirectory: directory, runtimePython: 'fixture-python' }
    const technical = await finalizeNativeTrainingPdf({ ...options, edition: 'technical' }, () => assert.fail('技术版不调用优化器'))
    assert.equal(technical, nativeResult)
    assert.equal(fs.existsSync(outputPath), false)
    const optimizerSource = path.join(projectRoot, 'scripts/optimize-training-deck-pdf.py')
    const optimizerHash = createHash('sha256').update(fs.readFileSync(optimizerSource)).digest('hex')
    const candidateBytes = Buffer.from('lightweight-verified-candidate')
    let calls = 0
    const runner = (python, args) => {
      calls += 1
      assert.equal(python, 'fixture-python')
      assert.equal(args[2], optimizerSource)
      assert.equal(args[4], nativeResult.path)
      const candidatePath = args[6]
      fs.writeFileSync(candidatePath, candidateBytes)
      return { status: 0, stdout: JSON.stringify({ path: candidatePath, bytes: candidateBytes.length,
        sha256: createHash('sha256').update(candidateBytes).digest('hex'), sourceSha256: nativeResult.sha256,
        optimizerSha256: optimizerHash, pages: 10, nativeTextVerified: true, linearized: true,
        visualImages: 10, formObjects: 0, softMasks: 0 }) }
    }
    const result = await finalizeNativeTrainingPdf({ ...options, edition: 'enterprise' }, runner)
    assert.equal(calls, 1)
    assert.deepEqual(fs.readFileSync(outputPath), candidateBytes)
    assert.deepEqual(fs.readFileSync(nativeResult.path), source)
    assert.equal(result.galleryImageCount, 22, '保留原生捕获对22张截图的验收证据')
    assert.equal(result.visualImages, 10)
    assert.equal(result.optimizerSha256, optimizerHash)
    assert.equal(result.nativeSourcePdf.sha256, nativeResult.sha256)
    const rejectedPath = path.join(directory, 'rejected.pdf')
    const badRunner = (...args) => {
      const run = runner(...args)
      return { ...run, stdout: JSON.stringify({ ...JSON.parse(run.stdout), nativeTextVerified: false }) }
    }
    await assert.rejects(finalizeNativeTrainingPdf({ ...options, outputPath: rejectedPath, edition: 'enterprise' }, badRunner), /回执/u)
    assert.equal(fs.existsSync(rejectedPath), false)
    const existingPdf = path.join(directory, 'unknown-old.pdf')
    fs.writeFileSync(existingPdf, 'unknown-old-final')
    await assert.rejects(finalizeNativeTrainingPdf({ ...options, outputPath: existingPdf, edition: 'enterprise' }, runner), { code: 'EEXIST' })
    assert.equal(fs.readFileSync(existingPdf, 'utf8'), 'unknown-old-final')
    assert.equal(fs.existsSync(existingPdf.replace('.pdf', '.validation.json')), false)
    const protectedPdf = path.join(directory, 'unknown-sidecar.pdf')
    const protectedSidecar = protectedPdf.replace('.pdf', '.validation.json')
    fs.writeFileSync(protectedSidecar, 'unknown-old-receipt')
    await assert.rejects(finalizeNativeTrainingPdf({ ...options, outputPath: protectedPdf, edition: 'enterprise' }, runner), { code: 'EEXIST' })
    assert.equal(fs.readFileSync(protectedSidecar, 'utf8'), 'unknown-old-receipt')
    assert.equal(fs.existsSync(protectedPdf), false)
  } finally {
    assertTrainingTemporaryPath(fs.realpathSync(directory))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('全新检出运行课件测试会自动准备当前预览并逐件验签', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).scripts
  assert.equal(scripts['prepare:training-previews'], 'node scripts/prepare-training-previews.mjs')
  assert.ok(scripts['pretest:training-deck'].includes('npm run prepare:training-previews'))
  const prepare = fs.readFileSync(path.join(projectRoot, 'scripts/prepare-training-previews.mjs'), 'utf8')
  assert.match(prepare, /prepareDocAssets\(\{ \.\.\.options, assets: trainingPreviewAssets \}\)/u)
})
