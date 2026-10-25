import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../docs/public/', import.meta.url))

// Keep the existing public files as compatibility aliases. Only build output
// receives fingerprinted copies; the hash and emitted bytes share one snapshot.
export function readFancyboxAssets(directory = publicDir) {
  return [
    ['fancybox.css', 'text/css; charset=utf-8'],
    ['fancybox.umd.js', 'application/javascript; charset=utf-8']
  ].map(([name, contentType]) => {
    const bytes = readFileSync(join(directory, 'assets', name))
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const filename = name.replace(/\.(css|js)$/, `.${sha256}.$1`)
    return { name, bytes, sha256, contentType, url: `/assets/${filename}` }
  })
}

const assets = readFancyboxAssets()
export const fancyboxUrls = { css: assets[0].url, script: assets[1].url }

export async function writeFancyboxAssets(siteConfig, snapshot = assets) {
  await mkdir(join(siteConfig.outDir, 'assets'), { recursive: true })
  for (const asset of snapshot) {
    await writeFile(join(siteConfig.outDir, asset.url.slice(1)), asset.bytes)
  }
}

export function fancyboxDevPlugin(snapshot = assets) {
  return {
    name: 'microi-fancybox-fingerprints',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const pathname = (request.url || '').split('?')[0]
        const asset = snapshot.find(item => item.url === pathname)
        if (!asset) return next()
        response.setHeader('Content-Type', asset.contentType)
        response.setHeader('Content-Length', asset.bytes.length)
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        response.end(request.method === 'HEAD' ? undefined : asset.bytes)
      })
    }
  }
}
