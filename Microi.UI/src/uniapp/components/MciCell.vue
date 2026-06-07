<template>
  <view class="mci-uni-cell" :class="{ 'mci-uni-cell--clickable': clickable }" @tap="$emit('tap', $event)">
    <view v-if="$slots.icon" class="mci-uni-cell__icon">
      <slot name="icon" />
    </view>
    <view class="mci-uni-cell__body">
      <text v-if="title" class="mci-uni-cell__title">{{ title }}</text>
      <text v-if="description" class="mci-uni-cell__desc">{{ description }}</text>
      <slot />
    </view>
    <view v-if="value || $slots.value" class="mci-uni-cell__value">
      <slot name="value">
        <text>{{ value }}</text>
      </slot>
    </view>
    <text v-if="arrow" class="mci-uni-cell__arrow">›</text>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciCell' });
defineEmits(['tap']);
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  value: { type: String, default: '' },
  arrow: { type: Boolean, default: true },
  clickable: { type: Boolean, default: true }
});
</script>

<style scoped>
.mci-uni-cell {
  min-height: 108rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  box-sizing: border-box;
}

.mci-uni-cell--clickable:active {
  transform: scale(var(--mci-press-scale));
  background: var(--mci-bg-card-hover);
}

.mci-uni-cell__icon {
  width: 76rpx;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
  flex: 0 0 auto;
}

.mci-uni-cell__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.mci-uni-cell__title {
  overflow: hidden;
  color: var(--mci-text-primary);
  font-size: 30rpx;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-uni-cell__desc {
  overflow: hidden;
  color: var(--mci-text-secondary);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-uni-cell__value {
  flex: 0 0 auto;
  color: var(--mci-text-tertiary);
  font-size: 26rpx;
}

.mci-uni-cell__arrow {
  flex: 0 0 auto;
  color: var(--mci-text-tertiary);
  font-size: 46rpx;
  line-height: 1;
}
</style>
