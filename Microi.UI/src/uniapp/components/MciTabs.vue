<template>
  <view class="mci-uni-tabs" :class="[`mci-uni-tabs--${variant}`, `mci-uni-tabs--${size}`]">
    <view
      v-for="option in normalizedOptions"
      :key="option.value"
      class="mci-uni-tabs__item"
      :class="{ 'is-active': option.value === modelValue, 'is-disabled': option.disabled }"
      @tap="selectOption(option)"
    >
      <text>{{ option.label }}</text>
      <text v-if="option.badge" class="mci-uni-tabs__badge">{{ option.badge }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ name: 'MciTabs' });

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  variant: { type: String, default: 'soft' },
  size: { type: String, default: 'md' }
});

const emit = defineEmits(['update:modelValue', 'change']);

const normalizedOptions = computed(() =>
  props.options.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item, disabled: false, badge: '' };
    }
    return {
      label: item.label || String(item.value || ''),
      value: item.value !== undefined ? item.value : item.label,
      disabled: Boolean(item.disabled),
      badge: item.badge || ''
    };
  })
);

function selectOption(option) {
  if (option.disabled || option.value === props.modelValue) return;
  emit('update:modelValue', option.value);
  emit('change', option.value, option);
}
</script>

<style scoped>
.mci-uni-tabs {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-button);
  background: var(--mci-bg-muted);
  box-shadow: var(--mci-elevation-1);
  box-sizing: border-box;
}

.mci-uni-tabs__item {
  min-height: 72rpx;
  flex: 1;
  padding: 0 24rpx;
  border-radius: var(--mci-shape-button);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: var(--mci-text-secondary);
  font-size: 26rpx;
  font-weight: 750;
  transition: transform var(--mci-duration-fast) var(--mci-ease-out), background var(--mci-duration-base) var(--mci-ease-out);
}

.mci-uni-tabs--sm .mci-uni-tabs__item {
  min-height: 60rpx;
  padding: 0 18rpx;
  font-size: 24rpx;
}

.mci-uni-tabs--lg .mci-uni-tabs__item {
  min-height: 88rpx;
  padding: 0 30rpx;
  font-size: 30rpx;
}

.mci-uni-tabs__item.is-active {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-uni-tabs__item.is-disabled {
  opacity: .46;
}

.mci-uni-tabs__item:not(.is-disabled):active {
  transform: scale(.98);
}

.mci-uni-tabs__badge {
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: rgba(181, 18, 32, .10);
  color: var(--mci-color-primary);
  font-size: 20rpx;
  line-height: 30rpx;
  text-align: center;
}

.mci-uni-tabs__item.is-active .mci-uni-tabs__badge {
  background: rgba(255, 255, 255, .24);
  color: currentColor;
}
</style>
