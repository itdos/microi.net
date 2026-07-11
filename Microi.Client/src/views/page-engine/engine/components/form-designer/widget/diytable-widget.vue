<template>
  <div class="diytable-widget" :class="{ 'is-design-mode': isDesignMode }" :style="{ width: '100%', height: autoHeight }">
    <div v-if="!tableId" class="widget-placeholder">
      <el-icon :size="32"><Grid /></el-icon>
      <span>DIY表格 - 请配置模块ID</span>
    </div>
    <component
      v-else
      :is="diyTableComp"
      :key="'diytable_' + widgetObj.widgetOption.number + '_' + tableId"
      :PropsTableId="tableId"
      :PropsSysMenuId="sysMenuId"
      :ContainerClass="containerClass"
      :LoadMode="loadMode"
      :PageSizeList="pageSizeList"
      :PropsEmbedded="!isDesignMode"
    />
  </div>
</template>

<script setup name="diytable-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
const route = useRoute()

// 使用 shallowRef + defineAsyncComponent 避免内存泄漏
const diyTableComp = shallowRef(
  defineAsyncComponent(() => import('@/views/form-engine/diy-table.vue'))
)

const autoHeight = computed(() => {
  return isDesignMode.value ? props.widgetObj.widgetOption.height + 'px' : 'auto'
})

const isDesignMode = computed(() => route.path.startsWith('/mic/autopage'))

const tableId = computed(() => {
  return props.widgetObj.widgetParams[0]?.value || ''
})

const sysMenuId = computed(() => {
  return props.widgetObj.widgetParams[1]?.value || ''
})

const containerClass = computed(() => {
  return props.widgetObj.widgetParams[2]?.value || ''
})

const pageSizeList = computed(() => {
  const value = props.widgetObj.widgetParams[3]?.value
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(Number).filter(size => size > 0))).sort((a, b) => a - b)
  }
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map(Number).filter(size => size > 0))).sort((a, b) => a - b)
    }
  } catch (error) {
    return Array.from(new Set(value.split(',').map(Number).filter(size => size > 0))).sort((a, b) => a - b)
  }
  return []
})

const loadMode = computed(() => isDesignMode.value ? 'Design' : '')

onBeforeUnmount(() => {
  diyTableComp.value = null
})
</script>

<style lang="scss" scoped>
.diytable-widget {
  min-height: 0;
  overflow: visible;
}
.diytable-widget.is-design-mode {
  overflow: auto;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .keyword-search) {
  min-height: 32px;
  padding: 2px 4px;
  margin-bottom: 3px !important;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table .el-table__cell) {
  padding: 3px 0;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table .cell) {
  line-height: 19px;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table__body .cell > div) {
  min-height: 0 !important;
  height: auto !important;
  line-height: 22px !important;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table),
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table__inner-wrapper),
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table__body-wrapper),
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table__body-wrapper .el-scrollbar),
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table__body-wrapper .el-scrollbar__wrap) {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-table .el-button) {
  min-height: 26px;
  height: 26px;
  padding: 4px 8px;
  font-size: 11px;
}
.diytable-widget:not(.is-design-mode) :deep(.home-notice-table .el-pagination) {
  min-height: 36px;
  padding: 5px 8px;
  margin: 2px 0 0 !important;
}
.widget-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
  gap: 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
}
</style>
