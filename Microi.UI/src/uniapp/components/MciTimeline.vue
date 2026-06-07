<template>
  <view class="mci-uni-timeline">
    <view v-for="(item, index) in items" :key="item.key || index" class="mci-uni-timeline__item">
      <view class="mci-uni-timeline__dot" :class="`is-${item.type || 'primary'}`" />
      <view class="mci-uni-timeline__content">
        <text class="mci-uni-timeline__title">{{ item.title }}</text>
        <text v-if="item.description" class="mci-uni-timeline__desc">{{ item.description }}</text>
        <text v-if="item.time" class="mci-uni-timeline__time">{{ item.time }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciTimeline' });
defineProps({
  items: { type: Array, default: () => [] }
});
</script>

<style scoped>
.mci-uni-timeline {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.mci-uni-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: 44rpx minmax(0, 1fr);
  gap: 18rpx;
}

.mci-uni-timeline__item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 15rpx;
  top: 42rpx;
  bottom: -26rpx;
  width: 4rpx;
  border-radius: 999rpx;
  background: var(--mci-border);
}

.mci-uni-timeline__dot {
  width: 32rpx;
  height: 32rpx;
  margin-top: 4rpx;
  border: 6rpx solid var(--mci-bg-surface);
  border-radius: 999rpx;
  background: var(--mci-color-primary);
  box-shadow: 0 0 0 6rpx var(--mci-border-glow);
  z-index: 1;
}

.mci-uni-timeline__dot.is-success { background: var(--mci-color-success); }
.mci-uni-timeline__dot.is-warning { background: var(--mci-color-warning); }
.mci-uni-timeline__dot.is-danger { background: var(--mci-color-danger); }

.mci-uni-timeline__content {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 22rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-elevation-1);
}

.mci-uni-timeline__title {
  color: var(--mci-text-primary);
  font-size: 28rpx;
  font-weight: 900;
}

.mci-uni-timeline__desc,
.mci-uni-timeline__time {
  color: var(--mci-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}
</style>
