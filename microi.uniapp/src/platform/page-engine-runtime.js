import { getUser, V8 } from '@/utils/request.js'
import { findMenu } from '@/platform/business-runtime.js'
import {
  compilePageEngineRecord,
  pageEngineFilterValues,
  pageEngineWidgets,
  resolvePageEngineMenuReference
} from '@/platform/page-engine-core.mjs'

const MAX_EMBED_DEPTH = 2

function userIdentity() {
  const user = getUser() || {}
  return String(user.Id || user.Account || 'guest')
}

function unwrapResponse(response) {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    if (Object.prototype.hasOwnProperty.call(response, 'Code')) {
      if (Number(response.Code) !== 1) throw new Error(response.Msg || '界面数据加载失败')
      return unwrapResponse(response.Data)
    }
    if (response.Result && Object.prototype.hasOwnProperty.call(response.Result, 'Code')) {
      return unwrapResponse(response.Result)
    }
  }
  return response
}

function normalizedWidgetData(type, payload, fallback) {
  const current = fallback && typeof fallback === 'object' ? fallback : {}
  const value = unwrapResponse(payload)
  if (value === undefined || value === null) return current
  if (['statistic', 'pie', 'funnel', 'progress'].includes(type)) {
    if (Array.isArray(value)) return { ...current, data: value }
    if (value && typeof value === 'object') {
      return {
        ...current,
        ...value,
        data: Array.isArray(value.data) ? value.data : []
      }
    }
    return current
  }
  if (['bar', 'line', 'linebar'].includes(type)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return current
    return {
      ...current,
      ...value,
      xAxis: Array.isArray(value.xAxis) ? value.xAxis : (current.xAxis || []),
      series: Array.isArray(value.series) ? value.series : (current.series || [])
    }
  }
  if (type === 'tabel') {
    if (Array.isArray(value)) return { ...current, bodyData: value, total: value.length }
    if (!value || typeof value !== 'object') return current
    return {
      ...current,
      ...value,
      headerData: Array.isArray(value.headerData) ? value.headerData : (current.headerData || []),
      bodyData: Array.isArray(value.bodyData) ? value.bodyData : [],
      total: Number.isFinite(Number(value.total)) ? Number(value.total) : Number(value.bodyData?.length || 0)
    }
  }
  return value
}

function pageWhere(reference) {
  if (reference.pageId) return [{ Name: 'Id', Value: reference.pageId, Type: '=' }]
  return [{ Name: 'RoutePath', Value: reference.routePath, Type: '=' }]
}

async function loadPageRecord(reference, menu) {
  const response = await V8.FormEngine.Request('getformdata', 'mic_page', {
    _Where: pageWhere(reference),
    _SelectFields: ['Id', 'Title', 'Number', 'Desc', 'JsonObj', 'RoutePath', 'UpdateTime'],
    _SysMenuId: menu.Id
  }, { checkCode: false })
  if (!response || Number(response.Code) !== 1 || !response.Data) {
    throw new Error((response && response.Msg) || '界面页面不存在或当前账号无权访问')
  }
  return response.Data
}

function requestParams(widget, filters, menu) {
  const result = {
    ...(widget.dataSource?.params || {}),
    ...(filters || {})
  }
  if (menu && menu.Id) result._SysMenuId = menu.Id
  return result
}

async function hydrateWidget(widget, context) {
  widget.loading = true
  widget.error = ''
  try {
    if (widget.dataSource) {
      // 界面组件只走当前平台稳定 ApiEngine 路由。失败时不再兼容重试，避免一个
      // 只读页面把同一接口执行两次，也不允许数据源把完整 URL 交给请求层。
      const response = await V8.ApiEngine.Run(widget.dataSource.apiEngineKey,
        requestParams(widget, context.filters, context.menu), { checkCode: false })
      widget.data = normalizedWidgetData(widget.type, response, widget.data)
    }
    if (widget.type === 'pageengine' && widget.pageId) {
      if (context.depth >= MAX_EMBED_DEPTH) {
        widget.error = '嵌套页面已达到移动端深度上限'
        return
      }
      if (context.visited.has(widget.pageId)) {
        widget.error = '检测到循环嵌套页面'
        return
      }
      const childRecord = await loadPageRecord({ pageId: widget.pageId, routePath: '' }, context.menu)
      const child = compilePageEngineRecord(childRecord)
      const visited = new Set(context.visited)
      visited.add(widget.pageId)
      await hydrateManifest(child, {
        ...context,
        depth: context.depth + 1,
        visited,
        filters: pageEngineFilterValues(child)
      })
      widget.child = child
    }
  } catch (error) {
    widget.error = error && (error.message || error.Msg) || '组件数据加载失败'
  } finally {
    widget.loading = false
  }
}

async function hydrateManifest(manifest, context) {
  const widgets = pageEngineWidgets(manifest)
  let cursor = 0
  const worker = async () => {
    while (cursor < widgets.length) {
      const widget = widgets[cursor++]
      await hydrateWidget(widget, context)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, widgets.length)) }, worker))
  manifest.loadedAt = Date.now()
  return manifest
}

export async function loadAuthorizedPageEngine(menuId, options = {}) {
  const menu = await findMenu([], '', options.refresh === true, menuId)
  if (!menu) throw new Error('界面页面菜单不存在或当前账号无权访问')
  if (Number(menu.Display ?? 1) === 0 || Number(menu.AppDisplay ?? 1) === 0) {
    throw new Error('当前界面页面未开放移动端访问')
  }
  const reference = resolvePageEngineMenuReference(menu)
  if (!reference) throw new Error('该菜单不是可用的界面引擎页面')
  const record = await loadPageRecord(reference, menu)
  const manifest = compilePageEngineRecord(record)
  manifest.authorization = {
    menuId: String(menu.Id || ''),
    identity: userIdentity()
  }
  await hydrateManifest(manifest, {
    menu,
    depth: 0,
    visited: new Set([manifest.page.id].filter(Boolean)),
    filters: pageEngineFilterValues(manifest)
  })
  return { menu, reference, manifest }
}

export async function refreshPageEngineData(manifest, menu, filters = {}) {
  if (!manifest || !menu || String(manifest.authorization?.menuId || '') !== String(menu.Id || '')) {
    throw new Error('界面页面授权上下文已失效，请重新进入')
  }
  return hydrateManifest(manifest, {
    menu,
    depth: 0,
    visited: new Set([manifest.page?.id].filter(Boolean)),
    filters
  })
}

export default {
  loadAuthorizedPageEngine,
  refreshPageEngineData
}
