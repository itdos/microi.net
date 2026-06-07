<template>
  <view class="mci-uni-section" :class="{ 'mci-animate-enter': animated }">
    <view v-if="title || description || $slots.actions || $slots.header" class="mci-uni-section__header">
      <slot name="header">
        <view class="mci-uni-section__copy">
          <text v-if="eyebrow" class="mci-uni-section__eyebrow">{{ eyebrow }}</text>
          <text v-if="title" class="mci-uni-section__title">{{ title }}</text>
          <text v-if="description" class="mci-uni-section__desc">{{ description }}</text>
        </view>
        <view v-if="$slots.actions" class="mci-uni-section__actions">
          <slot name="actions" />
        </view>
      </slot>
    </view>
    <slot />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciSection' });
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  animated: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-section {
  padding: 32rpx 24rpx;
}

.mci-uni-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.mci-uni-section__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.mci-uni-section__eyebrow {
  color: var(--mci-color-primary);
  font-size: 24rpx;
  font-weight: 850;
}

.mci-uni-section__title {
  color: var(--mci-text-primary);
  font-size: 38rpx;
  line-height: 1.22;
  font-weight: 850;
}

.mci-uni-section__desc {
  color: var(--mci-text-secondary);
  font-size: 26rpx;
  line-height: 1.55;
}

.mci-uni-section__actions {
  flex: 0 0 auto;
}
</style>
