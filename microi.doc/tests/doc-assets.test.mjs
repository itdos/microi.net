import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  getDocAssetCachePath, parseDocAssetOptions, prepareDocAssets, validateDocAssets,
  verifiedDocAssetPath, verifyDocAssetBytes,
} from '../scripts/prepare-doc-assets.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const bytes = Buffer.from('89504e470d0a1a0a00000000494d4147', 'hex')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const first = { legacyPath: '/images/a/example.png', url: `https://file.microi.net/itdos/official-docs/images/${sha256}/202610/example.png`, bytes: bytes.length, sha256, mimeType: 'image/png' }
const sameBytes = { ...first, legacyPath: '/api_plugins/example.png' }
const assets = [first, sameBytes]

function isolatedDirectory() {
  const root = path.join(workspaceRoot, '.tmp', 'microi-doc-image-tests', randomUUID())
  fs.mkdirSync(root, { recursive: true })
  return root
}

function cachedFile(cacheRoot, asset = first) {
  const target = getDocAssetCachePath(asset, cacheRoot)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  return target
}

function response(body = bytes, headers = {}) {
  return new Response(body, { headers: { 'content-type': 'image/png', ...headers } })
}

test('清单支持精确旧地址与同字节别名，拒绝未知地址、凭据、越界及不同字节同URL', () => {
  assert.equal(validateDocAssets(assets).length, 2)
  const alter = patch => [{ ...first, ...patch }]
  for (const legacyPath of ['/images/../private.png', '/images/a//b.png', '/images/a%2fb.png', '/images/a%2eb.png', '/images/a\\b.png', '/images/a.png?q=1', '/other/a.png']) {
    assert.throws(() => validateDocAssets(alter({ legacyPath })), /旧地址/u)
  }
  for (const url of [first.url.replace('file.microi.net', 'evil.example'), first.url.replace(sha256, '0'.repeat(64)), `${first.url}?secret=x`, `${first.url}#x`, first.url.replace('https://', 'https://user:pass@'), first.url.replace('/202610/', '/202610/nested/')]) {
    assert.throws(() => validateDocAssets(alter({ url })), /官方 CDN/u)
  }
  assert.throws(() => validateDocAssets([]), /不能为空/u)
  assert.throws(() => validateDocAssets([first, first]), /重复/u)
  assert.throws(() => validateDocAssets([first, { ...sameBytes, bytes: first.bytes + 1 }]), /不同字节/u)
  assert.throws(() => validateDocAssets(alter({ mimeType: 'text/html' })), /MIME/u)
  assert.throws(() => verifiedDocAssetPath('/images/unknown.png', assets), /未在已验证清单/u)
  assert.throws(() => getDocAssetCachePath(first, path.join(workspaceRoot, 'microi.doc/docs/public/images')), /工作区 .tmp/u)
})

test('同名图片按旧路径分隔缓存，既有缓存逐次校验，不能凭哈希目录信任错误字节', async () => {
  const cacheRoot = isolatedDirectory()
  let requests = 0
  const records = await prepareDocAssets({ assets, cacheRoot, fetchAsset: async (url, options) => {
    requests += 1
    assert.equal(url, first.url)
    assert.equal(options.redirect, 'error')
    return response()
  } })
  assert.equal(requests, 2)
  assert.equal(records.length, 2)
  assert.notEqual(getDocAssetCachePath(first, cacheRoot), getDocAssetCachePath(sameBytes, cacheRoot))
  assert.deepEqual(fs.readFileSync(verifiedDocAssetPath(first.url, assets, cacheRoot)), bytes)
  assert.deepEqual(fs.readFileSync(verifiedDocAssetPath(sameBytes.legacyPath, assets, cacheRoot)), bytes)
  const reused = await prepareDocAssets({ assets, cacheRoot, fetchAsset: async () => { throw new Error('不应请求网络') } })
  assert.ok(reused.every(record => record.source === 'verified-cache'))
  const corrupted = Buffer.from(bytes)
  corrupted[corrupted.length - 1] ^= 1
  fs.writeFileSync(getDocAssetCachePath(first, cacheRoot), corrupted)
  await assert.rejects(prepareDocAssets({ assets, cacheRoot }), /SHA-256 不符/u)
  assert.deepEqual(fs.readFileSync(getDocAssetCachePath(first, cacheRoot)), corrupted, '失败关闭，保留未知缓存供诊断')
})

test('subset只准备精确已声明资源，缺失缓存和错误子集均失败', async () => {
  const cacheRoot = isolatedDirectory()
  await assert.rejects(prepareDocAssets({ assets, cacheRoot, verifyOnly: true }), /夹具缺失/u)
  for (const only of [[], [first.legacyPath, first.legacyPath], ['/images/unknown.png']]) {
    await assert.rejects(prepareDocAssets({ assets, cacheRoot, only, fetchAsset: async () => { throw new Error('不得发请求') } }), /子集|未在已验证清单/u)
  }
  const records = await prepareDocAssets({ assets, cacheRoot, only: [sameBytes.legacyPath], fetchAsset: async () => response() })
  assert.equal(records.length, 1)
  assert.ok(!fs.existsSync(getDocAssetCachePath(first, cacheRoot)))
  assert.deepEqual(fs.readFileSync(verifiedDocAssetPath(sameBytes.legacyPath, assets, cacheRoot)), bytes)
})

