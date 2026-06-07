<template>
  <ol class="mci-web-timeline">
    <li v-for="(item, index) in items" :key="item.key || index" class="mci-web-timeline__item">
      <span class="mci-web-timeline__dot" :class="`is-${item.type || 'primary'}`" />
      <div class="mci-web-timeline__content">
        <strong>{{ item.title }}</strong>
        <p v-if="item.description">{{ item.description }}</p>
        <time v-if="item.time">{{ item.time }}</time>
      </div>
    </li>
  </ol>
</template>

<script setup>
defineOptions({ name: 'MciTimeline' });
defineProps({
  items: { type: Array, default: () => [] }
});
</script>

<style scoped>
.mci-web-timeline {
  display: grid;
  gap: var(--mci-space-4);
  padding: 0;
  margin: 0;
  list-style: none;
}

.mci-web-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: var(--mci-space-3);
}

.mci-web-timeline__item:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 9px;
  top: 24px;
  bottom: -18px;
  width: 2px;
  border-radius: 999px;
  background: var(--mci-border);
}

.mci-web-timeline__dot {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border: 4px solid var(--mci-bg-surface);
  border-radius: var(--mci-radius-full);
  background: var(--mci-color-primary);
  box-shadow: 0 0 0 4px var(--mci-border-glow);
  z-index: 1;
}

.mci-web-timeline__dot.is-success { background: var(--mci-color-success); }
.mci-web-timeline__dot.is-warning { background: var(--mci-color-warning); }
.mci-web-timeline__dot.is-danger { background: var(--mci-color-danger); }

.mci-web-timeline__content {
  padding: var(--mci-space-3);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-elevation-1);
}

.mci-web-timeline__content strong {
  color: var(--mci-text-primary);
  font-weight: 900;
}

.mci-web-timeline__content p,
.mci-web-timeline__content time {
  display: block;
  margin: 6px 0 0;
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
  line-height: 1.55;
}
</style>
