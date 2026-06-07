<template>
  <section class="mci-web-filter-bar" :class="{ 'is-sticky': sticky }">
    <div v-if="title || $slots.title" class="mci-web-filter-bar__title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div class="mci-web-filter-bar__body">
      <slot />
    </div>
    <div v-if="$slots.actions" class="mci-web-filter-bar__actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'MciFilterBar' });
defineProps({
  title: { type: String, default: '' },
  sticky: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: color-mix(in srgb, var(--mci-bg-surface) 90%, transparent);
  box-shadow: var(--mci-elevation-1);
  backdrop-filter: blur(14px) saturate(1.22);
}

.mci-web-filter-bar.is-sticky {
  position: sticky;
  top: var(--mci-space-3);
  z-index: var(--mci-z-sticky);
}

.mci-web-filter-bar__title {
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  font-weight: 900;
}

.mci-web-filter-bar__body {
  flex: 1;
  min-width: 220px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--mci-space-2);
}

.mci-web-filter-bar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--mci-space-2);
}
</style>
