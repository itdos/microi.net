import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { canonicalPath, isIndexablePage, filterSitemapItems, breadcrumbsFor, SITE_URL } from '../docs/.vitepress/config/seo-policy.mjs'
import { headTags, writeDiscoveryIndex } from '../scripts/seo-discovery.mjs'

const docs = fileURLToPath(new URL('../docs/', import.meta.url))
// seo.ts 不含 TS 运行语法；只改写相对 import，直接执行实际实现，兼容项目的 Node 20。
const seoSource = readFileSync(resolve(docs, '.vitepress/config/seo.ts'), 'utf8').replace("'./seo-policy.mjs'", JSON.stringify(pathToFileURL(resolve(docs, '.vitepress/config/seo-policy.mjs')).href))
const { createSeoHead, transformSeoPageData, transformSeoHtml } = await import(`data:text/javascript;base64,${Buffer.from(seoSource).toString('base64')}`)
const context = (relativePath, extra = {}) => ({ page: relativePath.replace(/\.md$/, '.html'), pageData: { relativePath, title: '接口引擎', ...extra }, siteConfig: { srcDir: docs } })

test('HTML metadata preserves greater-than signs inside quoted attributes', () => {
  assert.deepEqual(headTags('<head><meta name="description" content="Code: x => x &gt; 1"><link rel="canonical" href="https://microi.net/"></head>', 'meta'), [{ name: 'description', content: 'Code: x => x > 1' }])
})

test('404 keeps server-rendered content available until the client mounts', () => {
  const ctx = context('404.md', { isNotFound: true })
  ctx.content = '<section class="mci-not-found-card"><h1>这一页，暂时迷路了</h1><a href="/doc/">官方文档</a></section>'
  const output = transformSeoHtml('<head><meta name="description" content="404"></head><body><div id="app"></div></body>', '', ctx)
  assert.ok(output.includes(`<div id="mci-not-found-static">${ctx.content}</div><div id="app"></div>`))
  assert.equal(transformSeoHtml('<div id="app">Existing document</div>', '', context('doc/index.md')), undefined)
})

test('canonical preserves real document identities and normalizes directory aliases', () => {
  assert.equal(SITE_URL, 'https://microi.net')
  assert.equal(canonicalPath('doc/index.md'), '/doc/')
  assert.equal(canonicalPath('/doc/index.html?from=search#intro'), '/doc/')
  assert.equal(canonicalPath('en/doc/v8-engine/v8-server.md'), '/en/doc/v8-engine/v8-server.html')
  assert.equal(canonicalPath('https://microi.net/doc/v8-engine/v8-server.html'), '/doc/v8-engine/v8-server.html')
  assert.equal(canonicalPath('doc/v8-engine/v8-server'), '/doc/v8-engine/v8-server.html')
})

test('utility pages cannot enter sitemap while both languages remain indexable', () => {
  for (const page of ['404.html', 'login.md', '/profile', 'app-detail.html?app=x', 'uniapp-preview.html?url=x']) assert.equal(isIndexablePage(page), false)
  assert.equal(isIndexablePage('doc/v8-engine/v8-server.md'), true)
  assert.equal(isIndexablePage('en/doc/index.md'), true)
  assert.equal(isIndexablePage('doc/example.md', { frontmatter: { noindex: true } }), false)
  const result = filterSitemapItems([{ url: 'login.html' }, { url: 'doc/index.html', links: [{ lang: 'en_US', url: 'en/doc/' }] }])
  assert.equal(result.length, 1)
  assert.equal(result[0].links[0].lang, 'en-US')
})

test('explicit descriptions retain the author summary without repeated marketing prefix', () => {
  const ctx = context('doc/v8-engine/api-engine.md', { frontmatter: { description: '接口引擎通过 JavaScript 编排表单查询、参数校验与事务，本文说明配置和返回值。' } })
  assert.equal(transformSeoPageData(ctx.pageData, ctx).description, ctx.pageData.frontmatter.description)
})

test('retired offers inside HTML comments never enter public search descriptions', (t) => {
  // 旧文案可留在源码作历史，但不能经摘要和 llms 索引重新变成对外事实。
  const scratch = resolve(docs, '../../.tmp')
  mkdirSync(scratch, { recursive: true })
  const directory = mkdtempSync(resolve(scratch, 'seo-comment-evidence-'))
  t.after(() => rmSync(directory, { recursive: true }))
  writeFileSync(resolve(directory, 'offer.md'), '# 授权说明\n\n<!-- 历史报价 <strong>已暂停的旧授权与旧价格</strong>，这段文字不应被摘要采纳。 -->\n\n当前授权采用买断方式，具体功能与技术支持边界以已确认的授权协议为准。')
  const ctx = context('offer.md')
  ctx.siteConfig.srcDir = directory
  const result = transformSeoPageData(ctx.pageData, ctx)
  assert.match(result.description, /当前授权采用买断方式/)
  assert.doesNotMatch(result.description, /历史报价|旧授权|旧价格|摘要采纳/)
})

