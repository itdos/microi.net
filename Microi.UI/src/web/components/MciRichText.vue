<template>
  <article class="mci-web-rich" v-html="html" />
</template>

<script setup>
defineOptions({ name: 'MciRichText' });
defineProps({
  html: { type: String, default: '' }
});
</script>

<style scoped>
.mci-web-rich {
  color: var(--mci-text-primary);
  line-height: 1.75;
  font-size: var(--mci-text-base);
}

.mci-web-rich :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
}

.mci-web-rich :deep(p),
.mci-web-rich :deep(div:not(:has(img))) {
  margin: 0 0 10px;
}
</style>
