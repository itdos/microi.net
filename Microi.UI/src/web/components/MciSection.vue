<template>
  <section class="mci-section mci-web-section" :class="{ 'mci-container': container, 'mci-animate-enter': animated }">
    <header v-if="title || description || $slots.actions || $slots.header" class="mci-section__header">
      <slot name="header">
        <div>
          <p v-if="eyebrow" class="mci-web-section__eyebrow">{{ eyebrow }}</p>
          <h2 v-if="title" class="mci-section__title">{{ title }}</h2>
          <p v-if="description" class="mci-section__desc">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="mci-web-section__actions">
          <slot name="actions" />
        </div>
      </slot>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineOptions({ name: 'MciSection' });
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  container: { type: Boolean, default: true },
  animated: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-section__eyebrow {
  margin: 0 0 var(--mci-space-2);
  color: var(--mci-color-primary);
  font-size: var(--mci-text-sm);
  font-weight: 850;
}

.mci-web-section__actions {
  display: flex;
  align-items: center;
  gap: var(--mci-space-2);
}
</style>
