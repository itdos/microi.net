<template>
  <view
    class="login-container"
    :class="{ 'login-container--scrollable': runtimeEndpointEditorEnabled && platformConnectionExpanded }"
    :style="mciTokenStyle"
  >
    <view class="login-shade"></view>
    <!-- 顶部导航：返回按钮 -->
    <view class="login-nav mci-safe-top">
      <view v-if="!loginRootMode" class="login-nav-back" role="button" tabindex="0" @tap="goBack" @keydown.enter="goBack">
        <view class="login-nav-back-icon" aria-hidden="true" />
        <text class="login-nav-back-text">{{ t('common.back') }}</text>
      </view>
    </view>

    <!-- 主体内容 -->
    <view class="login-content">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <image class="logo-image" :src="runtimeBranding.logoUrl" mode="aspectFit" />
        <text class="app-name">{{ runtimeBranding.appName }}</text>
        <text class="app-subtitle">{{ runtimeBranding.appSubTitle }}</text>
      </view>

      <view class="app-endpoint-card" v-if="runtimeEndpointEditorEnabled">
        <view class="app-endpoint-summary" role="button" tabindex="0" :aria-expanded="platformConnectionExpanded" @tap="togglePlatformConnection" @keyup.enter="togglePlatformConnection" @keyup.space.prevent="togglePlatformConnection">
          <view class="app-endpoint-summary-copy">
            <view class="app-endpoint-title-row">
              <text class="app-endpoint-title">{{ endpointEditorTitle }}</text>
              <text class="app-endpoint-status">已连接</text>
            </view>
            <text class="app-endpoint-current">{{ appliedApiBase }} · {{ appliedOsClient }}</text>
          </view>
          <view class="app-endpoint-switch">
            <view class="app-endpoint-switch-icon" aria-hidden="true"><view /><view /></view>
            <text>{{ platformConnectionExpanded ? '收起' : '切换' }}</text>
          </view>
        </view>

        <view class="app-endpoint-editor" v-if="platformConnectionExpanded">
          <text class="app-endpoint-help">{{ endpointEditorHelp }}</text>

          <view class="app-endpoint-field">
            <text class="app-endpoint-label">API 地址</text>
            <view class="app-endpoint-api-row">
              <view class="app-endpoint-protocol app-endpoint-protocol-value"><text>https://</text></view>
              <input
                class="app-endpoint-input app-endpoint-host-input"
                type="text"
                :value="apiHost"
                :disabled="platformConnectionApplying"
                placeholder="api.example.com"
                placeholder-style="color:rgba(255,255,255,.48);font-size:24rpx;"
                maxlength="240"
                @input="handleApiHostInput"
              />
            </view>
          </view>

          <view class="app-endpoint-field">
            <text class="app-endpoint-label">租户 OsClient</text>
            <input
              class="app-endpoint-input"
              type="text"
              :value="runtimeOsClient"
              :disabled="platformConnectionApplying"
              placeholder="例如 tenant01"
              placeholder-style="color:rgba(255,255,255,.48);font-size:24rpx;"
              maxlength="128"
              @input="handleRuntimeOsClientInput"
            />
          </view>

          <button
            class="app-endpoint-apply"
            :loading="platformConnectionApplying"
            :disabled="platformConnectionApplying || !endpointDirty"
            @tap="applyPlatformConnection"
          >
            <view class="app-endpoint-apply-icon" aria-hidden="true" />
            <text>{{ platformConnectionApplying ? '正在验证平台' : '连接并应用' }}</text>
          </button>
        </view>
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
          <view class="switch-login" role="button" tabindex="0" @tap="showPhoneAuth = false" @keyup.enter="showPhoneAuth = false" @keyup.space.prevent="showPhoneAuth = false">
            <view class="switch-arrow switch-arrow--back" aria-hidden="true" />
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

        <view class="switch-login" v-if="!showPhoneAuth" role="button" tabindex="0" @tap="showAccountLogin = true" @keyup.enter="showAccountLogin = true" @keyup.space.prevent="showAccountLogin = true">
          <text>{{ t('login.accountLogin') }}</text>
          <view class="switch-arrow" aria-hidden="true" />
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
              placeholder-style="color:rgba(23,49,61,.46);font-size:28rpx;"
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
              placeholder-style="color:rgba(23,49,61,.46);font-size:28rpx;"
              maxlength="50"
              @input="handlePasswordInput"
              @confirm="handleAccountLogin"
            />
            <view class="pwd-toggle" role="button" tabindex="0" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @tap="showPassword = !showPassword" @keyup.enter="showPassword = !showPassword" @keyup.space.prevent="showPassword = !showPassword">
              <view class="pwd-toggle-icon" :class="{ 'pwd-toggle-icon--visible': showPassword }" aria-hidden="true"><view /></view>
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
              placeholder-style="color:rgba(23,49,61,.46);font-size:28rpx;"
              maxlength="6"
              @confirm="handleAccountLogin"
            />
            <view class="captcha-image-wrapper" role="button" tabindex="0" aria-label="刷新验证码" @tap="getCaptcha" @keyup.enter="getCaptcha" @keyup.space.prevent="getCaptcha">
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
          <view class="remember-option" role="checkbox" tabindex="0" :aria-checked="rememberAccount" @tap="toggleRememberAccount" @keyup.enter="toggleRememberAccount" @keyup.space.prevent="toggleRememberAccount">
            <view class="remember-check" :class="{ 'remember-check--checked': rememberAccount }">
              <view v-if="rememberAccount" class="check-icon" aria-hidden="true" />
            </view>
            <text>记住账号</text>
          </view>
          <view class="remember-option" role="checkbox" tabindex="0" :aria-checked="rememberPassword" @tap="toggleRememberPassword" @keyup.enter="toggleRememberPassword" @keyup.space.prevent="toggleRememberPassword">
            <view class="remember-check" :class="{ 'remember-check--checked': rememberPassword }">
              <view v-if="rememberPassword" class="check-icon" aria-hidden="true" />
            </view>
            <text>记住密码</text>
          </view>
        </view>

        <!-- 登录按钮 -->
        <button
          class="account-login-btn"
          :loading="accountLoginLoading"
          :disabled="accountLoginLoading || platformConnectionApplying"
          @tap="handleAccountLogin"
        >
          <view class="account-login-btn__icon" aria-hidden="true"><view class="account-login-btn__icon-arrow" /></view>
          <text>{{ t('login.loginBtn') }}</text>
        </button>

        <!-- 切换回授权登录（仅支持授权登录的平台显示） -->
        <view class="switch-login" v-if="hasAuthLogin" role="button" tabindex="0" @tap="showAccountLogin = false" @keyup.enter="showAccountLogin = false" @keyup.space.prevent="showAccountLogin = false">
          <view class="switch-arrow switch-arrow--back" aria-hidden="true" />
          <text>{{ t('login.authLogin') }}</text>
        </view>
      </view>

      <!-- 隐私协议 -->
      <view class="privacy-section" v-if="enablePrivacyPolicy">
        <view class="privacy-check" role="checkbox" tabindex="0" :aria-checked="privacyChecked" @tap="privacyChecked = !privacyChecked" @keyup.enter="privacyChecked = !privacyChecked" @keyup.space.prevent="privacyChecked = !privacyChecked">
          <view
            class="check-box"
            :class="{ checked: privacyChecked }"
          >
            <view v-if="privacyChecked" class="check-icon" aria-hidden="true" />
          </view>
          <text class="privacy-text">{{ t('login.agreePre') }}</text>
          <text
            class="privacy-link"
            role="link"
            tabindex="0"
            @tap.stop="navigateToService"
            @keyup.enter.stop="navigateToService"
            @keyup.space.stop.prevent="navigateToService"
          >{{ t('login.serviceAgreement') }}</text>
          <text class="privacy-text">{{ t('login.and') }}</text>
          <text
            class="privacy-link"
            role="link"
            tabindex="0"
            @tap.stop="navigateToPrivacy"
            @keyup.enter.stop="navigateToPrivacy"
            @keyup.space.stop.prevent="navigateToPrivacy"
          >{{ t('login.privacyPolicy') }}</text>
        </view>
      </view>
    </view>

    <!-- 底部信息 -->
    <view class="footer">
      <text class="login-footer-text">© {{ currentYear }} {{ runtimeBranding.appName }}</text>
    </view>
  </view>
