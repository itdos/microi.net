import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { trainingDownloads } from '../docs/.vitepress/theme/training-downloads.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.dirname(projectRoot)
export const trainingCacheRoot = path.join(workspaceRoot, '.tmp', 'microi-docs-training-downloads')
const expectedNames = [
  'microi-ai-development-framework-training-syllabus-dark.pdf',
  'microi-ai-development-framework-training-syllabus-dark.pptx',
  'microi-ai-development-framework-training-syllabus-light.pdf',
  'microi-ai-development-framework-training-syllabus-light.pptx',
  'microi-ai-development-framework-training-syllabus.pdf',
  'microi-enterprise-application-training-syllabus-dark.pdf',
  'microi-enterprise-application-training-syllabus-dark.pptx',
  'microi-enterprise-application-training-syllabus-light.pdf',
  'microi-enterprise-application-training-syllabus-light.pptx',
]

export function validateTrainingDownloads(assets = trainingDownloads) {
  if (!Array.isArray(assets) || assets.length !== expectedNames.length) throw new Error('培训下载清单必须完整声明九件资源')
  const names = new Set()
  const urls = new Set()
  for (const asset of assets) {
    const name = path.posix.basename(asset.legacyPath || '')
    if (!expectedNames.includes(name) || asset.legacyPath !== `/downloads/${name}` || names.has(name)) throw new Error('培训下载旧地址重复或不在精确清单内')
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(asset.sha256 || '')) throw new Error('培训下载缺少有效字节数或 SHA-256')
    const url = new URL(asset.url)
    if (url.origin !== 'https://static.itdos.com' || url.username || url.password || url.search || url.hash || urls.has(asset.url)
      || !url.pathname.startsWith(`/itdos/official-docs/downloads/${asset.sha256}/`) || path.posix.basename(url.pathname) !== name) throw new Error('培训下载必须绑定官方 CDN 的独立内容指纹地址')
    const mimeType = name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    if (asset.mimeType !== mimeType) throw new Error('培训下载 MIME 类型与真实文件类型不符')
    names.add(name)
    urls.add(asset.url)
  }
  return assets
}

export function verifyTrainingBytes(asset, bytes) {
  if (bytes.length !== asset.bytes) throw new Error(`培训下载字节数不符：${asset.legacyPath}`)
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`培训下载 SHA-256 不符：${asset.legacyPath}`)
  return bytes
}

function assertRegularPath(target) {
  // 缓存只属于本工作区的 .tmp；逐级拒绝符号链接，防止测试或下载写入另一个源码目录。
  const relative = path.relative(workspaceRoot, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || relative.split(path.sep)[0] !== '.tmp') throw new Error('培训下载缓存必须位于工作区 .tmp 内')
  let current = workspaceRoot
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    let stat
    try { stat = fs.lstatSync(current) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (stat?.isSymbolicLink()) throw new Error(`培训下载缓存禁止符号链接：${current}`)
  }
  return target
}

function cachePath(asset, cacheRoot = trainingCacheRoot) {
  return assertRegularPath(path.join(cacheRoot, asset.sha256, path.posix.basename(asset.legacyPath)))
}

function readVerifiedFile(asset, target) {
  assertRegularPath(target)
  const stat = fs.lstatSync(target)
  if (!stat.isFile()) throw new Error(`培训下载缓存不是普通文件：${target}`)
  if (stat.size !== asset.bytes) throw new Error(`培训下载字节数不符：${asset.legacyPath}`)
  verifyTrainingBytes(asset, fs.readFileSync(target))
  return target
}

export function verifiedTrainingAssetPath(url, cacheRoot = trainingCacheRoot) {
  validateTrainingDownloads()
  const asset = trainingDownloads.find(row => row.url === url || row.legacyPath === url)
  if (!asset) throw new Error('培训下载地址未在已验证清单内声明')
  const target = cachePath(asset, cacheRoot)
  if (!fs.existsSync(target)) throw new Error(`培训下载夹具缺失，请先执行 npm run prepare:training-downloads：${asset.legacyPath}`)
  return readVerifiedFile(asset, target)
}

