<template>
  <button
    class="mci-uni-button mci-pressable"
    :class="[
      `mci-uni-button--${variant}`,
      `mci-uni-button--${size}`,
      { 'mci-uni-button--block': block, 'mci-uni-button--sheen': sheen }
    ]"
    :disabled="disabled || loading"
    :loading="loading"
    @tap="$emit('tap', $event)"
  >
    <view class="mci-uni-button__content"><slot /></view>
  </button>
</template>

<script setup>
defineOptions({ name: 'MciButton' });
defineEmits(['tap']);
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
.mci-uni-button {
  position: relative;
  overflow: hidden;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--mci-shape-button);
  padding: 0 32rpx;
  box-sizing: border-box;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1;
  box-shadow: var(--mci-shadow-button);
  transition: transform var(--mci-duration-fast) var(--mci-ease-out), opacity var(--mci-duration-fast) var(--mci-ease-out);
}

.mci-uni-button::after {
  border: none;
}

.mci-uni-button:active {
  transform: scale(.98);
}

.mci-uni-button--primary {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
}

.mci-uni-button--gold {
  background: var(--mci-gradient-gold);
  color: var(--mci-text-on-gold);
  box-shadow: 0 10px 22px rgba(217, 162, 58, .22);
}

.mci-uni-button--plain {
  background: var(--mci-bg-surface);
  color: var(--mci-color-primary);
  border-color: var(--mci-color-primary);
  box-shadow: var(--mci-shadow-sm);
}

.mci-uni-button--cool {
  background: var(--mci-gradient-cool);
  color: var(--mci-text-inverse);
  box-shadow: 0 10px 22px rgba(8, 145, 178, .20);
}

.mci-uni-button--ghost {
  background: rgba(255, 255, 255, .08);
  color: var(--mci-text-primary);
  border-color: var(--mci-border);
  box-shadow: var(--mci-shadow-sm);
}

.mci-uni-button--block {
  width: 100%;
}

.mci-uni-button--sheen::before {
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

.mci-uni-button__content {
  position: relative;
  z-index: 1;
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
