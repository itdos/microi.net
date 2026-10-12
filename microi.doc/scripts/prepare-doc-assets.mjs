import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)
export const docAssetCacheRoot = path.join(workspaceRoot, '.tmp', 'microi-docs-images')
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])

// 清单由官方 MCP 上传及原字节回读产生；缓存工具不能根据旧路径猜测 CDN 地址。
export async function loadDocAssets() {
  return validateDocAssets((await import('../docs/.vitepress/theme/doc-assets.js')).docAssets)
}

export function validateDocAssets(assets) {
  if (!Array.isArray(assets) || !assets.length) throw new Error('官网图片清单不能为空')
  const routes = new Set()
  const urls = new Map()
  for (const asset of assets) {
    const route = asset.legacyPath || ''
    if (!/^\/(?:images|api_plugins)\/[^?#\\\u0000-\u001f]+$/u.test(route)
      || path.posix.normalize(route) !== route || /%(?:2f|5c|2e|00)/iu.test(route)
      || route.endsWith('/') || routes.has(route)) throw new Error('官网图片旧地址无效或重复')
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(asset.sha256 || '')
      || !imageTypes.has(asset.mimeType)) throw new Error('官网图片缺少有效字节数、SHA-256 或真实 MIME 类型')
    let url
    try { url = new URL(asset.url) } catch { throw new Error('官网图片必须绑定官方 CDN 的内容指纹地址') }
    const prefix = `/itdos/official-docs/images/${asset.sha256}/`
    const remainder = url.pathname.slice(prefix.length)
    if (url.origin !== 'https://file.microi.net' || url.username || url.password || url.search || url.hash
      || !url.pathname.startsWith(prefix) || !/^\d{6}\/[^/]+$/u.test(remainder)
      || /%(?:2f|5c|00)/iu.test(url.pathname) || asset.url !== url.href) throw new Error('官网图片必须绑定官方 CDN 的内容指纹地址')
    const identity = `${asset.sha256}:${asset.bytes}:${asset.mimeType}`
    if (urls.has(asset.url) && urls.get(asset.url) !== identity) throw new Error('官网图片同一 CDN 地址不能绑定不同字节')
    routes.add(route)
    urls.set(asset.url, identity)
  }
  return assets
}

export function verifyDocAssetBytes(asset, bytes) {
  if (bytes.length !== asset.bytes) throw new Error(`官网图片字节数不符：${asset.legacyPath}`)
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`官网图片 SHA-256 不符：${asset.legacyPath}`)
  return bytes
}

function assertCachePath(target) {
  const relative = path.relative(workspaceRoot, path.resolve(target))
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    || relative.split(path.sep)[0] !== '.tmp') throw new Error('官网图片缓存必须位于工作区 .tmp 内')
  let current = workspaceRoot
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    let stat
    try { stat = fs.lstatSync(current) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (stat?.isSymbolicLink()) throw new Error(`官网图片缓存禁止符号链接：${current}`)
  }
  return path.resolve(target)
}

function resolveAsset(reference, assets) {
  validateDocAssets(assets)
  const asset = assets.find(row => row.legacyPath === reference || row.url === reference)
  if (!asset) throw new Error(`官网图片地址未在已验证清单内声明：${reference}`)
  return asset
}

export function getDocAssetCachePath(asset, cacheRoot = docAssetCacheRoot) {
  validateDocAssets([asset])
  return assertCachePath(path.join(cacheRoot, asset.sha256, asset.legacyPath.slice(1)))
}

function readVerifiedFile(asset, target) {
  assertCachePath(target)
  const stat = fs.lstatSync(target)
  if (!stat.isFile()) throw new Error(`官网图片缓存不是普通文件：${target}`)
  // 在读入前拒绝污染的大文件；旧缓存也不能只凭目录里的 SHA 名称取得信任。
  if (stat.size !== asset.bytes) throw new Error(`官网图片字节数不符：${asset.legacyPath}`)
  verifyDocAssetBytes(asset, fs.readFileSync(target))
  return target
}

export function verifiedDocAssetPath(reference, assets, cacheRoot = docAssetCacheRoot) {
  const asset = resolveAsset(reference, assets)
  const target = getDocAssetCachePath(asset, cacheRoot)
  if (!fs.existsSync(target)) throw new Error(`官网图片夹具缺失，请先执行 npm run prepare:doc-assets：${asset.legacyPath}`)
  return readVerifiedFile(asset, target)
}

export const verifyCachedDocAsset = verifiedDocAssetPath

