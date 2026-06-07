<template>
  <span class="mci-web-avatar" :class="[`mci-web-avatar--${shape}`]" :style="avatarStyle">
    <img v-if="src && !failed" :src="src" :alt="name || 'avatar'" @error="failed = true" />
    <span v-else>{{ initials }}</span>
  </span>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

defineOptions({ name: 'MciAvatar' });

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: [String, Number], default: 40 },
  shape: { type: String, default: 'circle' }
});

const failed = ref(false);

watch(() => props.src, () => {
  failed.value = false;
});

const avatarStyle = computed(() => ({
  '--mci-avatar-size': typeof props.size === 'number' ? `${props.size}px` : props.size
}));

const initials = computed(() => {
  const text = (props.name || '').trim();
  if (!text) return 'M';
  return text.length <= 2 ? text : text.slice(0, 2);
});
</script>

<style scoped>
.mci-web-avatar {
  width: var(--mci-avatar-size);
  height: var(--mci-avatar-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-radius-full);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-elevation-1);
  font-size: calc(var(--mci-avatar-size) * .38);
  font-weight: 850;
  line-height: 1;
}

.mci-web-avatar--square {
  border-radius: var(--mci-shape-panel);
}

.mci-web-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
