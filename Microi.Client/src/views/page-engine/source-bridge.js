const SOURCE_VERSION = 1
const SOURCE_BEGIN = '/* @microi-page-schema:begin */'
const SOURCE_END = '/* @microi-page-schema:end */'
const HASH_PREFIX = '// @microi-page-schema-sha256:'
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const MAX_SCHEMA_BYTES = 5 * 1024 * 1024
const MAX_DEPTH = 80
const MAX_NODES = 120000
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

const byteLength = (text) => new TextEncoder().encode(String(text || '')).byteLength

const normalizeValue = (value, state, depth = 0) => {
  if (depth > MAX_DEPTH) throw new Error(`界面结构嵌套不能超过 ${MAX_DEPTH} 层`)
  state.nodes += 1
  if (state.nodes > MAX_NODES) throw new Error(`界面结构节点不能超过 ${MAX_NODES} 个`)
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('界面结构包含非有限数字')
    return value
  }
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item, state, depth + 1))
  if (!value || typeof value !== 'object') throw new Error('界面结构只允许 JSON 数据')
  const result = Object.create(null)
  for (const key of Object.keys(value).sort()) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`界面结构包含禁止字段：${key}`)
    result[key] = normalizeValue(value[key], state, depth + 1)
  }
  return result
}

export const normalizePageSourceSnapshot = (page) => {
  const normalized = normalizeValue(page, { nodes: 0 })
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error('界面源码缺少页面对象')
  }
  if (!normalized.JsonObj || typeof normalized.JsonObj !== 'object' || Array.isArray(normalized.JsonObj)) {
    throw new Error('界面源码缺少有效的 JsonObj')
  }
  if (!normalized.JsonObj.formConfig || typeof normalized.JsonObj.formConfig !== 'object' || Array.isArray(normalized.JsonObj.formConfig)) {
    normalized.JsonObj.formConfig = Object.create(null)
  }
  if (!Array.isArray(normalized.JsonObj.wrapperList)) normalized.JsonObj.wrapperList = []
  const canonical = JSON.stringify(normalized)
  if (byteLength(canonical) > MAX_SCHEMA_BYTES) throw new Error('界面源码中的页面结构不能超过 5MB')
  return normalized
}

export const canonicalPageSourceJson = (page) => JSON.stringify(normalizePageSourceSnapshot(page))

export const sha256Hex = async (text) => {
  if (!globalThis.crypto?.subtle) throw new Error('当前浏览器不支持安全哈希，无法使用界面源码桥接')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '')))
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('')
}

const sourceSafeJson = (page) => JSON.stringify(normalizePageSourceSnapshot(page), null, 2)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')

const safeFilePart = (value) => String(value || 'page')
  .trim()
  .replace(/[\\/:*?"<>|\s]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'page'

export const buildPageVueSource = async (page) => {
  const normalized = normalizePageSourceSnapshot(page)
  const canonical = JSON.stringify(normalized)
  const hash = await sha256Hex(canonical)
  const pretty = sourceSafeJson(normalized)
  const source = `<template>\n  <MicroiPageRenderer\n    :remote-obj="page"\n    :components="newComponents"\n    :widgets="newWidgets"\n  />\n</template>\n\n<script setup>\nimport { formRenderer as MicroiPageRenderer } from '@/views/page-engine/index.js'\nimport { newComponents, newWidgets } from '@/utils/extendedWidget'\n\n// Microi吾码界面源码桥接 v${SOURCE_VERSION}。编辑 page 对象后可安全导回设计器；导入过程不会执行本文件中的代码。\nconst page = Object.freeze(\n${SOURCE_BEGIN}\n${pretty}\n${SOURCE_END}\n)\n\n${HASH_PREFIX}${hash}\n</script>\n`
  if (byteLength(source) > MAX_SOURCE_BYTES) throw new Error('生成的 Vue 源码不能超过 8MB')
  return {
    source,
    hash,
    fileName: `${safeFilePart(normalized.Number || normalized.Title || normalized.Name)}.microi-page.vue`,
    schemaVersion: SOURCE_VERSION,
  }
}

const extractHash = (source) => {
  const line = String(source || '').split(/\r?\n/).find((item) => item.trim().startsWith(HASH_PREFIX))
  const value = line ? line.trim().slice(HASH_PREFIX.length).trim().toLowerCase() : ''
  return /^[0-9a-f]{64}$/.test(value) ? value : ''
}

export const parsePageVueSource = async (source) => {
  const text = String(source || '')
  if (!text.trim()) throw new Error('Vue 源码不能为空')
  if (byteLength(text) > MAX_SOURCE_BYTES) throw new Error('Vue 源码不能超过 8MB')
  const begin = text.indexOf(SOURCE_BEGIN)
  const end = text.lastIndexOf(SOURCE_END)
  if (begin < 0 || end <= begin) throw new Error('这不是 Microi吾码界面源码桥接文件，或页面结构标记已损坏')
  const raw = text.slice(begin + SOURCE_BEGIN.length, end).trim()
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`页面结构不是有效 JSON：${error?.message || '解析失败'}`)
  }
  const page = normalizePageSourceSnapshot(parsed)
  const currentHash = await sha256Hex(JSON.stringify(page))
  const declaredHash = extractHash(text)
  if (!declaredHash) throw new Error('界面源码缺少有效的 SHA-256 来源摘要')
  return {
    page,
    currentHash,
    declaredHash,
    sourceChanged: currentHash !== declaredHash,
    schemaVersion: SOURCE_VERSION,
  }
}

export const PageSourceBridge = {
  build: buildPageVueSource,
  parse: parsePageVueSource,
  normalize: normalizePageSourceSnapshot,
}

export default PageSourceBridge
