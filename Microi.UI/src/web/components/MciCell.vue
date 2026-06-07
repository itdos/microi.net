<template>
  <component
    :is="tag"
    class="mci-cell mci-web-cell"
    :class="{ 'mci-web-cell--clickable': clickable }"
    v-bind="attrs"
  >
    <span v-if="$slots.icon" class="mci-web-cell__icon"><slot name="icon" /></span>
    <span class="mci-web-cell__body">
      <strong v-if="title">{{ title }}</strong>
      <small v-if="description">{{ description }}</small>
      <slot />
    </span>
    <span v-if="value || $slots.value" class="mci-web-cell__value">
      <slot name="value">{{ value }}</slot>
    </span>
    <span v-if="arrow" class="mci-web-cell__arrow" aria-hidden="true">›</span>
  </component>
</template>

<script setup>
import { computed, useAttrs } from 'vue';

defineOptions({ name: 'MciCell', inheritAttrs: false });
const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  value: { type: String, default: '' },
  arrow: { type: Boolean, default: true },
  href: { type: String, default: '' },
  clickable: { type: Boolean, default: false }
});
const rawAttrs = useAttrs();
const tag = computed(() => (props.href ? 'a' : 'div'));
const attrs = computed(() => ({
  ...rawAttrs,
  href: props.href || undefined
}));
</script>

<style scoped>
.mci-web-cell {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3) var(--mci-space-4);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  color: var(--mci-text-primary);
  text-decoration: none;
}

.mci-web-cell--clickable,
.mci-web-cell[href] {
  cursor: pointer;
  transition: transform var(--mci-duration-fast) var(--mci-ease-out), border-color var(--mci-duration-base) var(--mci-ease-out), background var(--mci-duration-base) var(--mci-ease-out);
}

@media (hover: hover) {
  .mci-web-cell--clickable:hover,
  .mci-web-cell[href]:hover {
    transform: translateY(-1px);
    border-color: var(--mci-border-strong);
    background: var(--mci-bg-card-hover);
  }
}

.mci-web-cell:active {
  transform: scale(var(--mci-press-scale));
}

.mci-web-cell__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
}

.mci-web-cell__body {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.mci-web-cell__body strong {
  overflow: hidden;
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-web-cell__body small {
  overflow: hidden;
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-web-cell__value,
.mci-web-cell__arrow {
  flex: 0 0 auto;
  color: var(--mci-text-tertiary);
}

.mci-web-cell__arrow {
  font-size: 24px;
  line-height: 1;
}
</style>