export async function prepareTrainingDownloads({ seedDirectory, verifyOnly = false, cacheRoot = trainingCacheRoot, fetchAsset = fetch } = {}) {
  validateTrainingDownloads()
  const result = []
  for (const asset of trainingDownloads) {
    const target = cachePath(asset, cacheRoot)
    if (fs.existsSync(target)) {
      readVerifiedFile(asset, target)
      result.push({ legacyPath: asset.legacyPath, bytes: asset.bytes, sha256: asset.sha256, source: 'verified-cache' })
      continue
    }
    if (verifyOnly) throw new Error(`培训下载夹具缺失：${asset.legacyPath}`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    assertRegularPath(target)
    const temporary = assertRegularPath(path.join(path.dirname(target), `.${randomUUID()}.part`))
    let temporaryOwner
    let descriptor
    let failure
    try {
      if (seedDirectory) {
        // 离线种子仍逐件校验字节；原始 CDN 回读可用作种子，不以本地同名文件代替发布证明。
        const seed = path.join(seedDirectory, path.posix.basename(asset.legacyPath))
        const stat = fs.lstatSync(seed)
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('培训下载种子必须是普通文件')
        if (stat.size !== asset.bytes) throw new Error(`培训下载种子字节数不符：${asset.legacyPath}`)
        const bytes = verifyTrainingBytes(asset, fs.readFileSync(seed))
        assertRegularPath(temporary)
        descriptor = fs.openSync(temporary, 'wx')
        temporaryOwner = fs.fstatSync(descriptor)
        fs.writeFileSync(descriptor, bytes)
        fs.closeSync(descriptor)
        descriptor = undefined
      } else {
        const response = await fetchAsset(asset.url, { redirect: 'error', signal: AbortSignal.timeout(90_000) })
        if (response.status !== 200 || !response.body) throw new Error(`培训下载 CDN 返回异常：${asset.legacyPath} HTTP ${response.status}`)
        const length = response.headers.get('content-length')
        if (length !== null && Number(length) !== asset.bytes) throw new Error(`培训下载 CDN 字节数不符：${asset.legacyPath}`)
        // 网络等待后重新检查目录，且先取得排他文件句柄；后续写入不会重新跟随路径中的链接。
        assertRegularPath(temporary)
        descriptor = fs.openSync(temporary, 'wx')
        temporaryOwner = fs.fstatSync(descriptor)
        let received = 0
        // 流式下载有固定字节上限；即使响应没有 Content-Length，也不能无限写满磁盘。
        const bounded = new Transform({ transform(chunk, _encoding, callback) {
          received += chunk.length
          callback(received > asset.bytes ? new Error('培训下载响应超过清单字节数') : null, chunk)
        } })
        await pipeline(Readable.fromWeb(response.body), bounded, fs.createWriteStream(temporary, { fd: descriptor, autoClose: true }))
        descriptor = undefined
      }
      readVerifiedFile(asset, temporary)
      // 以排他硬链接提交，避免并行准备器覆盖已经存在的缓存或未知文件；冲突只允许同字节复用。
      assertRegularPath(target)
      try { fs.linkSync(temporary, target) } catch (error) {
        if (error.code !== 'EEXIST') throw error
        readVerifiedFile(asset, target)
      }
      readVerifiedFile(asset, target)
      result.push({ legacyPath: asset.legacyPath, bytes: asset.bytes, sha256: asset.sha256, source: seedDirectory ? 'verified-seed' : 'verified-cdn' })
    } catch (error) {
      failure = error
      throw error
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor) } catch (error) { if (error.code !== 'EBADF') throw error }
      }
      // 只清理本次 wx 创建并仍具有同一 inode 的文件；排他创建失败时不得删除未知同名文件。
      if (temporaryOwner) {
        try {
          assertRegularPath(temporary)
          const current = fs.lstatSync(temporary)
          if (!current.isFile() || current.dev !== temporaryOwner.dev || current.ino !== temporaryOwner.ino) throw new Error('培训下载临时文件所有权已变化，拒绝清理')
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

export function parseTrainingDownloadOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--verify-only' && !options.verifyOnly) options.verifyOnly = true
    else if (args[index] === '--seed' && !options.seedDirectory && args[index + 1] && !args[index + 1].startsWith('--')) options.seedDirectory = args[++index]
    else throw new Error('参数只允许 --verify-only 和 --seed <已验证字节目录>')
  }
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const records = await prepareTrainingDownloads(parseTrainingDownloadOptions(process.argv.slice(2)))
  console.log(JSON.stringify({ cacheRoot: trainingCacheRoot, files: records.length, totalBytes: records.reduce((sum, row) => sum + row.bytes, 0), records }))
}
