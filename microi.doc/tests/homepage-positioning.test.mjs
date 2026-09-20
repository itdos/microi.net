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
  const microiCodeShowcase = read('docs/.vitepress/theme/components/MicroiCodeShowcase.vue')
  const frontmatter = read('docs/index.md')
  const microiCodeDocs = read('docs/doc/v8-engine/vs-code-plugin.md')
  const studioIndex = component.indexOf('<section class="ai-studio-stage')
  const positioningIndex = component.indexOf('<div class="ai-studio-summary"')

  assert.ok(studioIndex >= 0 && studioIndex < positioningIndex, 'platform positioning should be merged into the AI Studio stage')
  assert.doesNotMatch(component, /<section class="mci-home-hero"/)
  assert.doesNotMatch(component, /<section class="mci-home-values"/)
  assert.match(component, /class="ai-studio-brand"/)
  assert.match(component, />Microi AI Studio<\/p>/)
  assert.match(component, /eyebrow: '开源 AI 开发框架'/)
  assert.match(component, /titleLeadParts: \['开源 AI', '开发框架'\]/)
  assert.match(component, /titleEmphasisLines: \['30\+ 成熟引擎'\]/)
  assert.match(component, /AI 低代码、微服务与 V8 引擎/)
  assert.match(component, /Token 更省 10 倍\+/)
  assert.match(component, /速度提升 10 倍\+/)
  assert.match(component, /AI 低代码开发/)
  assert.match(component, /V8 引擎 AI 编程/)
  assert.match(component, /微服务定制/)
  assert.match(component, /Vue · UniApp · Unity · \.NET 扩展/)
  assert.match(component, /低代码、V8 与微服务共用一套可复用的 AI 开发底座/)
  assert.doesNotMatch(component, /V8 在线编程|专业代码/)
  assert.match(component, /MCP \+ Skills/)
  assert.match(component, /chatTitle: '开源 AI 开发框架，让 AI 站在 30\+ 成熟引擎上，更快交付'/)
  assert.match(component, /减少重复生成，直接进入业务交付/)
  const actions = component.match(/<div class="ai-studio-summary__actions">([\s\S]*?)<\/div>/)?.[1] || ''
  assert.equal((actions.match(/<a\b/g) || []).length, 2)
  assert.match(actions, /is-primary[^>]*microi-training-syllabus/)
  assert.equal((actions.match(/microi-training-syllabus/g) || []).length, 2)
  assert.doesNotMatch(component, /href="\/doc\/getting-started\/start-use"/)
  assert.doesNotMatch(actions, /source-code-architecture/)
  assert.match(actions, /:href="MICROI_CODE_DOC_URL"/)
  assert.equal((actions.match(/<svg\b/g) || []).length, 2, 'both primary homepage actions should have an icon')
  assert.match(component, /\/doc\/v8-engine\/vs-code-plugin\.html/)
  assert.match(component, /secondaryAction: '下载 Microi Code'/)
  assert.match(component, /secondaryAction: 'Download Microi Code'/)
  assert.doesNotMatch(component, /downloadMeta:/)
  assert.doesNotMatch(component, /Windows x64 · v1\.0\.2/)
  assert.match(component, /aiTools: \['Microi Code', 'Codex'/)
  assert.match(microiCodeShowcase, /https:\/\/static\.itdos\.com\/itdos\/microi-code\/latest\/\d{6}\/Microi-Code-latest-windows-x64-setup\.exe/)
  assert.match(microiCodeShowcase, /https:\/\/static\.itdos\.com\/itdos\/microi-code\/latest\/\d{6}\/Microi-Code-latest-mac-x64\.dmg/)
  assert.match(microiCodeShowcase, /https:\/\/static\.itdos\.com\/itdos\/microi-code\/1\.0\.8\/61546bc443f2\//)
  assert.match(microiCodeShowcase, /https:\/\/static\.itdos\.com\/itdos\/microi-code\/1\.0\.2\//)
  assert.match(microiCodeDocs, /<MicroiCodeShowcase\s*\/>/)
  assert.match(microiCodeDocs, /^# Microi Code$/m)
  assert.match(microiCodeDocs, /pageClass:\s*mci-microi-code-page/)
  assert.match(microiCodeShowcase, /<h2 id="microi-code-title">/)
  assert.match(microiCodeShowcase, /\.mci-microi-code-page \.vp-doc > div > h1/)
  assert.match(microiCodeShowcase, /\.mci-microi-code-page \.VPDoc \.aside/)
  assert.match(microiCodeShowcase, /@pointermove="trackPointer"/)
  assert.match(microiCodeShowcase, /radial-gradient\(540px circle at var\(--pointer-x\) var\(--pointer-y\)/)
  assert.match(component, /primaryAction: '查看培训大纲'/)
  assert.match(component, /primaryAction: 'Training syllabus'/)
  assert.doesNotMatch(component, /trainingAction:/)
  assert.ok(
    actions.indexOf('microi-training-syllabus') < actions.indexOf(':href="MICROI_CODE_DOC_URL"'),
    'the primary training syllabus action should render before the Microi Code download action'
  )
  assert.match(frontmatter, /titleTemplate: 开源 AI 开发框架/)
  assert.match(frontmatter, /30\+ 成熟引擎、AI 低代码、微服务与 V8 引擎/)
  assert.doesNotMatch(frontmatter, /开源 AI 应用开发平台|企业级 AI 应用开发框架|开源 AI 低代码平台/)
  assert.doesNotMatch(frontmatter, /titleTemplate: 相比传统 AI 开发/)
})

test('the related-links menu exposes the training syllabus immediately before the update log', () => {
  const config = read('docs/.vitepress/config/zh.ts')
  const trainingIndex = config.indexOf('text: "吾码培训大纲"')
  const updateLogIndex = config.indexOf('text: "更新日志"')

  assert.ok(trainingIndex >= 0)
  assert.match(config, /吾码培训大纲[\s\S]*\/doc\/about\/microi-training-syllabus/u)
  assert.ok(trainingIndex < updateLogIndex, 'the training syllabus should appear above the update log')
  assert.doesNotMatch(config, /text: \"服务器面板\"/, '服务器面板不应出现在官网顶部导航')
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
  assert.match(styles, /\.mci-home-section-heading\s*\{[^}]*max-width:\s*1180px/s)
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
