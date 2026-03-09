<script>
import { getToken, request } from './utils/request.js'

export default {
  onLaunch() {
    console.log('App Launch')
  },
  onShow() {
    console.log('App Show')
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

<style>
/* 全局样式 */
page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial,
    sans-serif;
  font-size: 28rpx;
  color: #333333;
  -webkit-font-smoothing: antialiased;
}
</style>
