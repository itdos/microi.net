<template>
  <view v-if="enabled" class="mci-ai-entry" hover-class="mci-ai-entry--pressed" role="button" tabindex="0" aria-label="打开 AI 助手" @tap="openAssistant" @keyup.enter="openAssistant" @keyup.space.prevent="openAssistant">
    <view class="mci-ai-entry__icon" aria-hidden="true">
      <image class="mci-ai-entry__robot" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
    </view>
    <view class="mci-ai-entry__copy">
      <view class="mci-ai-entry__title-line">
        <text class="mci-ai-entry__title">问 AI 助手</text>
        <text class="mci-ai-entry__tag">数据按权限</text>
      </view>
      <text class="mci-ai-entry__desc">检索业务数据、待办与应用</text>
    </view>
    <view class="mci-ai-entry__next">
      <text>进入</text>
      <view class="mci-ai-entry__arrow" aria-hidden="true" />
    </view>
  </view>
</template>

<script>
export default {
  name: 'MciAiHomeCard',
  props: {
    enabled: { type: Boolean, default: false }
  },
  methods: {
    openAssistant() {
      uni.navigateTo({
        url: '/pages/ai/index',
        fail: () => uni.showToast({ title: 'AI 助手打开失败，请重试', icon: 'none' })
      })
    }
  }
}
</script>

<style scoped>
.mci-ai-entry {
  min-height: 96rpx;
  margin: 0 0 20rpx;
  padding: 11rpx 18rpx;
  display: grid;
  grid-template-columns: 52rpx minmax(0, 1fr) 44rpx;
  align-items: center;
  gap: 14rpx;
  box-sizing: border-box;
  color: var(--mci-text-primary);
  border: 1rpx solid var(--mci-border-color);
  border-radius: var(--mci-radius-surface, 8px);
  background: var(--mci-app-surface, #fff);
  box-shadow: var(--mci-shadow-card);
  transition: background-color 150ms ease-out;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}
.mci-ai-entry:focus-visible { outline: 3rpx solid var(--mci-color-primary-light); outline-offset: 3rpx; }
.mci-ai-entry--pressed { background: rgba(17, 24, 28, .035); }
.mci-ai-entry__icon {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--mci-color-primary-soft, #dbeafe);
}
.mci-ai-entry__robot { width: 42rpx; height: 42rpx; }
.mci-ai-entry__copy { position: relative; z-index: 1; min-width: 0; display: flex; flex-direction: column; }
.mci-ai-entry__title-line { display: flex; align-items: center; gap: 10rpx; }
.mci-ai-entry__title { color: var(--mci-text-primary); font-size: 22rpx; line-height: 30rpx; font-weight: 700; }
.mci-ai-entry__tag {
  min-height: 28rpx;
  padding: 0 8rpx;
  display: inline-flex;
  align-items: center;
  color: var(--mci-text-primary);
  border: 0;
  border-radius: 4rpx;
  background: var(--mci-color-primary-faint);
  color: var(--mci-color-primary);
  font-size: 15rpx;
  font-weight: 620;
}
.mci-ai-entry__desc { margin-top: 1rpx; overflow: hidden; color: var(--mci-text-tertiary); font-size: 17rpx; line-height: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.mci-ai-entry__next {
  position: relative;
  z-index: 1;
  width: 44rpx;
  min-width: 44rpx;
  height: 44rpx;
  min-height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6rpx;
  color: var(--mci-color-primary);
  background: var(--mci-color-primary-faint);
}
.mci-ai-entry__next text { display: none; }
.mci-ai-entry__arrow { width: 10rpx; height: 10rpx; border-top: 2rpx solid currentColor; border-right: 2rpx solid currentColor; transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) { .mci-ai-entry { transition: none; } }
</style>
