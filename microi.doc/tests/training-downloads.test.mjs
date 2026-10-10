import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { trainingPdfPaths, trainingPptxPath } from '../docs/.vitepress/theme/training-deck-versions.js'
import { trainingDownloads } from '../docs/.vitepress/theme/training-downloads.js'
import { parseOptions } from '../scripts/generate-training-deck-pptx.mjs'
import { parseTrainingDownloadOptions, prepareTrainingDownloads, validateTrainingDownloads, verifiedTrainingAssetPath, verifyTrainingBytes } from '../scripts/prepare-training-downloads.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)
const first = trainingDownloads[0]

function isolatedCache() {
  const root = path.join(workspaceRoot, '.tmp', 'microi-docs-training-download-tests', randomUUID())
  fs.mkdirSync(root, { recursive: true })
  return root
}

function cachedFile(root) {
  const target = path.join(root, first.sha256, path.posix.basename(first.legacyPath))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  return target
}

test('培训下载分别使用已经发布的官方 PDF 与 PPTX CDN 地址', () => {
  for (const edition of ['technical', 'enterprise']) {
    for (const dark of [true, false]) {
      const pdf = new URL(trainingPdfPaths[edition][dark ? 'dark' : 'light'])
      const pptx = new URL(trainingPptxPath(edition, dark))
      assert.equal(pdf.origin, 'https://static.itdos.com')
      assert.equal(pptx.origin, 'https://static.itdos.com')
      assert.notEqual(pdf.pathname.split('/')[4], pptx.pathname.split('/')[4], '独立上传对象使用各自的内容指纹，不能由 PDF 后缀猜测 PPTX')
    }
  }
})

