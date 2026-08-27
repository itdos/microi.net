import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(projectRoot, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

function readWorkspace(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
}

test('homepage presents Microi as an open-source AI development framework', () => {
  const component = read('docs/.vitepress/theme/components/AiStudioHome.vue')
  const frontmatter = read('docs/index.md')
  const studioIndex = component.indexOf('<section class="ai-studio-stage')
  const positioningIndex = component.indexOf('<section class="mci-home-hero')

  assert.ok(studioIndex >= 0 && studioIndex < positioningIndex, 'AI Studio should appear before the platform-positioning hero')
  assert.match(component, /class="ai-studio-brand"/)
  assert.match(component, />Microi AI Studio<\/p>/)
  assert.match(component, /eyebrow: '开源 AI 开发框架'/)
  assert.match(component, /titleLeadParts: \['开源 AI', '开发框架'\]/)
  assert.match(component, /titleEmphasisLines: \['20\+ 成熟引擎'\]/)
  assert.match(component, /AI 低代码、微服务与 V8 引擎/)
  assert.match(component, /Token 更省 10 倍\+/)
  assert.match(component, /速度提升 10 倍\+/)
  assert.match(component, /AI 低代码开发/)
  assert.match(component, /V8 引擎 AI 编程/)
  assert.match(component, /微服务定制/)
  assert.match(component, /Vue · UniApp · Unity · \.NET 扩展/)
  assert.match(component, /20\+ 成熟引擎承接标准能力/)
  assert.doesNotMatch(component, /V8 在线编程|专业代码/)
  assert.match(component, /MCP \+ Skills/)
  assert.match(component, /chatTitle: '让 AI 站在 20\+ 成熟引擎上，更快交付'/)
  assert.match(component, /开箱即可进入业务开发/)
  assert.match(component, /href="\/doc\/getting-started\/start-use"/)
  assert.match(component, /href="\/doc\/getting-started\/source-code-architecture"/)
  assert.match(frontmatter, /titleTemplate: 开源 AI 开发框架/)
  assert.match(frontmatter, /20\+ 成熟引擎、AI 低代码、微服务与 V8 引擎/)
  assert.doesNotMatch(frontmatter, /开源 AI 应用开发平台|企业级 AI 应用开发框架|开源 AI 低代码平台/)
  assert.doesNotMatch(frontmatter, /titleTemplate: 相比传统 AI 开发/)
})

test('current Chinese brand surfaces use one canonical positioning and keep the legacy term only as an SEO keyword', () => {
  const surfaces = {
    'root README': readWorkspace('README.md'),
    'docs README': read('README.md'),
    'docs landing page': read('docs/doc/index.md'),
    'home frontmatter': read('docs/index.md'),
    'Chinese site config': read('docs/.vitepress/config/zh.ts'),
    'login frontmatter': read('docs/login.md'),
    'login component': read('docs/.vitepress/theme/components/LoginPage.vue'),
    'AI chat introduction': read('docs/.vitepress/theme/components/AiChat.vue'),
    'design contract': read('MCI-DESIGN.md'),
    'article template': read('docs/doc/about/template.md'),
    'training syllabus': read('docs/doc/about/microi-training-syllabus.md'),
    'package metadata': read('package.json')
  }

  for (const [name, content] of Object.entries(surfaces)) {
    assert.match(content, /开源 AI 开发框架/, `${name} should use the canonical positioning`)
    assert.doesNotMatch(
      content,
      /开源 AI 应用开发平台|企业级 AI 应用开发框架|开源 AI 低代码平台/,
      `${name} should not use a legacy positioning as the product name`
    )
  }

  const seo = read('docs/.vitepress/config/seo.ts')
  assert.match(seo, /'开源 AI 开发框架'/)
  assert.match(seo, /const ZH_BASE_KEYWORDS = \[[^\n]*'开源 AI 应用开发平台'/)
  assert.doesNotMatch(
    seo.replace(/^const ZH_BASE_KEYWORDS.*$/m, ''),
    /开源 AI 应用开发平台/,
    'the legacy term is allowed only in the SEO keyword list'
  )
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
