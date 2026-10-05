import appConfig from '@/config.js'
import { getUser } from '@/utils/request.js'
import { readPageState, writePageState } from '@/platform/cache.js'
import { rememberRecentModuleList, resolveRecentModules } from '@/platform/home-workbench.mjs'

const MAX_STORED = 8

function scopeKey() {
  const user = getUser() || {}
  const endpoint = String(appConfig.apiBase || '').toLowerCase()
  const osClient = String(appConfig.osClient || '').toLowerCase()
  const identity = String(user.Id || user.Account || 'guest').toLowerCase()
  return `home-recent:v1:${endpoint}:${osClient}:${identity}`
}

export function readRecentModules(authorizedModules, limit = 4) {
  const records = readPageState(scopeKey(), [])
  return resolveRecentModules(records, authorizedModules, limit)
}

export function rememberRecentModule(module) {
  const key = scopeKey()
  const records = readPageState(key, [])
  writePageState(key, rememberRecentModuleList(records, module, MAX_STORED))
}

export default { readRecentModules, rememberRecentModule }
