<template>
  <header class="intro mci-page-enter">
    <div>
      <small>{{ eyebrow }}</small>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <div class="intro__actions"><slot /></div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description: string }>()
</script>

<style scoped>
.intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 20px; padding: 4px 2px 2px; }
.intro small { color: var(--mci-color-primary); font-size: 9px; font-weight: 820; letter-spacing: .16em; }
.intro h2 { margin: 6px 0 7px; font-size: clamp(23px, 2.3vw, 30px); line-height: 1.2; }
.intro p { max-width: 760px; margin: 0; color: var(--mci-text-secondary); line-height: 1.7; }
.intro__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
@media (max-width: 720px) { .intro { align-items: stretch; flex-direction: column; }.intro__actions { justify-content: flex-start; } }
</style>
