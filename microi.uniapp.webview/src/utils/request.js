/**
 * 网络请求封装
 */
import appConfig from './config.js'

// Token 存储 key
const TOKEN_KEY = 'microi_token'
const USER_KEY = 'microi_user'

/**
 * 获取存储的 Token
 */
export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

/**
 * 设置 Token
 */
export function setToken(token) {
  uni.setStorageSync(TOKEN_KEY, token)
}

/**
 * 清除 Token
 */
export function removeToken() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}

/**
 * 存储用户信息
 */
export function setUser(user) {
  uni.setStorageSync(USER_KEY, JSON.stringify(user))
}

/**
 * 获取用户信息
 */
export function getUser() {
  try {
    const data = uni.getStorageSync(USER_KEY)
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

/**
 * 统一请求方法
 * @param {Object} options 请求选项
 * @param {String} options.url 请求路径（以 / 开头的相对路径）
 * @param {String} options.method 请求方法，默认 POST
 * @param {Object} options.data 请求数据
 * @param {Boolean} options.auth 是否需要携带 Token，默认 true
 * @returns {Promise}
 */
export function request(options = {}) {
  const {
    url,
    method = 'POST',
    data = {},
    auth = true
  } = options

  const header = {
    'Content-Type': 'application/json'
  }

  // 携带 Token
  if (auth) {
    const token = getToken()
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }
  }

  const fullUrl = url.startsWith('http') ? url : appConfig.apiBase + url

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header,
      success: (res) => {
        if (res.statusCode === 200) {
          const result = res.data

          // 自动从响应头提取并保存 Token（后端通过 header 返回 authorization）
          if (res.header) {
            const authHeader = res.header.authorization || res.header.Authorization
            if (authHeader) {
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
              console.log('[request] 从响应头提取到 Token，长度:', token.length)
              setToken(token)
            }
          }

          // 统一处理 Token 过期
          if (result.Code === 401 || result.Code === -1) {
            removeToken()
            uni.switchTab({ url: '/pages/mall/index' })
            reject(new Error('登录已过期'))
            return
          }
          resolve(result)
        } else {
          reject(new Error('请求失败: ' + res.statusCode))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * GET 请求
 */
export function get(url, data = {}, auth = true) {
  return request({ url, method: 'GET', data, auth })
}

/**
 * POST 请求
 */
export function post(url, data = {}, auth = true) {
  return request({ url, method: 'POST', data, auth })
}
