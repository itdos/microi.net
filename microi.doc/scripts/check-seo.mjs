import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const distDir = resolve(process.cwd(), 'docs/.vitepress/dist')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path)
  }
  return files
}

function decode(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function attributes(tag) {
  const result = {}
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) result[match[1].toLowerCase()] = decode(match[3])
  return result
}

function headTags(html, tagName) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
  return [...head.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map(match => attributes(match[0]))
}

const files = await walk(distDir)
const failures = []

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
  const keywordText = keywords[0]?.content || ''
  const required = [
    ['low-code', /(低代码|low-code)/i],
    ['AI', /(^|[^a-z])AI([^a-z]|$)|人工智能/i],
    ['V8', /V8/i]
  ]

  if (!title) failures.push(`${name}: missing title`)
  if (descriptions.length !== 1 || descriptions[0].content.length < 35) failures.push(`${name}: invalid or duplicate description`)
  if (keywords.length !== 1) failures.push(`${name}: missing or duplicate keywords`)
  for (const [label, pattern] of required) {
    if (!pattern.test(keywordText)) failures.push(`${name}: keywords missing ${label}`)
    if (!pattern.test(descriptions[0]?.content || '')) failures.push(`${name}: description missing ${label}`)
  }
  if (canonical.length !== 1 || !canonical[0].href?.startsWith('https://www.microi.net/')) failures.push(`${name}: invalid or duplicate canonical`)
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (getMeta('property', property).length !== 1) failures.push(`${name}: missing or duplicate ${property}`)
  }
  if (!/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)) failures.push(`${name}: missing JSON-LD`)
}

if (failures.length) {
  console.error(`SEO audit failed with ${failures.length} issue(s):`)
  for (const failure of failures.slice(0, 80)) console.error(`- ${failure}`)
  if (failures.length > 80) console.error(`- ... ${failures.length - 80} more`)
  process.exitCode = 1
} else {
  console.log(`SEO audit passed: ${files.length} HTML pages contain unique descriptions, page keywords, canonical URLs, Open Graph data and JSON-LD.`)
}
