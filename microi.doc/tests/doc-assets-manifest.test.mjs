import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { docAssets, getDocAssetUrl } from '../docs/.vitepress/theme/doc-assets.js'
import { validateDocAssets, verifiedDocAssetPath } from '../scripts/prepare-doc-assets.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function actualImageMime(bytes) {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg'
  if (/^GIF8[79]a$/u.test(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (/<svg(?:\s|>)/u.test(bytes.toString('utf8', 0, Math.min(bytes.length, 512)))) return 'image/svg+xml'
  throw new Error('清单中的文件必须是真实图片')
}

test('官方图片清单的每个旧地址均解析到精确CDN原件，未知地址失败关闭', () => {
  validateDocAssets(docAssets)
  for (const asset of docAssets) assert.equal(getDocAssetUrl(asset.legacyPath), asset.url, asset.legacyPath)
  for (const reference of ['/images/unknown.png', '/api_plugins/unknown.png', '/images/../private.png', 'https://evil.example/a.png']) {
    assert.throws(() => getDocAssetUrl(reference), undefined, `unknown image route must fail: ${reference}`)
  }
})

test('全部官方图片缓存逐件保持清单原字节和实际格式，不能按旧后缀猜测MIME', () => {
  for (const asset of docAssets) {
    const bytes = fs.readFileSync(verifiedDocAssetPath(asset.legacyPath, docAssets))
    assert.equal(actualImageMime(bytes), asset.mimeType, asset.legacyPath)
  }
})

test('已迁移的图片不再残留于公开源码目录，文本架构元数据继续保留', () => {
  for (const asset of docAssets) {
    assert.ok(!fs.existsSync(path.join(projectRoot, 'docs/public', asset.legacyPath.slice(1))), `CDN image must not be committed again: ${asset.legacyPath}`)
  }
  assert.ok(fs.existsSync(path.join(projectRoot, 'docs/public/images/microi-ai-platform-architecture.manifest.json')))
})
