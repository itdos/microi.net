// @ts-nocheck
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SITE_URL = 'https://www.microi.net'
const SHARE_IMAGE = `${SITE_URL}/home2.jpg`
const ZH_BASE_KEYWORDS = ['Microi吾码', '开源 AI 开发框架', '开源 AI 应用开发平台', 'AI低代码', '20+成熟引擎', '微服务', 'V8引擎', 'AI开发省Token', 'AI开发提速', '.NET10', 'Vue3']
const EN_BASE_KEYWORDS = ['Microi', 'open-source low-code platform', 'AI low-code', 'V8 engine', 'enterprise application development', '.NET10', 'Vue3']

function cleanText(value) {
  return String(value || '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[#>|*-]+\s*/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function sourceSummary(pageData, ctx) {
  try {
    const file = pageData.filePath || pageData.relativePath
    if (!file) return ''
    const source = readFileSync(resolve(ctx.siteConfig.srcDir, file), 'utf8')
    return cleanText(source).slice(0, 150)
  } catch (_) {
    return ''
  }
}

function isEnglishPage(pageData) {
  return String(pageData.relativePath || '').startsWith('en/')
}

function ensureSeoDescription(pageData, ctx) {
  const en = isEnglishPage(pageData)
  const title = cleanText(pageData.title) || (en ? 'Microi Documentation' : 'Microi吾码官方文档')
  const explicit = cleanText(pageData.frontmatter?.description)
  const summary = explicit || sourceSummary(pageData, ctx)
  const suffix = en
    ? 'Microi open-source AI development framework documentation covering 20+ engines, AI low-code, microservices, and V8.'
    : 'Microi吾码开源 AI 开发框架官方资料，聚焦 20+ 成熟引擎、AI 低代码、微服务与 V8 引擎。'
  // 核心产品语义放在摘要前部，避免正文摘要截断后丢失框架、AI、低代码、微服务与 V8 引擎关键词。
  const combined = summary
    ? `${title} — ${suffix} ${summary}`
    : `${title} — ${suffix}`
  return combined.slice(0, en ? 210 : 180)
}

function canonicalPath(page) {
  let path = String(page || '').replace(/\\/g, '/')
  path = path.replace(/\.md$/i, '.html')
  path = path.replace(/(^|\/)index\.html$/i, '$1')
  if (!path.startsWith('/')) path = `/${path}`
  return path || '/'
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

export function transformSeoPageData(pageData, ctx) {
  return {
    description: ensureSeoDescription(pageData, ctx)
  }
}

export function transformSeoHtml(code, _id, context) {
  if (!context.pageData?.isNotFound) return
  const description = ensureSeoDescription(context.pageData, context)
  return code.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${description.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`
  )
}

export function createSeoHead(context) {
  const pageData = context.pageData
  const en = isEnglishPage(pageData)
  const title = cleanText(pageData.title) || (en ? 'Microi Documentation' : 'Microi吾码官方文档')
  const description = cleanText(context.description || pageData.description)
  const canonical = `${SITE_URL}${canonicalPath(context.page)}`
  const headerKeywords = (pageData.headers || []).slice(0, 8).map(item => item.title)
  const pathKeywords = String(pageData.relativePath || '')
    .replace(/\.md$/i, '')
    .split(/[\/._-]+/)
    .filter(item => item.length > 2)
  const keywords = unique([title, ...headerKeywords, ...pathKeywords, ...(en ? EN_BASE_KEYWORDS : ZH_BASE_KEYWORDS)]).join(',')
  const isDoc = /(^|\/)doc\//.test(String(pageData.relativePath || ''))
  const robots = pageData.isNotFound ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  const about = en
    ? ['Open-source AI development framework', 'AI low-code', 'Microservices', 'V8 Engine', '20+ mature engines']
    : ['开源 AI 开发框架', 'AI 低代码', '微服务', 'V8 引擎', '20+ 成熟引擎']
  const structuredData = isDoc ? {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: canonical,
    inLanguage: en ? 'en-US' : 'zh-CN',
    about,
    publisher: { '@type': 'Organization', name: 'Microi吾码', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.png` } }
  } : {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    inLanguage: en ? 'en-US' : 'zh-CN',
    isPartOf: { '@type': 'WebSite', name: 'Microi吾码', url: SITE_URL }
  }

  return [
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'robots', content: robots }],
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { property: 'og:type', content: isDoc ? 'article' : 'website' }],
    ['meta', { property: 'og:site_name', content: 'Microi吾码' }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: SHARE_IMAGE }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:locale', content: en ? 'en_US' : 'zh_CN' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: SHARE_IMAGE }],
    ['script', { type: 'application/ld+json' }, JSON.stringify(structuredData)]
  ]
}
