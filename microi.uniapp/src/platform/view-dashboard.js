import { callApiEngine } from '@/platform/business-runtime.js'
import { resolveMetricParams } from '@/platform/view-schema-core.mjs'

function valueAtPath(source, path) {
  if (!path) return source
  return String(path).split('.').filter(Boolean).reduce((value, key) => {
    return value && typeof value === 'object' ? value[key] : undefined
  }, source)
}

function safeRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const result = {}
  Object.keys(row).slice(0, 40).forEach((key) => {
    const value = row[key]
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) result[key] = value
  })
  return result
}

export async function loadDashboardBlockRows(block, context = {}) {
  if (!block || !block.apiEngineKey) return []
  const response = await callApiEngine(block.apiEngineKey, resolveMetricParams(block, context))
  if (!response || Number(response.Code) !== 1) {
    throw new Error((response && response.Msg) || `${block.title || '看板'}数据加载失败`)
  }
  const source = valueAtPath(response.Data, block.dataPath) ?? response.Data
  const rows = Array.isArray(source) ? source : (source && typeof source === 'object' ? [source] : [])
  return rows.map(safeRow).filter(Boolean).slice(0, block.limit || 8)
}

export async function loadDashboardBlocks(blocks = [], context = {}) {
  const result = {}
  await Promise.all((blocks || []).filter((block) => block.apiEngineKey).map(async (block) => {
    try {
      result[block.key] = await loadDashboardBlockRows(block, context)
    } catch (error) {
      result[block.key] = []
    }
  }))
  return result
}

export default { loadDashboardBlockRows, loadDashboardBlocks }
