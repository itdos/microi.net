<template>
  <view
    class="mci-mobile-hero mci-uni-hero-panel"
    :class="[
      `mci-uni-hero-panel--${tone}`,
      { 'mci-uni-hero-panel--compact': compact }
    ]"
  >
    <view class="mci-mobile-hero__content">
      <slot name="eyebrow">
        <text v-if="eyebrow" class="mci-mobile-hero__eyebrow">{{ eyebrow }}</text>
      </slot>
      <slot name="title">
        <text v-if="title" class="mci-mobile-hero__title">{{ title }}</text>
      </slot>
      <slot name="description">
        <text v-if="description" class="mci-mobile-hero__desc">{{ description }}</text>
      </slot>
      <view v-if="$slots.actions" class="mci-mobile-action-row">
        <slot name="actions" />
      </view>
      <slot />
    </view>
    <view v-if="$slots.media" class="mci-uni-hero-panel__media">
      <slot name="media" />
    </view>
  </view>
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
.mci-uni-hero-panel {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.mci-uni-hero-panel--compact {
  min-height: 296rpx;
}

.mci-uni-hero-panel--soft {
  background: var(--mci-bg-mobile-hero-soft);
  color: var(--mci-text-primary);
  box-shadow: var(--mci-shadow-mobile-card);
}

.mci-uni-hero-panel--soft .mci-mobile-hero__desc {
  color: var(--mci-text-secondary);
}

.mci-uni-hero-panel__media {
  position: relative;
  z-index: 1;
}
</style>