test('旧培训下载路径由真实官网 nginx 精确跳转，不能复制大文件或兜底为 HTML', () => {
  const conf = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/default.conf'), 'utf8')
  const rules = [...conf.matchAll(/location = (\/downloads\/[a-z0-9-]+\.(?:pdf|pptx)) \{\s*return 301 (https:\/\/static\.itdos\.com\/[^;]+);\s*\}/gu)]
  assert.equal(rules.length, 9, '九个存量下载地址都必须保留精确的服务端跳转')
  assert.equal(new Set(rules.map(match => match[1])).size, 9)
  for (const asset of trainingDownloads) assert.ok(rules.some(match => match[1] === asset.legacyPath && match[2] === asset.url), `旧地址必须跳转到同一份已验签原件：${asset.legacyPath}`)
  const dockerfile = fs.readFileSync(path.join(projectRoot, 'docs/.vitepress/Dockerfile'), 'utf8')
  assert.match(dockerfile, /COPY default\.conf \/etc\/nginx\/conf\.d\/default\.conf/u)
  assert.doesNotMatch(conf, /location\s+(?:\^~\s+)?\/downloads\/\s*\{/u, '不得把未知下载路径统一代理到 CDN 或首页')
})

test('九件清单绑定原始字节，18 页旧别名和四套当前课件分别保留', () => {
  assert.equal(validateTrainingDownloads().length, 9)
  assert.equal(trainingDownloads.reduce((sum, asset) => sum + asset.bytes, 0), 152_833_138)
  for (const asset of trainingDownloads) {
    const file = fs.readFileSync(verifiedTrainingAssetPath(asset.url))
    assert.equal(file.length, asset.bytes)
    assert.equal(createHash('sha256').update(file).digest('hex'), asset.sha256)
    assert.equal(path.basename(new URL(asset.url).pathname), path.basename(asset.legacyPath))
  }
  const legacy = fs.readFileSync(verifiedTrainingAssetPath('/downloads/microi-ai-development-framework-training-syllabus.pdf'))
  assert.equal(legacy.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.equal([...legacy.toString('latin1').matchAll(/\/Type\s*\/Page(?=[\s/])/gu)].length, 18)
  assert.match(legacy.toString('latin1'), /\/Count\s+18\b/u)
})

test('清单拒绝非官方、错误指纹、缺项、重复项与未声明下载地址', () => {
  const alter = patch => trainingDownloads.map((asset, index) => index === 0 ? { ...asset, ...patch } : asset)
  assert.throws(() => validateTrainingDownloads(alter({ url: first.url.replace('static.itdos.com', 'example.invalid') })), /官方 CDN/u)
  assert.throws(() => validateTrainingDownloads(alter({ url: first.url.replace(first.sha256, '0'.repeat(64)) })), /官方 CDN/u)
  assert.throws(() => validateTrainingDownloads(alter({ url: `${first.url}?token=unknown` })), /官方 CDN/u)
  assert.throws(() => validateTrainingDownloads(trainingDownloads.slice(1)), /九件/u)
  assert.throws(() => validateTrainingDownloads([first, ...trainingDownloads.slice(0, 8)]), /重复/u)
  assert.throws(() => verifiedTrainingAssetPath('https://static.itdos.com/unknown.pdf'), /未在已验证清单/u)
  assert.throws(() => verifiedTrainingAssetPath(first.url, path.join(projectRoot, 'docs/public/downloads')), /工作区 .tmp/u)
})

test('同长度错误字节和缺失缓存都失败，不能退回旧 public 文件', async () => {
  const bytes = Buffer.from('原始课件')
  const asset = { legacyPath: '/example.pdf', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  assert.deepEqual(verifyTrainingBytes(asset, bytes), bytes)
  const corrupted = Buffer.from(bytes)
  corrupted[0] ^= 1
  assert.throws(() => verifyTrainingBytes(asset, corrupted), /SHA-256 不符/u)
  assert.throws(() => verifyTrainingBytes(asset, bytes.subarray(1)), /字节数不符/u)
  const cacheRoot = isolatedCache()
  assert.throws(() => verifiedTrainingAssetPath(first.url, cacheRoot), /夹具缺失/u)
  await assert.rejects(prepareTrainingDownloads({ cacheRoot, verifyOnly: true }), /夹具缺失/u)
})

test('超大污染缓存和种子在读取前拒绝，保留原文件', async context => {
  const cacheRoot = isolatedCache()
  const target = cachedFile(cacheRoot)
  fs.writeFileSync(target, '')
  fs.truncateSync(target, first.bytes + 1)
  const originalRead = fs.readFileSync
  context.mock.method(fs, 'readFileSync', (file, ...args) => {
    assert.notEqual(file, target, '超大文件不应先完整加载进内存')
    return originalRead(file, ...args)
  })
  await assert.rejects(prepareTrainingDownloads({ cacheRoot }), /字节数不符/u)
  assert.equal(fs.statSync(target).size, first.bytes + 1)
  const emptyCache = isolatedCache()
  const seedDirectory = isolatedCache()
  const seed = path.join(seedDirectory, path.basename(first.legacyPath))
  fs.writeFileSync(seed, '')
  fs.truncateSync(seed, first.bytes + 1)
  context.mock.method(fs, 'readFileSync', (file, ...args) => {
    assert.notEqual(file, seed, '超大种子不应先完整加载进内存')
    return originalRead(file, ...args)
  })
  await assert.rejects(prepareTrainingDownloads({ cacheRoot: emptyCache, seedDirectory }), /种子字节数不符/u)
  assert.equal(fs.statSync(seed).size, first.bytes + 1)
})

test('下载失败和超限响应不提交缓存，也不遗留本次部分文件', async () => {
  const cacheRoot = isolatedCache()
  await assert.rejects(prepareTrainingDownloads({ cacheRoot, fetchAsset: async () => new Response('redirect', { status: 302 }) }), /HTTP 302/u)
  assert.deepEqual(fs.readdirSync(path.join(cacheRoot, first.sha256)), [])
  let remaining = first.bytes + 1
  const response = new Response(new ReadableStream({ pull(controller) {
    const size = Math.min(remaining, 1_048_576)
    if (!size) { controller.close(); return }
    remaining -= size
    controller.enqueue(new Uint8Array(size))
  } }))
  await assert.rejects(prepareTrainingDownloads({ cacheRoot, fetchAsset: async () => response }), /超过清单字节数/u)
  assert.deepEqual(fs.readdirSync(path.join(cacheRoot, first.sha256)), [])
})

test('等待网络期间被替换为 junction 的目录拒绝写入与清理外部文件', async () => {
  const cacheRoot = isolatedCache()
  const outside = isolatedCache()
  const parent = path.dirname(cachedFile(cacheRoot))
  const displaced = `${parent}-original`
  await assert.rejects(prepareTrainingDownloads({ cacheRoot, fetchAsset: async () => {
    fs.renameSync(parent, displaced)
    fs.symlinkSync(outside, parent, process.platform === 'win32' ? 'junction' : 'dir')
    return new Response('invalid bytes')
  } }), /禁止符号链接/u)
  assert.deepEqual(fs.readdirSync(outside), [], '外部目录不得出现 .part 或课件文件')
  assert.deepEqual(fs.readdirSync(displaced), [])
  assert.ok(fs.lstatSync(parent).isSymbolicLink(), '拒绝后保留未知链接，不擅自删除')
})

test('排他创建冲突不会删除未知同名部分文件', async context => {
  const cacheRoot = isolatedCache()
  const originalOpen = fs.openSync
  let collision
  context.mock.method(fs, 'openSync', (file, flags, ...args) => {
    if (flags === 'wx' && String(file).endsWith('.part')) {
      collision = file
      const fd = originalOpen(file, 'wx')
      fs.writeFileSync(fd, 'unknown-existing-owner')
      fs.closeSync(fd)
    }
    return originalOpen(file, flags, ...args)
  })
  await assert.rejects(prepareTrainingDownloads({ cacheRoot, fetchAsset: async () => new Response('short') }), { code: 'EEXIST' })
  assert.ok(collision)
  assert.equal(fs.readFileSync(collision, 'utf8'), 'unknown-existing-owner')
})

test('默认生成目标留在忽略目录，官网 public 不再承载九件大型下载', () => {
  assert.equal(parseOptions([]).outputRoot, path.join(workspaceRoot, '.tmp/training-deck-downloads/pptx'))
  const pdfGenerator = fs.readFileSync(path.join(projectRoot, 'scripts/generate-training-deck-pdfs.py'), 'utf8')
  assert.match(pdfGenerator, /default=WORKSPACE_ROOT \/ "\.tmp" \/ "training-deck-downloads" \/ "pdf"/u)
  assert.doesNotMatch(pdfGenerator, /PUBLIC_ROOT|shutil\.copy2|docs" \/ "public" \/ "downloads/u)
  for (const asset of trainingDownloads) assert.ok(!fs.existsSync(path.join(projectRoot, 'docs/public', asset.legacyPath.slice(1))), `大型文件必须已经保全到忽略目录：${asset.legacyPath}`)
  assert.deepEqual(parseTrainingDownloadOptions(['--verify-only']), { verifyOnly: true })
  assert.deepEqual(parseTrainingDownloadOptions(['--seed', '/verified', '--verify-only']), { seedDirectory: '/verified', verifyOnly: true })
  for (const args of [['--unknown'], ['--seed'], ['--verify-only', '--verify-only'], ['--seed', '--unknown']]) assert.throws(() => parseTrainingDownloadOptions(args), /参数只允许/u)
})
