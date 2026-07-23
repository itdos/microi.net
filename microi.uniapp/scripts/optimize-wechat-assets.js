const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const staticRoot = path.resolve(__dirname, '../src/static')
const imageExtensions = new Set(['.png', '.jpg', '.jpeg'])

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function jpegTarget(relativePath) {
  if (relativePath.endsWith('xjy/water-hero.jpg')) return { width: 960, quality: 66 }
  if (relativePath.endsWith('xjy/product-water-purifier.jpg')) return { width: 480, height: 480, quality: 70 }
  if (relativePath.endsWith('xjy/logo.jpeg')) return { width: 256, height: 256, quality: 72 }
  return null
}

async function optimize(file) {
  const ext = path.extname(file).toLowerCase()
  if (!imageExtensions.has(ext)) return null

  const relativePath = path.relative(staticRoot, file).replace(/\\/g, '/')
  const sourceSize = fs.statSync(file).size
  const source = fs.readFileSync(file)
  const metadata = await sharp(source).metadata()
  let pipeline = sharp(source)

  if (ext === '.jpg' || ext === '.jpeg') {
    const target = jpegTarget(relativePath)
    if (!target) return null
    const alreadySized = metadata.width <= target.width && (!target.height || metadata.height <= target.height)
    if (alreadySized) return null
    pipeline = pipeline
      .resize({ width: target.width, height: target.height, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: target.quality, progressive: true, chromaSubsampling: '4:2:0', mozjpeg: true })
  } else {
    const squareIcon = metadata.width >= 128 && metadata.height >= 128 && Math.max(metadata.width, metadata.height) / Math.min(metadata.width, metadata.height) < 1.25
    const targetSize = squareIcon ? 96 : null
    const alreadyOptimized = Boolean(metadata.isPalette) && (!targetSize || (metadata.width <= targetSize && metadata.height <= targetSize))
    if (alreadyOptimized) return null
    if (targetSize) {
      pipeline = pipeline.resize({ width: targetSize, height: targetSize, fit: 'inside', withoutEnlargement: true })
    }
    pipeline = pipeline.png({ palette: true, quality: 82, colors: 128, compressionLevel: 9, effort: 10 })
  }

  const output = await pipeline.toBuffer()
  if (output.length >= sourceSize) return null
  fs.writeFileSync(file, output)
  return { relativePath, before: sourceSize, after: output.length }
}

async function main() {
  const changed = []
  for (const file of walk(staticRoot)) {
    const result = await optimize(file)
    if (result) changed.push(result)
  }

  const before = changed.reduce((sum, item) => sum + item.before, 0)
  const after = changed.reduce((sum, item) => sum + item.after, 0)
  console.log(`Optimized ${changed.length} assets; ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB.`)
  changed.forEach((item) => console.log(`- ${item.relativePath}: ${(item.before / 1024).toFixed(1)}KB -> ${(item.after / 1024).toFixed(1)}KB`))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
