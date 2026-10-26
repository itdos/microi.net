import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { readableDocument } from '../scripts/seo-readable.mjs'
import { trainingBenefitNote, trainingWhyNote } from '../docs/.vitepress/theme/common-training-content.js'

const componentPath = fileURLToPath(new URL('../docs/.vitepress/theme/components/TrainingSyllabusDeck.vue', import.meta.url))
const modules = new Map()
// 编译真实组件及子组件，不从脚本字符串模拟讲义。仅注入站点主题；SSR 不执行挂载或下载。
function componentModule(filename) {
  if (modules.has(filename)) return modules.get(filename)
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  let compiled = compileScript(descriptor, { id: filename, inlineTemplate: true, templateOptions: { ssr: true } }).content
  compiled = compiled.replace(/^import\s+['"][^'"]+\.scss['"];?\s*$/gm, '')
    .replace(/from\s+['"]([^'"]+)['"]/g, (_, name) => {
      let url
      if (name === 'vitepress') {
        const source = `import {ref} from ${JSON.stringify(import.meta.resolve('vue'))}; export const useData=()=>({isDark:ref(false)});`
        url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
      } else if (name.endsWith('.vue')) url = componentModule(resolve(dirname(filename), name))
      else url = name.startsWith('.') ? pathToFileURL(resolve(dirname(filename), name)).href : import.meta.resolve(name)
      return `from ${JSON.stringify(url)}`
    })
  const javascript = ts.transpileModule(compiled, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const url = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
  modules.set(filename, url)
  return url
}

const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
function elements(node, predicate) {
  return [...(node?.type === 1 && predicate(node) ? [node] : []), ...(node?.children || []).flatMap(child => elements(child, predicate))]
}
const textOf = node => node.type === 2 ? node.content : (node.children || []).map(textOf).join('')
let rendered
async function renderDeck() {
  rendered ??= import(componentModule(componentPath)).then(({ default: component }) => renderToString(createSSRApp(component)))
  return rendered
}

test('真实培训 SSR 的可展开讲义包含全部课程，AI 正文保留每页标题和引擎要点', async t => {
  const html = await renderDeck()
  const { descriptor, errors } = parse(`<template>${html}</template>`)
  assert.deepEqual(errors, [])
  const root = descriptor.template.ast
  const transcript = elements(root, node => attribute(node, 'id') === 'mci-training-transcript')[0]
  assert.ok(transcript, '缺少可展开的课程文字讲义，非当前幻灯的 aria-hidden 会导致 AI 只能读取封面')
  assert.equal(transcript.tag, 'details')
  assert.equal(attribute(transcript, 'aria-hidden'), undefined)
  assert.equal(attribute(transcript, 'hidden'), undefined)
  assert.ok(elements(transcript, node => node.tag === 'summary').length)
  const lessons = elements(transcript, node => attribute(node, 'data-training-lesson') !== undefined)
  const technical = lessons.filter(node => attribute(node, 'data-training-course') === 'technical')
  const enterprise = lessons.filter(node => attribute(node, 'data-training-course') === 'enterprise')
  assert.equal(technical.length, 47)
  assert.equal(enterprise.length, 10)
  assert.equal(new Set(lessons.map(node => attribute(node, 'id'))).size, lessons.length, '章节锚点不能重复')
  const readable = readableDocument(`<div class="vp-doc">${html}</div>`, 'https://microi.net/doc/about/microi-training-syllabus.html')
  assert.ok(readable.includes(trainingWhyNote), '技术预览和适用范围限定必须与引擎能力一起被读取')
  assert.ok(readable.includes(trainingBenefitNote), '实际收益边界必须与核心优势一起被读取')
  t.diagnostic(`SSR 可读正文 ${Buffer.byteLength(readable)} bytes；技术架构 47 页、企业 10 页`)
  for (const lesson of lessons) {
    const title = elements(lesson, node => node.tag === 'h3')[0]
    const paragraphs = elements(lesson, node => node.tag === 'p')
    assert.ok(title && textOf(title).trim(), '课程标题不能为空')
    assert.ok(paragraphs.some(node => textOf(node).trim()), '课程正文不能为空')
    assert.ok(readable.includes(textOf(title).trim()), `AI 正文漏掉标题 ${textOf(title)}`)
    for (const paragraph of paragraphs) assert.ok(readable.includes(textOf(paragraph).trim()), `AI 正文漏掉课程段落 ${attribute(lesson, 'id')}`)
  }
  // 演示页是验收基线；讲义必须逐项保留 38 个引擎的标题、摘要、要点与步骤，不能只补一个目录。
  const slides = elements(root, node => (attribute(node, 'class') || '').split(' ').includes('mci-training-slide'))
  assert.equal(slides.length, 47)
  for (const slide of slides) {
    const id = attribute(slide, 'id').replace('mci-training-', '')
    const lesson = technical.find(node => attribute(node, 'data-training-lesson') === id)
    assert.ok(lesson, `讲义遗漏幻灯 ${id}`)
    const label = attribute(slide, 'aria-label').split('，').slice(1).join('，')
    assert.ok(textOf(lesson).includes(label), `讲义与幻灯标题不同 ${id}`)
    if (!(attribute(slide, 'class') || '').includes('is-kind-engine')) continue
    const engine = readableDocument(`<div class="vp-doc">${slide.loc.source.replace(/ aria-hidden="true"| inert(?:="[^"]*")?/g, '')}</div>`, 'https://microi.net/doc/about/microi-training-syllabus.html')
    for (const block of elements(slide, node => ['strong', 'small', 'blockquote', 'li'].includes(node.tag))) {
      // 演示步骤的 i 只是页内序号，讲义使用原生 ol 提供顺序。
      const content = (block.tag === 'li' ? block.children.filter(child => child.tag !== 'i').map(textOf).join('') : textOf(block)).trim()
      if (content && engine.includes(content)) assert.ok(textOf(lesson).includes(content), `讲义遗漏引擎要点 ${id}: ${content}`)
    }
  }
})

test('讲义入口与原生折叠保留人类阅读路径，不向机器人单独展示正文', async () => {
  const html = await renderDeck()
  assert.ok(/href="#mci-training-transcript"[^>]*>文字讲义/.test(html), '演示工具栏应有正常可点击的文字讲义入口')
  const source = readFileSync(componentPath, 'utf8')
  assert.doesNotMatch(source, /navigator\.userAgent|googlebot|bingbot/i)
  assert.match(source, /closest\('\.mci-training-transcript'\)/, '讲义键盘阅读不能被幻灯全局方向键拦截')
})
