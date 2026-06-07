<template>
  <view class="mci-uni-metric" :class="[`mci-uni-metric--${tone}`, { 'is-interactive': interactive }]">
    <view class="mci-uni-metric__header">
      <text v-if="label" class="mci-uni-metric__label">{{ label }}</text>
      <slot name="extra" />
    </view>
    <view class="mci-uni-metric__value">
      <slot>{{ value }}</slot>
      <text v-if="suffix" class="mci-uni-metric__suffix">{{ suffix }}</text>
    </view>
    <view v-if="trend || $slots.footer" class="mci-uni-metric__footer">
      <slot name="footer">{{ trend }}</slot>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciMetricCard' });
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  suffix: { type: String, default: '' },
  trend: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-metric {
  position: relative;
  overflow: hidden;
  min-height: 228rpx;
  padding: 36rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-card);
  box-sizing: border-box;
}

.mci-uni-metric--gold {
  background: var(--mci-gradient-gold);
  color: var(--mci-text-on-gold);
}

.mci-uni-metric--cool {
  background: var(--mci-gradient-cool);
}

.mci-uni-metric__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.mci-uni-metric__label {
  font-size: 26rpx;
  font-weight: 750;
  opacity: .88;
}

.mci-uni-metric__value {
  margin-top: 22rpx;
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  font-size: 66rpx;
  line-height: 1.12;
  font-weight: 900;
}

.mci-uni-metric__suffix {
  font-size: 28rpx;
  font-weight: 800;
}

.mci-uni-metric__footer {
  margin-top: 18rpx;
  font-size: 26rpx;
  opacity: .86;
}

.mci-uni-metric.is-interactive:active {
  transform: scale(.99);
}
</style>
