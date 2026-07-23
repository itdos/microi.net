<template>
  <view class="login-container" :style="mciTokenStyle">
    <image class="login-water" :src="xjyAssets.waterHero" mode="aspectFill" />
    <view class="login-shade"></view>
    <!-- 顶部导航：返回按钮 -->
    <view class="login-nav mci-safe-top">
      <view class="login-nav-back" @tap="goBack">
        <text class="login-nav-back-icon">‹</text>
        <text class="login-nav-back-text">{{ t('common.back') }}</text>
      </view>
    </view>

    <!-- 主体内容 -->
    <view class="login-content">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <image class="logo-image" :src="logoUrl" mode="aspectFit" />
        <text class="app-name">{{ appName }}</text>
        <text class="app-subtitle">{{ appSubTitle }}</text>
      </view>

      <!-- 小程序授权登录（默认显示，仅支持授权登录的平台显示） -->
      <view class="auth-section" v-if="!showAccountLogin && hasAuthLogin">
        <!-- 手机号授权按钮（新用户未绑定时显示） -->
        <template v-if="showPhoneAuth">
          <text class="phone-auth-tip">该微信号尚未绑定账号，请授权手机号完成注册</text>
          <button
            class="mp-login-btn phone-auth-btn"
            open-type="getPhoneNumber"
            :loading="phoneAuthLoading"
            @getphonenumber="handleGetPhoneNumber"
          >
            <text>授权手机号登录</text>
          </button>
          <view class="switch-login" @tap="showPhoneAuth = false">
            <text class="arrow-icon">←</text>
            <text>返回</text>
          </view>
        </template>

        <!-- 默认授权登录按钮 -->
        <template v-else>
          <button
            class="mp-login-btn"
            :loading="wxLoginLoading"
            @tap="handleAuthLogin"
          >
            <text>{{ t('login.authLogin') }}</text>
          </button>
        </template>

        <view class="switch-login" v-if="!showPhoneAuth" @tap="showAccountLogin = true">
          <text>{{ t('login.accountLogin') }}</text>
          <text class="arrow-icon">→</text>
        </view>
      </view>

      <!-- 账号密码登录 -->
      <view class="form-section" v-else>
        <!-- 账号输入 -->
        <view class="input-group">
          <view class="input-wrapper">
            <text class="input-label">账号</text>
            <input
              class="login-input"
              type="text"
              :value="account"
              :placeholder="t('login.enterAccount')"
              placeholder-style="color:#ffffff;font-size:28rpx;"
              maxlength="50"
              @input="handleAccountInput"
            />
          </view>
        </view>

        <!-- 密码输入 -->
        <view class="input-group">
          <view class="input-wrapper">
            <text class="input-label">密码</text>
            <input
              class="login-input"
              type="text"
              :password="!showPassword"
              :value="password"
              :placeholder="t('login.enterPassword')"
              placeholder-style="color:#ffffff;font-size:28rpx;"
              maxlength="50"
              @input="handlePasswordInput"
              @confirm="handleAccountLogin"
            />
            <view class="pwd-toggle" @tap="showPassword = !showPassword">
              <text class="pwd-toggle-icon">{{ showPassword ? '◎' : '◉' }}</text>
            </view>
          </view>
        </view>

        <!-- 验证码输入（如果开启） -->
        <view class="input-group" v-if="enableCaptcha">
          <view class="input-wrapper captcha-wrapper">
            <text class="input-label">验证</text>
            <input
              class="login-input captcha-input"
              type="text"
              v-model="captchaValue"
              :placeholder="t('login.enterCaptcha')"
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
              <text v-else class="captcha-loading">{{ t('login.gettingCaptcha') }}</text>
            </view>
          </view>
        </view>

        <view class="remember-options">
          <view class="remember-option" role="checkbox" :aria-checked="rememberAccount" @tap="toggleRememberAccount">
            <view class="remember-check" :class="{ 'remember-check--checked': rememberAccount }">
              <text v-if="rememberAccount">✓</text>
            </view>
            <text>记住账号</text>
          </view>
          <view class="remember-option" role="checkbox" :aria-checked="rememberPassword" @tap="toggleRememberPassword">
            <view class="remember-check" :class="{ 'remember-check--checked': rememberPassword }">
              <text v-if="rememberPassword">✓</text>
            </view>
            <text>记住密码</text>
          </view>
        </view>

        <!-- 登录按钮 -->
        <button
          class="account-login-btn"
          :loading="accountLoginLoading"
          :disabled="accountLoginLoading"
          @tap="handleAccountLogin"
        >
          <text>{{ t('login.loginBtn') }}</text>
        </button>

        <!-- 切换回授权登录（仅支持授权登录的平台显示） -->
        <view class="switch-login" v-if="hasAuthLogin" @tap="showAccountLogin = false">
          <text class="arrow-icon">←</text>
          <text>{{ t('login.authLogin') }}</text>
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
          <text class="privacy-text">{{ t('login.agreePre') }}</text>
          <text
            class="privacy-link"
            @tap.stop="navigateToPrivacy"
          >《{{ privacyPolicyName }}》</text>
        </view>
      </view>
    </view>

    <!-- 底部信息 -->
    <view class="footer">
      <text class="login-footer-text">© {{ currentYear }} {{ appName }}</text>
    </view>
  </view>