export async function prepareDocAssets({ assets, only, seedDirectory, verifyOnly = false, cacheRoot = docAssetCacheRoot, fetchAsset = fetch } = {}) {
  const declared = validateDocAssets(assets || await loadDocAssets())
  if (only !== undefined && (!Array.isArray(only) || !only.length || new Set(only).size !== only.length)) throw new Error('官网图片子集必须为非空、不重复的精确声明地址')
  const selected = only ? only.map(reference => resolveAsset(reference, declared)) : declared
  const result = []
  for (const asset of selected) {
    const target = getDocAssetCachePath(asset, cacheRoot)
    if (fs.existsSync(target)) {
      readVerifiedFile(asset, target)
      result.push({ ...asset, source: 'verified-cache' })
      continue
    }
    if (verifyOnly) throw new Error(`官网图片夹具缺失：${asset.legacyPath}`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    assertCachePath(target)
    const temporary = assertCachePath(path.join(path.dirname(target), `.${randomUUID()}.part`))
    let owner
    let descriptor
    let failure
    try {
      if (seedDirectory) {
        // 种子保持完整旧路径层级，避免不同目录中的 slide-01 等同名文件互相覆盖。
        const seed = path.resolve(seedDirectory, asset.legacyPath.slice(1))
        const stat = fs.lstatSync(seed)
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('官网图片种子必须是普通文件')
        if (stat.size !== asset.bytes) throw new Error(`官网图片种子字节数不符：${asset.legacyPath}`)
        const bytes = verifyDocAssetBytes(asset, fs.readFileSync(seed))
        assertCachePath(temporary)
        descriptor = fs.openSync(temporary, 'wx')
        owner = fs.fstatSync(descriptor)
        fs.writeFileSync(descriptor, bytes)
        fs.closeSync(descriptor)
        descriptor = undefined
      } else {
        const response = await fetchAsset(asset.url, { redirect: 'error', signal: AbortSignal.timeout(90_000) })
        if (response.status !== 200 || !response.body) throw new Error(`官网图片 CDN 返回异常：${asset.legacyPath} HTTP ${response.status}`)
        const length = response.headers.get('content-length')
        if (length !== null && Number(length) !== asset.bytes) throw new Error(`官网图片 CDN 字节数不符：${asset.legacyPath}`)
        const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
        if (mime !== asset.mimeType) throw new Error(`官网图片 CDN MIME 类型不符：${asset.legacyPath}`)
        assertCachePath(temporary)
        descriptor = fs.openSync(temporary, 'wx')
        owner = fs.fstatSync(descriptor)
        let received = 0
        const bounded = new Transform({ transform(chunk, _encoding, callback) {
          received += chunk.length
          callback(received > asset.bytes ? new Error('官网图片响应超过清单字节数') : null, chunk)
        } })
        await pipeline(Readable.fromWeb(response.body), bounded, fs.createWriteStream(temporary, { fd: descriptor, autoClose: true }))
        descriptor = undefined
      }
      readVerifiedFile(asset, temporary)
      assertCachePath(target)
      // wx 文件与排他 link 保证两个准备器不会覆盖对方；已存在目标必须同样验签。
      try { fs.linkSync(temporary, target) } catch (error) {
        if (error.code !== 'EEXIST') throw error
        readVerifiedFile(asset, target)
      }
      readVerifiedFile(asset, target)
      result.push({ ...asset, source: seedDirectory ? 'verified-seed' : 'verified-cdn' })
    } catch (error) {
      failure = error
      throw error
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor) } catch (error) { if (error.code !== 'EBADF') throw error }
      }
      if (owner) {
        try {
          assertCachePath(temporary)
          const stat = fs.lstatSync(temporary)
          if (!stat.isFile() || stat.dev !== owner.dev || stat.ino !== owner.ino) throw new Error('官网图片临时文件所有权已变化，拒绝清理')
          fs.unlinkSync(temporary)
        } catch (error) {
          if (failure) failure.cause = error
          else throw error
        }
      }
    }
  }
  return result
}

export function parseDocAssetOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    const value = args[index + 1]
    if (option === '--verify-only' && !options.verifyOnly) options.verifyOnly = true
    else if (option === '--seed' && !options.seedDirectory && value && !value.startsWith('--')) options.seedDirectory = args[++index]
    else if (option === '--only' && value && !value.startsWith('--')) (options.only ||= []).push(args[++index])
    else throw new Error('参数只允许 --verify-only、--seed <旧路径层级目录> 和 --only <清单精确地址>')
  }
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const records = await prepareDocAssets(parseDocAssetOptions(process.argv.slice(2)))
  console.log(JSON.stringify({ cacheRoot: docAssetCacheRoot, files: records.length, totalBytes: records.reduce((sum, row) => sum + row.bytes, 0), records }))
}
