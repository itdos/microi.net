<template>
  <section
    class="mci-mobile-hero mci-web-hero-panel"
    :class="[
      `mci-web-hero-panel--${tone}`,
      { 'mci-web-hero-panel--compact': compact }
    ]"
  >
    <div class="mci-mobile-hero__content mci-web-hero-panel__content">
      <slot name="eyebrow">
        <span v-if="eyebrow" class="mci-mobile-hero__eyebrow">{{ eyebrow }}</span>
      </slot>
      <slot name="title">
        <h1 v-if="title" class="mci-mobile-hero__title">{{ title }}</h1>
      </slot>
      <slot name="description">
        <p v-if="description" class="mci-mobile-hero__desc">{{ description }}</p>
      </slot>
      <div v-if="$slots.actions" class="mci-mobile-action-row">
        <slot name="actions" />
      </div>
      <slot />
    </div>
    <div v-if="$slots.media" class="mci-web-hero-panel__media">
      <slot name="media" />
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'MciHeroPanel' });
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  tone: { type: String, default: 'brand' },
  compact: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
}

.mci-web-hero-panel--compact {
  min-height: 148px;
}

.mci-web-hero-panel--soft {
  background: var(--mci-bg-mobile-hero-soft);
  color: var(--mci-text-primary);
  box-shadow: var(--mci-shadow-mobile-card);
}

.mci-web-hero-panel--soft :deep(.mci-mobile-hero__desc) {
  color: var(--mci-text-secondary);
}

.mci-web-hero-panel__content {
  min-width: 0;
}

.mci-web-hero-panel__media {
  position: relative;
  z-index: 1;
  width: min(32vw, 220px);
  min-width: 120px;
}

@media (max-width: 768px) {
  .mci-web-hero-panel {
    grid-template-columns: 1fr;
  }

  .mci-web-hero-panel__media {
    width: 100%;
  }
}
</style>
