<template>
  <view class="webview-container">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar-content">
        <view class="navbar-title">
          <text>{{ appName }}</text>
        </view>
        <view class="navbar-actions">
          <view class="action-btn" @tap="handleRefresh">
            <text class="action-icon">🔄</text>
          </view>
          <view class="action-btn" @tap="handleLogout">
            <text class="action-icon">⏻</text>
          </view>
        </view>
      </view>
    </view>

    <!-- WebView -->
    <web-view
      v-if="webviewUrl"
      :src="webviewUrl"
      @message="handleMessage"
      @error="handleError"
    />

    <!-- 加载提示（首次加载时显示） -->
    <view class="loading-overlay" v-if="loading">
      <view class="loading-content">
        <view class="loading-spinner"></view>
        <text class="loading-text">{{ t('webview.loading') }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getToken, getUser, removeToken } from '@/utils/request.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appName: appConfig.appName,
      statusBarHeight: 44,
      webviewUrl: '',
      loading: true
    }
  },

  onLoad(options) {
    // 获取状态栏高度（优先使用新 API）
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

    // 检查是否已登录
    const token = getToken()
    console.log('[WebView] onLoad - token:', token ? ('存在，长度=' + token.length) : '不存在')
    if (!token) {
      console.log('[WebView] 无 Token，返回工作台页面')
      uni.switchTab({ url: '/pages/workspace/index' })
      return
    }

    // 如果从工作台菜单跳转过来，则使用传入的 url 参数
    if (options && options.url) {
      this.webviewUrl = decodeURIComponent(options.url)
      console.log('[WebView] 使用传入URL:', this.webviewUrl)
    } else {
      // 默认构建 WebView URL（tabBar 首页场景）
      this.buildWebviewUrl(token)
      console.log('[WebView] webviewUrl:', this.webviewUrl)
    }

    // 延迟隐藏 Loading（等待 webview 加载）
    setTimeout(() => {
      this.loading = false
    }, 3000)
  },

  methods: {
    /**
     * 构建 WebView URL
     * 将 Token 作为参数传递给 H5 页面，实现免登录访问
     */
    buildWebviewUrl(token) {
      let url = appConfig.webviewUrl
      const separator = url.includes('?') ? '&' : '?'
      // 传递 token 和来源标识
      url += separator + 'token=' + encodeURIComponent(token)
      url += '&source=miniprogram'
      url += '&OsClient=' + encodeURIComponent(appConfig.osClient)
      this.webviewUrl = url
    },

    /**
     * 接收 H5 页面发送的消息
     */
    handleMessage(e) {
      const data = e.detail && e.detail.data
      if (!data || !data.length) return

      const msg = data[data.length - 1]
      console.log('[WebView Message]', msg)

      // 处理 H5 页面发来的消息
      if (msg.action === 'logout') {
        this.handleLogout()
      } else if (msg.action === 'refresh') {
        this.handleRefresh()
      }
    },

    /**
     * WebView 加载错误
     */
    handleError(e) {
      console.error('[WebView Error]', e)
      this.loading = false
      // 不自动退出登录，仅提示重试
      uni.showModal({
        title: this.t('webview.loadError'),
        content: 'WebView 页面加载异常，请确认服务端地址是否正确且可访问。\n当前地址：' + appConfig.webviewUrl,
        confirmText: this.t('common.retry'),
        cancelText: this.t('webview.backHome'),
        success: (res) => {
          if (res.confirm) {
            this.handleRefresh()
          } else {
            removeToken()
            uni.switchTab({ url: '/pages/mall/index' })
          }
        }
      })
    },

    /**
     * 刷新 WebView
     */
    handleRefresh() {
      const token = getToken()
      if (token) {
        this.loading = true
        this.webviewUrl = ''
        this.$nextTick(() => {
          this.buildWebviewUrl(token)
          setTimeout(() => {
            this.loading = false
          }, 2000)
        })
      }
    },

    /**
     * 退出登录
     */
    handleLogout() {
      uni.showModal({
        title: this.t('common.tip'),
        content: this.t('webview.logoutConfirm'),
        success: (res) => {
          if (res.confirm) {
            removeToken()
            // 返回 tabBar 商城首页（关闭所有非 tabBar 页面）
            uni.switchTab({
              url: '/pages/mall/index',
              fail: () => {
                // 降级使用 reLaunch
                uni.reLaunch({ url: '/pages/mall/index' })
              }
            })
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.webview-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

/* 注意：web-view 是全屏组件，自定义导航栏在小程序中会被 webview 覆盖 */
/* 这里保留代码结构，实际显示时 webview 会全屏 */
.custom-navbar {
  display: none; /* webview 页面中导航栏默认隐藏，webview 本身是全屏的 */
  width: 100%;
  background: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
}

.navbar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.navbar-title {
  text {
    font-size: 34rpx;
    font-weight: 600;
    color: #333333;
  }
}

.navbar-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 16rpx;
  border-radius: 50%;
  background: #f5f7fa;
}

.action-icon {
  font-size: 32rpx;
}

/* 加载动画 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid #eeeeee;
  border-top-color: var(--theme, #4e6ef2);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 24rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 28rpx;
  color: #999999;
}
</style>