test('AI discovery prioritizes published evidence without inventing pages or exposing noindex content', async (t) => {
  const scratch = resolve(docs, '../../.tmp')
  mkdirSync(scratch, { recursive: true })
  const outDir = mkdtempSync(resolve(scratch, 'seo-discovery-evidence-'))
  t.after(() => rmSync(outDir, { recursive: true }))
  mkdirSync(resolve(outDir, 'doc/about'), { recursive: true })
  mkdirSync(resolve(outDir, 'contact'), { recursive: true })
  const html = (title, robots = 'index, follow') => `<head><title>${title} | Microi吾码</title><meta name="description" content="功能范围、当前授权与可重复验收说明"><meta name="robots" content="${robots}"></head>`
  writeFileSync(resolve(outDir, 'doc/index.html'), html('产品能力'))
  writeFileSync(resolve(outDir, 'doc/edition-comparison.html'), html('当前授权'))
  writeFileSync(resolve(outDir, 'contact/index.html'), html('服务商与合作联系'))
  writeFileSync(resolve(outDir, 'doc/about/faq.html'), html('PRIVATE_MARKER', 'noindex, follow'))
  await writeDiscoveryIndex({ outDir })
  const index = readFileSync(resolve(outDir, 'llms.txt'), 'utf8')
  const priority = index.split('## 功能、授权与验收资料')[1].split('## 中文文档')[0]
  assert.match(priority, /\[产品能力\]\(https:\/\/microi\.net\/doc\/\)/)
  assert.match(priority, /\[当前授权\]/)
  assert.match(priority, /\[服务商与合作联系\]\(https:\/\/microi\.net\/contact\/\)/)
  assert.doesNotMatch(index, /PRIVATE_MARKER|faq\.html|ai-apiengine\.html/)
  assert.match(index, /传输字节、模型 Token、交付耗时是不同指标/)
})

test('the same SEO metadata travels with page data for client navigation', () => {
  const ctx = context('doc/v8-engine/v8-server.md')
  const transformed = transformSeoPageData(ctx.pageData, ctx)
  assert.equal(transformed.mciSeoHead.find(([tag, attrs]) => tag === 'link' && attrs.rel === 'canonical')[1].href, `${SITE_URL}/doc/v8-engine/v8-server.html`)
  assert.ok(transformed.mciSeoHead.every(([, attrs]) => attrs['data-mci-seo'] === ''))
  assert.strictEqual(createSeoHead({ ...ctx, pageData: { ...ctx.pageData, ...transformed } }), transformed.mciSeoHead)
})

test('existing translations have reciprocal canonical alternates and truthful modified date', () => {
  for (const path of ['doc/v8-engine/v8-server.md', 'en/doc/v8-engine/v8-server.md']) {
    const ctx = context(path, { lastUpdated: Date.UTC(2026, 8, 1) })
    const head = createSeoHead(ctx)
    const alternates = head.filter(([tag, attrs]) => tag === 'link' && attrs.rel === 'alternate')
    assert.deepEqual(alternates.map(([, attrs]) => attrs.hreflang), ['zh-CN', 'en-US', 'x-default'])
    assert.equal(head.find(([tag, attrs]) => tag === 'link' && attrs.rel === 'canonical')[1].href, SITE_URL + canonicalPath(path))
    const json = JSON.parse(head.find(([tag]) => tag === 'script')[2])
    assert.equal(json['@graph'][0].dateModified, '2026-09-01T00:00:00.000Z')
    assert.ok(json['@graph'].some(item => item['@type'] === 'BreadcrumbList'))
    assert.equal(json['@graph'][0].datePublished, undefined)
  }
})

test('untranslated pages never invent an English counterpart', () => {
  const ctx = context('doc/system-engine/ai-data-analysis.md')
  assert.equal(existsSync(resolve(docs, 'en/doc/system-engine/ai-data-analysis.md')), false)
  assert.equal(createSeoHead(ctx).filter(([tag, attrs]) => tag === 'link' && attrs.rel === 'alternate').length, 0)
})

test('not-found and login responses advertise noindex; breadcrumb links match visible navigation', () => {
  for (const ctx of [context('404.md', { isNotFound: true }), context('login.md')]) {
    assert.equal(createSeoHead(ctx).find(([tag, attrs]) => tag === 'meta' && attrs.name === 'robots')[1].content, 'noindex, follow')
  }
  assert.deepEqual(breadcrumbsFor('/doc/v8-engine/v8-server.html', 'V8').map(item => item.path), ['/', '/doc/', '/doc/v8-engine/v8-server.html'])
  const component = readFileSync(resolve(docs, '.vitepress/theme/components/NotFoundPage.vue'), 'utf8')
  for (const [, path] of component.matchAll(/(?:startUrl|v8Url): '([^']+)'/g)) assert.equal(existsSync(resolve(docs, path.slice(1).replace(/\.html$/, '.md'))), true, path)
})
