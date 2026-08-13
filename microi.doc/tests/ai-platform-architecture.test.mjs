import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import test from 'node:test'
import {
  architectureData,
  architectureFeatureLabels,
  architectureVersion,
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

test('架构图以 V8引擎为唯一运行核心并覆盖平台关键能力', async () => {
  const [generator, dataSource, svg] = await Promise.all([
    readFile(resolve(docsRoot, 'scripts/generate-ai-platform-architecture.mjs'), 'utf8'),
    readFile(resolve(docsRoot, 'scripts/ai-platform-architecture-data.mjs'), 'utf8'),
    readFile(svgPath, 'utf8')
  ])
  assert.doesNotMatch(`${generator}\n${dataSource}\n${svg}`, /Jint/i)
  for (const text of [
    'Microi吾码 AI平台 架构图', 'V8引擎', '10×+', '更省 Token', '更快开发', '几十+', '成熟引擎 · 更稳定', '开箱即用', '更快交付',
    '表单引擎', '模块引擎', '界面引擎', '打印引擎', '报表引擎', '审批流 v4', '业务架构蓝图', 'JSON ↔ Vue',
    '发布计划', '不可变审批', '断点续发', '服务注册', 'W3C Trace', '热 / 温 / 冷', '导入预检', '应用商城',
    'Microi.VSCode', 'MCP / Skills', 'Codex / OpenClaw', 'Microi.UI / 物料', 'Unity / WebGL', 'Office / 蓝牙打印'
  ]) assert.ok(svg.includes(text), text)
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
  assert.equal(manifest.capabilitySourceHash, sourceHash)
  assert.equal(manifest.uniqueFeatureLabels, architectureFeatureLabels().length)
  assert.equal(manifest.outputs.length, 3)
  for (const output of manifest.outputs) {
    const file = await readFile(resolve(imagesRoot, output.file))
    assert.equal(output.bytes, file.length)
    assert.equal(output.sha256, sha256(file))
  }
})

test('README 与官网首页共享同一份机器可读能力索引和架构图引用', async () => {
  const [index, readme] = await Promise.all([
    readFile(resolve(docsRoot, 'docs/doc/index.md'), 'utf8'),
    readFile(resolve(workspaceRoot, 'README.md'), 'utf8')
  ])
  const generatedMarkdown = buildArchitectureMarkdown(sourceHash)
  assert.ok(index.includes(generatedMarkdown))
  assert.ok(readme.includes(generatedMarkdown))
  assert.equal((index.match(/MICROI_ARCHITECTURE_CAPABILITIES:START/g) || []).length, 1)
  assert.equal((readme.match(/MICROI_ARCHITECTURE_CAPABILITIES:START/g) || []).length, 1)
  assert.match(index, /!\[[^\]]*架构图[^\]]*\]\(\/images\/microi-ai-platform-architecture\.svg\)/)
  assert.match(readme, /!\[[^\]]*架构图[^\]]*\]\(\.\/microi\.doc\/docs\/public\/images\/microi-ai-platform-architecture-3840x2160\.png\)/)
  assert.doesNotMatch(readme, /\[!\[[^\]]*架构图[^\]]*\]\([^\n]+\)\]\([^\n]+\)/)
})
