<template>
  <view class="profile-container" :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]">
    <view class="mci-page-texture"></view>
    <!-- 顶部用户卡片 -->
    <view class="user-card" :style="{ paddingTop: statusBarHeight + 'px', background: themeColor }">
      <view class="card-bg">
        <view class="bg-circle c1"></view>
        <view class="bg-circle c2"></view>
      </view>
      <view class="hero-actions">
        <view class="mode-toggle" @tap="toggleThemeMode">
          <text>{{ isDarkMode ? '☀️' : '🌙' }}</text>
        </view>
      </view>
      <view class="card-content">
        <!-- 骨架屏 -->
        <view class="user-info" v-if="loading">
          <view class="sk-avatar"></view>
          <view class="sk-info">
            <view class="sk-line" style="width:40%;height:28rpx;margin-bottom:12rpx;"></view>
            <view class="sk-line" style="width:55%;height:22rpx;"></view>
          </view>
        </view>
        <!-- 真实内容 -->
        <view class="user-info" v-else>
          <view class="user-avatar" :style="{ borderColor: 'rgba(255,255,255,0.5)' }">
            <text class="avatar-char">{{ (currentUser.Name || currentUser.Account || 'U').charAt(0) }}</text>
          </view>
          <view class="user-detail" v-if="isLoggedIn">
            <view class="user-name-row">
              <text class="user-name">{{ currentUser.Name || currentUser.Account || t('common.user') }}</text>
              <text class="tenant-tag" v-if="currentUser.TenantName">{{ currentUser.TenantName }}</text>
            </view>
            <text class="user-account">{{ currentUser.Account || '-' }}</text>
            <text class="user-org" v-if="orgInfo">{{ orgInfo }}</text>
          </view>
          <view class="user-detail" v-else>
            <text class="user-name">{{ t('common.notLoggedIn') }}</text>
            <text class="user-account" @tap="goLogin">{{ t('common.clickToLogin') }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="func-list">
      <!-- 主题与显示 -->
      <view class="func-group">
        <view class="func-item" @tap="showThemePanel = true">
          <view class="item-left">
            <view class="item-icon item-icon--primary">
              <text>🎨</text>
            </view>
            <text class="item-title">{{ t('profile.themeSwitch') }}</text>
          </view>
          <view class="item-right">
            <view class="theme-dot" :style="{ background: themeColor }"></view>
            <text class="arrow">›</text>
          </view>
        </view>
        <view class="func-item" @tap="showLangPanel = true">
          <view class="item-left">
            <view class="item-icon item-icon--cyan">
              <text>🌐</text>
            </view>
            <text class="item-title">{{ t('profile.langSwitch') }}</text>
          </view>
          <view class="item-right">
            <text class="item-value">{{ currentLangName }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 常用功能 -->
      <view class="func-group">
        <view class="func-item" @tap="goAbout">
          <view class="item-left">
            <view class="item-icon item-icon--blue">
              <text>ℹ️</text>
            </view>
            <text class="item-title">{{ t('profile.aboutSystem') }}</text>
          </view>
          <view class="item-right">
            <text class="item-value">{{ version }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
        <view class="func-item" @tap="goPrivacy">
          <view class="item-left">
            <view class="item-icon item-icon--purple">
              <text>🔐</text>
            </view>
            <text class="item-title">{{ t('profile.privacyPolicy') }}</text>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 账号相关 -->
      <view class="func-group" v-if="isLoggedIn">
        <view class="func-item" @tap="showPasswordDialog = true">
          <view class="item-left">
            <view class="item-icon item-icon--gold">
              <text>🔑</text>
            </view>
            <text class="item-title">{{ t('profile.changePassword') }}</text>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 退出登录 -->
      <view class="func-group" v-if="isLoggedIn">
        <view class="func-item logout-item" @tap="handleLogout">
          <view class="item-left">
            <view class="item-icon item-icon--danger">
              <text>🚪</text>
            </view>
            <text class="item-title">{{ t('profile.logout') }}</text>
          </view>
        </view>
      </view>

      <!-- 未登录时的登录入口 -->
      <view class="func-group" v-if="!isLoggedIn">
        <view class="func-item" @tap="goLogin">
          <view class="item-left">
            <view class="item-icon item-icon--blue">
              <text>🔓</text>
            </view>
            <text class="item-title item-title--primary">{{ t('common.loginNow') }}</text>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部 Powered by -->
    <view class="footer-info">
      <text class="footer-text">Powered by {{ companyName || 'Microi.net' }}</text>
    </view>

    <!-- 主题选择面板 -->
    <view class="sheet-mask" v-if="showThemePanel" @tap="showThemePanel = false">
      <view class="sheet-panel" @tap.stop>
        <view class="sheet-header">
          <text class="sheet-title">{{ t('profile.selectTheme') }}</text>
          <text class="sheet-close" @tap="showThemePanel = false">✕</text>
        </view>
        <view class="mode-section">
          <text class="mode-section-title">显示模式</text>
          <view class="mode-switch">
            <view class="mode-item" :class="{ active: themeMode === 'light' }" @tap="switchThemeMode('light')">
              <text class="mode-icon">☀️</text>
              <text class="mode-label">浅色</text>
            </view>
            <view class="mode-item" :class="{ active: themeMode === 'dark' }" @tap="switchThemeMode('dark')">
              <text class="mode-icon">🌙</text>
              <text class="mode-label">深色</text>
            </view>
          </view>
        </view>
        <view class="mode-section mode-section--theme">
          <text class="mode-section-title">主题色</text>
        </view>
        <view class="theme-grid">
          <view
            v-for="item in themeColors"
            :key="item.value"
            class="theme-item"
            :class="{ active: themeColor === item.value }"
            @tap="changeTheme(item.value)"
          >
            <view class="theme-color" :style="{ background: item.value }">
              <text class="theme-check" v-if="themeColor === item.value">✓</text>
            </view>
            <text class="theme-name">{{ item.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 语言选择面板 -->
    <view class="sheet-mask" v-if="showLangPanel" @tap="showLangPanel = false">
      <view class="sheet-panel" @tap.stop>
        <view class="sheet-header">
          <text class="sheet-title">{{ t('profile.selectLang') }}</text>
          <text class="sheet-close" @tap="showLangPanel = false">✕</text>
        </view>
        <view class="lang-list">
          <view
            v-for="item in langOptions"
            :key="item.value"
            class="lang-item"
            :class="{ active: _currentLang === item.value }"
            @tap="changeLang(item.value)"
          >
            <text class="lang-name">{{ item.label }}</text>
            <text class="lang-check" v-if="_currentLang === item.value">✓</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <view class="pwd-mask" v-if="showPasswordDialog" @tap="showPasswordDialog = false">
      <view class="pwd-panel" @tap.stop>
        <view class="pwd-header">
          <text class="pwd-title">{{ t('profile.changePassword') }}</text>
          <text class="pwd-close" @tap="showPasswordDialog = false">✕</text>
        </view>
        <view class="pwd-form">
          <view class="pwd-field">
            <text class="pwd-label">{{ t('profile.oldPassword') }}</text>
            <input type="password" v-model="passwordForm.oldPassword" :placeholder="t('profile.enterOldPwd')" class="pwd-input" />
          </view>
          <view class="pwd-field">
            <text class="pwd-label">{{ t('profile.newPassword') }}</text>
            <input type="password" v-model="passwordForm.newPassword" :placeholder="t('profile.enterNewPwd')" class="pwd-input" />
          </view>
          <view class="pwd-field">
            <text class="pwd-label">{{ t('profile.confirmPassword') }}</text>
            <input type="password" v-model="passwordForm.confirmPassword" :placeholder="t('profile.enterConfirmPwd')" class="pwd-input" />
          </view>
        </view>
        <view class="pwd-actions">
          <view class="pwd-cancel" @tap="showPasswordDialog = false">
            <text>取消</text>
          </view>
          <view class="pwd-confirm" @tap="submitPassword">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken, getUser, removeToken } from '@/utils/request.js'
import { post } from '@/utils/request.js'
import appConfig from '@/config.js'
import { themeMixin, setTheme } from '@/utils/theme.js'
import { setLang } from '@/utils/i18n.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'
import { encryptPassword } from '@/utils/crypto.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      loading: true,
      isLoggedIn: false,
      currentUser: {},
      companyName: '',
      version: 'v1.0.0',
      showPasswordDialog: false,
      showThemePanel: false,
      showLangPanel: false,
      passwordForm: {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      },
      // 主题色（MCI 设计系统色板：紫色为默认主色，搭配蓝/青/粉/橙/红/绿等多彩选项）
      // 注意：data() 阶段 this.t 尚未挂载，此处仅存放 value+i18nKey，由 computed 生成 name
      themeColorDefs: [
        { i18nKey: 'profile.purple',     fallback: '紫色',  value: '#6C2BD9' },
        { i18nKey: 'profile.blue',       fallback: '蓝色',  value: '#2196F3' },
        { i18nKey: 'profile.cyan',       fallback: '青色',  value: '#06B6D4' },
        { i18nKey: 'profile.pink',       fallback: '粉色',  value: '#EC4899' },
        { i18nKey: 'profile.orange',     fallback: '橙色',  value: '#F59E0B' },
        { i18nKey: 'profile.red',        fallback: '红色',  value: '#E8294A' },
        { i18nKey: 'profile.green',      fallback: '绿色',  value: '#27AE60' },
        { i18nKey: 'profile.indigo',     fallback: '靛蓝',  value: '#3F51B5' },
        { i18nKey: 'profile.deepOrange', fallback: '深橙',  value: '#FF5722' },
        { i18nKey: 'profile.blueGrey',   fallback: '灰蓝',  value: '#607D8B' },
        { i18nKey: 'profile.skyBlue',    fallback: '天蓝',  value: '#409EFF' },
        { i18nKey: 'profile.deepPurple', fallback: '深紫',  value: '#673AB7' }
      ],
      // 语言选项：当前语言使用 mixin 提供的 _currentLang
      langOptions: [
        { label: '中文', value: 'zh-CN' },
        { label: 'English', value: 'en' }
      ]
    }
  },

  computed: {
    currentLangName() {
      const item = this.langOptions.find(l => l.value === this._currentLang)
      return item ? item.label : '中文'
    },
    // 主题色列表：通过 computed 生成 name，确保 i18n 切换后能响应式更新
    themeColors() {
      return this.themeColorDefs.map(def => {
        let name = def.fallback
        try {
          if (typeof this.t === 'function') {
            const txt = this.t(def.i18nKey)
            if (txt && txt !== def.i18nKey) name = txt
          }
        } catch (e) {}
        return { name, value: def.value }
      })
    },
    // 组织信息：部门 + 角色
    orgInfo() {
      const user = this.currentUser
      if (!user) return ''
      const parts = []
      if (user.DeptName) parts.push(user.DeptName)
      const roles = user._Roles
      if (Array.isArray(roles) && roles.length > 0) {
        const roleNames = roles.map(r => r.Name).filter(Boolean)
        if (roleNames.length > 0) parts.push(roleNames.join('、'))
      }
      return parts.join(' · ')
    }
  },

  onLoad() {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
    } catch (e) {
      try {
        this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
      } catch (e2) {}
    }
    // 读取已保存的主题色和语言
    try {
      const savedTheme = uni.getStorageSync('microi_theme_color')
      if (savedTheme) this._themeColor = savedTheme
    } catch (e) {}
    try {
      const savedLang = uni.getStorageSync('microi_language')
      if (savedLang) this._currentLang = savedLang
    } catch (e) {}
    this.loadSysConfig()
  },

  onShow() {
    this.checkLogin()
  },

  methods: {
    checkLogin() {
      const token = getToken()
      this.isLoggedIn = !!token
      if (this.isLoggedIn) {
        const user = getUser()
        if (user) this.currentUser = user
        this.loadUserInfo()
      } else {
        this.currentUser = {}
      }
      this.loading = false
    },

    async loadSysConfig() {
      try {
        const cfg = await getSysConfig()
        if (cfg) {
          if (cfg.CompanyName) this.companyName = cfg.CompanyName
        }
      } catch (e) {}
    },

    // 从服务端刷新用户信息
    async loadUserInfo() {
      try {
        const res = await post('/api/SysUser/GetCurrentUser', {}, true)
        if (res.Code === 1 && res.Data) {
          this.currentUser = res.Data
          // 更新本地存储
          uni.setStorageSync('microi_user', JSON.stringify(res.Data))
        }
      } catch (e) {
        console.error('[Profile] loadUserInfo error:', e)
      }
    },

    // 切换主题色
    changeTheme(color) {
      this._themeColor = color
      setTheme(color)
      this.showThemePanel = false
      uni.showToast({ title: this.t('profile.themeSwitched'), icon: 'success' })
    },

    // 切换语言
    changeLang(lang) {
      this._currentLang = lang
      setLang(lang)
      this.showLangPanel = false
      uni.showToast({ title: lang === 'zh-CN' ? this.t('profile.langSwitched') : 'Switched to English', icon: 'success' })
    },

    // 修改密码
    submitPassword() {
      const { oldPassword, newPassword, confirmPassword } = this.passwordForm
      if (!oldPassword) {
        uni.showToast({ title: this.t('profile.enterOldPwd'), icon: 'none' })
        return
      }
      if (!newPassword || newPassword.length < 6) {
        uni.showToast({ title: this.t('profile.pwdMinLength'), icon: 'none' })
        return
      }
      if (newPassword !== confirmPassword) {
        uni.showToast({ title: this.t('profile.pwdNotMatch'), icon: 'none' })
        return
      }

      // 与登录一致使用 RSA 加密，避免明文传输（OWASP A02:2021 加密失败）
      let encOld, encNew
      try {
        encOld = encryptPassword(oldPassword)
        encNew = encryptPassword(newPassword)
      } catch (err) {
        console.error('[Profile] encrypt password error:', err)
        uni.showToast({ title: '加密失败，请重试', icon: 'none' })
        return
      }

      post('/api/SysUser/ChangePassword', {
        OldPassword: encOld,
        NewPassword: encNew
      }, true).then(res => {
        if (res.Code === 1) {
          uni.showToast({ title: this.t('profile.pwdChanged'), icon: 'success' })
          this.showPasswordDialog = false
          this.passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' }
          // 延迟退出登录
          setTimeout(() => {
            this.doLogout()
          }, 1500)
        } else {
          uni.showToast({ title: res.Msg || res.Message || '修改失败', icon: 'none' })
        }
      }).catch(e => {
        uni.showToast({ title: '网络错误', icon: 'none' })
      })
    },

    // 退出登录
    handleLogout() {
      uni.showModal({
        title: '提示',
        content: this.t('profile.logoutConfirm'),
        success: (res) => {
          if (res.confirm) {
            this.doLogout()
          }
        }
      })
    },

    async doLogout() {
      try {
        await post('/api/SysUser/Logout', {}, true)
      } catch (e) {}
      removeToken()
      this.isLoggedIn = false
      this.currentUser = {}
      uni.showToast({ title: this.t('profile.loggedOut'), icon: 'success' })
    },

    goLogin() {
      uni.navigateTo({ url: '/pages/login/index' })
    },

    goAbout() {
      uni.navigateTo({ url: '/pages/about/index' })
    },

    goPrivacy() {
      uni.navigateTo({ url: '/pages/privacy/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
.profile-container {
  min-height: 100vh;
  background: var(--mci-bg-base);
  display: flex;
  flex-direction: column;
  position: relative;
}

.hero-actions {
  position: absolute;
  top: calc(var(--mci-space-2) + 8rpx);
  right: 24rpx;
  z-index: 3;
}

.mode-toggle {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--mci-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}

/* 用户卡片 */
.user-card {
  position: relative;
  background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
  padding-bottom: 48rpx;
}

.card-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);

  &.c1 {
    width: 400rpx;
    height: 400rpx;
    top: -100rpx;
    right: -80rpx;
  }
  &.c2 {
    width: 300rpx;
    height: 300rpx;
    bottom: -60rpx;
    left: -60rpx;
  }
}

.card-content {
  position: relative;
  z-index: 1;
  padding: 40rpx 32rpx 0;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  border: 4rpx solid rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-char {
  font-size: 52rpx;
  color: #fff;
  font-weight: 700;
}

.user-detail {
  margin-left: 28rpx;
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-right: 12rpx;
}

.tenant-tag {
  display: inline-block;
  font-size: 20rpx;
  line-height: 1;
  padding: 6rpx 14rpx;
  background: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.95);
  border-radius: 30rpx;
  white-space: nowrap;
}

.user-account {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 8rpx;
  display: block;
}

.user-org {
  font-size: 22rpx;
  color: rgba(255,255,255,0.6);
  margin-top: 6rpx;
  display: block;
}

/* 骨架 */
.sk-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  flex-shrink: 0;
}

.sk-info {
  margin-left: 28rpx;
  flex: 1;
}

.sk-line {
  background: rgba(255,255,255,0.2);
  border-radius: 8rpx;
}

/* 功能列表 */
.func-list {
  padding: 24rpx;
  flex: 1;
}

.func-group {
  background: var(--mci-bg-elevated);
  border-radius: var(--mci-radius-lg);
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: var(--mci-shadow-card, var(--mci-shadow-md));
  border: 1rpx solid var(--mci-border-color);
}

.func-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx;
  border-bottom: 1rpx solid #f8f8f8;
  border-bottom-color: var(--mci-border-color);
  transition: background-color 0.15s ease;

  &:active {
    background-color: var(--mci-bg-card-hover);
  }

  &:last-child {
    border-bottom: none;
  }
}

.item-left {
  display: flex;
  align-items: center;
}

.item-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--mci-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;

  text {
    font-size: 30rpx;
  }

  &--primary { background: var(--mci-gradient-primary); }
  &--cyan { background: linear-gradient(135deg, #06B6D4, #22D3EE); }
  &--blue { background: linear-gradient(135deg, #2196F3, #60A5FA); }
  &--purple { background: linear-gradient(135deg, #8B5CF6, #A78BFA); }
  &--gold { background: linear-gradient(135deg, #F59E0B, #FBBF24); }
  &--danger { background: linear-gradient(135deg, #E8294A, #FB7185); }
}

.item-title {
  font-size: 30rpx;
  color: var(--mci-text-primary);
}

.item-title--primary {
  color: var(--mci-color-primary);
  font-weight: 600;
}

.item-right {
  display: flex;
  align-items: center;
}

.item-value {
  font-size: 26rpx;
  color: var(--mci-text-secondary);
  margin-right: 8rpx;
}

.theme-dot {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 4rpx solid var(--mci-bg-elevated);
  box-shadow: 0 0 0 1rpx var(--mci-border-color), 0 2rpx 8rpx rgba(0,0,0,0.15);
  margin-right: 12rpx;
}

.arrow {
  font-size: 36rpx;
  color: var(--mci-text-tertiary);
}

.logout-item {
  .item-title {
    color: var(--mci-color-danger);
  }
}

/* Footer */
.footer-info {
  text-align: center;
  padding: 40rpx 0;
}

.footer-text {
  font-size: 22rpx;
  color: var(--mci-text-tertiary);
}

/* 底部弹出面板（主题、语言共用） */
.sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-panel {
  width: 100%;
  max-height: 70vh;
  background: var(--mci-bg-elevated);
  border-radius: 32rpx 32rpx 0 0;
  overflow: hidden;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
  border-bottom: 1rpx solid var(--mci-border-color);
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--mci-text-primary);
}

.sheet-close {
  font-size: 36rpx;
  color: var(--mci-text-secondary);
  padding: 0 8rpx;
}

.mode-section {
  padding: 24rpx 28rpx 0;

  &--theme {
    padding-top: 14rpx;
  }
}

.mode-section-title {
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
}

.mode-switch {
  margin-top: 16rpx;
  display: flex;
  gap: 16rpx;
}

.mode-item {
  flex: 1;
  min-height: 86rpx;
  border-radius: var(--mci-radius-md);
  border: 1rpx solid var(--mci-border-color);
  background: var(--mci-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;

  &.active {
    border-color: var(--mci-color-primary);
    color: var(--mci-color-primary);
    background: rgba(108, 43, 217, 0.08);
  }
}

.mode-label {
  color: inherit;
  font-size: 26rpx;
}

/* 主题选择网格 */
.theme-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 32rpx 24rpx 48rpx;
}

.theme-item {
  width: 25%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;

  &.active .theme-color {
    transform: scale(1.15);
    box-shadow: 0 0 0 4rpx var(--mci-color-primary), 0 4rpx 16rpx rgba(0,0,0,0.25);
  }
}

.theme-color {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15);
  transition: transform 0.2s;
}

.theme-check {
  font-size: 36rpx;
  color: #fff;
  font-weight: 700;
}

.theme-name {
  font-size: 24rpx;
  color: var(--mci-text-secondary);
}

/* 语言选择列表 */
.lang-list {
  padding: 0 0 48rpx;
}

.lang-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid var(--mci-border-color);

  &.active {
    background: rgba(108, 43, 217, 0.08);

    .lang-name {
      color: var(--theme, #6C2BD9);
      font-weight: 600;
    }
  }
}

.lang-name {
  font-size: 30rpx;
  color: var(--mci-text-primary);
}

.lang-check {
  font-size: 32rpx;
  color: var(--theme, #6C2BD9);
  font-weight: 700;
}

/* 修改密码弹窗 */
.pwd-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwd-panel {
  width: 88%;
  background: var(--mci-bg-elevated);
  border-radius: 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--mci-border-color);
}

.pwd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid var(--mci-border-color);
}

.pwd-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--mci-text-primary);
}

.pwd-close {
  font-size: 32rpx;
  color: var(--mci-text-secondary);
}

.pwd-form {
  padding: 24rpx 32rpx;
}

.pwd-field {
  margin-bottom: 24rpx;
}

.pwd-label {
  font-size: 26rpx;
  color: var(--mci-text-secondary);
  margin-bottom: 12rpx;
  display: block;
}

.pwd-input {
  width: 100%;
  height: 80rpx;
  background: var(--mci-bg-card);
  border: 2rpx solid var(--mci-border-color);
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--mci-text-primary);
  box-sizing: border-box;
}

.pwd-actions {
  display: flex;
  padding: 16rpx 32rpx 32rpx;
  gap: 20rpx;
}

.pwd-cancel {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  border: 2rpx solid var(--mci-border-color-hover);
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 28rpx;
    color: var(--mci-text-secondary);
  }
}

.pwd-confirm {
  flex: 2;
  height: 80rpx;
  border-radius: 40rpx;
  background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
  }
}
</style>
