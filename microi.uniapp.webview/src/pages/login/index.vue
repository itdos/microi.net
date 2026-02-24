<template>
  <view class="login-container">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="bg-circle circle-1"></view>
      <view class="bg-circle circle-2"></view>
      <view class="bg-circle circle-3"></view>
    </view>

    <!-- 主体内容 -->
    <view class="login-content">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <image class="logo-image" :src="logoUrl" mode="aspectFit" />
        <text class="app-name">{{ appName }}</text>
        <text class="app-subtitle">{{ appSubTitle }}</text>
      </view>

      <!-- 小程序授权登录（默认显示） -->
      <view class="auth-section" v-if="!showAccountLogin">
        <button
          class="mp-login-btn"
          :loading="wxLoginLoading"
          @tap="handleWxLogin"
        >
          <text class="mp-login-icon">🔐</text>
          <text>小程序授权登录</text>
        </button>

        <view class="switch-login" @tap="showAccountLogin = true">
          <text>账号密码登录</text>
          <text class="arrow-icon">→</text>
        </view>
      </view>

      <!-- 账号密码登录 -->
      <view class="form-section" v-else>
        <!-- 账号输入 -->
        <view class="input-group">
          <view class="input-wrapper">
            <view class="input-icon">
              <text class="icon-text">👤</text>
            </view>
            <input
              class="login-input"
              type="text"
              v-model="account"
              placeholder="请输入账号"
              placeholder-style="color:#ffffff;font-size:28rpx;"
              maxlength="50"
            />
          </view>
        </view>

        <!-- 密码输入 -->
        <view class="input-group">
          <view class="input-wrapper">
            <view class="input-icon">
              <text class="icon-text">🔑</text>
            </view>
            <input
              class="login-input"
              type="text"
              :password="!showPassword"
              v-model="password"
              placeholder="请输入密码"
              placeholder-style="color:#ffffff;font-size:28rpx;"
              maxlength="50"
              @confirm="handleAccountLogin"
            />
            <view class="pwd-toggle" @tap="showPassword = !showPassword">
              <text class="pwd-toggle-icon">{{ showPassword ? '🙈' : '👁️' }}</text>
            </view>
          </view>
        </view>

        <!-- 验证码输入（如果开启） -->
        <view class="input-group" v-if="enableCaptcha">
          <view class="input-wrapper captcha-wrapper">
            <view class="input-icon">
              <text class="icon-text">🛡️</text>
            </view>
            <input
              class="login-input captcha-input"
              type="text"
              v-model="captchaValue"
              placeholder="请输入验证码"
              placeholder-style="color:#ffffff;font-size:28rpx;"
              maxlength="6"
              @confirm="handleAccountLogin"
            />
            <view class="captcha-image-wrapper" @tap="getCaptcha">
              <image
                v-if="captchaImgSrc"
                class="captcha-image"
                :src="captchaImgSrc"
                mode="aspectFit"
              />
              <text v-else class="captcha-loading">获取中...</text>
            </view>
          </view>
        </view>

        <!-- 登录按钮 -->
        <button
          class="account-login-btn"
          :loading="accountLoginLoading"
          :disabled="accountLoginLoading"
          @tap="handleAccountLogin"
        >
          <text class="login-btn-icon">➡️</text>
          <text>登 录</text>
        </button>

        <!-- 切换回授权登录 -->
        <view class="switch-login" @tap="showAccountLogin = false">
          <text class="arrow-icon">←</text>
          <text>小程序授权登录</text>
        </view>
      </view>

      <!-- 隐私协议 -->
      <view class="privacy-section" v-if="enablePrivacyPolicy">
        <view class="privacy-check" @tap="privacyChecked = !privacyChecked">
          <view
            class="check-box"
            :class="{ checked: privacyChecked }"
          >
            <text v-if="privacyChecked" class="check-icon">✓</text>
          </view>
          <text class="privacy-text">我已阅读并同意</text>
          <text
            class="privacy-link"
            @tap.stop="navigateToPrivacy"
          >《{{ privacyPolicyName }}》</text>
        </view>
      </view>
    </view>

    <!-- 底部信息 -->
    <view class="footer">
      <text class="footer-text">© {{ currentYear }} {{ appName }}</text>
    </view>
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'
import { post, setToken, setUser, getToken, removeToken } from '@/utils/request.js'
import { encryptPassword } from '@/utils/crypto.js'

