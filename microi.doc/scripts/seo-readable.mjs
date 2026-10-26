import { createHash } from 'node:crypto'
import { parse } from 'vue/compiler-sfc'
import { SITE_URL, canonicalPath } from '../docs/.vitepress/config/seo-policy.mjs'

const skippedTags = new Set(['script', 'style', 'nav', 'aside', 'header', 'footer', 'button', 'svg', 'noscript', 'template', 'input', 'select'])
const blocks = new Set(['div', 'section', 'article', 'p', 'blockquote', 'details', 'summary', 'ul', 'ol', 'figure', 'figcaption'])
const attr = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
const classes = node => (attr(node, 'class') || '').split(/\s+/)

function publicUrl(value, canonical) {
  if (!value) return ''
  try {
    const url = new URL(value, canonical)
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return ''
    if (url.origin === SITE_URL) url.pathname = canonicalPath(url.pathname)
    return url.href
  } catch { return '' }
}

function hidden(node) {
  return node.props?.some(prop => prop.type === 6 && prop.name === 'hidden') ||
    attr(node, 'aria-hidden') === 'true' || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(attr(node, 'style') || '') ||
    classes(node).some(name => ['header-anchor', 'line-numbers-wrapper', 'copy'].includes(name))
}

export function readableDocument(html, canonical) {
  // 只遍历已发布 SSR 的正文 AST，不执行组件或读取原始 Markdown；注释、脚本与全站导航不能进入副本。
  // 历史正文可能包含未转义的 HTML 示例；取最外层最后一个 body 结束，避免被示例提前截断。
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] || html
  // 这里是已渲染 HTML，Docker/模板示例的双花括号不是 Vue 表达式。
  const parsed = parse(`<template>${body}</template>`, { templateParseOptions: { delimiters: ['\u0000MICROI_OPEN', '\u0000MICROI_CLOSE'] } })
  // Vue SSR 可能重复输出相同作用域属性；它不影响正文。其它解析错误必须阻断，避免默默丢失证据。
  const errors = parsed.errors.filter(error => error.code !== 2)
  if (errors.length) throw new Error(`Cannot extract readable document ${canonical}: ${errors[0].message || errors[0]}`)
  const roots = []
  const find = node => {
    if (node.type === 1 && classes(node).includes('vp-doc')) { roots.push(node); return }
    for (const child of node.children || []) find(child)
  }
  if (parsed.descriptor.template?.ast) find(parsed.descriptor.template.ast)
  if (roots.length !== 1) throw new Error(`Expected one published document body for ${canonical}, found ${roots.length}`)
  const codeBlocks = []
  const render = (node, pre = false) => {
    if (node.type === 2) return node.content
    // SSR 代码示例中的 {{...}} 是文字，不能当 Vue 表达式执行或丢弃。
    if (node.type === 5) return node.loc.source
    if (node.type !== 1 || skippedTags.has(node.tag) || hidden(node)) return ''
    const content = node.children.map(child => render(child, pre || node.tag === 'pre')).join('')
    if (node.tag === 'pre') {
      const fence = '`'.repeat(Math.max(3, ...[...content.matchAll(/`+/g)].map(match => match[0].length + 1)))
      // 段落空白归一不能改变代码的缩进、空行或字面量；先隔离代码，再按原文放回。
      codeBlocks.push(`${fence}\n${content}${content.endsWith('\n') ? '' : '\n'}${fence}`)
      return `\n\n\u0000MICROI_PRE_${codeBlocks.length - 1}\u0000\n\n`
    }
    if (pre) return content
    if (/^h[1-6]$/.test(node.tag)) return `\n\n${'#'.repeat(Number(node.tag[1]))} ${content.trim()}\n\n`
    if (node.tag === 'a') {
      const href = publicUrl(attr(node, 'href'), canonical)
      return href && content.trim() ? `${content.trim()} (${href})` : content
    }
    if (node.tag === 'img') {
      const alt = attr(node, 'alt')?.trim()
      const src = publicUrl(attr(node, 'src'), canonical)
      return alt ? `\n[${alt}${src ? `: ${src}` : ''}]\n` : ''
    }
    if (node.tag === 'br') return '\n'
    if (node.tag === 'hr') return '\n\n---\n\n'
    if (node.tag === 'li') return `\n- ${content.trim()}\n`
    if (node.tag === 'tr') return `\n${content.trim()}\n`
    if (['td', 'th'].includes(node.tag)) return `${content.replace(/\s+/g, ' ').trim()}\t|\t`
    return blocks.has(node.tag) || node.tag === 'table' ? `\n\n${content.trim()}\n\n` : content
  }
  const text = render(roots[0]).replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    .replace(/\u0000MICROI_PRE_(\d+)\u0000/g, (_, index) => codeBlocks[Number(index)])
  if (!text) throw new Error(`Empty published document body for ${canonical}`)
  return text
}

export function readableAsset({ html, canonical, title, description, revision, textUrl }) {
  const body = readableDocument(html, canonical)
  const text = [`Title: ${title}`, `Canonical: ${canonical}`, ...(revision ? [`Page-Modified: ${revision}`] : []),
    'Source: published HTML document body; page revision is not a capability verification date.', '', body, ''].join('\n')
  const bytes = Buffer.from(text, 'utf8')
  return { text, metadata: { canonical, textUrl, title, description, language: new URL(canonical).pathname.startsWith('/en/') ? 'en-US' : 'zh-CN',
    ...(revision ? { dateModified: revision } : {}), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
}
