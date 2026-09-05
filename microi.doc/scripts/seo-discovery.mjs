import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { SITE_URL, canonicalPath, isIndexablePage } from '../docs/.vitepress/config/seo-policy.mjs'

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

export async function writeDiscoveryIndex(siteConfig) {
  // 从本次真正发布的 HTML 生成索引，避免手工维护另一套过时说明或暴露原始脚本。
  const groups = new Map([['中文文档', []], ['English documentation', []], ['案例 / Case studies', []]])
  for (const file of await htmlFiles(siteConfig.outDir)) {
    const path = canonicalPath(relative(siteConfig.outDir, file))
    if (!isIndexablePage(path) || !/\/(doc|case)\//.test(path)) continue
    const html = await readFile(file, 'utf8')
    const meta = headTags(html, 'meta')
    if (meta.some(item => item.name === 'robots' && /noindex/i.test(item.content))) continue
    const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s*\|\s*Microi吾码$/, '')
    const description = meta.find(item => item.name === 'description')?.content || ''
    const escape = value => value.replace(/[\r\n]/g, ' ').replace(/([\[\]\\])/g, '\\$1')
    const group = path.includes('/case/') ? '案例 / Case studies' : path.startsWith('/en/') ? 'English documentation' : '中文文档'
    groups.get(group).push(`- [${escape(title)}](${SITE_URL}${path}): ${escape(description)}`)
  }
  const content = ['# Microi吾码官方文档', '', '> Microi吾码是开源 AI 开发框架。此索引帮助开发者和 AI 工具找到官方说明，具体功能、版本与限制以链接页面为准。', '',
    `官网: ${SITE_URL}/`, `站点地图: ${SITE_URL}/sitemap.xml`, '',
    '这是可选的文档发现入口，不是搜索引擎收录或 AI 引用的保证。', '',
    ...[...groups].flatMap(([name, lines]) => [`## ${name}`, '', ...lines, ''])].join('\n')
  await writeFile(join(siteConfig.outDir, 'llms.txt'), content, 'utf8')
}
