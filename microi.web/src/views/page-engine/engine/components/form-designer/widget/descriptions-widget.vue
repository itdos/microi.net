<template>
  <el-descriptions
    :border="widgetObj.widgetParams[1]?.value"
    :column="widgetObj.widgetParams[2]?.value"
    :direction="widgetObj.widgetParams[3]?.value"
    :size="widgetObj.widgetParams[4]?.value"
    :label-width="widgetObj.widgetParams[7]?.value"
  >
    <!-- 使用具名插槽 title -->
    <template #title>
      <span v-html="widgetObj.widgetParams[5]?.value"></span>
    </template>

    <!-- 使用具名插槽 extra -->
    <template #extra>
      <span v-html="widgetObj.widgetParams[6]?.value"></span>
    </template>

    <template
      v-for="(item, index) in widgetObj.widgetParams[0].typeOptions.dataJson"
      :key="index"
    >
      <el-descriptions-item
        :span="item.span ? item.span : 1"
        :rowspan="item.rowspan ? item.rowspan : 1"
        :align="item.align ? item.align : 'center'"
        :label-align="item.labelAlign ? item.labelAlign : 'center'"
      >
        <template #label>
          <span v-html="item.label"></span>
        </template>

        <template #default>
          <el-tag v-if="item.tag_ui" :type="item.tag_status">{{
            item.value
          }}</el-tag>
          <el-progress
            v-else-if="item.progress_ui"
            :color="item.progress_color"
            :status="item.progress_status"
            :stroke-width="widgetObj.widgetParams[8]?.value"
            :percentage="item.value"
          />

          <el-rate
            v-else-if="item.rate_ui"
            allow-half
            disabled
            show-score
            v-model="item.value"
          />

          <div
            v-else-if="item.chart_ui && item.value"
            style="display: flex; justify-content: center; align-items: center"
          >
            <PieChart
              v-if="item.chart_ui && item.value"
              :chart-data="chartSet(item)"
              :style="{ width: pie_width + 'px' }"
            />
          </div>

          <span v-else v-html="item.value" />
        </template>
      </el-descriptions-item>
    </template>
  </el-descriptions>
</template>

<script setup name="descriptions-widget">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useWidget } from '../../../hooks/useWidget'
const PieChart = defineAsyncComponent(() =>
  import('../../../components/vuechart/PieChart.vue')
)
const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

const pie_width = ref(props.widgetObj.widgetParams[9]?.value)
const pie_bg_color = ref(props.widgetObj.widgetParams[10]?.value)
const pie_border_color = ref(props.widgetObj.widgetParams[11]?.value)

const chartSet = computed(() => {
  return (item) => {
    return {
      labels: [item.value],
      datasets: [
        {
          data: [item.value, 100 - item.value],
          backgroundColor: [pie_bg_color.value, '#c8c8c820'],
          borderColor: [pie_border_color.value, '#c8c8c8'],
          borderWidth: 1,
        },
      ],
    }
  }
})

// //设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()
</script>

<style lang="scss" scoped>
:deep(.my-label) {
  background-color: var(--el-color-success-light-9) !important;
}
:deep(.my-content) {
  background: var(--el-color-danger-light-9);
}
</style>
