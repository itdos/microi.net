<template>
  <view
    class="mci-card mci-uni-card"
    :class="[
      `mci-uni-card--${variant}`,
      {
        'mci-uni-card--interactive': interactive,
        'mci-hover-lift': interactive,
        'mci-idle-sheen': sheen,
        'mci-animate-enter': animated
      }
    ]"
  >
    <slot />
  </view>
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
.mci-uni-card {
  padding: 28rpx;
}

.mci-uni-card--interactive:active {
  transform: scale(.985);
}

.mci-uni-card--muted {
  background: var(--mci-bg-muted);
}

.mci-uni-card--glass {
  background: var(--mci-bg-glass);
  border-color: var(--mci-bg-glass-border);
}

.mci-uni-card--focus {
  border-color: var(--mci-border-glow);
}
</style>
