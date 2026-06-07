<template>
  <button
    class="mci-uni-button"
    :class="[`mci-uni-button--${variant}`, `mci-uni-button--${size}`]"
    :disabled="disabled || loading"
    :loading="loading"
    @tap="$emit('tap', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
defineOptions({ name: 'MciButton' });
defineEmits(['tap']);
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-button {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 999rpx;
  padding: 0 32rpx;
  box-sizing: border-box;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1;
}

.mci-uni-button::after {
  border: none;
}

.mci-uni-button:active {
  transform: scale(.98);
}

.mci-uni-button--primary {
  background: var(--mci-color-primary);
  color: var(--mci-text-inverse);
}

.mci-uni-button--gold {
  background: var(--mci-color-accent-gold);
  color: var(--mci-text-on-gold);
}

.mci-uni-button--plain {
  background: var(--mci-bg-surface);
  color: var(--mci-color-primary);
  border-color: var(--mci-color-primary);
}

.mci-uni-button--sm {
  min-height: 72rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
}

.mci-uni-button--lg {
  min-height: 104rpx;
  padding: 0 44rpx;
  font-size: 34rpx;
}
</style>
