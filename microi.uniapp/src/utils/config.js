/**
 * Microi.net 小程序配置文件
 * ========================================
 * 请根据实际部署环境修改以下配置
 * ========================================
 */

// 注意：必须使用 export default { ... } 内联对象语法
// 不要使用 const config = { ... }; export default config
// 否则 uni-app 编译小程序时会导出为 exports.config 而非 exports.default
export default {
  // ============ 服务端接口地址 ============
  // apiBase: 'https://localhost:7266',
  apiBase: 'https://api.jifulii.com',

  // ============ 静态资源服务器 ============
  fileServer: 'https://static.jifulii.com',

  // ============ WebView 地址 ============
  // webviewUrl: 'http://localhost:1988/?OsClient=xjy',
  webviewUrl: 'https://saas.jifulii.com',

  // ============ 平台信息 ============
  appName: 'Loading...',
  appSubTitle: '',
  logoUrl: '/static/logo.png',

  // ============ 小程序授权登录 ============
  // 微信登录接口（兼容旧配置）
  wxLoginApi: '/apiengine/wx-miniprogram-login-reg-bind',

  // 各平台授权登录接口（优先使用，如未配置则由 platform.js 自动回退默认路径）
  platformLoginApis: {
    weixin: '/apiengine/wx-miniprogram-login-reg-bind',
    alipay: '/apiengine/alipay-miniprogram-login-reg-bind',
    toutiao: '/apiengine/tt-miniprogram-login-reg-bind',
    lark: '/apiengine/lark-miniprogram-login-reg-bind',
    xhs: '/apiengine/xhs-miniprogram-login-reg-bind',
  },

  // ============ 隐私协议 ============
  enablePrivacyPolicy: true,
  privacyPolicyName: '用户隐私保护协议',

  // ============ OsClient 标识 ============
  osClient: 'xjy',

  // ============ RSA 公钥 ============
  publicKey: '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R\nXaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ\n1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg\n1DsI9VJ7gTHGL3R7sQIDAQAB\n-----END PUBLIC KEY-----'
}
