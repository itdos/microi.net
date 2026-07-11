<template>
  <div class="diycalendar-widget" :class="{ 'is-design-mode': isDesignMode }" :style="{ width: '100%', height: autoHeight }">
    <component
      :is="calendarComp"
      :key="'diycalendar_' + widgetObj.widgetOption.number"
      embedded
    />
  </div>
</template>

<script setup name="diycalendar-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
const route = useRoute()

const calendarComp = shallowRef(
  defineAsyncComponent(() => import('@/views/fullcalendar/fullcalendar.vue'))
)

const autoHeight = computed(() => {
  return isDesignMode.value ? props.widgetObj.widgetOption.height + 'px' : 'auto'
})

const isDesignMode = computed(() => route.path.startsWith('/mic/autopage'))

onBeforeUnmount(() => {
  calendarComp.value = null
})
</script>

<style lang="scss" scoped>
.diycalendar-widget {
  min-height: 0;
  overflow: visible;
}
.diycalendar-widget.is-design-mode {
  overflow: auto;
}
</style>
