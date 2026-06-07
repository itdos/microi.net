<template>
  <button
    class="mci-button mci-pressable mci-focus-ring"
    :class="[
      `mci-button--${variant}`,
      `mci-button--${size}`,
      { 'mci-button--block': block, 'mci-button--sheen': sheen }
    ]"
    :disabled="disabled || loading"
    type="button"
  >
    <span v-if="loading" class="mci-button__spinner" />
    <span class="mci-button__content"><slot /></span>
  </button>
</template>

<script setup>
defineOptions({ name: 'MciButton' });
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  sheen: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-button {
  position: relative;
  overflow: hidden;
  min-height: var(--mci-touch-target);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--mci-shape-button);
  padding: 0 18px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--mci-duration-fast) var(--mci-ease-out), background var(--mci-duration-base) var(--mci-ease-out), border-color var(--mci-duration-base) var(--mci-ease-out), opacity var(--mci-duration-fast) var(--mci-ease-out);
}

.mci-button--sheen::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -38%;
  width: 32%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent);
  transform: skewX(-18deg);
  animation: mciSheen 4.8s ease-in-out infinite;
  pointer-events: none;
}

@media (hover: hover) {
  .mci-button:hover {
    transform: translateY(-2px);
    box-shadow: var(--mci-shadow-button-hover);
  }
}

.mci-button:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.mci-button--primary {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-button--gold {
  background: var(--mci-gradient-gold);
  color: var(--mci-text-on-gold);
  box-shadow: 0 10px 22px rgba(217, 162, 58, .22);
}

.mci-button--plain {
  background: var(--mci-bg-surface);
  color: var(--mci-color-primary);
  border-color: var(--mci-color-primary);
}

.mci-button--cool {
  background: var(--mci-gradient-cool);
  color: var(--mci-text-inverse);
  box-shadow: 0 10px 22px rgba(8, 145, 178, .20);
}

.mci-button--ghost {
  background: rgba(255, 255, 255, .08);
  color: var(--mci-text-primary);
  border-color: var(--mci-border);
}

.mci-button--block {
  width: 100%;
}

.mci-button--sm { min-height: 36px; padding: 0 14px; font-size: var(--mci-text-sm); }
.mci-button--md { min-height: var(--mci-touch-target); font-size: var(--mci-text-base); }
.mci-button--lg { min-height: 52px; padding: 0 24px; font-size: var(--mci-text-lg); }

.mci-button__content,
.mci-button__spinner {
  position: relative;
  z-index: 1;
}

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
