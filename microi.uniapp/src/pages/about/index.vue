<template>
  <view class="about-page" :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]">
    <mci-skeleton v-if="loading" class="about-skeleton" type="detail" :rows="5" />
    <template v-else>
    <view class="about-header">
      <image class="about-logo" :src="logoUrl" mode="aspectFit" />
      <text class="about-name">{{ appName }}</text>
      <!-- zhy：正式版显示微信实际运行版本，开发/体验版同时展示环境标记。 -->
      <view class="about-version-row">
        <text class="about-version">{{ t('about.version') }} {{ updateState.version }}</text>
        <text class="about-env">{{ updateState.envLabel }}</text>
      </view>
    </view>

    <view class="about-content">
      <!-- zhy：更新卡片承载检查、后台下载、失败和立即重启的完整状态。 -->
      <view class="update-card" :class="{ 'update-card--ready': updateState.updateReady, 'update-card--mandatory': updateState.mandatory }">
        <view class="update-head">
          <view class="update-copy">
            <text class="update-title">小程序更新</text>
            <text class="update-status">{{ updateState.message }}</text>
          </view>
          <text v-if="updateState.updateReady" class="update-badge">可更新</text>
        </view>
        <text v-if="updateState.mandatory" class="mandatory-tip">当前版本低于最低支持版本 {{ updateState.minimumVersion }}，请尽快更新。</text>
        <button
          class="update-button"
          :class="{ 'update-button--disabled': updateButtonDisabled }"
          :disabled="updateButtonDisabled"
          hover-class="update-button--pressed"
          @tap="handleUpdate"
        >
          <view class="update-button-icon" aria-hidden="true"><view class="update-button-icon__arrow"></view></view>
          <text>{{ updateButtonText }}</text>
        </button>
        <text class="update-hint">更新会重新启动小程序，请先保存正在编辑的内容。</text>
      </view>

      <!-- zhy：更新说明优先读取 SaaS 配置，未配置时回退到 Profile 发布说明。 -->
      <view v-if="updateState.releaseNotes.length" class="release-card">
        <text class="release-title">本次更新</text>
        <view v-for="(note, index) in updateState.releaseNotes" :key="`${index}-${note}`" class="release-item">
          <view class="release-dot"></view><text>{{ note }}</text>
        </view>
      </view>

      <view class="info-group">
        <view class="info-item" @tap="navigateToPrivacy">
          <text class="info-label">{{ t('about.privacy') }}</text>
          <text class="info-arrow">›</text>
        </view>
      </view>

      <view class="about-desc">
        <text class="desc-text">
          {{ appName }}{{ t('about.desc') }}
        </text>
      </view>
    </view>

    <view class="about-footer">
      <text class="footer-text">© {{ currentYear }} {{ companyName || appName }}</text>
      <text class="footer-text">Power by {{ appConfig.poweredBy }}</text>
    </view>
    </template>
  </view>
</template>

