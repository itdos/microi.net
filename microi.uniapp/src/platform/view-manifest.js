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

export async function loadModuleViewManifest(moduleConfig, options = {}) {
  if (!moduleConfig || !moduleConfig.table) return null
  const user = options.user || getUser() || {}
  const menu = await findMenu(
    moduleConfig.menuAliases || [],
    moduleConfig.table,
    options.refresh === true,
    moduleConfig.menuId || ''
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
