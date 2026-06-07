<template>
  <view class="mci-uni-avatar" :class="[`mci-uni-avatar--${shape}`]" :style="avatarStyle">
    <image v-if="src && !failed" class="mci-uni-avatar__image" :src="src" mode="aspectFill" @error="failed = true" />
    <text v-else class="mci-uni-avatar__text">{{ initials }}</text>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

defineOptions({ name: 'MciAvatar' });

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: [String, Number], default: '80rpx' },
  shape: { type: String, default: 'circle' }
});

const failed = ref(false);

watch(() => props.src, () => {
  failed.value = false;
});

const avatarStyle = computed(() => ({
  '--mci-avatar-size': typeof props.size === 'number' ? `${props.size}rpx` : props.size
}));

const initials = computed(() => {
  const text = (props.name || '').trim();
  if (!text) return 'M';
  return text.length <= 2 ? text : text.slice(0, 2);
});
</script>

<style scoped>
.mci-uni-avatar {
  width: var(--mci-avatar-size);
  height: var(--mci-avatar-size);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1rpx solid var(--mci-border);
  border-radius: 9999rpx;
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-elevation-1);
  box-sizing: border-box;
}

.mci-uni-avatar--square {
  border-radius: var(--mci-shape-panel);
}

.mci-uni-avatar__image {
  width: 100%;
  height: 100%;
  display: block;
}

.mci-uni-avatar__text {
  font-size: 30rpx;
  font-weight: 850;
  line-height: 1;
}
</style>
