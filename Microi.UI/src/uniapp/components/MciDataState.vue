<template>
  <MciSkeleton v-if="loading" :type="skeletonType" :rows="skeletonRows" />
  <view v-else-if="empty || error" class="mci-uni-state" :class="{ 'mci-uni-state--error': error }">
    <view class="mci-uni-state__icon" />
    <text class="mci-uni-state__title">{{ error ? errorText : emptyText }}</text>
    <view v-if="$slots.description" class="mci-uni-state__desc">
      <slot name="description" />
    </view>
    <slot name="action" />
  </view>
  <slot v-else />
</template>

<script setup>
import MciSkeleton from './MciSkeleton.vue';

defineOptions({ name: 'MciDataState' });
defineProps({
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无数据' },
  errorText: { type: String, default: '加载失败' },
  skeletonType: { type: String, default: 'list' },
  skeletonRows: { type: Number, default: 4 }
});
</script>

<style scoped>
.mci-uni-state {
  min-height: 320rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  color: var(--mci-text-secondary);
  text-align: center;
}

.mci-uni-state__icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 4rpx solid var(--mci-border-strong);
  position: relative;
}

.mci-uni-state__icon::after {
  content: "";
  position: absolute;
  left: 26rpx;
  right: 26rpx;
  top: 45rpx;
  height: 4rpx;
  background: var(--mci-border-strong);
}

.mci-uni-state__title {
  font-size: 28rpx;
  font-weight: 700;
}

.mci-uni-state__desc {
  max-width: 520rpx;
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.mci-uni-state--error .mci-uni-state__icon {
  border-color: var(--mci-color-danger);
}
</style>
