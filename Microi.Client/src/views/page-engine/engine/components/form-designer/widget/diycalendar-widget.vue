<template>
  <div class="diycalendar-widget" :class="{ 'is-design-mode': isDesignMode }" :style="{ width: '100%', height: autoHeight }">
    <component
      v-if="calendarMenuId"
      :is="calendarComp"
      :key="'diycalendar_' + widgetObj.widgetOption.number"
      embedded
      :menu-id="calendarMenuId"
    />
    <el-empty v-else description="当前租户尚未配置可访问的日程模块" :image-size="64" />
  </div>
</template>

<script setup name="diycalendar-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { usePermissionStore } from '@/pinia/modules/permission'
import { resolveWidgetMenuId } from './widget-menu-context'

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
const permissions = usePermissionStore()
const calendarMenuId = computed(() => resolveWidgetMenuId(permissions.routes, props.widgetObj.widgetParams?.[0]?.value, 'microi_calendar'))

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
