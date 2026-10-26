import { readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { SITE_URL, canonicalPath, isIndexablePage, discoveryTextPath } from '../docs/.vitepress/config/seo-policy.mjs'
import { sourceIsIndexable } from '../docs/.vitepress/config/seo-source.mjs'
import { htmlFiles, headTags, pageRevision, decodeHtml as decode } from './seo-discovery.mjs'
import { readableAsset } from './seo-readable.mjs'
import { auditServiceNetworkHtml } from './service-network-audit.mjs'

const distDir = resolve(process.cwd(), 'docs/.vitepress/dist')

const files = await htmlFiles(distDir)
const failures = []
const pageCanonicals = new Map()
const pageDescriptions = new Map()
const indexableUrls = new Set()
const alternateTargets = []
const expectedReadable = new Map()

for (const file of files) {
  const html = await readFile(file, 'utf8')
  const name = relative(distDir, file).replace(/\\/g, '/')
  const metas = headTags(html, 'meta')
  const links = headTags(html, 'link')
  const getMeta = (key, value) => metas.filter(item => String(item[key] || '').toLowerCase() === value.toLowerCase())
  const descriptions = getMeta('name', 'description')
  const keywords = getMeta('name', 'keywords')
  const canonical = links.filter(item => String(item.rel || '').toLowerCase() === 'canonical')
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
  const expectedCanonical = `${SITE_URL}${canonicalPath(name)}`
  const robots = getMeta('name', 'robots')
  const indexable = isIndexablePage(name) && sourceIsIndexable(name, resolve(process.cwd(), 'docs'))
  if (['contact/index.html', 'doc/about/partner.html'].includes(name)) {
    failures.push(...auditServiceNetworkHtml(html, { structured: name === 'contact/index.html' }).map(message => `${name}: ${message}`))
  }

  if (name === '404.html' && (!html.includes('id="mci-not-found-static"') || !html.includes('mci-not-found-card'))) failures.push('404.html: friendly content must be readable before JavaScript loads')

  if (!title) failures.push(`${name}: missing title`)
  if (descriptions.length !== 1 || (descriptions[0]?.content?.length || 0) < 20) failures.push(`${name}: invalid or duplicate description`)
  if (keywords.length !== 1) failures.push(`${name}: missing or duplicate keywords`)
  if (canonical.length !== 1 || canonical[0].href !== expectedCanonical) failures.push(`${name}: incorrect page canonical`)
  if (pageCanonicals.has(expectedCanonical)) failures.push(`${name}: canonical reused by ${pageCanonicals.get(expectedCanonical)}`)
  pageCanonicals.set(expectedCanonical, name)
  if (robots.length !== 1 || /noindex/.test(robots[0]?.content || '') === indexable) failures.push(`${name}: incorrect robots policy`)
  if (indexable) {
    indexableUrls.add(expectedCanonical)
    const description = descriptions[0]?.content || ''
    if (pageDescriptions.has(description)) failures.push(`${name}: description reused by ${pageDescriptions.get(description)}`)
    pageDescriptions.set(description, name)
    const textPath = discoveryTextPath(name)
    if (textPath) {
      const textUrl = `${SITE_URL}${textPath}`
      if (!links.some(link => link.rel === 'alternate' && link.type === 'text/plain' && link.href === textUrl)) failures.push(`${name}: missing readable alternate`)
      try {
        const expected = readableAsset({ html, canonical: expectedCanonical, title: title.replace(/\s*\|\s*Microi吾码$/, ''), description,
          revision: pageRevision(html, expectedCanonical), textUrl })
        const actual = await readFile(resolve(distDir, textPath.slice(1)), 'utf8')
        if (actual !== expected.text) failures.push(`${name}: readable body differs from published HTML`)
        expectedReadable.set(textUrl, expected.metadata)
      } catch (error) { failures.push(`${name}: readable document: ${error.message}`) }
    }
  }
  const expectedLang = name.startsWith('en/') ? 'en-US' : 'zh-CN'
  if (html.match(/<html\b[^>]*lang=["']([^"']+)["']/i)?.[1] !== expectedLang) failures.push(`${name}: invalid HTML language`)
  alternateTargets.push(...links.filter(link => link.rel === 'alternate' && link.hreflang).map(link => ({ ...link, source: expectedCanonical })))
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (getMeta('property', property).length !== 1) failures.push(`${name}: missing or duplicate ${property}`)
  }
  if (getMeta('property', 'og:url')[0]?.content !== expectedCanonical) failures.push(`${name}: og:url differs from canonical`)
  // 独立静态预览页已 noindex，无需为其制造文章结构化数据；可索引页面和主题 404 必须完整。
  if (indexable || name === '404.html') try {
    const json = JSON.parse(html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '')
    if (json['@context'] !== 'https://schema.org' || !json['@graph']?.length) throw new Error('missing graph')
    if (/^(en\/)?(doc|case)\//.test(name) && !json['@graph'].some(item => item['@type'] === 'BreadcrumbList')) throw new Error('missing breadcrumbs')
  } catch (error) { failures.push(`${name}: invalid JSON-LD: ${error.message}`) }
}

// 交叉检查实际页面集合，而不只检查 canonical 是否具有指定域名前缀。
const sitemap = await readFile(resolve(distDir, 'sitemap.xml'), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]))
if (new Set(sitemapUrls).size !== sitemapUrls.length) failures.push('sitemap: duplicate URLs')
for (const url of sitemapUrls) if (!indexableUrls.has(url)) failures.push(`sitemap: non-indexable or missing target ${url}`)
for (const url of indexableUrls) if (!sitemapUrls.includes(url)) failures.push(`sitemap: missing ${url}`)
for (const link of alternateTargets) {
  if (!indexableUrls.has(link.href)) failures.push(`hreflang: missing/non-indexable ${link.href}`)
  if (!['zh-CN', 'en-US', 'x-default'].includes(link.hreflang)) failures.push(`hreflang: invalid language ${link.hreflang}`)
  if (link.hreflang !== 'x-default' && !alternateTargets.some(other => other.source === link.href && other.href === link.source)) failures.push(`hreflang: missing reciprocal for ${link.source}`)
}
const robotsText = await readFile(resolve(distDir, 'robots.txt'), 'utf8')
if (/Disallow:\s*\/assets\//i.test(robotsText)) failures.push('robots: public rendering assets are blocked')
if (!robotsText.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) failures.push('robots: sitemap uses a different canonical host')
const discovery = await readFile(resolve(distDir, 'llms.txt'), 'utf8')
if (!discovery.includes('## 按问题查找资料')) failures.push('llms.txt: missing question-based discovery')
for (const url of indexableUrls) if (/\/(doc|case|contact)\//.test(url) && !discovery.includes(`](${url})`)) failures.push(`llms.txt: missing ${url}`)
for (const [, url] of discovery.matchAll(/\]\((https:\/\/microi\.net\/[^)]+)\)/g)) if (!indexableUrls.has(url) && !expectedReadable.has(url)) failures.push(`llms.txt: unpublished or non-indexable target ${url}`)
try {
  const manifest = JSON.parse(await readFile(resolve(distDir, 'ai-docs/index.json'), 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.source !== 'published-ssr' || manifest.canonicalSite !== SITE_URL) throw new Error('incorrect schema or source')
  if (!Array.isArray(manifest.documents) || manifest.documents.length !== expectedReadable.size) throw new Error('document count differs from published HTML')
  const seen = new Set()
  for (const document of manifest.documents) {
    if (seen.has(document.textUrl) || JSON.stringify(document) !== JSON.stringify(expectedReadable.get(document.textUrl))) throw new Error(`unexpected metadata or digest for ${document.textUrl}`)
    if (!discovery.includes(`](${document.textUrl})`)) throw new Error(`llms.txt missing ${document.textUrl}`)
    seen.add(document.textUrl)
  }
} catch (error) { failures.push(`ai-docs/index.json: ${error.message}`) }

if (failures.length) {
  console.error(`SEO audit failed with ${failures.length} issue(s):`)
  for (const failure of failures.slice(0, 80)) console.error(`- ${failure}`)
  if (failures.length > 80) console.error(`- ... ${failures.length - 80} more`)
  process.exitCode = 1
} else {
  console.log(`SEO audit passed: ${files.length} HTML pages, ${indexableUrls.size} indexable URLs, ${expectedReadable.size} readable documents; unique descriptions/canonicals, robots, sitemap, reciprocal hreflang, JSON-LD, text body parity and SHA-256 manifest verified.`)
}
