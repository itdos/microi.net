<template>
  <view class="mci-page-shell" :style="mciTokenStyle">
    <view class="mci-page-shell__nav" :style="navStyle">
      <view v-if="back" class="mci-page-shell__icon" hover-class="mci-page-shell__icon--pressed" @tap="$emit('back')"><text>‹</text></view>
      <view v-else class="mci-page-shell__icon mci-page-shell__icon--empty"></view>
      <view class="mci-page-shell__heading">
        <text class="mci-page-shell__title">{{ title }}</text>
        <text v-if="subtitle" class="mci-page-shell__subtitle">{{ subtitle }}</text>
        <view class="mci-page-shell__live"></view>
      </view>
      <view class="mci-page-shell__right"><slot name="right"></slot></view>
    </view>
    <view class="mci-page-shell__body"><slot></slot></view>
    <slot name="fixed"></slot>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'

export default {
  name: 'MciPageShell',
  mixins: [themeMixin],
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    back: { type: Boolean, default: true }
  },
  emits: ['back'],
  computed: {
    navStyle() {
      const safe = this._safeAreaMetrics || {}
      return {
        paddingTop: `${safe.statusBarHeight || 0}px`,
        minHeight: `${safe.navHeight || 44}px`
      }
    }
  }
}
</script>

<style scoped>
.mci-page-shell { position: relative; min-height: 100vh; color: var(--mci-text-primary, #17313b); background: var(--mci-bg-base, #f4f8fa); overflow-x: hidden; }
.mci-page-shell__nav { display: grid; grid-template-columns: var(--mci-nav-left-width, 52px) minmax(0, 1fr) var(--mci-nav-side-width, 52px); align-items: center; box-sizing: content-box; padding-left: max(16rpx, var(--mci-safe-left)); padding-right: max(16rpx, var(--mci-safe-right)); background: rgba(255,255,255,.96); border-bottom: 1px solid var(--mci-border, #e6edf0); position: sticky; top: 0; z-index: 20; }
.mci-page-shell__icon { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; font-size: 58rpx; line-height: 1; color: var(--mci-text-primary, #17313b); transition: transform .18s ease, background-color .18s ease; border-radius: 50%; }
.mci-page-shell__icon--pressed { transform: scale(.94); background: rgba(11,134,212,.09); }
.mci-page-shell__icon--empty { visibility: hidden; }
.mci-page-shell__heading { position: relative; min-width: 0; padding: 0 10rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
.mci-page-shell__title { max-width: 100%; font-size: 32rpx; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mci-page-shell__subtitle { max-width: 100%; margin-top: 3rpx; font-size: 20rpx; color: var(--mci-text-secondary, #647982); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mci-page-shell__live { position: absolute; left: 50%; bottom: -13rpx; width: 10rpx; height: 10rpx; margin-left: -5rpx; border-radius: 50% 50% 50% 0; background: #18a6b8; box-shadow: 0 0 10rpx rgba(24,166,184,.28); opacity: .36; transform: rotate(-45deg); animation: mciShellLive 2.8s ease-in-out infinite; }
.mci-page-shell__right { min-width: 72rpx; display: flex; align-items: center; justify-content: flex-start; }
.mci-page-shell__body { position: relative; z-index: 1; min-height: calc(100vh - var(--mci-header-height, 44px)); }
@keyframes mciShellLive { 0%, 100% { transform: rotate(-45deg) scale(.72); opacity: .26; } 50% { transform: rotate(-45deg) scale(1); opacity: .78; } }
@media (prefers-reduced-motion: reduce) { .mci-page-shell__live { animation: none; } }
</style>
