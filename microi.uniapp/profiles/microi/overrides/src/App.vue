<script>
import { getToken, V8 } from './utils/request.js'
import { initializeThemeSystem } from './utils/theme.js'
import { getSysConfig } from './utils/sysconfig.js'
import { warmPrimaryTabs } from './platform/preload.js'
import activeTabBar from './generated/active-tabbar.js'
import {
  initializeMiniProgramUpdate,
  loadMiniProgramVersionPolicy
} from './platform/mini-program-update.js'

const AUTH_RESUME_MIN_INTERVAL = 60 * 1000
let authResumeTimer = null
let lastAuthResumeAt = 0
// zhy：版本策略延迟读取，避免与首屏业务请求争抢网络。
let versionPolicyTimer = null

export default {
  globalData: {
    mciTabBar: activeTabBar,
    mciAiAssistantEnabled: false,
    mciMessageTabBarEnabled: true
  },
  onLaunch() {
    console.log('App Launch')
    initializeThemeSystem()
    // 匿名读取当前 API 租户的品牌与主题；失败时主题层保持 Microi吾码默认值。
    getSysConfig().catch((error) => {
      console.warn('[Branding] 租户主题读取失败，使用 Microi吾码默认主题:', error && (error.message || error))
    })
    // zhy：尽早注册全局唯一更新管理器，让新版代码包在后台完成检测与下载。
    initializeMiniProgramUpdate({ promptOnReady: true })
    // 首屏稳定后再做低优先级预热，避免启动阶段与首页接口、视频解码争抢资源。
    warmPrimaryTabs(1600)
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
    // 避开首屏渲染，并限制短时间内重复续签造成的启动网络竞争。
    this.scheduleRefreshToken()
    // zhy：最低支持版本来自 SaaS 系统配置，字段未配置时不会改变现有行为。
    this.scheduleVersionPolicy()
  },
  onHide() {
    console.log('App Hide')
    if (authResumeTimer) clearTimeout(authResumeTimer)
    authResumeTimer = null
    if (versionPolicyTimer) clearTimeout(versionPolicyTimer)
    versionPolicyTimer = null
  },
  methods: {
    scheduleRefreshToken() {
      if (authResumeTimer) clearTimeout(authResumeTimer)
      authResumeTimer = setTimeout(() => {
        authResumeTimer = null
        this.refreshToken()
      }, 900)
    },
    // zhy：每次重新进入前台都可刷新一次版本策略，服务内部复用系统配置缓存。
    scheduleVersionPolicy() {
      if (versionPolicyTimer) clearTimeout(versionPolicyTimer)
      versionPolicyTimer = setTimeout(() => {
        versionPolicyTimer = null
        loadMiniProgramVersionPolicy().catch((error) => {
          console.warn('[Update] 版本策略读取失败:', error && (error.message || error))
        })
      }, 1800)
    },
    async refreshToken() {
      const token = getToken()
      if (!token) return
      const now = Date.now()
      if (now - lastAuthResumeAt < AUTH_RESUME_MIN_INTERVAL) return
      lastAuthResumeAt = now
      try {
        await V8.resumeAuthSession(false)
      } catch (error) {
        // 网络异常不清理本地身份；后端明确返回身份失效时由 SDK 统一提示并跳转。
        console.warn('[Auth] 前台恢复时Token续签失败:', error && (error.message || error.errMsg || error))
      }
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

/* Tab 页滚动内容的统一尾部占位：署名、操作坞、视觉间距与运行时安全区。 */
.mci-tabbar-spacer {
  width: 100%;
  height: calc(var(--mci-tabbar-height, 142rpx) + 18rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));
  flex: none;
}

/* H5/自动化截图中的安全区位于 page 容器之外，必须有明确底色。 */
html,
body,
#app,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body {
  min-height: 100%;
  background-color: var(--mci-bg-base);
}

/* H5 桌面端沿用移动应用视口，避免页面被拉伸成整屏后台布局。 */
@media screen and (min-width: 768px) {
  html,
  body,
  #app {
    min-height: 100%;
    margin: 0;
    background: #e8eef7;
  }

  uni-app {
    position: relative;
    display: block;
    width: 430px;
    max-width: 100vw;
    min-height: 100vh;
    margin: 0 auto;
    overflow-x: hidden;
    background: var(--mci-bg-base);
    box-shadow: 0 0 36px rgba(16, 52, 68, .18);
  }

  uni-page,
  uni-page-wrapper,
  uni-page-body {
    width: 100%;
    max-width: 430px;
  }

  .bottom-bar,
  .submit-bar,
  .chat-input-area,
  .detail-action-bar,
  .popup-footer {
    right: auto !important;
    left: 50% !important;
    width: min(430px, 100vw) !important;
    box-sizing: border-box;
    transform: translateX(-50%);
  }

  .floating-add {
    right: calc((100vw - min(430px, 100vw)) / 2 + 15px) !important;
  }
}

.mci-live-drop {
  position: absolute;
  z-index: 2;
  right: calc(22rpx + var(--mci-capsule-right, 0px));
  bottom: 9rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50% 50% 50% 0;
  background: rgba(255, 255, 255, .72);
  box-shadow: 0 0 12rpx rgba(110, 226, 232, .46);
  transform: rotate(-45deg);
  animation: mciLiveDrop 2.9s ease-in-out infinite;
  pointer-events: none;
}

@keyframes mciLiveDrop {
  0%, 100% { transform: rotate(-45deg) scale(.78); opacity: .34; }
  50% { transform: rotate(-45deg) scale(1); opacity: .9; }
}

@media (prefers-reduced-motion: reduce) {
  .mci-live-drop { animation: none !important; }
}

</style>
