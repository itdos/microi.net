<template>
  <section
    class="mci-card mci-web-card"
    :class="[
      `mci-web-card--${variant}`,
      {
        'mci-hover-lift': interactive,
        'mci-idle-sheen': sheen,
        'mci-animate-enter': animated
      }
    ]"
  >
    <slot />
  </section>
</template>

<script setup>
defineOptions({ name: 'MciCard' });
defineProps({
  interactive: { type: Boolean, default: false },
  animated: { type: Boolean, default: false },
  sheen: { type: Boolean, default: false },
  variant: { type: String, default: 'surface' }
});
</script>

<style scoped>
.mci-web-card {
  padding: var(--mci-space-4);
}

.mci-web-card--muted {
  background: var(--mci-bg-muted);
}

.mci-web-card--glass {
  background: var(--mci-bg-glass);
  border-color: var(--mci-bg-glass-border);
  backdrop-filter: blur(14px) saturate(1.35);
  -webkit-backdrop-filter: blur(14px) saturate(1.35);
}

.mci-web-card--focus {
  border-color: var(--mci-border-glow);
}
</style>
