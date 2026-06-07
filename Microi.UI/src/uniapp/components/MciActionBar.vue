<template>
  <view class="mci-uni-action-bar" :class="[{ 'is-fixed': fixed }, `mci-uni-action-bar--${align}`]">
    <slot />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciActionBar' });
defineProps({
  fixed: { type: Boolean, default: true },
  align: { type: String, default: 'between' }
});
</script>

<style scoped>
.mci-uni-action-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx calc(20rpx + var(--mci-safe-bottom)) 24rpx;
  border-top: 1rpx solid var(--mci-border);
  background: var(--mci-bg-surface);
  box-shadow: 0 -16rpx 42rpx rgba(24, 32, 48, .10);
  box-sizing: border-box;
}

.mci-uni-action-bar.is-fixed {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--mci-z-sticky);
}

.mci-uni-action-bar--start { justify-content: flex-start; }
.mci-uni-action-bar--center { justify-content: center; }
.mci-uni-action-bar--end { justify-content: flex-end; }
.mci-uni-action-bar--between { justify-content: space-between; }
</style>