</template>

<script>
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import {
  applyAppRuntimeEndpoint,
  applyRuntimeSysConfig,
  getPlatformSysConfigResult,
  getToken,
  post,
  postUserSession,
  probeAppRuntimeEndpoint,
  removeToken,
  setToken,
  setUser
} from '@/utils/request.js'
import { encryptPassword } from '@/utils/crypto.js'
import { captureInvitation, invitationPayload } from '@/platform/invitation.js'
import {
  getLoginProvider,
  getAuthLoginApi,
  getClientType,
  getPlatformName,
  getPlatformNameEn,
  supportsAuthLogin
} from '@/utils/platform.js'
import { shouldResumePreviousPage } from '@/platform/login-navigation.mjs'
import {
  APP_RUNTIME_ENDPOINT_PROTOCOLS,
  buildAppRuntimeEndpoint,
  runtimeEndpointScope,
  splitRuntimeApiBase
} from '@/platform/runtime-endpoint.mjs'
import { resetSysConfigRuntimeCache } from '@/utils/sysconfig.js'
import { resetBusinessRuntimeCache } from '@/platform/business-runtime.js'
import { disconnectSignalR } from '@/utils/signalr.js'
import { isRootLoginEntry } from '@/platform/auth-entry.mjs'

function isEnabledFlag(value) {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    return text === '1' || text === 'true' || text === 'yes' || text === 'on'
  }
  return false
}

