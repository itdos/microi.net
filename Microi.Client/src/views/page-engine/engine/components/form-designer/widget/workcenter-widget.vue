<template>
  <div class="workcenter-widget">
    <component
      :is="workCenterComp"
      :key="'workcenter_' + widgetObj.widgetOption.number + '_' + currentView"
      :initial-tab="currentView"
      :work-menu-id="workMenuId"
      :flow-menu-id="flowMenuId"
      :notice-menu-id="noticeMenuId"
      :calendar-menu-id="calendarMenuId"
      embedded
    />
  </div>
</template>

<script setup name="workcenter-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'
import { usePermissionStore } from '@/pinia/modules/permission'
import { resolveWidgetMenuId } from './widget-menu-context'

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

const permissions = usePermissionStore()
const resolveMenu = (index, table) => resolveWidgetMenuId(permissions.routes, props.widgetObj.widgetParams?.[index]?.value, table)
const workMenuId = computed(() => resolveMenu(1, 'wf_work'))
const flowMenuId = computed(() => resolveMenu(2, 'wf_flow'))
const noticeMenuId = computed(() => resolveMenu(3, 'diy_notice'))
const calendarMenuId = computed(() => resolveMenu(4, 'microi_calendar'))

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
