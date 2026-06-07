<template>
  <button
    class="mci-button"
    :class="[`mci-button--${variant}`, `mci-button--${size}`]"
    :disabled="disabled || loading"
    type="button"
  >
    <span v-if="loading" class="mci-button__spinner" />
    <slot />
  </button>
</template>

<script setup>
defineOptions({ name: 'MciButton' });
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-button {
  min-height: var(--mci-touch-target);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--mci-radius-pill);
  padding: 0 18px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}

.mci-button:active {
  transform: scale(.98);
}

.mci-button:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.mci-button--primary {
  background: var(--mci-color-primary);
  color: var(--mci-text-inverse);
  box-shadow: var(--mci-shadow-sm);
}

.mci-button--gold {
  background: var(--mci-color-accent-gold);
  color: var(--mci-text-on-gold);
}

.mci-button--plain {
  background: var(--mci-bg-surface);
  color: var(--mci-color-primary);
  border-color: var(--mci-color-primary);
}

.mci-button--sm { min-height: 36px; padding: 0 14px; font-size: var(--mci-text-sm); }
.mci-button--md { min-height: var(--mci-touch-target); font-size: var(--mci-text-base); }
.mci-button--lg { min-height: 52px; padding: 0 24px; font-size: var(--mci-text-lg); }

.mci-button__spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: mciButtonSpin .7s linear infinite;
}

@keyframes mciButtonSpin {
  to { transform: rotate(360deg); }
}
</style>
