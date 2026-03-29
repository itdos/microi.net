<template>
  <div class="diyform-widget" :style="{ width: '100%', height: autoHeight }">
    <div v-if="!tableId" class="widget-placeholder">
      <el-icon :size="32"><Document /></el-icon>
      <span>DIY表单 - 请配置表ID</span>
    </div>
    <component
      v-else
      :is="diyFormComp"
      :key="'diyform_' + widgetObj.widgetOption.number + '_' + tableId + '_' + tableRowId"
      :TableChildTableId="tableId"
      :TableChildFormMode="formMode"
      :TableName="tableName"
    />
  </div>
</template>

<script setup name="diyform-widget">
import { computed, defineAsyncComponent, onBeforeUnmount, shallowRef } from 'vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

// 使用 shallowRef + defineAsyncComponent 避免内存泄漏
const diyFormComp = shallowRef(
  defineAsyncComponent(() => import('@/views/form-engine/diy-form-full.vue'))
)

const autoHeight = computed(() => {
  return props.widgetObj.widgetOption.height + 'px'
})

const tableId = computed(() => {
  return props.widgetObj.widgetParams[0]?.value || ''
})

const tableRowId = computed(() => {
  return props.widgetObj.widgetParams[1]?.value || ''
})

const formMode = computed(() => {
  return props.widgetObj.widgetParams[2]?.value || 'View'
})

const tableName = computed(() => {
  return props.widgetObj.widgetParams[3]?.value || ''
})

onBeforeUnmount(() => {
  diyFormComp.value = null
})
</script>

<style lang="scss" scoped>
.diyform-widget {
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
