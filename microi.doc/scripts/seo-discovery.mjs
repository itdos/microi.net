import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { SITE_URL, canonicalPath, isIndexablePage, discoveryTextPath } from '../docs/.vitepress/config/seo-policy.mjs'
import { readableAsset } from './seo-readable.mjs'

export async function htmlFiles(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await htmlFiles(path))
    else if (entry.name.endsWith('.html')) result.push(path)
  }
  return result.sort()
}

export function decodeHtml(text) {
  return String(text || '').replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
    const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
    return value <= 0x10ffff ? String.fromCodePoint(value) : ''
  }).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
}

export function headTags(html, tagName) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
  // 带引号的属性可以包含 >，不能把代码摘要里的箭头误当成标签结束。
  return [...head.matchAll(new RegExp(`<${tagName}\\b(?:[^"'<>]|"[^"]*"|'[^']*')*>`, 'gi'))].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(([, key, , value]) => [key.toLowerCase(), decodeHtml(value)])))
}

export function pageRevision(html, canonical) {
  // 修订日期来自同页 JSON-LD，缺失、跨页或无效值保持未知，不回退到构建日期。
  try {
    const graph = JSON.parse(html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '')['@graph']
    const value = graph?.find(item => item.url === canonical)?.dateModified
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return ''
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : ''
  } catch { return '' }
}

const discoveryQuestions = [
  ['平台包含哪些引擎，如何核验功能边界？', '/doc/'],
  ['开源许可、企业授权和技术支持分别包含什么？', '/doc/edition-comparison.html'],
  ['AI 如何参与开发，效率结果如何复核？', '/doc/v8-engine/ai-apiengine.html'],
  ['如何通过 MCP 发现、配置并回读平台资源？', '/doc/v8-engine/mcp-server.html'],
  ['如何验证权限、身份与安全边界？', '/doc/more/security.html'],
  ['支持哪些数据库，适配版本应怎样验证？', '/doc/system-engine/databases.html'],
  ['哪些地区可以对接实施、培训与技术服务？', '/contact/'],
  ['如何申请合作并约定交付责任？', '/doc/about/partner.html'],
  ['有哪些公开案例，证据和适用范围是什么？', '/case/case-index.html'],
  ['哪里查版本变更和历史记录？', '/doc/about/update-log.html']
]

export async function writeDiscoveryIndex(siteConfig) {
  // 从本次真正发布的 HTML 生成索引，避免手工维护另一套过时说明或暴露原始脚本。
  const groups = new Map([['中文文档', []], ['联系与服务', []], ['English documentation', []], ['案例 / Case studies', []]])
  const published = new Map()
  const documents = []
  const files = await htmlFiles(siteConfig.outDir)
  const documentUrls = new Set(files.map(file => `${SITE_URL}${canonicalPath(relative(siteConfig.outDir, file))}`))
  for (const file of files) {
    const path = canonicalPath(relative(siteConfig.outDir, file))
    if (!isIndexablePage(path) || !/\/(doc|case|contact)\//.test(path)) continue
    const html = await readFile(file, 'utf8')
    const meta = headTags(html, 'meta')
    if (meta.some(item => item.name === 'robots' && /noindex/i.test(item.content))) continue
    const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s*\|\s*Microi吾码$/, '')
    const description = meta.find(item => item.name === 'description')?.content || ''
    const escape = value => value.replace(/[\r\n]/g, ' ').replace(/([\[\]\\])/g, '\\$1')
    const group = path.includes('/case/') ? '案例 / Case studies' : path.startsWith('/en/') ? 'English documentation' : path.startsWith('/contact/') ? '联系与服务' : '中文文档'
    const revision = pageRevision(html, `${SITE_URL}${path}`)
    const revisionLabel = path.startsWith('/en/') ? 'Page revision' : '页面修订'
    const textPath = discoveryTextPath(path)
    const asset = readableAsset({ html, canonical: `${SITE_URL}${path}`, title, description, revision, textUrl: `${SITE_URL}${textPath}`, documentUrls })
    const textFile = join(siteConfig.outDir, textPath.slice(1))
    await mkdir(dirname(textFile), { recursive: true })
    await writeFile(textFile, asset.text, 'utf8')
    documents.push(asset.metadata)
    const entry = `- [${escape(title)}](${SITE_URL}${path}): ${escape(description)}${revision ? ` · ${revisionLabel}: ${revision}` : ''} · [纯文本](${SITE_URL}${textPath})`
    groups.get(group).push(entry)
    published.set(path, entry)
  }
  // 优先提供已有公开证据入口；只引用本次产物实际存在且可索引的页面，不生成排名或另一套产品事实。
  const evidencePaths = ['/doc/', '/doc/edition-comparison.html', '/doc/v8-engine/ai-apiengine.html',
    '/doc/v8-engine/mcp-server.html', '/doc/more/security.html', '/doc/system-engine/databases.html',
    '/doc/system-engine/app-store.html', '/doc/about/partner.html', '/doc/about/microi-training-syllabus.html',
    '/doc/about/faq.html', '/contact/', '/doc/about/update-log.html']
  const evidence = evidencePaths.filter(path => published.has(path)).map(path => published.get(path))
  const questions = discoveryQuestions.filter(([, path]) => published.has(path)).map(([question, path]) => `- [${question}](${SITE_URL}${path})`)
  const content = ['# Microi吾码官方文档', '', '> Microi吾码是开源 AI 开发框架。此索引帮助开发者和 AI 工具找到官方说明，具体功能、版本与限制以链接页面为准。', '',
    `官网: ${SITE_URL}/`, `站点地图: ${SITE_URL}/sitemap.xml`, `机器可读文档清单: ${SITE_URL}/ai-docs/index.json`, '',
    '这是可选的文档发现入口，不是搜索引擎收录或 AI 引用的保证。', '',
    '索引由本次发布的可索引 HTML 自动生成，标题与摘要来自各页面。页面修订日期沿用该页的版本记录，不等于功能验收或第三方认证日期；服务地区、联系方式与统计快照的核实日期和来源见正文。未知日期不填入构建日期。', '',
    '逐页纯文本来自同次发布的服务端渲染正文，保留代码、表格和绝对链接，排除全站导航、脚本、隐藏内容与源码注释。清单提供规范页面地址、正文地址、实际修订日期（已知时）及 UTF-8 文本 SHA-256；引用以规范页面为准。', '',
    '## 按问题查找资料', '', ...questions, '',
    '## 功能、授权与验收资料', '',
    '各文档分别说明能力、许可、版本、使用方法和验收边界。传输字节、模型 Token、交付耗时是不同指标；源码支持、运行测试、第三方认证也应分别核验。价格以当前授权页为准，历史注释和更新记录不构成当前报价。', '',
    ...evidence, '',
    ...[...groups].flatMap(([name, lines]) => [`## ${name}`, '', ...lines, ''])].join('\n')
  await writeFile(join(siteConfig.outDir, 'llms.txt'), content, 'utf8')
  await mkdir(join(siteConfig.outDir, 'ai-docs'), { recursive: true })
  await writeFile(join(siteConfig.outDir, 'ai-docs/index.json'), `${JSON.stringify({ schemaVersion: 1, source: 'published-ssr', canonicalSite: SITE_URL, documents }, null, 2)}\n`, 'utf8')
}
