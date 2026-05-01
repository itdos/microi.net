<script>
import { getToken, request } from './utils/request.js'
import { initializeThemeSystem } from './utils/theme.js'

export default {
  onLaunch() {
    console.log('App Launch')
    initializeThemeSystem()
    // 全局错误兜底：避免未捕获错误导致小程序白屏
    try {
      uni.onError && uni.onError((err) => {
        console.error('[App] uni.onError:', err)
      })
      uni.onUnhandledRejection && uni.onUnhandledRejection((res) => {
        console.warn('[App] UnhandledRejection:', res && res.reason)
      })
    } catch (e) {}
  },
  onShow() {
    console.log('App Show')
    initializeThemeSystem()
    // 每次小程序/App切到前台时，自动刷新Token实现长期自动登录
    this.refreshToken()
  },
  onHide() {
    console.log('App Hide')
  },
  methods: {
    refreshToken() {
      const token = getToken()
      if (!token) return
      request({
        url: '/api/SysUser/refreshToken',
        method: 'POST',
        data: { authorization: token }
      }).catch(() => {
        // 静默失败，用户会在下次业务请求时触发401跳转登录页
      })
    }
  }
}
</script>

<style lang="scss">
/* MCI 设计系统全局接入：注入所有 CSS 变量与 .mci-* 工具类 */
@import './styles/mci-design.scss';

/* 全局 page 基础样式 */
page {
  background-color: var(--mci-bg-base);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial,
    sans-serif;
  font-size: var(--mci-text-base);
  color: var(--mci-text-primary);
  -webkit-font-smoothing: antialiased;
}
</style>
