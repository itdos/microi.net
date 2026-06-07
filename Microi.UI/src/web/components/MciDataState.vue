<template>
  <MciSkeleton v-if="loading" :type="skeletonType" :rows="skeletonRows" />
  <div v-else-if="empty || error" class="mci-web-state" :class="{ 'mci-web-state--error': error }">
    <div class="mci-web-state__icon" />
    <strong>{{ error ? errorText : emptyText }}</strong>
    <p v-if="$slots.description"><slot name="description" /></p>
    <slot name="action" />
  </div>
  <slot v-else />
</template>

<script setup>
import MciSkeleton from './MciSkeleton.vue';

defineOptions({ name: 'MciDataState' });
defineProps({
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无数据' },
  errorText: { type: String, default: '加载失败' },
  skeletonType: { type: String, default: 'list' },
  skeletonRows: { type: Number, default: 4 }
});
</script>

<style scoped>
.mci-web-state {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--mci-space-2);
  color: var(--mci-text-secondary);
  text-align: center;
}

.mci-web-state__icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid var(--mci-border-strong);
  position: relative;
}

.mci-web-state__icon::after {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  top: 24px;
  height: 2px;
  background: var(--mci-border-strong);
}

.mci-web-state--error .mci-web-state__icon {
  border-color: var(--mci-color-danger);
}
</style>
