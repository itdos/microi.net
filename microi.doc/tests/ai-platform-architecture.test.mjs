import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const docsRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(docsRoot, '..')
const svgPath = resolve(docsRoot, 'docs/public/images/microi-ai-platform-architecture.svg')
const pngPath = resolve(docsRoot, 'docs/public/images/microi-ai-platform-architecture-1920x1080.png')

test('架构图以 V8引擎为唯一运行核心并覆盖价值主张和关键能力', async () => {
  const [source, svg] = await Promise.all([
    readFile(resolve(docsRoot, 'scripts/generate-ai-platform-architecture.mjs'), 'utf8'),
    readFile(svgPath, 'utf8')
  ])
  assert.doesNotMatch(`${source}\n${svg}`, /Jint/i)
  for (const text of [
    'Microi吾码 AI平台 架构图', 'V8引擎', '10×+', '更省 Token', '更快开发', '几十+', '成熟引擎 · 更稳定', '开箱即用', '更快交付',
    '表单引擎', '模块引擎', '界面引擎', '打印引擎', '报表引擎', '审批流 v4', '业务架构蓝图', 'JSON ↔ Vue',
    '发布计划', '不可变审批', '断点续发', '服务注册', 'W3C Trace', '热 / 温 / 冷', '导入预检', '应用商城', 'Microi.VSCode', 'MCP / Codex'
  ]) assert.ok(svg.includes(text), text)
  assert.match(svg, /text-rendering="geometricPrecision"/)
  assert.ok((svg.match(/data-feature=/g) || []).length >= 180)
  assert.ok(Buffer.byteLength(svg) < 256 * 1024)
})

test('PNG 精确为 1920×1080 且保持轻量', async () => {
  const [png, info] = await Promise.all([readFile(pngPath), stat(pngPath)])
  assert.equal(png.toString('ascii', 1, 4), 'PNG')
  assert.equal(png.readUInt32BE(16), 1920)
  assert.equal(png.readUInt32BE(20), 1080)
  assert.ok(info.size < 2 * 1024 * 1024)
})

test('官网首页和根 README 默认展示矢量图', async () => {
  const [index, readme] = await Promise.all([
    readFile(resolve(docsRoot, 'docs/doc/index.md'), 'utf8'),
    readFile(resolve(workspaceRoot, 'README.md'), 'utf8')
  ])
  assert.match(index, /!\[[^\]]*架构图[^\]]*\]\(\/images\/microi-ai-platform-architecture\.svg\)/)
  assert.match(readme, /!\[[^\]]*架构图[^\]]*\]\(\.\/microi\.doc\/docs\/public\/images\/microi-ai-platform-architecture\.svg\)/)
})
