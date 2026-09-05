// @ts-nocheck
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SITE_URL, canonicalPath, isIndexablePage, breadcrumbsFor } from './seo-policy.mjs'

const SHARE_IMAGE = `${SITE_URL}/home2.jpg`
const ZH_BASE_KEYWORDS = ['Microi吾码', '开源 AI 开发框架', '开源 AI 应用开发平台', 'AI低代码', '30+成熟引擎', '微服务', 'V8引擎', 'AI开发省Token', 'AI开发提速', '.NET10', 'Vue3']
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
    // 摘要优先解释本页内容，忽略组件初始化代码、图片和重复的一级标题。
    const body = source.replace(/^---[\s\S]*?---\s*/m, '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    const intro = body.split(/\n\s*\n/).filter(block => !/^\s*#{1,6}\s/.test(block)).map(cleanText).find(text => text.length >= 25)
    return (intro || cleanText(body.replace(/^#\s+.+$/gm, ''))).slice(0, 220)
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
    ? 'Microi open-source AI development framework documentation covering 30+ engines, AI low-code, microservices, and V8.'
    : 'Microi吾码开源 AI 开发框架官方资料，聚焦 30+ 成熟引擎、AI 低代码、微服务与 V8 引擎。'
  // 显式摘要优先，普通文档把主题放在前面，不给每页强塞相同营销关键词。
  const combined = explicit || (summary ? `${title}：${summary}` : `${title} — ${suffix}`)
  return combined.slice(0, en ? 210 : 180)
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

export function transformSeoPageData(pageData, ctx) {
  const description = ensureSeoDescription(pageData, ctx)
  return {
    description,
    // transformHead 只负责初次 HTML；将同一份元数据随页面模块交付，供 SPA 导航更新。
    mciSeoHead: createSeoHead({ ...ctx, page: pageData.relativePath, pageData: { ...pageData, description, mciSeoHead: undefined } })
  }
}

function alternatePages(pageData, context) {
  const relative = String(pageData.relativePath || '')
  const counterpart = relative.startsWith('en/') ? relative.slice(3) : `en/${relative}`
  // 只声明实际存在且同路径对应的译文，不把未翻译文档指向英文首页或失效地址。
  if (!relative || !existsSync(resolve(context.siteConfig.srcDir, counterpart))) return []
  const zh = relative.startsWith('en/') ? counterpart : relative
  const en = relative.startsWith('en/') ? relative : counterpart
  return [['zh-CN', zh], ['en-US', en], ['x-default', zh]].map(([lang, path]) =>
    ['link', { rel: 'alternate', hreflang: lang, href: `${SITE_URL}${canonicalPath(path)}` }])
}

export function transformSeoHtml(code, _id, context) {
  if (!context.pageData?.isNotFound) return
  const description = ensureSeoDescription(context.pageData, context)
  const html = code.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${description.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`
  )
  // VitePress 1.x 刻意清空 404 的 #app，以免未知路由的导航与 SSR 不一致。
  // 用同一次渲染的主题正文提供静态首屏，客户端挂载完成后再移除，避免空白页或 hydration 冲突。
  return context.content
    ? html.replace('<div id="app"></div>', () => `<div id="mci-not-found-static">${context.content}</div><div id="app"></div>`)
    : html
}

export function createSeoHead(context) {
  const pageData = context.pageData
  if (pageData.mciSeoHead) return pageData.mciSeoHead
  const en = isEnglishPage(pageData)
  const title = cleanText(context.title || pageData.title) || (en ? 'Microi Documentation' : 'Microi吾码官方文档')
  const description = cleanText(context.description || pageData.description)
  const canonical = `${SITE_URL}${canonicalPath(context.page)}`
  const headerKeywords = (pageData.headers || []).slice(0, 8).map(item => item.title)
  const pathKeywords = String(pageData.relativePath || '')
    .replace(/\.md$/i, '')
    .split(/[\/._-]+/)
    .filter(item => item.length > 2)
  const keywords = unique([title, ...headerKeywords, ...pathKeywords, ...(en ? EN_BASE_KEYWORDS : ZH_BASE_KEYWORDS)]).join(',')
  const isDoc = /(^|\/)doc\//.test(String(pageData.relativePath || ''))
  const indexable = isIndexablePage(context.page, pageData)
  const robots = indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow'
  const about = en
    ? ['Open-source AI development framework', 'AI low-code', 'Microservices', 'V8 Engine', '30+ mature engines']
    : ['开源 AI 开发框架', 'AI 低代码', '微服务', 'V8 引擎', '30+ 成熟引擎']
  const modified = Number(pageData.lastUpdated)
  const structuredData = isDoc ? {
    '@type': 'TechArticle',
    '@id': `${canonical}#article`,
    headline: cleanText(pageData.title) || title,
    description,
    url: canonical,
    inLanguage: en ? 'en-US' : 'zh-CN',
    about,
    mainEntityOfPage: { '@id': canonical },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(Number.isFinite(modified) && modified > 0 ? { dateModified: new Date(modified).toISOString() } : {}),
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Microi吾码', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.png` } }
  } : {
    '@type': 'WebPage',
    '@id': canonical,
    name: title,
    description,
    url: canonical,
    inLanguage: en ? 'en-US' : 'zh-CN',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Microi吾码', url: SITE_URL }
  }
  const crumbs = breadcrumbsFor(context.page, cleanText(pageData.title))
  const graph = [structuredData]
  if (crumbs.length) graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` }))
  })
  if (canonicalPath(context.page) === '/') graph.push(
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Microi吾码', url: `${SITE_URL}/`, inLanguage: ['zh-CN', 'en-US'], publisher: { '@id': `${SITE_URL}/#organization` } },
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Microi吾码', url: SITE_URL, logo: `${SITE_URL}/icon.png`, sameAs: ['https://github.com/itdos/microi.net', 'https://gitee.com/ITdos/microi.net'] }
  )

  return [
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'robots', content: robots }],
    ['link', { rel: 'canonical', href: canonical }],
    ...(indexable ? alternatePages(pageData, context) : []),
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
    // JSON 字符串中的 </script> 不得提前结束 HTML 标签。
    ['script', { type: 'application/ld+json' }, JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')]
  ].map(([tag, attrs, content]) => [tag, { ...attrs, 'data-mci-seo': '' }, ...(content === undefined ? [] : [content])])
}
