import appConfig from '@/config.js'

const EMPTY_UPLOAD_VALUES = new Set(['', 'null', 'undefined', '[]', '[ ]', '{}', '正在上传中...'])
const TECHNICAL_KEYS = new Set([
  'id', 'userid', 'tenantid', 'osclient', 'isdeleted', 'state', 'size',
  'createtime', 'updatetime', 'createuserid', 'updateuserid', 'path',
  'filepath', 'filepathname', 'fullpath', 'url', 'src'
])
const DISPLAY_KEYS = [
  'Label', 'label', 'Name', 'name', 'Value', 'value', 'Text', 'text', 'Title', 'title',
  'Xingming', 'Mingcheng', 'Biaoti', 'HangyeMC', 'KehuMC', 'ShangpinMC', 'TenantName',
  'DeptName', 'RoleName', 'NickName', 'RealName', 'UserName', 'Account'
]
const REGION_KEYS = [
  ['Province', 'province', 'Sheng'],
  ['City', 'city', 'Shi'],
  ['Area', 'area', 'District', 'district', 'Qu', 'County', 'county']
]

function firstValue(source, keys) {
  if (!source || typeof source !== 'object') return ''
  for (const key of keys.filter(Boolean)) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key]
    const actual = Object.keys(source).find((item) => item.toLowerCase() === String(key).toLowerCase())
    if (actual && source[actual] !== undefined && source[actual] !== null && source[actual] !== '') return source[actual]
  }
  return ''
}

export function parseStructuredValue(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || !((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}')))) return value
  try { return JSON.parse(text) } catch (error) { return value }
}

export function isHtmlValue(value) {
  return typeof value === 'string' && /<\/?(?:p|div|span|br|img|table|ul|ol|li|h[1-6]|strong|em|blockquote|section)\b[^>]*>/i.test(value)
}

export function richTextPlainText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hasRichTextContent(value) {
  return richTextPlainText(value).length > 0 || /<img\b[^>]*\bsrc=/i.test(String(value || ''))
}

export function publicAssetUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(https?:|data:|blob:|file:)/i.test(text) || /^\/?static\//i.test(text)) return text
  const base = String(appConfig.fileServer || '').replace(/\/+$/, '')
  return base ? `${base}/${text.replace(/^\/+/, '')}` : text
}

export function normalizeRichTextHtml(value) {
  let html = String(value || '')
  if (!html) return ''
  if (!isHtmlValue(html)) return html
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/<img([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>/gi, (match, before, quote, src, after) => {
      const attrs = `${before || ''}${after || ''}`.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
      return `<img${attrs} src="${publicAssetUrl(src)}" style="display:block;max-width:100%;width:auto;height:auto;margin:10px auto;" />`
    })
  return html
}

function looksLikeRegion(values) {
  return values.length >= 2 && values.length <= 4 && values.every((item) => {
    const text = String(item || '').trim()
    return text && (/[省市区县州盟旗]$/.test(text) || /^(北京|上海|天津|重庆|香港|澳门)$/.test(text))
  })
}

function objectRegion(value) {
  return REGION_KEYS.map((keys) => firstValue(value, keys)).filter(Boolean).map(String)
}

function dynamicDisplayKey(value) {
  const candidates = Object.keys(value || {}).filter((key) => !TECHNICAL_KEYS.has(key.toLowerCase()))
  const preferred = candidates.find((key) => /^(?:xingming|mingcheng|hangyemc|kehumc|shangpinmc)$/i.test(key.replace(/\s/g, '')))
  if (preferred) return preferred
  return candidates.find((key) => /(?:MC|Name|Label|Title|Mingcheng|Xingming|Biaoti|XM)$/i.test(key) && !/^UserName$/i.test(key)) || ''
}

export function objectDisplayValue(value, preferredKeys = []) {
  if (!value || typeof value !== 'object') return value === 0 ? '0' : String(value || '')
  const region = objectRegion(value)
  if (region.length >= 2) return region.join('')

  const explicit = firstValue(value, preferredKeys)
  if (explicit !== '') return formatStructuredValue(explicit, { empty: '' })

  const common = firstValue(value, DISPLAY_KEYS)
  const dynamicKey = dynamicDisplayKey(value)
  const dynamic = dynamicKey ? value[dynamicKey] : ''
  const selected = dynamic !== '' && !/^UserName$/i.test(dynamicKey) ? dynamic : common
  if (selected !== '' && typeof selected !== 'object') return richTextPlainText(selected) || String(selected)

  const path = firstValue(value, ['Path', 'FilePathName', 'FullPath', 'Url', 'url', 'src'])
  if (path) return String(firstValue(value, ['Name', 'FileName', 'name']) || String(path).split('/').pop() || '附件')

  const scalars = Object.keys(value).filter((key) => !TECHNICAL_KEYS.has(key.toLowerCase())).map((key) => value[key])
    .filter((item) => ['string', 'number', 'boolean'].includes(typeof item) && item !== '')
    .map((item) => richTextPlainText(item) || String(item)).filter(Boolean)
  return [...new Set(scalars)].slice(0, 3).join('、') || '已选择'
}

export function formatRegionValue(value) {
  const parsed = parseStructuredValue(value)
  if (Array.isArray(parsed)) return parsed.map((item) => objectDisplayValue(item)).filter(Boolean).join('')
  if (parsed && typeof parsed === 'object') {
    const region = objectRegion(parsed)
    return region.length ? region.join('') : objectDisplayValue(parsed)
  }
  return String(value || '').replace(/[\[\]"]/g, '').replace(/[,，]\s*/g, '')
}

export function formatStructuredValue(value, options = {}) {
  const empty = options.empty === undefined ? '-' : options.empty
  if (value === null || value === undefined || value === '') return empty
  if (isHtmlValue(value)) return richTextPlainText(value) || empty

  const parsed = parseStructuredValue(value)
  if (Array.isArray(parsed)) {
    if (!parsed.length) return empty
    const values = parsed.map((item) => item && typeof item === 'object'
      ? objectDisplayValue(item, options.preferredKeys || [])
      : richTextPlainText(item) || String(item || '')).filter(Boolean)
    if (!values.length) return empty
    return options.region || looksLikeRegion(values) ? values.join('') : [...new Set(values)].join('、')
  }
  if (parsed && typeof parsed === 'object') return objectDisplayValue(parsed, options.preferredKeys || []) || empty
  return String(value)
}

export function normalizeUploadItems(value) {
  if (value === null || value === undefined) return []
  if (typeof value === 'string' && EMPTY_UPLOAD_VALUES.has(value.trim().toLowerCase())) return []
  const parsed = parseStructuredValue(value)
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.map((item) => {
    if (!item) return null
    if (typeof item === 'string') return { Path: item, Name: item.split('/').pop() || item, State: 1 }
    if (typeof item !== 'object') return null
    const path = firstValue(item, ['Path', 'FilePathName', 'FilePath', 'FullPath', 'Url', 'url', 'src'])
    if (!path) return null
    return {
      ...item,
      Id: item.Id || item.id || '',
      Name: item.Name || item.FileName || item.name || String(path).split('/').pop() || '',
      Path: path,
      State: item.State === undefined || item.State === null ? 1 : item.State
    }
  }).filter(Boolean)
}

export default {
  parseStructuredValue,
  isHtmlValue,
  richTextPlainText,
  hasRichTextContent,
  normalizeRichTextHtml,
  publicAssetUrl,
  objectDisplayValue,
  formatRegionValue,
  formatStructuredValue,
  normalizeUploadItems
}