<script>
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'
import {
  applyMiniProgramVersionPolicy,
  checkMiniProgramUpdate,
  getMiniProgramUpdateState,
  initializeMiniProgramUpdate,
  MINI_PROGRAM_UPDATE_STATUS,
  subscribeMiniProgramUpdate
} from '@/platform/mini-program-update.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      appConfig,
      appName: appConfig.appName,
      logoUrl: appConfig.logoUrl || '/static/microi-blue-256.png',
      companyName: '',
      loading: true,
      // zhy：About 页面展示平台服务快照，不复制更新状态机。
      updateState: getMiniProgramUpdateState(),
      updateUnsubscribe: null,
      currentYear: new Date().getFullYear()
    }
  },

  onLoad() {
    // zhy：兜底初始化对 App 已注册的全局管理器是幂等操作。
    initializeMiniProgramUpdate({ promptOnReady: true })
    this.updateUnsubscribe = subscribeMiniProgramUpdate((nextState) => {
      this.updateState = nextState
    })
    uni.setNavigationBarTitle({ title: '关于小程序' })
    this.loadSysConfig()
  },

  onUnload() {
    // zhy：离开 About 页后释放订阅，更新管理器本身继续由 App 持有。
    if (this.updateUnsubscribe) this.updateUnsubscribe()
    this.updateUnsubscribe = null
  },

  computed: {
    updateButtonText() {
      const status = this.updateState.status
      if (status === MINI_PROGRAM_UPDATE_STATUS.READY) return '立即更新'
      if (status === MINI_PROGRAM_UPDATE_STATUS.CHECKING) return '正在检查更新'
      if (status === MINI_PROGRAM_UPDATE_STATUS.DOWNLOADING) return '新版本下载中'
      if (status === MINI_PROGRAM_UPDATE_STATUS.FAILED) return '查看处理方式'
      if (status === MINI_PROGRAM_UPDATE_STATUS.UNSUPPORTED) return '当前平台不支持更新'
      return '检查更新'
    },
    updateButtonDisabled() {
      return [
        MINI_PROGRAM_UPDATE_STATUS.CHECKING,
        MINI_PROGRAM_UPDATE_STATUS.DOWNLOADING,
        MINI_PROGRAM_UPDATE_STATUS.UNSUPPORTED
      ].includes(this.updateState.status)
    }
  },

  methods: {
    async loadSysConfig() {
      try {
        const cfg = await getSysConfig()
        if (cfg) {
          if (cfg.SysTitle) this.appName = cfg.SysTitle
          if (cfg.CompanyName) this.companyName = cfg.CompanyName
          if (cfg.SysLogo) {
            this.logoUrl = getServerPath(cfg.SysLogo)
          }
        }
        // zhy：无论接口是否返回扩展字段，都让 Profile 更新说明得到统一归一化。
        applyMiniProgramVersionPolicy(cfg || {})
      } catch (e) {
        console.log('[About] loadSysConfig:', e.message)
      } finally {
        this.loading = false
      }
    },

    // zhy：手动入口根据本次会话状态应用已下载版本或给出准确反馈。
    handleUpdate() {
      checkMiniProgramUpdate()
    },

    navigateToPrivacy() {
      uni.navigateTo({
        url: '/pages/privacy/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.about-skeleton { flex: 1; padding-top: 80rpx; }

.about-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
  background: #ffffff;
}

.about-logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.about-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8rpx;
}

.about-version {
  font-size: 26rpx;
  color: #999999;
}

/* zhy：版本和环境标签采用同一行信息层级，避免把开发环境误认为正式版本。 */
.about-version-row { display: flex; align-items: center; gap: 12rpx; }
.about-env { padding: 4rpx 10rpx; border-radius: 999rpx; background: #eef5f8; color: #607985; font-size: 20rpx; }

.about-content {
  flex: 1;
  padding: 30rpx;
}

/* zhy：更新区使用稳定卡片布局，并为重要操作提供图标、按下态和禁用态。 */
.update-card, .release-card { box-sizing: border-box; margin-bottom: 24rpx; padding: 28rpx; border: 1rpx solid #e3ecef; border-radius: 16rpx; background: #fff; }
.update-card--ready { border-color: #b9dfe9; box-shadow: 0 8rpx 24rpx rgba(8, 125, 168, .08); }
.update-card--mandatory { border-color: #efc4bc; }
.update-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.update-copy { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.update-title, .release-title { color: #294752; font-size: 29rpx; font-weight: 700; }
.update-status { margin-top: 8rpx; color: #718994; font-size: 23rpx; line-height: 1.5; }
.update-badge { flex: none; padding: 6rpx 14rpx; border-radius: 999rpx; background: #fff0ed; color: #d8492d; font-size: 21rpx; font-weight: 700; }
.mandatory-tip { display: block; margin-top: 18rpx; padding: 16rpx; border-radius: 10rpx; background: #fff5f2; color: #bd432d; font-size: 22rpx; line-height: 1.55; }
.update-button { display: flex; align-items: center; justify-content: center; gap: 14rpx; width: 100%; height: 84rpx; margin-top: 24rpx; border-radius: 12rpx; background: linear-gradient(135deg, var(--theme, #087da8), var(--theme-light, #18a6b8)); color: #fff; font-size: 27rpx; font-weight: 700; line-height: 84rpx; transition: transform 150ms ease, opacity 150ms ease; }
.update-button::after { border: none; }
.update-button--pressed { transform: scale(.98); opacity: .9; }
.update-button--disabled { background: #c9d5da; color: #fff; }
.update-button-icon { position: relative; box-sizing: border-box; width: 30rpx; height: 30rpx; border: 4rpx solid currentColor; border-right-color: transparent; border-radius: 50%; }
.update-button-icon__arrow { position: absolute; top: -7rpx; right: -5rpx; width: 0; height: 0; border-top: 7rpx solid transparent; border-bottom: 7rpx solid transparent; border-left: 10rpx solid currentColor; transform: rotate(-26deg); }
.update-hint { display: block; margin-top: 16rpx; color: #97a8af; font-size: 20rpx; line-height: 1.5; text-align: center; }
.release-title { display: block; margin-bottom: 16rpx; }
.release-item { display: flex; align-items: flex-start; gap: 13rpx; margin-top: 11rpx; color: #607985; font-size: 23rpx; line-height: 1.6; }
.release-dot { flex: none; width: 8rpx; height: 8rpx; margin-top: 14rpx; border-radius: 50%; background: var(--theme, #087da8); }

.info-group {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 30rpx;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 30rpx;
  color: #333333;
}

.info-arrow {
  font-size: 36rpx;
  color: #cccccc;
}

.about-desc {
  padding: 30rpx;
  background: #ffffff;
  border-radius: 16rpx;
}

.desc-text {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.8;
}

.about-footer {
  padding: 40rpx 0;
  padding-bottom: calc(40rpx + var(--mci-safe-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.footer-text {
  font-size: 22rpx;
  color: #cccccc;
  margin-bottom: 8rpx;
}

/* zhy：尊重系统减少动态效果偏好，更新按钮仅保留静态反馈。 */
@media (prefers-reduced-motion: reduce) { .update-button { transition: none; } }
</style>
