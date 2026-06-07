<template>
  <view class="mci-uni-skeleton" :class="`mci-uni-skeleton--${type}`">
    <template v-if="type === 'banner'">
      <view class="mci-skeleton mci-uni-skeleton__banner" />
      <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--wide" />
      <view class="mci-skeleton mci-uni-skeleton__line" />
    </template>
    <template v-else-if="type === 'detail'">
      <view class="mci-skeleton mci-uni-skeleton__hero" />
      <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--wide" />
      <view class="mci-skeleton mci-uni-skeleton__line" />
      <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--short" />
    </template>
    <template v-else-if="type === 'metric'">
      <view v-for="item in rows" :key="item" class="mci-uni-skeleton__metric">
        <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--short" />
        <view class="mci-skeleton mci-uni-skeleton__number" />
        <view class="mci-skeleton mci-uni-skeleton__line" />
      </view>
    </template>
    <template v-else>
      <view v-for="item in rows" :key="item" class="mci-uni-skeleton__row">
        <view class="mci-skeleton mci-uni-skeleton__media" />
        <view class="mci-uni-skeleton__copy">
          <view class="mci-skeleton mci-uni-skeleton__line" />
          <view class="mci-skeleton mci-uni-skeleton__line mci-uni-skeleton__line--short" />
        </view>
      </view>
    </template>
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

.mci-uni-skeleton--metric {
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

.mci-uni-skeleton__line--wide {
  width: 92%;
}

.mci-uni-skeleton__banner,
.mci-uni-skeleton__hero {
  width: 100%;
  display: block;
}

.mci-uni-skeleton__banner {
  height: 260rpx;
}

.mci-uni-skeleton__hero {
  height: 420rpx;
}

.mci-uni-skeleton__number {
  width: 70%;
  height: 56rpx;
  border-radius: 999rpx;
}

.mci-uni-skeleton__metric {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 24rpx;
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-sizing: border-box;
}
</style>
