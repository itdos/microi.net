<template>
  <div class="diycalendar-widget" :class="{ 'is-design-mode': isDesignMode }" :style="{ width: '100%', height: autoHeight }">
    <component
      v-if="calendarMenuId"
      :is="calendarComp"
      :key="'diycalendar_' + widgetObj.widgetOption.number"
      embedded
      :compact="compactDashboard"
      :menu-id="calendarMenuId"
    />
    <div v-else-if="compactDashboard" class="home-calendar-fallback">
      <el-calendar ref="calendarRef" v-model="calendarDate">
        <template #header="{ date }">
          <div class="home-calendar-header">
            <span>{{ date }}</span>
            <div class="home-calendar-actions">
              <el-button text :aria-label="$pet('上个月')" :title="$pet('上个月')" @click="calendarRef.selectDate('prev-month')"><el-icon><ArrowLeft /></el-icon></el-button>
              <el-button text @click="calendarRef.selectDate('today')">{{ $pet('今天') }}</el-button>
              <el-button text :aria-label="$pet('下个月')" :title="$pet('下个月')" @click="calendarRef.selectDate('next-month')"><el-icon><ArrowRight /></el-icon></el-button>
            </div>
          </div>
        </template>
      </el-calendar>
      <p>{{ $pet('当前未配置日程模块，先查看本月日期') }}</p>
    </div>
    <el-empty v-else :description="$pet('当前租户尚未配置可访问的日程模块')" :image-size="64" />
  </div>
</template>

<script setup name="diycalendar-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef, ref } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
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
const compactDashboard = computed(() => props.widgetObj.widgetParams?.[1]?.value === 'compact')
const calendarDate = ref(new Date())
const calendarRef = ref()

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
.home-calendar-fallback :deep(.el-calendar__header) { padding: 6px 0 10px; font-size: 13px; }
.home-calendar-header { display:flex;align-items:center;justify-content:space-between;width:100%;gap:4px;white-space:nowrap;font-size:12px; }
.home-calendar-actions { display:flex;align-items:center; }
.home-calendar-actions :deep(.el-button) { margin:0;padding:4px 5px;min-width:24px; }
.home-calendar-fallback :deep(.el-calendar__body) { padding: 0; }
.home-calendar-fallback :deep(.el-calendar-day) { height: 28px; padding: 4px; text-align: center; font-size: 11px; }
.home-calendar-fallback :deep(th) { padding: 5px; font-size: 11px; }
.home-calendar-fallback p { margin: 8px 0 0; font-size: 11px; color: var(--mci-text-secondary); }
</style>
