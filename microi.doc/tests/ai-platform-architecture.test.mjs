import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import test from 'node:test'
import {
  architectureData,
  architectureFeatureLabels,
  architectureVersion,
  officialSystemEngines,
  platformVersion,
  buildArchitectureMarkdown
} from '../scripts/ai-platform-architecture-data.mjs'

const docsRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(docsRoot, '..')
const imagesRoot = resolve(docsRoot, 'docs/public/images')
const svgPath = resolve(imagesRoot, 'microi-ai-platform-architecture.svg')
const pngPath = resolve(imagesRoot, 'microi-ai-platform-architecture-1920x1080.png')
const png4kPath = resolve(imagesRoot, 'microi-ai-platform-architecture-3840x2160.png')
const manifestPath = resolve(imagesRoot, 'microi-ai-platform-architecture.manifest.json')
const sourceHash = createHash('sha256').update(JSON.stringify(architectureData)).digest('hex')

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const normalizeTextEol = text => text.replace(/\r\n/gu, '\n')

test('架构图以 V8引擎为唯一运行核心并覆盖平台关键能力', async () => {
  const [generator, dataSource, svg] = await Promise.all([
    readFile(resolve(docsRoot, 'scripts/generate-ai-platform-architecture.mjs'), 'utf8'),
    readFile(resolve(docsRoot, 'scripts/ai-platform-architecture-data.mjs'), 'utf8'),
    readFile(svgPath, 'utf8')
  ])
  assert.doesNotMatch(`${generator}\n${dataSource}\n${svg}`, /Jint/i)
  for (const text of [
    'Microi吾码 AI平台 架构图', platformVersion, 'V8引擎', '10×+', 'Token 更省', '典型交付更快', '20+', '成熟引擎复用', '在线生效', 'V8 无需编译发布',
    '表单引擎', '模块引擎', '界面引擎', '打印引擎', '报表引擎', '工作流引擎 v4', '业务架构蓝图', '系统设置',
    '系统日志 / 监控', '采集引擎', '缓存引擎', '消息通知', '翻译引擎（多语言）', 'OCR 引擎', '视觉引擎', '应用商城', 'Microi.VSCode', 'MCP / Skills',
    'Codex / OpenClaw', 'Microi.UI', 'Unity / WebGL', 'Office 引擎', '前端微服务', '多端客户端', '分布式存储 / HDFS', '文件柜'
  ]) assert.ok(svg.includes(text), text)
  for (const engine of officialSystemEngines) assert.ok(svg.includes(engine), `架构图缺少系统引擎：${engine}`)
  assert.doesNotMatch(svg, /数据源引擎/)
  assert.match(svg, /接口数据源/)
  assert.match(svg, /L1 \/ L2 多级缓存/)
  assert.match(svg, /可写报表 CRUD/)
  assert.doesNotMatch(svg, /SCIM 同步|值班排班|法律保留|热 \/ 温 \/ 冷|命名插槽/)
  assert.match(svg, /text-rendering="geometricPrecision"/)
  assert.ok((svg.match(/data-feature=/g) || []).length >= 188)
  assert.ok(Buffer.byteLength(svg) < 256 * 1024)
  assert.ok(svg.includes(`capabilitySourceHash&quot;:&quot;${sourceHash}`))
})

test('1080P 与 4K PNG 尺寸精确、文字无二次缩放且体积均小于 2MB', async () => {
  const assets = [
    [pngPath, 1920, 1080],
    [png4kPath, 3840, 2160]
  ]
  for (const [filePath, width, height] of assets) {
    const [png, info] = await Promise.all([readFile(filePath), stat(filePath)])
    assert.equal(png.toString('ascii', 1, 4), 'PNG')
    assert.equal(png.readUInt32BE(16), width)
    assert.equal(png.readUInt32BE(20), height)
    assert.ok(info.size < 2 * 1024 * 1024, `${basename(filePath)} 超过 2MB`)
  }
})

test('资产清单锁定数据源哈希、尺寸和每个输出文件内容', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.architectureVersion, architectureVersion)
  assert.equal(manifest.platformVersion, platformVersion)
  assert.equal(manifest.capabilitySourceHash, sourceHash)
  assert.equal(manifest.uniqueFeatureLabels, architectureFeatureLabels().length)
  assert.equal(manifest.outputs.length, 3)
  for (const output of manifest.outputs) {
    const file = await readFile(resolve(imagesRoot, output.file))
    const canonicalFile = output.format === 'svg'
      ? Buffer.from(normalizeTextEol(file.toString('utf8')), 'utf8')
      : file
    assert.equal(output.bytes, canonicalFile.length)
    assert.equal(output.sha256, sha256(canonicalFile))
  }
})

test('README 与官网首页共享同一份机器可读能力索引和架构图引用', async () => {
  const [index, readme] = await Promise.all([
    readFile(resolve(docsRoot, 'docs/doc/index.md'), 'utf8'),
    readFile(resolve(workspaceRoot, 'README.md'), 'utf8')
  ])
  const generatedMarkdown = normalizeTextEol(buildArchitectureMarkdown(sourceHash))
  assert.ok(normalizeTextEol(index).includes(generatedMarkdown))
  assert.ok(normalizeTextEol(readme).includes(generatedMarkdown))
  assert.equal((index.match(/MICROI_ARCHITECTURE_CAPABILITIES:START/g) || []).length, 1)
  assert.equal((readme.match(/MICROI_ARCHITECTURE_CAPABILITIES:START/g) || []).length, 1)
  assert.match(index, /!\[[^\]]*架构图[^\]]*\]\(\/images\/microi-ai-platform-architecture\.svg\)/)
  assert.match(readme, /!\[[^\]]*架构图[^\]]*\]\(\.\/microi\.doc\/docs\/public\/images\/microi-ai-platform-architecture-3840x2160\.png\)/)
  assert.doesNotMatch(readme, /\[!\[[^\]]*架构图[^\]]*\]\([^\n]+\)\]\([^\n]+\)/)
})

test('源码架构页直接展示同一份 SVG 系统架构图', async () => {
  const sourceArchitecture = await readFile(resolve(docsRoot, 'docs/doc/getting-started/source-code-architecture.md'), 'utf8')
  assert.match(sourceArchitecture, /!\[[^\]]*系统架构图[^\]]*\]\(\/images\/microi-ai-platform-architecture\.svg\)/)
  assert.match(sourceArchitecture, /20\+ 系统引擎/)
})
