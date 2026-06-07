<template>
  <div class="mci-web-skeleton" :class="`mci-web-skeleton--${type}`">
    <template v-if="type === 'banner'">
      <span class="mci-skeleton mci-web-skeleton__banner" />
      <span class="mci-skeleton mci-web-skeleton__line mci-web-skeleton__line--wide" />
      <span class="mci-skeleton mci-web-skeleton__line" />
    </template>
    <template v-else-if="type === 'detail'">
      <span class="mci-skeleton mci-web-skeleton__hero" />
      <span class="mci-skeleton mci-web-skeleton__line mci-web-skeleton__line--wide" />
      <span class="mci-skeleton mci-web-skeleton__line" />
      <span class="mci-skeleton mci-web-skeleton__line mci-web-skeleton__line--short" />
    </template>
    <template v-else-if="type === 'metric'">
      <div v-for="item in rows" :key="item" class="mci-web-skeleton__metric">
        <span class="mci-skeleton mci-web-skeleton__line mci-web-skeleton__line--short" />
        <span class="mci-skeleton mci-web-skeleton__number" />
        <span class="mci-skeleton mci-web-skeleton__line" />
      </div>
    </template>
    <template v-else>
      <div v-for="item in rows" :key="item" class="mci-web-skeleton__row">
        <span class="mci-skeleton mci-web-skeleton__media" />
        <span class="mci-web-skeleton__copy">
          <i class="mci-skeleton" />
          <i class="mci-skeleton" />
        </span>
      </div>
    </template>
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

.mci-web-skeleton--metric {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.mci-web-skeleton__banner,
.mci-web-skeleton__hero {
  display: block;
  width: 100%;
}

.mci-web-skeleton__banner {
  height: 180px;
}

.mci-web-skeleton__hero {
  aspect-ratio: 16 / 10;
}

.mci-web-skeleton__line,
.mci-web-skeleton__number {
  display: block;
  border-radius: var(--mci-radius-pill);
}

.mci-web-skeleton__line {
  width: 72%;
  height: 14px;
}

.mci-web-skeleton__line--wide {
  width: 92%;
}

.mci-web-skeleton__line--short {
  width: 48%;
}

.mci-web-skeleton__number {
  width: 70%;
  height: 34px;
}

.mci-web-skeleton__metric {
  display: grid;
  gap: var(--mci-space-3);
  padding: var(--mci-space-4);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
}

@media (max-width: 768px) {
  .mci-web-skeleton--metric {
    grid-template-columns: 1fr;
  }
}
</style>
