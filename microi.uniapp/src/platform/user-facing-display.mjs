const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i

function fieldConfig(field = {}) {
  if (field.config && typeof field.config === 'object') return field.config
  if (!field.Config) return {}
  if (typeof field.Config === 'object') return field.Config
  try { return JSON.parse(field.Config) || {} } catch (error) { return {} }
}

function firstText(source, keys) {
  for (const key of keys) {
    const value = source && source[key]
    if (value === null || value === undefined) continue
    const text = String(value).replace(/<[^>]+>/g, '').trim()
    if (text) return text.slice(0, 12)
  }
  return ''
}

export function isTechnicalIdentifier(value) {
  const text = String(value ?? '').trim()
  return UUID_PATTERN.test(text) || OBJECT_ID_PATTERN.test(text)
}

export function fieldEmptyText(field = {}) {
  const component = String(field.component || field.Component || '')
  if (component === 'FileUpload') return '暂无附件'
  if (component === 'ImgUpload') return '暂无图片'
  return '暂无'
}

export function fieldDisplayUnit(field = {}, context = {}) {
  const config = fieldConfig(field)
  const configured = firstText(field, ['Suffix', 'suffix', 'Unit', 'unit', 'DisplayUnit', 'displayUnit']) ||
    firstText(config, ['Suffix', 'suffix', 'Unit', 'unit', 'InputUnit', 'inputUnit', 'RightText', 'rightText', 'AddonAfter', 'addonAfter', 'Append', 'append', 'AfterText', 'afterText'])
  if (configured) return configured

  const label = String(field.Label || field.label || '').trim()
  if (/天数$/.test(label)) return '天'
  if (/小时数$/.test(label)) return '小时'
  if (/分钟数$/.test(label)) return '分钟'
  if (/秒数$/.test(label)) return '秒'

  const moduleTitle = String(context.moduleTitle || context.title || '').trim()
  if (/(请假|休假|假期)/.test(moduleTitle) && /时长$/.test(label)) return '天'
  return ''
}

export function appendFieldDisplayUnit(value, field = {}, context = {}) {
  const text = String(value ?? '').trim()
  if (!text || text === fieldEmptyText(field) || text === '信息未解析') return text
  const unit = fieldDisplayUnit(field, context)
  if (!unit || !/^-?(?:\d+|\d*\.\d+)$/.test(text) || text.endsWith(unit)) return text
  return unit === '%' ? `${text}${unit}` : `${text} ${unit}`
}

export function userFacingFallback(value) {
  if (value === null || value === undefined || value === '') return '暂无'
  if (isTechnicalIdentifier(value)) return '信息未解析'
  return String(value)
}

export default {
  isTechnicalIdentifier,
  fieldEmptyText,
  fieldDisplayUnit,
  appendFieldDisplayUnit,
  userFacingFallback
}
