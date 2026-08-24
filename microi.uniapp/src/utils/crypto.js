/**
 * RSA 加密工具
 * 在小程序环境中，encryptlong (基于 jsencrypt) 依赖 navigator.appName
 * 通过 vite.config.js 的 transform 插件直接将 navigator.appName 替换为 "Netscape"
 */

import Encrypt from 'encryptlong'
import appConfig from '../config.js'

// 历史兼容公钥：只用于避免登录密码在请求体中直接显示，不能替代 HTTPS。
// 平台可通过匿名 GetSysConfig.LoginRsaPublicKey 返回自己的公钥并覆盖它。
export const DEFAULT_LOGIN_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`

export function resolveLoginRsaPublicKey() {
  return String(appConfig.publicKey || DEFAULT_LOGIN_RSA_PUBLIC_KEY).replace(/\\n/g, '\n').trim()
}

/**
 * RSA 加密密码
 * @param {String} password 明文密码
 * @returns {String|null} 加密后的密码，失败返回 null
 */
export function encryptPassword(password) {
  try {
    const encrypt = new Encrypt()
    encrypt.setPublicKey(resolveLoginRsaPublicKey())
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
