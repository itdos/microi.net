<template>
  <ol class="mci-web-steps" :class="{ 'is-vertical': vertical }">
    <li
      v-for="(item, index) in steps"
      :key="item.key || index"
      class="mci-web-steps__item"
      :class="{ 'is-active': index === current, 'is-finished': index < current }"
    >
      <span>{{ index + 1 }}</span>
      <div>
        <strong>{{ item.title }}</strong>
        <p v-if="item.description">{{ item.description }}</p>
      </div>
    </li>
  </ol>
</template>

<script setup>
defineOptions({ name: 'MciSteps' });
defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: Number, default: 0 },
  vertical: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--mci-space-3);
  padding: 0;
  margin: 0;
  list-style: none;
}

.mci-web-steps.is-vertical {
  grid-template-columns: 1fr;
}

.mci-web-steps__item {
  position: relative;
  display: flex;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-panel);
  background: var(--mci-bg-surface);
  color: var(--mci-text-secondary);
  box-shadow: var(--mci-elevation-1);
}

.mci-web-steps__item span {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--mci-radius-full);
  background: var(--mci-bg-muted);
  color: var(--mci-text-secondary);
  font-weight: 900;
}

.mci-web-steps__item.is-active {
  border-color: var(--mci-border-glow);
}

.mci-web-steps__item.is-active span,
.mci-web-steps__item.is-finished span {
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-web-steps__item strong {
  color: var(--mci-text-primary);
  font-weight: 900;
}

.mci-web-steps__item p {
  margin: 5px 0 0;
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
  line-height: 1.5;
}
</style>
