const WIDGET_TYPES = Object.freeze([
  'workbench',
  'statistic',
  'progress',
  'links',
  'tabel',
  'bar',
  'line',
  'linebar',
  'pie',
  'funnel',
  'steps',
  'timeline',
  'collapse',
  'descriptions',
  'image',
  'video',
  'carousel',
  'aiengine',
  'pageengine'
])

const WIDGET_TYPE_SET = new Set(WIDGET_TYPES)
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const PAGE_COMPONENT_PATTERN = /(?:^|\/)(?:views\/)?page-engine\/(?:renderer|form-renderer)(?:\.vue)?$/i

export const SUPPORTED_PAGE_ENGINE_WIDGETS = WIDGET_TYPES

function cleanString(value, maxLength = 300) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, maxLength)
}

function safeDecode(value) {
  try { return decodeURIComponent(String(value || '')) } catch (error) { return String(value || '') }
}

function parseObject(value, fallback = {}) {
  let current = value
  for (let index = 0; index < 2; index += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) return current
    if (typeof current !== 'string' || !current.trim()) return fallback
    try { current = JSON.parse(current) } catch (error) { return fallback }
  }
  return current && typeof current === 'object' && !Array.isArray(current) ? current : fallback
}

function sanitizeValue(value, depth = 0) {
  if (depth > 6 || value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') return value.slice(0, 5000)
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined)
  }
  if (typeof value !== 'object') return undefined
  const result = {}
  Object.keys(value).slice(0, 120).forEach((key) => {
    if (FORBIDDEN_KEYS.has(key)) return
    const safeKey = cleanString(key, 100)
    if (!safeKey) return
    const normalized = sanitizeValue(value[key], depth + 1)
    if (normalized !== undefined) result[safeKey] = normalized
  })
  return result
}

function normalizeRoutePath(value) {
  const text = safeDecode(value).trim()
  if (!text || /^https?:\/\//i.test(text)) return ''
  const path = text.split('#')[0].split('?')[0].replace(/\/{2,}/g, '/')
  if (!path.startsWith('/') || path.includes('..')) return ''
  return path.slice(0, 500)
}

function queryValue(source, names) {
  const text = safeDecode(source)
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text
  const parts = query.split('&')
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  for (const part of parts) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = safeDecode(part.slice(0, separator)).toLowerCase()
    if (!wanted.has(key)) continue
    return cleanString(safeDecode(part.slice(separator + 1)), 100)
  }
  return ''
}

/**
 * Page Engine 页面只能从当前账号已经拿到的菜单对象进入。
 * 这里不接受任意 PageId，避免通过手改路由越过菜单授权。
 */
