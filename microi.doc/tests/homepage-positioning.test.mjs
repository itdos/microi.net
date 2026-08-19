import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

test('homepage presents Microi as a continuous low-code, V8, and pro-code platform', () => {
  const component = read('docs/.vitepress/theme/components/AiStudioHome.vue')
  const frontmatter = read('docs/index.md')
  const studioIndex = component.indexOf('<section class="ai-studio-stage')
  const positioningIndex = component.indexOf('<section class="mci-home-hero')

  assert.ok(studioIndex >= 0 && studioIndex < positioningIndex, 'AI Studio should appear before the platform-positioning hero')
  assert.match(component, /class="ai-studio-brand"/)
  assert.match(component, />Microi AI Studio<\/p>/)
  assert.match(component, /titleLeadParts: \['不只是开源 AI', '低代码'\]/)
  assert.match(component, /titleEmphasisLines: \['更是企业级 AI', '应用开发框架'\]/)
  assert.match(component, /可视化低代码/)
  assert.match(component, /V8 在线编程/)
  assert.match(component, /专业代码/)
  assert.match(component, /\.NET · Vue · 微服务 · SDK/)
  assert.match(component, /MCP \+ Skills/)
  assert.match(component, /chatTitle: '让 AI 站在成熟引擎上，专注业务增量'/)
  assert.match(component, /chatDesc: '以 20\+ 成熟引擎为底座，贯通可视化低代码、V8 与 \.NET \/ Vue 源码扩展，让中大型应用快速交付，也能持续深度演进。'/)
  assert.match(component, /href="\/doc\/getting-started\/start-use"/)
  assert.match(component, /href="\/doc\/getting-started\/source-code-architecture"/)
  assert.match(frontmatter, /开源 AI 应用开发平台与企业级开发框架/)
  assert.doesNotMatch(frontmatter, /titleTemplate: 相比传统 AI 开发/)
})

test('homepage visual contract covers responsive, focus, and reduced-motion states', () => {
  const styles = read('docs/.vitepress/theme/styles/ai-studio-home.scss')
  const contract = read('MCI-DESIGN.md')

  assert.match(styles, /\.mci-home-hero\s*\{/)
  assert.match(styles, /\.mci-home-map\s*\{/)
  assert.match(styles, /\.mci-home-section-heading > \.ai-studio-brand\s*\{/)
  assert.match(styles, /background:\s*#f4d35e/)
  assert.match(styles, /:focus-visible/)
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 900px\)/)
  assert.match(styles, /@media \(max-width: 767px\)/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /padding: 150px 0 36px/)
  assert.match(styles, /margin: 0 auto 80px/)
  assert.match(styles, /margin-bottom: 56px/)

  for (let index = 1; index <= 12; index += 1) {
    assert.match(contract, new RegExp(`## ${index}\\.`))
  }

  assert.match(contract, /mode: brand-narrative/)
  assert.match(contract, /低代码 → V8 → 专业源码/)
  assert.match(contract, /价值带与 NuGet 证据区保持 56–80px 间隔/)
})

test('source architecture keeps the detailed selection guidance off the homepage', () => {
  const architecture = read('docs/doc/getting-started/source-code-architecture.md')

  assert.match(architecture, /中大型应用不是高代码与低代码二选一/)
  assert.match(architecture, /可视化低代码/)
  assert.match(architecture, /V8 在线编程/)
  assert.match(architecture, /专业源码扩展/)
  assert.match(architecture, /Fusion Development/)
})
