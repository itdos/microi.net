<template>
  <article class="metric mci-card" :data-tone="metric.tone" tabindex="0">
    <div class="metric__top"><span>{{ metric.label }}</span><i aria-hidden="true"></i></div>
    <strong>{{ metric.value }}</strong>
    <p>{{ metric.hint }}</p>
  </article>
</template>

<script setup lang="ts">
import type { Metric } from '../domain/models'
defineProps<{ metric: Metric }>()
</script>

<style scoped>
.metric { min-height: 132px; padding: 17px; overflow: hidden; }
.metric::before { position: absolute; inset: 0; background: var(--mci-gradient-surface); content: ''; pointer-events: none; }
.metric__top { position: relative; display: flex; align-items: center; justify-content: space-between; color: var(--mci-text-secondary); font-size: 12px; font-weight: 650; }
.metric__top i { width: 8px; height: 8px; border-radius: 50%; background: var(--mci-text-tertiary); box-shadow: 0 0 0 5px color-mix(in srgb, var(--mci-text-tertiary) 12%, transparent); }
.metric[data-tone="primary"] .metric__top i { background: var(--mci-color-primary); box-shadow: 0 0 0 5px var(--mci-color-primary-glow); }
.metric[data-tone="success"] .metric__top i { background: var(--mci-color-success); }
.metric[data-tone="warning"] .metric__top i { background: var(--mci-color-warning); }
.metric[data-tone="danger"] .metric__top i { background: var(--mci-color-danger); }
.metric strong { position: relative; display: block; margin-top: 12px; font-family: var(--mci-font-mono); font-size: 29px; line-height: 1; font-variant-numeric: tabular-nums; }
.metric p { position: relative; margin: 10px 0 0; color: var(--mci-text-tertiary); font-size: 11px; }
</style>
