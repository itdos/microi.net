import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  architectureData,
  architectureFeatureLabels,
  architectureVersion,
  platformVersion,
  buildArchitectureMarkdown,
  channels,
  deliveryFlow,
  foundations,
  governanceLoop,
  panels,
  v8Capabilities,
  valueCards
} from './ai-platform-architecture-data.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(repoRoot, '..')
const outputDir = path.join(repoRoot, 'docs', 'public', 'images')
const svgPath = path.join(outputDir, 'microi-ai-platform-architecture.svg')
const pngPath = path.join(outputDir, 'microi-ai-platform-architecture-1920x1080.png')
const png4kPath = path.join(outputDir, 'microi-ai-platform-architecture-3840x2160.png')
const manifestPath = path.join(outputDir, 'microi-ai-platform-architecture.manifest.json')
const readmePath = path.join(workspaceRoot, 'README.md')
const indexPath = path.join(repoRoot, 'docs', 'doc', 'index.md')
const width = 1920
const height = 1080
const sourceHash = createHash('sha256').update(JSON.stringify(architectureData)).digest('hex')

const esc = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

function chamferPath(x, y, w, h, cut = 10) {
  return `M${x + cut} ${y}H${x + w - cut}L${x + w} ${y + cut}V${y + h - cut}L${x + w - cut} ${y + h}H${x + cut}L${x} ${y + h - cut}V${y + cut}Z`
}

function valueCardSvg(item, index) {
  const x = 930 + index * 238
  return `<g transform="translate(${x} 20)">
    <path d="${chamferPath(0, 0, 222, 70, 10)}" class="value-shell"/>
    <path d="M12 62H210" stroke="${['#4de8ff', '#b995ff', '#48e7a6', '#ffbd59'][index]}" stroke-width="2"/>
    <text x="16" y="31" class="value-main">${esc(item[0])}</text>
    <text x="16" y="53" class="value-sub">${esc(item[1])}</text>
  </g>`
}

function channelSvg(item, index) {
  const x = 40 + index * 184
  return `<g transform="translate(${x} 112)">
    <path d="${chamferPath(0, 0, 174, 54, 8)}" class="channel-shell"/>
    <rect x="0" y="0" width="4" height="54" fill="${index % 2 ? '#b995ff' : '#4de8ff'}"/>
    <text x="15" y="23" class="channel-title">${esc(item[0])}</text>
    <text x="15" y="41" class="channel-sub">${esc(item[1])}</text>
  </g>`
}

function featureChip(label, x, y, w, h, accent, className = 'feature-text') {
  const compact = label.length > 13 ? ' feature-text--compact' : ''
  return `<g data-feature="${esc(label)}">
    <path d="${chamferPath(x, y, w, h, 5)}" class="feature-shell" stroke="${accent}"/>
    <circle cx="${x + 9}" cy="${y + h / 2}" r="2" fill="${accent}"/>
    <text x="${x + w / 2 + 4}" y="${y + h / 2 + 4}" text-anchor="middle" class="${className}${compact}">${esc(label)}</text>
  </g>`
}

function panelSvg(panel) {
  const body = panel.items.map((label, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    return featureChip(label, panel.x + 13 + col * 130, panel.y + 58 + row * 31, 123, 26, panel.accent)
  }).join('')
  return `<g>
    <path d="${chamferPath(panel.x, panel.y, panel.w, panel.h, 16)}" class="panel-shell" stroke="${panel.accent}"/>
    <path d="M${panel.x + 1} ${panel.y + 51}H${panel.x + panel.w - 1}" stroke="${panel.accent}" stroke-opacity=".52"/>
    <path d="M${panel.x + 15} ${panel.y + 1}H${panel.x + 188}" stroke="${panel.accent}" stroke-width="3"/>
    <text x="${panel.x + 16}" y="${panel.y + 31}" class="panel-code" fill="${panel.accent}">${panel.code}</text>
    <text x="${panel.x + 61}" y="${panel.y + 30}" class="panel-title">${esc(panel.title)}</text>
    <text x="${panel.x + panel.w - 16}" y="${panel.y + 29}" text-anchor="end" class="panel-sub">${esc(panel.subtitle)}</text>
    ${body}
  </g>`
}