export function resolvePageEngineMenuReference(menu) {
  if (!menu || typeof menu !== 'object') return null
  const componentPath = cleanString(menu.ComponentPath || menu.componentPath, 500).split('?')[0]
    .replace(/^\/?src\//i, '').replace(/^\/?views\//i, 'views/')
  const url = cleanString(menu.Url || menu.url || menu.RoutePath || menu.routePath, 1000)
  const urlPath = normalizeRoutePath(url)
  const isRendererComponent = PAGE_COMPONENT_PATTERN.test(componentPath.replace(/^\//, '')) ||
    /page-engine\/(?:renderer|form-renderer)/i.test(componentPath)
  const isRendererUrl = /^\/mic\/renderer(?:-embed)?(?:\/|$)/i.test(urlPath)
  const explicitPageId = cleanString(
    menu.PageEngineId || menu.PageId || menu.DiyPageId || menu.pageEngineId || menu.pageId,
    100
  )
  const pathPageId = (urlPath.match(/^\/mic\/renderer(?:-embed)?\/([^/?#]+)/i) || [])[1] || ''
  const pageId = explicitPageId || cleanString(safeDecode(pathPageId), 100) ||
    queryValue(menu.UrlParam || '', ['Id', 'PageId']) || queryValue(url, ['Id', 'PageId']) ||
    queryValue(menu.ComponentPath || '', ['Id', 'PageId'])
  if (!isRendererComponent && !isRendererUrl && !explicitPageId) return null
  const routePath = isRendererUrl ? '' : urlPath
  if (!pageId && !routePath) return null
  return {
    menuId: cleanString(menu.Id, 100),
    pageId,
    routePath,
    title: cleanString(menu.Name || menu.Title, 160) || '界面页面'
  }
}

function safeParamValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean' || typeof value === 'number') return value
  return cleanString(value, 500)
}

/** 只接受包内约定的 ApiEngine 相对地址，不接受远程域名和任意 URL。 */
export function parsePageEngineDataSource(value) {
  const source = cleanString(value, 1200).replace(/--OsClient--.*$/i, '')
  const matched = source.match(/^(?:\$ApiBase\$)?\/apiengine\/([A-Za-z0-9_-]{1,100})(?:\?([^#]*))?$/i)
  if (!matched) return null
  const params = {}
  String(matched[2] || '').split('&').slice(0, 30).forEach((part) => {
    if (!part) return
    const separator = part.indexOf('=')
    const rawKey = separator < 0 ? part : part.slice(0, separator)
    const key = safeDecode(rawKey)
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key) || FORBIDDEN_KEYS.has(key)) return
    const rawValue = separator < 0 ? '' : part.slice(separator + 1)
    params[key] = safeParamValue(safeDecode(rawValue.replace(/\+/g, ' ')))
  })
  return { apiEngineKey: matched[1], params }
}

function paramAt(widget, sort) {
  const params = Array.isArray(widget && widget.widgetParams) ? widget.widgetParams : []
  return params.find((item) => Number(item && item.sort) === Number(sort)) || params[sort] || null
}

function normalizeFilter(item) {
  if (!item || typeof item !== 'object') return null
  const prop = cleanString(item.prop || item.Prop || item.name || item.Name, 100)
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(prop) || FORBIDDEN_KEYS.has(prop)) return null
  const type = ['input', 'select', 'date', 'daterange'].includes(String(item.type || '').toLowerCase())
    ? String(item.type).toLowerCase()
    : 'input'
  const options = (Array.isArray(item.options) ? item.options : []).slice(0, 50).map((option) => ({
    label: cleanString(option && (option.label ?? option.Label ?? option.value ?? option.Value), 100),
    value: safeParamValue(option && (option.value ?? option.Value ?? option.label ?? option.Label))
  })).filter((option) => option.label)
  return {
    prop,
    label: cleanString(item.label || item.Label || prop, 100),
    type,
    value: safeParamValue(item.value ?? item.Value ?? item.defaultValue ?? item.DefaultValue),
    defaultValue: safeParamValue(item.defaultValue ?? item.DefaultValue ?? item.value ?? item.Value),
    options
  }
}

function dataFromParam(param) {
  if (!param || typeof param !== 'object') return {}
  const options = parseObject(param.typeOptions, {})
  return sanitizeValue(options.dataJson === undefined ? {} : options.dataJson) || {}
}

function pageIdFromWidget(widget) {
  const param = paramAt(widget, 0)
  const candidate = param && (param.value ?? param.Value)
  if (candidate && typeof candidate === 'object') {
    return cleanString(candidate.Id || candidate.id || candidate.PageId || candidate.pageId, 100)
  }
  return cleanString(candidate, 100)
}

function normalizeWidget(widget, wrapperKey, index, filters, warnings) {
  if (!widget || widget.show === 0 || widget.show === '0' || widget.hidden === true) return null
  const originalType = cleanString(widget.type || widget.Type, 50).toLowerCase()
  const supported = WIDGET_TYPE_SET.has(originalType)
  const param = paramAt(widget, 0)
  const source = parsePageEngineDataSource(param && (param.value ?? param.Value))
  const data = dataFromParam(param)
  const searchData = Array.isArray(data && data.searchData) ? data.searchData : []
  searchData.map(normalizeFilter).filter(Boolean).forEach((filter) => {
    if (!filters.has(filter.prop)) filters.set(filter.prop, filter)
  })
  const option = parseObject(widget.widgetOption, {})
  const key = cleanString(option.number || widget.number || `${wrapperKey}:${index}`, 100)
  if (!supported) warnings.push(`暂不支持组件：${originalType || 'unknown'}`)
  return {
    key,
    type: supported ? originalType : 'unsupported',
    originalType: supported ? '' : originalType,
    label: cleanString(widget.label || widget.Label, 120) || (supported ? '数据组件' : '暂不支持的组件'),
    span: 24,
    data,
    dataSource: source,
    pageId: originalType === 'pageengine' ? pageIdFromWidget(widget) : '',
    mediaUrl: ['image', 'video'].includes(originalType)
      ? cleanString(param && (param.value ?? param.Value), 1000)
      : '',
    options: sanitizeValue({
      progressWidth: paramAt(widget, 6)?.value,
      controls: paramAt(widget, 1)?.value,
      autoplay: paramAt(widget, 2)?.value,
      loop: paramAt(widget, 3)?.value,
      muted: paramAt(widget, 4)?.value
    }) || {}
  }
}

function normalizeWrapper(wrapper, index, filters, warnings) {
  if (!wrapper || wrapper.hidden === true || wrapper.hidden === 1 || wrapper.hidden === '1') return null
  const type = String(wrapper.type || '').toLowerCase() === 'tabs' ? 'tabs' : 'pannel'
  const option = parseObject(wrapper.wrapperOption, {})
  const key = cleanString(option.number || `wrapper:${index}`, 100)
  const titleOption = parseObject(option.titleOption, {})
  const title = titleOption.hidden === true || titleOption.hidden === 1 || titleOption.hidden === '1'
    ? ''
    : cleanString(titleOption.title || wrapper.label, 160)
  const normalizeWidgets = (items) => (Array.isArray(items) ? items : []).slice(0, 80)
    .map((widget, widgetIndex) => normalizeWidget(widget, key, widgetIndex, filters, warnings))
    .filter(Boolean)
  if (type === 'tabs') {
    const tabs = (Array.isArray(option.tabs) ? option.tabs : []).slice(0, 12).map((tab, tabIndex) => {
      const tabKey = cleanString(tab && (tab.key || tab.Key), 100) || `tab:${tabIndex}`
      const widgetMap = parseObject(wrapper.tabWidgetMap, {})
      return {
        key: tabKey,
        label: cleanString(tab && (tab.label || tab.Label), 100) || `标签 ${tabIndex + 1}`,
        widgets: normalizeWidgets(widgetMap[tabKey])
      }
    })
    return { key, type, title, span: 24, tabs, activeTab: cleanString(option.activeTab, 100) || tabs[0]?.key || '' }
  }
  return { key, type, title, span: 24, widgets: normalizeWidgets(wrapper.widgetList) }
}

export function compilePageEngineRecord(record) {
  const source = record && typeof record === 'object' ? record : {}
  const json = parseObject(source.JsonObj === undefined ? source : source.JsonObj, {})
  const formConfig = parseObject(json.formConfig, {})
  const filters = new Map()
  const warnings = []
  const wrappers = (Array.isArray(json.wrapperList) ? json.wrapperList : []).slice(0, 60)
    .map((wrapper, index) => normalizeWrapper(wrapper, index, filters, warnings))
    .filter(Boolean)
  const allWidgets = wrappers.flatMap((wrapper) => wrapper.type === 'tabs'
    ? wrapper.tabs.flatMap((tab) => tab.widgets)
    : wrapper.widgets)
  return {
    page: {
      id: cleanString(source.Id, 100),
      title: cleanString(source.Title || source.Name || formConfig.title, 160) || '界面页面',
      number: cleanString(source.Number, 100),
      description: cleanString(source.Desc || source.Description, 500)
    },
    config: {
      dark: formConfig.dark === true || formConfig.dark === 1 || formConfig.dark === '1',
      autoRefresh: Math.min(300, Math.max(0, Number(formConfig.autoRefresh || 0) || 0)),
      mobile: true,
      singleScroll: true
    },
    filters: [...filters.values()],
    wrappers,
    warnings: [...new Set(warnings)],
    stats: {
      wrapperCount: wrappers.length,
      widgetCount: allWidgets.length,
      supportedWidgetCount: allWidgets.filter((widget) => widget.type !== 'unsupported').length
    }
  }
}

export function pageEngineWidgets(manifest) {
  return (manifest && Array.isArray(manifest.wrappers) ? manifest.wrappers : []).flatMap((wrapper) =>
    wrapper.type === 'tabs' ? wrapper.tabs.flatMap((tab) => tab.widgets || []) : (wrapper.widgets || [])
  )
}

export function pageEngineFilterValues(manifest) {
  const result = {}
  ;(manifest && Array.isArray(manifest.filters) ? manifest.filters : []).forEach((filter) => {
    result[filter.prop] = filter.value
  })
  return result
}

export default {
  SUPPORTED_PAGE_ENGINE_WIDGETS,
  resolvePageEngineMenuReference,
  parsePageEngineDataSource,
  compilePageEngineRecord,
  pageEngineWidgets,
  pageEngineFilterValues
}
