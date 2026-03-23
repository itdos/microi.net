<template>
  <el-table-column
    :prop="column.prop"
    :label="column.label"
    :width="column.width"
    :align="column.align"
  >
    <template v-if="!column.children" #header="scope">
      <div>
        <component class="icons" :is="column.icon"></component>
        {{ scope.column.label }}
      </div>
    </template>

    <template v-if="!column.children" #default="scope">
      <div>
        <template v-if="column.status_ui && scope.row['status_ui']">
          <el-space>
            <el-tag
              v-for="(status, index) in scope.row[column.prop].split(',')"
              :key="index"
              :type="scope.row['status_ui']"
            >
              {{ status }}
            </el-tag>
          </el-space>
        </template>

        <el-progress
          v-else-if="column.progress_ui && scope.row['progress_ui']"
          :text-inside="true"
          :stroke-width="widgetObj.widgetParams[5]?.value"
          :status="scope.row['progress_ui']"
          :percentage="scope.row[column.prop]"
        />

        <div
          v-else-if="column.chart_ui"
          style="display: flex; justify-content: center; align-items: center"
        >
          <el-tooltip placement="top" :show-after="500">
            <template #content>
              <div>{{ scope.row[column.prop] }}%</div>
            </template>
            <PieChart
              v-if="column.chart_ui"
              :chart-data="chartSet(scope.row)"
              :style="{ width: pie_width + 'px' }"
            />
          </el-tooltip>
        </div>

        <el-rate
          v-else-if="column.rate_ui"
          allow-half
          disabled
          show-score
          v-model="scope.row[column.prop]"
        />

        <span v-else v-html="scope.row[column.prop]" style="margin-left: 5px">
        </span>
      </div>
    </template>

    <!-- 递归渲染子列 -->
    <template v-if="column.children">
      <recursive-table-column
        v-for="(child, childIndex) in column.children"
        :key="childIndex"
        :column="child"
        :widget-obj="widgetObj"
      />
    </template>
  </el-table-column>
</template>

<script setup name="RecursiveTableColumn">
import { defineAsyncComponent, ref, computed } from 'vue'
const PieChart = defineAsyncComponent(() =>
  import('../../components/vuechart/PieChart.vue')
)

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  widgetObj: {
    type: Object,
    required: true,
  },
})

const pie_width = ref(props.widgetObj.widgetParams[14]?.value)
const pie_bg_color = ref(props.widgetObj.widgetParams[15]?.value)
const pie_border_color = ref(props.widgetObj.widgetParams[16]?.value)

const chartSet = computed(() => {
  return (item) => {
    return {
      labels: [item[props.column.label]],
      datasets: [
        {
          data: [item[props.column.label], 100 - item[props.column.label]],
          backgroundColor: [pie_bg_color.value, '#c8c8c820'],
          borderColor: [pie_border_color.value, '#c8c8c8'],
          borderWidth: 1,
        },
      ],
    }
  }
})
</script>

<style lang="scss" scoped>
.icons {
  width: 13px;
  margin-top: 2px;
}
</style>