function v8SatelliteSvg(item, index) {
  const left = index < 10
  const row = index % 10
  const x = left ? 618 : 1187
  const y = 315 + row * 39
  const w = 116
  const anchorX = left ? x + w : x
  const anchorY = y + 17
  const targetX = left ? 835 : 1085
  const targetY = 480 + (row - 4.5) * 11
  return `<g>
    <path d="M${anchorX} ${anchorY}L${left ? anchorX + 25 : anchorX - 25} ${anchorY}L${targetX} ${targetY}" class="reactor-link"/>
    <path d="${chamferPath(x, y, w, 34, 7)}" class="satellite-shell"/>
    <text x="${x + w / 2}" y="${y + 14}" text-anchor="middle" class="satellite-title">${esc(item[0])}</text>
    <text x="${x + w / 2}" y="${y + 27}" text-anchor="middle" class="satellite-sub">${esc(item[1])}</text>
  </g>`
}

function foundationSvg(item, index) {
  const x = 40 + index * 460
  const chips = item.items.map((label, chipIndex) => {
    const col = chipIndex % 5
    const row = Math.floor(chipIndex / 5)
    return featureChip(label, x + 13 + col * 86, 958 + row * 30, 80, 25, item.accent, 'foundation-chip')
  }).join('')
  return `<g>
    <path d="${chamferPath(x, 910, 440, 124, 13)}" class="foundation-shell" stroke="${item.accent}"/>
    <path d="M${x + 1} 946H${x + 439}" stroke="${item.accent}" stroke-opacity=".42"/>
    <path d="M${x + 13} 911H${x + 118}" stroke="${item.accent}" stroke-width="3"/>
    <text x="${x + 14}" y="935" class="foundation-title" fill="${item.accent}">${esc(item.title)}</text>
    ${chips}
  </g>`
}

const flowSvg = deliveryFlow.map((label, index) => {
  const x = 622 + index * 84
  const arrow = index < deliveryFlow.length - 1 ? `<path d="M${x + 70} 262H${x + 80}" class="flow-arrow"/><path d="M${x + 76} 258L${x + 80} 262L${x + 76} 266" class="flow-arrow"/>` : ''
  return `${featureChip(label, x, 247, 70, 30, index < 4 ? '#4de8ff' : '#48e7a6', 'flow-text')}${arrow}`
}).join('')

const governanceSvg = governanceLoop.map((label, index) => {
  const col = index % 6
  const row = Math.floor(index / 6)
  return featureChip(label, 622 + col * 112, 790 + row * 35, 105, 29, row === 0 ? '#4de8ff' : '#48e7a6', 'loop-text')
}).join('')

