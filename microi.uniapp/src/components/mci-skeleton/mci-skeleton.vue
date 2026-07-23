<template>
  <view class="mci-skeleton" :class="`mci-skeleton--${type}`" aria-label="内容加载中">
    <template v-if="type === 'detail'">
      <view class="mci-skeleton__hero"></view>
      <view v-for="index in rows" :key="index" class="mci-skeleton__line" :class="{ short: index % 3 === 0 }"></view>
    </template>
    <template v-else-if="type === 'form'">
      <view v-for="index in rows" :key="index" class="mci-skeleton__field">
        <view class="mci-skeleton__label"></view><view class="mci-skeleton__input"></view>
      </view>
    </template>
    <template v-else>
      <view v-for="index in rows" :key="index" class="mci-skeleton__card">
        <view class="mci-skeleton__line mci-skeleton__line--title"></view>
        <view class="mci-skeleton__line"></view>
        <view class="mci-skeleton__line short"></view>
      </view>
    </template>
  </view>
</template>

<script>
export default {
  name: 'MciSkeleton',
  props: {
    type: { type: String, default: 'list' },
    rows: { type: Number, default: 5 }
  }
}
</script>

<style scoped>
.mci-skeleton { padding: 24rpx; }
.mci-skeleton__card,
.mci-skeleton__hero,
.mci-skeleton__field { background: var(--mci-bg-card, #fff); border: 1px solid var(--mci-border, #e6edf0); border-radius: 8px; }
.mci-skeleton__card { padding: 28rpx; margin-bottom: 18rpx; }
.mci-skeleton__hero { height: 260rpx; margin-bottom: 24rpx; }
.mci-skeleton__field { padding: 24rpx; margin-bottom: 14rpx; }
.mci-skeleton__line,
.mci-skeleton__label,
.mci-skeleton__input { height: 24rpx; border-radius: 6rpx; background: linear-gradient(90deg, #e9eff1 25%, #f7fafb 45%, #e9eff1 65%); background-size: 300% 100%; animation: mciSkeletonShimmer 1.2s ease-in-out infinite; }
.mci-skeleton__line { width: 72%; margin-top: 18rpx; }
.mci-skeleton__line--title { width: 48%; height: 34rpx; margin-top: 0; }
.mci-skeleton__line.short { width: 36%; }
.mci-skeleton__label { width: 28%; margin-bottom: 16rpx; }
.mci-skeleton__input { width: 100%; height: 72rpx; }
@keyframes mciSkeletonShimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .mci-skeleton__line, .mci-skeleton__label, .mci-skeleton__input { animation: none; } }
</style>
