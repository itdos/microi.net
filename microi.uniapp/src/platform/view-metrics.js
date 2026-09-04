import { callApiEngine } from '@/platform/business-runtime.js'
import { resolveMetricParams } from '@/platform/view-schema-core.mjs'

function readPath(source, path) {
  if (!path) return source
  return String(path).split('.').filter(Boolean).reduce((value, key) => {
    if (value === undefined || value === null) return undefined
    return value[key]
  }, source)
}

function firstMetricValue(source) {
  if (source === undefined || source === null) return undefined
  if (['string', 'number', 'boolean'].includes(typeof source)) return source
  if (Array.isArray(source)) return source.length
  if (typeof source !== 'object') return undefined
  const fields = ['Value', 'value', 'Count', 'count', 'Total', 'total', 'DataCount', 'dataCount']
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null) return source[field]
  }
  return undefined
}

function metricResponseValue(response, valueField, valuePath, metricKey = '') {
  if (valuePath) {
    const fromPath = readPath(response, valuePath)
    if (fromPath !== undefined) return fromPath
  }
  if (valueField) {
    const fromData = readPath(response && response.Data, valueField)
    if (fromData !== undefined) return fromData
    const fromResponse = readPath(response, valueField)
    if (fromResponse !== undefined) return fromResponse
  }
  if (metricKey) {
    const fromMetricMap = readPath(response, `Data.Metrics.${metricKey}`)
    if (fromMetricMap !== undefined) return fromMetricMap
  }
  const fromData = firstMetricValue(response && response.Data)
  if (fromData !== undefined) return fromData
  const direct = firstMetricValue(response)
  return direct === undefined ? '-' : direct
}

export async function loadViewMetricValues(metrics = [], context = {}, options = {}) {
  const remoteMetrics = (Array.isArray(metrics) ? metrics : []).filter((metric) => {
    return String(metric.source || metric.Source || '').toLowerCase() === 'apiengine' &&
      (metric.apiEngineKey || metric.ApiEngineKey)
  })
  if (!remoteMetrics.length) return {}

  const values = {}
  let cursor = 0
  const concurrency = Math.max(1, Math.min(3, Number(options.concurrency || 3)))
  const worker = async () => {
    while (cursor < remoteMetrics.length) {
      const metric = remoteMetrics[cursor++]
      const key = metric.key || metric.Key || metric.apiEngineKey || metric.ApiEngineKey
      try {
        const params = {
          Id: context.form && context.form.Id,
          ...resolveMetricParams(metric, context)
        }
        const menuId = context.menu && context.menu.Id
        if (menuId) params._SysMenuId = menuId
        Object.keys(params).forEach((name) => {
          if (params[name] === undefined) delete params[name]
        })
        const response = await callApiEngine(metric.apiEngineKey || metric.ApiEngineKey, params)
        if (response && Number(response.Code) === 0) {
          throw new Error(response.Msg || '统计接口执行失败')
        }
        values[key] = metricResponseValue(
          response,
          metric.valueField || metric.ValueField,
          metric.valuePath || metric.ValuePath,
          key
        )
      } catch (error) {
        values[key] = '-'
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, remoteMetrics.length) }, worker))
  return values
}

// 列表 Hero 指标按“接口 + 参数”分组。平台统计接口一次接收 MetricKeys，
// 同一个模块无论配置多少个远程指标都只产生一次请求。
export async function loadListMetricValues(metrics = [], context = {}, options = {}) {
  const remoteMetrics = (Array.isArray(metrics) ? metrics : []).filter((metric) => {
    const source = String(metric.source || metric.Source || '').toLowerCase()
    return source === 'apiengine' && (metric.apiEngineKey || metric.ApiEngineKey)
  })
  if (!remoteMetrics.length) return {}

  const groups = new Map()
  remoteMetrics.forEach((metric) => {
    const apiEngineKey = metric.apiEngineKey || metric.ApiEngineKey
    const params = resolveMetricParams(metric, context)
    const groupKey = `${apiEngineKey}:${JSON.stringify(params || {})}`
    if (!groups.has(groupKey)) groups.set(groupKey, { apiEngineKey, params, metrics: [] })
    groups.get(groupKey).metrics.push(metric)
  })

  const values = {}
  const tasks = [...groups.values()]
  let cursor = 0
  const concurrency = Math.max(1, Math.min(3, Number(options.concurrency || 3)))
  const worker = async () => {
    while (cursor < tasks.length) {
      const group = tasks[cursor++]
      const metricKeys = group.metrics.map((metric) => metric.key || metric.Key).filter(Boolean)
      const menuId = context.menuId || context.menu && context.menu.Id
      const params = {
        ...(group.params || {}),
        MetricKeys: metricKeys,
        Filters: context.filters || {}
      }
      if (menuId) {
        params.SysMenuId = menuId
        params._SysMenuId = menuId
      }
      if (context.moduleEngineKey) params.ModuleEngineKey = context.moduleEngineKey
      Object.keys(params).forEach((name) => {
        if (params[name] === undefined) delete params[name]
      })
      try {
        const response = await callApiEngine(group.apiEngineKey, params)
        if (!response || Number(response.Code) === 0) {
          throw new Error(response && response.Msg || '统计接口执行失败')
        }
        group.metrics.forEach((metric) => {
          const key = metric.key || metric.Key || group.apiEngineKey
          values[key] = metricResponseValue(
            response,
            metric.valueField || metric.ValueField,
            metric.valuePath || metric.ValuePath,
            key
          )
        })
      } catch (error) {
        group.metrics.forEach((metric) => {
          const key = metric.key || metric.Key || group.apiEngineKey
          values[key] = '-'
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return values
}

export default {
  loadViewMetricValues,
  loadListMetricValues
}