test('seed按完整路径验签，超大种子和缓存在读取前拒绝', async context => {
  const cacheRoot = isolatedDirectory()
  const seedDirectory = isolatedDirectory()
  const seed = path.join(seedDirectory, first.legacyPath.slice(1))
  fs.mkdirSync(path.dirname(seed), { recursive: true })
  fs.writeFileSync(seed, bytes)
  const result = await prepareDocAssets({ assets: [first], cacheRoot, seedDirectory })
  assert.equal(result[0].source, 'verified-seed')
  assert.deepEqual(fs.readFileSync(verifiedDocAssetPath(first.legacyPath, assets, cacheRoot)), bytes)
  const contaminatedCache = isolatedDirectory()
  const target = cachedFile(contaminatedCache)
  fs.writeFileSync(target, '')
  fs.truncateSync(target, first.bytes + 1)
  fs.truncateSync(seed, first.bytes + 1)
  const originalRead = fs.readFileSync
  context.mock.method(fs, 'readFileSync', (file, ...args) => {
    assert.notEqual(file, target, '污染的大缓存不能读入内存')
    assert.notEqual(file, seed, '污染的大种子不能读入内存')
    return originalRead(file, ...args)
  })
  assert.throws(() => verifiedDocAssetPath(first.legacyPath, assets, contaminatedCache), /字节数不符/u)
  await assert.rejects(prepareDocAssets({ assets: [first], cacheRoot: isolatedDirectory(), seedDirectory }), /种子字节数不符/u)
})

test('HTTP错误、MIME错误、错误指纹和无长度超限响应不提交缓存', async () => {
  for (const fetchAsset of [
    async () => new Response('redirect', { status: 302 }),
    async () => response(bytes, { 'content-type': 'text/html' }),
    async () => response(Buffer.alloc(first.bytes)),
    async () => response(Buffer.alloc(first.bytes + 1)),
  ]) {
    const cacheRoot = isolatedDirectory()
    await assert.rejects(prepareDocAssets({ assets: [first], cacheRoot, fetchAsset }), /HTTP 302|MIME|SHA-256|超过清单字节数/u)
    const target = getDocAssetCachePath(first, cacheRoot)
    assert.ok(!fs.existsSync(target))
    assert.deepEqual(fs.readdirSync(path.dirname(target)), [], '本次 .part 必须清理')
  }
  assert.deepEqual(verifyDocAssetBytes(first, bytes), bytes)
  assert.throws(() => verifyDocAssetBytes(first, bytes.subarray(1)), /字节数不符/u)
})

test('网络等待时目录被替换为junction则拒绝写入，不删除外部资产', async () => {
  const cacheRoot = isolatedDirectory()
  const outside = isolatedDirectory()
  const parent = path.dirname(cachedFile(cacheRoot))
  const displaced = `${parent}-original`
  await assert.rejects(prepareDocAssets({ assets: [first], cacheRoot, fetchAsset: async () => {
    fs.renameSync(parent, displaced)
    fs.symlinkSync(outside, parent, process.platform === 'win32' ? 'junction' : 'dir')
    return response()
  } }), /禁止符号链接/u)
  assert.deepEqual(fs.readdirSync(outside), [])
  assert.deepEqual(fs.readdirSync(displaced), [])
  assert.ok(fs.lstatSync(parent).isSymbolicLink())
})

test('排他创建失败保留未知同名部分文件，CLI拒绝无值与未知选项', async context => {
  const cacheRoot = isolatedDirectory()
  const originalOpen = fs.openSync
  let collision
  context.mock.method(fs, 'openSync', (file, flags, ...args) => {
    if (flags === 'wx' && String(file).endsWith('.part')) {
      collision = file
      const descriptor = originalOpen(file, 'wx')
      fs.writeFileSync(descriptor, 'unknown-owner')
      fs.closeSync(descriptor)
    }
    return originalOpen(file, flags, ...args)
  })
  await assert.rejects(prepareDocAssets({ assets: [first], cacheRoot, fetchAsset: async () => response() }), { code: 'EEXIST' })
  assert.equal(fs.readFileSync(collision, 'utf8'), 'unknown-owner')
  assert.deepEqual(parseDocAssetOptions(['--only', first.legacyPath, '--only', sameBytes.legacyPath, '--verify-only']), { only: [first.legacyPath, sameBytes.legacyPath], verifyOnly: true })
  assert.deepEqual(parseDocAssetOptions(['--seed', '/verified']), { seedDirectory: '/verified' })
  for (const options of [['--unknown'], ['--seed'], ['--only'], ['--verify-only', '--verify-only']]) assert.throws(() => parseDocAssetOptions(options), /参数只允许/u)
})
