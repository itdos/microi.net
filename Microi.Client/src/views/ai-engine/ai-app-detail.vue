<template>
    <AiAppWorkbench mode="detail" standalone />
</template>

<script setup>
import AiAppWorkbench from "./ai-app-workbench.vue";
</script>

<style scoped>
:deep(.ai-app-workbench) {
    min-height: calc(100vh - 84px);
}
</style>
