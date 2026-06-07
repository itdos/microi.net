<template>
  <view v-if="modelValue" class="mci-uni-modal">
    <view class="mci-uni-modal__mask" @tap="handleMask" />
    <view class="mci-uni-modal__panel" :class="`mci-uni-modal__panel--${size}`">
      <view v-if="title || $slots.header" class="mci-uni-modal__header">
        <slot name="header">
          <text class="mci-uni-modal__title">{{ title }}</text>
        </slot>
        <text class="mci-uni-modal__close" @tap="close">×</text>
      </view>
      <view class="mci-uni-modal__body">
        <slot />
      </view>
      <view v-if="$slots.footer" class="mci-uni-modal__footer">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciModal' });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
  closeOnMask: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'close']);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleMask() {
  if (props.closeOnMask) close();
}
</script>

<style scoped>
.mci-uni-modal {
  position: fixed;
  inset: 0;
  z-index: var(--mci-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}

.mci-uni-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, .48);
}

.mci-uni-modal__panel {
  position: relative;
  width: 100%;
  max-width: 640rpx;
  overflow: hidden;
  border: 1rpx solid var(--mci-bg-glass-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-shadow-dialog);
  animation: mciUniModalIn var(--mci-duration-slow) var(--mci-ease-out) both;
}

.mci-uni-modal__panel--sm { max-width: 520rpx; }
.mci-uni-modal__panel--lg { max-width: 700rpx; }

.mci-uni-modal__header,
.mci-uni-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx 34rpx;
  border-bottom: 1rpx solid var(--mci-border);
}

.mci-uni-modal__title {
  color: var(--mci-text-primary);
  font-size: 32rpx;
  font-weight: 900;
}

.mci-uni-modal__close {
  width: 58rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: var(--mci-bg-muted);
  color: var(--mci-text-secondary);
  font-size: 42rpx;
  line-height: 54rpx;
  text-align: center;
}

.mci-uni-modal__body {
  padding: 34rpx;
}

.mci-uni-modal__footer {
  justify-content: flex-end;
  border-top: 1rpx solid var(--mci-border);
  border-bottom: 0;
}

@keyframes mciUniModalIn {
  from { opacity: 0; transform: translateY(24rpx) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
