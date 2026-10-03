<template>
  <mci-page-shell class="about-page" :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]"
    title="关于应用" :subtitle="runtimeBranding.appName" @back="goBack">
    <mci-skeleton v-if="loading" class="about-skeleton" type="detail" :rows="5" />
    <template v-else>
    <view class="about-header">
      <image class="about-logo" :src="runtimeBranding.logoUrl" mode="aspectFit" />
      <text class="about-name">{{ runtimeBranding.appName }}</text>
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
            <text class="update-title">应用更新</text>
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
        <text class="update-hint">更新可能会重新启动应用，请先保存正在编辑的内容。</text>
      </view>

      <!-- zhy：更新说明优先读取 SaaS 配置，未配置时回退到 Profile 发布说明。 -->
      <view v-if="updateState.releaseNotes.length" class="release-card">
        <text class="release-title">本次更新</text>
        <view v-for="(note, index) in updateState.releaseNotes" :key="`${index}-${note}`" class="release-item">
          <view class="release-dot"></view><text>{{ note }}</text>
        </view>
      </view>

      <view class="info-group">
        <view class="info-item" role="link" tabindex="0" @tap="navigateToService" @keyup.enter="navigateToService" @keyup.space.prevent="navigateToService">
          <text class="info-label">{{ t('about.service') }}</text>
          <view class="info-arrow" aria-hidden="true" />
        </view>
        <view class="info-item" role="link" tabindex="0" @tap="navigateToPrivacy" @keyup.enter="navigateToPrivacy" @keyup.space.prevent="navigateToPrivacy">
          <text class="info-label">{{ t('about.privacy') }}</text>
          <view class="info-arrow" aria-hidden="true" />
        </view>
      </view>

      <view class="about-desc">
        <text class="desc-text">
          {{ runtimeBranding.appName }}{{ t('about.desc') }}
        </text>
      </view>
    </view>

    <view class="about-footer">
      <text class="footer-text">© {{ currentYear }} {{ runtimeBranding.companyName || runtimeBranding.appName }}</text>
      <text class="footer-text">Power by {{ appConfig.poweredBy }}</text>
    </view>
    </template>
  </mci-page-shell>
</template>

<script>
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getSysConfig } from '@/utils/sysconfig.js'
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
    uni.setNavigationBarTitle({ title: '关于应用' })
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
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/index' }) }) },
    async loadSysConfig() {
      try {
        const cfg = await getSysConfig()
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
    },

    navigateToService() {
      uni.navigateTo({
        url: '/pages/service/index'
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
.about-env { padding: 4rpx 10rpx; border-radius: 999rpx; background: #eef5f8; color: #415b67; font-size: 22rpx; }

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
.update-status { margin-top: 8rpx; color: #526b76; font-size: 23rpx; line-height: 1.5; }
.update-badge { flex: none; padding: 6rpx 14rpx; border-radius: 999rpx; background: #fff0ed; color: #d8492d; font-size: 22rpx; font-weight: 700; }
.mandatory-tip { display: block; margin-top: 18rpx; padding: 16rpx; border-radius: 10rpx; background: #fff5f2; color: #bd432d; font-size: 22rpx; line-height: 1.55; }
.update-button { display: flex; align-items: center; justify-content: center; gap: 14rpx; width: 100%; height: 84rpx; margin-top: 24rpx; border-radius: 12rpx; background: linear-gradient(135deg, var(--theme, #087da8), var(--theme-light, #18a6b8)); color: #fff; font-size: 27rpx; font-weight: 700; line-height: 84rpx; transition: transform 150ms ease, opacity 150ms ease; }
.update-button::after { border: none; }
.update-button--pressed { transform: scale(.98); opacity: .9; }
.update-button--disabled,
.update-button--disabled button {
  background: #5f7078 !important;
  color: #fff !important;
  opacity: 1 !important;
}
.update-button--disabled text,
.update-button--disabled view { color: #fff !important; }
.update-button-icon { position: relative; box-sizing: border-box; width: 30rpx; height: 30rpx; border: 4rpx solid currentColor; border-right-color: transparent; border-radius: 50%; }
.update-button-icon__arrow { position: absolute; top: -7rpx; right: -5rpx; width: 0; height: 0; border-top: 7rpx solid transparent; border-bottom: 7rpx solid transparent; border-left: 10rpx solid currentColor; transform: rotate(-26deg); }
.update-hint { display: block; margin-top: 16rpx; color: #536b76; font-size: 22rpx; line-height: 1.55; text-align: center; }
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
  color: #536b76;
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

<style lang="scss" scoped>
/* Light Field about: brand deck, update rail and legal links. */
.about-page { min-height: 100vh; background: var(--mci-app-canvas, #f4f6f5); }
.about-skeleton { padding-top: 24rpx; }
.about-header { margin: -12rpx 24rpx 24rpx; padding: 44rpx 24rpx 38rpx; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 32rpx; background: var(--mci-app-surface, #fefffe) !important; box-shadow: var(--mci-shadow-deck); }
.about-logo { width: 112rpx; height: 112rpx; margin-bottom: 22rpx; border-radius: 28rpx; background: var(--mci-app-surface, #fefffe); box-shadow: none; }
.about-name { margin-bottom: 8rpx; color: var(--mci-text-primary, #17313d); font-size: 36rpx; font-weight: 740; letter-spacing: -.02em; }
.about-version { color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 24rpx; }
.about-env { background: var(--mci-app-surface-soft, #eef3f2); color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.about-content { padding: 0 24rpx !important; }
.update-card, .release-card, .info-group, .about-desc { margin-bottom: 24rpx; padding: 28rpx 26rpx; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 24rpx; background: var(--mci-app-surface, #fefffe) !important; box-shadow: none !important; }
.update-card--ready { border-color: var(--mci-border-color-hover, rgba(20,65,84,.18)); }
.update-card--mandatory { border-color: rgba(199,74,58,.22); }
.update-title, .release-title { color: var(--mci-text-primary, #17313d); font-size: 29rpx; }
.update-status, .update-hint, .release-item, .desc-text { color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.update-badge { background: var(--mci-color-danger-soft, #f8e8e5); color: var(--mci-color-danger, #c74a3a); }
.mandatory-tip { border-radius: 18rpx; background: var(--mci-color-danger-soft, #f8e8e5); color: var(--mci-color-danger, #c74a3a); }
.update-button { min-height: 88rpx; height: 88rpx; border-radius: 20rpx; background: var(--mci-gradient-primary); box-shadow: var(--mci-shadow-button); }
.update-button--disabled, .update-button--disabled button { background: var(--mci-app-surface-muted, #e7eeee) !important; color: var(--mci-text-tertiary, rgba(23,49,61,.46)) !important; }
.update-button--disabled text, .update-button--disabled view { color: var(--mci-text-tertiary, rgba(23,49,61,.46)) !important; }
.release-dot { background: var(--mci-color-brand, #e54625); }
.info-group { padding: 0; overflow: hidden; }
.info-item { min-height: 104rpx; padding: 12rpx 26rpx; border-bottom-color: var(--mci-divider, rgba(20,65,84,.1)); }
.info-label { color: var(--mci-text-primary, #17313d); font-size: 27rpx; font-weight: 600; }
.info-arrow { width: 15rpx; height: 15rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; color: var(--mci-text-tertiary, rgba(23,49,61,.46)); transform: rotate(45deg); }
.about-desc { line-height: 1.75; }
.about-footer { padding: 20rpx 0 calc(36rpx + var(--mci-safe-bottom)); }
.footer-text { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); }
</style>
