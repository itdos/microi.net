import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync, copyFileSync, linkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { withdrawStaleTranslations } from '../scripts/stale-translation.mjs'
import { sourceIsIndexable } from '../docs/.vitepress/config/seo-source.mjs'
import { filterSitemapItems } from '../docs/.vitepress/config/seo-policy.mjs'
import { writeDiscoveryIndex } from '../scripts/seo-discovery.mjs'

const project = fileURLToPath(new URL('../', import.meta.url))
const scratch = resolve(project, '../.tmp')
const sha = x => createHash('sha256').update(x).digest('hex')
function fixture(t) {
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(resolve(scratch, 'stale-translation-test-'))
  writeFileSync(resolve(root, 'owner.json'), JSON.stringify({ owner: 'stale-translation-tests' }))
  const docs = resolve(root, 'docs')
  for (const sub of ['case','en/case']) mkdirSync(resolve(docs, sub), { recursive: true })
  writeFileSync(resolve(docs, 'case/example.md'), '# 当前中文资料\n\n已移除不适合公开的内容。\n')
  writeFileSync(resolve(docs, 'en/case/example.md'), '# Old translation\n\nSYNTHETIC_PRIVATE_MARKER\n')
  t.after(() => {
    assert.ok(root.startsWith(`${scratch}\\stale-translation-test-`) || root.startsWith(`${scratch}/stale-translation-test-`))
    assert.equal(JSON.parse(readFileSync(resolve(root, 'owner.json'), 'utf8')).owner, 'stale-translation-tests')
    rmSync(root, { recursive: true })
  })
  return { root, docs }
}

test('withdrawal removes old content, preserves Chinese bytes, and is deterministic', t => {
  const { docs } = fixture(t)
  const before = readFileSync(resolve(docs, 'case/example.md'))
  const first = withdrawStaleTranslations(docs, ['case/example.md'])
  const result = readFileSync(resolve(docs, 'en/case/example.md'), 'utf8')
  assert.equal(first[0].sourceSha256, sha(before))
  assert.equal(first[0].changed, true)
  assert.doesNotMatch(result, /SYNTHETIC_PRIVATE_MARKER/)
  assert.match(result, /noindex: true\nsearch: false/)
  assert.match(result, /This page is not an updated translation/)
  assert.match(result, /https:\/\/microi\.net\/case\/example\.html/)
  assert.deepEqual(readFileSync(resolve(docs, 'case/example.md')), before)
  const second = withdrawStaleTranslations(docs, ['case/example.md'])
  assert.equal(second[0].changed, false)
  assert.equal(readFileSync(resolve(docs, 'en/case/example.md'), 'utf8'), result)
})

test('paths cannot overwrite Chinese, other languages or leave the docs tree; batch validation is pre-write', t => {
  const { docs } = fixture(t)
  const old = readFileSync(resolve(docs, 'en/case/example.md'), 'utf8')
  for (const path of ['../secret.md','en/case/example.md','fr/case/example.md','/case/example.md','D:/case/example.md','case/../doc/example.md','case//example.md','case\\example.md','case/%2e%2e/example.md','case/example.md?x','case/example.txt']) {
    assert.throws(() => withdrawStaleTranslations(docs, [path]))
  }
  assert.throws(() => withdrawStaleTranslations(docs, []))
  assert.throws(() => withdrawStaleTranslations(docs, ['case/example.md','case/missing.md']))
  assert.throws(() => withdrawStaleTranslations(docs, ['case/example.md','case/example.md']))
  assert.equal(readFileSync(resolve(docs, 'en/case/example.md'), 'utf8'), old)
})

test('hard-linked target cannot modify the authoritative source', t => {
  const { docs } = fixture(t)
  const source = resolve(docs, 'case/example.md')
  const target = resolve(docs, 'en/case/example.md')
  const before = readFileSync(source)
  unlinkSync(target)
  linkSync(source, target)
  assert.throws(() => withdrawStaleTranslations(docs, ['case/example.md']), /ordinary unshared file/)
  assert.deepEqual(readFileSync(source), before)
})

