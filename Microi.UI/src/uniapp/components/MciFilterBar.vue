<template>
  <view class="mci-uni-filter-bar" :class="{ 'is-sticky': sticky }">
    <view v-if="title || $slots.title" class="mci-uni-filter-bar__title">
      <slot name="title">{{ title }}</slot>
    </view>
    <view class="mci-uni-filter-bar__body">
      <slot />
    </view>
    <view v-if="$slots.actions" class="mci-uni-filter-bar__actions">
      <slot name="actions" />
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciFilterBar' });
defineProps({
  title: { type: String, default: '' },
  sticky: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18rpx;
  padding: 20rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-elevation-1);
  box-sizing: border-box;
}

.mci-uni-filter-bar.is-sticky {
  position: sticky;
  top: 0;
  z-index: var(--mci-z-sticky);
}

.mci-uni-filter-bar__title {
  color: var(--mci-text-primary);
  font-size: 28rpx;
  font-weight: 900;
}

.mci-uni-filter-bar__body {
  flex: 1;
  min-width: 320rpx;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx;
}

.mci-uni-filter-bar__actions {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
</style>
