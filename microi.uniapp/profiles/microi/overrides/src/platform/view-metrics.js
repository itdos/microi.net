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

function metricResponseValue(response, valueField) {
  if (valueField) {
    const fromData = readPath(response && response.Data, valueField)
    if (fromData !== undefined) return fromData
    const fromResponse = readPath(response, valueField)
    if (fromResponse !== undefined) return fromResponse
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
        values[key] = metricResponseValue(response, metric.valueField || metric.ValueField)
      } catch (error) {
        values[key] = '-'
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, remoteMetrics.length) }, worker))
  return values
}

export default {
  loadViewMetricValues
}
