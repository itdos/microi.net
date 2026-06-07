<template>
  <div class="mci-web-skeleton" :class="`mci-web-skeleton--${type}`">
    <div v-for="item in rows" :key="item" class="mci-web-skeleton__row">
      <span class="mci-skeleton mci-web-skeleton__media" />
      <span class="mci-web-skeleton__copy">
        <i class="mci-skeleton" />
        <i class="mci-skeleton" />
      </span>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'MciSkeleton' });
defineProps({
  type: { type: String, default: 'list' },
  rows: { type: Number, default: 4 }
});
</script>

<style scoped>
.mci-web-skeleton {
  display: grid;
  gap: var(--mci-space-3);
}

.mci-web-skeleton--grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mci-web-skeleton__row {
  display: flex;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3);
  border-radius: var(--mci-radius-md);
  background: var(--mci-bg-surface);
}

.mci-web-skeleton__media {
  width: 72px;
  height: 72px;
  border-radius: var(--mci-radius-sm);
  flex: 0 0 auto;
}

.mci-web-skeleton__copy {
  flex: 1;
  display: grid;
  align-content: center;
  gap: 10px;
}

.mci-web-skeleton__copy i {
  display: block;
  height: 14px;
  border-radius: var(--mci-radius-pill);
}

.mci-web-skeleton__copy i:last-child {
  width: 62%;
}
</style>
