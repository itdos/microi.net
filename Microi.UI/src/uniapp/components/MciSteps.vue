<template>
  <view class="mci-uni-steps" :class="{ 'is-vertical': vertical }">
    <view
      v-for="(item, index) in steps"
      :key="item.key || index"
      class="mci-uni-steps__item"
      :class="{ 'is-active': index === current, 'is-finished': index < current }"
    >
      <text class="mci-uni-steps__index">{{ index + 1 }}</text>
      <view class="mci-uni-steps__content">
        <text class="mci-uni-steps__title">{{ item.title }}</text>
        <text v-if="item.description" class="mci-uni-steps__desc">{{ item.description }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciSteps' });
defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: Number, default: 0 },
  vertical: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.mci-uni-steps.is-vertical {
  grid-template-columns: 1fr;
}

.mci-uni-steps__item {
  display: flex;
  gap: 16rpx;
  padding: 20rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-elevation-1);
}

.mci-uni-steps__index {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 999rpx;
  background: var(--mci-bg-muted);
  color: var(--mci-text-secondary);
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
  line-height: 52rpx;
}

.mci-uni-steps__item.is-active,
.mci-uni-steps__item.is-finished {
  border-color: var(--mci-border-glow);
}

.mci-uni-steps__item.is-active .mci-uni-steps__index,
.mci-uni-steps__item.is-finished .mci-uni-steps__index {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-uni-steps__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.mci-uni-steps__title {
  color: var(--mci-text-primary);
  font-size: 26rpx;
  font-weight: 900;
}

.mci-uni-steps__desc {
  color: var(--mci-text-tertiary);
  font-size: 22rpx;
  line-height: 1.45;
}
</style>
