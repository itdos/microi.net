<template>
  <div class="diycalendar-widget" :style="{ width: '100%', height: autoHeight }">
    <component
      :is="calendarComp"
      :key="'diycalendar_' + widgetObj.widgetOption.number"
    />
  </div>
</template>

<script setup name="diycalendar-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const calendarComp = shallowRef(
  defineAsyncComponent(() => import('@/views/fullcalendar/fullcalendar.vue'))
)

const autoHeight = computed(() => {
  return props.widgetObj.widgetOption.height + 'px'
})

onBeforeUnmount(() => {
  calendarComp.value = null
})
</script>

<style lang="scss" scoped>
.diycalendar-widget {
  overflow: auto;
}
</style>
