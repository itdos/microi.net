<template>
  <main
    class="mci-page mci-web-page"
    :class="{
      'mci-page--static': !animated,
      'mci-safe-page': safeArea,
      'mci-web-page--narrow': narrow,
      'mci-tech-grid': techGrid
    }"
    :data-mci-shape="shape || undefined"
  >
    <slot />
  </main>
</template>

<script setup>
defineOptions({ name: 'MciPage' });
defineProps({
  narrow: { type: Boolean, default: false },
  animated: { type: Boolean, default: true },
  safeArea: { type: Boolean, default: false },
  techGrid: { type: Boolean, default: false },
  shape: { type: String, default: '' }
});
</script>

<style scoped>
.mci-web-page {
  width: 100%;
}

.mci-web-page--narrow {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--mci-space-6);
}
</style>
