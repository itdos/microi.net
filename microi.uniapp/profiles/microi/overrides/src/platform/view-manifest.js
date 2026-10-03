import { getUser } from '@/utils/request.js'
import { findMenu, loadMenuTree } from '@/platform/business-runtime.js'
import {
  buildRenderManifest,
  compileDashboardConfig,
  compileHomeConfig,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
} from '@/platform/view-schema-core.mjs'

const manifestCache = new Map()

function flattenMenus(items, output = []) {
  ;(Array.isArray(items) ? items : []).forEach((menu) => {
    if (!menu) return
    output.push(menu)
    flattenMenus(menu._Child || menu.children, output)
  })
  return output
}

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

/**
 * 从当前账号已授权菜单中选择 Home-Mobile 视图。
 * 优先级只来自受限 ViewSchema 与明确首页标记，不读取或执行任何远程脚本。
 */
export async function loadHomeViewManifest(options = {}) {
  const user = options.user || getUser() || {}
  const menus = flattenMenus(await loadMenuTree(options.refresh === true))
  const candidates = menus.map((menu, index) => {
    const manifest = buildRenderManifest(menu, {
      scene: 'Home',
      device: 'Mobile',
      user
    })
    if (!manifest) return null
    const explicitHome = [menu.IsHome, menu.AppHome, menu.DefaultHome]
      .some((value) => value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true')
    return {
      manifest,
      index,
      score: (explicitHome ? 100000 : 0) + Number(manifest.View?.Priority || 0)
    }
  }).filter(Boolean).sort((left, right) => right.score - left.score || left.index - right.index)
  return candidates.length ? candidates[0].manifest : null
}

/** 从当前账号的授权菜单中选择 Dashboard-Mobile 视图。 */
export async function loadDashboardViewManifest(options = {}) {
  const user = options.user || getUser() || {}
  const menus = flattenMenus(await loadMenuTree(options.refresh === true))
  const candidates = menus.map((menu, index) => {
    const manifest = buildRenderManifest(menu, {
      scene: 'Dashboard',
      device: 'Mobile',
      user
    })
    if (!manifest) return null
    const explicitDashboard = [menu.IsDashboard, menu.AppDashboard, menu.DefaultDashboard]
      .some((value) => value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true')
    return {
      manifest,
      index,
      score: (explicitDashboard ? 100000 : 0) + Number(manifest.View?.Priority || 0)
    }
  }).filter(Boolean).sort((left, right) => right.score - left.score || left.index - right.index)
  return candidates.length ? candidates[0].manifest : null
}

export function clearModuleViewManifestCache() {
  manifestCache.clear()
}

export {
  compileDashboardConfig,
  compileHomeConfig,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
}

export default {
  loadDashboardViewManifest,
  loadHomeViewManifest,
  loadModuleViewManifest,
  clearModuleViewManifestCache,
  compileDashboardConfig,
  compileHomeConfig,
  compileDetailPreset,
  compileFormConfig,
  compileListConfig
}
