const fs = require('fs')
const https = require('https')
const path = require('path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, '.tmp', 'share-source')
const outputDir = path.join(root, '.tmp', 'share-assets')
const logoPath = path.join(sourceDir, 'logo.jpeg')
const waterPath = path.join(sourceDir, 'water-hero.jpg')

const sources = {
  logo: 'https://static.jifulii.com/xjy/xjy/miniapp-assets/20260722/20260722/logo.jpeg',
  water: 'https://static.jifulii.com/xjy/xjy/miniapp-assets/20260722/20260722/water-hero.jpg'
}

const covers = [
  { key: 'platform', eyebrow: '集福鲤平台', title: '客户与服务工作台', subtitle: '客户 · 订单 · 设备 · 售后协同', accent: '#EF4B2E' },
  { key: 'business', eyebrow: '集福鲤平台', title: '业务协同中心', subtitle: '客户、订单与服务高效连接', accent: '#2FC3D6' },
  { key: 'service', eyebrow: '集福鲤平台', title: '售后服务保障', subtitle: '让每一次服务都有迹可循', accent: '#45D3A6' },
  { key: 'mall', eyebrow: '集福鲤商城', title: '品质净水商城', subtitle: '专业产品与全周期服务', accent: '#FFB347' },
  { key: 'news', eyebrow: '集福鲤资讯', title: '水服务新动态', subtitle: '行业资讯 · 案例 · 专业洞察', accent: '#72B7FF' },
  { key: 'invite', eyebrow: '集福鲤平台', title: '一起加入集福鲤', subtitle: '连接客户、伙伴与专业服务', accent: '#EF4B2E' }
]

function download(url, target) {
  if (fs.existsSync(target)) return Promise.resolve()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(response.headers.location, target).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Download failed: ${response.statusCode} ${url}`))
        return
      }
      const stream = fs.createWriteStream(target)
      response.pipe(stream)
      stream.on('finish', () => stream.close(resolve))
      stream.on('error', reject)
    })
    request.on('error', reject)
  })
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function overlaySvg(cover) {
  return Buffer.from(`
    <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#032C43" stop-opacity="0.98"/>
          <stop offset="0.58" stop-color="#034D68" stop-opacity="0.86"/>
          <stop offset="1" stop-color="#087D91" stop-opacity="0.38"/>
        </linearGradient>
        <linearGradient id="footer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      <rect width="500" height="400" fill="url(#shade)"/>
      <circle cx="460" cy="50" r="118" fill="#FFFFFF" opacity="0.035"/>
      <rect x="34" y="118" width="46" height="5" rx="2.5" fill="${cover.accent}"/>
      <text x="106" y="67" fill="#FFFFFF" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="19" font-weight="700">${escapeXml(cover.eyebrow)}</text>
      <text x="34" y="184" fill="#FFFFFF" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="38" font-weight="700">${escapeXml(cover.title)}</text>
      <text x="36" y="229" fill="#D9F4F8" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="400">${escapeXml(cover.subtitle)}</text>
      <rect x="34" y="309" width="432" height="58" rx="12" fill="url(#footer)" stroke="#FFFFFF" stroke-opacity="0.14"/>
      <text x="55" y="344" fill="#FFFFFF" opacity="0.92" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16">专业水服务数字化平台</text>
      <circle cx="431" cy="338" r="5" fill="${cover.accent}"/>
      <circle cx="447" cy="338" r="5" fill="#FFFFFF" opacity="0.62"/>
    </svg>
  `)
}

async function roundedLogo() {
  const mask = Buffer.from('<svg width="58" height="58"><rect width="58" height="58" rx="12" fill="#fff"/></svg>')
  return sharp(logoPath)
    .resize(58, 58, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function buildCover(cover, logo) {
  const target = path.join(outputDir, `share-${cover.key}.jpg`)
  await sharp(waterPath)
    .rotate()
    .resize(500, 400, { fit: 'cover', position: 'right' })
    .composite([
      { input: overlaySvg(cover), left: 0, top: 0 },
      { input: logo, left: 34, top: 29 }
    ])
    .jpeg({ quality: 84, chromaSubsampling: '4:2:0', mozjpeg: true })
    .toFile(target)
  return target
}

async function buildGallery(files) {
  const thumbWidth = 500
  const thumbHeight = 400
  const gap = 24
  const labelHeight = 38
  const width = thumbWidth * 2 + gap * 3
  const rowHeight = thumbHeight + labelHeight + gap
  const height = rowHeight * 3 + gap
  const composites = []

  for (let index = 0; index < files.length; index += 1) {
    const column = index % 2
    const row = Math.floor(index / 2)
    const left = gap + column * (thumbWidth + gap)
    const top = gap + row * rowHeight
    const label = covers[index].key.toUpperCase()
    const labelSvg = Buffer.from(`<svg width="500" height="38"><text x="0" y="27" fill="#27404A" font-family="Arial, sans-serif" font-size="18" font-weight="700">${label}</text></svg>`)
    composites.push({ input: files[index], left, top })
    composites.push({ input: labelSvg, left, top: top + thumbHeight + 4 })
  }

  await sharp({ create: { width, height, channels: 3, background: '#F4F8FA' } })
    .composite(composites)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(outputDir, 'share-gallery.jpg'))
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  await Promise.all([download(sources.logo, logoPath), download(sources.water, waterPath)])
  const logo = await roundedLogo()
  const files = []
  for (const cover of covers) files.push(await buildCover(cover, logo))
  await buildGallery(files)

  const report = []
  for (const file of files) {
    const metadata = await sharp(file).metadata()
    report.push({ file: path.relative(root, file), width: metadata.width, height: metadata.height, bytes: fs.statSync(file).size })
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
