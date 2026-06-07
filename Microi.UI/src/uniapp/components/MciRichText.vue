<template>
  <view class="mci-uni-rich">
    <rich-text :nodes="nodes || html" />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciRichText' });
defineProps({
  html: { type: String, default: '' },
  nodes: { type: [String, Array], default: '' }
});
</script>

<style scoped>
.mci-uni-rich {
  box-sizing: border-box;
  color: var(--mci-text-primary);
  font-size: 30rpx;
  line-height: 1.75;
}

.mci-uni-rich :deep(img),
.mci-uni-rich :deep(image) {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}

.mci-uni-rich :deep(p),
.mci-uni-rich :deep(.mci-rich-text-block) {
  margin: 0;
  padding: 0 32rpx 14rpx;
  box-sizing: border-box;
}

.mci-uni-rich :deep(h1),
.mci-uni-rich :deep(h2),
.mci-uni-rich :deep(h3) {
  margin: 0;
  padding: 24rpx 32rpx 12rpx;
  box-sizing: border-box;
  line-height: 1.35;
}
</style>
