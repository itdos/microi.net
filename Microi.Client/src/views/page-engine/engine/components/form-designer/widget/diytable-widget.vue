<template>
  <div class="diytable-widget" :style="{ width: '100%', height: autoHeight }">
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
      LoadMode="Design"
    />
  </div>
</template>

<script setup name="diytable-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

// 使用 shallowRef + defineAsyncComponent 避免内存泄漏
const diyTableComp = shallowRef(
  defineAsyncComponent(() => import('@/views/form-engine/diy-table.vue'))
)

const autoHeight = computed(() => {
  return props.widgetObj.widgetOption.height + 'px'
})

const tableId = computed(() => {
  return props.widgetObj.widgetParams[0]?.value || ''
})

const sysMenuId = computed(() => {
  return props.widgetObj.widgetParams[1]?.value || ''
})

const containerClass = computed(() => {
  return props.widgetObj.widgetParams[2]?.value || ''
})

onBeforeUnmount(() => {
  diyTableComp.value = null
})
</script>

<style lang="scss" scoped>
.diytable-widget {
  overflow: auto;
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
