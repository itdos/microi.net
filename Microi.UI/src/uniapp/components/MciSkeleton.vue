<template>
  <view class="mci-uni-skeleton" :class="`mci-uni-skeleton--${type}`">
    <view v-for="item in rows" :key="item" class="mci-uni-skeleton__row">
      <view class="mci-skeleton mci-uni-skeleton__media" />
      <view class="mci-uni-skeleton__copy">
        <view class="mci-skeleton mci-uni-skeleton__line" />
        <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--short" />
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciSkeleton' });
defineProps({
  type: { type: String, default: 'list' },
  rows: { type: Number, default: 4 }
});
</script>

<style scoped>
.mci-uni-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.mci-uni-skeleton--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.mci-uni-skeleton__row {
  min-height: 148rpx;
  display: flex;
  gap: 20rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: var(--mci-bg-surface);
  box-sizing: border-box;
}

.mci-uni-skeleton--grid .mci-uni-skeleton__row {
  display: block;
}

.mci-uni-skeleton__media {
  width: 112rpx;
  height: 112rpx;
  border-radius: 12rpx;
  flex: 0 0 auto;
}

.mci-uni-skeleton--grid .mci-uni-skeleton__media {
  width: 100%;
  height: 188rpx;
  margin-bottom: 18rpx;
}

.mci-uni-skeleton__copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18rpx;
}

.mci-uni-skeleton__line {
  height: 24rpx;
  border-radius: 999rpx;
}

.mci-uni-skeleton__line--short {
  width: 62%;
}
</style>
