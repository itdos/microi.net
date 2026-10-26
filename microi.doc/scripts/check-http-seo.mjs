import assert from 'node:assert/strict'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { createHash } from 'node:crypto'
import { SITE_URL, discoveryTextPath } from '../docs/.vitepress/config/seo-policy.mjs'
import { headTags } from './seo-discovery.mjs'
import { auditServiceNetworkHtml } from './service-network-audit.mjs'

const baseIndex = process.argv.indexOf('--base')
if (baseIndex < 0 || !process.argv[baseIndex + 1]) throw new Error('请指定 --base，例如 http://127.0.0.1:61513；该命令只执行公开 GET 验收。')
const base = new URL(process.argv[baseIndex + 1])
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('验收地址必须是无凭据的 HTTP(S) 地址。')
let checks = 0
async function get(path, headers = {}) {
  // Node 20 的内置 fetch 会覆盖 Host；别名验收必须真正发送指定的回源主机名。
  if (headers.Host) return new Promise((resolve, reject) => {
    const url = new URL(path, base)
    const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, { headers, signal: AbortSignal.timeout(15000) }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('error', reject)
      response.on('end', () => resolve({
        response: { status: response.statusCode, headers: new Headers(Object.entries(response.headers).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])) },
        body: Buffer.concat(chunks).toString('utf8')
      }))
    })
    request.on('error', reject)
  })
  const response = await fetch(new URL(path, base), { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) })
  return { response, body: await response.text() }
}
const check = (condition, message) => { assert.ok(condition, message); checks++ }
for (const path of ['/missing-seo-page', '/missing-seo-page.html', '/doc/missing-seo-page/', '/en/missing-seo-page', '/404.html']) {
  const { response, body } = await get(path)
  check(response.status === 404, `${path}: 应为真实 404`)
  check(body.includes('mci-not-found-card') && body.includes('暂时迷路'), `${path}: 应显示官网友好错误页`)
  check(headTags(body, 'meta').some(item => item.name === 'robots' && /noindex/.test(item.content)), `${path}: 应禁止索引错误内容`)
}
for (const [path, target] of [
  ['/doc', '/doc/'], ['/doc/index', '/doc/'], ['/doc/index.html', '/doc/'],
  ['/doc/v8-engine/v8-server', '/doc/v8-engine/v8-server.html'],
  ['/doc/v8-engine/v8-server/', '/doc/v8-engine/v8-server.html'],
  ['/en/doc/index.html', '/en/doc/'], ['/login', '/login.html']
]) {
  const query = '?from=seo&return=%2Fdoc%2F'
  const { response } = await get(path + query)
  check(response.status === 301, `${path}: 应为永久跳转`)
  const location = response.headers.get('location')
  const redirected = new URL(location, base)
  check(redirected.pathname + redirected.search === target + query, `${path}: 路径或 query 丢失 (${location})`)
}
const { response: sitemapResponse, body: sitemap } = await get('/sitemap.xml')
check(sitemapResponse.status === 200, 'sitemap 必须可直接读取')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
check(urls.length > 100 && new Set(urls).size === urls.length, 'sitemap 页面数量异常或重复')
check(urls.every(url => url.startsWith(SITE_URL + '/') && !/\/(login|profile|app-detail)\.html$/.test(url)), 'sitemap 应只含公开规范页面')
// 限制并发，只验证当前发布的静态页，不触发登录、API 或写入动作。
let cursor = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < urls.length) {
    const canonical = urls[cursor++]
    const { response, body } = await get(new URL(canonical).pathname)
    check(response.status === 200, `${canonical}: 规范页面不可用或仍在跳转`)
    check(headTags(body, 'link').some(item => item.rel === 'canonical' && item.href === canonical), `${canonical}: canonical 不匹配`)
    check(!headTags(body, 'meta').some(item => item.name === 'robots' && /noindex/.test(item.content)), `${canonical}: 公开页面被禁止索引`)
    const path = new URL(canonical).pathname
    if (['/contact/', '/doc/about/partner.html'].includes(path)) {
      const failures = auditServiceNetworkHtml(body, { structured: path === '/contact/' })
      check(failures.length === 0, `${canonical}: ${failures.join('；')}`)
    }
  }
}))
for (const path of ['/login.html', '/profile.html', '/app-detail.html']) {
  const { response, body } = await get(path)
  check(response.status === 200 && headTags(body, 'meta').some(item => item.name === 'robots' && /noindex/.test(item.content)), `${path}: 功能页应保留访问但不进入索引`)
}
const { body: robots } = await get('/robots.txt')
check(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`) && !/Disallow:\s*\/assets\//i.test(robots), 'robots 必须允许渲染资源并使用规范域名')
const { response: indexResponse, body: index } = await get('/llms.txt')
check(indexResponse.status === 200 && index.includes('/doc/v8-engine/v8-server.html') && index.includes('/en/doc/'), 'AI 文档索引必须可读且包含中英文入口')
check(index.includes('## 按问题查找资料') && index.includes('哪些地区可以对接实施、培训与技术服务'), 'AI 文档索引应提供服务与能力问题入口')
const { response: readableIndexResponse, body: readableIndexBody } = await get('/ai-docs/index.json')
check(readableIndexResponse.status === 200 && /application\/json/i.test(readableIndexResponse.headers.get('content-type') || ''), '机器文档清单必须以 JSON 公开读取')
const readableIndex = JSON.parse(readableIndexBody)
const expectedReadable = urls.filter(url => discoveryTextPath(url))
check(readableIndex.schemaVersion === 1 && readableIndex.source === 'published-ssr' && readableIndex.documents?.length === expectedReadable.length, '机器文档清单必须完整对应当前公开阅读页')
const seenReadable = new Set()
for (const item of readableIndex.documents) {
  check(expectedReadable.includes(item.canonical) && item.textUrl === SITE_URL + discoveryTextPath(item.canonical) && !seenReadable.has(item.canonical), `机器文档来源或路径无效: ${item.canonical}`)
  seenReadable.add(item.canonical)
  const { response, body } = await get(new URL(item.textUrl).pathname)
  check(response.status === 200 && /text\/plain/i.test(response.headers.get('content-type') || ''), `${item.textUrl}: 应返回纯文本`)
  check(response.headers.get('x-robots-tag') === 'noindex, follow' && response.headers.get('cache-control') === 'no-cache', `${item.textUrl}: 应允许读取并避免重复收录及过期缓存`)
  check(Buffer.byteLength(body) === item.bytes && createHash('sha256').update(body).digest('hex') === item.sha256 && body.includes(`Canonical: ${item.canonical}`), `${item.textUrl}: 文本与来源清单不一致`)
  check(index.includes(`](${item.textUrl})`), `${item.textUrl}: llms.txt 缺少入口`)
}
const { response: homeResponse, body: home } = await get('/')
check(homeResponse.status === 200 && homeResponse.headers.get('cache-control') === 'no-cache', 'HTML 应可重新校验，不能被长期缓存')
const resources = [...new Set([
  ...headTags(home, 'link').filter(item => item.rel === 'stylesheet').map(item => item.href),
  ...headTags(home, 'script').map(item => item.src)
].filter(path => path?.startsWith('/assets/')))]
check(resources.length >= 3, '首页应提供可抓取的实际脚本与样式')
for (const resource of resources) {
  const { response } = await get(resource)
  const hashed = /\.[A-Za-z0-9_-]{8,}\.(js|css)$/.test(resource)
  check(response.status === 200 && /(?:javascript|css)/.test(response.headers.get('content-type')), `${resource}: 渲染资源必须可读取`)
  check((response.headers.get('cache-control') || '').includes(hashed ? 'immutable' : 'no-cache'), `${resource}: 仅带内容指纹的资源可长期缓存`)
}

if (process.argv.includes('--check-alias-hosts')) {
  check(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Host 覆盖测试仅允许隔离的本机验收服务')
  for (const host of ['www.microi.net', 'doc.microi.net']) {
    const { response } = await get('/doc/index.html?source=seo', { Host: host })
    check(response.status === 301 && response.headers.get('location') === `${SITE_URL}/doc/index.html?source=seo`, `${host}: 应归一到 microi.net 且保留路径和参数`)
  }
  for (const path of ['/', '/doc/']) {
    const { response } = await get(path, { Host: 'microi.net', 'X-Forwarded-Proto': 'https' })
    check(response.status === 200 && !response.headers.get('location'), `${path}: microi.net 必须直接返回内容，不能跳向 www 或循环跳转`)
  }
  for (const host of ['www.itdos.com', 'itdos.com']) {
    const { response } = await get('/doc/?source=seo', { Host: host })
    check(response.status === 301 && response.headers.get('location') === `${SITE_URL}/doc/?source=seo`, `${host}: 历史文档应永久归一且保留参数`)
    const { response: home } = await get('/', { Host: host })
    check(home.status === 200, `${host}: 不扩大到非文档业务路径`)
  }
}
// 公网直接访问真实别名，不伪造 Host；独立验证边缘代理是否保留了源站跳转。
if (process.argv.includes('--check-public-aliases')) {
  for (const host of ['www.microi.net', 'doc.microi.net', 'www.itdos.com']) {
    const response = await fetch(`https://${host}/doc/?source=seo`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    await response.text()
    check(response.status === 301 && response.headers.get('location') === `${SITE_URL}/doc/?source=seo`, `${host}: 公网旧文档入口应永久归一且保留参数`)
  }
}
console.log(`HTTP SEO audit passed: ${checks} assertions, ${urls.length} canonical pages; actual nginx status, redirects, friendly 404, robots and discovery verified.`)
