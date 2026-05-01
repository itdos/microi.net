/**
 * 网络请求封装
 */
import appConfig from '../config.js'

// Token 存储 key
const TOKEN_KEY = 'microi_token'
const USER_KEY = 'microi_user'

// 全局 401 跳转节流：并发请求多个 401 时，只跳转一次
let _redirectingToLogin = false

// 并发限流：小程序平台 uni.request 默认并发上限通常为 10，应用启动时大量并发可能阻塞 UI 关键请求
// 设置 8 槽位 + 队列，避免占满浏览器/小程序连接池
const MAX_CONCURRENT = 8
let _activeCount = 0
const _waitingQueue = []
function _acquireSlot() {
  return new Promise(resolve => {
    if (_activeCount < MAX_CONCURRENT) {
      _activeCount++
      resolve()
    } else {
      _waitingQueue.push(resolve)
    }
  })
}
function _releaseSlot() {
  if (_waitingQueue.length > 0) {
    _activeCount = _activeCount // 保持计数
    const next = _waitingQueue.shift()
    try { next() } catch (e) {}
  } else {
    _activeCount = Math.max(0, _activeCount - 1)
  }
}

function redirectToLogin() {
  if (_redirectingToLogin) return
  _redirectingToLogin = true
  // 优先跳到登录页（保留当前页用作 redirect），失败时回到 tabBar 商城
  try {
    const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : []
    const current = pages && pages.length ? pages[pages.length - 1] : null
    let redirect = ''
    if (current && current.route) {
      const opts = current.options || {}
      const qs = Object.keys(opts).map(k => `${k}=${encodeURIComponent(opts[k])}`).join('&')
      redirect = '/' + current.route + (qs ? '?' + qs : '')
    }
    // 已经在登录页则不跳
    if (current && current.route && current.route.indexOf('pages/login') !== -1) {
      _redirectingToLogin = false
      return
    }
    const url = '/pages/login/index' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '')
    uni.navigateTo({
      url,
      fail: () => {
        uni.switchTab({ url: '/pages/mall/index', complete: () => { _redirectingToLogin = false } })
      },
      complete: () => {
        // 给后续请求一个短暂窗口避免再次触发
        setTimeout(() => { _redirectingToLogin = false }, 800)
      }
    })
  } catch (e) {
    _redirectingToLogin = false
  }
}

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
    _acquireSlot().then(() => {
      let released = false
      const release = () => {
        if (released) return
        released = true
        _releaseSlot()
      }
      uni.request({
        url: fullUrl,
        method,
        data,
        header,
        timeout: 30000,
        success: (res) => {
          if (res.statusCode === 200) {
            const result = res.data

            // 自动从响应头提取并保存 Token（后端通过 header 返回 authorization）
            if (res.header) {
              const authHeader = res.header.authorization || res.header.Authorization
              if (authHeader) {
                const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
                setToken(token)
              }
            }

            // 统一处理 Token 过期（覆盖 Microi 标准过期码：1001/1002，以及通用 401/-1）
            const code = result && result.Code
            if (auth && (code === 401 || code === -1 || code === 1001 || code === 1002)) {
              removeToken()
              redirectToLogin()
              reject(new Error(result && result.Msg ? result.Msg : '登录已过期'))
              return
            }
            resolve(result)
          } else if (res.statusCode === 401) {
            // HTTP 层级 401
            if (auth) {
              removeToken()
              redirectToLogin()
            }
            reject(new Error('登录已过期'))
          } else {
            reject(new Error('请求失败: ' + res.statusCode))
          }
        },
        fail: (err) => {
          reject(err)
        },
        complete: () => {
          release()
        }
      })
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
