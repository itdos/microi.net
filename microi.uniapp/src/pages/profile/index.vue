<template>
  <view class="profile-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 顶部用户卡片 -->
    <view class="user-card" :style="{ paddingTop: statusBarHeight + 'px', background: themeColor }">
      <view class="card-bg">
        <view class="bg-circle c1"></view>
        <view class="bg-circle c2"></view>
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
            <text class="user-name">{{ currentUser.Name || currentUser.Account || t('common.user') }}</text>
            <text class="user-account">{{ t('common.account') }}: {{ currentUser.Account || '-' }}</text>
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
            <view class="item-icon" style="background:#fff0e8;">
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
            <view class="item-icon" style="background:#eef2ff;">
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
            <view class="item-icon" style="background:#eef2ff;">
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
            <view class="item-icon" style="background:#f5f0ff;">
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
            <view class="item-icon" style="background:#fff0e8;">
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
            <view class="item-icon" style="background:#ffecec;">
              <text>🚪</text>
            </view>
            <text class="item-title" style="color:#ff4d4f;">{{ t('profile.logout') }}</text>
          </view>
        </view>
      </view>

      <!-- 未登录时的登录入口 -->
      <view class="func-group" v-if="!isLoggedIn">
        <view class="func-item" @tap="goLogin">
          <view class="item-left">
            <view class="item-icon" style="background:#eef2ff;">
              <text>🔓</text>
            </view>
            <text class="item-title" style="color:#4e6ef2;font-weight:600;">{{ t('common.loginNow') }}</text>
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
            :class="{ active: currentLang === item.value }"
            @tap="changeLang(item.value)"
          >
            <text class="lang-name">{{ item.label }}</text>
            <text class="lang-check" v-if="currentLang === item.value">✓</text>
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
import appConfig from '@/utils/config.js'
import { themeMixin, setTheme } from '@/utils/theme.js'
import { setLang } from '@/utils/i18n.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'

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
      // 主题色
            themeColors: [
        { name: this.t ? this.t('profile.blue') : '蓝色', value: '#4e6ef2' },
        { name: '天蓝', value: '#409eff' },
        { name: '橙色', value: '#E67E22' },
        { name: '红色', value: '#E74C3C' },
        { name: '绿色', value: '#27AE60' },
        { name: '紫色', value: '#9B59B6' },
        { name: '粉色', value: '#E91E63' },
        { name: '青色', value: '#00BCD4' },
        { name: '靛蓝', value: '#3F51B5' },
        { name: '深橙', value: '#FF5722' },
        { name: '灰蓝', value: '#607D8B' },
        { name: '黑色', value: '#424242' }
      ],
      // 语言
      currentLang: 'zh-CN',
      langOptions: [
        { label: '中文', value: 'zh-CN' },
        { label: 'English', value: 'en' }
      ]
    }
  },

  computed: {
    currentLangName() {
      const item = this.langOptions.find(l => l.value === this.currentLang)
      return item ? item.label : '中文'
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
      if (savedTheme) this.themeColor = savedTheme
    } catch (e) {}
    try {
      const savedLang = uni.getStorageSync('microi_language')
      if (savedLang) this.currentLang = savedLang
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
      this.currentLang = lang
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

      post('/api/SysUser/ChangePassword', {
        OldPassword: oldPassword,
        NewPassword: newPassword
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
          uni.showToast({ title: res.Message || '修改失败', icon: 'none' })
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
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

/* 用户卡片 */
.user-card {
  position: relative;
  background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
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
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
}

.user-account {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 8rpx;
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
  background: #fff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.func-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx;
  border-bottom: 1rpx solid #f8f8f8;
  transition: background-color 0.15s ease;

  &:active {
    background-color: #f5f5f5;
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
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;

  text {
    font-size: 30rpx;
  }
}

.item-title {
  font-size: 30rpx;
  color: #333;
}

.item-right {
  display: flex;
  align-items: center;
}

.item-value {
  font-size: 26rpx;
  color: #999;
  margin-right: 8rpx;
}

.theme-dot {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 4rpx solid #fff;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.15);
  margin-right: 12rpx;
}

.arrow {
  font-size: 36rpx;
  color: #ccc;
}

.logout-item {
  .item-title {
    color: #ff4d4f;
  }
}

/* Footer */
.footer-info {
  text-align: center;
  padding: 40rpx 0;
}

.footer-text {
  font-size: 22rpx;
  color: #ccc;
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
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.sheet-close {
  font-size: 36rpx;
  color: #999;
  padding: 0 8rpx;
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
    box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.25);
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
  color: #666;
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
  border-bottom: 1rpx solid #f5f5f5;

  &.active {
    background: #f0f5ff;

    .lang-name {
      color: var(--theme, #4e6ef2);
      font-weight: 600;
    }
  }
}

.lang-name {
  font-size: 30rpx;
  color: #333;
}

.lang-check {
  font-size: 32rpx;
  color: var(--theme, #4e6ef2);
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
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}

.pwd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.pwd-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.pwd-close {
  font-size: 32rpx;
  color: #999;
}

.pwd-form {
  padding: 24rpx 32rpx;
}

.pwd-field {
  margin-bottom: 24rpx;
}

.pwd-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  display: block;
}

.pwd-input {
  width: 100%;
  height: 80rpx;
  background: #f5f7fa;
  border: 2rpx solid #f0f0f0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
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
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 28rpx;
    color: #666;
  }
}

.pwd-confirm {
  flex: 2;
  height: 80rpx;
  border-radius: 40rpx;
  background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
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
