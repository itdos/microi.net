import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

/**
 * 微信小程序环境兼容插件
 * encryptlong (基于 jsencrypt) 依赖 navigator/window/crypto 等浏览器 API，
 * 小程序环境中这些对象不存在，需要在编译时修补源码：
 * 1. navigator.appName → "Netscape"（BigInteger 算法选择，走 am3 路径）
 * 2. navigator.userAgent → ""（IE 检测，已在 try-catch 中）
 * 3. window.crypto / window.addEventListener 等 → 安全降级
 * 4. window.JSEncrypt → 跳过全局注册
 */
function mpPatchEncryptlong() {
  return {
    name: 'mp-patch-encryptlong',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('encryptlong') && !id.includes('jsencrypt')) {
        return
      }
      let patched = code

      // 1. navigator.appName → "Netscape"（常量折叠会消除死分支）
      patched = patched.replace(/navigator\.appName/g, '"Netscape"')

      // 2. navigator.userAgent → ""（已在 try-catch 中，替换后更安全）
      patched = patched.replace(/navigator\.userAgent/g, '""')

      // 3. window.crypto → 安全访问（小程序中 window 不存在）
      //    将 window.crypto 替换为 (typeof window!=="undefined"&&window.crypto)
      patched = patched.replace(
        /window\.crypto/g,
        '(typeof window!=="undefined"&&window.crypto)'
      )

      // 4. window.removeEventListener → 安全访问
      patched = patched.replace(
        /window\.removeEventListener/g,
        '(typeof window!=="undefined"&&window.removeEventListener)'
      )

      // 5. window.addEventListener → 安全访问
      patched = patched.replace(
        /window\.addEventListener/g,
        '(typeof window!=="undefined"&&window.addEventListener)'
      )

      // 6. window.detachEvent → 安全访问
      patched = patched.replace(
        /window\.detachEvent/g,
        '(typeof window!=="undefined"&&window.detachEvent)'
      )

      // 7. window.attachEvent → 安全访问
      patched = patched.replace(
        /window\.attachEvent/g,
        '(typeof window!=="undefined"&&window.attachEvent)'
      )

      // 8. window.JSEncrypt = → 安全注册
      patched = patched.replace(
        /window\.JSEncrypt\s*=/g,
        '(typeof window!=="undefined")&&(window.JSEncrypt='
      )
      // 修复上面替换后缺少的右括号 —— 在该行末尾加 )
      patched = patched.replace(
        /\(typeof window!=="undefined"\)&&\(window\.JSEncrypt=([^;]+);/g,
        '(typeof window!=="undefined")&&(window.JSEncrypt=$1);'
      )

      if (patched !== code) {
        console.log('[mp-patch-encryptlong] patched:', id.split('node_modules/').pop())
      }
      return patched
    }
  }
}

export default defineConfig({
  plugins: [
    uni(),
    mpPatchEncryptlong()
  ]
})
