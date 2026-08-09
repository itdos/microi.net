<template>
  <div v-if="state === 'loading'" class="state state--loading" role="status" aria-label="正在加载">
    <span v-for="item in 4" :key="item" class="skeleton"></span>
  </div>
  <div v-else-if="state === 'error'" class="state" role="alert">
    <span class="state__icon" aria-hidden="true">!</span>
    <strong>暂时无法加载</strong>
    <p>{{ message || '请检查连接后重试，当前输入不会丢失。' }}</p>
    <button type="button" class="mci-button" @click="$emit('retry')">重新加载</button>
  </div>
  <div v-else-if="state === 'empty'" class="state">
    <span class="state__icon" aria-hidden="true">＋</span>
    <strong>{{ title || '暂无数据' }}</strong>
    <p>{{ message || '创建第一条记录后，这里会展示真实状态。' }}</p>
    <button v-if="action" type="button" class="mci-button" @click="$emit('action')">{{ action }}</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ state: 'loading' | 'error' | 'empty'; title?: string; message?: string; action?: string }>()
defineEmits<{ retry: []; action: [] }>()
</script>

<style scoped>
.state { display: grid; min-height: 180px; place-items: center; align-content: center; gap: 8px; padding: 24px; color: var(--mci-text-secondary); text-align: center; }
.state strong { color: var(--mci-text-primary); }
.state p { max-width: 520px; margin: 0 0 6px; line-height: 1.6; }
.state__icon { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--mci-border-strong); border-radius: 50%; color: var(--mci-color-primary); background: var(--mci-bg-soft); font-weight: 800; }
.state--loading { grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: stretch; }
.skeleton { min-height: 64px; border-radius: var(--mci-shape-input); background: linear-gradient(90deg, var(--mci-bg-soft), color-mix(in srgb, var(--mci-border-strong) 42%, var(--mci-bg-elevated)), var(--mci-bg-soft)); background-size: 240% 100%; animation: mciSkeleton 1.15s ease-in-out infinite; }
</style>
