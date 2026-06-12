<template>
  <view
    class="mci-page mci-uni-page"
    :class="{
      'mci-page--static': !animated,
      'mci-page--mobile-premium': premium,
      'mci-uni-page--safe-top': safeTop,
      'mci-uni-page--safe-bottom': safeBottom,
      'mci-tech-grid': techGrid
    }"
    :data-mci-shape="shape || undefined"
  >
    <slot />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciPage' });
defineProps({
  safeTop: { type: Boolean, default: false },
  safeBottom: { type: Boolean, default: true },
  animated: { type: Boolean, default: true },
  premium: { type: Boolean, default: false },
  techGrid: { type: Boolean, default: false },
  shape: { type: String, default: '' }
});
</script>

<style scoped>
.mci-uni-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: var(--mci-gradient-page, var(--mci-bg-page));
  color: var(--mci-text-primary);
  font-family: var(--mci-font-family);
}

.mci-uni-page--safe-top {
  padding-top: var(--mci-safe-top);
}

.mci-uni-page--safe-bottom {
  padding-bottom: var(--mci-safe-bottom);
}
</style>
