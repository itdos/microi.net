<template>
  <section class="mci-card mci-web-card" :class="{ 'mci-web-card--interactive': interactive }">
    <slot />
  </section>
</template>

<script setup>
defineOptions({ name: 'MciCard' });
defineProps({
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-card {
  padding: var(--mci-space-4);
}

.mci-web-card--interactive {
  transition: transform .18s ease, box-shadow .18s ease;
}

.mci-web-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--mci-shadow-md);
}
</style>
