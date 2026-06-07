<template>
  <main class="mci-page mci-web-page" :class="{ 'mci-web-page--narrow': narrow }">
    <slot />
  </main>
</template>

<script setup>
defineOptions({ name: 'MciPage' });
defineProps({
  narrow: { type: Boolean, default: false }
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
