<template>
  <view class="mci-card mci-uni-card" :class="{ 'mci-uni-card--interactive': interactive }">
    <slot />
  </view>
</template>

<script setup>
defineOptions({ name: 'MciCard' });
defineProps({
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-uni-card {
  padding: 28rpx;
  border-radius: 16rpx;
}

.mci-uni-card--interactive:active {
  transform: scale(.985);
}
</style>
