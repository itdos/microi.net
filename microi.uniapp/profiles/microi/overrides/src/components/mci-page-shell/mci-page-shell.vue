<template>
  <view class="mci-page-shell" :class="`mci-page-shell--${tone}`" :style="shellStyle">
    <view class="mci-page-shell__nav" :style="navStyle">
      <view v-if="back" class="mci-page-shell__icon" hover-class="mci-page-shell__icon--pressed"
        role="button" tabindex="0" aria-label="返回" @tap="$emit('back')" @keydown.enter="$emit('back')">
        <view class="mci-page-shell__back" aria-hidden="true" />
      </view>
      <view v-else class="mci-page-shell__icon mci-page-shell__icon--empty"></view>
      <view class="mci-page-shell__heading">
        <text class="mci-page-shell__title">{{ displayTitle }}</text>
        <text v-if="displaySubtitle" class="mci-page-shell__subtitle">{{ displaySubtitle }}</text>
      </view>
      <view class="mci-page-shell__right"><slot name="right"></slot></view>
    </view>
    <view class="mci-page-shell__body"><slot></slot></view>
    <slot name="fixed"></slot>
    <mci-ai-launcher v-if="showDock" />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'

function decodeShellText(value) {
  let decoded = String(value || '')
  for (let index = 0; index < 12; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch (error) {
      break
    }
  }
  return decoded
}

export default {
  name: 'MciPageShell',
  mixins: [themeMixin],
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    back: { type: Boolean, default: true },
    tone: { type: String, default: 'default' },
    showDock: { type: Boolean, default: true }
  },
  emits: ['back'],
  computed: {
    displayTitle() { return decodeShellText(this.title) },
    displaySubtitle() { return decodeShellText(this.subtitle) },
    shellStyle() {
      const safe = this._safeAreaMetrics || {}
      return {
        ...this.mciTokenStyle,
        '--mci-header-height': `${(safe.navHeight || 44) + 14}px`
      }
    },
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
/* Microi Blue Suite: every engine page enters through the same native white navigation bar. */
.mci-page-shell { position: relative; min-height: 100vh; color: var(--mci-text-primary, #111827); background: var(--mci-app-canvas, #f8fafc); overflow: visible; }
.mci-page-shell__nav { position: sticky; top: 0; z-index: 20; display: grid; grid-template-columns: var(--mci-nav-left-width, 52px) minmax(0, 1fr) var(--mci-nav-side-width, 52px); align-items: center; box-sizing: border-box; min-height: var(--mci-header-height, 44px) !important; padding-right: max(16rpx, var(--mci-safe-right)); padding-bottom: 0; padding-left: max(16rpx, var(--mci-safe-left)); color: var(--mci-text-primary, #111827); border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); background: #fff; overflow: hidden; }
.mci-page-shell__nav::after { display: none; }
.mci-page-shell--focus .mci-page-shell__nav { background: #fff; }
.mci-page-shell__icon { position: relative; z-index: 1; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: currentColor; transition: background-color .15s ease; border-radius: 8rpx; outline: none; }
.mci-page-shell__icon--pressed { background: var(--mci-color-primary-faint, rgba(37,99,235,.05)); }
.mci-page-shell__icon:focus-visible { box-shadow: inset 0 0 0 4rpx rgba(74, 205, 224, .62); }
.mci-page-shell__back { width: 20rpx; height: 20rpx; border-bottom: 4rpx solid currentColor; border-left: 4rpx solid currentColor; border-radius: 1rpx; transform: rotate(45deg); }
.mci-page-shell__icon--empty { visibility: hidden; }
.mci-page-shell__heading { position: relative; z-index: 1; min-width: 0; padding: 0 12rpx; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; box-sizing: border-box; }
.mci-page-shell__title { max-width: 100%; overflow: hidden; color: var(--mci-text-primary, #111827); font-size: 31rpx; font-weight: 720; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.mci-page-shell__subtitle { max-width: 100%; margin-top: 2rpx; overflow: hidden; color: var(--mci-text-tertiary, #9ca3af); font-size: 22rpx; line-height: 29rpx; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.mci-page-shell--focus .mci-page-shell__subtitle { color: var(--mci-text-tertiary, #9ca3af); }
.mci-page-shell__right { position: relative; z-index: 1; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: flex-start; color: currentColor; }
.mci-page-shell__body { position: relative; z-index: 1; min-height: calc(100vh - var(--mci-header-height, 44px)); }
.mci-page-shell--light { color: var(--mci-text-primary, #18313d); background: var(--mci-app-canvas, #f5f7f8); }
.mci-page-shell--light .mci-page-shell__nav { color: var(--mci-text-primary, #18313d); border-bottom-color: var(--mci-divider, rgba(20, 65, 84, .08)); background: var(--mci-bg-elevated, #fff); }
.mci-page-shell--light .mci-page-shell__nav::after { display: none; }
.mci-page-shell--light .mci-page-shell__title { color: var(--mci-text-primary, #18313d); }
.mci-page-shell--light .mci-page-shell__subtitle { color: var(--mci-text-tertiary, rgba(24, 49, 61, .52)); }
.mci-page-shell--light .mci-page-shell__icon--pressed { background: var(--mci-color-primary-faint, rgba(8, 125, 168, .05)); }
@media (prefers-reduced-motion: reduce) { .mci-page-shell__icon { transition: none; } }
</style>
