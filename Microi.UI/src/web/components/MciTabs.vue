<template>
  <div class="mci-web-tabs" :class="[`mci-web-tabs--${variant}`, `mci-web-tabs--${size}`]" role="tablist">
    <button
      v-for="option in normalizedOptions"
      :key="option.value"
      type="button"
      class="mci-web-tabs__item"
      :class="{ 'is-active': option.value === modelValue, 'is-disabled': option.disabled }"
      :disabled="option.disabled"
      role="tab"
      :aria-selected="option.value === modelValue"
      @click="selectOption(option)"
    >
      <span>{{ option.label }}</span>
      <em v-if="option.badge">{{ option.badge }}</em>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ name: 'MciTabs' });

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  variant: { type: String, default: 'soft' },
  size: { type: String, default: 'md' }
});

const emit = defineEmits(['update:modelValue', 'change']);

const normalizedOptions = computed(() =>
  props.options.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item, disabled: false, badge: '' };
    }
    return {
      label: item.label ?? String(item.value ?? ''),
      value: item.value ?? item.label,
      disabled: Boolean(item.disabled),
      badge: item.badge ?? ''
    };
  })
);

function selectOption(option) {
  if (option.disabled || option.value === props.modelValue) return;
  emit('update:modelValue', option.value);
  emit('change', option.value, option);
}
</script>

<style scoped>
.mci-web-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-button);
  background: var(--mci-bg-muted);
  box-shadow: var(--mci-elevation-1);
}

.mci-web-tabs--block {
  display: flex;
  width: 100%;
}

.mci-web-tabs__item {
  min-height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: calc(var(--mci-shape-button) - 3px);
  background: transparent;
  color: var(--mci-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--mci-text-sm);
  font-weight: 750;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform var(--mci-duration-fast) var(--mci-ease-out), color var(--mci-duration-base) var(--mci-ease-out), background var(--mci-duration-base) var(--mci-ease-out), box-shadow var(--mci-duration-base) var(--mci-ease-out);
}

.mci-web-tabs--block .mci-web-tabs__item {
  flex: 1;
}

.mci-web-tabs--sm .mci-web-tabs__item {
  min-height: 30px;
  padding: 0 12px;
  font-size: var(--mci-text-xs);
}

.mci-web-tabs--lg .mci-web-tabs__item {
  min-height: 44px;
  padding: 0 20px;
  font-size: var(--mci-text-base);
}

.mci-web-tabs__item em {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--mci-radius-pill);
  background: rgba(181, 18, 32, .10);
  color: var(--mci-color-primary);
  font-size: 11px;
  font-style: normal;
  line-height: 18px;
}

.mci-web-tabs__item.is-active {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-web-tabs__item.is-active em {
  background: rgba(255, 255, 255, .24);
  color: currentColor;
}

.mci-web-tabs__item.is-disabled {
  cursor: not-allowed;
  opacity: .46;
}

@media (hover: hover) {
  .mci-web-tabs__item:not(.is-active):not(.is-disabled):hover {
    background: var(--mci-bg-surface);
    color: var(--mci-color-primary);
  }
}

.mci-web-tabs__item:not(.is-disabled):active {
  transform: scale(.98);
}
</style>
