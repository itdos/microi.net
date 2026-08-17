import { getUser } from '@/utils/request.js'
import { findMenu } from '@/platform/business-runtime.js'
import {
  buildRenderManifest,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
} from '@/platform/view-schema-core.mjs'

const manifestCache = new Map()

function roleCacheKey(user) {
  const source = user || {}
  const values = [source.RoleIds, source.RoleId, source.SysRoleIds, source.RoleName]
  return JSON.stringify(values)
}

function matchingConfiguredMenu(moduleConfig) {
  const menu = moduleConfig && moduleConfig.menu
  if (!menu || typeof menu !== 'object') return null
  const configuredMenuId = String(moduleConfig.menuId || '').trim().toLowerCase()
  const menuId = String(menu.Id || '').trim().toLowerCase()
  if (configuredMenuId && menuId !== configuredMenuId) return null
  const configuredTableId = String(moduleConfig.tableId || '').trim().toLowerCase()
  const menuTableId = String(menu.DiyTableId || '').trim().toLowerCase()
  if (configuredTableId && menuTableId && menuTableId !== configuredTableId) return null
  return menu
}

export async function loadModuleViewManifest(moduleConfig, options = {}) {
  if (!moduleConfig || !moduleConfig.table) return null
  const user = options.user || getUser() || {}
  // 模块定义和 ViewManifest 必须使用同一份菜单快照。若这里重新查询菜单，
  // 旧菜单缓存可能在完整模块配置之后返回，并把 Card-Mobile 标题覆盖回旧值。
  const menu = matchingConfiguredMenu(moduleConfig) || await findMenu(
    moduleConfig.menuAliases || [],
    moduleConfig.table,
    options.refresh === true,
    moduleConfig.menuId || '',
    moduleConfig.tableId || ''
  )
  if (!menu) return null
  const key = [
    menu.Id || moduleConfig.table,
    menu.UpdateTime || '',
    menu.ViewConfigVersion || '',
    options.scene || 'Detail',
    options.device || 'Mobile',
    roleCacheKey(user)
  ].join(':')
  if (!options.refresh && manifestCache.has(key)) return manifestCache.get(key)
  const manifest = buildRenderManifest(menu, {
    scene: options.scene || 'Detail',
    device: options.device || 'Mobile',
    user,
    tableName: moduleConfig.table
  })
  manifestCache.set(key, manifest)
  return manifest
}

export function clearModuleViewManifestCache() {
  manifestCache.clear()
}

export {
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
}

export default {
  loadModuleViewManifest,
  clearModuleViewManifestCache,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
}
