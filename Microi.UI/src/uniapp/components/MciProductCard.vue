<template>
  <view class="mci-uni-product-card mci-card mci-pressable" :class="{ 'is-disabled': disabled }" @tap="handleTap">
    <view class="mci-uni-product-card__media">
      <image v-if="image" class="mci-uni-product-card__image" :src="image" :mode="imageMode" />
      <view v-else class="mci-skeleton mci-uni-product-card__placeholder" />
      <text v-if="badge" class="mci-uni-product-card__badge">{{ badge }}</text>
    </view>
    <view class="mci-uni-product-card__body">
      <text class="mci-uni-product-card__title">{{ title }}</text>
      <text v-if="meta" class="mci-uni-product-card__meta">{{ meta }}</text>
      <view class="mci-uni-product-card__bottom">
        <text class="mci-uni-product-card__price">{{ priceText }}</text>
        <text v-if="tag" class="mci-uni-product-card__tag">{{ tag }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ name: 'MciProductCard' });

const props = defineProps({
  title: { type: String, default: '' },
  image: { type: String, default: '' },
  imageMode: { type: String, default: 'aspectFill' },
  price: { type: [String, Number], default: '' },
  meta: { type: String, default: '' },
  badge: { type: String, default: '' },
  tag: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['tap']);

const priceText = computed(() => {
  if (props.price === '' || props.price === null || props.price === undefined) return '';
  if (typeof props.price === 'number') return `¥${props.price.toFixed(2)}`;
  return props.price;
});

function handleTap(event) {
  if (props.disabled) return;
  emit('tap', event);
}
</script>

<style scoped>
.mci-uni-product-card {
  overflow: hidden;
}

.mci-uni-product-card.is-disabled {
  opacity: .58;
}

.mci-uni-product-card__media {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  overflow: hidden;
  background: var(--mci-bg-muted);
}

.mci-uni-product-card__image,
.mci-uni-product-card__placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.mci-uni-product-card__badge {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  max-width: calc(100% - 32rpx);
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  font-size: 22rpx;
  font-weight: 800;
  box-shadow: var(--mci-shadow-button);
}

.mci-uni-product-card__body {
  padding: 22rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.mci-uni-product-card__title {
  min-height: 74rpx;
  color: var(--mci-text-primary);
  font-size: 30rpx;
  line-height: 1.32;
  font-weight: 850;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.mci-uni-product-card__meta {
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
  line-height: 1.35;
}

.mci-uni-product-card__bottom {
  min-height: 46rpx;
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.mci-uni-product-card__price {
  color: var(--mci-color-primary);
  font-size: 34rpx;
  line-height: 1;
  font-weight: 900;
}

.mci-uni-product-card__tag {
  max-width: 42%;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
  font-size: 22rpx;
  font-weight: 750;
  white-space: nowrap;
}
</style>
