<template>
  <view class="mci-uni-asset-card" :class="[`mci-uni-asset-card--${tone}`, { 'is-interactive': interactive }]">
    <view class="mci-uni-asset-card__header">
      <text>{{ label }}</text>
      <slot name="extra" />
    </view>
    <view class="mci-uni-asset-card__value">
      <slot>{{ value }}</slot>
      <text v-if="suffix" class="mci-uni-asset-card__suffix">{{ suffix }}</text>
    </view>
    <view v-if="description || trend || $slots.footer" class="mci-uni-asset-card__footer">
      <slot name="footer">{{ trend || description }}</slot>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciAssetCard' });
defineProps({
  label: { type: String, default: '资产' },
  value: { type: [String, Number], default: '' },
  suffix: { type: String, default: '' },
  trend: { type: String, default: '' },
  description: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-asset-card {
  position: relative;
  overflow: hidden;
  padding: 34rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-shadow-card);
  box-sizing: border-box;
}

.mci-uni-asset-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 6rpx;
  background: var(--mci-gradient-primary);
}

.mci-uni-asset-card--gold::before { background: var(--mci-gradient-gold); }
.mci-uni-asset-card--cool::before { background: var(--mci-gradient-cool); }

.mci-uni-asset-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--mci-text-secondary);
  font-size: 26rpx;
  font-weight: 800;
}

.mci-uni-asset-card__value {
  margin-top: 22rpx;
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  color: var(--mci-text-primary);
  font-size: 58rpx;
  line-height: 1.1;
  font-weight: 950;
}

.mci-uni-asset-card__suffix {
  color: var(--mci-text-secondary);
  font-size: 28rpx;
  font-weight: 850;
}

.mci-uni-asset-card__footer {
  margin-top: 18rpx;
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
}

.mci-uni-asset-card.is-interactive:active {
  transform: scale(.99);
}
</style>