test('actual translation CLI withdraws without cloud credentials or loading cloud dependencies', t => {
  const { root, docs } = fixture(t)
  mkdirSync(resolve(root, 'scripts'))
  for (const name of ['translate.mjs','scripts/stale-translation.mjs','scripts/translation-config.mjs']) copyFileSync(resolve(project, name), resolve(root, name))
  const result = spawnSync(process.execPath, [resolve(root, 'translate.mjs'),'--withdraw-stale','case/example.md'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ALIBABA_CLOUD_ACCESS_KEY_ID: '', ALIBABA_CLOUD_ACCESS_KEY_SECRET: '', ALIBABA_CLOUD_SECURITY_TOKEN: '' }
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout)[0].status, 'withdrawn-pending-update')
  assert.equal(existsSync(resolve(root, 'node_modules')), false)
  assert.doesNotMatch(readFileSync(resolve(docs, 'en/case/example.md'), 'utf8'), /SYNTHETIC_PRIVATE_MARKER/)
})

test('withdrawn pages are excluded from sitemap and reciprocal hreflang', async t => {
  const { root, docs } = fixture(t)
  withdrawStaleTranslations(docs, ['case/example.md'])
  assert.equal(sourceIsIndexable('case/example.html', docs), true)
  assert.equal(sourceIsIndexable('en/case/example.html', docs), false)
  const items = filterSitemapItems([
    { url: 'case/example.html', links: [{ lang: 'en_US', url: 'en/case/example.html' }] },
    { url: 'en/case/example.html' }
  ], url => sourceIsIndexable(url, docs))
  assert.equal(items.length, 1)
  assert.deepEqual(items[0].links, [])
  const configDir = resolve(project, 'docs/.vitepress/config')
  const source = readFileSync(resolve(configDir, 'seo.ts'), 'utf8').replace(/'\.\/(seo-policy|service-network|seo-source)\.mjs'/g, (_, name) => JSON.stringify(pathToFileURL(resolve(configDir, `${name}.mjs`)).href))
  const { createSeoHead } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  const ctx = { page: 'case/example.html', pageData: { relativePath: 'case/example.md', title: 'Example' }, siteConfig: { srcDir: docs } }
  assert.equal(createSeoHead(ctx).some(([tag, attr]) => tag === 'link' && attr.hreflang), false)
  const en = { ...ctx, page: 'en/case/example.html', pageData: { relativePath: 'en/case/example.md', title: 'Translation update pending', frontmatter: { noindex: true } } }
  assert.equal(createSeoHead(en).find(([tag, attr]) => tag === 'meta' && attr.name === 'robots')[1].content, 'noindex, follow')
  // Exercise the real publication audit on synthetic generated HTML, not source-string assertions.
  const outDir = resolve(docs, '.vitepress/dist')
  for (const sub of ['case','en/case']) mkdirSync(resolve(outDir, sub), { recursive: true })
  const html = (context, language) => {
    const description = 'Synthetic content for verifying the publication metadata policy.'
    const head = createSeoHead({ ...context, description }).map(([tag, attrs, content]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${String(value).replaceAll('&','&amp;').replaceAll('"','&quot;')}"`).join(' ')}>${content || ''}${tag === 'script' ? '</script>' : ''}`).join('')
    return `<html lang="${language}"><head><title>${context.pageData.title}</title><meta name="description" content="${description}">${head}</head><body><main><div class="vp-doc"><h1>${context.pageData.title}</h1><p>Synthetic document</p></div></main></body></html>`
  }
  writeFileSync(resolve(outDir, 'case/example.html'), html(ctx, 'zh-CN'))
  writeFileSync(resolve(outDir, 'en/case/example.html'), html(en, 'en-US'))
  writeFileSync(resolve(outDir, 'sitemap.xml'), '<urlset><url><loc>https://microi.net/case/example.html</loc></url></urlset>')
  writeFileSync(resolve(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://microi.net/sitemap.xml\n')
  await writeDiscoveryIndex({ outDir })
  assert.doesNotMatch(readFileSync(resolve(outDir, 'llms.txt'), 'utf8'), /\/en\/case\/example/)
  const audit = spawnSync(process.execPath, [resolve(project, 'scripts/check-seo.mjs')], { cwd: root, encoding: 'utf8' })
  assert.equal(audit.status, 0, audit.stderr)
  assert.match(audit.stdout, /2 HTML pages, 1 indexable URLs/)
  writeFileSync(resolve(docs, 'en/case/example.md'), '# Verified replacement translation\n')
  assert.equal(createSeoHead(ctx).filter(([tag, attr]) => tag === 'link' && attr.hreflang).length, 3)
})
