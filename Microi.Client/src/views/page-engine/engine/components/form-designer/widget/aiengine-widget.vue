<template>
  <div class="aiengine-widget">
    <component :is="aiEngineComp" embedded compact />
  </div>
</template>

<script setup name="aiengine-widget">
import { defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'

defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const aiEngineComp = shallowRef(
  defineAsyncComponent(() => import('@/views/ai-engine/index.vue'))
)

onBeforeUnmount(() => {
  aiEngineComp.value = null
})
</script>

<style lang="scss" scoped>
.aiengine-widget {
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  container-name: ai-engine-widget;
  container-type: inline-size;
  overflow: hidden;
}
</style>
