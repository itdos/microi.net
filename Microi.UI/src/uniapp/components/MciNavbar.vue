<template>
  <view class="mci-navbar">
    <view class="mci-navbar__safe" />
    <view class="mci-navbar__bar">
      <view class="mci-navbar__left" @tap="$emit('back')">
        <slot name="left">
          <text v-if="back" class="mci-navbar__back">‹</text>
        </slot>
      </view>
      <text class="mci-navbar__title">{{ title }}</text>
      <view class="mci-navbar__right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({ name: 'MciNavbar' });
defineEmits(['back']);
defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: true }
});
</script>

<style scoped>
.mci-navbar {
  background: var(--mci-bg-surface);
  color: var(--mci-text-primary);
  border-bottom: 1px solid var(--mci-border);
}

.mci-navbar__safe {
  height: var(--mci-safe-top);
}

.mci-navbar__bar {
  height: 88rpx;
  display: grid;
  grid-template-columns: 96rpx 1fr 96rpx;
  align-items: center;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.mci-navbar__left,
.mci-navbar__right {
  min-width: 88rpx;
  min-height: 88rpx;
  display: flex;
  align-items: center;
}

.mci-navbar__right {
  justify-content: flex-end;
}

.mci-navbar__title {
  min-width: 0;
  text-align: center;
  font-size: 32rpx;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-navbar__back {
  font-size: 54rpx;
  line-height: 1;
  color: var(--mci-text-primary);
}
</style>