const LOGIN_PREFERENCES_KEY = 'mci_login_preferences_v2'
const LEGACY_LOGIN_PREFERENCES_KEY = 'mci_login_preferences_v1'
const MAX_LOGIN_PREFERENCE_SCOPES = 12
const REMEMBERED_PASSWORD_MASK = '••••••••'

function normalizeAuthLoginUser(data) {
  if (!data || typeof data !== 'object') return {}
  return data.CurrentUser && typeof data.CurrentUser === 'object'
    ? data.CurrentUser
    : data
}

function getLoginResultToken(data) {
  if (!data || typeof data !== 'object') return ''
  return String(data.Token || data.token || '')
}

function isValidLoginSession(user, token) {
  return !!(token && user && user.Id)
}

export default {
  mixins: [themeMixin],
  data() {
    const runtimeEndpoint = splitRuntimeApiBase(appConfig.apiBase)
    return {
      // 平台信息（从 config 解构，避免整个模块对象被 reactive 化导致小程序报错）
      enablePrivacyPolicy: appConfig.enablePrivacyPolicy,
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
      loginRootMode: false,
      // 登录后重定向地址（从商品详情等页面跳过来时用）
      redirectUrl: '',
      // 商店 App 与本地 H5 预览可编辑；部署域名 H5 和小程序保持关闭。
      runtimeEndpointEditorEnabled: appConfig.runtimeEndpointEditorEnabled === true,
      endpointEditorTitle: '平台连接',
      endpointEditorHelp: '连接企业提供的 Microi HTTPS 服务。请确认地址与 OsClient 均来自企业管理员。',
      apiProtocolOptions: [...APP_RUNTIME_ENDPOINT_PROTOCOLS],
      apiProtocolIndex: APP_RUNTIME_ENDPOINT_PROTOCOLS.indexOf(runtimeEndpoint.protocol),
      apiHost: runtimeEndpoint.apiHost,
      runtimeOsClient: appConfig.osClient,
      appliedApiBase: appConfig.apiBase,
      appliedOsClient: appConfig.osClient,
      platformConnectionExpanded: false,
      platformConnectionApplying: false,
      endpointEditDirty: false,
      runtimeEndpointChanged: false
    }
  },

  computed: {
    endpointDirty() {
      if (!this.runtimeEndpointEditorEnabled) return false
      try {
        const endpoint = buildAppRuntimeEndpoint({
          protocol: this.apiProtocolOptions[this.apiProtocolIndex],
          apiHost: this.apiHost,
          osClient: this.runtimeOsClient
        })
        return endpoint.apiBase !== this.appliedApiBase || endpoint.osClient !== this.appliedOsClient
      } catch (error) {
        return true
      }
    }
  },

  onLoad(options) {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    this.loginRootMode = isRootLoginEntry(options || {}, pages.length)
    captureInvitation(options || {})
    this.restoreLoginPreferences()
    // “我的 → 平台连接”是用户主动进入的配置入口；其余登录场景仍默认收起。
    if (options && options.endpoint === '1' && this.runtimeEndpointEditorEnabled) {
      this.platformConnectionExpanded = true
    }
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

  onBackPress() {
    return this.loginRootMode
  },

  methods: {
    currentLoginPreferenceScope() {
      return runtimeEndpointScope(appConfig.apiBase, appConfig.osClient)
    },
    readLoginPreferenceStore() {
      try {
        const saved = uni.getStorageSync(LOGIN_PREFERENCES_KEY)
        if (saved && Number(saved.version) === 2 && saved.records && typeof saved.records === 'object') {
          return { version: 2, records: { ...saved.records } }
        }
      } catch (error) {}
      return { version: 2, records: {} }
    },
    writeLoginPreferenceStore(store) {
      const records = store && store.records && typeof store.records === 'object' ? store.records : {}
      const retained = {}
      Object.keys(records)
        .sort((left, right) => Number(records[right] && records[right].updatedAt || 0) - Number(records[left] && records[left].updatedAt || 0))
        .slice(0, MAX_LOGIN_PREFERENCE_SCOPES)
        .forEach((key) => { retained[key] = records[key] })
      try {
        if (Object.keys(retained).length) {
          uni.setStorageSync(LOGIN_PREFERENCES_KEY, { version: 2, records: retained })
        } else {
          uni.removeStorageSync(LOGIN_PREFERENCES_KEY)
        }
      } catch (error) {}
    },
    readLegacyLoginPreference() {
      try {
        const currentScope = this.currentLoginPreferenceScope()
        const defaultScope = runtimeEndpointScope(appConfig.defaultApiBase, appConfig.defaultOsClient)
        if (currentScope !== defaultScope) return null
        const saved = uni.getStorageSync(LEGACY_LOGIN_PREFERENCES_KEY)
        return saved && typeof saved === 'object' ? saved : null
      } catch (error) {
        return null
      }
    },
    restoreLoginPreferences() {
      const store = this.readLoginPreferenceStore()
      const scope = this.currentLoginPreferenceScope()
      let saved = store.records[scope]
      if (!saved) {
        saved = this.readLegacyLoginPreference()
        if (saved) {
          store.records[scope] = { ...saved, version: 2, updatedAt: Date.now() }
          this.writeLoginPreferenceStore(store)
        }
      }
      saved = saved || {}
      const account = String(saved.account || '').trim()
      const passwordCipher = String(saved.passwordCipher || '')
      this.rememberAccount = saved.rememberAccount === true && !!account
      this.rememberPassword = this.rememberAccount && saved.rememberPassword === true && !!passwordCipher
      this.rememberedAccount = this.rememberAccount ? account : ''
      this.rememberedPasswordCipher = this.rememberPassword ? passwordCipher : ''
      this.account = this.rememberedAccount
      this.password = this.rememberPassword ? REMEMBERED_PASSWORD_MASK : ''
    },
    removeCurrentLoginPreference() {
      const store = this.readLoginPreferenceStore()
      delete store.records[this.currentLoginPreferenceScope()]
      this.writeLoginPreferenceStore(store)
    },
    persistLoginPreferences(passwordCipher = '') {
      if (!this.rememberAccount) {
        this.removeCurrentLoginPreference()
        return
      }
      const account = String(this.account || '').trim()
      const cipher = this.rememberPassword ? String(passwordCipher || this.rememberedPasswordCipher || '') : ''
      const store = this.readLoginPreferenceStore()
      store.records[this.currentLoginPreferenceScope()] = {
        version: 2,
        rememberAccount: true,
        rememberPassword: this.rememberPassword && !!cipher,
        account,
        passwordCipher: cipher,
        updatedAt: Date.now()
      }
      this.writeLoginPreferenceStore(store)
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
        this.removeCurrentLoginPreference()
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
    clearLoginIdentityForEndpointEdit() {
      this.account = ''
      this.password = ''
      this.showPassword = false
      this.rememberAccount = false
      this.rememberPassword = false
      this.rememberedAccount = ''
      this.rememberedPasswordCipher = ''
      this.privacyChecked = false
      this.captchaId = ''
      this.captchaValue = ''
      this.captchaImgSrc = ''
    },
    markEndpointDraftChanged() {
      const dirty = this.endpointDirty
      if (dirty && !this.endpointEditDirty) this.clearLoginIdentityForEndpointEdit()
      if (!dirty && this.endpointEditDirty) this.restoreLoginPreferences()
      this.endpointEditDirty = dirty
    },
    togglePlatformConnection() {
      this.platformConnectionExpanded = !this.platformConnectionExpanded
    },
    handleApiHostInput(event) {
      this.apiHost = String((event.detail && event.detail.value) || '')
      this.markEndpointDraftChanged()
    },
    handleRuntimeOsClientInput(event) {
      this.runtimeOsClient = String((event.detail && event.detail.value) || '')
      this.markEndpointDraftChanged()
    },
    async applyPlatformConnection(options = {}) {
      if (!this.runtimeEndpointEditorEnabled || this.platformConnectionApplying) return !this.endpointDirty
      const showSuccess = options && options.showSuccess !== false
      this.platformConnectionApplying = true
      try {
        const draftEndpoint = buildAppRuntimeEndpoint({
          protocol: this.apiProtocolOptions[this.apiProtocolIndex],
          apiHost: this.apiHost,
          osClient: this.runtimeOsClient
        })
        // 先匿名读取候选租户配置；拼写错误或不可达时不破坏当前会话与缓存。
        const probed = await probeAppRuntimeEndpoint(draftEndpoint)
        const hadDraftIdentity = this.endpointEditDirty && !!(String(this.account || '').trim() || this.password)
        const endpointChanged = draftEndpoint.apiBase !== appConfig.apiBase || draftEndpoint.osClient !== appConfig.osClient
        if (endpointChanged) disconnectSignalR()
        const applied = applyAppRuntimeEndpoint(draftEndpoint)
        if (applied.changed) {
          resetSysConfigRuntimeCache()
          resetBusinessRuntimeCache()
          this.runtimeEndpointChanged = true
        }

        this.appliedApiBase = applied.apiBase
        this.appliedOsClient = applied.osClient
        this.apiProtocolIndex = this.apiProtocolOptions.indexOf(applied.protocol)
        this.apiHost = applied.apiHost
        this.runtimeOsClient = applied.osClient
        this.endpointEditDirty = false
        if (applied.changed && !hadDraftIdentity) this.restoreLoginPreferences()
        this.applySysConfig(probed.sysConfig)
        this.platformConnectionExpanded = false

        if (showSuccess) {
          uni.showToast({ title: `已连接 ${applied.osClient}`, icon: 'success' })
        }
        return true
      } catch (error) {
        const message = error && (error.message || error.Msg) ? (error.message || error.Msg) : '平台连接失败，请检查配置'
        uni.showModal({ title: '无法连接平台', content: String(message), showCancel: false })
        return false
      } finally {
        this.platformConnectionApplying = false
      }
    },
    /**
     * 获取系统配置
     */
    applySysConfig(cfg = {}) {
      applyRuntimeSysConfig(cfg)

      this.enableCaptcha = isEnabledFlag(cfg.EnableCaptcha)
      if (this.enableCaptcha) {
        this.getCaptcha()
      } else {
        this.captchaId = ''
        this.captchaValue = ''
        this.captchaImgSrc = ''
      }

      this.enablePrivacyPolicy = cfg.EnablePrivacyPolicy === undefined
        ? isEnabledFlag(appConfig.enablePrivacyPolicy)
        : isEnabledFlag(cfg.EnablePrivacyPolicy)
    },
    async getSysConfig() {
      try {
        const result = await getPlatformSysConfigResult({
          _SearchEqual: { IsEnable: 1 },
          OsClient: appConfig.osClient
        })

        if (result.Code === 1 && result.Data) {
          this.applySysConfig(result.Data)
        }
      } catch (e) {
        console.error('获取系统配置失败:', e)
      }
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
          const currentUser = normalizeAuthLoginUser(result.Data)
          let token = getToken()
          if (!token) {
            token = getLoginResultToken(result.Data)
            if (token) setToken(token)
          }
          if (!isValidLoginSession(currentUser, token)) {
            removeToken()
            uni.showToast({ title: this.t('login.pleaseUseAccount'), icon: 'none' })
            this.showAccountLogin = true
            return
          }
          setUser(currentUser)
          this.navigateAfterLogin()
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
          const currentUser = normalizeAuthLoginUser(result.Data)
          let token = getToken()
          if (!token) {
            token = getLoginResultToken(result.Data)
            if (token) setToken(token)
          }
          if (!isValidLoginSession(currentUser, token)) {
            removeToken()
            uni.showToast({ title: this.t('login.pleaseUseAccount'), icon: 'none' })
            this.showAccountLogin = true
            return
          }
          setUser(currentUser)
          this.navigateAfterLogin()
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
      if (this.runtimeEndpointEditorEnabled && this.endpointDirty) {
        const connected = await this.applyPlatformConnection({ showSuccess: false })
        if (!connected) return
      }
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

        const result = await postUserSession('Login', loginData, false)

        if (result.Code === 1 && result.Data) {
          // Token 已由 request.js 自动从响应头提取并保存
          const currentUser = normalizeAuthLoginUser(result.Data)
          let token = getToken()
          console.log('[Login] 登录成功，Token:', token ? ('已保存，长度=' + token.length) : '未获取到')
          if (!token) {
            // 兜底：尝试从响应体提取
            const bodyToken = getLoginResultToken(result.Data)
            if (bodyToken) {
              setToken(bodyToken)
              token = bodyToken
              console.log('[Login] 从响应体提取 Token，长度:', bodyToken.length)
            }
          }
          if (!isValidLoginSession(currentUser, token)) {
            removeToken()
            uni.showToast({ title: '登录响应缺少有效身份，请重新登录', icon: 'none', duration: 2500 })
            return
          }
          setUser(currentUser)
          this.persistLoginPreferences(encryptedPwd)
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
          title: this.t('login.pleaseAgree'),
          icon: 'none',
          duration: 2000
        })
        return false
      }
      return true
    },

    /**
     * 完整会话建立后立即返回原生业务页或首页。
     */
    navigateAfterLogin() {
      // 切换平台后必须销毁旧平台页面栈，避免返回旧租户详情或继续使用旧页面内存。
      if (this.runtimeEndpointChanged) {
        uni.reLaunch({ url: '/pages/home/index' })
        return
      }
      const pages = getCurrentPages()
      const previousPage = pages.length > 1 ? pages[pages.length - 2] : null

      // 登录页由失效业务页 navigateTo 打开时，原页面仍在栈中；直接返回并触发其 onShow。
      // 禁止 redirectTo 同一路由，否则会形成“旧详情页 + 新详情页”的重复页面栈。
      if (this.redirectUrl && shouldResumePreviousPage(previousPage, this.redirectUrl)) {
        console.log('[Login] navigateBack: 恢复登录前页面...')
        uni.navigateBack({
          delta: 1,
          fail: () => uni.redirectTo({
            url: this.redirectUrl,
            fail: () => uni.switchTab({ url: this.redirectUrl })
          })
        })
        return
      }

      // 分享、扫码或冷启动没有可恢复页面时，才创建重定向目标页。
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
      if (pages.length > 1) {
        uni.navigateBack({
          fail: () => {
            // 如果返回失败，跳首页
            uni.switchTab({ url: '/pages/home/index' })
          }
        })
      } else {
        // 没有上一页（直接打开的登录页），跳到首页 Tab
        uni.switchTab({
          url: '/pages/home/index',
          fail: (err) => {
            console.error('[Login] switchTab 失败:', err)
            uni.reLaunch({ url: '/pages/home/index' })
          }
        })
      }
    },

    /**
     * 跳转到隐私协议页
     */
    navigateToPrivacy() {
      uni.navigateTo({
        url: '/pages/privacy/index'
      })
    },

    navigateToService() {
      uni.navigateTo({
        url: '/pages/service/index'
      })
    },

    /**
     * 返回上一页或商城首页
     */
    goBack() {
      if (this.loginRootMode) return
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack({ delta: 1 })
      } else {
        uni.switchTab({ url: '/pages/home/index' })
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

.login-container--scrollable {
  overflow-x: hidden;
  overflow-y: auto;

  .login-content {
    flex: none;
    justify-content: flex-start;
    padding-top: 36rpx;
    padding-bottom: 36rpx;
  }
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

/* 通用平台连接器：原生 App 与 localhost/loopback H5 预览可见。 */
.app-endpoint-card {
  width: 100%;
  box-sizing: border-box;
  margin: -24rpx 0 32rpx;
  padding: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, .22);
  border-radius: 20rpx;
  background: rgba(4, 47, 68, .48);
  box-shadow: 0 10rpx 30rpx rgba(1, 24, 38, .16);
  backdrop-filter: blur(16rpx);
}

.app-endpoint-summary,
.app-endpoint-title-row,
.app-endpoint-switch,
.app-endpoint-api-row,
.app-endpoint-warning,
.app-endpoint-apply {
  display: flex;
  align-items: center;
}

.app-endpoint-summary {
  min-height: 64rpx;
  justify-content: space-between;
}

.app-endpoint-summary-copy {
  min-width: 0;
  flex: 1;
}

.app-endpoint-title-row {
  gap: 14rpx;
  margin-bottom: 8rpx;
}

.app-endpoint-title {
  color: #fff;
  font-size: 28rpx;
  font-weight: 650;
}

.app-endpoint-status {
  padding: 3rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(55, 211, 154, .18);
  color: #8ff0c8;
  font-size: 20rpx;
}

.app-endpoint-current {
  display: block;
  max-width: 470rpx;
  overflow: hidden;
  color: rgba(255, 255, 255, .66);
  font-size: 22rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-endpoint-switch {
  flex: none;
  min-height: 60rpx;
  margin-left: 18rpx;
  gap: 8rpx;
  color: #fff;
  font-size: 24rpx;
}

.app-endpoint-switch-icon {
  color: #7ee2e8;
  font-size: 30rpx;
}

.app-endpoint-editor {
  margin-top: 22rpx;
  padding-top: 22rpx;
  border-top: 2rpx solid rgba(255, 255, 255, .14);
}

.app-endpoint-help {
  display: block;
  margin-bottom: 22rpx;
  color: rgba(255, 255, 255, .7);
  font-size: 22rpx;
  line-height: 1.55;
}

.app-endpoint-field {
  margin-bottom: 20rpx;
}

.app-endpoint-label {
  display: block;
  margin-bottom: 10rpx;
  color: rgba(255, 255, 255, .88);
  font-size: 24rpx;
}

.app-endpoint-api-row {
  width: 100%;
  gap: 12rpx;
}

.app-endpoint-protocol {
  flex: none;
  width: 168rpx;
}

.app-endpoint-protocol-value,
.app-endpoint-input {
  height: 82rpx;
  box-sizing: border-box;
  border: 2rpx solid rgba(255, 255, 255, .22);
  border-radius: 14rpx;
  background: rgba(255, 255, 255, .12);
  color: #fff;
  font-size: 26rpx;
}

.app-endpoint-protocol-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18rpx;
}

.app-endpoint-caret {
  color: rgba(255, 255, 255, .7);
  font-size: 24rpx;
}

.app-endpoint-input {
  width: 100%;
  padding: 0 22rpx;
}

.app-endpoint-host-input {
  min-width: 0;
  flex: 1;
}

.app-endpoint-warning {
  align-items: flex-start;
  gap: 12rpx;
  margin: 2rpx 0 20rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: rgba(245, 166, 35, .16);
  color: #ffe2a6;
  font-size: 22rpx;
  line-height: 1.5;
}

.app-endpoint-warning-icon {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  border: 2rpx solid currentColor;
  border-radius: 50%;
  text-align: center;
  font-size: 20rpx;
  line-height: 27rpx;
}

.app-endpoint-apply {
  width: 100%;
  height: 82rpx;
  justify-content: center;
  gap: 10rpx;
  border: 0;
  border-radius: 14rpx;
  background: #fff;
  color: #087da8;
  font-size: 27rpx;
  font-weight: 650;

  &::after { border: 0; }
  &[disabled] { opacity: .48; }
}

.app-endpoint-apply-icon {
  font-size: 26rpx;
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
  transition: transform 0.3s, opacity 0.3s, box-shadow 0.3s;

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
  color: #fff;
  opacity: 1;
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
  color: var(--mci-color-primary, #006b9f);
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
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

.account-login-btn__icon {
  position: relative;
  width: 30rpx;
  height: 31rpx;
  box-sizing: border-box;
  border: 3rpx solid currentColor;
  border-radius: 5rpx;
}

.account-login-btn__icon-arrow {
  position: absolute;
  top: 11rpx;
  left: -9rpx;
  width: 22rpx;
  height: 3rpx;
  border-radius: 3rpx;
  background: currentColor;
}

.account-login-btn__icon-arrow::after {
  position: absolute;
  top: -5rpx;
  right: -1rpx;
  width: 9rpx;
  height: 9rpx;
  border-top: 3rpx solid currentColor;
  border-right: 3rpx solid currentColor;
  transform: rotate(45deg);
  content: '';
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
  flex-wrap: wrap;
  row-gap: 4rpx;
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
  transition: background-color 0.2s, border-color 0.2s, transform 0.2s;
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

<style lang="scss" scoped>
/* Light Field login: one solid credential deck on the tenant field. */
.login-container { background: var(--mci-gradient-primary); }
.login-water { display: none; }
.login-shade { background: linear-gradient(160deg, rgba(2,28,45,.20), rgba(255,255,255,.02) 54%, rgba(255,241,228,.14) 100%); }
.login-nav-back { min-width: 112rpx; min-height: 88rpx; padding: 0 28rpx; gap: 10rpx; border-radius: 999rpx; outline: none; }
.login-nav-back:focus-visible { box-shadow: 0 0 0 4rpx rgba(255,255,255,.72); }
.login-nav-back-icon { width: 18rpx; height: 18rpx; margin: 0; border-bottom: 4rpx solid currentColor; border-left: 4rpx solid currentColor; border-radius: 2rpx; color: var(--mci-text-on-primary, #fff); transform: rotate(45deg); }
.login-nav-back-text { color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 26rpx; }
.login-content { padding: 12rpx 34rpx 30rpx; }
.logo-section { margin-bottom: 34rpx; }
.logo-image { width: 118rpx; height: 118rpx; margin-bottom: 22rpx; border-radius: 30rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-contact); }
.app-name { margin-bottom: 8rpx; color: var(--mci-text-on-primary, #fff); font-size: 42rpx; font-weight: 740; letter-spacing: -.02em; }
.app-subtitle { color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 25rpx; }
.app-endpoint-card { margin: -8rpx 0 24rpx; padding: 22rpx 24rpx; border: 1rpx solid var(--mci-border-on-primary, rgba(255,255,255,.2)); border-radius: 24rpx; background: rgba(3,42,62,.54); box-shadow: none; backdrop-filter: none; }
.app-endpoint-summary { min-height: 76rpx; }
.app-endpoint-title { font-size: 26rpx; }
.app-endpoint-status { background: rgba(116,224,174,.16); color: #b6f3d4; }
.app-endpoint-switch { min-width: 104rpx; min-height: 88rpx; justify-content: flex-end; }
.app-endpoint-switch-icon { position: relative; width: 28rpx; height: 28rpx; color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); }
.app-endpoint-switch-icon > view { position: absolute; left: 2rpx; width: 22rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; }
.app-endpoint-switch-icon > view:first-child { top: 7rpx; }
.app-endpoint-switch-icon > view:last-child { bottom: 7rpx; }
.app-endpoint-switch-icon > view:first-child::after, .app-endpoint-switch-icon > view:last-child::before { position: absolute; width: 7rpx; height: 7rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; content: ''; }
.app-endpoint-switch-icon > view:first-child::after { top: -3rpx; right: 0; transform: rotate(45deg); }
.app-endpoint-switch-icon > view:last-child::before { bottom: -3rpx; left: 0; transform: rotate(-135deg); }
.app-endpoint-apply-icon { width: 18rpx; height: 10rpx; border-bottom: 4rpx solid currentColor; border-left: 4rpx solid currentColor; transform: rotate(-45deg); }
.form-section, .auth-section { box-sizing: border-box; width: 100%; padding: 30rpx 28rpx; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 36rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-deck); }
.input-group { margin-bottom: 20rpx; }
.input-wrapper { height: 94rpx; padding: 0 24rpx; border: 1rpx solid transparent; border-radius: 20rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.input-wrapper:focus-within { border-color: var(--mci-focus-ring, rgba(8,125,168,.38)); background: var(--mci-app-surface, #fefffe); box-shadow: 0 0 0 4rpx var(--mci-color-primary-soft, rgba(8,125,168,.09)); }
.input-label { color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.login-input { color: var(--mci-text-primary, #17313d); }
.pwd-toggle { min-width: 88rpx; min-height: 88rpx; margin-right: -18rpx; }
.pwd-toggle-icon { position: relative; width: 34rpx; height: 23rpx; border: 3rpx solid var(--mci-text-secondary, rgba(23,49,61,.66)); border-radius: 50% / 60%; opacity: .72; }
.pwd-toggle-icon > view { position: absolute; top: 6rpx; left: 12rpx; width: 7rpx; height: 7rpx; border-radius: 50%; background: currentColor; }
.pwd-toggle-icon:not(.pwd-toggle-icon--visible)::after { position: absolute; top: 8rpx; left: -5rpx; width: 42rpx; height: 3rpx; border-radius: 3rpx; background: var(--mci-text-secondary, rgba(23,49,61,.66)); content: ''; transform: rotate(-42deg); }
.remember-options { margin: 0 0 22rpx; }
.remember-option { min-height: 88rpx; color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 24rpx; }
.remember-check { width: 36rpx; height: 36rpx; border-color: var(--mci-border-color-hover, rgba(20,65,84,.18)); color: var(--mci-text-on-primary, #fff); }
.remember-check--checked { border-color: var(--mci-color-primary, #087da8); background: var(--mci-color-primary, #087da8); box-shadow: none; }
.check-icon { width: 14rpx; height: 8rpx; border-bottom: 3rpx solid currentColor; border-left: 3rpx solid currentColor; transform: rotate(-45deg); }
.account-login-btn { height: 94rpx; margin-top: 0; border-radius: 22rpx; background: var(--mci-gradient-primary); color: var(--mci-text-on-primary, #fff); box-shadow: var(--mci-shadow-button); }
.switch-login { min-height: 88rpx; margin-top: 16rpx; justify-content: center; gap: 10rpx; padding: 0; }
.switch-login text { color: var(--mci-color-primary, #087da8); font-size: 26rpx; }
.switch-arrow { width: 13rpx; height: 13rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; color: var(--mci-color-primary, #087da8); transform: rotate(45deg); }
.switch-arrow--back { transform: rotate(-135deg); }
.privacy-section { margin-top: 30rpx; }
.privacy-check { min-height: 88rpx; }
.check-box { width: 38rpx; height: 38rpx; border-color: var(--mci-border-on-primary, rgba(255,255,255,.2)); }
.check-box.checked { border-color: var(--mci-color-brand, #e54625); background: var(--mci-color-brand, #e54625); }
.privacy-text { color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); }
.privacy-link { color: var(--mci-text-on-primary, #fff); text-underline-offset: 5rpx; }
.footer { padding-top: 18rpx; }
.login-footer-text { color: var(--mci-text-on-primary-muted, rgba(255,255,255,.58)); }
@media (prefers-reduced-motion: reduce) { .login-water, .mp-login-btn, .account-login-btn { animation: none; transition: none; } }
</style>

<style lang="scss" scoped src="./login-signal.scss"></style>
