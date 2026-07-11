<template>
  <div class="workcenter-widget">
    <component
      :is="workCenterComp"
      :key="'workcenter_' + widgetObj.widgetOption.number + '_' + currentView"
      :initial-tab="currentView"
      :work-menu-id="workMenuId"
      :flow-menu-id="flowMenuId"
      embedded
    />
  </div>
</template>

<script setup name="workcenter-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const workCenterComp = shallowRef(
  defineAsyncComponent(() => import('@/views/workflow/my-work.vue'))
)

const currentView = computed(() => {
  const value = props.widgetObj.widgetParams?.[0]?.value
  return ['work', 'calendar', 'notice'].includes(value) ? value : 'work'
})

const workMenuId = computed(() => props.widgetObj.widgetParams?.[1]?.value || '')
const flowMenuId = computed(() => props.widgetObj.widgetParams?.[2]?.value || '')

onBeforeUnmount(() => {
  workCenterComp.value = null
})
</script>

<style lang="scss" scoped>
.workcenter-widget {
  width: 100%;
  height: auto;
  min-height: 0;
  overflow: visible;
}
</style>
