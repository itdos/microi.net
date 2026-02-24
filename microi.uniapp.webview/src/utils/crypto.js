/**
 * RSA 加密工具
 * 在小程序环境中，encryptlong (基于 jsencrypt) 依赖 navigator.appName
 * 通过 vite.config.js 的 transform 插件直接将 navigator.appName 替换为 "Netscape"
 */

import Encrypt from 'encryptlong'
import appConfig from './config.js'

/**
 * RSA 加密密码
 * @param {String} password 明文密码
 * @returns {String|null} 加密后的密码，失败返回 null
 */
export function encryptPassword(password) {
  try {
    const encrypt = new Encrypt()
    encrypt.setPublicKey(appConfig.publicKey)
    const encrypted = encrypt.encryptLong(password)
    if (!encrypted) {
      console.error('RSA 加密返回空值')
      return null
    }
    return encrypted
  } catch (error) {
    console.error('密码加密失败:', error)
    return null
  }
}