const circuitPaths = [
  'M0 204H355V214H585', 'M1920 204H1565V214H1335', 'M585 388H604', 'M1316 388H1335',
  'M585 720H604', 'M1316 720H1335', 'M960 166V232', 'M960 880V910',
  'M60 895V886H585', 'M1860 895V886H1335', 'M600 1048H1320'
]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="architecture-title architecture-desc" text-rendering="geometricPrecision" shape-rendering="geometricPrecision">
  <title id="architecture-title">Microi吾码 AI平台 架构图</title>
  <desc id="architecture-desc">以 V8引擎为运行核心，连接 AI、低代码、治理、服务观测、多端入口、安全、多租户和数据存储的 Microi吾码 AI 平台全景架构。</desc>
  <metadata id="architecture-source">${esc(JSON.stringify({ architectureVersion, platformVersion, capabilitySourceHash: sourceHash }))}</metadata>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020716"/><stop offset=".48" stop-color="#07152b"/><stop offset="1" stop-color="#020713"/></linearGradient>
    <linearGradient id="header-line" x1="0" x2="1"><stop stop-color="#4de8ff"/><stop offset=".5" stop-color="#b995ff"/><stop offset="1" stop-color="#48e7a6"/></linearGradient>
    <linearGradient id="reactor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0d3352"/><stop offset=".48" stop-color="#162b5a"/><stop offset="1" stop-color="#0b3f3a"/></linearGradient>
    <radialGradient id="reactor-halo"><stop stop-color="#4de8ff" stop-opacity=".22"/><stop offset=".48" stop-color="#8d65ff" stop-opacity=".1"/><stop offset="1" stop-color="#020713" stop-opacity="0"/></radialGradient>
    <pattern id="micro-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#7ddfff" stroke-opacity=".045"/></pattern>
    <pattern id="dot-grid" width="56" height="56" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#8fdfff" opacity=".16"/></pattern>
    <filter id="halo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="13"/></filter>
    <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text { font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",Arial,sans-serif; }
      .title { fill:#f5fbff; font-size:31px; font-weight:800; letter-spacing:1.8px; }
      .subtitle { fill:#9eb8d8; font-size:12px; font-weight:600; letter-spacing:.8px; }
      .version-badge { fill:#122e4d; stroke:#57e4f6; stroke-opacity:.58; }
      .version-text { fill:#bdf6ff; font-family:Consolas,"Microsoft YaHei UI",sans-serif; font-size:13px; font-weight:800; letter-spacing:.7px; }
      .value-shell { fill:#071a31; stroke:#7bdcff; stroke-opacity:.34; }
      .value-main { fill:#f4fbff; font-size:23px; font-weight:900; }
      .value-sub { fill:#b9cee6; font-size:11.5px; font-weight:700; }
      .channel-shell { fill:#08192f; stroke:#8edfff; stroke-opacity:.28; }
      .channel-title { fill:#eef8ff; font-size:12.2px; font-weight:800; }
      .channel-sub { fill:#93adca; font-size:9.8px; font-weight:600; }
      .bus { fill:#07182d; stroke:#65ddf2; stroke-opacity:.32; }
      .bus-text { fill:#cbeeff; font-size:10px; font-weight:700; letter-spacing:1.2px; }
      .panel-shell { fill:#061326; fill-opacity:.96; stroke-width:1; stroke-opacity:.54; }
      .panel-code { font-family:Consolas,"Microsoft YaHei UI",sans-serif; font-size:19px; font-weight:900; }
      .panel-title { fill:#f3f8ff; font-size:17px; font-weight:800; }
      .panel-sub { fill:#91a9c7; font-size:9.8px; font-weight:600; }
      .feature-shell { fill:#0b1c33; fill-opacity:.92; stroke-width:.75; stroke-opacity:.35; }
      .feature-text { fill:#dce8f6; font-size:10.9px; font-weight:650; }
      .feature-text--compact { font-size:9.9px; }
      .flow-text { fill:#e7f8ff; font-size:10px; font-weight:750; }
      .flow-arrow { fill:none; stroke:#73e6f7; stroke-width:1; stroke-opacity:.72; }
      .reactor-link { fill:none; stroke:#55dbed; stroke-width:.8; stroke-opacity:.36; }
      .satellite-shell { fill:#091a31; stroke:#79e9f7; stroke-width:.8; stroke-opacity:.45; }
      .satellite-title { fill:#edfaff; font-size:10.6px; font-weight:800; }
      .satellite-sub { fill:#8faac8; font-size:8.7px; font-weight:600; }
      .reactor-label { fill:#8befff; font-size:10px; font-weight:800; letter-spacing:2.2px; }
      .reactor-title { fill:#ffffff; font-size:35px; font-weight:900; letter-spacing:2px; }
      .reactor-sub { fill:#b9e9f4; font-size:11px; font-weight:700; letter-spacing:.8px; }
      .reactor-tag { fill:#e5f6ff; font-size:9.8px; font-weight:700; }
      .loop-title { fill:#f2f8ff; font-size:15px; font-weight:850; }
      .loop-sub { fill:#8fa8c6; font-size:9.8px; font-weight:650; }
      .loop-text { fill:#e3f1fb; font-size:9.8px; font-weight:750; }
      .foundation-shell { fill:#061326; stroke-width:1; stroke-opacity:.48; }
      .foundation-title { font-size:13.2px; font-weight:850; letter-spacing:.4px; }
      .foundation-chip { fill:#d8e7f5; font-size:9.2px; font-weight:700; }
      .footer { fill:#7894b6; font-size:9.3px; font-weight:600; letter-spacing:.25px; }
      .circuit { fill:none; stroke:#63ddf3; stroke-width:1; stroke-opacity:.18; }
    </style>
  </defs>

  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect width="1920" height="1080" fill="url(#micro-grid)"/>
  <rect width="1920" height="1080" fill="url(#dot-grid)"/>
  <ellipse cx="960" cy="520" rx="450" ry="390" fill="url(#reactor-halo)"/>
  <g>${circuitPaths.map(d => `<path d="${d}" class="circuit"/>`).join('')}</g>
  <g opacity=".35"><circle cx="355" cy="204" r="3" fill="#4de8ff"/><circle cx="1565" cy="204" r="3" fill="#48e7a6"/><circle cx="960" cy="204" r="3" fill="#b995ff"/><circle cx="585" cy="720" r="3" fill="#4de8ff"/><circle cx="1335" cy="720" r="3" fill="#ffbd59"/></g>

  <path d="M22 16H718L734 32H898" fill="none" stroke="url(#header-line)" stroke-width="2"/>
  <text x="40" y="55" class="title">Microi吾码 AI平台 架构图</text>
  <rect x="475" y="28" width="86" height="34" rx="17" class="version-badge"/>
  <text x="518" y="50" text-anchor="middle" class="version-text">${esc(platformVersion)}</text>
  <text x="40" y="82" class="subtitle">AI-NATIVE LOW-CODE · DESIGN → BUILD → GOVERN → DELIVER → OBSERVE → RECOVER</text>
  ${valueCards.map(valueCardSvg).join('')}

  ${channels.map(channelSvg).join('')}
  <g transform="translate(40 178)"><path d="${chamferPath(0, 0, 1840, 34, 9)}" class="bus"/><path d="M18 17H1822" stroke="url(#header-line)" stroke-opacity=".55" stroke-dasharray="5 7"/><text x="920" y="21" text-anchor="middle" class="bus-text">MICROI HOST CONTEXT BUS · API BASE · OSCLIENT · DIYTOKEN · ROUTE · THEME · TRACE · AUDIT</text></g>

  ${panels.map(panelSvg).join('')}

  <g>
    <path d="${chamferPath(605, 232, 710, 55, 12)}" class="panel-shell" stroke="#5de9ff"/>
    <text x="624" y="244" class="panel-sub">AI DELIVERY PIPELINE</text>
    ${flowSvg}
  </g>

  <g aria-label="V8引擎核心">
    <circle cx="960" cy="510" r="184" fill="#4de8ff" opacity=".06" filter="url(#halo)"/>
    <circle cx="960" cy="510" r="178" fill="none" stroke="#60e8f5" stroke-opacity=".27" stroke-width="1.2"/>
    <circle cx="960" cy="510" r="151" fill="none" stroke="#b995ff" stroke-opacity=".30" stroke-width="1" stroke-dasharray="4 7"/>
    <circle cx="960" cy="510" r="132" fill="none" stroke="#48e7a6" stroke-opacity=".22"/>
    <path d="M960 319L1126 414V606L960 701L794 606V414Z" fill="#09172e" fill-opacity=".8" stroke="#6ceafa" stroke-opacity=".2"/>
    ${v8Capabilities.map(v8SatelliteSvg).join('')}
    <path d="M960 381L1072 445V575L960 639L848 575V445Z" fill="url(#reactor)" stroke="#89eff8" stroke-width="1.8" filter="url(#line-glow)"/>
    <path d="M960 399L1055 453V567L960 621L865 567V453Z" fill="#07162b" stroke="#b995ff" stroke-opacity=".48"/>
    <text x="960" y="438" text-anchor="middle" class="reactor-label">AI-NATIVE RUNTIME CORE</text>
    <text x="960" y="493" text-anchor="middle" class="reactor-title">V8引擎</text>
    <text x="960" y="521" text-anchor="middle" class="reactor-sub">可信服务端脚本 · 在线保存即生效</text>
    <g>
      <path d="${chamferPath(885, 543, 69, 25, 5)}" class="feature-shell" stroke="#4de8ff"/><text x="919.5" y="560" text-anchor="middle" class="reactor-tag">事务</text>
      <path d="${chamferPath(966, 543, 69, 25, 5)}" class="feature-shell" stroke="#b995ff"/><text x="1000.5" y="560" text-anchor="middle" class="reactor-tag">权限</text>
      <path d="${chamferPath(885, 576, 69, 25, 5)}" class="feature-shell" stroke="#48e7a6"/><text x="919.5" y="593" text-anchor="middle" class="reactor-tag">多租户</text>
      <path d="${chamferPath(966, 576, 69, 25, 5)}" class="feature-shell" stroke="#ffbd59"/><text x="1000.5" y="593" text-anchor="middle" class="reactor-tag">多节点</text>
    </g>
  </g>

  <g>
    <path d="${chamferPath(605, 752, 710, 128, 14)}" class="panel-shell" stroke="#68e5f4"/>
    <path d="M606 780H1314" stroke="#68e5f4" stroke-opacity=".35"/>
    <text x="622" y="773" class="loop-title">统一治理与交付闭环</text>
    <text x="1298" y="773" text-anchor="end" class="loop-sub">可预检 · 可执行 · 可回读 · 可恢复</text>
    ${governanceSvg}
  </g>

  ${foundations.map(foundationSvg).join('')}

  <path d="M40 1052H1880" stroke="url(#header-line)" stroke-opacity=".35"/>
  <text x="40" y="1069" class="footer">核心原则：后端权威鉴权 · OsClient 隔离 · 共享状态 · 幂等副作用 · 不可变版本 · 失败关闭 · 应用商城统一交付 · 真实回读验收</text>
  <text x="1880" y="1069" text-anchor="end" class="footer">microi.net</text>
</svg>`

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(svgPath, svg, 'utf8')

const require = createRequire(import.meta.url)
const configuredModules = process.env.MICROI_WORKSPACE_NODE_MODULES
let sharp
try {
  sharp = require('sharp')
} catch {
  if (!configuredModules) throw new Error('未找到 sharp；请设置 MICROI_WORKSPACE_NODE_MODULES 指向 bundled node_modules')
  sharp = require(path.join(configuredModules, 'sharp'))
}

await sharp(Buffer.from(svg), { density: 72 })
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100, colours: 256, dither: 0.18 })
  .toFile(pngPath)

await sharp(Buffer.from(svg), { density: 144 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(png4kPath)

const [png, png4k] = await Promise.all([sharp(pngPath).metadata(), sharp(png4kPath).metadata()])
if (png.width !== width || png.height !== height) throw new Error(`1080P PNG 尺寸错误：${png.width}x${png.height}`)
if (png4k.width !== width * 2 || png4k.height !== height * 2) throw new Error(`4K PNG 尺寸错误：${png4k.width}x${png4k.height}`)
if (fs.statSync(pngPath).size > 2 * 1024 * 1024) throw new Error('1080P PNG 超过 2MB，请继续优化。')
if (fs.statSync(png4kPath).size > 2 * 1024 * 1024) throw new Error('4K PNG 超过 2MB，请继续优化。')

const fileDigest = filePath => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
const outputs = [
  { path: svgPath, width, height, format: 'svg' },
  { path: pngPath, width: png.width, height: png.height, format: 'png' },
  { path: png4kPath, width: png4k.width, height: png4k.height, format: 'png' }
].map(output => ({
  file: path.basename(output.path),
  format: output.format,
  width: output.width,
  height: output.height,
  bytes: fs.statSync(output.path).size,
  sha256: fileDigest(output.path)
}))

const manifest = {
  schemaVersion: 1,
  architectureVersion,
  platformVersion,
  capabilitySourceHash: sourceHash,
  uniqueFeatureLabels: architectureFeatureLabels().length,
  outputs
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const generatedMarkdown = buildArchitectureMarkdown(sourceHash)
const generatedBlockPattern = /<!-- MICROI_ARCHITECTURE_CAPABILITIES:START -->[\s\S]*?<!-- MICROI_ARCHITECTURE_CAPABILITIES:END -->/
for (const markdownPath of [readmePath, indexPath]) {
  const current = fs.readFileSync(markdownPath, 'utf8')
  if (!generatedBlockPattern.test(current)) throw new Error(`${markdownPath} 缺少架构能力生成标记。`)
  const next = current.replace(generatedBlockPattern, generatedMarkdown)
  if (next !== current) fs.writeFileSync(markdownPath, next, 'utf8')
}

console.log(JSON.stringify({
  architectureVersion,
  platformVersion,
  capabilitySourceHash: sourceHash,
  uniqueFeatureLabels: architectureFeatureLabels().length,
  manifestPath,
  outputs
}, null, 2))