</template>

<script>
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import { post, setToken, setUser, getToken, removeToken } from '@/utils/request.js'
import { encryptPassword } from '@/utils/crypto.js'
import { captureInvitation, invitationPayload } from '@/platform/invitation.js'
import { getLoginProvider, getAuthLoginApi, getClientType, supportsAuthLogin, getPlatformName, getPlatformNameEn } from '@/utils/platform.js'

function isEnabledFlag(value) {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    return text === '1' || text === 'true' || text === 'yes' || text === 'on'
  }
  return false
}

const LOGIN_PREFERENCES_KEY = 'mci_login_preferences_v1'
const REMEMBERED_PASSWORD_MASK = '••••••••'

export default {
  mixins: [themeMixin],
  data() {
    return {
      // 平台信息（从 config 解构，避免整个模块对象被 reactive 化导致小程序报错）
      appName: appConfig.appName,
      appSubTitle: appConfig.appSubTitle,
      logoUrl: appConfig.logoUrl,
      enablePrivacyPolicy: appConfig.enablePrivacyPolicy,
      privacyPolicyName: appConfig.privacyPolicyName,
      statusBarHeight: 0,
      showAccountLogin: false,
      // 账号密码
      account: '',
      password: '',
      showPassword: false,
      rememberAccount: false,
      rememberPassword: false,
      rememberedAccount: '',
      rememberedPasswordCipher: '',
      // 验证码
      enableCaptcha: false,
      captchaId: '',
      captchaValue: '',
      captchaImgSrc: '',
      // 加载状态
      wxLoginLoading: false,
      accountLoginLoading: false,
      // 是否支持平台授权登录
      hasAuthLogin: supportsAuthLogin(),
      // 手机号授权（微信小程序新用户绑定）
      showPhoneAuth: false,
      cachedLoginCode: '',
      phoneAuthLoading: false,
      // 隐私协议
      privacyChecked: false,
      currentYear: new Date().getFullYear(),
      // 登录后重定向地址（从商品详情等页面跳过来时用）
      redirectUrl: ''
    }
  },

  onLoad(options) {
    captureInvitation(options || {})
    this.restoreLoginPreferences()
    // 获取状态栏高度（优先使用新 API，兼容旧版本）
    try {
      const windowInfo = uni.getWindowInfo()
      this.statusBarHeight = windowInfo.statusBarHeight || 0
    } catch (e) {
      try {
        const sysInfo = uni.getSystemInfoSync()
        this.statusBarHeight = sysInfo.statusBarHeight || 0
      } catch (e2) {
        this.statusBarHeight = 0
      }
    }

    // 保存登录后的重定向地址
    if (options && options.redirect) {
      this.redirectUrl = decodeURIComponent(options.redirect)
    }

    // 兼容带 logout 参数进入登录页的旧链接。
    if (options && options.logout === '1') {
      console.log('[Login] logout 参数已生效，清除本地 Token')
      removeToken()
    }

    // 不支持授权登录的平台，默认显示账号密码登录
    if (!this.hasAuthLogin) {
      this.showAccountLogin = true
    }

    // 如果已登录，直接跳转
    const token = getToken()
    if (token) {
      this.navigateAfterLogin()
      return
    }

    // 获取系统配置，判断是否开启验证码
    this.getSysConfig()
  },

  methods: {
    restoreLoginPreferences() {
      let saved = {}
      try {
        saved = uni.getStorageSync(LOGIN_PREFERENCES_KEY) || {}
      } catch (error) {}
      const account = String(saved.account || '').trim()
      const passwordCipher = String(saved.passwordCipher || '')
      this.rememberAccount = saved.rememberAccount === true && !!account
      this.rememberPassword = this.rememberAccount && saved.rememberPassword === true && !!passwordCipher
      this.rememberedAccount = this.rememberAccount ? account : ''
      this.rememberedPasswordCipher = this.rememberPassword ? passwordCipher : ''
      this.account = this.rememberedAccount
      this.password = this.rememberPassword ? REMEMBERED_PASSWORD_MASK : ''
    },
    persistLoginPreferences(passwordCipher = '') {
      if (!this.rememberAccount) {
        try { uni.removeStorageSync(LOGIN_PREFERENCES_KEY) } catch (error) {}
        return
      }
      const account = String(this.account || '').trim()
      const cipher = this.rememberPassword ? String(passwordCipher || this.rememberedPasswordCipher || '') : ''
      try {
        uni.setStorageSync(LOGIN_PREFERENCES_KEY, {
          version: 1,
          rememberAccount: true,
          rememberPassword: this.rememberPassword && !!cipher,
          account,
          passwordCipher: cipher
        })
      } catch (error) {}
      this.rememberedAccount = account
      this.rememberedPasswordCipher = cipher
      if (cipher) this.password = REMEMBERED_PASSWORD_MASK
    },
    clearRememberedPassword() {
      this.rememberPassword = false
      this.rememberedPasswordCipher = ''
      if (this.password === REMEMBERED_PASSWORD_MASK) this.password = ''
      this.persistLoginPreferences()
    },
    handleAccountInput(event) {
      const value = String((event.detail && event.detail.value) || '')
      if (this.rememberedAccount && value.trim() !== this.rememberedAccount) {
        this.rememberedPasswordCipher = ''
        this.rememberPassword = false
        if (this.password === REMEMBERED_PASSWORD_MASK) this.password = ''
      }
      this.account = value
    },
    handlePasswordInput(event) {
      const value = String((event.detail && event.detail.value) || '')
      if (this.rememberedPasswordCipher && value !== REMEMBERED_PASSWORD_MASK) {
        this.rememberedPasswordCipher = ''
      }
      this.password = value
    },
    toggleRememberAccount() {
      this.rememberAccount = !this.rememberAccount
      if (!this.rememberAccount) {
        this.rememberPassword = false
        this.rememberedAccount = ''
        this.rememberedPasswordCipher = ''
        if (this.password === REMEMBERED_PASSWORD_MASK) this.password = ''
        try { uni.removeStorageSync(LOGIN_PREFERENCES_KEY) } catch (error) {}
      }
    },
    toggleRememberPassword() {
      this.rememberPassword = !this.rememberPassword
      if (this.rememberPassword) {
        this.rememberAccount = true
      } else {
        this.rememberedPasswordCipher = ''
        if (this.password === REMEMBERED_PASSWORD_MASK) this.password = ''
        this.persistLoginPreferences()
      }
    },
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
          this.enableCaptcha = isEnabledFlag(cfg.EnableCaptcha)
          if (this.enableCaptcha) {
            this.getCaptcha()
          } else {
            this.captchaId = ''
            this.captchaValue = ''
            this.captchaImgSrc = ''
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
      if (!path) return '/static/microi-blue-256.png'
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
     * 平台授权登录（跨平台：微信/支付宝/飞书/抖音等）
     * 流程：先用 uni.login() 的 LoginCode 尝试 openid 登录
     *       若用户未绑定，则弹出手机号授权按钮进行注册绑定
     */
    async handleAuthLogin() {
      if (!this.checkPrivacy()) return

      const provider = getLoginProvider()
      if (!provider) {
        uni.showToast({ title: this.t('login.authNotSupported'), icon: 'none' })
        this.showAccountLogin = true
        return
      }

      this.wxLoginLoading = true
      try {
        // 1. 调用平台登录获取 code（用于 jscode2session 换 openid）
        let loginRes
        try {
          loginRes = await uni.login({ provider })
        } catch (loginErr) {
          console.error('uni.login 调用失败:', loginErr)
          uni.showToast({ title: this.t('login.authLoginFailed'), icon: 'none' })
          this.wxLoginLoading = false
          return
        }
        if (!loginRes || !loginRes.code) {
          console.error('uni.login 返回数据异常:', loginRes)
          uni.showToast({ title: this.t('login.authLoginFailed'), icon: 'none' })
          this.wxLoginLoading = false
          return
        }

        const loginCode = loginRes.code
        this.cachedLoginCode = loginCode

        // 2. 用 LoginCode 尝试 openid 登录（不传 Code，后端只做 openid 查找）
        const authApi = getAuthLoginApi(appConfig)
        const result = await post(authApi, {
          LoginCode: loginCode,
          OsClient: appConfig.osClient,
          ...invitationPayload()
        }, false)

        if (result.Code === 1 && result.Data) {
          // 已绑定用户，直接登录成功
          const token = getToken()
          if (token) {
            setUser(result.Data)
            this.showLoginSuccess(result.Data)
            this.navigateAfterLogin()
          } else {
            const bodyToken = result.Data.Token || result.Data.token
            if (bodyToken) {
              setToken(bodyToken)
              setUser(result.Data)
              this.showLoginSuccess(result.Data)
              this.navigateAfterLogin()
            } else {
              uni.showToast({ title: this.t('login.pleaseUseAccount'), icon: 'none' })
              this.showAccountLogin = true
            }
          }
        } else {
          const msg = result.Msg || this.t('login.loginFailed')
          // 未绑定帐号，显示手机号授权按钮进行注册绑定
          if (msg.includes('未绑定') || msg.includes('未注册') || result.Code === 1001) {
            this.showPhoneAuth = true
          } else {
            uni.showToast({ title: msg, icon: 'none', duration: 2500 })
          }
        }
      } catch (e) {
        console.error('授权登录异常:', e)
        uni.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      } finally {
        this.wxLoginLoading = false
      }
    },

    /**
     * 微信手机号授权回调（新用户注册绑定）
     * 通过 <button open-type="getPhoneNumber"> 触发
     */
    async handleGetPhoneNumber(e) {
      if (e.detail.errMsg && !e.detail.errMsg.includes('ok')) {
        uni.showToast({ title: '您已取消手机号授权', icon: 'none' })
        return
      }
      const phoneCode = e.detail.code
      if (!phoneCode) {
        uni.showToast({ title: '获取手机号授权码失败', icon: 'none' })
        return
      }

      this.phoneAuthLoading = true
      try {
        // cachedLoginCode 已在第一步 jscode2session 中被消费（code 只能用一次，微信返回 40163），
        // 必须重新调用 uni.login 获取全新的 LoginCode 供后端换 openid 使用。
        let loginCode = ''
        try {
          const provider = getLoginProvider()
          const loginRes = await uni.login({ provider })
          if (loginRes && loginRes.code) {
            loginCode = loginRes.code
            this.cachedLoginCode = loginCode
          }
        } catch (err) {
          console.warn('[Login] 重新获取 LoginCode 失败:', err)
        }
        if (!loginCode) {
          uni.showToast({ title: '获取登录凭证失败，请重试', icon: 'none' })
          this.phoneAuthLoading = false
          return
        }

        const authApi = getAuthLoginApi(appConfig)
        const result = await post(authApi, {
          LoginCode: loginCode,
          Code: phoneCode,
          OsClient: appConfig.osClient,
          ...invitationPayload()
        }, false)

        if (result.Code === 1 && result.Data) {
          const token = getToken()
          if (token) {
            setUser(result.Data)
            this.showLoginSuccess(result.Data)
            this.navigateAfterLogin()
          } else {
            const bodyToken = result.Data.Token || result.Data.token
            if (bodyToken) {
              setToken(bodyToken)
              setUser(result.Data)
              this.showLoginSuccess(result.Data)
              this.navigateAfterLogin()
            } else {
              uni.showToast({ title: this.t('login.pleaseUseAccount'), icon: 'none' })
              this.showAccountLogin = true
            }
          }
          this.showPhoneAuth = false
        } else {
          const msg = result.Msg || this.t('login.loginFailedMsg')
          uni.showToast({ title: msg, icon: 'none', duration: 2500 })
        }
      } catch (e) {
        console.error('手机号授权登录异常:', e)
        uni.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      } finally {
        this.phoneAuthLoading = false
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
        const canReuseRememberedCipher = this.rememberPassword &&
          this.password === REMEMBERED_PASSWORD_MASK &&
          !!this.rememberedPasswordCipher &&
          this.account.trim() === this.rememberedAccount
        // 本地只复用曾成功登录的 RSA 密文，永不保存明文密码。
        const encryptedPwd = canReuseRememberedCipher
          ? this.rememberedPasswordCipher
          : encryptPassword(this.password)
        if (!encryptedPwd) {
          uni.showToast({ title: this.t('login.encryptionFailed'), icon: 'none' })
          this.accountLoginLoading = false
          return
        }

        const loginData = {
          Account: this.account.trim(),
          Pwd: encryptedPwd,
          OsClient: appConfig.osClient,
          _ClientType: getClientType()
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
          this.persistLoginPreferences(encryptedPwd)
          this.showLoginSuccess(result.Data)
          this.navigateAfterLogin()
        } else {
          if (canReuseRememberedCipher) this.clearRememberedPassword()
          const msg = result.Msg || this.t('login.loginFailedMsg')
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
     * 登录完成后返回原生业务页或首页。
     */
    navigateAfterLogin() {
      setTimeout(() => {
        // 如果有重定向地址（从其他页面跳转来的），回到该页面
        if (this.redirectUrl) {
          console.log('[Login] redirectTo:', this.redirectUrl)
          uni.redirectTo({
            url: this.redirectUrl,
            fail: () => {
              // 可能是 tabBar 页面，用 switchTab
              uni.switchTab({ url: this.redirectUrl })
            }
          })
          return
        }

        // 默认返回上一页（用户从哪来就回到哪）
        console.log('[Login] navigateBack: 返回上一页...')
        const pages = getCurrentPages()
        if (pages.length > 1) {
          uni.navigateBack({
            fail: () => {
              // 如果返回失败，跳首页
              uni.switchTab({ url: '/pages/workspace/index' })
            }
          })
        } else {
          // 没有上一页（直接打开的登录页），跳到首页 Tab
          uni.switchTab({
            url: '/pages/workspace/index',
            fail: (err) => {
              console.error('[Login] switchTab 失败:', err)
              uni.reLaunch({ url: '/pages/workspace/index' })
            }
          })
        }
      }, 1500)
    },

    /**
     * 跳转到隐私协议页
     */
    navigateToPrivacy() {
      uni.navigateTo({
        url: '/pages/privacy/index'
      })
    },

    /**
     * 返回上一页或商城首页
     */
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack({ delta: 1 })
      } else {
        uni.switchTab({ url: '/pages/workspace/index' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background: #063b5c;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.login-water,
.login-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.login-water {
  opacity: 0.86;
  transform: scale(1.02);
  animation: loginWaterDrift 14s ease-in-out infinite;
}

@keyframes loginWaterDrift {
  0%, 100% { transform: scale(1.02) translate3d(0, 0, 0); }
  50% { transform: scale(1.055) translate3d(-0.8%, -0.4%, 0); }
}

.login-shade {
  background:
    linear-gradient(155deg, rgba(2, 30, 48, 0.92) 0%, rgba(4, 64, 87, 0.78) 54%, rgba(4, 82, 102, 0.58) 100%),
    linear-gradient(180deg, rgba(2, 24, 38, 0.08), rgba(2, 24, 38, 0.70));
}

/* 顶部返回导航 */
.login-nav {
  width: 100%;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.login-nav-back {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  width: fit-content;
}

.login-nav-back-icon {
  font-size: 48rpx;
  color: rgba(255,255,255,0.9);
  font-weight: 300;
  line-height: 1;
  margin-right: 4rpx;
}

.login-nav-back-text {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
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
  z-index: 3;
}

/* Logo 区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 58rpx;
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
  letter-spacing: 0;
  margin-bottom: 12rpx;
}

.app-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0;
}

/* 授权登录区域 */
.auth-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mp-login-btn {
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.15);
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }

  width: 100%;
  height: 96rpx;
  background: #e94b2c;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  letter-spacing: 0;
  box-shadow: 0 8rpx 24rpx rgba(159, 51, 30, 0.32);
  transition: all 0.3s;

  &::after {
    border: none;
  }

}

.phone-auth-tip {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  margin-bottom: 32rpx;
  line-height: 1.6;
}

.phone-auth-btn {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%) !important;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.4) !important;
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
  border-radius: 16rpx;
  height: 96rpx;
  padding: 0 32rpx;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:focus-within {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
  }
}

.input-label {
  flex: 0 0 auto;
  width: 76rpx;
  margin-right: 14rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 25rpx;
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
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.15);
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }

  width: 100%;
  height: 96rpx;
  background: rgba(255, 255, 255, 0.95);
  color: #0b7dbb;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  letter-spacing: 0;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
  margin-top: 10rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.7;
  }

}

.remember-options {
  width: 100%;
  margin: -4rpx 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.remember-option {
  min-height: 56rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: rgba(255, 255, 255, .88);
  font-size: 25rpx;
}

.remember-check {
  width: 34rpx;
  height: 34rpx;
  box-sizing: border-box;
  border: 2rpx solid rgba(255, 255, 255, .62);
  border-radius: 7rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 23rpx;
  line-height: 1;
}

.remember-check--checked {
  border-color: #19a6b7;
  background: #19a6b7;
  box-shadow: 0 4rpx 12rpx rgba(25, 166, 183, .25);
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
  padding-bottom: calc(30rpx + var(--mci-safe-bottom));
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.login-footer-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
}
</style>
