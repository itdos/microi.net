/**
 * 系统配置缓存工具
 * 提供 SysConfig 的获取、缓存和读取
 */
import { post } from './request.js'
import appConfig from '../config.js'

const CACHE_KEY = 'sys_config_cache'
const CACHE_EXPIRE = 30 * 60 * 1000 // 缓存30分钟
const AI_FLAG_EXPIRE = 60 * 1000

let sysConfigRequest = null
let aiFlagRequest = null
let aiFlagState = {
  checkedAt: 0,
  enabled: false
}

export function isEnabledFlag(value) {
  return value === 1 || value === '1'
}

/**
 * 从缓存读取 SysConfig
 */
export function getCachedSysConfig() {
  try {
    const cached = uni.getStorageSync(CACHE_KEY)
    if (cached && cached.data && cached.time) {
      if (Date.now() - cached.time < CACHE_EXPIRE) {
        return cached.data
      }
    }
  } catch (e) {}
  return null
}

/**
 * 写入缓存
 */
function setCachedSysConfig(data) {
  try {
    uni.setStorageSync(CACHE_KEY, {
      data,
      time: Date.now()
    })
  } catch (e) {}
}

/**
 * 获取 SysConfig（优先缓存，否则请求接口）
 * @returns {Promise<Object|null>}
 */
export async function getSysConfig(options = {}) {
  const refresh = options === true || (options && options.refresh === true)
  // 先尝试读缓存
  if (!refresh) {
    const cached = getCachedSysConfig()
    if (cached) return cached
  }

  if (sysConfigRequest) return sysConfigRequest

  // 请求接口
  sysConfigRequest = (async () => {
    try {
      const result = await post('/api/DiyTable/GetSysConfig', {
        _SearchEqual: { IsEnable: 1 },
        OsClient: appConfig.osClient
      }, false)
      if (result.Code === 1 && result.Data) {
        setCachedSysConfig(result.Data)
        return result.Data
      }
    } catch (e) {
      console.log('[SysConfig] fetch error:', e.message)
    }
    return null
  })()

  try {
    return await sysConfigRequest
  } finally {
    sysConfigRequest = null
  }
}

/**
 * AI 助手采用失败关闭策略：只有服务端最新配置明确开启时才显示。
 */
export async function getAiAssistantEnabled(options = {}) {
  const force = options === true || (options && options.refresh === true)
  const fresh = aiFlagState.checkedAt && Date.now() - aiFlagState.checkedAt < AI_FLAG_EXPIRE
  if (!force && fresh) return aiFlagState.enabled
  if (aiFlagRequest) return aiFlagRequest

  aiFlagRequest = (async () => {
    const config = await getSysConfig({ refresh: true })
    const enabled = isEnabledFlag(config && config.IsShowAiAssistant)
    aiFlagState = { checkedAt: Date.now(), enabled }
    return enabled
  })()

  try {
    return await aiFlagRequest
  } catch (error) {
    aiFlagState = { checkedAt: Date.now(), enabled: false }
    return false
  } finally {
    aiFlagRequest = null
  }
}

/**
 * 获取图片服务器完整路径
 */
export function getServerPath(path) {
  if (!path) return ''
  if (path.startsWith('{')) {
    try {
      const obj = JSON.parse(path)
      path = obj.Path || obj.path || ''
    } catch (e) {}
  }
  if (!path) return ''
  if (path.startsWith('http')) return path
  return appConfig.fileServer + (path.startsWith('/') ? '' : '/') + path
}
