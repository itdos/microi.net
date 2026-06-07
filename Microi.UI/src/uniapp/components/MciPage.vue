<template>
  <view class="mci-page mci-uni-page" :class="{ 'mci-uni-page--safe-bottom': safeBottom }">
    <slot />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciPage' });
defineProps({
  safeBottom: { type: Boolean, default: true }
});
</script>

<style scoped>
.mci-uni-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: var(--mci-bg-page);
  color: var(--mci-text-primary);
  font-family: var(--mci-font-family);
}

.mci-uni-page--safe-bottom {
  padding-bottom: var(--mci-safe-bottom);
}
</style>
