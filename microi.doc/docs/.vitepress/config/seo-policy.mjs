// 页面、sitemap 和验收共用规范地址，避免各自拼出不同的搜索入口。
export const SITE_URL = 'https://www.microi.net'
const UTILITY_PAGES = new Set(['/404.html', '/login.html', '/profile.html', '/app-detail.html', '/uniapp-preview.html'])

export function canonicalPath(input) {
  let path = String(input || '').replace(/\\/g, '/')
  if (/^https?:\/\//i.test(path)) path = new URL(path).pathname
  path = path.split(/[?#]/, 1)[0].replace(/^\/+/, '')
  path = path.replace(/\.md$/i, '.html').replace(/(^|\/)index(?:\.html)?$/i, '$1')
  if (!path || path.endsWith('/')) return `/${path}`
  if (['en', 'doc', 'en/doc', 'contact', 'en/contact'].includes(path)) return `/${path}/`
  return `/${path}${/\.[^/]+$/.test(path) ? '' : '.html'}`
}

export function isIndexablePage(input, pageData = {}) {
  const explicitRobots = (pageData.frontmatter?.head || [])
    .filter(([tag, attrs]) => tag === 'meta' && /^(robots|baiduspider)$/i.test(attrs?.name || ''))
    .map(([, attrs]) => attrs.content || '').join(',')
  return !pageData.isNotFound && pageData.frontmatter?.noindex !== true &&
    !/\bnoindex\b/i.test(explicitRobots) && !UTILITY_PAGES.has(canonicalPath(input))
}

export function breadcrumbsFor(input, title) {
  const path = canonicalPath(input)
  const en = path.startsWith('/en/')
  const prefix = en ? '/en' : ''
  const section = path.startsWith(`${prefix}/doc/`) ? 'doc' : path.startsWith(`${prefix}/case/`) ? 'case' : ''
  if (!section) return []
  const parent = section === 'doc' ? `${prefix}/doc/` : `${prefix}/case/case-index.html`
  const crumbs = [{ name: en ? 'Home' : '首页', path: `${prefix}/` }]
  if (path !== parent) crumbs.push({ name: section === 'doc' ? (en ? 'Documentation' : '官方文档') : (en ? 'Case studies' : '成功案例'), path: parent })
  crumbs.push({ name: String(title || (en ? 'Documentation' : '官方文档')), path })
  return crumbs
}

export function filterSitemapItems(items) {
  return items.filter(item => isIndexablePage(item.url)).map(item => ({
    ...item,
    links: item.links?.filter(link => isIndexablePage(link.url)).map(link => ({ ...link, lang: link.lang?.replace('_', '-') }))
  }))
}