export default {
  data() {
    return {
      // 平台信息（从 config 解构，避免整个模块对象被 reactive 化导致小程序报错）
      appName: appConfig.appName,
      appSubTitle: appConfig.appSubTitle,
      logoUrl: appConfig.logoUrl,
      enablePrivacyPolicy: appConfig.enablePrivacyPolicy,
      privacyPolicyName: appConfig.privacyPolicyName,
      statusBarHeight: 44,
      showAccountLogin: false,
      // 账号密码
      account: '',
      password: '',
      showPassword: false,
      // 验证码
      enableCaptcha: false,
      captchaId: '',
      captchaValue: '',
      captchaImgSrc: '',
      // 加载状态
      wxLoginLoading: false,
      accountLoginLoading: false,
      // 隐私协议
      privacyChecked: false,
      currentYear: new Date().getFullYear()
    }
  },

  onLoad(options) {
    // 获取状态栏高度（优先使用新 API，兼容旧版本）
    try {
      const windowInfo = uni.getWindowInfo()
      this.statusBarHeight = windowInfo.statusBarHeight || 44
    } catch (e) {
      try {
        const sysInfo = uni.getSystemInfoSync()
        this.statusBarHeight = sysInfo.statusBarHeight || 44
      } catch (e2) {
        this.statusBarHeight = 44
      }
    }

    // 如果是从 webview H5 退出登录跳回来的，先清除 token
    if (options && options.logout === '1') {
      console.log('[Login] 从 H5 退出登录，清除本地 Token')
      removeToken()
    }

    // 如果已登录，直接跳转
    const token = getToken()
    if (token) {
      this.navigateToWebview()
      return
    }

    // 获取系统配置，判断是否开启验证码
    this.getSysConfig()
  },

  methods: {
    /**
     * 获取系统配置
     */
    async getSysConfig() {
      try {
        const result = await post('/api/DiyTable/GetSysConfig', {
          _SearchEqual: { IsEnable: 1 },
          OsClient: appConfig.osClient
        }, false)

        if (result.Code === 1 && result.Data) {
          const cfg = result.Data

          // 是否开启验证码
          this.enableCaptcha = !!cfg.EnableCaptcha
          if (this.enableCaptcha) {
            this.getCaptcha()
          }

          // 动态设置系统标题
          if (cfg.SysTitle) {
            this.appName = cfg.SysTitle
          } else if (cfg.SysShortTitle) {
            this.appName = cfg.SysShortTitle
          }

          // 动态设置副标题
          if (cfg.SystemSubTitle) {
            this.appSubTitle = cfg.SystemSubTitle
          }

          // 动态设置 Logo（参考 microi.web GetServerPath 逻辑）
          if (cfg.SysLogo) {
            const fileServer = cfg.FileServer
              ? cfg.FileServer.replace(/\/+$/, '')
              : appConfig.apiBase.replace(/\/+$/, '')
            this.logoUrl = this.getServerPath(cfg.SysLogo, fileServer)
          }

          // 隐私协议相关
          if (cfg.EnablePrivacyPolicy !== undefined) {
            this.enablePrivacyPolicy = !!cfg.EnablePrivacyPolicy
          }
          if (cfg.PrivacyPolicyName) {
            this.privacyPolicyName = cfg.PrivacyPolicyName
          }
        }
      } catch (e) {
        console.error('获取系统配置失败:', e)
      }
    },

    /**
     * 解析服务端图片路径（参考 microi.web DiyCommon.GetServerPath）
     * 支持：http绝对路径、JSON对象字符串、相对路径
     */
    getServerPath(path, fileServer) {
      if (!path) return '/static/logo.png'
      // 已经是完整 URL
      if (path.toLowerCase().startsWith('http')) return path
      // JSON 对象字符串（如 {"Id":"...","Path":"https://...","State":1}）
      if (path.startsWith('{')) {
        try {
          const pathObj = JSON.parse(path)
          if (pathObj.Path) {
            return this.getServerPath(pathObj.Path, fileServer)
          }
        } catch (e) {
          console.error('解析 SysLogo JSON 失败:', e)
        }
      }
      // 相对路径以 . 开头
      if (path.startsWith('.')) return path
      // 其他相对路径，拼接 FileServer
      return (fileServer || '') + '/' + path.replace(/^\/+/, '')
    },

    /**
     * 获取图形验证码
     */
    async getCaptcha() {
      try {
        // 使用 uni.request 获取验证码图片（arraybuffer）
        const res = await uni.request({
          url: appConfig.apiBase + '/api/Captcha/GetCaptcha',
          method: 'GET',
          data: { OsClient: appConfig.osClient },
          responseType: 'arraybuffer'
        })

        if (res && res.statusCode === 200) {
          // 获取验证码 ID
          const captchaId = res.header && (res.header.captchaid || res.header.CaptchaId || res.header.Captchaid)
          if (captchaId) {
            this.captchaId = captchaId
          }
          // 将 arraybuffer 转为 base64 图片
          const base64 = uni.arrayBufferToBase64(res.data)
          this.captchaImgSrc = 'data:image/png;base64,' + base64
        }
      } catch (e) {
        console.error('获取验证码失败:', e)
      }
    },

    /**
     * 微信授权登录
     */
    async handleWxLogin() {
      if (!this.checkPrivacy()) return

      this.wxLoginLoading = true
      try {
        // 1. 调用微信登录获取 code
        let loginRes
        try {
          loginRes = await uni.login({ provider: 'weixin' })
        } catch (loginErr) {
          console.error('uni.login 调用失败:', loginErr)
          uni.showToast({ title: '微信登录失败', icon: 'none' })
          this.wxLoginLoading = false
          return
        }
        if (!loginRes || !loginRes.code) {
          console.error('uni.login 返回数据异常:', loginRes)
          uni.showToast({ title: '微信登录失败', icon: 'none' })
          this.wxLoginLoading = false
          return
        }

        const code = loginRes.code

        // 2. 将 code 发送给后端换取 Token
        const result = await post(appConfig.wxLoginApi, {
          Code: code,
          OsClient: appConfig.osClient
        }, false)

        if (result.Code === 1 && result.Data) {
          // Token 已由 request.js 自动从响应头提取并保存
          const token = getToken()
          if (token) {
            setUser(result.Data)
            this.showLoginSuccess(result.Data)
            this.navigateToWebview()
          } else {
            // 兜底：尝试从响应体提取
            const bodyToken = result.Data.Token || result.Data.token
            if (bodyToken) {
              setToken(bodyToken)
              setUser(result.Data)
              this.showLoginSuccess(result.Data)
              this.navigateToWebview()
            } else {
              uni.showToast({ title: '请使用账号密码登录', icon: 'none' })
              this.showAccountLogin = true
            }
          }
        } else {
          const msg = result.Msg || '登录失败，请稍后再试'
          // 如果后端提示未绑定，则切换到账号密码登录
          if (result.Code === 1001 || msg.includes('未绑定') || msg.includes('未注册')) {
            uni.showModal({
              title: '提示',
              content: '该微信尚未绑定账号，请使用账号密码登录',

              showCancel: false,
              success: () => {
                this.showAccountLogin = true
              }
            })
          } else {
            uni.showToast({ title: msg, icon: 'none', duration: 2500 })
          }
        }
      } catch (e) {
        console.error('微信登录异常:', e)
        uni.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      } finally {
        this.wxLoginLoading = false
      }
    },

    /**
     * 账号密码登录
     */
    async handleAccountLogin() {
      if (!this.checkPrivacy()) return

      if (!this.account.trim()) {
        uni.showToast({ title: '请输入账号', icon: 'none' })
        return
      }
      if (!this.password) {
        uni.showToast({ title: '请输入密码', icon: 'none' })
        return
      }
      if (this.enableCaptcha && !this.captchaValue.trim()) {
        uni.showToast({ title: '请输入验证码', icon: 'none' })
        return
      }

      this.accountLoginLoading = true
      try {
        // RSA 加密密码
        const encryptedPwd = encryptPassword(this.password)
        if (!encryptedPwd) {
          uni.showToast({ title: '密码加密失败', icon: 'none' })
          this.accountLoginLoading = false
          return
        }

        const loginData = {
          Account: this.account.trim(),
          Pwd: encryptedPwd,
          OsClient: appConfig.osClient,
          _ClientType: 'MiniProgram'
        }

        // 添加验证码参数
        if (this.enableCaptcha) {
          loginData._CaptchaId = this.captchaId
          loginData._CaptchaValue = this.captchaValue
        }

        const result = await post('/api/SysUser/Login', loginData, false)

        if (result.Code === 1 && result.Data) {
          // Token 已由 request.js 自动从响应头提取并保存
          const token = getToken()
          console.log('[Login] 登录成功，Token:', token ? ('已保存，长度=' + token.length) : '未获取到')
          if (!token) {
            // 兜底：尝试从响应体提取
            const bodyToken = result.Data.Token || result.Data.token
            if (bodyToken) {
              setToken(bodyToken)
              console.log('[Login] 从响应体提取 Token，长度:', bodyToken.length)
            }
          }
          setUser(result.Data)
          this.showLoginSuccess(result.Data)
          this.navigateToWebview()
        } else {
          const msg = result.Msg || '登录失败'
          uni.showToast({ title: msg, icon: 'none', duration: 2500 })
          // 刷新验证码
          if (this.enableCaptcha) {
            this.getCaptcha()
            this.captchaValue = ''
          }
        }
      } catch (e) {
        console.error('登录异常:', e)
        uni.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      } finally {
        this.accountLoginLoading = false
      }
    },

    /**
     * 检查隐私协议
     */
    checkPrivacy() {
      if (this.enablePrivacyPolicy && !this.privacyChecked) {
        uni.showToast({
          title: '请先阅读并同意' + this.privacyPolicyName,
          icon: 'none',
          duration: 2000
        })
        return false
      }
      return true
    },

    /**
     * 显示登录成功提示
     */
    showLoginSuccess(user) {
      const name = user.Name || user.Account || ''
      uni.showToast({
        title: name + ' 欢迎回来',
        icon: 'success',
        duration: 1500
      })
    },

    /**
     * 跳转到 WebView 页面
     */
    navigateToWebview() {
      setTimeout(() => {
        console.log('[Login] navigateToWebview: 正在跳转...')
        uni.reLaunch({
          url: '/pages/webview/index',
          success: () => {
            console.log('[Login] reLaunch 跳转成功')
          },
          fail: (err) => {
            console.error('[Login] reLaunch 跳转失败:', err)
            // 降级使用 switchTab 或 redirectTo
            uni.redirectTo({
              url: '/pages/webview/index',
              fail: (err2) => {
                console.error('[Login] redirectTo 也失败:', err2)
              }
            })
          }
        })
      }, 1500)
    },

    /**
     * 跳转到隐私协议页
     */
    navigateToPrivacy() {
      uni.navigateTo({
        url: '/pages/privacy/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.status-bar {
  width: 100%;
  flex-shrink: 0;
}

/* 背景装饰圆 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.08;
  background: #ffffff;
}

.circle-1 {
  width: 500rpx;
  height: 500rpx;
  top: -120rpx;
  right: -100rpx;
}

.circle-2 {
  width: 360rpx;
  height: 360rpx;
  top: 300rpx;
  left: -120rpx;
}

.circle-3 {
  width: 280rpx;
  height: 280rpx;
  bottom: 100rpx;
  right: -60rpx;
}

/* 主体内容 */
.login-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 60rpx;
  position: relative;
  z-index: 1;
}

/* Logo 区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.logo-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 32rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
  // background: #ffffff;
}

.app-name {
  font-size: 44rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 4rpx;
  margin-bottom: 12rpx;
}

.app-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 2rpx;
}

/* 授权登录区域 */
.auth-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mp-login-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  letter-spacing: 4rpx;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
  transition: all 0.3s;

  &::after {
    border: none;
  }

  .mp-login-icon {
    font-size: 36rpx;
    margin-right: 12rpx;
  }
}

.switch-login {
  margin-top: 40rpx;
  display: flex;
  align-items: center;
  padding: 16rpx 0;

  text {
    color: rgba(255, 255, 255, 0.85);
    font-size: 28rpx;
  }

  .arrow-icon {
    margin: 0 8rpx;
    font-size: 28rpx;
  }
}

/* 表单区域 */
.form-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.input-group {
  width: 100%;
  margin-bottom: 30rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border: 2rpx solid rgba(255, 255, 255, 0.25);
  border-radius: 48rpx;
  height: 96rpx;
  padding: 0 32rpx;
  backdrop-filter: blur(10px);
  transition: all 0.3s;

  &:focus-within {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
  }
}

.input-icon {
  width: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.icon-text {
  font-size: 36rpx;
}

.login-input {
  flex: 1;
  height: 96rpx;
  font-size: 30rpx;
  color: #ffffff;
}

/* 密码显示/隐藏切换 */
.pwd-toggle {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.pwd-toggle-icon {
  font-size: 36rpx;
  opacity: 0.8;
}

.input-placeholder {
  color: rgba(255, 255, 255, 0.75);
  font-size: 28rpx;
  font-weight: 400;
}

/* 验证码 */
.captcha-wrapper {
  flex-wrap: nowrap;
}

.captcha-input {
  flex: 1;
}

.captcha-image-wrapper {
  width: 200rpx;
  height: 64rpx;
  margin-left: 16rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.captcha-image {
  width: 100%;
  height: 100%;
}

.captcha-loading {
  font-size: 22rpx;
  color: #999999;
}

/* 账号登录按钮 */
.account-login-btn {
  width: 100%;
  height: 96rpx;
  background: rgba(255, 255, 255, 0.95);
  color: #667eea;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  letter-spacing: 4rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
  margin-top: 10rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.7;
  }

  .login-btn-icon {
    font-size: 32rpx;
    margin-right: 8rpx;
  }
}

/* 隐私协议 */
.privacy-section {
  margin-top: 50rpx;
  width: 100%;
}

.privacy-check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-box {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.6);
  border-radius: 8rpx;
  margin-right: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &.checked {
    background: #07c160;
    border-color: #07c160;
  }
}

.check-icon {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.privacy-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.privacy-link {
  font-size: 24rpx;
  color: #ffffff;
  text-decoration: underline;
}

/* 底部 */
.footer {
  padding: 30rpx 0;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.footer-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
}
</style>
