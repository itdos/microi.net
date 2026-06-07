<template>
  <view class="mci-uni-order-card">
    <view class="mci-uni-order-card__header">
      <text>{{ orderNo }}</text>
      <text class="mci-uni-order-card__status" :class="`is-${statusType}`">{{ status }}</text>
    </view>
    <view class="mci-uni-order-card__body">
      <slot name="media">
        <view class="mci-uni-order-card__media" />
      </slot>
      <view class="mci-uni-order-card__content">
        <text class="mci-uni-order-card__title">{{ title }}</text>
        <text v-if="description" class="mci-uni-order-card__desc">{{ description }}</text>
        <slot />
      </view>
      <text class="mci-uni-order-card__amount">{{ amount }}</text>
    </view>
    <view v-if="time || $slots.actions" class="mci-uni-order-card__footer">
      <text>{{ time }}</text>
      <view v-if="$slots.actions" class="mci-uni-order-card__actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciOrderCard' });
defineProps({
  orderNo: { type: String, default: '订单号' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  amount: { type: String, default: '' },
  status: { type: String, default: '进行中' },
  statusType: { type: String, default: 'primary' },
  time: { type: String, default: '' }
});
</script>

<style scoped>
.mci-uni-order-card {
  overflow: hidden;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-shadow-card);
}

.mci-uni-order-card__header,
.mci-uni-order-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 28rpx;
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
}

.mci-uni-order-card__header {
  border-bottom: 1rpx solid var(--mci-border);
}

.mci-uni-order-card__status {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(181,18,32,.10);
  color: var(--mci-color-primary);
  font-weight: 850;
}

.mci-uni-order-card__status.is-success {
  background: rgba(15,159,110,.12);
  color: var(--mci-color-success);
}

.mci-uni-order-card__status.is-warning {
  background: rgba(183,121,31,.14);
  color: var(--mci-color-warning);
}

.mci-uni-order-card__body {
  display: flex;
  gap: 20rpx;
  padding: 28rpx;
}

.mci-uni-order-card__media {
  width: 128rpx;
  height: 128rpx;
  border-radius: var(--mci-shape-panel);
  background: linear-gradient(135deg, rgba(181,18,32,.14), rgba(37,99,235,.12));
  flex: 0 0 auto;
}

.mci-uni-order-card__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.mci-uni-order-card__title {
  color: var(--mci-text-primary);
  font-size: 28rpx;
  font-weight: 900;
}

.mci-uni-order-card__desc {
  color: var(--mci-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.mci-uni-order-card__amount {
  color: var(--mci-color-primary);
  font-size: 30rpx;
  font-weight: 950;
  white-space: nowrap;
}

.mci-uni-order-card__footer {
  border-top: 1rpx solid var(--mci-border);
}

.mci-uni-order-card__actions {
  display: flex;
  gap: 14rpx;
}
</style>
