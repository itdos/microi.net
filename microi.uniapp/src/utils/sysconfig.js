/**
 * 系统配置缓存工具
 * 提供 SysConfig 的获取、缓存和读取
 */
import { post } from './request.js'
import appConfig from './config.js'

const CACHE_KEY = 'sys_config_cache'
const CACHE_EXPIRE = 30 * 60 * 1000 // 缓存30分钟

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
export async function getSysConfig() {
  // 先尝试读缓存
  const cached = getCachedSysConfig()
  if (cached) return cached

  // 请求接口
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
