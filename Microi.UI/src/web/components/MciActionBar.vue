<template>
  <div class="mci-web-action-bar" :class="[{ 'is-fixed': fixed }, `mci-web-action-bar--${align}`]">
    <slot />
  </div>
</template>

<script setup>
defineOptions({ name: 'MciActionBar' });
defineProps({
  fixed: { type: Boolean, default: true },
  align: { type: String, default: 'between' }
});
</script>

<style scoped>
.mci-web-action-bar {
  display: flex;
  align-items: center;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3) max(var(--mci-space-4), var(--mci-safe-right)) calc(var(--mci-space-3) + var(--mci-safe-bottom)) max(var(--mci-space-4), var(--mci-safe-left));
  border-top: 1px solid var(--mci-border);
  background: color-mix(in srgb, var(--mci-bg-surface) 88%, transparent);
  box-shadow: 0 -10px 30px rgba(24, 32, 48, .08);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
}

.mci-web-action-bar.is-fixed {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--mci-z-sticky);
}

.mci-web-action-bar--start { justify-content: flex-start; }
.mci-web-action-bar--center { justify-content: center; }
.mci-web-action-bar--end { justify-content: flex-end; }
.mci-web-action-bar--between { justify-content: space-between; }

.mci-web-action-bar :deep(.mci-button),
.mci-web-action-bar :deep(button) {
  min-width: 0;
}
</style>
