<template>
  <view class="mci-mobile-bottom-nav mci-uni-bottom-nav">
    <view
      v-for="item in items"
      :key="item.value || item.label"
      class="mci-mobile-bottom-nav__item mci-uni-bottom-nav__item mci-pressable"
      :class="{
        'is-active': item.value === modelValue,
        'is-center': item.center || item.value === centerValue
      }"
      @tap="selectItem(item)"
    >
      <view class="mci-mobile-bottom-nav__icon">
        <slot name="icon" :item="item">{{ item.icon }}</slot>
      </view>
      <text class="mci-uni-bottom-nav__label">{{ item.label }}</text>
      <text v-if="item.badge" class="mci-uni-bottom-nav__badge">{{ item.badge }}</text>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciBottomNav' });
const emit = defineEmits(['update:modelValue', 'change']);
defineProps({
  modelValue: { type: [String, Number], default: '' },
  centerValue: { type: [String, Number], default: '' },
  items: {
    type: Array,
    default: () => []
  }
});

function selectItem(item) {
  emit('update:modelValue', item.value);
  emit('change', item);
}
</script>

<style scoped>
.mci-uni-bottom-nav {
  background: var(--mci-mobile-tabbar-bg);
}

.mci-uni-bottom-nav__item {
  border: 0;
}

.mci-uni-bottom-nav__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-uni-bottom-nav__badge {
  position: absolute;
  top: 8rpx;
  right: 20%;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: var(--mci-color-danger);
  color: #fff;
  font-size: 18rpx;
  line-height: 30rpx;
  text-align: center;
}
</style>
